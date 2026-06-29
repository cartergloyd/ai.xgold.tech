'use strict';

/**
 * seed.js — Populate the database with open meeting slots.
 *
 * Generates 30-minute slots on weekdays for the next 14 business days
 * (≈ 3 weeks), 9 AM–5 PM, skipping the 12:00–12:30 lunch slot.
 * Uses INSERT OR IGNORE so re-running is safe.
 *
 * Usage:
 *   node seed.js
 */

const { getDb } = require('./db');

function nextBusinessDays(count) {
  const days = [];
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);
  cursor.setDate(cursor.getDate() + 1); // start tomorrow

  while (days.length < count) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) {
      days.push(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

function seed() {
  const db = getDb();
  const days = nextBusinessDays(14);

  const insert = db.prepare(
    'INSERT OR IGNORE INTO slots (start_time, end_time) VALUES (?, ?)'
  );

  let inserted = 0;

  db.transaction(() => {
    for (const day of days) {
      for (let hour = 9; hour < 17; hour++) {
        for (let min = 0; min < 60; min += 30) {
          if (hour === 12 && min === 0) continue; // skip lunch

          const start = new Date(day);
          start.setHours(hour, min, 0, 0);

          const end = new Date(start);
          end.setMinutes(end.getMinutes() + 30);

          const r = insert.run(start.toISOString(), end.toISOString());
          if (r.changes > 0) inserted++;
        }
      }
    }
  })();

  console.log('Seeded ' + inserted + ' slots across ' + days.length + ' business days.');
}

seed();
