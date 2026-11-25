'use strict';
/*
  Create a new event, or sync an event's gallery from its photo folder.

    node build/new-event.js <slug> "<title>" <YYYY-MM-DD>
    node build/new-event.js --sync <slug>
    node build/new-event.js --copy <from-slug> <new-slug> "<title>" <YYYY-MM-DD>
*/
const fs = require('node:fs');
const path = require('node:path');
const { SLUG_RE, IMAGE_EXT_RE } = require('./validate');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DROP_NOTE = [
  'Drop photos for this event in this folder.',
  'Name them 01.jpg, 02.jpg, 03.jpg ... in the order you want them shown.',
  'Keep each under 400 KB (export at 1600px wide, quality ~80).',
  'Then run:  npm run new-event -- --sync <slug>   (or ask an agent).',
  '',
].join('\n');

function eventFile(root, slug) { return path.join(root, 'events', `${slug}.json`); }
function mediaDir(root, slug) { return path.join(root, 'media', slug); }

function createEvent({ root, slug, title, date }) {
  if (!SLUG_RE.test(slug || '')) throw new Error(`slug "${slug}" must look like 2026-01-10-short-name (lowercase, digits, hyphens)`);
  if (!DATE_RE.test(date || '')) throw new Error(`date "${date}" must be YYYY-MM-DD`);
  if (!title || !String(title).trim()) throw new Error('title is required');
  const file = eventFile(root, slug);
  if (fs.existsSync(file)) throw new Error(`${path.relative(root, file)} already exists`);

  const event = {
    slug,
    title: String(title).trim(),
    date,
    venue: 'Venue name, City',
    eventType: 'private',
    hero: { type: 'image', src: `media/${slug}/01.jpg` },
    summary: 'One paragraph written for someone who was not in the room.',
    highlights: ['A moment worth remembering'],
    attendees: [],
    sponsors: [],
    gallery: [],
  };
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.mkdirSync(mediaDir(root, slug), { recursive: true });
  fs.writeFileSync(path.join(mediaDir(root, slug), 'DROP-PHOTOS-HERE.txt'), DROP_NOTE);
  fs.writeFileSync(file, JSON.stringify(event, null, 2) + '\n');
  return file;
}

/**
 * Start a new event from an old one: keeps venue, type, summary, highlights
 * and sponsors as a starting point. People are never copied (consent is per
 * event) and photos are not copied (each event has its own folder).
 */
function copyEvent({ root, from, slug, title, date }) {
  const src = eventFile(root, from || '');
  if (!SLUG_RE.test(from || '') || !fs.existsSync(src)) throw new Error(`no event file for "${from}" to copy from`);
  const old = JSON.parse(fs.readFileSync(src, 'utf8'));
  const file = createEvent({ root, slug, title, date });
  const ev = JSON.parse(fs.readFileSync(file, 'utf8'));
  for (const k of ['venue', 'eventType', 'summary', 'highlights', 'sponsors']) if (k in old) ev[k] = old[k];
  fs.writeFileSync(file, JSON.stringify(ev, null, 2) + '\n');
  return file;
}

function syncGallery({ root, slug }) {
  const file = eventFile(root, slug);
  if (!fs.existsSync(file)) throw new Error(`no event file for "${slug}" — create it first`);
  const dir = mediaDir(root, slug);
  const photos = fs.existsSync(dir)
    ? fs.readdirSync(dir).filter((f) => !f.startsWith('.') && IMAGE_EXT_RE.test(f) && fs.statSync(path.join(dir, f)).isFile()).sort()
    : [];
  const gallery = photos.map((f) => `media/${slug}/${f}`);
  const event = JSON.parse(fs.readFileSync(file, 'utf8'));
  event.gallery = gallery;
  if (event.hero && event.hero.type === 'image' && gallery.length) event.hero.src = gallery[0];
  fs.writeFileSync(file, JSON.stringify(event, null, 2) + '\n');
  return gallery;
}

if (require.main === module) {
  const root = path.resolve(__dirname, '..');
  const args = process.argv.slice(2);
  try {
    if (args[0] === '--sync') {
      const gallery = syncGallery({ root, slug: args[1] });
      console.log(`Gallery for ${args[1]}: ${gallery.length} photo${gallery.length === 1 ? '' : 's'}.`);
    } else if (args[0] === '--copy' && args.length === 5) {
      const file = copyEvent({ root, from: args[1], slug: args[2], title: args[3], date: args[4] });
      console.log(`Created ${path.relative(root, file)} from ${args[1]} (no people, no photos copied) — edit the copy, drop photos in, then run --sync.`);
    } else if (args.length === 3) {
      const file = createEvent({ root, slug: args[0], title: args[1], date: args[2] });
      console.log(`Created ${path.relative(root, file)} and media/${args[0]}/ — fill in the copy, drop photos in, then run --sync.`);
    } else {
      console.log('Usage:\n  node build/new-event.js <slug> "<title>" <YYYY-MM-DD>\n  node build/new-event.js --sync <slug>\n  node build/new-event.js --copy <from-slug> <new-slug> "<title>" <YYYY-MM-DD>');
      process.exit(2);
    }
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { createEvent, copyEvent, syncGallery };
