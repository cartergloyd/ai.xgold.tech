// Run: node gateway/test-crm-keys.mjs   (no database, network or Twenty needed)
import assert from 'node:assert/strict';
import http from 'node:http';
import { syncKeys } from './crm-keys.mjs';
import { sha256 } from './gateway.mjs';
import { Twenty } from '../crm/lead-sync.mjs';

// ---- a fake Twenty that answers like its REST API (two records per page, to exercise paging) ----
const records = new Map(), softDeleted = new Set();
const companies = new Map([['co1', { id: 'co1', name: 'Acme Co' }], ['co2', { id: 'co2', name: 'Birch' }]]);
let patchFails = 0, objectMissing = false;
const json = (res, status, body) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://twenty'), [, , collection, id] = u.pathname.split('/');
  if (req.method === 'GET' && collection === 'aiKeys' && !id) {
    if (objectMissing) return json(res, 404, {});
    const live = [...records.values()].filter(r => !softDeleted.has(r.id));
    const from = u.searchParams.get('starting_after'), start = from ? live.findIndex(r => r.id === from) + 1 : 0, page = live.slice(start, start + 2);
    return json(res, 200, { data: { aiKeys: page }, pageInfo: { hasNextPage: start + 2 < live.length, endCursor: page.at(-1)?.id } });
  }
  if (req.method === 'GET' && collection === 'aiKeys') {
    const rec = records.get(id);
    return rec ? json(res, 200, { data: { aiKey: { ...rec, deletedAt: softDeleted.has(id) ? '2026-11-10T00:00:00Z' : null } } }) : json(res, 404, {});
  }
  if (req.method === 'GET' && collection === 'companies') return companies.has(id) ? json(res, 200, { data: { company: companies.get(id) } }) : json(res, 404, {});
  if (req.method === 'PATCH' && collection === 'aiKeys') {
    if (patchFails-- > 0) return json(res, 500, {});
    const chunks = []; for await (const c of req) chunks.push(c);
    Object.assign(records.get(id), JSON.parse(Buffer.concat(chunks)));
    return json(res, 200, { data: { updateAiKey: records.get(id) } });
  }
  json(res, 404, {});
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const twenty = new Twenty(`http://127.0.0.1:${server.address().port}`, 'fixture-token', fetch, 0);
const add = (id, o) => records.set(id, { id, name: id, status: 'PENDING', keyPrefix: '', apiKey: '', companyId: 'co1', ...o });

// ---- the gateway database, in memory (same behavior as pgstore) ----
const customers = [], dbKeys = new Map();
const store = {
  customerForCompany: async (companyId, name) => {
    let c = customers.find(x => x.twenty_company_id === companyId) ?? customers.find(x => x.name === name && !x.twenty_company_id);
    if (!c) customers.push(c = { id: 'cust-' + customers.length });
    return Object.assign(c, { twenty_company_id: companyId, name }).id;
  },
  upsertCrmKey: async k => { dbKeys.set(k.twenty_key_id, { ...k, revoked: false }); },
  crmKeys: async () => [...dbKeys.values()].map(k => ({ twenty_key_id: k.twenty_key_id, revoked: k.revoked })),
  revokeCrmKey: async id => { const k = dbKeys.get(id); if (k) k.revoked = true; },
};
const logs = []; console.error = (...a) => logs.push(a.join(' '));
const sync = () => syncKeys(store, twenty);

// a new record becomes a working key, written back onto the record
add('k1', { name: 'laptop' }); add('k2', { companyId: null }); add('k3', { companyId: 'co2' });
assert.deepEqual(await sync(), { issued: 2, revoked: 0 });                  // paged read: all three records seen
const k1 = records.get('k1');
assert.match(k1.apiKey, /^xgold-ai-/); assert.equal(k1.keyPrefix, k1.apiKey.slice(0, 14)); assert.equal(k1.status, 'ACTIVE');
assert.equal(dbKeys.get('k1').key_hash, sha256(k1.apiKey)); assert.equal(dbKeys.get('k1').label, 'laptop');
assert.equal(customers.find(c => c.id === dbKeys.get('k1').customer_id).name, 'Acme Co');
assert.equal(records.get('k2').keyPrefix, ''); assert.ok(!dbKeys.has('k2'));      // no Company yet: waits, nothing issued
const firstKey = k1.apiKey;
assert.deepEqual(await sync(), { issued: 0, revoked: 0 });                  // running again changes nothing
assert.equal(records.get('k1').apiKey, firstKey);
records.get('k2').companyId = 'co1';
assert.deepEqual(await sync(), { issued: 1, revoked: 0 });
assert.equal(dbKeys.get('k2').customer_id, dbKeys.get('k1').customer_id);   // one customer per Company

// setting Revoked cuts the key off and removes the key text from the record
records.get('k1').status = 'REVOKED';
assert.deepEqual(await sync(), { issued: 0, revoked: 1 });
assert.equal(dbKeys.get('k1').revoked, true); assert.equal(records.get('k1').apiKey, ''); assert.equal(records.get('k1').keyPrefix, firstKey.slice(0, 14));
records.get('k1').status = 'ACTIVE';                                        // flipping it back does not revive it
await sync();
assert.equal(records.get('k1').status, 'REVOKED'); assert.equal(dbKeys.get('k1').revoked, true);

// deleting the record revokes the key, once the CRM confirms it is gone (hard or soft delete)
records.delete('k2');
assert.deepEqual(await sync(), { issued: 0, revoked: 1 });
assert.equal(dbKeys.get('k2').revoked, true);
softDeleted.add('k3');
assert.deepEqual(await sync(), { issued: 0, revoked: 1 });
assert.equal(dbKeys.get('k3').revoked, true);

// a failed write back to the CRM never leaves a key nobody has seen: the next run replaces it
add('k9', { companyId: 'co2' });
patchFails = 1;
assert.deepEqual(await sync(), { issued: 0, revoked: 0 });
const unseen = dbKeys.get('k9').key_hash;
assert.deepEqual(await sync(), { issued: 1, revoked: 0 });
assert.notEqual(dbKeys.get('k9').key_hash, unseen); assert.equal(dbKeys.get('k9').key_hash, sha256(records.get('k9').apiKey));

// a CRM that looks empty or broken must not cut customers off
objectMissing = true;
await assert.rejects(sync(), /missing in the CRM/);
objectMissing = false;
for (const id of ['m1', 'm2', 'm3', 'm4']) add(id);
await sync();
const active = () => [...dbKeys.values()].filter(k => !k.revoked).length;
const live = active();
records.clear();                                                            // e.g. a restored backup without the records
assert.deepEqual(await sync(), { issued: 0, revoked: 0 });
assert.equal(active(), live);
assert.ok(logs.some(l => /none were revoked/.test(l)));

assert.ok(!logs.join('\n').includes('xgold-ai-'));                          // no key text ever reaches the logs
console.log('crm key tests passed');
server.close();
