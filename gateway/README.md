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
| `keys.mjs` | Add customers, issue and revoke keys, reset portal passwords |
| `test-gateway.mjs` | `node gateway/test-gateway.mjs`, no database or network needed |

## What is allowed through

Only `POST /v1/messages`, `POST /v1/messages/count_tokens` and `GET /v1/models`. Everything else returns 404, so a customer key cannot spend ours on Files, Batches or admin endpoints.

## Pricing

`rates.json` holds USD per million tokens by model, with `markup` on top (0.30 means 30%). A model that is not listed is saved but held back from invoices until a rate is added. Dated snapshots price like their base model. Fast mode counts double. Haiku 5.5 prompts over 100,000 tokens use its long-prompt rate. Recheck the file against Anthropic's pricing page before the first real invoice.

## Server setup (gold-server)

State lives in `/home/gold/server-platform/gateway/`:

- `gateway.env` (0600): `GATEWAY_DATABASE_URL`, `ANTHROPIC_API_KEY`, optional `PORT` (default 3030) and `PORTAL_ORIGINS`.
- Database `gateway` with its own non-superuser role on `gold-platform-postgres`, in the same pattern as `crm` and `umami`. It is picked up by the encrypted backup discovery. Apply `schema.sql` as that role.
- Install the unit: `cp gateway/xgold-ai-gateway.service ~/.config/systemd/user/ && systemctl --user daemon-reload && systemctl --user enable --now xgold-ai-gateway`.
- Cloudflare Tunnel: add Public Hostname `ai-gateway.xgold.tech` to `http://127.0.0.1:3030`. No Access policy on this hostname: customers' Claude Code cannot sign in through one, and every request needs an xGoldAI key.

Without `ANTHROPIC_API_KEY` the service still starts: the portal works and `/v1` answers 503.

## Customers and keys

```sh
set -a; . /home/gold/server-platform/gateway/gateway.env; set +a
node gateway/keys.mjs add-customer "Acme Co" owner@acme.com   # prints a portal password and an API key once
node gateway/keys.mjs add-key "Acme Co" laptop
node gateway/keys.mjs revoke xgold-ai-AbCdE                   # first 14 characters of the key
node gateway/keys.mjs reset-password owner@acme.com
node gateway/keys.mjs list
```

Only a hash of each key and password is stored. Revoking a key cuts the customer off on their next request.

## Shortcuts

- `pg` is borrowed from the homelab dashboard install (same as `crm/lead-sync.mjs`). Give the repo its own `package.json` when that stops being convenient.
- Months and the invoice cut-off are UTC.
- Portal sessions last 12 hours and are not revoked on sign out; there is no spend cap or per-key rate limit.
- If the database is down at the moment a request finishes, the usage row is printed to the journal as `usage-not-saved` and must be inserted by hand.
