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

## Hooking it up to Twenty

Goal: when you open a Person in Twenty, you see when they first found the site, how often they've come back, and which pages they read.

### 1. Read-only access to Umami's database

The bridge already runs next to the platform Postgres. Give it a read-only role:

```sql
-- as the umami database owner, connected to the umami database
create role crm_umami_reader login password '<generated>';
grant connect on database umami to crm_umami_reader;
grant usage on schema public to crm_umami_reader;
grant select on session, session_data, website_event to crm_umami_reader;
```

Add a pg_hba rule for that role on the umami database, following the pattern of the other apps.
Then put `UMAMI_DATABASE_URL` and `UMAMI_WEBSITE_ID=5d539dd6-0f8a-4aba-bcf9-4c824209c159` in the
0600 `bridge.env`.

### 2. Fields in Twenty

In Settings → Data model → People, add these fields and allow the `home-assessment-sync`
key's role to update them:

| Field | Type | Value |
|---|---|---|
| Website first seen | Date and time | earliest event across the person's sessions |
| Website last seen | Date and time | latest event |
| Website visits | Number | distinct `visit_id` count |
| Website pageviews | Number | `event_type = 1` count |
| Website entry source | Text | first pageview's referrer domain or `utm_source`/`utm_campaign` |
| Website activity | Links | `https://crm.xgold.tech/stats/websites/<website>/sessions/<session_id>` |

### 3. Bridge change (`crm/lead-sync.mjs`)

Add this to the bridge (it is not implemented yet):

1. **Find the sessions.** Match on email so that every browser the person used is included:
   ```sql
   select distinct session_id from session_data
   where website_id = $1 and data_key = 'email' and string_value = $2;
   ```
2. **Aggregate the sessions:**
   ```sql
   select min(created_at) first_seen, max(created_at) last_seen,
          count(distinct visit_id) visits,
          count(*) filter (where event_type = 1) pageviews
   from website_event where website_id = $1 and session_id = any($2);
   ```
   Get the entry source from the earliest `event_type = 1` row (`referrer_domain`, `utm_*`, `url_path`).
3. **Write to Twenty:** `PATCH /rest/people/<person_id>` with the fields above. The `Twenty`
   class only has `ensure()` today, so add an `update()` method beside it. Optionally add a
   one-time Note, "Website activity before request", listing up to 50 pageviews (time, path,
   title). Give it a deterministic ID such as `recordId('web-note', row.id)` and a noteTarget to
   the person.
4. **Timing.** The identify call reaches Umami a moment after the request is stored, so the
   first lookup can come back empty. Store `umami_synced_at` in `assessment_crm_sync` (new
   column in `directus/assessment-schema.sql`). Retry within the first hour, then refresh
   every person with sessions every 15–60 minutes so "last seen" and "visits" stay current
   when they come back.
5. Keep the bridge's logging rules: counts only, no emails or URLs in logs.

### 4. Verify

Follow the existing practice: send a clearly synthetic request from a fresh browser, browse a
few pages first, and confirm the Umami session shows the properties and the Twenty person shows the fields.
Then remove the synthetic Umami session, Twenty records and local request.

## Known limits and follow-ups

- **Safari and other browsers with tracking prevention** cap cookies set by script at 7 days. A Safari visitor who comes back after a longer gap gets a new ID, so the earlier visits stay unlinked. The fix is to set the cookie with an HTTP header from `www.xgold.tech` itself. GitHub Pages can't do that, but a Cloudflare Worker on the www route could.
- **Anonymous companies.** Visitors who never send a request stay anonymous. Umami doesn't store IP addresses. Showing which company a visitor works at would need an IP-to-company lookup service, which is a separate privacy decision.
- **EU/UK visitors.** The current model is a notice plus opt-out, with Global Privacy Control honored. If you target the EU or UK, the cookie needs opt-in consent before `xg_vid` is set.
- **Deletion requests.** Delete the person's rows from `session_data`, `website_event` and `session` in the umami database (find them by email or `distinct_id`), plus their Twenty records.
- Umami's `session_data` now holds name, email and company. That database is already behind Access and in the encrypted OneDrive backups.
