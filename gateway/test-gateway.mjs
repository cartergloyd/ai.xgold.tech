// Run: node gateway/test-gateway.mjs   (no database or network needed)
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp, hashPassword, sha256 } from './gateway.mjs';
import { cost, summarize, usageRow, loadRates } from './meter.mjs';

const rates = loadRates(new URL('./rates.json', import.meta.url));
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} should be ${b}`);
const until = async (fn, ms = 2000) => { const end = Date.now() + ms; while (!fn()) { assert.ok(Date.now() < end, 'timed out waiting'); await new Promise(r => setTimeout(r, 10)); } };
const listen = server => new Promise(r => server.listen(0, '127.0.0.1', () => r(`http://127.0.0.1:${server.address().port}`)));

// ---- pricing ----
const row = o => ({ model: 'claude-opus-5-5', input: 0, output: 0, cache_read: 0, cache_write_5m: 0, cache_write_1h: 0, long_ctx: false, fast: false, calls: 1, day: '2026-11-03', ...o });
close(cost(rates, row({ input: 1e6, output: 1e6 })), 24);
close(cost(rates, row({ cache_read: 1e6, cache_write_5m: 1e6, cache_write_1h: 1e6 })), 0.2 + 5 + 8);
close(cost(rates, row({ input: 1e6, fast: true })), 8);
close(cost(rates, row({ model: 'claude-haiku-5-5', input: 1e6 })), 0.1);
close(cost(rates, row({ model: 'claude-haiku-5-5', input: 1e6, long_ctx: true })), 0.5);
close(cost(rates, row({ model: 'claude-haiku-4-5-20251001', output: 1e6 })), 5); // dated snapshot prices like its base
assert.equal(cost(rates, row({ model: 'claude-mystery-1', input: 5 })), null);
const s = summarize([row({ input: 1e6, output: 1e6 }), row({ model: 'claude-mystery-1', input: 7 })], rates);
assert.equal(s.amount, 31.2); // 24 x 1.30
assert.equal(s.unpriced, 7);
assert.equal(s.by_model.find(m => m.model === 'claude-mystery-1').amount, null);
assert.deepEqual(usageRow('m', { input_tokens: 5, output_tokens: 6, cache_read_input_tokens: 7, cache_creation_input_tokens: 8 }),
  { model: 'm', input: 5, output: 6, cache_read: 7, cache_write_5m: 8, cache_write_1h: 0, long_ctx: false, fast: false });
const split = usageRow('m', { input_tokens: 1, cache_creation_input_tokens: 10, cache_creation: { ephemeral_5m_input_tokens: 4, ephemeral_1h_input_tokens: 6 }, speed: 'fast' });
assert.equal(split.cache_write_5m, 4); assert.equal(split.cache_write_1h, 6); assert.equal(split.fast, true);
assert.equal(usageRow('m', { input_tokens: 100001 }).long_ctx, true);

// ---- fake Anthropic ----
const sse = (ev, data) => `event: ${ev}\ndata: ${JSON.stringify(data)}\n\n`;
const start = (model = 'claude-opus-5-5') => sse('message_start', { type: 'message_start', message: { id: 'msg_1', model,
  usage: { input_tokens: 100, cache_creation_input_tokens: 20, cache_read_input_tokens: 50, cache_creation: { ephemeral_5m_input_tokens: 0, ephemeral_1h_input_tokens: 20 }, output_tokens: 1 } } });
const delta = n => sse('message_delta', { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: n } });
const streamBody = start() + sse('content_block_delta', { type: 'content_block_delta', delta: { text: 'hi' } }) + delta(42) + sse('message_stop', { type: 'message_stop' });
const seen = []; let upstreamClosed = false;
const anthropic = http.createServer(async (req, res) => {
  const chunks = []; for await (const c of req) chunks.push(c);
  const body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {};
  seen.push({ method: req.method, url: req.url, headers: req.headers });
  if (req.method === 'GET') { res.writeHead(200, { 'content-type': 'application/json' }); return res.end('{"data":[]}'); }
  if (body.hang) {
    res.writeHead(200, { 'content-type': 'text/event-stream' }); res.on('close', () => { upstreamClosed = true; });
    return res.write(start() + delta(7));
  }
  if (body.stream) { // split mid-line to prove buffering across chunks
    res.writeHead(200, { 'content-type': 'text/event-stream', 'request-id': 'req_1' });
    res.write(streamBody.slice(0, 95)); await new Promise(r => setTimeout(r, 20)); return res.end(streamBody.slice(95));
  }
  res.writeHead(200, { 'content-type': 'application/json' });
  res.end(JSON.stringify({ id: 'msg_2', model: body.model ?? 'claude-sonnet-5-5', usage: { input_tokens: 10, output_tokens: 20, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 } }));
});
const upstream = await listen(anthropic);

