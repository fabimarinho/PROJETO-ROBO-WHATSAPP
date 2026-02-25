-- Full bootstrap schema for Phase 2 (run on empty database)
-- Includes baseline + indexes + phase2 multi-tenant model

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

create table if not exists refresh_tokens (
  id uuid primary key,
  user_id uuid not null references users(id) on delete cascade,
  token_hash text not null,
  expires_at timestamptz not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_refresh_tokens_user_expires
  on refresh_tokens (user_id, expires_at desc);

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


create index if not exists idx_campaign_messages_meta_id
  on campaign_messages (tenant_id, meta_message_id);


create extension if not exists "pgcrypto";

-- ============================================================
-- Phase 2: SaaS multi-tenant data model (tenant_id strategy)
-- Non-breaking evolution over existing schema.
-- ============================================================

-- --------------------------
-- Plans and subscriptions
-- --------------------------
create table if not exists plans (
  id uuid primary key default gen_random_uuid(),
  code varchar(60) not null unique,
  name varchar(120) not null,
  description text,
  price_cents integer not null default 0 check (price_cents >= 0),
  currency_code char(3) not null default 'BRL',
  billing_period varchar(20) not null default 'monthly' check (billing_period in ('monthly', 'yearly', 'custom')),
  message_limit_monthly integer not null default 0 check (message_limit_monthly >= 0),
  overage_price_cents integer not null default 0 check (overage_price_cents >= 0),
  features_jsonb jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table if not exists subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status varchar(30) not null check (status in ('trialing', 'active', 'past_due', 'canceled', 'paused')),
  external_subscription_id varchar(120),
  current_period_start timestamptz not null,
  current_period_end timestamptz not null,
  cancel_at_period_end boolean not null default false,
  canceled_at timestamptz,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create unique index if not exists uq_subscriptions_external_subscription_id
  on subscriptions (external_subscription_id)
  where external_subscription_id is not null;

create unique index if not exists uq_subscriptions_tenant_one_open
  on subscriptions (tenant_id)
  where status in ('trialing', 'active', 'past_due', 'paused') and deleted_at is null;

create index if not exists idx_subscriptions_tenant_status
  on subscriptions (tenant_id, status, current_period_end desc);

-- --------------------------
-- Roles and users evolution
-- --------------------------
create table if not exists roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  code varchar(60) not null,
  name varchar(120) not null,
  description text,
  permissions_jsonb jsonb not null default '[]'::jsonb,
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, code)
);

create unique index if not exists uq_roles_id_tenant
  on roles (id, tenant_id);

alter table users
  add column if not exists primary_tenant_id uuid references tenants(id),
  add column if not exists full_name varchar(160),
  add column if not exists status varchar(20) not null default 'active',
  add column if not exists last_login_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'chk_users_status'
  ) then
    alter table users add constraint chk_users_status
      check (status in ('active', 'invited', 'suspended'));
  end if;
end $$;

-- ============================================================
-- Phase 2 hardening: validate tenant-safe foreign keys
-- ============================================================

alter table campaigns validate constraint fk_campaigns_template_tenant;
alter table campaigns validate constraint fk_campaigns_whatsapp_account_tenant;

alter table campaign_messages validate constraint fk_campaign_messages_campaign_tenant;
alter table campaign_messages validate constraint fk_campaign_messages_contact_tenant;

alter table campaign_contacts validate constraint fk_campaign_contacts_campaign_tenant;
alter table campaign_contacts validate constraint fk_campaign_contacts_contact_tenant;

alter table messages validate constraint fk_messages_campaign_tenant;
alter table messages validate constraint fk_messages_campaign_contact_tenant;
alter table messages validate constraint fk_messages_contact_tenant;
alter table messages validate constraint fk_messages_whatsapp_account_tenant;

alter table message_logs validate constraint fk_message_logs_message_tenant;
alter table webhooks validate constraint fk_webhooks_whatsapp_account_tenant;

