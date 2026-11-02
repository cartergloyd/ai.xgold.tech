-- xGold Tech · assessment requests
-- Run once in the Supabase SQL editor (Dashboard → SQL → New query → Run).
--
-- The site posts to this table with the publishable key as the anonymous role.
-- The anonymous role may INSERT and nothing else: it cannot read, update or
-- delete rows, so the key can sit in the page source. Read submissions in the
-- Table Editor, or with the secret key from a server you control.

create table if not exists public.assessment_requests (
  id              uuid primary key default gen_random_uuid(),
  created_at      timestamptz not null default now(),
  name            text not null check (char_length(name) between 1 and 200),
  email           text not null check (email ~* '^[^\s@]+@[^\s@]+\.[^\s@]+$' and char_length(email) <= 200),
  company         text not null check (char_length(company) between 1 and 200),
  role            text check (char_length(role) <= 200),
  constraint_area text not null check (constraint_area in ('value','pilot','risk','people','cost')),
  workflow        text not null check (workflow in ('transfers','support','procurement','compliance','other','unsure')),
  cost_today      text check (char_length(cost_today) <= 2000),
  has_owner       boolean not null default false,
  send_questions  boolean not null default false,
  source          text check (char_length(source) <= 500),
  status          text not null default 'new' check (status in ('new','contacted','scheduled','closed'))
);

comment on table public.assessment_requests is 'Submissions from book.html (Start an assessment).';

alter table public.assessment_requests enable row level security;

-- Insert-only for the anonymous role. New rows must start in status "new".
drop policy if exists "public can submit a request" on public.assessment_requests;
create policy "public can submit a request"
  on public.assessment_requests
  for insert
  to anon
  with check (status = 'new');

revoke all on public.assessment_requests from anon;
grant insert on public.assessment_requests to anon;

-- No select / update / delete policies exist for anon on purpose.

-- Optional, after this runs: Dashboard → Database → Webhooks → create a webhook on
-- INSERT for assessment_requests to get an email or Slack message per request.
