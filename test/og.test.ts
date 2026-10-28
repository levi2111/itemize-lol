/* The preview images: the PNG pieces, a champion's card, and a build's card drawn over it, read back
   with zlib (which checks every checksum) and compared pixel for pixel with what was drawn. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { constants, crc32 as zcrc, deflateRawSync, deflateSync, inflateRawSync, inflateSync } from 'node:zlib';
import { ART_END, ART_W, BG, FOOT_TOP, ICON, NAME_END, championCard, drawBuilds, renderCard } from '../src/og/card.ts';
import { Canvas } from '../src/og/canvas.ts';
import { covers, fit, measure, readAtlas } from '../src/og/font.ts';
import { H, SPLIT, W, adler32, adlerCombine, crc32 } from '../src/og/png.ts';
import { Dataset } from '../src/server/dataset.ts';
import { metaTags, preview, siteMeta, type CardFacts } from '../src/server/preview.ts';
import { decodeShare, readShare } from '../src/server/share.ts';

const fonts = readAtlas(inflateRawSync(readFileSync(new URL('../src/og/glyphs.bin', import.meta.url))));
const compress = (b: Uint8Array) => deflateRawSync(b, { level: 9, finishFlush: constants.Z_SYNC_FLUSH });
/** Art for a test: noise above ART_END, which no encoder can shortcut, and background below. */
const art = () => {
  const a = new Uint8Array(ART_W * H * 3);
  let r = 7;
  for (let i = 0; i < a.length; i++) a[i] = i / 3 / ART_W < ART_END ? (r = (r * 1103515245 + 12345) & 0x7fffffff) >> 16 : [BG >> 16, (BG >> 8) & 255, BG & 255][i % 3]!;
  for (let y = 0; y < ART_END; y++) a.set([BG >> 16, (BG >> 8) & 255, BG & 255], y * ART_W * 3);
  return a;
};
const CHAMP = championCard(art(), fonts, { title: 'Vayne', patch: '26.20' }, compress);

/** A PNG's pixels, every chunk's CRC checked on the way. */
function decode(png: Uint8Array): Uint8Array {
  const b = Buffer.from(png), idat: Buffer[] = [];
  assert.equal(b.readUInt32BE(16), W); assert.equal(b.readUInt32BE(20), H); assert.equal(b[24], 8); assert.equal(b[25], 2);
  for (let at = 8; at < b.length;) {
    const len = b.readUInt32BE(at);
    assert.equal(b.readUInt32BE(at + 8 + len), zcrc(b.subarray(at + 4, at + 8 + len)), 'chunk CRC');
    if (b.toString('latin1', at + 4, at + 8) === 'IDAT') idat.push(b.subarray(at + 8, at + 8 + len));
    at += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)), px = new Uint8Array(W * H * 3);
  assert.equal(raw.length, H * (1 + W * 3));
  for (let y = 0; y < H; y++) {
    assert.equal(raw[y * (1 + W * 3)], 1, 'every row is filtered with Sub');
    for (let i = 0; i < W * 3; i++) px[y * W * 3 + i] = raw[y * (1 + W * 3) + 1 + i]! + (i >= 3 ? px[y * W * 3 + i - 3]! : 0);
  }
  return px;
}
const row = (px: Uint8Array, y: number, from = 0, to = W) => px.subarray((y * W + from) * 3, (y * W + to) * 3);

test('checksums agree with zlib, and combine', () => {
  const a = Uint8Array.from({ length: 70000 }, (_, i) => (i * 7919) % 251), b = Uint8Array.from({ length: 333 }, (_, i) => i & 255);
  for (const x of [a, b, a.subarray(0, 5), new Uint8Array(0)]) assert.equal(crc32(x), zcrc(x));
  const both = new Uint8Array([...a, ...b]);
  assert.equal(adlerCombine(adler32(a), adler32(b), b.length), adler32(both));
  // zlib's own Adler-32 is the trailer of a zlib stream
  const z = deflateSync(both);
  assert.equal(z.readUInt32BE(z.length - 4), adler32(both));
});

