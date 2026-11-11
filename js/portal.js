/* Customer portal: sign in, this month's usage, invoices. Talks to the xGold AI gateway. */
(() => {
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  const API = local ? 'http://127.0.0.1:3031' : 'https://ai-gateway.xgold.tech';
  const $ = id => document.getElementById(id);
  const session = {
    get() { try { return sessionStorage.getItem('xg_portal'); } catch { return null; } },
    set(v) { try { v ? sessionStorage.setItem('xg_portal', v) : sessionStorage.removeItem('xg_portal'); } catch { /* memory only */ } },
  };
  let token = session.get(), customer = '', isAdmin = false;

  const money = n => n > 0 && n < 0.01 ? '<$0.01' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
  const count = n => new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
  const monthName = m => new Date(m + '-01T00:00:00Z').toLocaleString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  const el = (tag, props = {}, ...kids) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  // [requests, input, output, cached, amount]: the three token columns drop out on phones so the amount stays on screen
  const numCells = vals => vals.map((t, n) => el('td', { className: n > 0 && n < 4 ? 'num hide-sm' : 'num', textContent: t }));

  async function api(path, init = {}) {
    const res = await fetch(API + path, { ...init, headers: { ...(token ? { authorization: 'Bearer ' + token } : {}), ...init.headers } });
    if (res.status === 401 && token) { signOut('Your session ended. Sign in again.'); throw new Error('signed out'); }
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(body.error || 'Something went wrong. Try again.');
    return body;
  }

  // Status line under a form: plain text, or the error colour when it went wrong.
  function say(id, text, error = false) { const m = $(id); m.textContent = text; if (error) m.dataset.error = ''; else delete m.dataset.error; }
  function showError(message) { const e = $('signin-error'); e.textContent = message; e.hidden = !message; }
  function signOut(message = '') {
    token = null; session.set(null);
    $('dash').hidden = true; $('signin').hidden = false;
    $('password').value = ''; $('provider-key').value = ''; $('key-new-value').textContent = ''; $('key-new').hidden = true; showError(message);
  }

  function months() { // this month and the 11 before it, newest first
    const out = [], now = new Date();
    for (let i = 0; i < 12; i++) out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7));
    return out;
  }

  function renderUsage(u) {
    customer = u.customer; isAdmin = u.admin;
    $('who').textContent = u.customer;
    $('amount').textContent = money(u.amount);
    const note = $('amount-note');
    note.hidden = !u.unpriced;
    note.textContent = u.unpriced ? `${count(u.unpriced)} tokens are waiting for a price. They appear on the invoice.` : '';
    $('s-calls').textContent = count(u.calls);
    $('s-input').textContent = count(u.input);
    $('s-output').textContent = count(u.output);
    $('s-cached').textContent = count(u.cache_read + u.cache_write);

    const [y, m] = u.month.split('-').map(Number), days = new Date(Date.UTC(y, m, 0)).getUTCDate();
    const byDay = new Map(u.by_day.map(d => [Number(d.day.slice(8)), d.tokens]));
    const peak = Math.max(1, ...byDay.values());
    $('bars').replaceChildren(...Array.from({ length: days }, (_, i) => {
      const t = byDay.get(i + 1) ?? 0, bar = el('span');
      bar.style.height = t ? Math.max(3, Math.round(t / peak * 100)) + '%' : '2px';
      if (!t) bar.dataset.empty = '';
      return bar;
    }));
    $('bars').setAttribute('aria-label', `Tokens per day in ${monthName(u.month)}. Busiest day ${count(peak > 1 ? peak : 0)} tokens.`);
    $('bars-caption').textContent = `Tokens per day, ${monthName(u.month)}`;

    $('models-empty').hidden = u.calls > 0; $('models-wrap').hidden = u.calls === 0;
    $('models-body').replaceChildren(...u.by_model.map(r => el('tr', {},
      el('td', { textContent: r.model }),
      ...numCells([count(r.calls), count(r.input), count(r.output), count(r.cache_read + r.cache_write), r.amount === null ? 'Pending' : money(r.amount)]))));
  }

  function renderInvoices(list) {
    $('invoices-empty').hidden = list.length > 0;
    $('invoice-list').replaceChildren(...list.map(i => {
      const rows = i.lines.map(l => el('tr', {}, el('td', { textContent: l.model }),
        ...numCells([count(l.calls), count(l.input), count(l.output), count(l.cache_read + l.cache_write), money(l.amount)])));
      const table = el('div', { className: 'table-wrap' }, el('table', { className: 'table' },
        el('thead', {}, el('tr', {}, ...['Model', 'Requests', 'Input', 'Output', 'Cached', 'Amount'].map((h, n) => el('th', { scope: 'col', className: n ? (n > 1 && n < 5 ? 'num hide-sm' : 'num') : '', textContent: h })))),
        el('tbody', {}, ...rows)));
      const issued = new Date(i.created_at).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' });
      const print = el('button', { className: 'link', type: 'button', textContent: 'Print' });
      const d = el('details', { className: 'invoice' },
        el('summary', {}, el('span', { className: 'invoice__period', textContent: monthName(i.period) }), el('span', { className: 'invoice__total', textContent: money(i.total) })),
        el('div', { className: 'invoice__body' },
          el('p', { className: 'invoice__meta', textContent: `xGold Tech, invoice for ${monthName(i.period)}. Billed to ${customer}. Issued ${issued}.` }), table, print));
      print.addEventListener('click', () => {
        d.open = true; d.classList.add('is-printing');
        addEventListener('afterprint', () => d.classList.remove('is-printing'), { once: true });
        print.blur(); window.print();
      });
      return d;
    }));
  }

  async function loadUsage(month) { renderUsage(await api('/portal/usage?month=' + month)); }

  // Staff only: the Anthropic key the gateway spends. The key is never sent back, only its last four characters.
  // Staff only: make customer keys and list them. A full key is shown once, right after it is made.
  async function loadKeys() {
    const { customers, keys } = await api('/portal/admin/keys');
    $('customer-names').replaceChildren(...customers.map(n => el('option', { value: n })));
    $('keys-empty').hidden = keys.length > 0; $('keys-wrap').hidden = keys.length === 0;
    $('keys-body').replaceChildren(...keys.map(k => {
      const revoke = el('button', { className: 'btn btn--secondary btn--sm', type: 'button', textContent: 'Revoke' });
      revoke.setAttribute('aria-label', `Revoke key ${k.prefix} for ${k.customer}`);
      revoke.addEventListener('click', async () => {
        if (!confirm(`Revoke ${k.prefix} for ${k.customer}? It stops working right away and cannot be turned back on.`)) return;
        revoke.disabled = true;
        try { await api('/portal/admin/keys/revoke', { method: 'POST', body: JSON.stringify({ id: k.id }) }); say('key-msg', 'Revoked.'); await loadKeys(); }
        catch (err) { say('key-msg', err.message, true); revoke.disabled = false; }
      });
      return el('tr', {},
        el('td', { textContent: k.customer }),
        el('td', { className: 'hide-sm', textContent: k.label }),
        el('td', { className: 'mono', textContent: k.prefix }),
        el('td', {}, k.revoked_at ? el('span', { className: 'muted', textContent: 'Revoked' })
          : el('span', { className: 'cell-action' }, el('span', { className: 'status', textContent: 'Active' }), revoke)));
    }));
  }

  async function loadProvider() {
    const p = await api('/portal/admin/provider-key');
    const saved = p.updated_at ? ` Saved ${new Date(p.updated_at).toLocaleDateString('en-US', { dateStyle: 'long', timeZone: 'UTC' })}.` : '';
    $('provider-status').textContent = p.configured
      ? `${p.source === 'portal' ? 'Set here' : 'Set in gateway.env'}. Ends in ${p.last4}.${saved}`
      : 'Not set. Claude Code requests fail until you add one.';
  }

  async function load() {
    const select = $('month'), list = months();
    select.replaceChildren(...list.map(m => el('option', { value: m, textContent: monthName(m) })));
    try {
      await loadUsage(list[0]);
      renderInvoices((await api('/portal/invoices')).invoices); // after usage, so invoices know the customer name
    } catch (e) { if (token) showError(e.message); return; }
    $('signin').hidden = true; $('dash').hidden = false;
    $('admin').hidden = !isAdmin;
    if (isAdmin) {
      loadProvider().catch(() => { $('provider-status').textContent = 'Could not check the key. Reload to try again.'; });
      loadKeys().catch(() => say('key-msg', 'Could not load the keys. Reload to try again.', true));
    }
  }

  $('month').addEventListener('change', e => loadUsage(e.target.value).catch(err => showError(err.message)));
  $('signout').addEventListener('click', () => signOut());
  $('provider-form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('provider-submit');
    button.disabled = true; say('provider-msg', '');
    try {
      await api('/portal/admin/provider-key', { method: 'POST', body: JSON.stringify({ key: $('provider-key').value }) });
      $('provider-key').value = ''; // the key never stays on the page
      say('provider-msg', 'Saved. The gateway uses it now.');
      await loadProvider();
    } catch (err) { say('provider-msg', err instanceof TypeError ? 'Could not reach xGold. Try again.' : err.message, true); }
    finally { button.disabled = false; }
  });
  $('keys-form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('key-submit');
    button.disabled = true; say('key-msg', ''); $('key-new').hidden = true;
    try {
      const r = await api('/portal/admin/keys', { method: 'POST', body: JSON.stringify({ customer: $('key-customer').value, label: $('key-label').value }) });
      $('key-new-value').textContent = r.key;
      $('key-new-note').textContent = `${r.new_customer ? 'New customer added. ' : ''}Key for ${r.customer}. ` + (r.crm === 'added'
        ? "It is also saved on the customer's record in the CRM."
        : r.crm === 'failed' ? 'It could not be saved to the CRM. Copy it now; it is not shown again.' : 'Copy it now; it is not shown again.');
      $('key-new').hidden = false; $('key-label').value = '';
      await loadKeys();
    } catch (err) { say('key-msg', err instanceof TypeError ? 'Could not reach xGold. Try again.' : err.message, true); }
    finally { button.disabled = false; }
  });
  $('key-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('key-new-value').textContent); say('key-msg', 'Copied.'); }
    catch { say('key-msg', 'Could not copy. Select the key and copy it by hand.', true); }
  });
  $('signin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const button = $('signin-submit'); button.disabled = true; showError('');
    try {
      const r = await api('/portal/login', { method: 'POST', body: JSON.stringify({ email: $('email').value, password: $('password').value }) });
      token = r.token; session.set(token); await load();
    } catch (err) { if (!token) showError(err instanceof TypeError ? 'Could not reach xGold. Try again.' : err.message); }
    finally { button.disabled = false; }
  });

  if (token) load();
})();
