/* The fly as a browser gets it: plain JavaScript that imports only what is sent with it, and a credit on each page. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { FLY_BASE, FLY_ENTRY, flyFiles } from '../src/server/engine-files.ts';
import type { CircuitFile } from '../src/fly/circuit.ts';

test('the browser gets the fly as JavaScript, with its circuit beside it', () => {
  const files = flyFiles();
  for (const p of [FLY_ENTRY, 'worker.js', 'brain.js', 'senses.js', 'motor.js', 'body.js', 'loop.js', 'draw.js', 'store.js', 'biology.js', 'circuit.json']) assert.ok(files.has(p), p);
  for (const [p, code] of files) {
    if (!p.endsWith('.js')) continue;
    assert.ok(!/from\s*['"][^'"]+\.ts['"]/.test(code), `${p} still imports a .ts file`);
    assert.ok(!/^\s*(export\s+)?(interface|type)\s+\w+/m.test(code), `${p} still has types`);
    for (const [, dep] of code.matchAll(/from\s*['"]\.\/([^'"]+)['"]/g)) assert.ok(files.has(dep!), `${p} imports ${dep}, which is not sent`);
  }
  // the page starts the worker by this name, which no import points at
  assert.match(files.get(FLY_ENTRY)!, /new URL\('\.\/worker\.js', import\.meta\.url\)/);
});

test('the circuit holds what the brain reads, and says where it came from', () => {
  const circuit = JSON.parse(flyFiles().get('circuit.json')!) as CircuitFile;
  assert.equal(circuit.start.length - 1, 2000);
  assert.equal(circuit.post.length, circuit.w.length);
  assert.equal(circuit.start.at(-1), circuit.post.length);
  assert.match(circuit.source.licence!, /CC BY-NC 4\.0/);
});

test('both pages name the fly and credit its data', () => {
  for (const page of ['index.html', 'receipt.html']) {
    const html = readFileSync(new URL(`../web/${page}`, import.meta.url), 'utf8');
    assert.ok(html.includes(`<meta name="fly" content="${FLY_BASE}">`), page);
    assert.ok(html.includes('id="fly-on"'), page);
    assert.match(html, /FlyWire<\/a> connectome v783/);
    assert.match(html, /CC BY-NC 4\.0<\/a>/);
    // off until asked for
    assert.ok(!/id="fly-on"[^>]*checked/.test(html), page);
  }
});
