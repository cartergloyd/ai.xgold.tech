# goldAI Booking Server

The Node.js/Express API that powers the `/contact.html` scheduling page.

## Stack

| Layer | Package | Why |
|-------|---------|-----|
| HTTP server | express ^4.19 | Lightweight, well-understood |
| Database | better-sqlite3 ^9.6 | Synchronous SQLite — zero config, no daemon |
| CORS | cors ^2.8 | Cross-origin requests from the static frontend |

---

## Quick start

### 1. Install dependencies

```bash
cd server
npm install
```

### 2. Seed the database

Creates `goldai.db` and inserts 30-minute slots across the next 14 business days,
9 AM – 5 PM, skipping the 12:00–12:30 lunch slot.

```bash
npm run seed
# → Seeded 182 slots across 14 business days.
```

Re-running is safe (uses `INSERT OR IGNORE`).

### 3. Start the server

```bash
npm start
# → goldAI booking server → http://localhost:3001
```

Open `contact.html` in your browser (via a local HTTP server, not `file://`).
The page calls `http://localhost:3001` by default.

**Development with file-watching (Node ≥ 18):**

```bash
npm run dev
```

---

## API reference

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/availability` | Dates with at least one open slot |
| `GET` | `/api/availability?date=YYYY-MM-DD` | Open slots for that date |
| `POST` | `/api/bookings` | Create a booking |
| `GET` | `/health` | Health check |

### GET /api/availability

```json
{ "dates": ["2026-07-01", "2026-07-02", "2026-07-07"] }
```

### GET /api/availability?date=2026-07-01

```json
{
  "slots": [
    { "id": 1, "start_time": "2026-07-01T09:00:00.000Z", "end_time": "2026-07-01T09:30:00.000Z" },
    { "id": 2, "start_time": "2026-07-01T09:30:00.000Z", "end_time": "2026-07-01T10:00:00.000Z" }
  ]
}
```

### POST /api/bookings

Request body:

```json
{
  "name": "Jane Smith",
  "email": "jane@company.com",
  "topic": "Workflow automation audit",
  "slotId": 1
}
```

Success response `201`:

```json
{
  "ok": true,
  "booking": {
    "id": 42,
    "slotId": 1,
    "start_time": "2026-07-01T09:00:00.000Z",
    "end_time": "2026-07-01T09:30:00.000Z",
    "name": "Jane Smith",
    "email": "jane@company.com"
  }
}
```

Conflict response `409` (slot already taken):

```json
{ "error": "This time slot is no longer available." }
```

---

## Pointing contact.html at a deployed server

Add a `<script>` tag **before** `contact.js` loads in `contact.html`:

```html
<script>window.BOOKING_API_BASE = 'https://api.xgold.tech';</script>
<script src="contact.js?v=1"></script>
```

---

## Database schema

Created automatically on first run (`server/db.js`):

```sql
CREATE TABLE slots (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  start_time TEXT    NOT NULL,        -- ISO 8601 UTC
  end_time   TEXT    NOT NULL,
  is_booked  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (start_time)
);

CREATE TABLE bookings (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  slot_id    INTEGER NOT NULL UNIQUE REFERENCES slots(id),
  name       TEXT    NOT NULL,
  email      TEXT    NOT NULL,
  topic      TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

Double-booking prevention uses two layers:
1. `createBooking()` in `db.js` wraps the availability check and INSERT in a single SQLite transaction.
2. `UNIQUE` on `bookings.slot_id` is a database-level backstop if two transactions somehow both pass the check.

---

## Production hardening checklist

| Item | Where to plug in | Notes |
|------|-----------------|-------|
| Email confirmation | `server/index.js` POST handler, see `TODO` comment | Resend, SendGrid, or Nodemailer |
| Calendar invite | Same `TODO` block | Google Calendar API or iCal attachment |
| Rate limiting | Top of `server/index.js` | `npm i express-rate-limit` |
| CORS restriction | `app.use(cors(…))` in `index.js` | Replace `'*'` with `'https://www.xgold.tech'` |
| HTTPS | Infrastructure | nginx / Caddy with TLS |
| Timezone display | `contact.js` `fmtTime()` | Already uses `toLocaleTimeString` (user's tz); for server-side conversion install `luxon` |
| Auth (admin) | Not implemented | Add JWT or session auth before building admin tooling |
| Environment vars | `process.env.PORT`, `DB_PATH`, `ALLOWED_ORIGIN` | Set via `.env` + `dotenv` |
| Swap SQLite → Postgres | `server/db.js` | Replace `better-sqlite3` with `pg`; only the three exported functions change |

---

## Border-radius note

All inputs and buttons in `contact.html` / `contact.css` use `border-radius: 999px` —
matched from `.hero-actions a` in `styles.css` (the "Engage" and "Research" pill
buttons on the homepage, also used by the careers form). The `<textarea>` uses
`border-radius: 16px` because a pill shape doesn't suit multi-line text entry.
