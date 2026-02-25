create table if not exists message_variation_profiles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references tenants(id) on delete cascade,
  name varchar(120) not null,
  base_template_text text not null,
  phrase_bank_jsonb jsonb not null default '{}'::jsonb,
  syntactic_variation_level integer not null default 1
    check (syntactic_variation_level between 0 and 3),
  min_delay_ms integer not null default 300 check (min_delay_ms >= 0),
  max_delay_ms integer not null default 1500 check (max_delay_ms >= min_delay_ms),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (tenant_id, name)
);

create table if not exists campaign_message_humanization_settings (
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid primary key references campaigns(id) on delete cascade,
  profile_id uuid not null references message_variation_profiles(id) on delete cascade,
  rotation_strategy varchar(20) not null default 'round_robin'
    check (rotation_strategy in ('round_robin', 'random')),
  is_active boolean not null default true,
  last_variant_index integer not null default 0,
  last_variant_hash varchar(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_cmh_settings_tenant_campaign
  on campaign_message_humanization_settings (tenant_id, campaign_id);

create table if not exists message_variation_events (
  id bigserial primary key,
  tenant_id uuid not null references tenants(id) on delete cascade,
  campaign_id uuid not null references campaigns(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  message_id uuid references messages(id) on delete set null,
  variant_text text not null,
  variant_hash varchar(64) not null,
  delay_ms integer not null default 0 check (delay_ms >= 0),
  created_at timestamptz not null default now()
);

create index if not exists idx_mve_tenant_campaign_created
  on message_variation_events (tenant_id, campaign_id, created_at desc);
