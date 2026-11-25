'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateEvent, MAX_PHOTOS, MAX_PHOTO_BYTES, SLUG_RE } = require('./validate');

const SLUG = '2026-01-10-sample-evening';
const KB = 1024;

function fixture(overrides = {}) {
  return {
    slug: SLUG,
    title: 'Sample Evening — The Obsidian Room',
    date: '2026-01-10',
    venue: 'The Obsidian Room, Downtown',
    eventType: 'private',
    hero: { type: 'video', youtubeId: 'dQw4w9WgXcQ' },
    summary: 'An evening written for the people who were not in the room.',
    highlights: ['Keynote from a founder', 'Mingling on the terrace', 'A toast at midnight'],
    attendees: [{ name: 'Amara Okafor', title: 'Founder', org: 'Okafor Capital', consent: true }],
    sponsors: [{ name: 'Lumen Wealth', blurb: 'Private banking for builders.' }],
    gallery: [`media/${SLUG}/01.jpg`],
    ...overrides,
  };
}

function sizes(bytes = 100 * KB, paths = [`media/${SLUG}/01.jpg`]) {
  return new Map(paths.map((p) => [p, bytes]));
}

test('constants are exported with spec values', () => {
  assert.equal(MAX_PHOTOS, 30);
  assert.equal(MAX_PHOTO_BYTES, 400 * KB);
  assert.ok(SLUG_RE.test(SLUG));
  assert.ok(!SLUG_RE.test('Bad Slug'));
});

test('valid event returns []', () => {
  assert.deepEqual(validateEvent(fixture(), { fileSizes: sizes() }), []);
});

test('missing required field is reported by name', () => {
  const ev = fixture();
  delete ev.title;
  const errs = validateEvent(ev, { fileSizes: sizes() });
  assert.ok(errs.some((e) => e.includes('title')), errs.join('\n'));
});

test('bad slug is rejected', () => {
  const errs = validateEvent(fixture({ slug: 'Not A Slug' }), { fileSizes: sizes() });
  assert.ok(errs.some((e) => e.includes('slug')), errs.join('\n'));
});

test('bad eventType is rejected', () => {
  const errs = validateEvent(fixture({ eventType: 'secret' }), { fileSizes: sizes() });
  assert.ok(errs.some((e) => e.includes('eventType')), errs.join('\n'));
});

test('attendee without consent is rejected and named', () => {
  for (const attendee of [
    { name: 'No Consent', title: 'CEO', org: 'X', consent: false },
    { name: 'No Consent', title: 'CEO', org: 'X' },
  ]) {
    const errs = validateEvent(fixture({ attendees: [attendee] }), { fileSizes: sizes() });
    assert.ok(errs.some((e) => e.includes('No Consent') && e.includes('consent')), errs.join('\n'));
  }
});

test('hero video id must be an id, not a url', () => {
  const errs = validateEvent(fixture({ hero: { type: 'video', youtubeId: 'https://evil.example/x' } }), { fileSizes: sizes() });
  assert.ok(errs.some((e) => e.includes('youtubeId')), errs.join('\n'));
  const vimeoOk = validateEvent(fixture({ hero: { type: 'video', vimeoId: '123456789' } }), { fileSizes: sizes() });
  assert.deepEqual(vimeoOk, []);
  const both = validateEvent(fixture({ hero: { type: 'video', youtubeId: 'dQw4w9WgXcQ', vimeoId: '123456789' } }), { fileSizes: sizes() });
  assert.ok(both.length > 0);
});

test('hero image must point inside the event media folder', () => {
  const ok = validateEvent(fixture({ hero: { type: 'image', src: `media/${SLUG}/01.jpg` } }), { fileSizes: sizes() });
  assert.deepEqual(ok, []);
  const bad = validateEvent(fixture({ hero: { type: 'image', src: 'https://x/1.jpg' } }), { fileSizes: sizes() });
  assert.ok(bad.some((e) => e.includes('hero')), bad.join('\n'));
});

