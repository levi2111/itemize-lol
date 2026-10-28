/* The preview images, 1200 by 630. A champion's page and the site have a poster, made at build time
   (scripts/og.ts): the splash art over the whole of it, the name and the site's mark, and nothing else.
   A shared build's card starts from a second card of each champion, also made at build time: its splash
   art at the top right, fading into the background, its name at the top left, the site's mark and the
   patch at the bottom. The build's card rewrites the rest: level and target, the builds as rows of item
   icons with their combo damage and a bar each, and the verdict large under the art. The name, the art
   and the footer are copied from the champion's card (png.ts), which is what makes a card cheap enough
   to draw on a request; nothing is drawn over the art, so it never has to be decoded.

   Sized for where it is seen: Discord shows it about 400 pixels wide, a third of this, so no text
   is under 24 pixels and what matters is large. Nothing important is within 40 pixels of an edge. */
import type { CardFacts } from '../server/preview.ts';
import { Canvas } from './canvas.ts';
import { covers, fit, measure, text, type Face, type Fonts } from './font.ts';
import { H, SPLIT, W, filterRow, readCard, storedPiece, writeCard, writeOver } from './png.ts';

// the site's colours (web/index.html)
export const BG = 0x0c2524, TEXT = 0xece7d8, DIM = 0xa3beb7, FAINT = 0x6f948d, INK = 0x141714, RULE = 0x25504d;
const COLOR = { a: 0xeef035, b: 0xff7fb2 } as const;
const TRACK = 0x173f3c;

/** rows the champion's card owns on the left: its name above, the mark and patch below */
export const NAME_END = 180, FOOT_TOP = 556;
/** rows the art takes on the right; below it is background, where the verdict goes */
export const ART_END = 380;
const X = 56;
/** where text on the left must end: clear of the art and of the column the art's filtering starts from */
const RIGHT = SPLIT - 40;
export const ICON = 56;
const GAP = 8;

/** The largest size of the title face a text fits at, and the text. */
function title(f: Fonts, name: string, width: number): Face {
  for (const s of [f.title120, f.title96, f.title76]) if (measure(s, name) <= width) return s;
  return f.title76;
}

/** the width of the art, at the right of a card */
export const ART_W = W - SPLIT;

/** A champion's card, the start of its builds' cards, from its art (ART_W by H pixels, RGB). `compress` deflates a piece, as writeCard wants. */
export function championCard(art: Uint8Array, f: Fonts, o: Parameters<typeof drawChampionCard>[2], compress: (b: Uint8Array) => Uint8Array): Uint8Array {
  const c = new Canvas(W, H, BG), edge = [BG >> 16, (BG >> 8) & 255, BG & 255];
  for (let y = 0; y < H; y++) { c.prepare(y); c.px.set(art.subarray(y * ART_W * 3, (y + 1) * ART_W * 3), (y * W + SPLIT) * 3); }
  drawChampionCard(c, f, o);
  for (let y = NAME_END; y < H; y++) {
    // a build's card redraws these rows' left halves and copies the art beside them: the art must meet the background
    if (c.px.subarray((y * W + SPLIT - 1) * 3, (y * W + SPLIT) * 3).some((v, k) => v !== edge[k])) throw new Error(`card text reaches the art on row ${y}`);
  }
  return writeCard(y => filterRow(c.px, y), compress);
}

