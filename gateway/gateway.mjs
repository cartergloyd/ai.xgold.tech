// xGold AI gateway: customers send Claude Code (or any Anthropic client) here with an xGoldAI key.
// We swap in our own Anthropic key, stream the reply back untouched, and save the token counts.
// The same service answers the customer portal's login and usage questions under /portal.
import http from 'node:http';
import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { once } from 'node:events';
import { promisify } from 'node:util';
import { loadRates, sseMeter, jsonMeter, usageRow, summarize, currentMonth, monthRange } from './meter.mjs';
import { connect, pgStore, migrate } from './pgstore.mjs';

const scryptAsync = promisify(scrypt);
export const sha256 = s => createHash('sha256').update(s).digest('hex');
export const KEY_PREFIX = 'xgold-ai-';
// A new customer key: show `key` once, store only `hash`. `prefix` tells keys apart in the CRM and the key list.
export const makeKey = () => { const key = KEY_PREFIX + randomBytes(24).toString('base64url'); return { key, prefix: key.slice(0, 14), hash: sha256(key) }; };

export async function hashPassword(pw) {
  const salt = randomBytes(16);
  return salt.toString('hex') + ':' + (await scryptAsync(pw, salt, 32)).toString('hex');
}
async function checkPassword(pw, stored) {
  const [salt, hash] = stored.split(':');
  return timingSafeEqual(await scryptAsync(pw, Buffer.from(salt, 'hex'), 32), Buffer.from(hash, 'hex'));
}

// Only what Claude Code needs. Everything else (Files, Batches, admin) would spend our key unmetered.
const allowed = (method, path) =>
  (method === 'POST' && (path === '/v1/messages' || path === '/v1/messages/count_tokens'))
  || (method === 'GET' && (path === '/v1/models' || path.startsWith('/v1/models/')));

function limiter(limit, windowMs) {
  const hits = new Map();
  return {
    blocked: k => (hits.get(k)?.reset ?? 0) > Date.now() && hits.get(k).n >= limit,
    hit(k) {
      const now = Date.now(), h = hits.get(k);
      if (!h || h.reset <= now) hits.set(k, { n: 1, reset: now + windowMs }); else h.n++;
      if (hits.size > 5000) for (const [key, v] of hits) if (v.reset <= now) hits.delete(key);
    },
  };
}

const sendJson = (res, status, obj) => { res.writeHead(status, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); };
const apiError = (res, status, type, message) => sendJson(res, status, { type: 'error', error: { type, message } });

async function readBody(req, max) {
  const chunks = []; let n = 0;
  for await (const c of req) {
    n += c.length;
    if (n > max) throw Object.assign(new Error('Request too large.'), { status: 413 });
    chunks.push(c);
  }
  return Buffer.concat(chunks);
}