test('a champion\'s card is a plain PNG', () => {
  const px = decode(CHAMP), a = art();
  for (const y of [0, 100, ART_END - 1, ART_END, H - 1]) assert.deepEqual(row(px, y, SPLIT + 1, W), a.subarray((y * ART_W + 1) * 3, (y + 1) * ART_W * 3));
});

const data = new Dataset();
const pack = (s: unknown) => Buffer.from(JSON.stringify(s), 'utf8').toString('base64url');
const facts = (s: unknown) => preview(data, readShare(data, decodeShare(pack(s))!, 'tabs')).card;
const icons = (f: CardFacts) => new Map(f.builds.flatMap(b => b.items).map(id => [id, Uint8Array.from({ length: ICON * ICON * 3 }, (_, i) => (id + i) & 255)]));
const TWO = { c: 'Vayne', l: 13, a: [6672, 3006, 3124, 3031, 3036], b: [3153, 3006, 3124], n: ['Kraken', ''], m: 1, t: 'dummy', q: [3, 1, 0, 1, 0] };

test('a build\'s card is the champion\'s with the builds drawn on, and nothing else changed', () => {
  for (const s of [TWO, { ...TWO, m: 0, t: 'champ', e: ['Garen', 16] }, { ...TWO, t: 'raw', b: TWO.a, n: ['', ''] }, { c: 'Vayne', m: 1 }]) {
    const f = facts(s), ic = icons(f);
    const png = renderCard(CHAMP, fonts, f, ic)!, px = decode(png), champ = decode(CHAMP);
    const c = new Canvas(W, H, BG);
    drawBuilds(c, fonts, f, ic);
    const blank = new Canvas(W, H, BG);
    for (let y = 0; y < H; y++) {
      blank.prepare(y);
      const keepLeft = y < NAME_END || y >= FOOT_TOP, keepRight = y < ART_END;
      const drawn = (from: number, to: number) => { if (c.drawn(y)) return row(c.px, y, from, to); return row(blank.px, y, from, to); };
      assert.deepEqual(row(px, y, 0, SPLIT), keepLeft ? row(champ, y, 0, SPLIT) : drawn(0, SPLIT), `row ${y} left`);
      assert.deepEqual(row(px, y, SPLIT, W), keepRight ? row(champ, y, SPLIT, W) : drawn(SPLIT, W), `row ${y} right`);
    }
    // the art is noise here, which nothing compresses: what matters is how much a build adds to it
    assert.ok(png.length - CHAMP.length < 250 * 1024, `a build adds ${png.length - CHAMP.length} bytes`);
  }
});

test('a card that is not a champion\'s card is refused', () => {
  assert.equal(renderCard(new Uint8Array(100), fonts, facts(TWO), new Map()), null);
  assert.equal(renderCard(Uint8Array.from(deflateSync(new Uint8Array(10))), fonts, facts(TWO), new Map()), null);
});

test('text: what the faces cannot draw falls back, and long names are cut', () => {
  assert.ok(covers(fonts.name, 'Krakén Slayer – “burst”'));
  assert.ok(!covers(fonts.name, '크라켄'));
  const f = facts({ ...TWO, n: ['크라켄 빌드', 'x'.repeat(40)] });
  assert.equal(f.builds[0]!.name, '크라켄 빌드');
  assert.equal(f.builds[0]!.fallback, 'Kraken Slayer');
  renderCard(CHAMP, fonts, f, icons(f));     // draws the fallback, and the long name cut short
  const cut = fit(fonts.name, 'x'.repeat(40), 300);
  assert.ok(cut.endsWith('…') && measure(fonts.name, cut) <= 300);
});

test('page tags are escaped, and the pages carry the site\'s own', () => {
  const tags = metaTags({ ...siteMeta('/'), title: '<script>"&\'' });
  assert.match(tags, /content="&lt;script&gt;&quot;&amp;&#39;"/);
  assert.ok(!tags.includes('<script>'));
  for (const [page, path] of [['index.html', '/'], ['receipt.html', '/receipt']] as const) {
    const html = readFileSync(new URL(`../web/${page}`, import.meta.url), 'utf8').replace(/\r\n/g, '\n');
    assert.ok(html.includes(metaTags(siteMeta(path))), `${page} has the tags metaTags writes`);
  }
});
