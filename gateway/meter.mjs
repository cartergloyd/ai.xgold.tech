// Metering core: read token usage out of Anthropic replies, price it, and total it for the portal and invoices.
import fs from 'node:fs';

export const loadRates = path => JSON.parse(fs.readFileSync(path, 'utf8'));

// Dated snapshots (claude-haiku-4-5-20251001) price like their base model.
export const rateFor = (rates, model) => rates.models[String(model).replace(/-\d{8}$/, '')] ?? null;

// Provider cost in USD for one group of calls, or null when the model has no rate.
export function cost(rates, row) {
  const r = rateFor(rates, row.model);
  if (!r) return null;
  const p = row.long_ctx && r.long ? r.long : r;
  const usd = (row.input * p.in + row.output * p.out + row.cache_read * p.read
    + row.cache_write_5m * p.w5 + row.cache_write_1h * p.w1h) / 1e6;
  return row.fast ? usd * 2 : usd; // shortcut: fast mode is 2x on every model that has it; revisit if that changes
}

const cents = n => Math.round(n * 100) / 100;

// Months are UTC. monthRange('2026-11') is [Nov 1, Dec 1) as ISO instants.
export const currentMonth = () => new Date().toISOString().slice(0, 7);
export const lastMonth = () => { const d = new Date(); return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)).toISOString().slice(0, 7); };
export function monthRange(month) {
  const [y, m] = month.split('-').map(Number);
  return [new Date(Date.UTC(y, m - 1, 1)).toISOString(), new Date(Date.UTC(y, m, 1)).toISOString()];
}

// rows: monthUsage() groups. Customer price = provider cost x (1 + markup), rounded per line so lines add up to the total.
export function summarize(rows, rates) {
  const sum = { calls: 0, input: 0, output: 0, cache_read: 0, cache_write: 0, amount: 0, cost: 0, unpriced: 0 };
  const models = new Map(), days = new Map();
  for (const r of rows) {
    const c = cost(rates, r);
    const write = r.cache_write_5m + r.cache_write_1h;
    const tokens = r.input + r.output + r.cache_read + write;
    sum.calls += r.calls; sum.input += r.input; sum.output += r.output; sum.cache_read += r.cache_read; sum.cache_write += write;
    if (c === null) sum.unpriced += tokens;
    const m = models.get(r.model) ?? { model: r.model, calls: 0, input: 0, output: 0, cache_read: 0, cache_write: 0, cost: 0, priced: c !== null };
    Object.assign(m, { calls: m.calls + r.calls, input: m.input + r.input, output: m.output + r.output,
      cache_read: m.cache_read + r.cache_read, cache_write: m.cache_write + write, cost: m.cost + (c ?? 0) });
    models.set(r.model, m);
    const d = days.get(r.day) ?? { day: r.day, tokens: 0, amount: 0 };
    d.tokens += tokens; d.amount += (c ?? 0) * (1 + rates.markup);
    days.set(r.day, d);
  }
  const by_model = [...models.values()].map(m => ({ ...m, amount: m.priced ? cents(m.cost * (1 + rates.markup)) : null }));
  sum.cost = by_model.reduce((a, m) => a + m.cost, 0);
  sum.amount = cents(by_model.reduce((a, m) => a + (m.amount ?? 0), 0));
  return { ...sum, by_model, by_day: [...days.values()].sort((a, b) => a.day.localeCompare(b.day)) };
}

// ---- Reading usage from replies ----
const merge = (usage, u) => {
  if (!u) return;
  const { cache_creation, ...rest } = u;
  for (const [k, v] of Object.entries(rest)) if (v != null) usage[k] = v;
  if (cache_creation) usage.cache_creation = { ...usage.cache_creation, ...cache_creation };
};

// Streaming (SSE): message_start carries the input side, message_delta the running output count.
export function sseMeter() {
  let buf = '', model = null; const usage = {}, decoder = new TextDecoder();
  const line = l => {
    if (!l.startsWith('data:')) return;
    let e; try { e = JSON.parse(l.slice(5)); } catch { return; }
    if (e.type === 'message_start') { model = e.message?.model ?? model; merge(usage, e.message?.usage); }
    else if (e.type === 'message_delta') merge(usage, e.usage);
  };
  return {
    write(chunk) {
      buf += decoder.decode(chunk, { stream: true });
      let i; while ((i = buf.indexOf('\n')) >= 0) { line(buf.slice(0, i).replace(/\r$/, '')); buf = buf.slice(i + 1); }
    },
    end() { if (buf) line(buf); buf = ''; },
    result: () => ({ model, usage }),
  };
}

// Plain JSON reply.
export function jsonMeter() {
  const chunks = [];
  return {
    write: c => chunks.push(c),
    end() {},
    result() {
      try { const j = JSON.parse(Buffer.concat(chunks).toString('utf8')); return { model: j.model ?? null, usage: j.usage ?? {} }; }
      catch { return { model: null, usage: {} }; }
    },
  };
}

// One billable row from a reply's usage object. 5-minute and 1-hour cache writes are priced differently.
export function usageRow(model, u) {
  const c = u.cache_creation, total = u.cache_creation_input_tokens ?? 0;
  const w1h = c?.ephemeral_1h_input_tokens ?? 0, w5 = c ? (c.ephemeral_5m_input_tokens ?? total - w1h) : total;
  const input = u.input_tokens ?? 0, read = u.cache_read_input_tokens ?? 0;
  return { model, input, output: u.output_tokens ?? 0, cache_read: read, cache_write_5m: w5, cache_write_1h: w1h,
    long_ctx: input + read + w5 + w1h > 100000, fast: u.speed === 'fast' };
}