// mirror(key info) copies a key made in the portal onto the customer's record in the CRM; leave it out when there is no CRM.
export function createApp({ store, rates, upstream = 'https://api.anthropic.com', anthropicKey, origins = [], fetchImpl = fetch, mirror = null }) {
  const keyFails = limiter(20, 60e3), loginFails = limiter(8, 600e3);
  const dummyHash = hashPassword('not-a-real-password'); // so an unknown email costs the same time as a wrong password

  // Our Anthropic key: the one saved in the portal, else the one in gateway.env. Re-read every 30 s; a database blip keeps the last value.
  let cached = { value: anthropicKey, at: 0 };
  async function providerKey() {
    if (Date.now() - cached.at > 30e3) {
      let saved;
      try { saved = (await store.getSetting('anthropic_key'))?.value; } catch { return cached.value; }
      cached = { value: saved ?? anthropicKey, at: Date.now() };
    }
    return cached.value;
  }
  async function providerStatus() { // never returns the key itself
    const saved = await store.getSetting('anthropic_key'), key = saved?.value ?? anthropicKey;
    return { configured: Boolean(key), last4: key ? key.slice(-4) : null, source: saved ? 'portal' : key ? 'server' : null, updated_at: saved?.updated_at ?? null };
  }

  async function saveProviderKey(req, res) {
    let key; try { key = JSON.parse((await readBody(req, 4096)).toString('utf8'))?.key; } catch { /* rejected below */ }
    key = typeof key === 'string' ? key.trim() : '';
    if (!/^sk-ant-[\w-]{20,}$/.test(key)) return sendJson(res, 400, { error: 'That does not look like an Anthropic key. It starts with sk-ant-.' });
    let check; // listing models is free and proves the key works before it replaces the old one
    try { check = await fetchImpl(`${upstream}/v1/models?limit=1`, { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01' }, signal: AbortSignal.timeout(10e3) }); }
    catch { return sendJson(res, 502, { error: 'Could not reach Anthropic to check the key. Nothing was saved. Try again.' }); }
    await check.body?.cancel();
    if (check.status === 401 || check.status === 403) return sendJson(res, 400, { error: 'Anthropic did not accept that key. Check it and try again.' });
    if (!check.ok) return sendJson(res, 502, { error: `Anthropic could not check the key right now (HTTP ${check.status}). Nothing was saved. Try again.` });
    await store.setSetting('anthropic_key', key);
    cached = { value: key, at: Date.now() };
    return sendJson(res, 200, await providerStatus());
  }

  const bodyOf = async req => { try { return JSON.parse((await readBody(req, 4096)).toString('utf8')) ?? {}; } catch { return {}; } };

  // Staff make a customer key: shown once here, stored as a hash, and copied onto the customer's CRM record when there is one.
  async function createCustomerKey(req, res) {
    const body = await bodyOf(req);
    const name = typeof body.customer === 'string' ? body.customer.trim() : '';
    const label = (typeof body.label === 'string' ? body.label.trim().slice(0, 80) : '') || 'Key';
    if (!name || name.length > 120) return sendJson(res, 400, { error: 'Enter the customer name.' });
    let customer = await store.customerByName(name);
    const isNew = !customer;
    customer ??= await store.createCustomer(name);
    const { key, prefix, hash } = makeKey();
    const { id: key_id } = await store.insertKey({ customer_id: customer.id, label, prefix, key_hash: hash });
    let crm = 'off';
    if (mirror) {
      try { await mirror({ customer_id: customer.id, customer: customer.name, twenty_company_id: customer.twenty_company_id, key_id, label, key, prefix }); crm = 'added'; }
      catch { crm = 'failed'; console.error('A customer key was made but not copied to the CRM'); } // the key works either way
    }
    return sendJson(res, 201, { key, prefix, customer: customer.name, label, new_customer: isNew, crm });
  }

  async function revokeCustomerKey(req, res) {
    const { id } = await bodyOf(req);
    if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return sendJson(res, 400, { error: 'Pick a key to revoke.' });
    // The CRM record follows within 15 seconds (crm-keys.mjs shows it as Revoked and removes the key text).
    return await store.revokeKey(id) ? sendJson(res, 200, { revoked: true }) : sendJson(res, 404, { error: 'That key is already revoked or does not exist.' });
  }

  async function proxy(req, res, url, ip) {
    const apiKey = await providerKey();
    if (!apiKey) return apiError(res, 503, 'api_error', 'The xGold AI gateway is not configured yet.');
    if (keyFails.blocked(ip)) return apiError(res, 429, 'rate_limit_error', 'Too many failed attempts. Try again in a minute.');
    const bearer = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const token = bearer ?? req.headers['x-api-key'];
    const key = typeof token === 'string' && token.startsWith(KEY_PREFIX) ? await store.keyByHash(sha256(token)) : null;
    if (!key) { keyFails.hit(ip); return apiError(res, 401, 'authentication_error', 'invalid x-api-key'); }

    let payload;
    try { payload = await readBody(req, 32 << 20); } catch (e) { return apiError(res, e.status ?? 400, 'invalid_request_error', e.message); }

    const headers = { 'x-api-key': apiKey, 'accept-encoding': 'identity' };
    for (const h of ['anthropic-version', 'anthropic-beta', 'content-type', 'accept']) if (req.headers[h]) headers[h] = req.headers[h];
    const abort = new AbortController();
    res.on('close', () => { if (!res.writableEnded) abort.abort(); }); // client left: stop paying for the reply

    let up;
    try {
      up = await fetchImpl(upstream + url.pathname + url.search,
        { method: req.method, headers, body: payload.length ? payload : undefined, signal: abort.signal });
    } catch { return apiError(res, 502, 'api_error', 'The xGold AI gateway could not reach Anthropic.'); }

    const meter = url.pathname === '/v1/messages' && up.status < 300
      ? ((up.headers.get('content-type') ?? '').includes('text/event-stream') ? sseMeter() : jsonMeter()) : null;
    const out = {};
    for (const h of ['content-type', 'request-id', 'retry-after', 'cache-control']) if (up.headers.has(h)) out[h] = up.headers.get(h);
    res.writeHead(up.status, out);
    try {
      for await (const chunk of up.body ?? []) {
        meter?.write(chunk);
        if (!res.write(chunk)) await once(res, 'drain', { signal: abort.signal });
      }
      res.end();
    } catch { res.destroy(); } // upstream dropped or client left; bill what was already generated
    if (!meter) return;
    meter.end();
    const { model, usage } = meter.result();
    if (!model) return;
    const row = { customer_id: key.customer_id, key_id: key.id, status: up.status, ...usageRow(model, usage) };
    if (row.input + row.output + row.cache_read + row.cache_write_5m + row.cache_write_1h === 0) return;
    try { await store.recordUsage(row); } catch { console.error('usage-not-saved', JSON.stringify(row)); } // journald keeps the row for a manual insert
  }

  function cors(req, res) {
    const origin = req.headers.origin;
    if (origin && origins.includes(origin)) { res.setHeader('access-control-allow-origin', origin); res.setHeader('vary', 'origin'); }
  }

  async function portal(req, res, url, ip) {
    cors(req, res);
    if (req.method === 'OPTIONS') {
      res.writeHead(204, { 'access-control-allow-methods': 'GET, POST', 'access-control-allow-headers': 'authorization, content-type', 'access-control-max-age': '600' });
      return res.end();
    }
    if (url.pathname === '/portal/login' && req.method === 'POST') {
      if (loginFails.blocked(ip)) return sendJson(res, 429, { error: 'Too many attempts. Try again in a few minutes.' });
      let body; try { body = JSON.parse((await readBody(req, 4096)).toString('utf8')); } catch { return sendJson(res, 400, { error: 'Send an email and password.' }); }
      const user = typeof body?.email === 'string' && typeof body?.password === 'string' ? await store.userByEmail(body.email.trim()) : null;
      const ok = user ? await checkPassword(body.password, user.password_hash) : (await checkPassword('x', await dummyHash), false);
      if (!ok) { loginFails.hit(ip); return sendJson(res, 401, { error: 'That email and password do not match. Try again.' }); }
      const token = randomBytes(32).toString('base64url'), expires = new Date(Date.now() + 12 * 3600e3);
      await store.createSession(sha256(token), user.id, user.customer_id, expires);
      return sendJson(res, 200, { token, expires_at: expires.toISOString() });
    }

    const bearer = /^Bearer (.+)$/i.exec(req.headers.authorization ?? '')?.[1];
    const session = bearer ? await store.sessionByHash(sha256(bearer)) : null;
    if (!session) return sendJson(res, 401, { error: 'Sign in to continue.' });

    if (url.pathname.startsWith('/portal/admin/')) {
      if (!session.is_admin) return sendJson(res, 403, { error: 'Only xGold staff can do that.' });
      const route = req.method + ' ' + url.pathname.slice('/portal/admin/'.length);
      if (route === 'GET provider-key') return sendJson(res, 200, await providerStatus());
      if (route === 'POST provider-key') return saveProviderKey(req, res);
      if (route === 'GET keys') return sendJson(res, 200, { customers: (await store.customerNames()).map(c => c.name), keys: await store.adminKeys() });
      if (route === 'POST keys') return createCustomerKey(req, res);
      if (route === 'POST keys/revoke') return revokeCustomerKey(req, res);
    }
    if (url.pathname === '/portal/usage' && req.method === 'GET') {
      const month = url.searchParams.get('month') ?? currentMonth();
      if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return sendJson(res, 400, { error: 'Month must look like 2026-11.' });
      const s = summarize(await store.monthUsage(session.customer_id, ...monthRange(month)), rates);
      return sendJson(res, 200, {
        customer: session.name, admin: Boolean(session.is_admin), month, calls: s.calls, input: s.input, output: s.output, cache_read: s.cache_read, cache_write: s.cache_write,
        amount: s.amount, unpriced: s.unpriced,
        by_model: s.by_model.map(({ cost, priced, ...m }) => m), // never show our provider cost
        by_day: s.by_day.map(d => ({ ...d, amount: Math.round(d.amount * 100) / 100 })),
      });
    }
    if (url.pathname === '/portal/invoices' && req.method === 'GET') return sendJson(res, 200, { invoices: await store.invoices(session.customer_id) });
    return sendJson(res, 404, { error: 'Not found.' });
  }

  return async (req, res) => {
    const ip = req.headers['cf-connecting-ip'] ?? req.socket.remoteAddress; // loopback only, behind the tunnel, so the header can be trusted
    const url = new URL(req.url, 'http://gateway');
    try {
      if (url.pathname === '/healthz') return sendJson(res, 200, { ok: true });
      if (url.pathname.startsWith('/portal/')) return await portal(req, res, url, ip);
      if (allowed(req.method, url.pathname)) return await proxy(req, res, url, ip);
      return apiError(res, 404, 'not_found_error', 'Not found.');
    } catch {
      console.error('gateway request failed', req.method, url.pathname);
      if (!res.headersSent) apiError(res, 500, 'api_error', 'Something went wrong on our side.');
      else res.destroy();
    }
  };
}

async function main() {
  const pool = connect(process.env.GATEWAY_DATABASE_URL);
  await migrate(pool);
  const store = pgStore(pool);
  // Customer keys are made in the CRM (and mirrored there from the portal). Without a Twenty key file the gateway runs without that.
  const { twentyFromEnv, startKeySync, mirrorKey } = await import('./crm-keys.mjs');
  const twenty = await twentyFromEnv().catch(e => { console.error('CRM keys are off:', e.message); return null; });
  const app = createApp({
    store,
    mirror: twenty ? k => mirrorKey(store, twenty, k) : null,
    rates: loadRates(new URL('./rates.json', import.meta.url)),
    anthropicKey: process.env.ANTHROPIC_API_KEY,
    upstream: process.env.UPSTREAM_URL, // unset in production; lets a staging run point at a stub
    origins: (process.env.PORTAL_ORIGINS ?? 'https://www.xgold.tech,https://xgold.tech').split(','),
  });
  const server = http.createServer(app);
  server.keepAliveTimeout = 65e3; // longer than the tunnel's idle timeout, or reused connections race the close
  server.listen(Number(process.env.PORT ?? 3030), '127.0.0.1');
  if (twenty) startKeySync(store, twenty); // records added in Twenty become gateway keys within seconds
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main().catch(() => { console.error('Gateway stopped; check GATEWAY_DATABASE_URL, the database and gateway/schema.sql'); process.exitCode = 1; });
