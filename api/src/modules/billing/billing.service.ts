import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException
} from '@nestjs/common';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { PostgresService } from '../../shared/database/postgres.service';

type UsageRow = {
  period_day: string;
  sent_count: string;
  delivered_count: string;
  failed_count: string;
  billable_count: string;
};

type InvoiceRow = {
  id: string;
  external_invoice_id: string;
  status: string;
  currency_code: string;
  amount_due_cents: number;
  amount_paid_cents: number;
  due_at: string | null;
  paid_at: string | null;
  created_at: string;
};

type StripeEvent = { id: string; type: string; data?: { object?: Record<string, unknown> } };

@Injectable()
export class BillingService {
  constructor(private readonly db: PostgresService) {}

  async getUsage(tenantId: string, days = 30): Promise<{
    days: number;
    totals: { sent: number; delivered: number; failed: number; billable: number };
    daily: Array<{ day: string; sent: number; delivered: number; failed: number; billable: number }>;
  }> {
    const safeDays = Math.min(Math.max(days, 1), 90);
    const res = await this.db.queryForTenant<UsageRow>(
      tenantId,
      `select period_day::text, sent_count::text, delivered_count::text, failed_count::text, billable_count::text
       from usage_counters
       where tenant_id = $1 and period_day >= current_date - make_interval(days => $2::int)
       order by period_day asc`,
      [tenantId, safeDays]
    );

    const daily = res.rows.map((row) => ({
      day: row.period_day,
      sent: Number(row.sent_count),
      delivered: Number(row.delivered_count),
      failed: Number(row.failed_count),
      billable: Number(row.billable_count)
    }));
    const totals = daily.reduce(
      (acc, item) => ({
        sent: acc.sent + item.sent,
        delivered: acc.delivered + item.delivered,
        failed: acc.failed + item.failed,
        billable: acc.billable + item.billable
      }),
      { sent: 0, delivered: 0, failed: 0, billable: 0 }
    );
    return { days: safeDays, totals, daily };
  }

  async getSubscriptionStatus(tenantId: string): Promise<{
    tenantStatus: string;
    tenantPlanCode: string;
    subscriptionStatus: string | null;
    messageLimitMonthly: number | null;
    usedThisMonth: number;
    canDispatch: boolean;
  }> {
    const row = await this.loadDispatchRow(tenantId);
    const used = Number(row.used_this_month);
    const limit = row.message_limit_monthly;
    const canDispatch =
      row.tenant_status === 'active' &&
      (row.subscription_status === 'active' || row.subscription_status === 'trialing') &&
      (limit === null || used < limit);
    return {
      tenantStatus: row.tenant_status,
      tenantPlanCode: row.plan_code,
      subscriptionStatus: row.subscription_status,
      messageLimitMonthly: limit,
      usedThisMonth: used,
      canDispatch
    };
  }

  async assertTenantCanDispatch(tenantId: string, requestedMessages = 1): Promise<void> {
    const row = await this.loadDispatchRow(tenantId);
    if (row.tenant_status !== 'active') {
      throw new ForbiddenException('Tenant blocked due to billing status');
    }
    if (!(row.subscription_status === 'active' || row.subscription_status === 'trialing')) {
      throw new ForbiddenException('Subscription does not allow dispatch');
    }
    const used = Number(row.used_this_month);
    const limit = row.message_limit_monthly;
    if (limit !== null && used + Math.max(1, Math.floor(requestedMessages)) > limit) {
      throw new ForbiddenException('Plan monthly message limit exceeded');
    }
  }

