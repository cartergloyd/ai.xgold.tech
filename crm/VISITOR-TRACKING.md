# Visitor tracking: who is viewing the site

The public site counts visits with Umami at `crm.xgold.tech/stats` (see
[HOMELAB.md](HOMELAB.md), "Analytics"). On top of that count, `visitor.js` gives
each browser a first-party ID, so you can follow one browser across visits.
When that browser sends an assessment request, the visits are linked to the person.

## How it works

| Piece | What it does |
|---|---|
| `visitor.js` (every page, loaded before the Umami tag) | Sets cookie `xg_vid`: a random UUID, `Domain=xgold.tech`, `Secure`, `SameSite=Lax`, renewed for a year on every visit. Exposes `xgBeforeSend`, `xgVisitor.identify()` and the footer opt-out button. |
| Umami tag `data-before-send="xgBeforeSend"` | Adds `payload.id = xg_vid` to every hit. Umami v2.19 then uses `session_id = uuid(website_id, id)` and stores the ID as `session.distinct_id`. The result is one Umami session per browser, kept across months. |
| `book.js` after the intake API returns 2xx | Calls `umami.identify({ request_id, name, email, company })`. Umami writes those keys to `session_data` for that browser's session. `request_id` equals `assessment_requests.request_key`. |
| Intake API | Unchanged. The form body has no new fields, so `validation.js` keeps accepting it. |

Privacy behavior:

- **GPC or Do Not Track:** no cookie and no identify. These browsers are still counted anonymously, the same way every visitor was counted before this change.
- **Footer "Stop tracking this browser":** deletes `xg_vid`, sets `xg_optout=1`, and sets Umami's own switch (`localStorage["umami.disabled"]`). After that, no Umami requests are sent at all. Turning it back on issues a new ID.
- **Notices:** the footer text and the fine print on the form state that visits are recognized and then linked when a request is sent.

## Where to see it today (no CRM changes needed)

`https://crm.xgold.tech/stats/websites/5d539dd6-0f8a-4aba-bcf9-4c824209c159/sessions`
(Cloudflare Access, then the Umami login)

- **Sessions:** each row is one browser. Open a session to see its Distinct ID, first and last seen, location, device and the full activity timeline (pages and events).
- **Properties** (Sessions page): shows `email`, `name`, `company` and `request_id` for browsers that sent a request. Filter by a value to find a person's sessions.

Counting change: since this deploy, Umami's "Visitors" counts browsers. Before, it counted monthly anonymous IP and browser hashes, so numbers from before and after the deploy can't be compared directly.

## In Twenty: website activity on each Person

`crm/lead-sync.mjs` copies each lead's website activity onto their Person record and adds a
one-time note listing the pages they read before reaching out. It is off until the steps
below are done; without them the service syncs leads exactly as before.

What it writes:

| Field (People) | Type | Value |
|---|---|---|
| Website first seen | Date and time | earliest event across the person's sessions |
| Website last seen | Date and time | latest event |
| Website visits | Number | distinct Umami visits (a visit ends after 30 idle minutes) |
| Website pageviews | Number | pageviews only; CTA clicks and other events are not counted |
| Website entry source | Text | first pageview's UTM source/medium/campaign, else referrer, else "Direct", then the landing path |
| Website activity | Links | the person's most recent Umami session |

Plus a note **Website activity before request**, linked to the Person and the Opportunity:
first seen, visit and pageview counts, entry source, and up to 50 pageviews before the request
(UTC). It is written once per request. The fields keep updating.

How it decides:

- **Matching.** Sessions are matched by the `request_id` that `book.js` sends with
  `umami.identify`, across every request with that email, so a person who used two browsers
  gets both. It never matches on email alone: only the submitting browser knew its
  `request_id`, so a forged identify call with someone's email can't attach a stranger's
  visits to their record.
- **One person, newest request.** When the same email has several requests, only the newest
  one drives the fields.
