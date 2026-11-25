'use strict';
/*
  Site-wide settings: name, tagline, footer and colours, read from site.json
  at the repo root. Change that one file to rebrand the page or to start a
  copy of it for another series. Missing fields fall back to DEFAULTS.
*/
const fs = require('node:fs');
const path = require('node:path');
const { escapeHtml } = require('./html');

const DEFAULTS = Object.freeze({
  name: 'The Evening Ledger',
  tagline: 'Every evening, remembered properly.',
  description: 'Recaps and highlights from every evening.',
  footer: 'Private evenings for people who build things. No cookies, no tracking, nothing collected.',
  colors: Object.freeze({
    background: '#0F1412',
    card: '#151C18',
    accent: '#1B3B2B',
    primary: '#D4AF37',
    foreground: '#F7F5F0',
  }),
});

const TEXT_LIMITS = { name: 60, tagline: 120, description: 200, footer: 240 };
const HEX = /^#[0-9A-Fa-f]{6}$/;

function loadSiteConfig(root) {
  const file = path.join(root, 'site.json');
  if (!fs.existsSync(file)) return DEFAULTS;
  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`site.json is not valid JSON (${e.message})`);
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('site.json must be an object');

  const problems = [];
  for (const k of Object.keys(raw)) {
    if (!(k in TEXT_LIMITS) && k !== 'colors') problems.push(`site.json: unknown field "${k}" (allowed: ${[...Object.keys(TEXT_LIMITS), 'colors'].join(', ')})`);
  }
  for (const [k, max] of Object.entries(TEXT_LIMITS)) {
    if (!(k in raw)) continue;
    const v = raw[k];
    if (typeof v !== 'string' || !v.trim() || v.length > max || /[\r\n]/.test(v)) {
      problems.push(`site.json: "${k}" must be one line of plain text, 1 to ${max} characters`);
    }
  }
  const colors = raw.colors === undefined ? {} : raw.colors;
  if (!colors || typeof colors !== 'object' || Array.isArray(colors)) {
    problems.push('site.json: "colors" must be an object');
  } else {
    for (const [k, v] of Object.entries(colors)) {
      if (!(k in DEFAULTS.colors)) problems.push(`site.json: unknown colour "${k}" (allowed: ${Object.keys(DEFAULTS.colors).join(', ')})`);
      else if (typeof v !== 'string' || !HEX.test(v)) problems.push(`site.json: colour "${k}" must look like #1B3B2B`);
    }
  }
  if (problems.length) throw new Error(problems.join('\n'));

  const out = { ...DEFAULTS, colors: { ...DEFAULTS.colors, ...colors } };
  for (const k of Object.keys(TEXT_LIMITS)) if (k in raw) out[k] = raw[k].trim();
  return out;
}

/** "light" or "dark", from how bright the background colour is. */
function colorScheme(cfg) {
  const n = parseInt(cfg.colors.background.slice(1), 16);
  const lum = 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
  return lum > 140 ? 'light' : 'dark';
}

/** Fill {{name}}, {{tagline}}, {{description}}, {{footer}}, {{colorScheme}} in the page template. */
function applySiteConfig(html, cfg) {
  return html.replace(/\{\{(name|tagline|description|footer|colorScheme)\}\}/g, (_, k) =>
    escapeHtml(k === 'colorScheme' ? colorScheme(cfg) : cfg[k]));
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

/** theme.css: overrides the colour tokens in styles.css. Values are validated hex only. */
function themeCss(cfg) {
  const c = cfg.colors;
  return [
    '/* Generated from site.json by the build. Edit site.json, not this file. */',
    ':root {',
    `  --background: ${c.background};`,
    `  --primary-foreground: ${c.background};`,
    `  --card: ${c.card};`,
    `  --muted: ${c.card};`,
    `  --accent: ${c.accent};`,
    `  --primary: ${c.primary};`,
    `  --ring: ${c.primary};`,
    `  --primary-soft: ${rgba(c.primary, 0.18)};`,
    `  --foreground: ${c.foreground};`,
    `  --card-foreground: ${c.foreground};`,
    `  --accent-foreground: ${c.foreground};`,
    `  --muted-foreground: ${rgba(c.foreground, 0.62)};`,
    `  --subtle-foreground: ${rgba(c.foreground, 0.46)};`,
    `  --border: ${rgba(c.foreground, 0.11)};`,
    `  --input: ${rgba(c.foreground, 0.18)};`,
    '}',
    '',
  ].join('\n');
}

module.exports = { loadSiteConfig, applySiteConfig, themeCss, DEFAULTS };
