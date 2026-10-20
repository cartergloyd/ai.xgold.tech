# sync-to-twenty

Turns each new row in `assessment_requests` into a Company, Person, Opportunity (stage NEW)
and Note in Twenty. The Twenty API key lives only in Supabase's secret store.

## Setup (dashboard, no CLI)

1. In Twenty: **Settings → Developers → API → Create key**. Copy it once.
2. Supabase → **Edge Functions → Deploy a new function → Via Editor**. Name it `sync-to-twenty`,
   paste `index.ts`, deploy.
3. Supabase → **Edge Functions → Secrets**: add `TWENTY_API_URL` (`https://crm.xgold.tech`),
   `TWENTY_API_KEY`, and `SYNC_SECRET` (`openssl rand -hex 32`).
4. Supabase → **SQL**: run `supabase/twenty-sync.sql` with `SYNC_SECRET_VALUE` replaced by the
   same secret and `ANON_KEY_VALUE` by the project's publishable key.
5. Submit a test on `book.html`. Within a few seconds the Opportunity appears in Twenty and the
   Supabase row gets `synced_to_twenty_at` set. Logs: Edge Functions → sync-to-twenty → Logs.

## Behaviour

- Companies match on the email domain first (ignoring free-mail domains), then on name.
- People match on primary email. Existing records are reused, never duplicated.
- The Note carries the constraint, workflow, owner flag, cost estimate and source.
- Rows already marked synced are ignored, so webhook retries are safe.
- Twenty's REST limit is 100 requests a minute; one submission uses about six.

To stop syncing, drop the trigger: `drop trigger assessment_requests_sync_to_twenty on public.assessment_requests;`
