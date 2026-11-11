// Customer keys live in the CRM. Staff add an "AI key" record on a Company in Twenty; within seconds this turns it into a
// working gateway key and writes the key back onto the record. Status "Revoked" (or deleting the record) cuts the key off.
// One-time CRM setup: node gateway/crm-setup.mjs
import fs from 'node:fs/promises';
import { Twenty } from '../crm/lead-sync.mjs';
import { makeKey } from './gateway.mjs';

export async function twentyFromEnv(env = process.env) {
  const path = env.TWENTY_API_KEY_FILE;
  if (!path) return null;
  if (((await fs.stat(path)).mode & 0o777) !== 0o600) throw new Error('Twenty API key file must be mode 600');
  return new Twenty(env.TWENTY_BASE_URL ?? 'http://127.0.0.1:3020', (await fs.readFile(path, 'utf8')).trim());
}

const rowsOf = res => Object.values(res?.data ?? {}).find(Array.isArray) ?? [];
const rowOf = res => (res?.data?.id ? res.data : Object.values(res?.data ?? {}).find(v => v && !Array.isArray(v) && v.id)) ?? null;

async function listKeys(twenty) {
  const all = []; let after = '';
  for (let page = 0; page < 20; page++) {
    const res = await twenty.request('GET', 'aiKeys?limit=100' + (after ? '&starting_after=' + encodeURIComponent(after) : ''));
    if (!res) throw new Error('The AI key object is missing in the CRM. Run gateway/crm-setup.mjs'); // never read "missing" as "no keys"
    all.push(...rowsOf(res));
    if (!res.pageInfo?.hasNextPage) return all;
    after = res.pageInfo.endCursor;
  }
  throw new Error('More AI keys than one sync can read');
}

// shortcut: the full key is written onto the CRM record so staff can copy it any time. Move to a show-once step if CRM access widens.
async function issue(store, twenty, r) {
  const company = rowOf(await twenty.request('GET', 'companies/' + r.companyId));
  if (!company?.name) return false;
  const { key, prefix, hash } = makeKey();
  const customer_id = await store.customerForCompany(r.companyId, company.name);
  await store.upsertCrmKey({ customer_id, label: r.name ?? '', prefix, key_hash: hash, twenty_key_id: r.id });
  // If this write fails the key was never shown, and the next run replaces it.
  await twenty.update('aiKeys', r.id, { apiKey: key, keyPrefix: prefix, status: 'ACTIVE' });
  return true;
}

export async function syncKeys(store, twenty) {
  const records = await listKeys(twenty);
  const known = new Map((await store.crmKeys()).map(k => [k.twenty_key_id, k]));
  let issued = 0, revoked = 0;
  for (const r of records) {
    const k = known.get(r.id); known.delete(r.id);
    try {
      if (!r.keyPrefix) { if (r.companyId && await issue(store, twenty, r)) issued++; continue; } // no company yet: stays Pending
      if (!k) continue;                                                // a prefix typed in by hand: not ours to manage
      if (r.status === 'REVOKED' && !k.revoked) { await store.revokeCrmKey(r.id); k.revoked = true; revoked++; }
      if (k.revoked) { // the database wins: show Revoked and take the key text off the record
        const fix = { ...(r.status !== 'REVOKED' && { status: 'REVOKED' }), ...(r.apiKey && { apiKey: '' }) };
        if (Object.keys(fix).length) await twenty.update('aiKeys', r.id, fix);
      }
    } catch { console.error('CRM key sync failed for one record; it will be retried'); }
  }
  // Keys whose record vanished from the list: cut them off only once the CRM confirms the record is deleted.
  const gone = [...known.values()].filter(k => !k.revoked);
  if (gone.length > 3) { console.error(`CRM key sync: ${gone.length} keys are missing from the CRM, so none were revoked. Check the CRM.`); return { issued, revoked }; }
  for (const k of gone) {
    const rec = rowOf(await twenty.request('GET', 'aiKeys/' + k.twenty_key_id));
    if (!rec || rec.deletedAt) { await store.revokeCrmKey(k.twenty_key_id); revoked++; }
  }
  return { issued, revoked };
}

export function startKeySync(store, twenty, every = 15e3) {
  let busy = false, lastError = '';
  const tick = async () => {
    if (busy) return;
    busy = true;
    try { await syncKeys(store, twenty); lastError = ''; }
    catch (e) { if (e.message !== lastError) console.error('CRM key sync failed:', e.message); lastError = e.message; } // once per cause, not every 15 s
    finally { busy = false; }
  };
  setInterval(tick, every).unref();
  tick();
}
