'use strict';

/**
 * db.js — Database access layer
 *
 * Uses better-sqlite3 (synchronous SQLite) for zero-config local dev.
 * To swap to Postgres: install 'pg', replace the three exported
 * functions with async pool.query() equivalents, and update index.js
 * to await them. The API contract (parameters and return shapes) stays
 * the same — only the implementation changes.
 *
 * Environment variables:
 *   DB_PATH  — absolute path to the SQLite file (default: ./goldai.db)
 */

const Database = require('better-sqlite3');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'goldai.db');

let _db = null;

function getDb() {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // WAL mode for better read concurrency
  _db.pragma('journal_mode = WAL');
  // Enforce foreign key constraints
  _db.pragma('foreign_keys = ON');

  _db.exec(`
    CREATE TABLE IF NOT EXISTS slots (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      start_time TEXT    NOT NULL,
      end_time   TEXT    NOT NULL,
      is_booked  INTEGER NOT NULL DEFAULT 0,
      UNIQUE (start_time)
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      slot_id    INTEGER NOT NULL UNIQUE REFERENCES slots(id),
      name       TEXT    NOT NULL,
      email      TEXT    NOT NULL,
      topic      TEXT,
      created_at TEXT    NOT NULL DEFAULT (datetime('now'))
    );
  `);

  return _db;
}

/**
 * getAvailableDates() → string[]
 * Returns "YYYY-MM-DD" strings for dates with at least one open slot
 * from today onwards.
 */
function getAvailableDates() {
  const db = getDb();
  const today = new Date().toISOString().split('T')[0];
  return db.prepare(`
    SELECT DISTINCT date(start_time) AS date
    FROM   slots
    WHERE  is_booked = 0
      AND  date(start_time) >= ?
    ORDER  BY date
    LIMIT  60
  `).all(today).map((r) => r.date);
}

/**
 * getSlotsForDate(date: string) → { id, start_time, end_time }[]
 * Returns open slots for a specific "YYYY-MM-DD" date.
 */
function getSlotsForDate(date) {
  const db = getDb();
  return db.prepare(`
    SELECT id, start_time, end_time
    FROM   slots
    WHERE  date(start_time) = ?
      AND  is_booked = 0
    ORDER  BY start_time
  `).all(date);
}

/**
 * createBooking({ slotId, name, email, topic })
 *   → { ok: true,  booking: {…} }
 *   → { ok: false, error: string }
 *
 * Runs inside a transaction so two concurrent requests cannot both
 * book the same slot. The UNIQUE constraint on bookings.slot_id is a
 * second guard: if two transactions somehow both pass the SELECT,
 * only one INSERT succeeds; the other hits a UNIQUE constraint error.
 */
function createBooking({ slotId, name, email, topic }) {
  const db = getDb();

  const bookTx = db.transaction(() => {
    const slot = db.prepare(
      'SELECT id, start_time, end_time FROM slots WHERE id = ? AND is_booked = 0'
    ).get(slotId);

    if (!slot) {
      return { ok: false, error: 'This time slot is no longer available.' };
    }

    db.prepare('UPDATE slots SET is_booked = 1 WHERE id = ?').run(slotId);

    const result = db.prepare(
      'INSERT INTO bookings (slot_id, name, email, topic) VALUES (?, ?, ?, ?)'
    ).run(slotId, name, email, topic || '');

    return {
      ok: true,
      booking: {
        id:         result.lastInsertRowid,
        slotId:     slot.id,
        start_time: slot.start_time,
        end_time:   slot.end_time,
        name,
        email,
      },
    };
  });

  try {
    return bookTx();
  } catch (err) {
    if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { ok: false, error: 'This time slot was just taken — please choose another.' };
    }
    throw err;
  }
}

module.exports = { getDb, getAvailableDates, getSlotsForDate, createBooking };
