'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { escapeHtml } = require('./html');
const { build } = require('./build');
const { jpeg } = require('./fixtures/images');

const FIX = path.join(__dirname, 'fixtures');
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vlog-build-'));

function eventsJson(outDir) {
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  const m = html.match(/<script type="application\/json" id="events">([\s\S]*?)<\/script>/);
  assert.ok(m, 'events json block present');
  return { html, json: JSON.parse(m[1]) };
}

test('escapeHtml escapes all five characters', () => {
  assert.equal(escapeHtml(`&<>"'`), '&amp;&lt;&gt;&quot;&#39;');
  assert.equal(escapeHtml('plain'), 'plain');
});

test('build writes dist with events json and copies media', () => {
  const outDir = tmp();
  const result = build({ root: path.join(FIX, 'good'), outDir });
  assert.equal(result.events, 1);
  const { html, json } = eventsJson(outDir);
  assert.ok(html.includes('id="events"'));
  assert.equal(json.length, 1);
  assert.equal(json[0].title, 'Sample Evening');
  assert.ok(fs.existsSync(path.join(outDir, 'media', '2026-01-10-sample', '01.jpg')));
});

test('build fails on unconsented attendee', () => {
  assert.throws(() => build({ root: path.join(FIX, 'bad-consent'), outDir: tmp() }), /consent/);
});

test('script tag in title cannot break out of the json block', () => {
  const outDir = tmp();
  build({ root: path.join(FIX, 'xss'), outDir });
  const { html, json } = eventsJson(outDir);
  assert.ok(!html.includes('</script><script>alert'), 'raw script tag must not appear');
  assert.equal(json[0].title, '</script><script>alert(1)</script>');
});

test('build with zero events succeeds with empty array', () => {
  const outDir = tmp();
  const result = build({ root: path.join(FIX, 'empty'), outDir });
  assert.equal(result.events, 0);
  assert.deepEqual(eventsJson(outDir).json, []);
});

test('events are sorted newest first', () => {
  const root = tmp();
  fs.mkdirSync(path.join(root, 'events'));
  fs.mkdirSync(path.join(root, 'media'));
  fs.cpSync(path.join(FIX, 'good', 'site'), path.join(root, 'site'), { recursive: true });
  const base = JSON.parse(fs.readFileSync(path.join(FIX, 'good', 'events', '2026-01-10-sample.json'), 'utf8'));
  for (const [slug, date] of [['2026-01-10-a', '2026-01-10'], ['2026-03-05-b', '2026-03-05']]) {
    fs.mkdirSync(path.join(root, 'media', slug));
    fs.writeFileSync(path.join(root, 'media', slug, '01.jpg'), jpeg({ width: 800, height: 600 }));
    const ev = { ...base, slug, date, hero: { type: 'image', src: `media/${slug}/01.jpg` }, gallery: [`media/${slug}/01.jpg`] };
    fs.writeFileSync(path.join(root, 'events', `${slug}.json`), JSON.stringify(ev));
  }
  const outDir = tmp();
  build({ root, outDir });
  assert.deepEqual(eventsJson(outDir).json.map((e) => e.slug), ['2026-03-05-b', '2026-01-10-a']);
});

test('file name must match slug', () => {
  const root = tmp();
  fs.cpSync(path.join(FIX, 'good'), root, { recursive: true });
  fs.renameSync(path.join(root, 'events', '2026-01-10-sample.json'), path.join(root, 'events', '2026-01-10-wrong.json'));
  assert.throws(() => build({ root, outDir: tmp() }), /slug/);
});

// ---- Review fix pass ----

function goodRoot() {
  const root = tmp();
  fs.cpSync(path.join(FIX, 'good'), root, { recursive: true });
  // replace the random-bytes fixture with a real (tiny) jpeg so image checks pass
  fs.writeFileSync(path.join(root, 'media', '2026-01-10-sample', '01.jpg'), jpeg({ width: 1200, height: 900 }));
  return root;
}

test('only referenced, validated media is copied into dist', () => {
  const root = goodRoot();
  const dir = path.join(root, 'media', '2026-01-10-sample');
  fs.writeFileSync(path.join(dir, 'unreferenced.jpg'), jpeg({ width: 10, height: 10 }));
  fs.writeFileSync(path.join(dir, 'raw.HEIC'), 'x');
  fs.mkdirSync(path.join(root, 'media', 'old-unpublished-event'));
  fs.writeFileSync(path.join(root, 'media', 'old-unpublished-event', '01.jpg'), jpeg({ width: 10, height: 10 }));
  const outDir = tmp();
  build({ root, outDir });
  assert.ok(fs.existsSync(path.join(outDir, 'media', '2026-01-10-sample', '01.jpg')));
  assert.ok(!fs.existsSync(path.join(outDir, 'media', '2026-01-10-sample', 'unreferenced.jpg')));
  assert.ok(!fs.existsSync(path.join(outDir, 'media', '2026-01-10-sample', 'raw.HEIC')));
  assert.ok(!fs.existsSync(path.join(outDir, 'media', 'old-unpublished-event')));
});

test('a symlinked photo fails the build and is never copied', () => {
  const root = goodRoot();
  const dir = path.join(root, 'media', '2026-01-10-sample');
  fs.writeFileSync(path.join(root, 'secret.txt'), 'SECRET');
  fs.symlinkSync(path.join(root, 'secret.txt'), path.join(dir, '02.jpg'));
  const evFile = path.join(root, 'events', '2026-01-10-sample.json');
  const ev = JSON.parse(fs.readFileSync(evFile, 'utf8'));
  ev.gallery.push('media/2026-01-10-sample/02.jpg');
  fs.writeFileSync(evFile, JSON.stringify(ev));
  const outDir = tmp();
  assert.throws(() => build({ root, outDir }), /regular file/);
  assert.ok(!fs.existsSync(path.join(outDir, 'media', '2026-01-10-sample', '02.jpg')));
});

test('published json is a whitelisted projection (no unknown or private fields)', () => {
  const root = goodRoot();
  const outDir = tmp();
  build({ root, outDir });
  const { json } = eventsJson(outDir);
  assert.deepEqual(Object.keys(json[0]).sort(), ['attendees', 'date', 'eventType', 'gallery', 'hero', 'highlights', 'slug', 'sponsors', 'summary', 'title', 'venue']);
  assert.deepEqual(Object.keys(json[0].attendees[0]).sort(), ['name', 'org', 'title']);
  assert.ok(!JSON.stringify(json).includes('consent'));
});

test('stray files in site/ are not published', () => {
  const root = goodRoot();
  fs.writeFileSync(path.join(root, 'site', 'notes.md'), 'private');
  fs.writeFileSync(path.join(root, 'site', '.DS_Store'), 'x');
  const outDir = tmp();
  build({ root, outDir });
  assert.ok(!fs.existsSync(path.join(outDir, 'notes.md')));
  assert.ok(!fs.existsSync(path.join(outDir, '.DS_Store')));
});

test('exif-bearing photo fails the build', () => {
  const root = goodRoot();
  fs.writeFileSync(path.join(root, 'media', '2026-01-10-sample', '01.jpg'), jpeg({ width: 10, height: 10, exif: true }));
  assert.throws(() => build({ root, outDir: tmp() }), /Exif/);
});