alter table tenant_users
  add column if not exists role_id uuid,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'fk_tenant_users_role_tenant'
  ) then
    alter table tenant_users
      add constraint fk_tenant_users_role_tenant
      foreign key (role_id, tenant_id) references roles(id, tenant_id);
  end if;
end $$;

create index if not exists idx_tenant_users_tenant_role on tenant_users(tenant_id, role_id);

-- --------------------------
-- WhatsApp account registry
-- --------------------------
create table if not exists whatsapp_accounts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  waba_id varchar(80) not null,
  meta_phone_number_id varchar(80) not null,
  display_phone_number varchar(40) not null,
  verified_name varchar(160),
  quality_rating varchar(20) not null default 'unknown'
    check (quality_rating in ('unknown', 'green', 'yellow', 'red')),
  status varchar(20) not null default 'active'
    check (status in ('active', 'disabled', 'pending_verification')),
  encrypted_access_token text,
  token_expires_at timestamptz,
  webhook_verify_token_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, meta_phone_number_id)
);

create index if not exists idx_whatsapp_accounts_tenant_status
  on whatsapp_accounts (tenant_id, status);

-- --------------------------
-- Existing tables hardening
-- --------------------------
alter table campaigns
  add column if not exists whatsapp_account_id uuid references whatsapp_accounts(id),
  add column if not exists started_at timestamptz,
  add column if not exists finished_at timestamptz,
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

alter table contacts
  add column if not exists external_ref varchar(120),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists deleted_at timestamptz;

-- --------------------------
-- Campaign delivery model
-- --------------------------
create table if not exists campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  status varchar(30) not null default 'queued'
    check (status in ('queued', 'sent', 'failed', 'skipped')),
  personalization_jsonb jsonb not null default '{}'::jsonb,
  error_code varchar(80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, campaign_id, contact_id)
);

create index if not exists idx_campaign_contacts_tenant_status
  on campaign_contacts (tenant_id, status, created_at desc);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid references campaigns(id),
  campaign_contact_id uuid references campaign_contacts(id),
  contact_id uuid references contacts(id),
  whatsapp_account_id uuid references whatsapp_accounts(id),
  direction varchar(20) not null check (direction in ('outbound', 'inbound')),
  provider varchar(30) not null default 'meta' check (provider in ('meta')),
  provider_message_id varchar(140),
  idempotency_key varchar(120) not null,
  status varchar(30) not null default 'queued'
    check (status in ('queued', 'accepted_meta', 'sent', 'delivered', 'read', 'failed_retryable', 'failed_permanent', 'rate_limited')),
  template_name varchar(120),
  template_language_code varchar(12),
  payload_jsonb jsonb not null default '{}'::jsonb,
  error_code varchar(80),
  sent_at timestamptz,
  delivered_at timestamptz,
  read_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, idempotency_key)
);

create unique index if not exists uq_messages_tenant_provider_message_id
  on messages (tenant_id, provider_message_id)
  where provider_message_id is not null;

create index if not exists idx_messages_tenant_status_created
  on messages (tenant_id, status, created_at desc);

create index if not exists idx_messages_tenant_campaign
  on messages (tenant_id, campaign_id, created_at desc);

