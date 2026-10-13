/* book.js — intake form behaviour. Works without JS as a plain form post. */
(function () {
  var form = document.getElementById('book-form');
  if (!form) return;
  var submit = document.getElementById('book-submit');
  var card = document.getElementById('book-card');
  var success = document.getElementById('book-success');
  var endpoint = form.dataset.endpoint || '';

  function refresh() {
    submit.disabled = !form.checkValidity();
  }
  form.addEventListener('input', refresh);
  form.addEventListener('change', refresh);
  refresh();

  form.addEventListener('submit', function (e) {
    form.classList.add('form--touched');
    if (!form.checkValidity()) { e.preventDefault(); return; }
    e.preventDefault();
    submit.disabled = true;
    submit.textContent = 'Sending…';

    var data = {};
    new FormData(form).forEach(function (v, k) { data[k] = v; });

    var done = function () {
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
      alert('Something went wrong sending your request. Please try again or email us directly.');
    };

    if (!endpoint) { done(); return; }           /* TODO: set data-endpoint on the form */
    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(data)
    }).then(function (r) { r.ok ? done() : fail(); }).catch(fail);
  });
})();
