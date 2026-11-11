# xGold AI gateway

Customers point Claude Code at `https://ai-gateway.xgold.tech` with their own xGoldAI key. The gateway checks the key, swaps in our Anthropic key, streams the reply back untouched, and saves the token counts. Each month an invoice is made from those counts (provider cost plus markup) and shown in the customer portal (`portal.html`) and in Twenty.

```
Claude Code  →  gateway (127.0.0.1:3030, via Cloudflare Tunnel)  →  api.anthropic.com
                   │ saves tokens per request
                   ▼
              gateway database (Postgres)  ←  portal.html  (login, usage, invoices)
                   │ monthly job
                   ▼
              Twenty (Invoice records)
```

| File | Job |
|---|---|
| `gateway.mjs` | The service: `/v1/messages` proxy, `/portal/*` API |
| `meter.mjs` | Reads usage out of replies, prices it, totals it |
| `rates.json` | Provider prices per model and the markup |
| `pgstore.mjs`, `schema.sql` | Database access and tables |
| `crm-keys.mjs`, `crm-setup.mjs` | Customer keys made in Twenty: the sync that runs inside the gateway, and the one-time CRM setup |
| `keys.mjs` | Staff and customer portal logins, emergency key issue and revoke, password resets |
| `invoice.mjs` | Makes last month's invoices, then copies new ones into Twenty |
| `setup-server.sh` | One-time server setup: database, env file, systemd units |
| `*.service`, `*.timer` | The gateway service and the daily invoice timer |
| `test-gateway.mjs`, `test-invoice.mjs`, `test-crm-keys.mjs` | `node gateway/test-gateway.mjs` and so on; no database, network or Twenty needed |

## Invoices

`xgold-ai-invoice.timer` runs `invoice.mjs` daily at 03:30. Last month's invoices appear on the 1st; later runs retry any that were held (a model with no rate) or not yet copied to Twenty. An invoice is made once per customer and month, shown in the portal at once, and copied into Twenty as a Note on the customer's Company (an existing Company with the exact same name is reused). Customers under half a cent get no invoice. To run by hand: `node gateway/invoice.mjs 2026-10`.

## What is allowed through

Only `POST /v1/messages`, `POST /v1/messages/count_tokens` and `GET /v1/models`. Everything else returns 404, so a customer key cannot spend ours on Files, Batches or admin endpoints.

## Pricing

`rates.json` holds USD per million tokens by model, with `markup` on top (0.30 means 30%). A model that is not listed is saved but held back from invoices until a rate is added. Dated snapshots price like their base model. Fast mode counts double. Haiku 5.5 prompts over 100,000 tokens use its long-prompt rate. The file matched Anthropic's pricing page on 2026-11-10; recheck it when they change prices. `markup` is a 30% placeholder. Set it before the first real invoice.

## Server setup (gold-server)

After pushing to main, run `ssh gold-server 'bash -s' < gateway/setup-server.sh` from your Mac. Read the header of the script first: it lists everything it changes. It pulls the repo, so run it again (or `git pull` in `ai-site-src`) to deploy, then `systemctl --user restart xgold-ai-gateway`. The gateway applies `schema.sql` every time it starts, so a restart is the whole database upgrade. State lives in `/home/gold/server-platform/gateway/`:

- `gateway.env` (0600): `GATEWAY_DATABASE_URL`, `ANTHROPIC_API_KEY` (optional, see below), `TWENTY_API_KEY_FILE`, `TWENTY_BASE_URL`, optional `PORT` (default 3030) and `PORTAL_ORIGINS`. Restart the service after editing it.
- The Anthropic key: staff set it in the portal (below). A key saved there wins over `ANTHROPIC_API_KEY`, which stays as a fallback. The gateway re-reads it every 30 seconds and the portal applies it at once.
- Database `gateway` with its own non-superuser role on `gold-platform-postgres`, in the same pattern as `crm` and `umami`, plus one `pg_hba.conf` line for it. It is picked up by the encrypted backup discovery.
- Cloudflare Tunnel: add Public Hostname `ai-gateway.xgold.tech` to `http://127.0.0.1:3030`. No Access policy on this hostname: customers' Claude Code cannot sign in through one, and every request needs an xGoldAI key.

With no Anthropic key anywhere the service still starts: the portal works and `/v1` answers 503.

## Staff: the Anthropic key

Make a staff login once, on the server:

```sh
set -a; . /home/gold/server-platform/gateway/gateway.env; set +a
node gateway/keys.mjs add-admin you@xgold.tech     # prints a password once
```

Sign in at `portal.html` with it. A staff login sees an extra "Anthropic key" section at the bottom. Paste a key and save: the gateway checks it with Anthropic's free models call first, and saves it only if Anthropic accepts it. The page only ever shows the last four characters. The key is stored as plain text in the gateway database (`ai_settings`), next to the usage data; encrypt it with a key from `gateway.env` if that table ever holds more secrets.

## Customer keys (in the CRM)

One-time, after the first deploy:

```sh
set -a; . /home/gold/server-platform/gateway/gateway.env; set +a
node gateway/crm-setup.mjs     # adds an "AI key" record type to Twenty, linked to Company. Safe to repeat.
```

Then, for every key:

1. In Twenty, open the customer's **Company**, go to **AI keys**, and add a record. Name it after where the key will be used ("Laptop").
2. Within about 15 seconds the record fills in: **Status** becomes Active, **Key starts with** shows the first characters, and **API key** shows the full key. Copy it to the customer.
3. To cut a key off, set **Status** to Revoked, or delete the record. The key stops working on the customer's next request.

Behind this, the gateway reads the AI key records every 15 seconds (`crm-keys.mjs`). The first key for a Company makes the customer in the gateway (named after the Company; a customer made earlier with `keys.mjs` and the same name is reused). A record with no Company stays Pending. A record whose key is revoked is set back to Revoked if someone flips it, and its key text is removed. If more than three keys vanish from the CRM at once, nothing is revoked and the journal says so.

Customers who should see usage and invoices need a portal login too:

```sh
node gateway/keys.mjs add-user "Acme Co" owner@acme.com       # prints a portal password once
node gateway/keys.mjs reset-password owner@acme.com
```

Emergency tools, which bypass the CRM (keys made here do not show up in Twenty):

```sh
node gateway/keys.mjs add-customer "Acme Co" owner@acme.com   # customer, login and first key
node gateway/keys.mjs add-key "Acme Co" laptop
node gateway/keys.mjs revoke xgold-ai-AbCdE                   # first 14 characters of the key
node gateway/keys.mjs list
```

Only a hash of each key and password is stored by the gateway. The CRM record holds the full key (see shortcuts).

## Shortcuts

- `pg` is borrowed from the homelab dashboard install (same as `crm/lead-sync.mjs`). Give the repo its own `package.json` when that stops being convenient.
- Months and the invoice cut-off are UTC.
- Twenty gets a Note per invoice on the Company (the one the customer's keys sit on, once the customer was made from the CRM). Switch to a custom Invoice object when you want to filter or report on amounts and status in Twenty.
- The full customer key sits on the CRM record so staff can copy it any time. Anyone with access to the Company in Twenty can read it. Move to a show-once step if CRM access widens.
- The CRM sync polls every 15 seconds and re-reads every AI key record each time; fine for hundreds of keys.
- Invoices are not paid through the system; they state an amount owed.
- Portal sessions last 12 hours and are not revoked on sign out; there is no spend cap or per-key rate limit.
- If the database is down at the moment a request finishes, the usage row is printed to the journal as `usage-not-saved` and must be inserted by hand.
