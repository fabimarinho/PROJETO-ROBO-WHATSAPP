-- ============================================================
-- Phase 2 hardening: validate tenant-safe foreign keys
-- Run after data cleanup/backfill windows.
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
