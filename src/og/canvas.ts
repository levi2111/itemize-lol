/* A picture in memory, RGB, that remembers where on each row it was drawn on. A card is mostly flat
   background, and the encoder (png.ts) only reads the parts that were drawn: the rest of a row is
   known to be background without looking at it. */

export class Canvas {
  readonly px: Uint8Array;
  /** per row, the [from, to) column ranges drawn on, unsorted and possibly overlapping */
  readonly spans: number[][];
  /** per row, the column ranges pictures were copied to, which the encoder stores rather than compresses */
  readonly pictures: number[][];
  private readonly ready: Uint8Array;
  readonly w: number;
  readonly h: number;
  readonly bg: number;

  /** a row of background, copied into each row as it is first drawn on */
  private readonly blank: Uint8Array;

  /** `reuse` is the pixels of an earlier canvas of the same size, to draw on again: rows are cleared as they are first drawn on, so what it held does not matter. */
  constructor(w: number, h: number, bg: number, reuse?: Uint8Array) {
    this.w = w; this.h = h; this.bg = bg;
    this.px = reuse?.length === w * h * 3 ? reuse : new Uint8Array(w * h * 3);
    this.blank = new Uint8Array(w * 3);
    for (let i = 0; i < w * 3; i += 3) { this.blank[i] = bg >> 16; this.blank[i + 1] = (bg >> 8) & 255; this.blank[i + 2] = bg & 255; }
    this.spans = Array.from({ length: h }, () => []);
    this.pictures = Array.from({ length: h }, () => []);
    this.ready = new Uint8Array(h);
  }

  /** Fills a row with the background the first time it is drawn on. */
  private row(y: number) {
    if (this.ready[y]) return;
    this.ready[y] = 1;
    const row = this.px.subarray(y * this.w * 3, (y + 1) * this.w * 3);
    row.set(this.blank);
  }
  /** Marks columns [x0, x1) of row y as drawn on, and returns the clipped range, or null. */
  private touch(y: number, x0: number, x1: number): [number, number] | null {
    if (y < 0 || y >= this.h) return null;
    x0 = Math.max(0, x0); x1 = Math.min(this.w, x1);
    if (x1 <= x0) return null;
    this.row(y);
    this.spans[y]!.push(x0, x1);
    return [x0, x1];
  }
  /** Whether anything was drawn on row y. */
  drawn(y: number) { return this.spans[y]!.length > 0; }
  /** Whether anything was drawn on row y at column x or to its right. */
  drawnFrom(y: number, x: number) { const s = this.spans[y]!; for (let i = 1; i < s.length; i += 2) if (s[i]! > x) return true; return false; }
  /** Makes a row ready to be read in full, as when the encoder takes the whole of it. */
  prepare(y: number) { this.row(y); }

  rect(x: number, y: number, w: number, h: number, color: number, alpha = 255) {
    const r = color >> 16, g = (color >> 8) & 255, b = color & 255, ia = 255 - alpha;
    for (let j = y; j < y + h; j++) {
      const t = this.touch(j, x, x + w);
      if (!t) continue;
      for (let i = (j * this.w + t[0]) * 3, end = (j * this.w + t[1]) * 3; i < end; i += 3) {
        const p = this.px;
        if (alpha === 255) { p[i] = r; p[i + 1] = g; p[i + 2] = b; }
        else { p[i] = (p[i]! * ia + r * alpha + 127) / 255; p[i + 1] = (p[i + 1]! * ia + g * alpha + 127) / 255; p[i + 2] = (p[i + 2]! * ia + b * alpha + 127) / 255; }
      }
    }
  }
  /** A rectangle's outline, `t` pixels thick. */
  frame(x: number, y: number, w: number, h: number, t: number, color: number) {
    this.rect(x, y, w, t, color); this.rect(x, y + h - t, w, t, color);
    this.rect(x, y + t, t, h - 2 * t, color); this.rect(x + w - t, y + t, t, h - 2 * t, color);
  }
  /** Paints `color` through a coverage map (w by h bytes at `at` in `bits`) placed at x, y. */
  mask(bits: Uint8Array, at: number, w: number, h: number, x: number, y: number, color: number) {
    const r = color >> 16, g = (color >> 8) & 255, b = color & 255, p = this.px;
    for (let j = 0; j < h; j++) {
      // only the part of the row the glyph covers counts as drawn: the encoder reads no more than that
      const row = at + j * w;
      let l = 0, e = w;
      while (l < w && !bits[row + l]) l++;
      while (e > l && !bits[row + e - 1]) e--;
      if (l === e) continue;
      const t = this.touch(y + j, x + l, x + e);
      if (!t) continue;
      let src = at + j * w + (t[0] - x);
      for (let i = ((y + j) * this.w + t[0]) * 3, end = ((y + j) * this.w + t[1]) * 3; i < end; i += 3, src++) {
        const a = bits[src]!;
        if (!a) continue;
        if (a === 255) { p[i] = r; p[i + 1] = g; p[i + 2] = b; continue; }
        const ia = 255 - a;
        p[i] = (p[i]! * ia + r * a + 127) / 255; p[i + 1] = (p[i + 1]! * ia + g * a + 127) / 255; p[i + 2] = (p[i + 2]! * ia + b * a + 127) / 255;
      }
    }
  }
  /** Copies an RGB picture (w by h) to x, y, with its corners rounded off by radius `round`. */
  image(rgb: Uint8Array, w: number, h: number, x: number, y: number, round = 0) {
    const p = this.px;
    for (let j = 0; j < h; j++) {
      const t = this.touch(y + j, x, x + w);
      if (!t) continue;
      this.pictures[y + j]!.push(t[0], t[1]);
      // how far into the row the rounded corner reaches, with a soft edge
      const dy = Math.max(0, round - j - 0.5, j + 0.5 - (h - round));
      for (let i = t[0]; i < t[1]; i++) {
        const s = (j * w + i - x) * 3, d = ((y + j) * this.w + i) * 3;
        let a = 255;
        if (dy > 0) {
          const dx = Math.max(0, round - (i - x) - 0.5, (i - x) + 0.5 - (w - round));
          if (dx > 0) a = Math.round(255 * Math.max(0, Math.min(1, round - Math.hypot(dx, dy) + 0.5)));
        }
        if (a === 255) { p[d] = rgb[s]!; p[d + 1] = rgb[s + 1]!; p[d + 2] = rgb[s + 2]!; }
        else if (a) { const ia = 255 - a; for (let k = 0; k < 3; k++) p[d + k] = (p[d + k]! * ia + rgb[s + k]! * a + 127) / 255; }
      }
    }
  }
}
