-- Lead bridge: assessment_requests → Twenty CRM. Run after supabase/schema.sql.
-- Replace SYNC_SECRET_VALUE and ANON_KEY_VALUE before running.

alter table public.assessment_requests
  add column if not exists synced_to_twenty_at   timestamptz,
  add column if not exists twenty_opportunity_id text;

-- The webhook fires the Edge Function on every new request. pg_net is async, so the
-- insert from the website never waits on Twenty.
create extension if not exists pg_net;

drop trigger if exists assessment_requests_sync_to_twenty on public.assessment_requests;
create trigger assessment_requests_sync_to_twenty
  after insert on public.assessment_requests
  for each row
  execute function supabase_functions.http_request(
    'https://ekmukamjcmlizopalhmq.supabase.co/functions/v1/sync-to-twenty',
    'POST',
    '{"Content-Type":"application/json","Authorization":"Bearer ANON_KEY_VALUE","x-sync-secret":"SYNC_SECRET_VALUE"}',
    '{}',
    '5000'
  );