// ---- gateway over a memory store ----
const keys = new Map(), users = new Map(), sessions = new Map(), usage = [], invoices = [];
const store = {
  keyByHash: async h => keys.get(h) ?? null,
  recordUsage: async r => { usage.push({ ...r, ts: new Date().toISOString() }); },
  userByEmail: async e => users.get(e.toLowerCase()) ?? null,
  createSession: async (h, userId, customerId) => { sessions.set(h, { customer_id: customerId, name: customerId === 'c1' ? 'Acme' : 'Birch' }); },
  sessionByHash: async h => sessions.get(h) ?? null,
  monthUsage: async (cid, from, to) => {
    const g = new Map();
    for (const r of usage.filter(r => r.customer_id === cid && r.ts >= from && r.ts < to)) {
      const day = r.ts.slice(0, 10), k = [day, r.model, r.long_ctx, r.fast].join('|');
      const x = g.get(k) ?? { day, model: r.model, long_ctx: r.long_ctx, fast: r.fast, calls: 0, input: 0, output: 0, cache_read: 0, cache_write_5m: 0, cache_write_1h: 0 };
      x.calls++; for (const f of ['input', 'output', 'cache_read', 'cache_write_5m', 'cache_write_1h']) x[f] += r[f]; g.set(k, x);
    }
    return [...g.values()];
  },
  invoices: async cid => invoices.filter(i => i.customer_id === cid),
};
const addKey = (key, customer_id) => keys.set(sha256(key), { id: 'k-' + key, customer_id });
addKey('xgold-ai-acme', 'c1'); addKey('xgold-ai-birch', 'c2');
users.set('owner@acme.test', { id: 'u1', customer_id: 'c1', password_hash: await hashPassword('acme-pass') });
users.set('owner@birch.test', { id: 'u2', customer_id: 'c2', password_hash: await hashPassword('birch-pass') });
invoices.push({ customer_id: 'c1', period: '2026-10', status: 'sent', total: 12.5, lines: [] });

const gw = await listen(http.createServer(createApp({ store, rates, upstream, anthropicKey: 'sk-real', origins: ['https://www.xgold.tech'] })));
const call = (path, { key = 'xgold-ai-acme', headers = {}, ...init } = {}) =>
  fetch(gw + path, { headers: { authorization: 'Bearer ' + key, 'content-type': 'application/json', 'anthropic-version': '2023-06-01', ...headers }, ...init });
const post = (body, opts) => call('/v1/messages', { method: 'POST', body: JSON.stringify(body), ...opts });

assert.equal((await fetch(gw + '/healthz')).status, 200);

// keys: missing and wrong keys never reach Anthropic
let r = await fetch(gw + '/v1/messages', { method: 'POST', body: '{}' });
assert.equal(r.status, 401); assert.equal((await r.json()).error.type, 'authentication_error');
assert.equal((await post({}, { key: 'sk-ant-real-looking' })).status, 401);
assert.equal((await post({}, { key: 'xgold-ai-nope' })).status, 401);
assert.equal(seen.length, 0);

// streaming: reply arrives untouched, our key replaces theirs, usage is saved
r = await post({ stream: true, model: 'claude-opus-5-5' });
assert.equal(r.status, 200); assert.equal(r.headers.get('request-id'), 'req_1');
assert.equal(await r.text(), streamBody);
assert.equal(seen[0].headers['x-api-key'], 'sk-real'); assert.equal(seen[0].headers.authorization, undefined);
assert.equal(seen[0].headers['anthropic-version'], '2023-06-01');
await until(() => usage.length === 1);
assert.deepEqual({ ...usage[0], ts: undefined }, { customer_id: 'c1', key_id: 'k-xgold-ai-acme', status: 200, model: 'claude-opus-5-5', input: 100, output: 42,
  cache_read: 50, cache_write_5m: 0, cache_write_1h: 20, long_ctx: false, fast: false, ts: undefined });

