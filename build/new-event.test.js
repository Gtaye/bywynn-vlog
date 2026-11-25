'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createEvent, syncGallery } = require('./new-event');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vlog-new-'));
const SLUG = '2026-02-14-valentine-salon';

test('createEvent writes a complete json file and a media folder', () => {
  const root = tmp();
  const file = createEvent({ root, slug: SLUG, title: 'Valentine Salon', date: '2026-02-14' });
  assert.equal(file, path.join(root, 'events', `${SLUG}.json`));
  const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(ev.slug, SLUG);
  assert.equal(ev.title, 'Valentine Salon');
  assert.equal(ev.date, '2026-02-14');
  for (const k of ['venue', 'eventType', 'hero', 'summary', 'highlights', 'attendees', 'sponsors', 'gallery']) assert.ok(k in ev, k);
  assert.deepEqual(ev.attendees, []);
  assert.deepEqual(ev.gallery, []);
  assert.deepEqual(ev.hero, { type: 'image', src: `media/${SLUG}/01.jpg` });
  assert.ok(fs.existsSync(path.join(root, 'media', SLUG, 'DROP-PHOTOS-HERE.txt')));
});

test('createEvent refuses an existing slug', () => {
  const root = tmp();
  createEvent({ root, slug: SLUG, title: 'A', date: '2026-02-14' });
  assert.throws(() => createEvent({ root, slug: SLUG, title: 'B', date: '2026-02-14' }), /exists/);
});

test('createEvent rejects a bad slug or date', () => {
  const root = tmp();
  assert.throws(() => createEvent({ root, slug: 'Bad Slug', title: 'A', date: '2026-02-14' }), /slug/);
  assert.throws(() => createEvent({ root, slug: SLUG, title: 'A', date: '14/02/2026' }), /date/);
});

test('syncGallery fills gallery from the folder, sorted, ignoring non-images', () => {
  const root = tmp();
  createEvent({ root, slug: SLUG, title: 'A', date: '2026-02-14' });
  const dir = path.join(root, 'media', SLUG);
  for (const f of ['03.jpg', '01.jpg', '02.webp', 'notes.txt', '.DS_Store', 'logo.svg']) fs.writeFileSync(path.join(dir, f), 'x');
  const gallery = syncGallery({ root, slug: SLUG });
  assert.deepEqual(gallery, [`media/${SLUG}/01.jpg`, `media/${SLUG}/02.webp`, `media/${SLUG}/03.jpg`]);
  const ev = JSON.parse(fs.readFileSync(path.join(root, 'events', `${SLUG}.json`), 'utf8'));
  assert.deepEqual(ev.gallery, gallery);
  assert.equal(ev.hero.src, `media/${SLUG}/01.jpg`);
});

test('syncGallery leaves a video hero alone', () => {
  const root = tmp();
  const file = createEvent({ root, slug: SLUG, title: 'A', date: '2026-02-14' });
  const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
  ev.hero = { type: 'video', youtubeId: 'dQw4w9WgXcQ' };
  fs.writeFileSync(file, JSON.stringify(ev));
  fs.writeFileSync(path.join(root, 'media', SLUG, '01.jpg'), 'x');
  syncGallery({ root, slug: SLUG });
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')).hero, { type: 'video', youtubeId: 'dQw4w9WgXcQ' });
});

const { copyEvent } = require('./new-event');

test('copyEvent starts a new event from an old one, without people or photos', () => {
  const root = tmp();
  const from = createEvent({ root, slug: SLUG, title: 'Valentine Salon', date: '2026-02-14' });
  const old = JSON.parse(fs.readFileSync(from, 'utf8'));
  old.venue = 'The Glasshouse, Downtown';
  old.summary = 'Kept summary';
  old.highlights = ['Kept highlight'];
  old.sponsors = [{ name: 'Lumen', blurb: 'Kept sponsor' }];
  old.attendees = [{ name: 'A', title: 'B', org: 'C', consent: true }];
  old.gallery = [`media/${SLUG}/01.jpg`];
  old.hero = { type: 'video', youtubeId: 'dQw4w9WgXcQ' };
  fs.writeFileSync(from, JSON.stringify(old));

  const NEW = '2026-03-14-spring-salon';
  const file = copyEvent({ root, from: SLUG, slug: NEW, title: 'Spring Salon', date: '2026-03-14' });
  const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
  assert.equal(ev.slug, NEW);
  assert.equal(ev.title, 'Spring Salon');
  assert.equal(ev.date, '2026-03-14');
  assert.equal(ev.venue, 'The Glasshouse, Downtown');
  assert.equal(ev.summary, 'Kept summary');
  assert.deepEqual(ev.highlights, ['Kept highlight']);
  assert.deepEqual(ev.sponsors, [{ name: 'Lumen', blurb: 'Kept sponsor' }]);
  assert.deepEqual(ev.attendees, [], 'consent is per event, so people are never copied');
  assert.deepEqual(ev.gallery, []);
  assert.deepEqual(ev.hero, { type: 'image', src: `media/${NEW}/01.jpg` });
  assert.ok(fs.existsSync(path.join(root, 'media', NEW, 'DROP-PHOTOS-HERE.txt')));
});

test('copyEvent refuses a missing source or an existing target', () => {
  const root = tmp();
  assert.throws(() => copyEvent({ root, from: SLUG, slug: '2026-03-14-x', title: 'X', date: '2026-03-14' }), /no event/);
  createEvent({ root, slug: SLUG, title: 'A', date: '2026-02-14' });
  assert.throws(() => copyEvent({ root, from: SLUG, slug: SLUG, title: 'B', date: '2026-02-14' }), /exists/);
});