  async syncPlanWithStripe(planCode: string): Promise<{ planCode: string; stripeProductId: string; stripePriceId: string }> {
    const plan = await this.db.query<{ id: string; code: string; name: string; description: string | null; price_cents: number; currency_code: string; stripe_product_id: string | null; stripe_price_id: string | null; billing_period: string }>(
      `select id, code, name, description, price_cents, currency_code, stripe_product_id, stripe_price_id, billing_period
       from plans where code = $1 and deleted_at is null limit 1`,
      [planCode]
    );
    const row = plan.rows[0];
    if (!row) throw new NotFoundException('Plan not found');
    if (row.billing_period !== 'monthly') throw new BadRequestException('Only monthly plans are supported');
    if (row.stripe_product_id && row.stripe_price_id) {
      return { planCode: row.code, stripeProductId: row.stripe_product_id, stripePriceId: row.stripe_price_id };
    }

    const product = await this.stripeRequest<{ id: string }>('POST', '/products', {
      name: row.name,
      description: row.description ?? `Plano ${row.name}`
    });
    const price = await this.stripeRequest<{ id: string }>('POST', '/prices', {
      product: product.id,
      unit_amount: String(row.price_cents),
      currency: row.currency_code.toLowerCase(),
      'recurring[interval]': 'month',
      'metadata[plan_code]': row.code
    });
    await this.db.query('update plans set stripe_product_id = $1, stripe_price_id = $2, updated_at = now() where id = $3', [
      product.id,
      price.id,
      row.id
    ]);
    return { planCode: row.code, stripeProductId: product.id, stripePriceId: price.id };
  }

  async subscribeMonthly(tenantId: string, planCode: string): Promise<{ externalSubscriptionId: string; status: string }> {
    const tenant = await this.db.query<{ id: string; name: string; stripe_customer_id: string | null }>(
      'select id, name, stripe_customer_id from tenants where id = $1 limit 1',
      [tenantId]
    );
    const tenantRow = tenant.rows[0];
    if (!tenantRow) throw new NotFoundException('Tenant not found');
    const plan = await this.db.query<{ id: string; code: string; stripe_price_id: string | null }>(
      'select id, code, stripe_price_id from plans where code = $1 and deleted_at is null limit 1',
      [planCode]
    );
    const planRow = plan.rows[0];
    if (!planRow || !planRow.stripe_price_id) throw new BadRequestException('Plan not synced with Stripe');

    const customerId = tenantRow.stripe_customer_id ?? (await this.createStripeCustomer(tenantRow.id, tenantRow.name));
    const stripeSub = await this.stripeRequest<Record<string, unknown>>('POST', '/subscriptions', {
      customer: customerId,
      'items[0][price]': planRow.stripe_price_id,
      'metadata[tenant_id]': tenantId,
      'metadata[plan_code]': planCode
    });
    const externalSubscriptionId = this.readStr(stripeSub.id);
    if (!externalSubscriptionId) throw new BadRequestException('Stripe subscription id missing');

    await this.db.queryForTenant(
      tenantId,
      `insert into subscriptions (
         tenant_id, plan_id, status, external_subscription_id, external_customer_id, external_price_id,
         current_period_start, current_period_end, cancel_at_period_end, metadata_jsonb
       ) values ($1, $2, $3, $4, $5, $6, now(), now() + interval '1 month', false, $7::jsonb)
       on conflict do nothing`,
      [tenantId, planRow.id, this.mapSubscriptionStatus(this.readStr(stripeSub.status)), externalSubscriptionId, customerId, planRow.stripe_price_id, JSON.stringify({})]
    );
    await this.db.queryForTenant(tenantId, 'update tenants set plan_code = $1, status = $2 where id = $3', [
      planCode,
      'active',
      tenantId
    ]);
    return { externalSubscriptionId, status: this.mapSubscriptionStatus(this.readStr(stripeSub.status)) };
  }

  async changePlan(tenantId: string, planCode: string): Promise<{ changed: true }> {
    const plan = await this.db.query<{ id: string; stripe_price_id: string | null }>(
      'select id, stripe_price_id from plans where code = $1 and deleted_at is null limit 1',
      [planCode]
    );
    const planRow = plan.rows[0];
    if (!planRow || !planRow.stripe_price_id) throw new BadRequestException('Plan not synced with Stripe');
    await this.db.queryForTenant(
      tenantId,
      `update subscriptions set plan_id = $1, external_price_id = $2, updated_at = now()
       where tenant_id = $3 and status in ('trialing','active','past_due','paused') and deleted_at is null`,
      [planRow.id, planRow.stripe_price_id, tenantId]
    );
    await this.db.queryForTenant(tenantId, 'update tenants set plan_code = $1 where id = $2', [planCode, tenantId]);
    return { changed: true };
  }

