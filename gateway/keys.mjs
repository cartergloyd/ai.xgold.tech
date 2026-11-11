// Customer and key admin, run on the server:
//   set -a; . /home/gold/server-platform/gateway/gateway.env; set +a
//   node gateway/keys.mjs add-customer "Acme Co" owner@acme.com
//   node gateway/keys.mjs add-key "Acme Co" [label]     node gateway/keys.mjs revoke xgold-ai-AbCd
//   node gateway/keys.mjs reset-password owner@acme.com node gateway/keys.mjs list
// Secrets are printed once and never stored in plain text.
import { randomBytes } from 'node:crypto';
import { connect } from './pgstore.mjs';
import { hashPassword, sha256, KEY_PREFIX } from './gateway.mjs';

const pool = connect(process.env.GATEWAY_DATABASE_URL);
const q = async (text, params) => (await pool.query(text, params)).rows;
const [cmd, a, b] = process.argv.slice(2);

async function newKey(customerId, label) {
  const key = KEY_PREFIX + randomBytes(24).toString('base64url');
  await q('insert into ai_keys (customer_id,label,prefix,key_hash) values ($1,$2,$3,$4)', [customerId, label ?? '', key.slice(0, 14), sha256(key)]);
  return key;
}
async function customerByName(name) {
  const [c] = await q('select id from ai_customers where name=$1', [name]);
  if (!c) throw new Error('No customer named ' + name);
  return c.id;
}

try {
  if (cmd === 'add-customer' && a && b) {
    const [c] = await q('insert into ai_customers (name) values ($1) returning id', [a]);
    const password = randomBytes(12).toString('base64url');
    await q('insert into ai_users (customer_id,email,password_hash) values ($1,$2,$3)', [c.id, b.trim(), await hashPassword(password)]);
    console.log(`Customer: ${a}\nPortal login: ${b}\nPassword (shown once): ${password}\nAPI key (shown once): ${await newKey(c.id, 'first key')}`);
  } else if (cmd === 'add-key' && a) {
    console.log('API key (shown once): ' + await newKey(await customerByName(a), b));
  } else if (cmd === 'revoke' && a) {
    const rows = await q('update ai_keys set revoked_at=now() where prefix=$1 and revoked_at is null returning prefix', [a.slice(0, 14)]);
    console.log(rows.length ? `Revoked ${rows.length} key(s) starting ${a.slice(0, 14)}` : 'No active key with that prefix');
  } else if (cmd === 'reset-password' && a) {
    const password = randomBytes(12).toString('base64url');
    const rows = await q('update ai_users set password_hash=$2 where lower(email)=lower($1) returning id', [a, await hashPassword(password)]);
    if (rows.length) await q('delete from ai_sessions where user_id=$1', [rows[0].id]);
    console.log(rows.length ? 'New password (shown once): ' + password : 'No user with that email');
  } else if (cmd === 'list') {
    for (const r of await q(`select c.name, k.prefix, k.label, k.revoked_at is not null as revoked from ai_customers c left join ai_keys k on k.customer_id=c.id order by c.name, k.created_at`))
      console.log(`${r.name}\t${r.prefix ?? '(no key)'}\t${r.label ?? ''}${r.revoked ? '\trevoked' : ''}`);
  } else {
    console.error('Usage: add-customer <name> <email> | add-key <customer> [label] | revoke <key-prefix> | reset-password <email> | list');
    process.exitCode = 1;
  }
} finally { await pool.end(); }
