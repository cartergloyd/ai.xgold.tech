/* script.js — progressive enhancement only. The page is complete without it. */
(function () {
  document.documentElement.classList.add('js');

  /* Nav: mobile menu */
  var nav = document.querySelector('.nav');
  var toggle = document.querySelector('.nav__toggle');
  if (nav && toggle) {
    toggle.addEventListener('click', function () {
      var open = nav.classList.toggle('nav--open');
      toggle.setAttribute('aria-expanded', String(open));
      document.body.style.overflow = open ? 'hidden' : '';
    });
    nav.querySelectorAll('.nav__links a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('nav--open');
        toggle.setAttribute('aria-expanded', 'false');
        document.body.style.overflow = '';
      });
    });
  }

  /* Scroll-in reveal */
  var reveals = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('is-visible'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -10% 0px', threshold: 0.1 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('is-visible'); });
  }

  /* Shelf: chevron controls */
  document.querySelectorAll('.shelf').forEach(function (shelf) {
    var track = shelf.querySelector('.shelf__track');
    var prev = shelf.querySelector('[data-shelf="prev"]');
    var next = shelf.querySelector('[data-shelf="next"]');
    if (!track || !prev || !next) return;
    function step() {
      var item = track.querySelector('li');
      return item ? item.getBoundingClientRect().width + 16 : track.clientWidth * 0.8;
    }
    function update() {
      prev.disabled = track.scrollLeft <= 2;
      next.disabled = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    }
    prev.addEventListener('click', function () { track.scrollBy({ left: -step(), behavior: 'smooth' }); });
    next.addEventListener('click', function () { track.scrollBy({ left: step(), behavior: 'smooth' }); });
    track.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    update();
  });

  /* Numbers: segmented filter */
  var filters = document.querySelectorAll('[data-filter]');
  var entries = document.querySelectorAll('[data-category]');
  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      var value = btn.dataset.filter;
      filters.forEach(function (b) { b.setAttribute('aria-pressed', String(b === btn)); });
      entries.forEach(function (el) { el.hidden = value !== 'All' && el.dataset.category !== value; });
    });
  });

  /* Start: workflow picker */
  var select = document.getElementById('constraint');
  var recTitle = document.getElementById('rec-title');
  var recDetail = document.getElementById('rec-detail');
  var recs = {
    value: ['Baseline-backed value hypothesis', 'Map one current process, define its cost and quality baseline, identify a decision owner and agree what financial outcome would justify investment.'],
    pilot: ['End-to-end workflow blueprint', 'Map the full journey from trigger to completed transaction, including records, handoffs, exceptions, approvals and evaluation tests.'],
    risk: ['AI use and permissions register', 'Identify active tools and sensitive data paths, then set approved usage, least-privilege access, review points and an audit record.'],
    people: ['Role-specific operating playbook', 'Identify the job tasks where AI can help, train with approved cases and document when staff must escalate or override.'],
    cost: ['Cost-per-completion acceptance test', 'Measure actual inference, integration, review, rework and support costs, alongside quality and authorized-action rates.']
  };
  if (select && recTitle && recDetail) {
    select.addEventListener('change', function () {
      var r = recs[select.value];
      if (!r) return;
      recTitle.textContent = r[0];
      recDetail.textContent = r[1];
    });
  }
})();

/* Tabs (problems.html): hash-linked segmented control */
(function () {
  var lists = document.querySelectorAll('[role="tablist"]');
  lists.forEach(function (list) {
    var tabs = list.querySelectorAll('[role="tab"]');
    var panels = [].map.call(tabs, function (t) { return document.getElementById(t.getAttribute('aria-controls')); });
    function select(tab, push) {
      tabs.forEach(function (t, i) {
        var on = t === tab;
        t.setAttribute('aria-selected', String(on));
        t.tabIndex = on ? 0 : -1;
        if (panels[i]) panels[i].hidden = !on;
      });
      if (push && tab.dataset.hash) history.replaceState(null, '', '#' + tab.dataset.hash);
      if (tab.scrollIntoView) tab.scrollIntoView({ block: 'nearest', inline: 'center' });
    }
    tabs.forEach(function (t) {
      t.addEventListener('click', function () { select(t, true); });
      t.addEventListener('keydown', function (e) {
        var i = [].indexOf.call(tabs, t);
        if (e.key === 'ArrowRight') { select(tabs[(i + 1) % tabs.length], true); tabs[(i + 1) % tabs.length].focus(); }
        if (e.key === 'ArrowLeft') { select(tabs[(i - 1 + tabs.length) % tabs.length], true); tabs[(i - 1 + tabs.length) % tabs.length].focus(); }
      });
    });
    function fromHash() {
      var h = location.hash.replace('#', '');
      var match = [].filter.call(tabs, function (t) { return t.dataset.hash === h; })[0];
      select(match || tabs[0], false);
    }
    fromHash();
    window.addEventListener('hashchange', fromHash);
  });
})();