create table if not exists message_logs (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  event_type varchar(60) not null,
  event_source varchar(30) not null default 'system' check (event_source in ('system', 'meta_webhook', 'worker', 'api')),
  event_at timestamptz not null default now(),
  payload_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_message_logs_tenant_message_event
  on message_logs (tenant_id, message_id, event_at desc);

-- --------------------------
-- Webhooks, audit and API keys
-- --------------------------
create table if not exists webhooks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  whatsapp_account_id uuid references whatsapp_accounts(id),
  source varchar(40) not null default 'meta_whatsapp',
  event_type varchar(60) not null,
  external_event_id varchar(140),
  signature_ok boolean not null default false,
  status varchar(20) not null default 'received' check (status in ('received', 'processed', 'failed', 'ignored')),
  payload_jsonb jsonb not null default '{}'::jsonb,
  error_message text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  retry_count integer not null default 0 check (retry_count >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists uq_webhooks_tenant_source_external_event
  on webhooks (tenant_id, source, external_event_id)
  where external_event_id is not null;

create index if not exists idx_webhooks_tenant_status_received
  on webhooks (tenant_id, status, received_at desc);

create table if not exists audit_logs (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  actor_user_id uuid references users(id),
  actor_type varchar(30) not null check (actor_type in ('user', 'api_key', 'system')),
  action varchar(80) not null,
  entity_type varchar(80) not null,
  entity_id varchar(120) not null,
  ip_address inet,
  user_agent text,
  metadata_jsonb jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_logs_tenant_created
  on audit_logs (tenant_id, created_at desc);

create index if not exists idx_audit_logs_tenant_action
  on audit_logs (tenant_id, action, created_at desc);

create table if not exists api_keys (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  created_by uuid references users(id),
  name varchar(120) not null,
  key_prefix varchar(16) not null,
  key_hash text not null unique,
  scopes_jsonb jsonb not null default '[]'::jsonb,
  status varchar(20) not null default 'active' check (status in ('active', 'revoked', 'expired')),
  last_used_at timestamptz,
  expires_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, name)
);

create index if not exists idx_api_keys_tenant_status
  on api_keys (tenant_id, status, created_at desc);


-- ============================================================
-- Phase 2 hardening: tenant integrity + RLS + updated_at
-- ============================================================

-- ============================================================
-- Phase 2 hardening: tenant integrity + RLS + updated_at
-- Safe rollout strategy:
-- - Add tenant-safe FKs as NOT VALID (enforced for new rows).
-- - Keep app compatibility with optional app.tenant_id session var.
-- ============================================================

-- Composite unique indexes to support tenant-safe foreign keys
create unique index if not exists uq_templates_tenant_id_id on templates (tenant_id, id);
create unique index if not exists uq_campaigns_tenant_id_id on campaigns (tenant_id, id);
create unique index if not exists uq_contacts_tenant_id_id on contacts (tenant_id, id);
create unique index if not exists uq_campaign_messages_tenant_id_id on campaign_messages (tenant_id, id);
create unique index if not exists uq_campaign_contacts_tenant_id_id on campaign_contacts (tenant_id, id);
create unique index if not exists uq_whatsapp_accounts_tenant_id_id on whatsapp_accounts (tenant_id, id);
create unique index if not exists uq_messages_tenant_id_id on messages (tenant_id, id);

-- Tenant-safe integrity constraints (NOT VALID to avoid blocking on legacy data)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'fk_campaigns_template_tenant') then
    alter table campaigns
      add constraint fk_campaigns_template_tenant
      foreign key (tenant_id, template_id) references templates(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_campaigns_whatsapp_account_tenant') then
    alter table campaigns
      add constraint fk_campaigns_whatsapp_account_tenant
      foreign key (tenant_id, whatsapp_account_id) references whatsapp_accounts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_campaign_messages_campaign_tenant') then
    alter table campaign_messages
      add constraint fk_campaign_messages_campaign_tenant
      foreign key (tenant_id, campaign_id) references campaigns(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_campaign_messages_contact_tenant') then
    alter table campaign_messages
      add constraint fk_campaign_messages_contact_tenant
      foreign key (tenant_id, contact_id) references contacts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_campaign_contacts_campaign_tenant') then
    alter table campaign_contacts
      add constraint fk_campaign_contacts_campaign_tenant
      foreign key (tenant_id, campaign_id) references campaigns(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_campaign_contacts_contact_tenant') then
    alter table campaign_contacts
      add constraint fk_campaign_contacts_contact_tenant
      foreign key (tenant_id, contact_id) references contacts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_messages_campaign_tenant') then
    alter table messages
      add constraint fk_messages_campaign_tenant
      foreign key (tenant_id, campaign_id) references campaigns(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_messages_campaign_contact_tenant') then
    alter table messages
      add constraint fk_messages_campaign_contact_tenant
      foreign key (tenant_id, campaign_contact_id) references campaign_contacts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_messages_contact_tenant') then
    alter table messages
      add constraint fk_messages_contact_tenant
      foreign key (tenant_id, contact_id) references contacts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_messages_whatsapp_account_tenant') then
    alter table messages
      add constraint fk_messages_whatsapp_account_tenant
      foreign key (tenant_id, whatsapp_account_id) references whatsapp_accounts(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_message_logs_message_tenant') then
    alter table message_logs
      add constraint fk_message_logs_message_tenant
      foreign key (tenant_id, message_id) references messages(tenant_id, id) not valid;
  end if;

  if not exists (select 1 from pg_constraint where conname = 'fk_webhooks_whatsapp_account_tenant') then
    alter table webhooks
      add constraint fk_webhooks_whatsapp_account_tenant
      foreign key (tenant_id, whatsapp_account_id) references whatsapp_accounts(tenant_id, id) not valid;
  end if;
end $$;

-- Standardized updated_at trigger
create or replace function trg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  r record;
begin
  for r in
    select t.table_name
    from information_schema.tables t
    where t.table_schema = 'public'
      and t.table_type = 'BASE TABLE'
      and t.table_name in (
        'plans',
        'subscriptions',
        'roles',
        'users',
        'tenant_users',
        'whatsapp_accounts',
        'campaigns',
        'contacts',
        'campaign_contacts',
        'messages',
        'api_keys'
      )
  loop
    execute format('drop trigger if exists trg_%I_set_updated_at on %I', r.table_name, r.table_name);
    execute format(
      'create trigger trg_%I_set_updated_at before update on %I for each row execute function trg_set_updated_at()',
      r.table_name,
      r.table_name
    );
  end loop;
end $$;

-- Row Level Security (tenant-aware, compatibility mode)
-- If app.tenant_id is not set, policy allows access (useful for admin/migration sessions).
do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'subscriptions',
      'roles',
      'tenant_users',
      'whatsapp_accounts',
      'templates',
      'contacts',
      'campaigns',
      'campaign_messages',
      'campaign_contacts',
      'messages',
      'message_logs',
      'webhooks',
      'audit_logs',
      'api_keys',
      'usage_counters'
    ]) as table_name
  loop
    execute format('alter table %I enable row level security', r.table_name);
    execute format('drop policy if exists tenant_isolation on %I', r.table_name);
    execute format(
      'create policy tenant_isolation on %I
       using (
         current_setting(''app.tenant_id'', true) is null
         or tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid
       )
       with check (
         current_setting(''app.tenant_id'', true) is null
         or tenant_id = nullif(current_setting(''app.tenant_id'', true), '''')::uuid
       )',
      r.table_name
    );
  end loop;
end $$;

-- High-volume read optimizations and retention helpers
create index if not exists idx_message_logs_tenant_event_type_event_at
  on message_logs (tenant_id, event_type, event_at desc);

create index if not exists idx_webhooks_tenant_source_received
  on webhooks (tenant_id, source, received_at desc);

create index if not exists idx_audit_logs_tenant_entity_created
  on audit_logs (tenant_id, entity_type, created_at desc);

create or replace function purge_old_event_data(p_message_logs_days integer, p_webhooks_days integer, p_audit_logs_days integer)
returns void
language plpgsql
as $$
begin
  delete from message_logs where event_at < now() - make_interval(days => p_message_logs_days);
  delete from webhooks where received_at < now() - make_interval(days => p_webhooks_days);
  delete from audit_logs where created_at < now() - make_interval(days => p_audit_logs_days);
end;
$$;



-- ============================================================
-- Phase 2 hardening: strict RLS on business tenant tables
-- ============================================================

-- ============================================================
-- Phase 2 hardening: strict RLS on business tenant tables
-- Requires application sessions to set: app.tenant_id
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select unnest(array[
      'subscriptions',
      'roles',
      'whatsapp_accounts',
      'templates',
      'contacts',
      'campaigns',
      'campaign_messages',
      'campaign_contacts',
      'messages',
      'message_logs',
      'webhooks',
      'audit_logs',
      'api_keys',
      'usage_counters'
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

