/* The fly as a browser gets it, and where: plain JavaScript that imports only what is sent with it, on pages of their own, and
   nothing of it on the site's other pages. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FLY_ENTRY, flyFiles } from '../src/server/engine-files.ts';
import { FLY_PAGES, flyPage } from '../src/server/fly-page.ts';
import { championSlugs, LAYOUTS, sitemap, SOURCE } from '../src/server/pages.ts';
import type { CircuitFile } from '../src/fly/circuit.ts';

const web = (file: string) => readFileSync(new URL(`../web/${file}`, import.meta.url), 'utf8');

test('the browser gets the fly as JavaScript, with its circuit beside it', () => {
  const files = flyFiles();
  for (const p of [FLY_ENTRY, 'controller.js', 'worker.js', 'brain.js', 'senses.js', 'motor.js', 'body.js', 'loop.js', 'draw.js', 'store.js', 'biology.js', 'circuit.json']) assert.ok(files.has(p), p);
  for (const [p, code] of files) {
    if (!p.endsWith('.js')) continue;
    assert.ok(!/from\s*['"][^'"]+\.ts['"]/.test(code), `${p} still imports a .ts file`);
    assert.ok(!/^\s*(export\s+)?(interface|type)\s+\w+/m.test(code), `${p} still has types`);
    for (const [, dep] of code.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)) assert.ok(files.has(dep!), `${p} imports ${dep}, which is not sent`);
  }
  // the page starts the worker by this name, which no import points at
  assert.match(files.get('controller.js')!, /new URL\('\.\/worker\.js', import\.meta\.url\)/);
});

test('the circuit holds what the brain reads, and says where it came from', () => {
  const circuit = JSON.parse(flyFiles().get('circuit.json')!) as CircuitFile;
  assert.equal(circuit.start.length - 1, 2000);
  assert.equal(circuit.post.length, circuit.w.length);
  assert.equal(circuit.start.at(-1), circuit.post.length);
  assert.match(circuit.source.licence!, /CC BY-NC 4\.0/);
});

test('the site\'s own pages and script have nothing of the fly', () => {
  for (const file of ['index.html', 'receipt.html', 'app.js']) assert.ok(!/fly-on|flyController|FlyWire|\/fly\b/.test(web(file)), file);
  const map = sitemap(championSlugs([{ id: 'Vayne', name: 'Vayne' }]), '2026-10-30T00:00:00Z');
  assert.ok(!map.includes('/fly'));
});

test('the pages at /fly carry the fly, the credit, and keep to their own addresses', () => {
  for (const layout of LAYOUTS) {
    const html = flyPage(web(SOURCE[layout]), layout, '/somewhere/');
    assert.ok(html.includes('<html data-base="/fly"'), layout);
    assert.ok(html.includes('<script type="module" src="/somewhere/menu.js"></script>'), layout);
    assert.ok(html.includes('<meta name="robots" content="noindex">'), layout);
    assert.ok(html.includes(`<link rel="canonical" href="https://itemize.lol${FLY_PAGES[layout].path}">`), layout);
    assert.ok(html.includes('id="fly-on"'), layout);
    assert.match(html, /FlyWire<\/a> connectome v783/);
    assert.match(html, /CC BY-NC 4\.0<\/a>/);
    // its layout links stay on these pages
    assert.match(html, /<a href="\/fly" role="menuitemradio" data-layout="tabs"/);
    assert.match(html, /<a href="\/fly\/receipt" role="menuitemradio" data-layout="receipt"/);
    assert.ok(html.includes('id="set-menu" role="dialog"'), layout);
  }
});

test('a page that changes shape stops the build instead of going out half made', () => {
  assert.throws(() => flyPage('<html><head></head></html>', 'tabs', '/x/'), /expected one/);
});
