# Internal CRM (Twenty)

**Home-server installation:** use [HOMELAB.md](HOMELAB.md). That installation
uses the existing PostgreSQL and Cloudflare Tunnel, the home assessment API,
and a private local lead-sync service. The generic VPS/Supabase kit below is
retained for reference and is not the live deployment.

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

Requirements: a Linux host with Docker and Docker Compose, 2 GB RAM minimum (4 GB is
comfortable), ports 80 and 443 open, and a DNS A record for `crm.xgold.tech` pointing at it.
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
