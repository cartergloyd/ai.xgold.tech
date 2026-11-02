/* visitor.js — first-party visitor ID for Umami. Load it before the Umami tag.
 *
 * Every Umami hit carries this browser's ID (the tag's data-before-send="xgBeforeSend"),
 * so Umami keeps one session per browser across visits and months instead of a monthly
 * anonymous hash. When someone sends an assessment request, book.js calls
 * xgVisitor.identify(), which attaches their details to that session and so links every
 * earlier and later visit from this browser to them.
 *
 * Browsers sending Global Privacy Control or Do Not Track get no ID and are counted
 * anonymously, as before. The footer button turns all tracking off for this browser.
 */
(function () {
  var COOKIE = 'xg_vid';
  var OPT_OUT = 'xg_optout';
  var YEAR = 31536000;
  var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

  var host = location.hostname;
  var shared = host === 'xgold.tech' || /\.xgold\.tech$/.test(host);
  var attrs = '; Path=/; SameSite=Lax' + (shared ? '; Domain=xgold.tech' : '') +
    (location.protocol === 'https:' ? '; Secure' : '');

  function read(name) {
    var match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return match ? match[1] : '';
  }
  function write(name, value, maxAge) {
    document.cookie = name + '=' + value + '; Max-Age=' + maxAge + attrs;
  }
  /* localStorage "umami.disabled" is Umami's own off switch; the cookie is the record */
  function umamiSwitch(off) {
    try {
      if (off) localStorage.setItem('umami.disabled', '1');
      else localStorage.removeItem('umami.disabled');
    } catch (e) { /* storage blocked: xgBeforeSend still drops every hit */ }
  }
  function privacySignal() {
    var dnt = navigator.doNotTrack || window.doNotTrack || navigator.msDoNotTrack;
    return navigator.globalPrivacyControl === true || dnt === '1' || dnt === 1 || dnt === 'yes';
  }
  function optedOut() {
    return read(OPT_OUT) === '1';
  }
  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID(); // needs https; production is https
    var b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 15) | 64;
    b[8] = (b[8] & 63) | 128;
    var h = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    return h.slice(0, 8) + '-' + h.slice(8, 12) + '-' + h.slice(12, 16) + '-' + h.slice(16, 20) + '-' + h.slice(20);
  }

  var id = '';
  function start() {
    id = '';
    if (optedOut() || privacySignal()) {
      if (read(COOKIE)) write(COOKIE, '', 0);
      return;
    }
    id = read(COOKIE);
    if (!UUID.test(id)) id = newId();
    write(COOKIE, id, YEAR); // one year from the latest visit
  }
  start();

  /* Umami calls this before every request; returning false cancels the request */
  window.xgBeforeSend = function (type, payload) {
    if (optedOut()) return false;
    if (id) payload.id = id;
    return payload;
  };

  window.xgVisitor = {
    id: function () { return id; },
    /* Attach details to this browser's Umami session. No-op without an ID. */
    identify: function (data) {
      if (!id || !window.umami) return;
      try { window.umami.identify(data); } catch (e) { /* analytics must never break the form */ }
    }
  };

  /* Footer control: <button data-xg-tracking hidden> */
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-xg-tracking]'));
  function label() {
    var off = optedOut();
    buttons.forEach(function (button) {
      button.textContent = off ? 'Tracking is off for this browser. Turn it back on' : 'Stop tracking this browser';
      button.hidden = false;
    });
  }
  buttons.forEach(function (button) {
    button.addEventListener('click', function () {
      var off = !optedOut();
      if (off) write(OPT_OUT, '1', YEAR);
      else write(OPT_OUT, '', 0);
      umamiSwitch(off);
      start();
      label();
    });
  });
  label();
})();
