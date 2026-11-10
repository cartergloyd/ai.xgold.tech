/* feed.js: the Research and Solutions feeds. Items live in the ai Directus (feed_items) and are filled by the
   dashboard Publish card, so a new upload shows here with no rebuild. Format guide: content/README.md.
   [data-feed="research|solutions"] gets a card list; [data-item] on item.html gets one rendered article. */
(function () {
  'use strict';
  var API = 'https://ai-api.xgold.tech';
  var SPEC = [['problem', 'Problem'], ['changed', 'Changed'], ['systems', 'Systems'], ['measured', 'Measured'], ['result', 'Result']];

  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function safeUrl(u) { return /^(https?:\/\/|\/|#|\.\.?\/|media:)/.test(u) ? media(u) : '#'; }
  function media(u) { return typeof u === 'string' && u.indexOf('media:') === 0 ? API + '/feed-media/' + u.slice(6) : u; }
  /* Escape first, then allow **bold**, *italic*, `code`, [text](url) and [^12] (a footnote to research.html#src-12). */
  function inline(s) {
    var t = esc(s);
    t = t.replace(/\[\^(\d+)\]/g, function (_, n) { return '<sup class="fn"><a href="research.html#src-' + (n.length < 2 ? '0' + n : n) + '">' + n + '</a></sup>'; });
    t = t.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, text, url) {
      var ext = /^https?:\/\//.test(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
      return '<a href="' + esc(safeUrl(url)) + '"' + ext + '>' + text + '</a>';
    });
    t = t.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    t = t.replace(/(^|[\s(])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return t.replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function fmtDate(iso) { return new Date(iso + 'T12:00:00Z').toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }); }
  function get(path) {
    return fetch(API + path, { headers: { Accept: 'application/json' } }).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (j) { return j.data; });
  }
  var label = function (c) { return [c.type, c.area, c.status].filter(Boolean).join(' · '); };

  /* ---------- article blocks ---------- */
  function blocks(list) {
    if (!Array.isArray(list)) return '';
    return list.map(function (b) {
      if (typeof b === 'string') return '<p>' + inline(b) + '</p>';
      if (b.h2) return '<h2 class="title-card">' + inline(b.h2) + '</h2>';
      if (b.h3) return '<h3>' + inline(b.h3) + '</h3>';
      if (b.p) return '<p>' + inline(b.p) + '</p>';
      if (b.lead) return '<p class="lead">' + inline(b.lead) + '</p>';
      if (b.ul) return '<ul>' + b.ul.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ul>';
      if (b.ol) return '<ol>' + b.ol.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</ol>';
      if (b.quote) return '<blockquote><p>' + inline(b.quote) + '</p>' + (b.cite ? '<cite>' + inline(b.cite) + '</cite>' : '') + '</blockquote>';
      if (b.image) return '<figure><img src="' + esc(media(b.image)) + '" alt="' + esc(b.alt || '') + '" loading="lazy">' + (b.caption ? '<figcaption>' + inline(b.caption) + '</figcaption>' : '') + '</figure>';
      if (b.video) return '<figure><video controls playsinline preload="metadata" src="' + esc(media(b.video)) + '"' + (b.poster ? ' poster="' + esc(media(b.poster)) + '"' : '') + ' aria-label="' + esc(b.alt || b.caption || 'Video') + '"></video>' + (b.caption ? '<figcaption>' + inline(b.caption) + '</figcaption>' : '') + '</figure>';
      if (b.callout) return '<aside class="callout"><p>' + inline(b.callout) + '</p></aside>';
      if (b.stats) return '<div class="work-stats">' + b.stats.map(function (s) { return '<div><p class="card__figure">' + inline(s.figure) + '</p><p class="small muted">' + inline(s.label) + '</p></div>'; }).join('') + '</div>';
      return '';
    }).join('\n');
  }
  function scorecard(rows) {
    return '<div class="table-wrap"><table class="table"><thead><tr><th>Measure</th><th>Baseline</th><th>After</th><th>Target</th><th>Status</th></tr></thead><tbody>' +
      rows.map(function (r) { return '<tr><td>' + inline(r.measure) + '</td><td>' + esc(r.baseline == null ? '—' : r.baseline) + '</td><td>' + esc(r.after == null ? '—' : r.after) + '</td><td>' + esc(r.target == null ? '—' : r.target) + '</td><td>' + esc(r.status || '') + '</td></tr>'; }).join('') + '</tbody></table></div>';
  }

  /* ---------- item page ---------- */
  function renderItem(e) {
    var meta = [label(e), e.date && fmtDate(e.date)].filter(Boolean).join(' · ');
    var side = e.hero_stat
      ? '<article class="card card--tint"><p class="card__eyebrow">' + inline(e.hero_stat.label) + '</p><p class="card__figure">' + esc(e.hero_stat.figure) + '</p>' + (e.hero_stat.note ? '<p class="card__body">' + inline(e.hero_stat.note) + '</p>' : '') + '</article>'
      : '<article class="card card--tint"><p class="card__eyebrow">At a glance</p><p class="card__body">' + [e.client && '<strong>Client</strong> ' + inline(e.client), e.status && '<strong>Status</strong> ' + esc(e.status), e.duration && '<strong>Duration</strong> ' + inline(e.duration)].filter(Boolean).join('<br>') + '</p></article>';
    var spec = e.spec ? '<section class="section section--alt" aria-label="Summary"><div class="container-wide"><div class="grid grid--bento"><article class="card card--dark"><p class="card__eyebrow">' + esc(e.client || 'xGold Tech') + '</p><h2 class="title-card card__title">' + inline(e.spec_title || 'In five fields.') + '</h2><dl class="spec">' + SPEC.map(function (f) { return '<dt>' + f[1] + '</dt><dd>' + inline(e.spec[f[0]]) + '</dd>'; }).join('') + '</dl></article>' + side + '</div></div></section>' : '';
    var body = e.body && e.body.length ? '<section class="section" aria-label="Article"><div class="container-wide"><div class="prose work-prose">' + blocks(e.body) + '</div></div></section>' : '';
    var score = e.scorecard && e.scorecard.length ? '<section class="section section--alt" aria-labelledby="score-title"><div class="container-wide"><div class="section-head"><div class="section-head__text"><h2 id="score-title" class="title-section">The scorecard.</h2>' + (e.scorecard_note ? '<p class="section-head__lede">' + inline(e.scorecard_note) + '</p>' : '') + '</div></div><div class="grid grid--bento"><article class="card">' + scorecard(e.scorecard) + '</article><article class="card card--dark"><p class="card__eyebrow">The decision</p><h3 class="title-card card__title">' + inline((e.decision && e.decision.title) || 'Expand, improve or stop.') + '</h3><p class="card__body">' + inline((e.decision && e.decision.body) || '') + '</p>' + (e.decision && e.decision.signed ? '<p class="card__stat"><strong>Signed by</strong> ' + inline(e.decision.signed) + '</p>' : '') + '</article></div></div></section>' : '';
    var src = (e.sources && e.sources.length) || e.evidence ? '<section class="section" aria-labelledby="src-title"><div class="container-wide"><div class="prose"><h2 id="src-title" class="title-card">Sources and evidence.</h2>' + (e.sources && e.sources.length ? '<ol class="work-sources">' + e.sources.map(function (s) { return '<li><a href="' + esc(safeUrl(s.url)) + '" target="_blank" rel="noopener noreferrer" data-umami-event="source-click">' + inline(s.label) + '</a>' + (s.note ? ' <span class="muted">· ' + inline(s.note) + '</span>' : '') + '</li>'; }).join('') + '</ol>' : '') + (e.evidence ? '<p class="small muted" style="margin-top: var(--space-5)">' + inline(e.evidence) + '</p>' : '') + '</div></div></section>' : '';
    var back = e.section === 'research' ? ['research.html', 'Research'] : ['solutions.html', 'Solutions in action'];
    return '<section class="page-head" aria-labelledby="page-title"><div class="container-wide"><div class="section-head" style="margin-bottom:0"><div class="section-head__text"><p class="page-head__eyebrow"><a href="' + back[0] + '">' + back[1] + '</a> · ' + esc(meta) + '</p><h1 id="page-title" class="title-page">' + inline(e.title) + '</h1><p class="page-head__lede">' + inline(e.summary) + '</p></div></div></div></section>' + spec + body + score + src;
  }
  function loadItem(root) {
    var q = new URLSearchParams(location.search), section = q.get('s'), slug = q.get('i');
    var fail = function () { root.innerHTML = '<section class="page-head"><div class="container-wide"><div class="section-head__text"><h1 class="title-page">Not found.</h1><p class="page-head__lede">That item is not available. <a class="link" href="research.html">Research</a> · <a class="link" href="solutions.html">Solutions in action</a></p></div></div></section>'; };
    if (!/^[a-z]+$/.test(section || '') || !/^[a-z0-9-]+$/.test(slug || '')) return fail();
    get('/items/feed_items?filter[section][_eq]=' + section + '&filter[slug][_eq]=' + slug + '&fields=doc&limit=1')
      .then(function (rows) {
        if (!rows.length) return fail();
        var doc = rows[0].doc;
        document.title = doc.title + ' | xGold Tech';
        var d = document.querySelector('meta[name="description"]'); if (d) d.content = doc.summary;
        root.innerHTML = renderItem(doc);
      }).catch(function () { root.innerHTML = '<section class="page-head"><div class="container-wide"><p class="page-head__lede">This could not load. Reload the page, or try again shortly.</p></div></section>'; });
  }

  /* ---------- feed list ---------- */
  function card(r, i) {
    var c = r.card || {}, href = 'item.html?s=' + encodeURIComponent(r.section) + '&i=' + encodeURIComponent(r.slug);
    return '<article class="card card--link feed-card ' + (i === 0 ? 'card--dark' : 'card--alt') + '">' +
      '<p class="card__eyebrow">' + esc(label(c) || r.section) + '</p>' +
      '<h3 class="title-card card__title"><a class="card__cover" href="' + href + '" data-umami-event="feed-open" data-umami-event-slug="' + esc(r.slug) + '">' + inline(r.title) + '</a></h3>' +
      '<p class="card__body">' + inline(r.summary) + '</p>' +
      (c.hero_stat ? '<p class="card__stat"><strong>' + esc(c.hero_stat.figure) + '</strong> ' + inline(c.hero_stat.label) + '</p>' : '') +
      '<div class="card__foot"><span class="fine">' + esc(fmtDate(r.date)) + '</span><span class="link small">Read</span></div>' +
      (c.cover ? '<img class="feed-card__media" src="' + esc(media(c.cover)) + '" alt="" loading="lazy">' : '') + '</article>';
  }
  function loadList(root) {
    var section = root.getAttribute('data-feed');
    get('/items/feed_items?filter[section][_eq]=' + section + '&fields=slug,section,title,summary,date,card&sort=-date,-updated_at&limit=100')
      .then(function (rows) {
        root.setAttribute('aria-busy', 'false');
        root.innerHTML = rows.length ? rows.map(card).join('') : '<p class="muted">Nothing published yet.</p>';
      }).catch(function () {
        root.setAttribute('aria-busy', 'false');
        root.innerHTML = '<p class="muted">The feed could not load. Reload the page, or try again shortly.</p>';
      });
  }

  var list = document.querySelector('[data-feed]'), item = document.querySelector('[data-item]');
  if (list) loadList(list);
  if (item) loadItem(item);
})();
