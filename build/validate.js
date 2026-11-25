'use strict';

const SLUG_RE = /^\d{4}-\d{2}-\d{2}-[a-z0-9-]+$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const YOUTUBE_ID_RE = /^[A-Za-z0-9_-]{6,20}$/;
const VIMEO_ID_RE = /^\d{6,12}$/;
const IMAGE_EXT_RE = /\.(jpe?g|png|webp)$/i;
const MAX_PHOTOS = 30;
const MAX_PHOTO_BYTES = 400 * 1024;
const MAX_HIGHLIGHTS = 6;
const MAX_PHOTO_WIDTH = 1600;
const TOP_KEYS = ['slug','title','date','venue','eventType','hero','summary','highlights','attendees','sponsors','gallery'];
const HERO_KEYS = ['type','youtubeId','vimeoId','src'];
const ATTENDEE_KEYS = ['name','title','org','consent'];
const SPONSOR_KEYS = ['name','blurb'];
const EVENT_TYPES = ['public', 'private'];

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;

function rejectUnknown(obj, allowed, label, errors) {
  if (!obj || typeof obj !== 'object') return;
  for (const k of Object.keys(obj)) {
    if (!allowed.includes(k)) errors.push(`${label}${label ? '.' : ''}${k}: unknown field — only ${allowed.join(', ')} are published`);
  }
}

/**
 * Is `p` a safe relative path inside media/<slug>/ ?
 * Rejects URLs, absolute paths, dot segments, backslashes and non-image extensions.
 */
function isMediaPathFor(slug, p) {
  if (!isStr(p)) return false;
  if (p.includes('\\') || p.includes('\0')) return false;
  const parts = p.split('/');
  if (parts.length !== 3) return false;
  if (parts[0] !== 'media' || parts[1] !== slug) return false;
  const file = parts[2];
  if (!file || file === '.' || file === '..' || file.startsWith('.')) return false;
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9]+$/.test(file)) return false;
  return IMAGE_EXT_RE.test(file);
}

function checkHero(ev, errors) {
  const h = ev.hero;
  if (!h || typeof h !== 'object') return errors.push('hero: required object');
  rejectUnknown(h, HERO_KEYS, 'hero', errors);
  if (h.type === 'video') {
    const hasYt = h.youtubeId !== undefined;
    const hasVm = h.vimeoId !== undefined;
    if (hasYt === hasVm) return errors.push('hero: video needs exactly one of youtubeId or vimeoId');
    if (hasYt && !(isStr(h.youtubeId) && YOUTUBE_ID_RE.test(h.youtubeId))) errors.push(`hero.youtubeId: must be a bare video id, got "${h.youtubeId}"`);
    if (hasVm && !(isStr(h.vimeoId) && VIMEO_ID_RE.test(h.vimeoId))) errors.push(`hero.vimeoId: must be a bare numeric id, got "${h.vimeoId}"`);
    return;
  }
  if (h.type === 'image') {
    if (!isMediaPathFor(ev.slug, h.src)) errors.push(`hero.src: must be an image inside media/${ev.slug}/, got "${h.src}"`);
    return;
  }
  errors.push('hero.type: must be "video" or "image"');
}

function checkPeople(ev, errors) {
  if (!Array.isArray(ev.attendees)) return errors.push('attendees: must be an array');
  ev.attendees.forEach((a, i) => {
    if (!a || typeof a !== 'object') return errors.push(`attendees[${i}]: must be an object`);
    rejectUnknown(a, ATTENDEE_KEYS, `attendees[${i}]`, errors);
    for (const f of ['name', 'title', 'org']) if (!isStr(a[f])) errors.push(`attendees[${i}].${f}: required`);
    if (a.consent !== true) errors.push(`attendees[${i}] "${a.name ?? '?'}": consent must be exactly true to be published`);
  });
  if (!Array.isArray(ev.sponsors)) return errors.push('sponsors: must be an array');
  ev.sponsors.forEach((s, i) => {
    if (!s || typeof s !== 'object') return errors.push(`sponsors[${i}]: must be an object`);
    rejectUnknown(s, SPONSOR_KEYS, `sponsors[${i}]`, errors);
    for (const f of ['name', 'blurb']) if (!isStr(s[f])) errors.push(`sponsors[${i}].${f}: required`);
  });
}