/** What a champion's card says, all of which its builds' cards copy: the name, the mark and the patch. */
export function drawChampionCard(c: Canvas, f: Fonts, o: { title: string; patch: string }) {
  const name = cardName(o.title);
  text(c, title(f, name, 680), name, X, 148, TEXT);
  drawMark(c, f);
  text(c, f.mono, `Patch ${o.patch}`, RIGHT, 598, DIM, { align: 'right' });
}
const cardName = (s: string) => s.toUpperCase().replace(/[^A-Z0-9 '.&-]/g, '');
/** the mark as the site's top bar has it: "itemize" on a yellow block, ".lol" after it */
function drawMark(c: Canvas, f: Fonts) {
  const w = measure(f.mark, 'itemize');
  c.rect(X, 566, Math.round(w) + 20, 46, COLOR.a);
  text(c, f.mark, 'itemize', X + 10, 602, INK);
  text(c, f.mark, '.lol', X + w + 22, 602, DIM);
}

/** A poster, for a champion's page or the site: its art (W by H pixels, RGB, already shaded where the words go)
    with a name over the bottom left and the mark under it. Returns the pixels, for the build to encode. */
export function posterCard(art: Uint8Array, f: Fonts, o: { title: string }): Uint8Array {
  const c = new Canvas(W, H, BG);
  for (let y = 0; y < H; y++) { c.prepare(y); c.px.set(art.subarray(y * W * 3, (y + 1) * W * 3), y * W * 3); }
  const name = cardName(o.title);
  text(c, title(f, name, W - 2 * X), name, X, 536, TEXT);
  drawMark(c, f);
  return c.px;
}

const nf = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Draws a shared build's facts on a canvas over the champion's card. `icons` holds each item's picture, ICON pixels square. */
export function drawBuilds(c: Canvas, f: Fonts, facts: CardFacts, icons: Map<number, Uint8Array>) {
  // level and target
  const lv = `Level ${facts.level}`;
  const lw = text(c, f.subBold, lv, X, 216, TEXT);
  const room = RIGHT - X - lw, target = facts.target.map(t => ` · ${t}`).find(t => covers(f.sub, t) && measure(f.sub, t) <= room) ?? '';
  text(c, f.sub, fit(f.sub, target, room), X + lw, 216, DIM);

  const two = facts.builds.length === 2;
  const max = Math.max(1, ...facts.builds.map(b => b.total));
  facts.builds.forEach((b, i) => {
    const top = 240 + i * 162, color = COLOR[b.key];
    // the build's letter on its colour, and its name
    c.rect(X, top, 40, 40, color);
    const letter = b.key.toUpperCase();
    text(c, f.tag, letter, Math.round(X + 20 - measure(f.tag, letter) / 2), top + 32, INK);
    const name = covers(f.name, b.name) ? b.name : b.fallback;
    text(c, f.name, fit(f.name, name, RIGHT - X - 56), X + 56, top + 33, TEXT);
    // six slots
    for (let k = 0; k < 6; k++) {
      const x = X + k * (ICON + GAP), y = top + 56, id = b.items[k], px = id === undefined ? undefined : icons.get(id);
      if (px) c.image(px, ICON, ICON, x, y, 5);
      else c.frame(x, y, ICON, ICON, 2, RULE);
    }
    if (!two) return;
    // combo damage, the leader's in its colour, and a bar against the larger
    const lead = facts.lead?.key === b.key, n = nf(b.total);
    const face = measure(f.num, n) <= RIGHT - (X + 6 * (ICON + GAP)) - 8 ? f.num : f.numSmall;
    text(c, face, n, RIGHT, top + 112, lead || !facts.lead ? color : DIM, { align: 'right' });
    c.rect(X, top + 126, RIGHT - X, 12, TRACK);
    c.rect(X, top + 126, Math.max(4, Math.round((RIGHT - X) * b.total / max)), 12, color);
  });
  if (two) drawVerdict(c, f, facts); else drawOne(c, f, facts);
}

/** where the verdict's baseline is, under the art */
const HERO_Y = 528;

/** Two builds: by how much the leader deals more, large, under the art. */
function drawVerdict(c: Canvas, f: Fonts, facts: CardFacts) {
  const right = W - 52, l = facts.lead;
  const big = !l ? 'EVEN' : l.percent === null ? '' : `+${l.percent}%`;
  const words = !l ? 'same combo damage' : l.percent === 0 ? 'slightly more combo damage' : 'more combo damage';
  const color = l ? COLOR[l.key] : TEXT;
  if (big) {
    const face = measure(f.hero, big) <= right - SPLIT - 30 ? f.hero : f.heroSmall;
    text(c, face, big, right, HERO_Y, color, { align: 'right' });
  }
  text(c, f.caption, words, right, HERO_Y + 48, TEXT, { align: 'right' });
}

/** One build: its combo damage large under the art, DPS and time to kill beside the items. */
function drawOne(c: Canvas, f: Fonts, facts: CardFacts) {
  const b = facts.builds[0]!, right = W - 52;
  const n = nf(b.total);
  text(c, measure(f.hero, n) <= right - SPLIT - 30 ? f.hero : f.heroSmall, n, right, HERO_Y, COLOR.a, { align: 'right' });
  text(c, f.caption, 'combo damage', right, HERO_Y + 48, TEXT, { align: 'right' });
  const stats: [string, string][] = [['DPS', nf(b.dps)]];
  if (b.timeToKill !== null) stats.push(['TIME TO KILL', `${b.timeToKill.toFixed(1)}s`]);
  stats.forEach(([k, v], i) => {
    const x = X + i * 290;
    text(c, f.label, k, x, 420, DIM, { track: 2 });
    text(c, f.num, v, x - 3, 526, TEXT);
  });
}

/** One canvas for every card an isolate draws: drawing and writing a card is synchronous, so two never share it. */
let canvas: Canvas | null = null;

/** A shared build's card, from the champion's card (as served at /og/<id>.png). Null when that card is not one of ours. */
export function renderCard(champion: Uint8Array, f: Fonts, facts: CardFacts, icons: Map<number, Uint8Array>): Uint8Array | null {
  const card = readCard(champion);
  if (!card) return null;
  const c = canvas = new Canvas(W, H, BG, canvas?.px);
  drawBuilds(c, f, facts, icons);
  return writeOver(card, c, { keepLeft: y => y < NAME_END || y >= FOOT_TOP, keepRight: y => y < ART_END });
}

/** Draws a few cards over a made-up champion's card, for a Worker to run while it starts. The first cards an
    isolate draws run before V8 has compiled the loops that do the work, several times slower than the rest;
    drawn at startup, that cost falls under the startup limit rather than a request's. */
export function warmUp(f: Fonts) {
  const art = new Uint8Array(ART_W * H * 3).fill(40);
  const card = championCard(art, f, { title: 'Warm', patch: '0' }, storedPiece);
  const icon = new Uint8Array(ICON * ICON * 3).fill(90), icons = new Map([1, 2, 3, 4, 5, 6].map(id => [id, icon]));
  const build = (key: 'a' | 'b', total: number) => ({ key, name: 'Build ' + key, fallback: 'Build', items: [1, 2, 3, 4, 5, 6], total, dps: 512, timeToKill: 3.2, kills: false });
  const facts: CardFacts = { champion: { id: 'Warm', name: 'Warm' }, level: 13, patch: '0', target: ['vs dummy: 2,400 HP, 80 armor, 50 MR'], builds: [build('a', 2345), build('b', 2057)], lead: { key: 'a', percent: 14 } };
  for (let i = 0; i < 2; i++) {
    renderCard(card, f, facts, icons);
    renderCard(card, f, { ...facts, builds: [build('a', 1234)], lead: null }, icons);
  }
}
