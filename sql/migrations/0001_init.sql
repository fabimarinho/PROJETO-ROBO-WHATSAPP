create extension if not exists "pgcrypto";

create table if not exists tenants (
  id uuid primary key default gen_random_uuid(),
  name varchar(160) not null,
  plan_code varchar(60) not null,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  email varchar(255) not null unique,
  password_hash text not null,
  mfa_enabled boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tenant_users (
  tenant_id uuid not null references tenants(id),
  user_id uuid not null references users(id),
  role varchar(40) not null,
  status varchar(20) not null default 'active',
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  wa_id varchar(40),
  phone_e164 varchar(20) not null,
  attributes_jsonb jsonb not null default '{}'::jsonb,
  consent_status varchar(20) not null default 'unknown',
  created_at timestamptz not null default now(),
  unique (tenant_id, phone_e164)
);

create table if not exists templates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name varchar(120) not null,
  language_code varchar(10) not null,
  category varchar(40) not null,
  meta_template_id varchar(120),
  status varchar(20) not null default 'draft',
  created_at timestamptz not null default now(),
  unique (tenant_id, name, language_code)
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  name varchar(180) not null,
  template_id uuid not null references templates(id),
  status varchar(30) not null default 'draft',
  scheduled_at timestamptz,
  created_by uuid not null references users(id),
  created_at timestamptz not null default now()
);

create table if not exists campaign_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  campaign_id uuid not null references campaigns(id),
  contact_id uuid not null references contacts(id),
  idempotency_key varchar(100) not null,
  meta_message_id varchar(120),
  status varchar(30) not null default 'queued',
  error_code varchar(60),
  attempt_count int not null default 0,
  next_retry_at timestamptz,
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create table if not exists webhook_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id),
  source varchar(30) not null,
  payload_jsonb jsonb not null,
  signature_ok boolean not null,
  processed_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists usage_counters (
  tenant_id uuid not null references tenants(id),
  period_day date not null,
  sent_count bigint not null default 0,
  delivered_count bigint not null default 0,
  failed_count bigint not null default 0,
  billable_count bigint not null default 0,
  primary key (tenant_id, period_day)
);

create index if not exists idx_contacts_tenant_created on contacts(tenant_id, created_at desc);
create index if not exists idx_campaigns_tenant_status on campaigns(tenant_id, status);
create index if not exists idx_cmsg_tenant_campaign_status on campaign_messages(tenant_id, campaign_id, status);
create index if not exists idx_cmsg_tenant_created on campaign_messages(tenant_id, created_at desc);
create index if not exists idx_webhook_tenant_created on webhook_events(tenant_id, created_at desc);