  async cancelSubscription(tenantId: string): Promise<{ canceled: true }> {
    await this.db.queryForTenant(
      tenantId,
      `update subscriptions
       set status = 'canceled', cancel_at_period_end = true, canceled_at = now(), updated_at = now()
       where tenant_id = $1 and status in ('trialing','active','past_due','paused') and deleted_at is null`,
      [tenantId]
    );
    await this.db.queryForTenant(tenantId, 'update tenants set status = $1 where id = $2', ['inactive', tenantId]);
    return { canceled: true };
  }

  async getFinancialHistory(tenantId: string, limit = 100): Promise<InvoiceRow[]> {
    const safeLimit = Math.min(Math.max(limit, 1), 500);
    const res = await this.db.queryForTenant<InvoiceRow>(
      tenantId,
      `select id::text, external_invoice_id, status, currency_code, amount_due_cents, amount_paid_cents,
              due_at::text, paid_at::text, created_at::text
       from billing_invoices where tenant_id = $1 order by created_at desc limit $2`,
      [tenantId, safeLimit]
    );
    return res.rows;
  }

  verifyStripeSignature(rawBody: Buffer, signatureHeader?: string): void {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !signatureHeader) throw new UnauthorizedException('Missing Stripe signature');
    const t = signatureHeader.split(',').find((x) => x.startsWith('t='))?.slice(2);
    const v1 = signatureHeader.split(',').find((x) => x.startsWith('v1='))?.slice(3);
    if (!t || !v1) throw new UnauthorizedException('Invalid Stripe signature header');
    const expected = createHmac('sha256', secret).update(`${t}.${rawBody.toString('utf8')}`).digest('hex');
    const ok = Buffer.from(expected).length === Buffer.from(v1).length && timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
    if (!ok) throw new UnauthorizedException('Invalid Stripe signature');
  }

  async handleStripeWebhook(event: StripeEvent): Promise<{ processed: boolean }> {
    const object = event.data?.object ?? {};
    const customerId = this.readStr(object.customer);
    if (!customerId) return { processed: false };
    const tenant = await this.db.query<{ id: string }>('select id from tenants where stripe_customer_id = $1 limit 1', [customerId]);
    const tenantId = tenant.rows[0]?.id;
    if (!tenantId) return { processed: false };

    await this.db.queryForTenant(
      tenantId,
      `insert into billing_events (tenant_id, source, event_id, event_type, object_id, status, payload_jsonb)
       values ($1, 'stripe', $2, $3, $4, 'processed', $5::jsonb)
       on conflict (tenant_id, source, event_id) do nothing`,
      [tenantId, event.id, event.type, this.readStr(object.id), JSON.stringify(event)]
    );

    if (event.type === 'invoice.payment_failed') {
      await this.db.queryForTenant(
        tenantId,
        'update subscriptions set status = $1, cancel_at_period_end = true where tenant_id = $2 and deleted_at is null',
        ['past_due', tenantId]
      );
      await this.db.queryForTenant(tenantId, 'update tenants set status = $1 where id = $2', ['inactive', tenantId]);
    }
    if (event.type === 'invoice.paid') {
      await this.db.queryForTenant(tenantId, 'update subscriptions set status = $1 where tenant_id = $2 and deleted_at is null', [
        'active',
        tenantId
      ]);
      await this.db.queryForTenant(tenantId, 'update tenants set status = $1 where id = $2', ['active', tenantId]);
    }
    if (event.type.startsWith('invoice.')) {
      await this.upsertInvoice(tenantId, object);
    }
    return { processed: true };
  }

  private async upsertInvoice(tenantId: string, obj: Record<string, unknown>): Promise<void> {
    const externalInvoiceId = this.readStr(obj.id);
    if (!externalInvoiceId) return;
    await this.db.queryForTenant(
      tenantId,
      `insert into billing_invoices (
         tenant_id, external_invoice_id, external_customer_id, currency_code,
         amount_due_cents, amount_paid_cents, status, due_at, paid_at, metadata_jsonb
       ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)
       on conflict (tenant_id, external_invoice_id)
       do update set
         amount_due_cents = excluded.amount_due_cents,
         amount_paid_cents = excluded.amount_paid_cents,
         status = excluded.status,
         due_at = excluded.due_at,
         paid_at = excluded.paid_at,
         updated_at = now()`,
      [
        tenantId,
        externalInvoiceId,
        this.readStr(obj.customer),
        (this.readStr(obj.currency) ?? 'brl').toUpperCase(),
        this.readNum(obj.amount_due) ?? 0,
        this.readNum(obj.amount_paid) ?? 0,
        this.mapInvoiceStatus(this.readStr(obj.status)),
        this.toDate(this.readNum(obj.due_date)),
        this.toDate(this.readNum((obj.status_transitions as Record<string, unknown> | undefined)?.paid_at)),
        JSON.stringify({})
      ]
    );
  }

  private async loadDispatchRow(tenantId: string): Promise<{
    tenant_status: string;
    plan_code: string;
    subscription_status: string | null;
    message_limit_monthly: number | null;
    used_this_month: string;
  }> {
    const res = await this.db.queryForTenant<{
      tenant_status: string;
      plan_code: string;
      subscription_status: string | null;
      message_limit_monthly: number | null;
      used_this_month: string;
    }>(
      tenantId,
      `select t.status as tenant_status, t.plan_code, s.status as subscription_status, p.message_limit_monthly,
              coalesce((select sum(uc.billable_count)::text
                        from usage_counters uc
                        where uc.tenant_id = t.id
                          and date_trunc('month', uc.period_day::timestamp) = date_trunc('month', now())), '0') as used_this_month
       from tenants t
       left join subscriptions s on s.tenant_id = t.id and s.status in ('trialing','active','past_due','paused') and s.deleted_at is null
       left join plans p on p.id = s.plan_id
       where t.id = $1
       order by s.created_at desc nulls last
       limit 1`,
      [tenantId]
    );
    const row = res.rows[0];
    if (!row) throw new NotFoundException('Tenant billing row not found');
    return row;
  }

  private async createStripeCustomer(tenantId: string, name: string): Promise<string> {
    const customer = await this.stripeRequest<{ id: string }>('POST', '/customers', {
      name,
      'metadata[tenant_id]': tenantId
    });
    await this.db.query('update tenants set stripe_customer_id = $1 where id = $2', [customer.id, tenantId]);
    return customer.id;
  }

  private async stripeRequest<T extends Record<string, unknown>>(method: 'GET' | 'POST', path: string, form?: Record<string, string>): Promise<T> {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new BadRequestException('STRIPE_SECRET_KEY is not configured');
    const headers: Record<string, string> = { Authorization: `Bearer ${key}`, 'Stripe-Version': process.env.STRIPE_API_VERSION ?? '2024-06-20' };
    const req: RequestInit = { method, headers };
    if (method === 'POST' && form) {
      headers['Content-Type'] = 'application/x-www-form-urlencoded';
      headers['Idempotency-Key'] = randomUUID();
      req.body = new URLSearchParams(form).toString();
    }
    const response = await fetch(`https://api.stripe.com/v1${path}`, req);
    const payload = (await response.json()) as T & { error?: { message?: string } };
    if (!response.ok) throw new BadRequestException(payload.error?.message ?? 'Stripe request failed');
    return payload as T;
  }

  private mapSubscriptionStatus(raw: string | null): string {
    if (raw === 'trialing' || raw === 'active' || raw === 'past_due' || raw === 'paused' || raw === 'canceled') return raw;
    if (raw === 'unpaid') return 'past_due';
    return 'canceled';
  }

  private mapInvoiceStatus(raw: string | null): string {
    if (raw === 'paid' || raw === 'void' || raw === 'uncollectible') return raw;
    return 'open';
  }

  private readStr(value: unknown): string | null {
    return typeof value === 'string' && value.length > 0 ? value : null;
  }

  private readNum(value: unknown): number | null {
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private toDate(unix: number | null): string | null {
    return unix ? new Date(unix * 1000).toISOString() : null;
  }
}
