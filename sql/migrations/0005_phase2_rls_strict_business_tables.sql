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
