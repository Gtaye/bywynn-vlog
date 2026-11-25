/* Event vlog — page logic. No dependencies, no network calls of its own.
   Every string from the event data passes through esc() before it touches HTML. */
(function () {
  'use strict';

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }

  var YT_ID = /^[A-Za-z0-9_-]{6,20}$/;
  var VIMEO_ID = /^\d{6,12}$/;
  var MEDIA_PATH = /^media\/[a-z0-9-]+\/[A-Za-z0-9_-]+\.(jpe?g|png|webp)$/i;

  /** Build the embed URL. Returns null for anything that isn't a clean id on an allowed provider. */
  function videoEmbedSrc(provider, id) {
    if (provider === 'youtube' && YT_ID.test(id)) return 'https://www.youtube-nocookie.com/embed/' + id + '?autoplay=1&rel=0';
    if (provider === 'vimeo' && VIMEO_ID.test(id)) return 'https://player.vimeo.com/video/' + id + '?autoplay=1';
    return null;
  }

  function safeMedia(p) { return MEDIA_PATH.test(p) ? p : ''; }

  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  function dateParts(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return null;
    var d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
    return { day: +m[3], month: MONTHS[+m[2] - 1], year: m[1], weekday: DAYS[d.getUTCDay()], short: MONTHS[+m[2] - 1].slice(0, 3) };
  }

  function fmtDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return esc(iso);
    var months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return months[+m[2] - 1] + ' ' + (+m[3]) + ', ' + m[1];
  }

  /* Posters are always local: a video hero uses the first gallery photo. No request leaves the site until play is pressed. */
  function posterFor(ev) {
    var h = ev.hero || {};
    if (h.type === 'image') return safeMedia(h.src);
    var g = Array.isArray(ev.gallery) ? ev.gallery : [];
    return g.length ? safeMedia(g[0]) : '';
  }

  /* The build already drops anyone without consent and strips the flag before publishing,
     so published attendees have no consent field. Still refuse anyone explicitly marked false. */
  function consented(ev) {
    return (Array.isArray(ev.attendees) ? ev.attendees : []).filter(function (a) { return a && a.consent !== false && a.name; });
  }

  function pill(ev) {
    var pub = ev.eventType === 'public';
    return '<span class="badge' + (pub ? ' badge--outline' : '') + '">' + (pub ? 'Open to all' : 'Invite only') + '</span>';
  }

  /* The newest evening, set like an engraved invitation: the date numeral is the one loud thing on the page. */
  function renderFeature(ev) {
    var poster = posterFor(ev);
    var d = dateParts(ev.date);
    return '' +
      '<button class="feature" data-slug="' + esc(ev.slug) + '" aria-label="Open recap: ' + esc(ev.title) + '">' +
        '<div class="feature__media">' + (poster ? '<img src="' + esc(poster) + '" alt="">' : '') + '</div>' +
        '<div class="feature__body">' +
          (d ? '<p class="numeral" aria-hidden="true">' + d.day + '</p>' +
               '<p class="feature__when">' + esc(d.weekday) + ', ' + esc(d.month) + ' ' + esc(d.year) + '</p>'
             : '<p class="feature__when">' + fmtDate(ev.date) + '</p>') +
          '<h2>' + esc(ev.title) + '</h2>' +
          '<p class="feature__venue">' + esc(ev.venue) + '</p>' +
          '<div class="feature__foot">' + pill(ev) + '<span class="btn">Read the recap</span></div>' +
        '</div>' +
      '</button>';
  }

  /* Earlier evenings are ledger rows, not more cards. */
  function renderCard(ev) {
    var d = dateParts(ev.date);
    return '' +
      '<li><button class="row" data-slug="' + esc(ev.slug) + '" aria-label="Open recap: ' + esc(ev.title) + '">' +
        '<span class="row__date">' + (d ? '<b>' + d.day + '</b> ' + esc(d.short) + ' ' + esc(d.year) : fmtDate(ev.date)) + '</span>' +
        '<span class="row__title">' + esc(ev.title) + '</span>' +
        '<span class="row__venue">' + esc(ev.venue) + '</span>' +
      '</button></li>';
  }

  function renderFeed(events) {
    if (!events.length) {
      return '<div class="empty">' +
        '<h1>The first evening is being written.</h1>' +
        '<p>Recaps from every event will live here: the people, the room, and the moments worth keeping.</p></div>';
    }
    var rest = events.slice(1);
    return renderFeature(events[0]) +
      (rest.length ? '<section class="ledger" aria-label="Earlier evenings"><h2 class="section-title">Earlier evenings</h2><ul class="rows">' +
        rest.map(renderCard).join('') + '</ul></section>' : '');
  }

  function renderHero(ev) {
    var h = ev.hero || {};
    if (h.type === 'video') {
      var provider = h.youtubeId ? 'youtube' : 'vimeo';
      var id = h.youtubeId || h.vimeoId || '';
      if (!videoEmbedSrc(provider, id)) return '';
      var poster = posterFor(ev);
      return '<div class="hero">' +
        '<button class="hero__poster" data-video-id="' + esc(id) + '" data-provider="' + provider + '" aria-label="Play video">' +
          (poster ? '<img src="' + esc(poster) + '" alt="">' : '') +
          '<span class="play" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg></span>' +
        '</button></div>';
    }
    var src = safeMedia(h.src);
    return src ? '<div class="hero"><img src="' + esc(src) + '" alt=""></div>' : '';
  }

  function recapDate(iso) {
    var d = dateParts(iso);
    return d ? esc(d.weekday) + ', ' + d.day + ' ' + esc(d.month) + ' ' + esc(d.year) : fmtDate(iso);
  }

  function renderRecap(ev) {
    var people = consented(ev);
    var sponsors = Array.isArray(ev.sponsors) ? ev.sponsors : [];
    var gallery = (Array.isArray(ev.gallery) ? ev.gallery : []).map(safeMedia).filter(Boolean);
    var highlights = Array.isArray(ev.highlights) ? ev.highlights : [];

    var side = '';
    if (people.length) {
      side += '<div class="card"><h3>Who was there</h3><ul class="people">' +
        people.map(function (p) {
          return '<li><span class="avatar" aria-hidden="true">' + esc(String(p.name).trim().charAt(0).toUpperCase()) + '</span>' +
            '<div><b>' + esc(p.name) + '</b><span>' + esc(p.title) + ', ' + esc(p.org) + '</span></div></li>';
        }).join('') + '</ul></div>';
    }
    if (sponsors.length) {
      side += '<div class="card"><h3>Presented with</h3>' +
        sponsors.map(function (s) { return '<div class="sponsor"><b>' + esc(s.name) + '</b><p>' + esc(s.blurb) + '</p></div>'; }).join('') +
        '</div>';
    }

    return '' +
      '<a class="back" href="#" data-home><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>All evenings</a>' +
      '<div class="recap__head">' +
        '<h1>' + esc(ev.title) + '</h1>' +
        '<div class="recap__meta">' + pill(ev) + '<span>' + recapDate(ev.date) + '</span><span>' + esc(ev.venue) + '</span></div>' +
      '</div>' +
      renderHero(ev) +
      '<div class="recap__grid">' +
        '<div><p class="summary">' + esc(ev.summary) + '</p>' +
          (highlights.length ? '<ul class="highlights">' + highlights.map(function (h) { return '<li>' + esc(h) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' +
        '<aside class="side">' + side + '</aside>' +
      '</div>' +
      (gallery.length ? '<section class="gallery"><h2 class="section-title">From the evening</h2><div class="gallery__row">' +
        gallery.map(function (g) { return '<img src="' + esc(g) + '" alt="" loading="lazy">'; }).join('') + '</div></section>' : '');
  }

  // Expose pure functions for tests.
  window.__vlog = { renderCard: renderCard, renderRecap: renderRecap, renderFeed: renderFeed, videoEmbedSrc: videoEmbedSrc, esc: esc };

  if (typeof document === 'undefined') return;

  // ---------- DOM wiring ----------
  var events = [];
  try { events = JSON.parse(document.getElementById('events').textContent) || []; } catch (e) { events = []; }
  var bySlug = Object.create(null);
  events.forEach(function (ev) { bySlug[ev.slug] = ev; });

  var siteName = document.title; /* set from site.json by the build */
  var feedEl = document.getElementById('feed');
  var recapEl = document.getElementById('recap');

  function showFeed() {
    recapEl.hidden = true; recapEl.innerHTML = '';
    feedEl.hidden = false;
    if (!feedEl.innerHTML) feedEl.innerHTML = renderFeed(events);
    document.title = siteName;
  }

  function showRecap(slug) {
    var ev = bySlug[slug];
    if (!ev) return showFeed();
    feedEl.hidden = true;
    recapEl.innerHTML = renderRecap(ev);
    recapEl.hidden = false;
    document.title = ev.title + ' — ' + siteName;
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function route() {
    var slug = '';
    try { slug = decodeURIComponent(location.hash.replace(/^#/, '')); } catch (e) { slug = ''; }
    if (slug && bySlug[slug]) showRecap(slug); else showFeed();
  }

  document.addEventListener('click', function (e) {
    var card = e.target.closest('[data-slug]');
    if (card) { e.preventDefault(); location.hash = card.getAttribute('data-slug'); return; }
    var home = e.target.closest('[data-home]');
    if (home) { e.preventDefault(); history.pushState(null, '', location.pathname); route(); return; }
    var poster = e.target.closest('[data-video-id]');
    if (poster) {
      var src = videoEmbedSrc(poster.getAttribute('data-provider'), poster.getAttribute('data-video-id'));
      if (!src) return;
      var frame = document.createElement('iframe');
      frame.src = src;
      frame.setAttribute('allow', 'autoplay; fullscreen; picture-in-picture');
      frame.setAttribute('allowfullscreen', '');
      frame.setAttribute('referrerpolicy', 'strict-origin-when-cross-origin');
      frame.setAttribute('title', 'Event video');
      poster.replaceWith(frame);
    }
  });

  window.addEventListener('hashchange', route);
  /* Every fresh visit opens on the home screen, at the top. */
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  if (location.hash) history.replaceState(null, '', location.pathname);
  route();
  window.scrollTo(0, 0);
})();
