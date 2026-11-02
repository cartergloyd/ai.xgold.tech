# Home assessment API and Twenty CRM

The live site is `https://www.xgold.tech` (this repo's main branch). Its assessment
form submits to `https://ai-api.xgold.tech/assessment/requests`. Twenty runs
separately at `https://crm.xgold.tech` behind the existing Cloudflare Access wall.

## Installed stack

- Twenty 2.50.0, pinned by image digest, server on 127.0.0.1:3020 and a worker.
- Private Redis with persistence and no host port.
- Existing `gold-platform-postgres`, separate non-superuser `crm` database/role.
- Existing ai Directus on 127.0.0.1:8057, private assessment collections and a
  narrowly scoped endpoint extension.
- User service `gold-assessment-crm-sync.service` privately synchronizes queued
  requests to Twenty through loopback; no Cloudflare API bypass is needed.

The live compose project is `/home/gold/server-platform/crm/compose.yml` with
0600 `.env` containing `CRM_DB_PASSWORD` and `CRM_ENCRYPTION_KEY`. The checked-in
`homelab-compose.yml` is the matching configuration with variable references.
There is no Caddy container or router port forwarding on this installation.
The server's RAM is limited; the Twenty server, worker and Redis have explicit
memory limits. Monitor their RSS, OOM/restart counts and host memory after changes.

## Intake privacy and reliability

Apply `directus/assessment-schema.sql` to the ai database as its owner. Copy
`directus/extensions/directus-extension-assessment` into the ai instance's
extensions directory and restart it. Allow the site origins in Directus CORS.
Public gets **no** permissions on either assessment collection. The endpoint
accepts only known, validated form fields, checks browser origins, uses a
honeypot and limits each client to five valid submissions per minute. The
browser sends no API key or authentication cookie.

Each form has a random request identifier. The database atomically stores the
submission and a sync-outbox row; a unique key plus payload hash makes manual
retries idempotent. A changed payload using the same identifier is rejected.
Success means the request has been stored durably at home. Temporary CRM
outages leave it queued for retry rather than losing the lead.

The private sync creates a Company, Person, Opportunity and linked Note.
Deterministic record UUIDs and persisted progress prevent duplicate creates
when a response is lost after Twenty committed a record. API calls are paced
and failures back off. Logs contain status summaries, not contact details,
request bodies, tokens or upstream response bodies.

## Private integration credentials

Create the owner's workspace using Twenty's normal onboarding, then create a
key in Settings → Developers → API named `home-assessment-sync`. Scope its role
to the CRM objects it needs where supported. Store it only in the 0600 file
`/home/gold/server-platform/crm/twenty-api-key`; never paste it in an issue or
commit it. `bridge.env` is also 0600 and contains `AI_DATABASE_URL`,
`TWENTY_API_KEY_FILE` and `TWENTY_BASE_URL=http://127.0.0.1:3020`.

The bridge waits when its key file is absent, empty or has unsafe permissions.
The owner can rotate the key by replacing that file. The service reads it again
on subsequent polls. Use normal Twenty invitations for additional people, and
add their addresses to the Cloudflare Access policy separately. Review owner
MFA and invite-only/single-workspace settings in Twenty.

## Analytics (Umami at crm.xgold.tech/stats)

The public site counts visits with Umami: open source, cookieless, no personal data, no
consent banner. It is read at `https://crm.xgold.tech/stats`, behind the same Cloudflare
Access wall as Twenty, so the team has one hostname and one sign-in for the CRM and the
numbers. Umami's sub-path is a build-time option, so the image is prebuilt by the site
repo's `build-umami` workflow and published to `ghcr.io/cartergloyd/umami-stats` (make the
package public once under GitHub → Packages, or add a pull secret). The host never builds it.

Install: create a separate non-superuser role and database on the platform Postgres, in the
same pattern as the other apps:

```sql
create role umami login password '<UMAMI_DB_PASSWORD>';
create database umami owner umami;
```

Add `UMAMI_DB_PASSWORD` and `UMAMI_APP_SECRET` (`openssl rand -hex 32`) to the 0600 `.env`,
add the `umami` service from `homelab-compose.yml` to the live compose, `docker compose up -d
umami`, and check `curl --fail http://127.0.0.1:3021/stats/api/heartbeat`.