// plain JSON reply, key sent the x-api-key way
r = await post({ model: 'claude-sonnet-5-5' }, { key: 'x', headers: { 'x-api-key': 'xgold-ai-acme', authorization: '' } });
assert.equal(r.status, 200);
await until(() => usage.length === 2);
assert.equal(usage[1].output, 20);

// only the metered endpoints exist
assert.equal((await call('/v1/files')).status, 404);
assert.equal((await call('/v1/messages/batches', { method: 'POST', body: '{}' })).status, 404);
assert.equal((await call('/v1/models')).status, 200);
assert.equal(usage.length, 2);

// client hangs up mid-reply: upstream is cancelled and what was generated is billed
const ac = new AbortController();
r = await post({ stream: true, hang: true }, { signal: ac.signal });
await r.body.getReader().read();
ac.abort();
await until(() => usage.length === 3 && upstreamClosed);
assert.equal(usage[2].output, 7);

// a model with no rate is saved but flagged, never billed at zero silently
await post({ model: 'claude-mystery-1' }).then(x => x.text());
await until(() => usage.length === 4);
assert.equal(summarize(await store.monthUsage('c1', '2000-01-01', '2100-01-01'), rates).unpriced, 30);

// second customer
await post({ model: 'claude-sonnet-5-5' }, { key: 'xgold-ai-birch' }).then(x => x.text());
await until(() => usage.length === 5);

// a revoked key stops working at once
keys.delete(sha256('xgold-ai-birch'));
assert.equal((await post({}, { key: 'xgold-ai-birch' })).status, 401);

// ---- portal ----
const login = (email, password, ip) => fetch(gw + '/portal/login', { method: 'POST', body: JSON.stringify({ email, password }), headers: ip ? { 'cf-connecting-ip': ip } : {} });
assert.equal((await login('owner@acme.test', 'wrong')).status, 401);
assert.equal((await login('nobody@acme.test', 'x')).status, 401);
const { token: acme } = await (await login('Owner@Acme.test', 'acme-pass')).json();
const { token: birch } = await (await login('owner@birch.test', 'birch-pass')).json();
assert.ok(acme && birch && acme !== birch);

const portal = (path, token) => fetch(gw + path, { headers: token ? { authorization: 'Bearer ' + token, origin: 'https://www.xgold.tech' } : {} });
assert.equal((await portal('/portal/usage')).status, 401);
assert.equal((await portal('/portal/usage', 'garbage')).status, 401);
usage.push({ ...row({ input: 1e6 }), customer_id: 'c1', key_id: 'k', status: 200, ts: new Date().toISOString() }); // one realistic 1M-token call
const mine = await (await portal('/portal/usage', acme)).json();
assert.equal(mine.customer, 'Acme'); assert.equal(mine.calls, 5); assert.equal(mine.unpriced, 30);
assert.equal(mine.by_model.find(m => m.model === 'claude-opus-5-5').amount, 5.2); // ~$4.00 provider x 1.30
assert.equal(mine.cost, undefined); assert.ok(mine.by_model.every(m => m.cost === undefined));
const theirs = await (await portal('/portal/usage', birch)).json();
assert.equal(theirs.customer, 'Birch'); assert.equal(theirs.calls, 1); // sees only its own rows
assert.equal((await (await portal('/portal/usage?month=2020-01', acme)).json()).calls, 0);
assert.equal((await portal('/portal/usage?month=bad', acme)).status, 400);
assert.deepEqual((await (await portal('/portal/invoices', acme)).json()).invoices.map(i => i.period), ['2026-10']);
assert.deepEqual((await (await portal('/portal/invoices', birch)).json()).invoices, []);

// browsers: the site may call, other sites may not
assert.equal((await portal('/portal/usage', acme)).headers.get('access-control-allow-origin'), 'https://www.xgold.tech');
assert.equal((await fetch(gw + '/portal/usage', { headers: { authorization: 'Bearer ' + acme, origin: 'https://evil.test' } })).headers.get('access-control-allow-origin'), null);
assert.equal((await fetch(gw + '/portal/login', { method: 'OPTIONS', headers: { origin: 'https://www.xgold.tech' } })).status, 204);

// guessing passwords gets blocked, even for the right password afterwards
for (let i = 0; i < 8; i++) assert.equal((await login('owner@acme.test', 'guess' + i, '9.9.9.9')).status, 401);
assert.equal((await login('owner@acme.test', 'acme-pass', '9.9.9.9')).status, 429);

console.log('gateway tests passed');
process.exit(0);
