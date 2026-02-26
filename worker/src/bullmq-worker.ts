import { Job, Queue, Worker } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { MessageVariationEngine } from './core/message-variation-engine';
import { DbClient } from './infra/db-client';
import { PlanRateLimiter } from './infra/plan-rate-limiter';

type CampaignLaunchJob = {
  tenantId: string;
  campaignId: string;
  requestedAt: string;
  requestId: string;
};

type MessageSendJob = {
  tenantId: string;
  campaignId: string;
  messageId: string;
};

type HumanizationConfigRow = {
  profile_id: string;
  rotation_strategy: 'round_robin' | 'random';
  base_template_text: string;
  phrase_bank_jsonb: {
    openers?: string[];
    bodies?: string[];
    closings?: string[];
  } | null;
  syntactic_variation_level: number;
  min_delay_ms: number;
  max_delay_ms: number;
  last_variant_index: number;
  last_variant_hash: string | null;
};

type ContactRow = {
  id: string;
  attributes_jsonb: Record<string, unknown> | null;
};

type MessageTarget = {
  id: string;
  contact_id: string;
  idempotency_key: string;
  phone_e164: string;
  wa_id: string | null;
  template_name: string;
  template_language_code: string;
  plan_code: string;
  payload_jsonb: Record<string, unknown> | null;
};

type BillingDispatchRow = {
  tenant_status: string;
  subscription_status: string | null;
  message_limit_monthly: number | null;
  used_this_month: string;
};

const campaignQueueName = process.env.BULLMQ_CAMPAIGN_QUEUE ?? 'campaign.launch';
const messageQueueName = process.env.BULLMQ_MESSAGE_QUEUE ?? 'message.send';

const redisConnection = {
  host: process.env.REDIS_HOST ?? '127.0.0.1',
  port: Number(process.env.REDIS_PORT ?? 6379),
  password: process.env.REDIS_PASSWORD
};

const concurrency = Number(process.env.BULLMQ_WORKER_CONCURRENCY ?? 20);

