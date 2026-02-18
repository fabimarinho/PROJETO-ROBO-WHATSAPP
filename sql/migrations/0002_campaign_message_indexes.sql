create index if not exists idx_campaign_messages_meta_id
  on campaign_messages (tenant_id, meta_message_id);
