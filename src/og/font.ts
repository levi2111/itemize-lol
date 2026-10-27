/* Text for the preview images, drawn from glyphs rasterised in advance. A Worker has no font
   engine and ten milliseconds, so every size of every face the card uses is drawn once, by
   Chrome, from the site's own fonts (scripts/og-glyphs.ts), and kept as coverage maps in
   src/og/glyphs.bin. Drawing text is then copying those maps, pen position by pen position. */
import type { Canvas } from './canvas.ts';

const ASCII = Array.from({ length: 95 }, (_, i) => String.fromCharCode(32 + i)).join('');
/** what a build's name may hold beyond ASCII: Western European letters and the punctuation phones type */
const LATIN = ASCII + Array.from({ length: 64 }, (_, i) => String.fromCharCode(0xc0 + i)).join('') + '¡¿«»·’‘“”–—…€£°×';
const DIGITS = '0123456789,.%+-−s ';

export interface StyleSpec {
  /** a font file in web/fonts */
  font: 'archivo-v25.woff2' | 'plex-mono-v20-600.woff2';
  weight: number;
  /** Archivo's width axis, in percent */
  stretch: number;
  size: number;
  chars: string;
}
/** Every face and size the cards use. Changing this means running scripts/og-glyphs.ts again. */
export const STYLES = {
  // the champion's name, on the champion's own card only, at the largest size it fits in
  title120: { font: 'archivo-v25.woff2', weight: 900, stretch: 62, size: 120, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.&-" },
  title96: { font: 'archivo-v25.woff2', weight: 900, stretch: 62, size: 96, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.&-" },
  title76: { font: 'archivo-v25.woff2', weight: 900, stretch: 62, size: 76, chars: "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789 '.&-" },
  // the line under it: level and target, or the champion's title
  sub: { font: 'archivo-v25.woff2', weight: 500, stretch: 100, size: 30, chars: LATIN },
  subBold: { font: 'archivo-v25.woff2', weight: 700, stretch: 100, size: 30, chars: ASCII },
  // a build's name, as typed
  name: { font: 'archivo-v25.woff2', weight: 700, stretch: 100, size: 40, chars: LATIN },
  tag: { font: 'archivo-v25.woff2', weight: 900, stretch: 85, size: 32, chars: 'AB' },
  tagBig: { font: 'archivo-v25.woff2', weight: 900, stretch: 85, size: 96, chars: 'AB' },
  // a build's combo damage, and a smaller size for numbers that do not fit
  num: { font: 'archivo-v25.woff2', weight: 900, stretch: 76, size: 96, chars: DIGITS },
  numSmall: { font: 'archivo-v25.woff2', weight: 900, stretch: 76, size: 76, chars: DIGITS },
  // the verdict on the splash art, and the words under it
  hero: { font: 'archivo-v25.woff2', weight: 900, stretch: 72, size: 160, chars: DIGITS + 'EVN' },
  heroSmall: { font: 'archivo-v25.woff2', weight: 900, stretch: 72, size: 124, chars: DIGITS + 'EVN' },
  caption: { font: 'archivo-v25.woff2', weight: 700, stretch: 100, size: 34, chars: ASCII },
  label: { font: 'archivo-v25.woff2', weight: 700, stretch: 100, size: 24, chars: ASCII },
  // the champion card's line, and the site's mark
  lead: { font: 'archivo-v25.woff2', weight: 800, stretch: 100, size: 50, chars: ASCII },
  mark: { font: 'archivo-v25.woff2', weight: 900, stretch: 108, size: 42, chars: 'itemze.lo' },
  mono: { font: 'plex-mono-v20-600.woff2', weight: 600, stretch: 100, size: 28, chars: 'Patch 0123456789.' },
} as const satisfies Record<string, StyleSpec>;
export type StyleName = keyof typeof STYLES;

export interface Glyph { at: number; w: number; h: number; left: number; top: number; adv: number }
export interface Face { size: number; ascent: number; glyphs: Map<string, Glyph>; kern: Map<string, number>; bits: Uint8Array }
export type Fonts = Record<StyleName, Face>;

/** The atlas file: a little-endian u32 with the length of a JSON header, the header, and every coverage map one after another. */
export interface AtlasHeader {
  styles: Record<string, { size: number; ascent: number; glyphs: Record<string, [at: number, w: number, h: number, left: number, top: number, adv: number]>; kern: Record<string, number> }>;
}
export function readAtlas(bytes: Uint8Array): Fonts {
  const n = new DataView(bytes.buffer, bytes.byteOffset).getUint32(0, true);
  const head: AtlasHeader = JSON.parse(new TextDecoder().decode(bytes.subarray(4, 4 + n)));
  const bits = bytes.subarray(4 + n);
  const out = {} as Record<string, Face>;
  for (const [name, s] of Object.entries(head.styles)) {
    out[name] = {
      size: s.size, ascent: s.ascent, bits,
      glyphs: new Map(Object.entries(s.glyphs).map(([ch, [at, w, h, left, top, adv]]) => [ch, { at, w, h, left, top, adv }])),
      kern: new Map(Object.entries(s.kern)),
    };
  }
  for (const name of Object.keys(STYLES)) if (!out[name]) throw new Error(`glyph atlas has no style ${name}: run scripts/og-glyphs.ts`);
  return out as Fonts;
}

/** Whether a face can draw every character of a text. */
export const covers = (f: Face, text: string) => [...text].every(ch => f.glyphs.has(ch));
/** The width of a line of text, `track` pixels added between letters. */
export function measure(f: Face, text: string, track = 0): number {
  let x = 0, prev = '';
  for (const ch of text) {
    const g = f.glyphs.get(ch);
    if (!g) continue;
    x += (f.kern.get(prev + ch) ?? 0) + g.adv + track;
    prev = ch;
  }
  return Math.max(0, x - track);
}
/** The longest start of a text that fits a width, with an ellipsis when it was cut. */
export function fit(f: Face, text: string, width: number): string {
  if (measure(f, text) <= width) return text;
  const chars = [...text];
  while (chars.length && measure(f, chars.join('').trimEnd() + '…') > width) chars.pop();
  return chars.join('').trimEnd() + '…';
}
/** Draws a line of text with its baseline at y, starting at x (or ending there, `align` right). Returns the width. */
export function text(c: Canvas, f: Face, s: string, x: number, y: number, color: number, o: { align?: 'left' | 'right'; track?: number } = {}): number {
  const track = o.track ?? 0, w = measure(f, s, track);
  let pen = o.align === 'right' ? x - w : x, prev = '';
  for (const ch of s) {
    const g = f.glyphs.get(ch);
    if (!g) continue;
    pen += f.kern.get(prev + ch) ?? 0;
    if (g.w) c.mask(f.bits, g.at, g.w, g.h, Math.round(pen + g.left), y - g.top, color);
    pen += g.adv + track;
    prev = ch;
  }
  return w;
}
