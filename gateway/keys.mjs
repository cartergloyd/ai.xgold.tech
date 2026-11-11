// Customer and key admin, run on the server:
//   set -a; . /home/gold/server-platform/gateway/gateway.env; set +a
//   node gateway/keys.mjs add-admin you@xgold.tech     (xGold staff: can set the Anthropic key in the portal)
//   node gateway/keys.mjs add-user "Acme Co" owner@acme.com   (a portal login for a customer made in the CRM)
//   node gateway/keys.mjs add-customer "Acme Co" owner@acme.com   (customer + login + first key, without the CRM)
//   node gateway/keys.mjs add-key "Acme Co" [label]     node gateway/keys.mjs revoke xgold-ai-AbCd
//   node gateway/keys.mjs reset-password owner@acme.com node gateway/keys.mjs list
// Customer keys are normally made in the CRM (see crm-keys.mjs); keys made here do not show up there.
// Secrets are printed once and never stored in plain text.
import { randomBytes } from 'node:crypto';
import { connect } from './pgstore.mjs';
import { hashPassword, makeKey } from './gateway.mjs';

const pool = connect(process.env.GATEWAY_DATABASE_URL);
const q = async (text, params) => (await pool.query(text, params)).rows;
const [cmd, a, b] = process.argv.slice(2);

async function newKey(customerId, label) {
  const { key, prefix, hash } = makeKey();
  await q('insert into ai_keys (customer_id,label,prefix,key_hash) values ($1,$2,$3,$4)', [customerId, label ?? '', prefix, hash]);
  return key;
}
async function customerByName(name) {
  const [c] = await q('select id from ai_customers where name=$1', [name]);
  if (!c) throw new Error('No customer named ' + name);
  return c.id;
}
async function newUser(customerId, email, isAdmin = false) {
  const password = randomBytes(12).toString('base64url');
  await q('insert into ai_users (customer_id,email,password_hash,is_admin) values ($1,$2,$3,$4)', [customerId, email.trim(), await hashPassword(password), isAdmin]);
  return password;
}

try {
  if (cmd === 'add-customer' && a && b) {
    const [c] = await q('insert into ai_customers (name) values ($1) returning id', [a]);
    const password = await newUser(c.id, b);
    console.log(`Customer: ${a}\nPortal login: ${b}\nPassword (shown once): ${password}\nAPI key (shown once): ${await newKey(c.id, 'first key')}`);
  } else if (cmd === 'add-user' && a && b) {
    console.log(`Portal login: ${b}\nPassword (shown once): ${await newUser(await customerByName(a), b)}`);
  } else if (cmd === 'add-admin' && a) {
    const id = (await q("select id from ai_customers where name='xGold Tech'"))[0]?.id ?? (await q("insert into ai_customers (name) values ('xGold Tech') returning id"))[0].id;
    console.log(`Admin login: ${a}\nPassword (shown once): ${await newUser(id, a, true)}`);
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
    console.error('Usage: add-admin <email> | add-user <customer> <email> | add-customer <name> <email> | add-key <customer> [label] | revoke <key-prefix> | reset-password <email> | list');
    process.exitCode = 1;
  }
} finally { await pool.end(); }
