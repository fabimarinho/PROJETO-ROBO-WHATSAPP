-- ============================================================
-- Phase 5: Stripe recurring billing + auditable financial data
-- ============================================================

alter table plans
  add column if not exists stripe_product_id varchar(120),
  add column if not exists stripe_price_id varchar(120);

create unique index if not exists uq_plans_stripe_product_id
  on plans (stripe_product_id)
  where stripe_product_id is not null;

create unique index if not exists uq_plans_stripe_price_id
  on plans (stripe_price_id)
  where stripe_price_id is not null;

alter table tenants
  add column if not exists stripe_customer_id varchar(120);

create unique index if not exists uq_tenants_stripe_customer_id
  on tenants (stripe_customer_id)
  where stripe_customer_id is not null;

alter table subscriptions
  add column if not exists external_customer_id varchar(120),
  add column if not exists external_price_id varchar(120);

create index if not exists idx_subscriptions_external_customer_id
  on subscriptions (external_customer_id)
  where external_customer_id is not null;

create table if not exists billing_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  source varchar(30) not null default 'stripe',
  event_id varchar(160) not null,
  event_type varchar(120) not null,
  object_id varchar(160),
  status varchar(30) not null default 'processed' check (status in ('processed', 'ignored', 'failed')),
  payload_jsonb jsonb not null default '{}'::jsonb,
  error_message text,
  processed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (tenant_id, source, event_id)
);

create index if not exists idx_billing_events_tenant_created
  on billing_events (tenant_id, created_at desc);

create table if not exists billing_invoices (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  subscription_id uuid references subscriptions(id) on delete set null,
  external_invoice_id varchar(160) not null,
  external_customer_id varchar(120),
  currency_code char(3) not null default 'BRL',
  amount_due_cents integer not null default 0 check (amount_due_cents >= 0),
  amount_paid_cents integer not null default 0 check (amount_paid_cents >= 0),
  status varchar(30) not null check (status in ('open', 'paid', 'void', 'uncollectible')),
  due_at timestamptz,
  paid_at timestamptz,
  hosted_invoice_url text,
  invoice_pdf_url text,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, external_invoice_id)
);

create index if not exists idx_billing_invoices_tenant_status_created
  on billing_invoices (tenant_id, status, created_at desc);

-- RLS strict for new tenant-scoped billing tables.
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'billing_events',
      'billing_invoices'
    ]) as table_name
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format('alter table %I force row level security', r.table_name);
    execute format('drop policy if exists tenant_isolation on %I', r.table_name);
    execute format(
      'create policy tenant_isolation on %I
       using (
         tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid
       )
       with check (
         tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid
       )',
      r.table_name
    );
  end loop;
end $$;
