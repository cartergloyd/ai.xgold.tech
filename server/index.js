'use strict';

/**
 * index.js — goldAI Booking API
 *
 * Routes:
 *   GET  /api/availability           → available dates
 *   GET  /api/availability?date=...  → open slots for a date
 *   POST /api/bookings               → create a booking
 *   GET  /health                     → health check
 *
 * PRODUCTION TODO:
 *   - Add rate limiting:  npm i express-rate-limit
 *   - Restrict CORS:      replace '*' with 'https://www.xgold.tech'
 *   - Run behind HTTPS:   nginx / Caddy / load balancer with TLS
 *   - Add request logs:   npm i morgan
 *   - Timezones:          slots are stored as UTC ISO strings; the
 *                         frontend renders them in the user's local tz
 *                         via toLocaleTimeString — if you need server-
 *                         side tz conversion, install 'luxon'.
 *   - Email/calendar:     see the TODO stub in POST /api/bookings
 */

const express = require('express');
const cors    = require('cors');
const { getAvailableDates, getSlotsForDate, createBooking } = require('./db');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || '*' }));
app.use(express.json({ limit: '16kb' }));

/* ─────────────────────────────────────────────────────────────────
   GET /api/availability
   No query param → { dates: ["YYYY-MM-DD", …] }
   ?date=YYYY-MM-DD → { slots: [{ id, start_time, end_time }, …] }
───────────────────────────────────────────────────────────────── */
app.get('/api/availability', (req, res) => {
  const { date } = req.query;

  if (date === undefined) {
    return res.json({ dates: getAvailableDates() });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || isNaN(new Date(date + 'T12:00:00').getTime())) {
    return res.status(400).json({ error: 'Invalid date. Use YYYY-MM-DD.' });
  }

  return res.json({ slots: getSlotsForDate(date) });
});

/* ─────────────────────────────────────────────────────────────────
   POST /api/bookings
   Body: { name, email, topic?, slotId }
   Response 201: { ok: true, booking: { id, slotId, start_time, … } }
   Response 400: { error: string }
   Response 409: { error: string }  (slot taken)
───────────────────────────────────────────────────────────────── */
app.post('/api/bookings', (req, res) => {
  const { name, email, topic, slotId } = req.body || {};

  // Server-side validation (never rely solely on client-side checks)
  const errs = [];
  if (!name || typeof name !== 'string' || !name.trim())
    errs.push('name is required');
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    errs.push('a valid email is required');
  if (!Number.isInteger(slotId) || slotId < 1)
    errs.push('slotId must be a positive integer');
  if (topic !== undefined && typeof topic !== 'string')
    errs.push('topic must be a string');

  if (errs.length) {
    return res.status(400).json({ error: errs.join('; ') });
  }

  const cleanName  = String(name).trim().slice(0, 200);
  const cleanEmail = String(email).trim().toLowerCase().slice(0, 200);
  const cleanTopic = topic ? String(topic).trim().slice(0, 1000) : '';

  let result;
  try {
    result = createBooking({ slotId, name: cleanName, email: cleanEmail, topic: cleanTopic });
  } catch (err) {
    console.error('Booking error:', err);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }

  if (!result.ok) {
    return res.status(409).json({ error: result.error });
  }

  // TODO: send confirmation email and calendar invite here.
  //
  //   sendConfirmationEmail({
  //     to:        result.booking.email,
  //     name:      result.booking.name,
  //     startTime: result.booking.start_time,
  //   }).catch(err => console.error('Email send failed:', err));
  //
  //   addToCalendar({
  //     summary:  `goldAI call with ${result.booking.name}`,
  //     start:    result.booking.start_time,
  //     end:      result.booking.end_time,
  //     attendee: result.booking.email,
  //   }).catch(err => console.error('Calendar invite failed:', err));

  return res.status(201).json({ ok: true, booking: result.booking });
});

/* ── Health check ─────────────────────────────────────────────── */
app.get('/health', (_req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`goldAI booking server → http://localhost:${PORT}`);
});
