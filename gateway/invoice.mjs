// Monthly invoices, run daily by xgold-ai-invoice.timer: node gateway/invoice.mjs [YYYY-MM]
// 1. Turn last month's usage into one invoice per customer (provider cost plus markup).
// 2. Copy each new invoice into Twenty as a Note on the customer's Company.
// Both steps are safe to repeat: an invoice is made once per customer and month, a Twenty record is made once per invoice.
import { loadRates, summarize, monthRange, lastMonth } from './meter.mjs';
import { connect, pgStore } from './pgstore.mjs';
import { recordId } from '../crm/lead-sync.mjs';
import { twentyFromEnv } from './crm-keys.mjs';

const usd = n => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);

export async function makeInvoices(store, rates, period) {
  const [from, to] = monthRange(period);
  const made = [], held = [];
  for (const c of await store.customersWithUsage(from, to)) {
    const s = summarize(await store.monthUsage(c.id, from, to), rates);
    if (s.unpriced) { held.push({ customer: c.name, unpriced: s.unpriced }); continue; } // add the model to rates.json; the next run picks it up
    if (s.amount === 0) continue;
    const lines = s.by_model.map(({ model, calls, input, output, cache_read, cache_write, amount }) => ({ model, calls, input, output, cache_read, cache_write, amount }));
    if (await store.insertInvoice({ customer_id: c.id, period, lines, provider_cost: s.cost, markup: rates.markup, total: s.amount })) made.push(c.name);
  }
  return { made, held };
}

export async function syncInvoices(store, twenty) {
  let synced = 0, failed = 0;
  for (const i of await store.unsyncedInvoices()) {
    try {
      const company = await companyFor(twenty, i);
      const note = recordId('invoice-note', i.id);
      const table = ['| Model | Requests | Amount |', '| --- | --- | --- |', ...i.lines.map(l => `| ${l.model} | ${l.calls} | ${usd(l.amount)} |`)].join('\n');
      const markdown = [`Total: ${usd(i.total)}`, `Period: ${i.period}`, `Status: sent to the customer portal`, '', table].join('\n');
      await twenty.ensure('notes', note, { title: `Invoice ${i.period} · ${usd(i.total)}`, bodyV2: { markdown, blocknote: null } });
      await twenty.ensure('noteTargets', recordId('invoice-target', i.id), { noteId: note, targetCompanyId: company });
      await store.markSynced(i.id);
      synced++;
    } catch { failed++; console.error('Twenty sync failed for an invoice; it will be retried on the next run'); }
  }
  return { synced, failed };
}

// A customer made from the CRM already knows its Company. Otherwise reuse one with the exact same name, or make one.
async function companyFor(twenty, i) {
  if (i.twenty_company_id) return i.twenty_company_id;
  try {
    const found = await twenty.request('GET', 'companies?limit=1&filter=' + encodeURIComponent(`name[eq]:"${i.customer.replaceAll('"', '')}"`));
    const id = found?.data?.companies?.[0]?.id;
    if (id) return id;
  } catch { /* fall through and create it */ }
  return twenty.ensure('companies', recordId('ai-customer', i.customer_id), { name: i.customer });
}

async function main() {
  const period = process.argv[2] ?? lastMonth();
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new Error('Month must look like 2026-10');
  const pool = connect(process.env.GATEWAY_DATABASE_URL), store = pgStore(pool);
  try {
    const { made, held } = await makeInvoices(store, loadRates(new URL('./rates.json', import.meta.url)), period);
    console.log(`${period}: ${made.length} invoice(s) made, ${held.length} held for a missing rate`);
    for (const h of held) console.error(`Held: ${h.customer} has ${h.unpriced} tokens on a model with no rate`);
    const twenty = await twentyFromEnv();
    if (!twenty) console.log('TWENTY_API_KEY_FILE is not set; skipping the Twenty copy');
    const t = twenty ? await syncInvoices(store, twenty) : { synced: 0, failed: 0 };
    if (twenty) console.log(`Twenty: ${t.synced} synced, ${t.failed} failed`);
    if (held.length || t.failed) process.exitCode = 1;
  } finally { await pool.end(); }
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main().catch(e => { console.error('Invoice run failed:', e.message); process.exitCode = 1; });
