'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Load app.js in a bare sandbox: no document, so only the pure render functions are exercised.
function loadApp() {
  const src = fs.readFileSync(path.join(__dirname, 'app.js'), 'utf8');
  const window = {};
  const ctx = { window, document: undefined, console };
  vm.createContext(ctx);
  vm.runInContext(src, ctx, { filename: 'app.js' });
  return window.__vlog;
}

const ev = {
  slug: '2026-01-10-sample',
  title: 'Sample <b>Evening</b>',
  date: '2026-01-10',
  venue: 'The Obsidian Room',
  eventType: 'private',
  hero: { type: 'video', youtubeId: 'dQw4w9WgXcQ' },
  summary: 'A summary & more.',
  highlights: ['One', 'Two'],
  attendees: [
    { name: 'Amara Okafor', title: 'Founder', org: 'Okafor Capital', consent: true },
    { name: 'Sneaky Person', title: 'CEO', org: 'X', consent: false },
  ],
  sponsors: [{ name: 'Lumen Wealth', blurb: 'Private banking.' }],
  gallery: ['media/2026-01-10-sample/01.jpg'],
};

test('renderCard escapes title', () => {
  const { renderCard } = loadApp();
  const html = renderCard(ev);
  assert.ok(html.includes('&lt;b&gt;Evening&lt;/b&gt;'), html);
  assert.ok(!html.includes('<b>Evening</b>'));
});

test('renderRecap hides attendees without consent', () => {
  const { renderRecap } = loadApp();
  const html = renderRecap(ev);
  assert.ok(html.includes('Amara Okafor'));
  assert.ok(!html.includes('Sneaky Person'));
});

test('renderRecap uses a poster button, not an iframe, before click', () => {
  const { renderRecap } = loadApp();
  const html = renderRecap(ev);
  assert.ok(html.includes('data-video-id="dQw4w9WgXcQ"'));
  assert.ok(html.includes('data-provider="youtube"'));
  assert.ok(!html.includes('<iframe'));
});

test('videoEmbedSrc only ever points at the two allowed hosts', () => {
  const { videoEmbedSrc } = loadApp();
  assert.equal(videoEmbedSrc('youtube', 'dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0');
  assert.equal(videoEmbedSrc('vimeo', '123456789'), 'https://player.vimeo.com/video/123456789?autoplay=1');
  assert.equal(videoEmbedSrc('youtube', '"><script>'), null);
  assert.equal(videoEmbedSrc('other', 'abc123'), null);
});

test('renderFeed shows empty state when there are no events', () => {
  const { renderFeed } = loadApp();
  const html = renderFeed([]);
  assert.ok(html.includes('The first evening is being written.'));
});

test('renderRecap escapes gallery paths and summary', () => {
  const { renderRecap } = loadApp();
  const html = renderRecap({ ...ev, gallery: ['media/2026-01-10-sample/01.jpg" onerror="x'] });
  assert.ok(!html.includes('" onerror="x'));
  assert.ok(html.includes('A summary &amp; more.'));
});

test('no poster or embed ever points off-site before a click', () => {
  const { renderCard, renderRecap } = loadApp();
  const html = renderCard(ev) + renderRecap(ev);
  assert.ok(!/https?:\/\//.test(html.replace(/data-video-id="[^"]*"/g, '')), html);
});

test('renderRecap shows published attendees (build strips the consent flag)', () => {
  const { renderRecap } = loadApp();
  const html = renderRecap({ ...ev, attendees: [{ name: 'Julian Mercer', title: 'Chef-Owner', org: 'Mercer & Vine' }] });
  assert.ok(html.includes('Julian Mercer'));
  assert.ok(html.includes('Who was there'));
});

test('a fresh page load always opens on the home screen', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, 'app.js'), 'utf8');
  assert.match(src, /scrollRestoration\s*=\s*'manual'/);
  assert.match(src, /replaceState\(null, '', location\.pathname\)/);
});
