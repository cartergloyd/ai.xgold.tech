# Internal CRM (Twenty)

[Twenty](https://github.com/twentyhq/twenty) is the open-source CRM behind `crm.xgold.tech`.
It is a separate application with its own login; nothing on the public site can reach it
without signing in. The public site only links to it from the footer ("Team sign in").

## What runs

| Service | Image | Role |
|---|---|---|
| caddy | caddy:2 | TLS termination for crm.xgold.tech, proxies to the server |
| server | twentycrm/twenty | API, web app, migrations |
| worker | twentycrm/twenty | Background jobs: email sync, workflows, cron |
| db | postgres:16 | Data |
| redis | redis | Queues and cache |
| umami | built from umami-software/umami | Web analytics for the public site, served at /stats |
| umami-db | postgres:16 | Umami's data |

Requirements: a Linux host with Docker and Docker Compose, 2 GB RAM minimum (4 GB is
comfortable; Umami adds roughly 300 MB), ports 80 and 443 open, and a DNS A record for `crm.xgold.tech` pointing at it.
Self-hosting Twenty is free; Twenty's hosted plans are per seat if you ever prefer not to run it.

## First start

```bash
# on the server
git clone git@github.com:cartergloyd/ai.xgold.tech.git && cd ai.xgold.tech/crm
cp .env.example .env
sed -i "s|^PG_DATABASE_PASSWORD=.*|PG_DATABASE_PASSWORD=$(openssl rand -hex 32)|" .env
sed -i "s|^ENCRYPTION_KEY=.*|ENCRYPTION_KEY=$(openssl rand -base64 32)|" .env
docker compose up -d
docker compose logs -f server   # wait for "listening"
```

Open https://crm.xgold.tech, create the first workspace and the first user. That user is the
owner. Then lock the door:

1. **Settings → Admin Panel → Configuration Variables**: disable public sign-up and
   multi-workspace, so new users only arrive by invitation.
2. **Settings → Members**: invite the team. Keep roles minimal.
3. **Settings → Developers → API → Create key**: one key named `supabase-sync`, for the lead
   bridge below. It is shown once.
4. Back up `.env`. Losing `ENCRYPTION_KEY` loses every stored secret.

## Analytics page: crm.xgold.tech/stats (Umami)

Visits to the public site are measured with [Umami](https://umami.is), open source and
cookieless: no cookies, no personal data, no consent banner required. It runs in this same
stack and is read at **https://crm.xgold.tech/stats**, so the team has one hostname and one
sign-in for the CRM and the numbers. Umami's sub-path support is a build-time option, which is
why the `umami` service builds from the pinned upstream tag instead of pulling an image.

First visit: log in with `admin` / `umami`, change the password immediately, then
**Settings → Websites → Add website** with domain `www.xgold.tech`. Copy the Website ID into
the site repo (every page and `scripts/build-work.mjs` carry the placeholder
`__UMAMI_WEBSITE_ID__`):

    grep -rl __UMAMI_WEBSITE_ID__ --include='*.html' --include='*.mjs' . | xargs sed -i "s/__UMAMI_WEBSITE_ID__/<website-id>/g"

Routing: on a VPS the Caddyfile already sends `/stats*` to Umami. On the homelab, add a second
Public Hostname rule to the tunnel: hostname `crm.xgold.tech`, **path `stats*`**, service
`http://umami:3000`, listed *above* the catch-all rule for the Twenty server. If Cloudflare
Access protects the hostname, add a **bypass** for the two public paths the tracker needs:
`crm.xgold.tech/stats/script.js` and `crm.xgold.tech/stats/api/send`. Everything else under
`/stats` stays behind Access and Umami's own login.

Events the site sends, beyond page views: `cta` (with `placement`), `problem-tab` (with `area`),
`work-open` (with `slug`), `source-click`, `assessment-started`, `assessment-submitted` (with
`constraint` and `workflow`).

## Lead bridge from the public site

Every "Start an assessment" submission is already stored in Supabase. The Edge Function in
`supabase/functions/sync-to-twenty/` turns each new row into a Company, a Person and an
Opportunity (stage NEW) in Twenty, with the submission details as a Note. Setup is in that
folder's README. Nothing in the browser ever holds a Twenty key.

## Operations

```bash
docker compose pull && docker compose up -d                       # upgrade (after bumping TAG in .env)
docker exec twenty-db-1 pg_dump -U postgres default > backup_$(date +%F).sql   # backup
docker compose ps && docker compose logs --tail=100 server worker # health
```

Back up the database nightly and keep `.env` somewhere safe. The upstream guide is at
https://docs.twenty.com/developers/self-hosting/docker-compose.