function checkGallery(ev, files, errors) {
  if (!Array.isArray(ev.gallery)) return errors.push('gallery: must be an array');
  if (ev.gallery.length > MAX_PHOTOS) {
    const extra = ev.gallery.slice(MAX_PHOTOS).map((p) => `"${p}"`).join(', ');
    errors.push(`gallery: ${ev.gallery.length} photos exceeds the maximum of ${MAX_PHOTOS} — remove ${extra}`);
  }
  const refs = [...ev.gallery];
  if (ev.hero && ev.hero.type === 'image' && isStr(ev.hero.src)) refs.push(ev.hero.src);
  for (const p of ev.gallery) {
    if (!isMediaPathFor(ev.slug, p)) errors.push(`gallery: "${p}" must be an image path inside media/${ev.slug}/`);
  }
  for (const p of new Set(refs)) {
    if (!isMediaPathFor(ev.slug, p)) continue;
    const raw = files.get(p);
    if (raw === undefined) { errors.push(`gallery: "${p}" not found on disk`); continue; }
    const f = typeof raw === 'number' ? { size: raw } : raw;
    if (f.isFile === false) { errors.push(`gallery: "${p}" is not a regular file (symlinks and folders are not published)`); continue; }
    if (f.size > MAX_PHOTO_BYTES) errors.push(`gallery: "${p}" is ${(f.size / 1024).toFixed(1)} KB, over the ${MAX_PHOTO_BYTES / 1024} KB limit`);
    if (f.isImage === false) { errors.push(`gallery: "${p}" is not a valid JPEG, PNG or WebP image`); continue; }
    if (f.hasExif === true) errors.push(`gallery: "${p}" contains Exif metadata (may include GPS location) — strip it before publishing (e.g. export without metadata, or run: exiftool -all= file.jpg)`);
    if (typeof f.width === 'number' && f.width > MAX_PHOTO_WIDTH) errors.push(`gallery: "${p}" is ${f.width}px wide, over the ${MAX_PHOTO_WIDTH}px limit — export at ${MAX_PHOTO_WIDTH}px wide`);
  }
}

/**
 * validateEvent(event, { fileSizes }) -> string[]  (empty = valid). Never throws.
 */
function validateEvent(ev, opts = {}) {
  const files = opts.files instanceof Map ? opts.files : opts.fileSizes instanceof Map ? opts.fileSizes : new Map();
  const errors = [];
  if (!ev || typeof ev !== 'object' || Array.isArray(ev)) return ['event: must be a JSON object'];
  rejectUnknown(ev, TOP_KEYS, '', errors);

  for (const f of ['slug', 'title', 'date', 'venue', 'summary']) if (!isStr(ev[f])) errors.push(`${f}: required non-empty string`);
  if (isStr(ev.slug) && !SLUG_RE.test(ev.slug)) errors.push(`slug: "${ev.slug}" must look like 2026-01-10-short-name (lowercase, digits, hyphens)`);
  if (isStr(ev.date) && !DATE_RE.test(ev.date)) errors.push(`date: "${ev.date}" must be YYYY-MM-DD`);
  if (!EVENT_TYPES.includes(ev.eventType)) errors.push(`eventType: must be one of ${EVENT_TYPES.join(', ')}`);
  if (!Array.isArray(ev.highlights) || ev.highlights.length < 1 || ev.highlights.length > MAX_HIGHLIGHTS || !ev.highlights.every(isStr)) {
    errors.push(`highlights: must be 1–${MAX_HIGHLIGHTS} non-empty strings`);
  }
  if (isStr(ev.slug)) checkHero(ev, errors);
  checkPeople(ev, errors);
  if (isStr(ev.slug)) checkGallery(ev, files, errors);
  return errors;
}

module.exports = { validateEvent, isMediaPathFor, SLUG_RE, MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_PHOTO_WIDTH, MAX_HIGHLIGHTS, IMAGE_EXT_RE, TOP_KEYS, ATTENDEE_KEYS, SPONSOR_KEYS, HERO_KEYS };