- **Schedule.** The service looks up a lead right after it reaches Twenty. If no session has
  appeared yet, it retries every 2 minutes for the first hour, then stops. GPC browsers,
  opted-out browsers and blocked trackers never send identify. While a person is active, it
  refreshes every 30 minutes; after 7 quiet days, once a day. It only sends a PATCH when a
  value changed.
- **Priority and failures.** Website activity runs only when no lead is waiting. A failure
  (for example, a missing People field, or Umami down) sets `web_last_error`, retries that
  request after an hour and pauses the step for 5 minutes. Lead sync is unaffected. Logs carry
  status lines only, never emails, URLs or upstream text.

### Turn it on (one time, on the homelab)

1. **Schema.** Re-apply `directus/assessment-schema.sql` to the ai database as its owner. It
   is idempotent and adds four `web_*` columns to `assessment_crm_sync`. Existing leads become
   due once, so they get backfilled.
2. **Read-only Umami role.** As the umami database owner, connected to the umami database:
   ```sql
   create role crm_umami_reader login password '<generated>';
   grant connect on database umami to crm_umami_reader;
   grant usage on schema public to crm_umami_reader;
   grant select on session, session_data, website_event to crm_umami_reader;
   ```
   Add a pg_hba rule so that role can reach the umami database from wherever the bridge
   connects for `AI_DATABASE_URL`.
3. **Twenty fields.** In Settings → Data model → People, add the six fields above with exactly
   those labels. Twenty derives the API names `websiteFirstSeen`, `websiteLastSeen`,
   `websiteVisits`, `websitePageviews`, `websiteEntrySource` and `websiteActivity`; the bridge
   writes those names. If the `home-assessment-sync` key's role limits fields, allow these, plus
   creating notes and note targets (it already does both for leads).
4. **bridge.env (0600).** Add `UMAMI_DATABASE_URL=postgresql://crm_umami_reader:<password>@<host>:5432/umami`.
   Optional: `UMAMI_WEBSITE_ID` (defaults to `5d539dd6-0f8a-4aba-bcf9-4c824209c159`) and
   `UMAMI_PUBLIC_URL` (defaults to `https://crm.xgold.tech/stats`, used for the links).
5. **Deploy.** Pull `main` in `/home/gold/server-platform/ai-site-src`, run
   `node crm/test-lead-sync.mjs`, then `systemctl --user restart gold-assessment-crm-sync.service`.
   `journalctl --user -u gold-assessment-crm-sync.service` should show `Website activity sync on`.
   If it shows `off`, the line says which step is missing.

### Check it

Follow the existing practice: from a fresh browser, open a few pages, then submit a clearly
synthetic request. Within a few minutes, the Twenty Person should show the six fields and the
note, and the log should show `Website activity synchronized to CRM`. To look at state:

```sql
select r.created_at, s.web_next_check_at, s.web_fingerprint is not null as patched,
       s.web_note_id is not null as noted, s.web_last_error
from assessment_crm_sync s join assessment_requests r on r.id = s.request_id
order by r.created_at desc limit 10;
```

Then remove the synthetic Umami session, Twenty records and local request.

## Known limits and follow-ups

- **Safari and other browsers with tracking prevention** cap cookies set by script at 7 days. A Safari visitor who comes back after a longer gap gets a new ID, so the earlier visits stay unlinked. The fix is to set the cookie with an HTTP header from `www.xgold.tech` itself. GitHub Pages can't do that, but a Cloudflare Worker on the www route could.
- **Anonymous companies.** Visitors who never send a request stay anonymous. Umami doesn't store IP addresses. Showing which company a visitor works at would need an IP-to-company lookup service, which is a separate privacy decision.
- **EU/UK visitors.** The current model is a notice plus opt-out, with Global Privacy Control honored. If you target the EU or UK, the cookie needs opt-in consent before `xg_vid` is set.
- **Deletion requests.** Delete the person's rows from `session_data`, `website_event` and `session` in the umami database (find them by email or `distinct_id`), plus their Twenty records.
- Umami's `session_data` now holds name, email and company. That database is already behind Access and in the encrypted OneDrive backups.