async function processCampaignLaunch(db: DbClient, messageQueue: Queue<MessageSendJob>, payload: CampaignLaunchJob): Promise<void> {
  const campaignRes = await db.queryForTenant<{ id: string; template_name: string; language_code: string }>(
    payload.tenantId,
    `select cp.id, t.name as template_name, t.language_code
     from campaigns cp
     inner join templates t on t.id = cp.template_id
     where cp.id = $1 and cp.tenant_id = $2
     limit 1`,
    [payload.campaignId, payload.tenantId]
  );
  if (!campaignRes.rows[0]) {
    throw new Error('campaign_not_found');
  }

  const contactsRes = await db.queryForTenant<ContactRow>(
    payload.tenantId,
    `select id, attributes_jsonb
     from contacts
     where tenant_id = $1
       and consent_status in ('opted_in', 'unknown')
       and deleted_at is null`,
    [payload.tenantId]
  );

  const engine = new MessageVariationEngine();
  const humanization = await getHumanizationConfig(db, payload.tenantId, payload.campaignId);
  let mutableIndex = humanization?.last_variant_index ?? 0;
  let mutableHash = humanization?.last_variant_hash ?? null;

  for (const contact of contactsRes.rows) {
    const idempotencyKey = `${payload.campaignId}:${contact.id}`;

    await db.queryForTenant(
      payload.tenantId,
      `insert into campaign_contacts (tenant_id, campaign_id, contact_id, status)
       values ($1, $2, $3, 'queued')
       on conflict (tenant_id, campaign_id, contact_id)
       do update set status = 'queued', updated_at = now()`,
      [payload.tenantId, payload.campaignId, contact.id]
    );

    let variationPayload: Record<string, unknown> = {};
    let perMessageDelayMs = 0;

    if (humanization) {
      const vars = {
        nome: extractString(contact.attributes_jsonb, ['nome', 'name']) ?? 'cliente',
        cidade: extractString(contact.attributes_jsonb, ['cidade', 'city']) ?? 'sua cidade'
      };

      const variant = engine.generate(
        {
          profileId: humanization.profile_id,
          rotationStrategy: humanization.rotation_strategy,
          baseTemplateText: humanization.base_template_text,
          phraseBank: humanization.phrase_bank_jsonb ?? {},
          syntacticVariationLevel: humanization.syntactic_variation_level,
          minDelayMs: humanization.min_delay_ms,
          maxDelayMs: humanization.max_delay_ms,
          lastVariantIndex: mutableIndex,
          lastVariantHash: mutableHash
        },
        vars
      );

      mutableIndex = variant.nextIndex;
      mutableHash = variant.hash;
      perMessageDelayMs = variant.delayMs;
      variationPayload = {
        humanization: {
          profileId: humanization.profile_id,
          text: variant.text,
          hash: variant.hash,
          vars,
          delayMs: variant.delayMs
        }
      };
    }

    const messageRes = await db.queryForTenant<{ id: string }>(
      payload.tenantId,
      `insert into messages (
         tenant_id, campaign_id, contact_id, direction, provider, idempotency_key,
         status, template_name, template_language_code, payload_jsonb
       ) values ($1, $2, $3, 'outbound', 'meta', $4, 'queued', $5, $6, $7::jsonb)
       on conflict (tenant_id, idempotency_key)
       do update set status = 'queued', payload_jsonb = excluded.payload_jsonb, updated_at = now()
       returning id`,
      [
        payload.tenantId,
        payload.campaignId,
        contact.id,
        idempotencyKey,
        campaignRes.rows[0].template_name,
        campaignRes.rows[0].language_code,
        JSON.stringify(variationPayload)
      ]
    );

    if (humanization) {
      await db.queryForTenant(
        payload.tenantId,
        `insert into message_variation_events (
           tenant_id, campaign_id, contact_id, message_id, variant_text, variant_hash, delay_ms
         )
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          payload.tenantId,
          payload.campaignId,
          contact.id,
          messageRes.rows[0].id,
          String((variationPayload.humanization as Record<string, unknown>).text),
          String((variationPayload.humanization as Record<string, unknown>).hash),
          perMessageDelayMs
        ]
      );
    }

    await messageQueue.add(
      `send:${payload.tenantId}:${messageRes.rows[0].id}`,
      {
        tenantId: payload.tenantId,
        campaignId: payload.campaignId,
        messageId: messageRes.rows[0].id
      },
      {
        attempts: Number(process.env.BULLMQ_MAX_ATTEMPTS ?? 5),
        backoff: { type: 'exponential', delay: Number(process.env.BULLMQ_RETRY_DELAY_MS ?? 3000) },
        removeOnComplete: 1000,
        removeOnFail: false,
        delay: perMessageDelayMs
      }
    );
  }

  if (humanization) {
    await db.queryForTenant(
      payload.tenantId,
      `update campaign_message_humanization_settings
       set last_variant_index = $1,
           last_variant_hash = $2,
           updated_at = now()
       where tenant_id = $3 and campaign_id = $4`,
      [mutableIndex, mutableHash, payload.tenantId, payload.campaignId]
    );
  }
}

async function processMessageSend(db: DbClient, limiter: PlanRateLimiter, payload: MessageSendJob): Promise<void> {
  const targetRes = await db.queryForTenant<MessageTarget>(
    payload.tenantId,
    `select m.id, m.contact_id, m.idempotency_key, c.phone_e164, c.wa_id,
            m.template_name, m.template_language_code, t.plan_code, m.payload_jsonb
     from messages m
     inner join contacts c on c.id = m.contact_id and c.tenant_id = m.tenant_id
     inner join tenants t on t.id = m.tenant_id
     where m.id = $1 and m.tenant_id = $2 and m.campaign_id = $3
     limit 1`,
    [payload.messageId, payload.tenantId, payload.campaignId]
  );

  const target = targetRes.rows[0];
  if (!target) {
    throw new Error('message_target_not_found');
  }

  await assertBillingDispatchAllowed(db, payload.tenantId, 1);
  await limiter.assertAllowed(payload.tenantId, target.plan_code);

  const recipient = target.wa_id ?? target.phone_e164;
  const humanizedText = readHumanizedText(target.payload_jsonb);
  const sendResult = await sendWhatsappMessage({
    to: recipient,
    text: humanizedText,
    templateName: target.template_name,
    languageCode: target.template_language_code ?? 'pt_BR'
  });

  if (!sendResult.ok) {
    await db.queryForTenant(
      payload.tenantId,
      `update messages
       set status = 'failed_retryable',
           error_code = $1,
           updated_at = now()
       where id = $2 and tenant_id = $3`,
      [sendResult.errorCode, payload.messageId, payload.tenantId]
    );
    throw new Error(sendResult.errorCode);
  }

  await db.queryForTenant(
    payload.tenantId,
    `update messages
     set status = 'accepted_meta',
         provider_message_id = $1,
         error_code = null,
         updated_at = now()
     where id = $2 and tenant_id = $3`,
    [sendResult.providerMessageId, payload.messageId, payload.tenantId]
  );

  await db.queryForTenant(
    payload.tenantId,
    `insert into message_logs (tenant_id, message_id, event_type, event_source, payload_jsonb)
     values ($1, $2, 'accepted_meta', 'worker', $3::jsonb)`,
    [payload.tenantId, payload.messageId, JSON.stringify({ providerMessageId: sendResult.providerMessageId })]
  );
}

async function assertBillingDispatchAllowed(db: DbClient, tenantId: string, requestedMessages: number): Promise<void> {
  const res = await db.queryForTenant<BillingDispatchRow>(
    tenantId,
    `select t.status as tenant_status,
            s.status as subscription_status,
            p.message_limit_monthly,
            coalesce((
              select sum(uc.billable_count)::text
              from usage_counters uc
              where uc.tenant_id = t.id
                and date_trunc('month', uc.period_day::timestamp) = date_trunc('month', now())
            ), '0') as used_this_month
     from tenants t
     left join subscriptions s
       on s.tenant_id = t.id
      and s.status in ('trialing', 'active', 'past_due', 'paused')
      and s.deleted_at is null
     left join plans p on p.id = s.plan_id
     where t.id = $1
     order by s.created_at desc nulls last
     limit 1`,
    [tenantId]
  );

  const row = res.rows[0];
  if (!row) {
    throw new Error('billing_row_not_found');
  }
  if (row.tenant_status !== 'active') {
    throw new Error('billing_tenant_blocked');
  }
  if (!(row.subscription_status === 'active' || row.subscription_status === 'trialing')) {
    throw new Error('billing_subscription_blocked');
  }
  if (row.message_limit_monthly !== null) {
    const used = Number(row.used_this_month);
    if (used + Math.max(1, requestedMessages) > row.message_limit_monthly) {
      throw new Error('billing_plan_limit_exceeded');
    }
  }
}

async function getHumanizationConfig(
  db: DbClient,
  tenantId: string,
  campaignId: string
): Promise<HumanizationConfigRow | null> {
  const res = await db.queryForTenant<HumanizationConfigRow>(
    tenantId,
    `select s.profile_id, s.rotation_strategy, s.last_variant_index, s.last_variant_hash,
            p.base_template_text, p.phrase_bank_jsonb, p.syntactic_variation_level,
            p.min_delay_ms, p.max_delay_ms
     from campaign_message_humanization_settings s
     inner join message_variation_profiles p on p.id = s.profile_id and p.tenant_id = s.tenant_id
     where s.tenant_id = $1 and s.campaign_id = $2 and s.is_active = true
     limit 1`,
    [tenantId, campaignId]
  );
  return res.rows[0] ?? null;
}

function extractString(obj: Record<string, unknown> | null, keys: string[]): string | null {
  if (!obj) {
    return null;
  }
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === 'string' && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
}

function readHumanizedText(payload: Record<string, unknown> | null): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const humanization = payload.humanization as Record<string, unknown> | undefined;
  if (!humanization) {
    return null;
  }
  const text = humanization.text;
  return typeof text === 'string' && text.trim().length > 0 ? text : null;
}

async function sendWhatsappMessage(input: {
  to: string;
  text: string | null;
  templateName: string;
  languageCode: string;
}): Promise<{ ok: true; providerMessageId: string } | { ok: false; errorCode: string }> {
  const token = process.env.META_ACCESS_TOKEN;
  const phoneNumberId = process.env.META_PHONE_NUMBER_ID;
  const graphVersion = process.env.META_GRAPH_VERSION ?? 'v20.0';

  if (!token || !phoneNumberId) {
    return { ok: true, providerMessageId: `mock-${randomUUID()}` };
  }

  const body =
    input.text && input.text.length > 0
      ? {
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'text',
          text: { body: input.text }
        }
      : {
          messaging_product: 'whatsapp',
          to: input.to,
          type: 'template',
          template: {
            name: input.templateName,
            language: { code: input.languageCode }
          }
        };

  const response = await fetch(`https://graph.facebook.com/${graphVersion}/${phoneNumberId}/messages`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(body)
  });

  const payload = (await response.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { code?: number | string };
  };

  if (!response.ok) {
    return {
      ok: false,
      errorCode: payload.error?.code ? String(payload.error.code) : 'meta_request_failed'
    };
  }

  const id = payload.messages?.[0]?.id;
  if (!id) {
    return { ok: false, errorCode: 'meta_missing_message_id' };
  }

  return { ok: true, providerMessageId: id };
}

async function start(): Promise<void> {
  const db = new DbClient();
  const limiter = new PlanRateLimiter();
  const campaignDlq = new Queue('campaign.launch.dlq', { connection: redisConnection });
  const dlq = new Queue('message.send.dlq', { connection: redisConnection });
  const messageQueue = new Queue<MessageSendJob>(messageQueueName, { connection: redisConnection });

  const campaignWorker = new Worker<CampaignLaunchJob>(
    campaignQueueName,
    async (job: Job<CampaignLaunchJob>) => processCampaignLaunch(db, messageQueue, job.data),
    { connection: redisConnection, concurrency }
  );

  const messageWorker = new Worker<MessageSendJob>(
    messageQueueName,
    async (job: Job<MessageSendJob>) => processMessageSend(db, limiter, job.data),
    { connection: redisConnection, concurrency }
  );

  campaignWorker.on('failed', async (job, err) => {
    if (!job) {
      return;
    }
    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
      await campaignDlq.add(`dlq:${job.id}`, {
        ...job.data,
        reason: err.message,
        failedAt: new Date().toISOString()
      });
    }
  });

  messageWorker.on('failed', async (job, err) => {
    if (!job) {
      return;
    }
    if ((job.attemptsMade ?? 0) >= (job.opts.attempts ?? 1)) {
      await dlq.add(`dlq:${job.id}`, {
        ...job.data,
        reason: err.message,
        failedAt: new Date().toISOString()
      });
    }
  });

  const shutdown = async (): Promise<void> => {
    await Promise.all([
      campaignWorker.close(),
      messageWorker.close(),
      messageQueue.close(),
      campaignDlq.close(),
      dlq.close(),
      db.close()
    ]);
    process.exit(0);
  };

  process.on('SIGINT', () => void shutdown());
  process.on('SIGTERM', () => void shutdown());
}

void start();