test('gallery path outside media/<slug>/ is rejected', () => {
  for (const p of ['media/other-slug/01.jpg', '../x.jpg', 'https://x/1.jpg', `media/${SLUG}/../../x.jpg`]) {
    const errs = validateEvent(fixture({ gallery: [p] }), { fileSizes: sizes(100 * KB, [p]) });
    assert.ok(errs.some((e) => e.includes(p)), `expected error for ${p}: ${errs.join('\n')}`);
  }
});

test('gallery over 30 photos is rejected', () => {
  const paths = Array.from({ length: 31 }, (_, i) => `media/${SLUG}/${String(i + 1).padStart(2, '0')}.jpg`);
  const errs = validateEvent(fixture({ gallery: paths }), { fileSizes: sizes(100 * KB, paths) });
  assert.ok(errs.some((e) => e.includes('30')), errs.join('\n'));
});

test('photo over 400 KB is rejected and named', () => {
  const errs = validateEvent(fixture(), { fileSizes: sizes(500 * KB) });
  assert.ok(errs.some((e) => e.includes(`media/${SLUG}/01.jpg`)), errs.join('\n'));
});

test('gallery file missing from disk is rejected and named', () => {
  const errs = validateEvent(fixture(), { fileSizes: new Map() });
  assert.ok(errs.some((e) => e.includes(`media/${SLUG}/01.jpg`)), errs.join('\n'));
});

test('non-object input does not throw', () => {
  assert.ok(validateEvent(null, { fileSizes: new Map() }).length > 0);
  assert.ok(validateEvent('x', { fileSizes: new Map() }).length > 0);
});

// ---- Review fix pass ----
function info(overrides = {}, paths = [`media/${SLUG}/01.jpg`]) {
  return new Map(paths.map((p) => [p, { size: 100 * KB, width: 1600, height: 1200, hasExif: false, isFile: true, isImage: true, ...overrides }]));
}

test('unknown fields are rejected by name at every level', () => {
  const cases = [
    [{ internalNotes: 'x' }, 'internalNotes'],
    [{ hero: { type: 'video', youtubeId: 'dQw4w9WgXcQ', note: 'x' } }, 'hero.note'],
    [{ attendees: [{ name: 'A', title: 'B', org: 'C', consent: true, email: 'a@b.c' }] }, 'attendees[0].email'],
    [{ sponsors: [{ name: 'A', blurb: 'B', contact: 'x' }] }, 'sponsors[0].contact'],
  ];
  for (const [over, key] of cases) {
    const errs = validateEvent(fixture(over), { files: info() });
    assert.ok(errs.some((e) => e.includes(key) && e.toLowerCase().includes('unknown')), `${key}: ${errs.join('\n')}`);
  }
});

test('files accepts rich info and still passes a clean event', () => {
  assert.deepEqual(validateEvent(fixture(), { files: info() }), []);
});

test('symlink or non-regular file is rejected', () => {
  const errs = validateEvent(fixture(), { files: info({ isFile: false }) });
  assert.ok(errs.some((e) => e.includes('01.jpg') && e.includes('regular file')), errs.join('\n'));
});

test('photo with Exif metadata is rejected with stripping advice', () => {
  const errs = validateEvent(fixture(), { files: info({ hasExif: true }) });
  assert.ok(errs.some((e) => e.includes('01.jpg') && /exif/i.test(e) && /strip/i.test(e)), errs.join('\n'));
});

test('photo wider than 1600px is rejected', () => {
  const errs = validateEvent(fixture(), { files: info({ width: 1601 }) });
  assert.ok(errs.some((e) => e.includes('01.jpg') && e.includes('1600')), errs.join('\n'));
});

test('file that is not a real image is rejected', () => {
  const errs = validateEvent(fixture(), { files: info({ isImage: false }) });
  assert.ok(errs.some((e) => e.includes('01.jpg') && /not a (valid )?(jpeg|png|webp|image)/i.test(e)), errs.join('\n'));
});

test('31st photo error names the file', () => {
  const paths = Array.from({ length: 31 }, (_, i) => `media/${SLUG}/${String(i + 1).padStart(2, '0')}.jpg`);
  const errs = validateEvent(fixture({ gallery: paths }), { files: info({}, paths) });
  assert.ok(errs.some((e) => e.includes('30') && e.includes('31.jpg')), errs.join('\n'));
});
