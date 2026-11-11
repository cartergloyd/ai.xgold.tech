// Run: node gateway/test-invoice.mjs   (no database, network or Twenty needed)
import assert from 'node:assert/strict';
import { loadRates } from './meter.mjs';
import { makeInvoices, syncInvoices } from './invoice.mjs';
import { Twenty } from '../crm/lead-sync.mjs';

const rates = loadRates(new URL('./rates.json', import.meta.url));
const grp = o => ({ day: '2026-10-05', long_ctx: false, fast: false, calls: 10, input: 0, output: 0, cache_read: 0, cache_write_5m: 0, cache_write_1h: 0, ...o });
const usage = {
  a: [grp({ model: 'claude-opus-5-5', input: 1e6, output: 1e6 }), grp({ model: 'claude-sonnet-5-5', input: 1e6 })],
  b: [grp({ model: 'claude-mystery-1', input: 500 })],  // no rate: must be held, not billed at zero
  c: [grp({ model: 'claude-haiku-5-5', input: 10 })],   // under half a cent: no invoice
};
const customers = [{ id: 'a', name: 'Acme Co' }, { id: 'b', name: 'Birch' }, { id: 'c', name: 'Cedar' }];
const invoices = [];
const store = {
  customersWithUsage: async () => customers,
  monthUsage: async id => usage[id],
  insertInvoice: async i => (invoices.some(x => x.customer_id === i.customer_id && x.period === i.period) ? null
    : (invoices.push({ ...i, id: 'inv-' + invoices.length, customer: customers.find(c => c.id === i.customer_id).name, synced: false }), { id: 'x' })),
  unsyncedInvoices: async () => invoices.filter(i => !i.synced).map(i => ({ ...i, created_at: '2026-11-01T09:00:00Z' })),
  markSynced: async id => { invoices.find(i => i.id === id).synced = true; },
};

// ---- invoices ----
let r = await makeInvoices(store, rates, '2026-10');
assert.deepEqual(r.made, ['Acme Co']);
assert.deepEqual(r.held, [{ customer: 'Birch', unpriced: 500 }]);
assert.equal(invoices.length, 1);
assert.equal(invoices[0].total, 31.2 + 2.6);           // opus 24 x 1.3, sonnet 2 x 1.3
assert.equal(invoices[0].lines.length, 2);
assert.ok(invoices[0].lines.every(l => l.cost === undefined && l.provider_cost === undefined)); // lines are customer-facing
assert.ok(Math.abs(invoices[0].provider_cost - 26) < 1e-9);
r = await makeInvoices(store, rates, '2026-10');
assert.deepEqual(r.made, []);                          // running again changes nothing
assert.equal(invoices.length, 1);
usage.b = [grp({ model: 'claude-haiku-4-5', input: 1e6 })]; // rate added later: the held customer is invoiced next run
assert.deepEqual((await makeInvoices(store, rates, '2026-10')).made, ['Birch']);

// ---- Twenty ----
const records = new Map(), posts = [];
let failNotes = true, existingCompany = null;
const fetchImpl = async (url, o) => {
  const u = new URL(url), p = u.pathname.slice('/rest/'.length);
  if (o.method === 'GET' && p === 'companies') return { ok: true, status: 200, json: async () => ({ data: { companies: existingCompany ? [{ id: existingCompany }] : [] } }) };
  if (o.method === 'GET') return { ok: records.has(p), status: records.has(p) ? 200 : 404, json: async () => ({ data: records.get(p) }) };
  if (p === 'notes' && failNotes) return { ok: false, status: 500, json: async () => ({}) };
  const d = JSON.parse(o.body); posts.push({ p, d }); records.set(p + '/' + d.id, { id: d.id });
  return { ok: true, status: 201, json: async () => ({ data: { create: { id: d.id } } }) };
};
const twenty = new Twenty('http://127.0.0.1:3020', 'fixture-token', fetchImpl, 0);

let t = await syncInvoices(store, twenty);
assert.deepEqual(t, { synced: 0, failed: 2 });          // Twenty error: nothing marked synced, so the next run retries
assert.ok(invoices.every(i => !i.synced));
failNotes = false; existingCompany = 'existing-company-id'; posts.length = 0;
t = await syncInvoices(store, twenty);
assert.deepEqual(t, { synced: 2, failed: 0 });
assert.ok(invoices.every(i => i.synced));
const target = posts.find(x => x.p === 'noteTargets');
assert.equal(target.d.targetCompanyId, 'existing-company-id'); // reused the Company that already had that name
assert.ok(!posts.some(x => x.p === 'companies'));
const note = posts.find(x => x.p === 'notes');
assert.match(note.d.title, /^Invoice 2026-10 · \$33\.80$/);
assert.match(note.d.bodyV2.markdown, /claude-opus-5-5/);
t = await syncInvoices(store, twenty);
assert.deepEqual(t, { synced: 0, failed: 0 });          // nothing left to copy

existingCompany = null; invoices[0].synced = false; records.clear();
await syncInvoices(store, twenty);
assert.ok(posts.some(x => x.p === 'companies' && x.d.name === 'Acme Co')); // no match: creates one

invoices[0].synced = false; invoices[0].twenty_company_id = 'crm-company'; posts.length = 0; records.clear();
await syncInvoices(store, twenty);
assert.equal(posts.find(x => x.p === 'noteTargets').d.targetCompanyId, 'crm-company'); // a customer made in the CRM already knows its Company
assert.ok(!posts.some(x => x.p === 'companies'));

console.log('invoice tests passed');
