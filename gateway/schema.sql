-- Gateway database. Apply as the gateway role: psql "$GATEWAY_DATABASE_URL" -f schema.sql
create table if not exists ai_customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists ai_users (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ai_customers(id),
  email text not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);
create unique index if not exists ai_users_email on ai_users (lower(email));

-- Only a hash of each key is stored. prefix is the first characters, to tell keys apart.
create table if not exists ai_keys (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ai_customers(id),
  label text not null default '',
  prefix text not null,
  key_hash text not null unique,
  created_at timestamptz not null default now(),
  revoked_at timestamptz
);

create table if not exists ai_usage (
  id bigserial primary key,
  ts timestamptz not null default now(),
  customer_id uuid not null references ai_customers(id),
  key_id uuid not null references ai_keys(id),
  model text not null,
  input_tokens bigint not null,
  output_tokens bigint not null,
  cache_read bigint not null,
  cache_write_5m bigint not null,
  cache_write_1h bigint not null,
  long_ctx boolean not null,
  fast boolean not null,
  status int not null
);
create index if not exists ai_usage_customer_ts on ai_usage (customer_id, ts);

create table if not exists ai_sessions (
  token_hash text primary key,
  user_id uuid not null references ai_users(id),
  customer_id uuid not null references ai_customers(id),
  expires_at timestamptz not null
);

-- One invoice per customer per month. lines is the per-model breakdown at customer prices.
create table if not exists ai_invoices (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references ai_customers(id),
  period text not null check (period ~ '^\d{4}-(0[1-9]|1[0-2])$'),
  status text not null default 'sent',
  lines jsonb not null,
  provider_cost numeric(14,6) not null,
  markup numeric(6,4) not null,
  total numeric(12,2) not null,
  created_at timestamptz not null default now(),
  twenty_synced_at timestamptz,
  unique (customer_id, period)
);
