// Postgres access for the gateway, portal, key script and invoice job.
import { createRequire } from 'node:module';

export function connect(url) {
  // shortcut: borrows the pg module from the homelab dashboard install, like crm/lead-sync.mjs; add a package.json when the repo wants its own
  const pg = createRequire(process.env.HOMELAB_PACKAGE ?? '/home/gold/server-platform/homelab-dashboard-src/package.json')('pg');
  return new pg.Pool({ connectionString: url, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 15000, application_name: 'xgold-gateway' });
}

export function pgStore(pool) {
  const one = async (text, params) => (await pool.query(text, params)).rows[0] ?? null;
  const many = async (text, params) => (await pool.query(text, params)).rows;
  return {
    keyByHash: h => one('select id, customer_id from ai_keys where key_hash=$1 and revoked_at is null', [h]),
    recordUsage: r => pool.query(
      `insert into ai_usage (customer_id,key_id,model,input_tokens,output_tokens,cache_read,cache_write_5m,cache_write_1h,long_ctx,fast,status)
       values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
      [r.customer_id, r.key_id, r.model, r.input, r.output, r.cache_read, r.cache_write_5m, r.cache_write_1h, r.long_ctx, r.fast, r.status]),
    userByEmail: e => one('select id, customer_id, password_hash from ai_users where lower(email)=lower($1)', [e]),
    async createSession(hash, userId, customerId, expires) {
      await pool.query('delete from ai_sessions where expires_at < now()');
      await pool.query('insert into ai_sessions (token_hash,user_id,customer_id,expires_at) values ($1,$2,$3,$4)', [hash, userId, customerId, expires]);
    },
    sessionByHash: h => one(
      'select s.customer_id, c.name from ai_sessions s join ai_customers c on c.id=s.customer_id where s.token_hash=$1 and s.expires_at>now()', [h]),
    // Usage grouped the way pricing needs it: day x model x long-context x fast. from/to are ISO instants, to is exclusive.
    monthUsage: (customerId, from, to) => many(
      `select to_char(ts at time zone 'UTC','YYYY-MM-DD') as day, model, long_ctx, fast, count(*)::int as calls,
         sum(input_tokens)::float8 as input, sum(output_tokens)::float8 as output, sum(cache_read)::float8 as cache_read,
         sum(cache_write_5m)::float8 as cache_write_5m, sum(cache_write_1h)::float8 as cache_write_1h
       from ai_usage where customer_id=$1 and ts>=$2 and ts<$3 group by 1,2,3,4 order by 1`, [customerId, from, to]),
    customersWithUsage: (from, to) => many(
      `select distinct c.id, c.name from ai_usage u join ai_customers c on c.id=u.customer_id where u.ts>=$1 and u.ts<$2`, [from, to]),
    invoices: customerId => many(
      `select period, status, lines, total::float8 as total, created_at from ai_invoices
       where customer_id=$1 and status<>'void' order by period desc limit 36`, [customerId]),
    async insertInvoice(i) {
      return one(
        `insert into ai_invoices (customer_id,period,lines,provider_cost,markup,total) values ($1,$2,$3,$4,$5,$6)
         on conflict (customer_id,period) do nothing returning id`,
        [i.customer_id, i.period, JSON.stringify(i.lines), i.provider_cost, i.markup, i.total]);
    },
    unsyncedInvoices: () => many(
      `select i.id, i.period, i.lines, i.total::float8 as total, i.created_at, c.id as customer_id, c.name as customer
       from ai_invoices i join ai_customers c on c.id=i.customer_id where i.twenty_synced_at is null and i.status<>'void' order by i.created_at`),
    markSynced: id => pool.query('update ai_invoices set twenty_synced_at=now() where id=$1', [id]),
  };
}
