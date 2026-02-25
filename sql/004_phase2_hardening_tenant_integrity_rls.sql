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