Tunnel and Access: add a Public Hostname rule `crm.xgold.tech` with **path `stats*`** →
`http://127.0.0.1:3021`, ordered above the catch-all rule for Twenty. Then add an Access
**bypass** policy for the two paths the browser tracker needs, `/stats/script.js` and
`/stats/api/send`, and nothing else under `/stats`.

First login `admin` / `umami`; change the password; Settings → Websites → Add
`www.xgold.tech`; copy the Website ID and replace `__UMAMI_WEBSITE_ID__` across the site
(command in README.md). Events the site sends: `cta`, `problem-tab`, `work-open`,
`source-click`, `assessment-started`, `assessment-submitted`. None carry contact details.
Add the `umami` database to the OneDrive backup discovery.

## Backups and operations

The existing encrypted OneDrive pipeline discovers the crm database alongside
ai/fam/personal. It also encrypts the CRM `.env`, bridge environment, API key,
compose configuration and local uploads. The Twenty encryption key is necessary
to recover encrypted CRM secrets. No plaintext tar or dump is kept by that job.
Download verification and isolated restores include Twenty's non-public schemas.

Useful local checks:

```sh
curl --fail http://127.0.0.1:3020/healthz
systemctl --user status gold-assessment-crm-sync.service
journalctl --user -u gold-assessment-crm-sync.service
docker stats --no-stream homelab-twenty homelab-twenty-worker homelab-crm-redis
node crm/test-lead-sync.mjs
```

The owner confirmed that there are no historic Supabase assessment submissions
to migrate. Supabase is retained during observation. The previous `supabase/`
SQL and Edge Function are legacy reference, not part of the new live path.
Before rolling the site back, reconcile any submissions already stored at home.

Avoid using a production contact as a test: use a clearly marked synthetic
request, verify its CRM records, then remove those records and the local request.

## Umami installation status (2026-10-27)

The GitHub-hosted build succeeded and the pinned image is installed. Local heartbeat
passes on 127.0.0.1:3021; database migrations completed. The default admin password
has been replaced with a generated password stored as UMAMI_ADMIN_PASSWORD in the
private CRM .env (0600). The www.xgold.tech Website ID is
`5d539dd6-0f8a-4aba-bcf9-4c824209c159`, configured in the public pages and work-page generator.

The database is named umami, with a separate non-superuser owner and an explicit
pg_hba rule for that database/user on the platform Docker subnet. Encrypted OneDrive
backup discovery automatically includes it and the CRM .env.

Cloudflare setup is complete. The existing tunnel routes `^/stats(/.*)?$` on
`crm.xgold.tech` to `http://127.0.0.1:3021` before the Twenty catch-all. Separate
Access applications bypass login for `/stats/script.js` and `/stats/api/send`.
The existing CRM Access policy continues to protect the dashboard and other APIs.

Public verification passed: script GET 200, collection preflight 204 with CORS,
and anonymous page-view/custom-event POSTs 200 with both events persisted in
PostgreSQL. The temporary test website and events were removed afterward.
`/stats`, `/stats/api/websites`, and the CRM root still redirect to Access (302).
Twenty and Umami health checks pass. The encrypted OneDrive snapshot
`2026-10-27T222137Z` includes Umami and the CRM secrets/configuration; downloaded
ciphertext integrity and isolated restores passed for all five databases.

## Completion follow-up (2026-10-27)

Public workspace invitation links are disabled, workspace discovery is limited to
members and invitees, multi-workspace mode is disabled, and no approved email
domains grant automatic entry. Owner authenticator enrollment remains an owner
step in Twenty's profile settings. Workspace MFA enforcement has not been enabled
before the owner enrolls. There are no additional team members to invite yet.

The dashboard now includes a healthy Umami analytics card with its database,
website/user counts and encrypted backup status. A seven-day observation timer
samples the four CRM containers every fifteen minutes and reports problems and
a final summary; a monthly reminder runs on the first at 09:00 America/Chicago.
These jobs do not upgrade or restart production services.

Browser acceptance passed at 375, 768 and 1440 pixels. A real CTA click, page
views and assessment start/submission events persisted through the public
analytics endpoint in an isolated test website. A synthetic browser assessment
synchronized Company, Person, Opportunity and Note records into Twenty with no
retries; the temporary analytics and lead records were removed afterward.

Unpublished people/qualification placeholders were removed. Contact links now
use the working assessment form until a public contact email is supplied.
For LinkedIn fields, import templates and future Sales Navigator scope, see
[PROSPECT-IMPORT.md](PROSPECT-IMPORT.md).
