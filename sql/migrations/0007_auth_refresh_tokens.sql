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
