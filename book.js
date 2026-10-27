/* book.js — intake form behaviour. Works without JS as a plain form post. */
(function () {
  var form = document.getElementById('book-form');
  if (!form) return;
  var submit = document.getElementById('book-submit');
  var card = document.getElementById('book-card');
  var success = document.getElementById('book-success');
  var errorBox = document.getElementById('book-error');
  var endpoint = form.dataset.endpoint || '';
  var sb = {
    url: (form.dataset.supabaseUrl || '').replace(/\/$/, ''),
    key: form.dataset.supabaseKey || '',
    table: form.dataset.supabaseTable || ''
  };

  function refresh() {
    submit.disabled = !form.checkValidity();
  }
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  /* Analytics: one "started" event per page view, no field values sent */
  var started = false;
  form.addEventListener('input', function () {
    if (started || !window.umami) return;
    started = true;
    umami.track('assessment-started');
  });

  form.addEventListener('submit', function (e) {
    form.classList.add('form--touched');
    if (!form.checkValidity()) { e.preventDefault(); return; }
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Sending…';

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });
    if (errorBox) errorBox.hidden = true;

    var done = function () {
      if (window.umami) umami.track('assessment-submitted', { constraint: data.constraint, workflow: data.workflow });
      document.getElementById('success-name').textContent = data.name.split(' ')[0];
      document.getElementById('success-email').textContent = data.email;
      card.querySelector('.form-card__body').hidden = true;
      card.querySelector('.form-card__foot').hidden = true;
      success.hidden = false;
      success.focus();
    };
    var fail = function () {
      submit.disabled = false;
      submit.textContent = 'Request a call';
      if (errorBox) {
        errorBox.textContent = 'Something went wrong sending your request. Please try again in a moment, or email us directly.';
        errorBox.hidden = false;
      }
    };

    /* Honeypot filled: a bot. Show success, send nothing. */
    if (data.website) { done(); return; }

    if (sb.url && sb.key && sb.table) {
      var row = {
        name: data.name,
        email: data.email,
        company: data.company,
        role: data.role || null,
        constraint_area: data.constraint,
        workflow: data.workflow,
        cost_today: data.cost || null,
        has_owner: data.owner === 'yes',
        send_questions: data.send_questions === 'yes',
        source: location.pathname + (document.referrer ? ' ← ' + document.referrer : '')
      };
      fetch(sb.url + '/rest/v1/' + sb.table, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': sb.key,
          'Authorization': 'Bearer ' + sb.key,
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(row)
      }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
      return;
    }

    if (!endpoint) { done(); return; }
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
  });
})();
