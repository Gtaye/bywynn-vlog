'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { validateEvent, TOP_KEYS, ATTENDEE_KEYS, SPONSOR_KEYS, HERO_KEYS } = require('./validate');
const { inspectImage } = require('./image');
const { jsonForScript } = require('./html');
const { loadSiteConfig, applySiteConfig, themeCss } = require('./site-config');

const TOKEN = '/*__EVENTS__*/[]';

function readEvents(root) {
  const dir = path.join(root, 'events');
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((file) => {
      let data;
      try {
        data = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
      } catch (e) {
        return { file, data: null, parseError: e.message };
      }
      return { file, data };
    });
}

function mediaInfo(root) {
  const files = new Map();
  const mediaDir = path.join(root, 'media');
  if (!fs.existsSync(mediaDir)) return files;
  for (const slug of fs.readdirSync(mediaDir)) {
    const slugDir = path.join(mediaDir, slug);
    if (!fs.lstatSync(slugDir).isDirectory()) continue;
    for (const f of fs.readdirSync(slugDir)) {
      const full = path.join(slugDir, f);
      const st = fs.lstatSync(full);
      const info = { size: st.size, isFile: st.isFile(), isImage: false, width: undefined, height: undefined, hasExif: false };
      if (info.isFile) {
        const img = inspectImage(fs.readFileSync(full));
        if (img) Object.assign(info, { isImage: true, width: img.width, height: img.height, hasExif: img.hasExif });
      }
      files.set(`media/${slug}/${f}`, info);
    }
  }
  return files;
}

const pick = (obj, keys) => Object.fromEntries(keys.filter((k) => k in obj).map((k) => [k, obj[k]]));

/** The exact shape that reaches the public page. Nothing else is serialized. */
function publicProjection(ev) {
  const out = pick(ev, TOP_KEYS);
  out.hero = pick(ev.hero, HERO_KEYS);
  out.attendees = ev.attendees.filter((a) => a.consent === true).map((a) => pick(a, ATTENDEE_KEYS.filter((k) => k !== 'consent')));
  out.sponsors = ev.sponsors.map((s) => pick(s, SPONSOR_KEYS));
  return out;
}

const SITE_ALLOW = /\.(html|css|js|woff2|txt)$/i;

/**
 * build({ root, outDir }) -> { events: number }
 * Throws an Error listing every validation problem if any event is invalid.
 */
function build({ root = process.cwd(), outDir = path.join(root, 'dist') } = {}) {
  const site = loadSiteConfig(root);
  const files = mediaInfo(root);
  const problems = [];
  const events = [];
  for (const { file, data, parseError } of readEvents(root)) {
    if (parseError) { problems.push(`${file}: not valid JSON (${parseError})`); continue; }
    const errs = validateEvent(data, { files });
    if (data && typeof data === 'object' && data.slug !== undefined && `${data.slug}.json` !== file) {
      errs.push(`slug "${data.slug}" does not match file name "${file}"`);
    }
    if (errs.length) problems.push(...errs.map((e) => `${file}: ${e}`));
    else events.push(data);
  }
  if (problems.length) throw new Error(`Build refused — fix these first:\n${problems.join('\n')}`);

  events.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug < b.slug ? 1 : -1));

  const siteDir = path.join(root, 'site');
  const template = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
  if (!template.includes(TOKEN)) throw new Error(`site/index.html is missing the ${TOKEN} token`);

  fs.rmSync(outDir, { recursive: true, force: true });
  fs.mkdirSync(outDir, { recursive: true });
  fs.cpSync(siteDir, outDir, {
    recursive: true,
    dereference: false,
    filter: (src) => {
      const base = path.basename(src);
      if (base.startsWith('.') || /\.test\.js$/.test(base)) return false;
      return fs.lstatSync(src).isDirectory() || SITE_ALLOW.test(base);
    },
  });
  // Copy only media that a validated event references, and only regular files.
  const referenced = new Set();
  for (const ev of events) {
    for (const p of ev.gallery) referenced.add(p);
    if (ev.hero.type === 'image') referenced.add(ev.hero.src);
  }
  for (const rel of referenced) {
    const info = files.get(rel);
    if (!info || !info.isFile || !info.isImage) throw new Error(`Build refused — "${rel}" is not a publishable image file`);
    const src = path.join(root, rel);
    const dest = path.join(outDir, rel);
    if (!path.resolve(dest).startsWith(path.resolve(outDir) + path.sep)) throw new Error(`Build refused — "${rel}" escapes dist/`);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
  fs.writeFileSync(path.join(outDir, 'index.html'), applySiteConfig(template, site).replace(TOKEN, () => jsonForScript(events.map(publicProjection))));
  fs.writeFileSync(path.join(outDir, 'theme.css'), themeCss(site));
  fs.writeFileSync(path.join(outDir, '.nojekyll'), '');
  return { events: events.length };
}

if (require.main === module) {
  try {
    const { events } = build({ root: path.resolve(__dirname, '..') });
    console.log(`Built dist/ with ${events} event${events === 1 ? '' : 's'}.`);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

module.exports = { build, TOKEN, publicProjection };
