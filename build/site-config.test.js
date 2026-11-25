'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { loadSiteConfig, applySiteConfig, themeCss, DEFAULTS } = require('./site-config');
const { build } = require('./build');

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), 'vlog-site-'));
const REPO = path.resolve(__dirname, '..');

test('no site.json means the defaults', () => {
  assert.deepEqual(loadSiteConfig(tmp()), DEFAULTS);
});

test('site.json overrides only the fields it sets', () => {
  const root = tmp();
  fs.writeFileSync(path.join(root, 'site.json'), JSON.stringify({ name: 'Founders Table', colors: { primary: '#C0FFEE' } }));
  const cfg = loadSiteConfig(root);
  assert.equal(cfg.name, 'Founders Table');
  assert.equal(cfg.tagline, DEFAULTS.tagline);
  assert.equal(cfg.colors.primary, '#C0FFEE');
  assert.equal(cfg.colors.background, DEFAULTS.colors.background);
});

test('bad site.json is refused with a clear message', () => {
  const cases = [
    [{ name: '' }, /name/],
    [{ name: 'x'.repeat(61) }, /name/],
    [{ tagline: 'two\nlines' }, /tagline/],
    [{ colors: { primary: 'red' } }, /primary/],
    [{ colors: { primary: '#fff; } body { display:none' } }, /primary/],
    [{ colors: { glow: '#FFFFFF' } }, /glow/],
    [{ logo: 'x.png' }, /logo/],
  ];
  for (const [bad, re] of cases) {
    const root = tmp();
    fs.writeFileSync(path.join(root, 'site.json'), JSON.stringify(bad));
    assert.throws(() => loadSiteConfig(root), re, JSON.stringify(bad));
  }
  const root = tmp();
  fs.writeFileSync(path.join(root, 'site.json'), '{ not json');
  assert.throws(() => loadSiteConfig(root), /site\.json/);
});

test('applySiteConfig escapes text into the page', () => {
  const html = '<title>{{name}}</title><p>{{tagline}}</p><meta content="{{description}}"><footer>{{footer}}</footer>';
  const out = applySiteConfig(html, { ...DEFAULTS, name: '<script>alert(1)</script>', description: 'a "quote"' });
  assert.ok(!out.includes('<script>'));
  assert.ok(out.includes('&lt;script&gt;'));
  assert.ok(out.includes('a &quot;quote&quot;'));
  assert.ok(!out.includes('{{'));
});

test('themeCss writes one :root block from the colours', () => {
  const css = themeCss({ ...DEFAULTS, colors: { ...DEFAULTS.colors, primary: '#123456' } });
  assert.match(css, /:root\s*\{/);
  assert.match(css, /--primary:\s*#123456;/);
  assert.match(css, /--ring:\s*#123456;/);
});

test('build applies site.json: name in page, theme.css in dist', () => {
  const root = tmp();
  fs.cpSync(path.join(REPO, 'site'), path.join(root, 'site'), { recursive: true });
  fs.mkdirSync(path.join(root, 'events'));
  fs.writeFileSync(path.join(root, 'site.json'), JSON.stringify({ name: 'Founders Table', colors: { primary: '#C0FFEE' } }));
  const outDir = path.join(root, 'dist');
  build({ root, outDir });
  const html = fs.readFileSync(path.join(outDir, 'index.html'), 'utf8');
  assert.ok(html.includes('<title>Founders Table</title>'));
  assert.ok(html.includes('href="theme.css"'));
  assert.ok(!html.includes('{{'));
  assert.match(fs.readFileSync(path.join(outDir, 'theme.css'), 'utf8'), /--primary:\s*#C0FFEE;/);
});

test('the repo site.json is valid and matches the live page', () => {
  const cfg = loadSiteConfig(REPO);
  assert.equal(cfg.name, 'Bywynn');
});

test('colour scheme follows the background: light page gets "light"', () => {
  const light = { ...DEFAULTS, colors: { ...DEFAULTS.colors, background: '#FFFFFF' } };
  assert.ok(applySiteConfig('<meta content="{{colorScheme}}">', light).includes('content="light"'));
  assert.ok(applySiteConfig('<meta content="{{colorScheme}}">', DEFAULTS).includes('content="dark"'));
});
