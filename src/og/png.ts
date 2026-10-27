/* PNG for the preview images, made to be cheap to write in a Worker's few milliseconds.

   Compressing a whole 1200x630 picture costs far more than a free Worker has, so most of a card is
   never compressed at request time. Each champion's card (/og/<id>.png) is written at build time in
   a shape that lets a later card reuse its pieces: every row is two separately compressed pieces,
   left and right of SPLIT, each in its own IDAT chunk, each ending on a byte boundary with no
   reference outside itself, and each row filtered with Sub (a byte minus the byte one pixel to its
   left), so no piece depends on the row above. A private chunk lists each piece's Adler-32.

   A build's card then copies, chunk for chunk, the pieces it shares with the champion's card (the
   splash art, the name, the footer) and compresses only the rows it drew on, with a plain
   fixed-Huffman encoder that does little more than run-length coding: a drawn row is mostly
   background, which Sub turns into zeros. The checksum over the whole is combined from the pieces'
   own. Any PNG reader sees an ordinary picture. */

export const W = 1200, H = 630, SPLIT = 720;
/** a row's uncompressed bytes: the filter type and the left pixels, then the right pixels */
export const LEFT_BYTES = 1 + SPLIT * 3, RIGHT_BYTES = (W - SPLIT) * 3;
const SUB = 1;
const SIG = Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10);
/** the private chunk with each piece's checksum: ancillary, private and safe to copy, as its letter cases say */
const INDEX = 'ogAd';

/* ---------- checksums ---------- */
// eight tables, so the CRC takes eight bytes a step ("slicing by 8"): a card's new chunks are a few hundred kilobytes
const CRC = new Uint32Array(256 * 8);
for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c; }
for (let n = 0; n < 256; n++) for (let t = 1; t < 8; t++) CRC[t * 256 + n] = CRC[(t - 1) * 256 + n]! >>> 8 ^ CRC[CRC[(t - 1) * 256 + n]! & 255]!;
export function crc32(b: Uint8Array, crc = 0): number {
  crc = ~crc;
  let i = 0;
  for (const end = b.length - 8; i <= end; i += 8) {
    const lo = crc ^ (b[i]! | b[i + 1]! << 8 | b[i + 2]! << 16 | b[i + 3]! << 24);
    crc = CRC[1792 + (lo & 255)]! ^ CRC[1536 + (lo >>> 8 & 255)]! ^ CRC[1280 + (lo >>> 16 & 255)]! ^ CRC[1024 + (lo >>> 24)]!
      ^ CRC[768 + b[i + 4]!]! ^ CRC[512 + b[i + 5]!]! ^ CRC[256 + b[i + 6]!]! ^ CRC[b[i + 7]!]!;
  }
  for (; i < b.length; i++) crc = CRC[(crc ^ b[i]!) & 255]! ^ (crc >>> 8);
  return ~crc >>> 0;
}
const BASE = 65521;
export function adler32(b: Uint8Array, adler = 1): number {
  let s1 = adler & 0xffff, s2 = adler >>> 16;
  for (let i = 0; i < b.length;) {
    const end = Math.min(b.length, i + 3800);
    for (; i < end; i++) { s1 += b[i]!; s2 += s1; }
    s1 %= BASE; s2 %= BASE;
  }
  return ((s2 << 16) | s1) >>> 0;
}
/** The Adler-32 of two pieces one after the other, from each one's own and the second's length (zlib's adler32_combine). */
export function adlerCombine(a1: number, a2: number, len2: number): number {
  const rem = len2 % BASE;
  let s1 = a1 & 0xffff;
  let s2 = (rem * s1) % BASE;
  s1 += (a2 & 0xffff) + BASE - 1;
  s2 += (a1 >>> 16) + (a2 >>> 16) + BASE - rem;
  s1 %= BASE; s2 %= BASE;
  return ((s2 << 16) | s1) >>> 0;
}

export function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length), v = new DataView(out.buffer);
  v.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  v.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

/* ---------- a fixed-Huffman deflate encoder ---------- */
// codes for literals and lengths (RFC 1951 3.2.6), bit-reversed because deflate writes them from the high bit
const LIT_CODE = new Uint16Array(288), LIT_LEN = new Uint8Array(288);
const rev = (v: number, n: number) => { let r = 0; for (let i = 0; i < n; i++) r = (r << 1) | ((v >> i) & 1); return r; };
for (let v = 0; v < 288; v++) {
  const [code, len] = v < 144 ? [0x30 + v, 8] : v < 256 ? [0x190 + v - 144, 9] : v < 280 ? [v - 256, 7] : [0xc0 + v - 280, 8];
  LIT_CODE[v] = rev(code, len); LIT_LEN[v] = len;
}
// length 3..258: its symbol, extra bits and their value
const LEN_SYM = new Uint16Array(259), LEN_XBITS = new Uint8Array(259), LEN_XVAL = new Uint16Array(259);
{
  const base = [3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131, 163, 195, 227, 258];
  const extra = [0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0];
  for (let s = 0; s < base.length; s++) {
    const top = s === base.length - 1 ? 258 : base[s + 1]! - 1;
    for (let l = base[s]!; l <= top; l++) { LEN_SYM[l] = 257 + s; LEN_XBITS[l] = extra[s]!; LEN_XVAL[l] = l - base[s]!; }
  }
}

/* ---------- reading a champion's card ---------- */
export interface Card {
  /** the PNG signature and IHDR, as they are */
  head: Uint8Array;
  /** the IDAT holding the zlib header */
  start: Uint8Array;
  /** per row, the left and right pieces' whole chunks (length, type, data, CRC) and the Adler-32 of what each holds */
  left: Uint8Array[]; right: Uint8Array[];
  leftAdler: Uint32Array; rightAdler: Uint32Array;
}
/** Splits a card written by writeCard into its pieces; null for anything else. */
export function readCard(png: Uint8Array): Card | null {
  const v = new DataView(png.buffer, png.byteOffset, png.byteLength);
  if (png.length < 33 || SIG.some((b, i) => png[i] !== b) || v.getUint32(16) !== W || v.getUint32(20) !== H) return null;
  const idat: Uint8Array[] = [];
  let index: Uint8Array | null = null;
  const IDAT = 0x49444154, ogAd = 0x6f674164;
  for (let at = 33; at + 12 <= png.length;) {
    const len = v.getUint32(at), type = v.getUint32(at + 4);
    if (type === IDAT) idat.push(png.subarray(at, at + 12 + len));
    else if (type === ogAd) index = png.subarray(at + 8, at + 8 + len);
    at += 12 + len;
  }
  if (!index || index.length !== 8 * H + 2 || idat.length !== 2 + 2 * H) return null;
  const iv = new DataView(index.buffer, index.byteOffset, index.byteLength);
  if (iv.getUint16(0) !== SPLIT) return null;
  const leftAdler = new Uint32Array(H), rightAdler = new Uint32Array(H);
  for (let y = 0; y < H; y++) { leftAdler[y] = iv.getUint32(2 + 8 * y); rightAdler[y] = iv.getUint32(6 + 8 * y); }
  return {
    head: png.subarray(0, 33), start: idat[0]!,
    left: Array.from({ length: H }, (_, y) => idat[1 + 2 * y]!), right: Array.from({ length: H }, (_, y) => idat[2 + 2 * y]!),
    leftAdler, rightAdler,
  };
}
const ihdr = () => { const d = new Uint8Array(13), v = new DataView(d.buffer); v.setUint32(0, W); v.setUint32(4, H); d[8] = 8; d[9] = 2; return chunk('IHDR', d); };
const zstart = () => chunk('IDAT', Uint8Array.of(0x78, 0x01));
/** The end of the zlib stream: a last, empty fixed-Huffman block, then the Adler-32 of everything. */
const zend = (adler: number) => { const d = Uint8Array.of(3, 0, 0, 0, 0, 0); new DataView(d.buffer).setUint32(2, adler); return chunk('IDAT', d); };
const concat = (parts: Uint8Array[]) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

/** Writes a card from each row's filtered bytes, split in two, compressed by `compress` (which must end each piece with a sync flush and reference nothing before it). Used at build time. */
export function writeCard(rows: (y: number) => [left: Uint8Array, right: Uint8Array], compress: (b: Uint8Array) => Uint8Array): Uint8Array {
  const index = new Uint8Array(2 + 8 * H), iv = new DataView(index.buffer);
  iv.setUint16(0, SPLIT);
  const pieces: Uint8Array[] = [];
  let adler = 1;
  for (let y = 0; y < H; y++) {
    const [l, r] = rows(y), la = adler32(l), ra = adler32(r);
    iv.setUint32(2 + 8 * y, la); iv.setUint32(6 + 8 * y, ra);
    adler = adlerCombine(adlerCombine(adler, la, l.length), ra, r.length);
    pieces.push(chunk('IDAT', compress(l)), chunk('IDAT', compress(r)));
  }
  return concat([SIG, ihdr(), chunk(INDEX, index), zstart(), ...pieces, zend(adler), chunk('IEND', new Uint8Array(0))]);
}
/** A row of RGB pixels filtered with Sub, as the two halves the card keeps apart. */
export function filterRow(px: Uint8Array, y: number): [Uint8Array, Uint8Array] {
  const row = px.subarray(y * W * 3, (y + 1) * W * 3), f = new Uint8Array(1 + W * 3);
  f[0] = SUB;
  for (let i = 0; i < row.length; i++) f[i + 1] = (row[i]! - (i >= 3 ? row[i - 3]! : 0)) & 255;
  return [f.subarray(0, LEFT_BYTES), f.subarray(LEFT_BYTES)];
}

/* ---------- writing a card over a champion's ---------- */
/** One growing buffer the whole card is written into: copied chunks, and new ones with their pieces. */
class Writer {
  buf: Uint8Array;
  n = 0;
  private bits = 0;
  private nbits = 0;
  private chunkAt = 0;
  // the piece being written: its Adler-32 sums, the run of one byte value not yet written, the last byte written
  private s1 = 1;
  private s2 = 0;
  private runV = -1;
  private runN = 0;
  private prev = -1;

  constructor(size: number) { this.buf = new Uint8Array(size); }
  room(k: number) {
    if (this.n + k <= this.buf.length) return;
    const b = new Uint8Array(Math.max(this.buf.length * 2, this.n + k)); b.set(this.buf.subarray(0, this.n)); this.buf = b;
  }
  copy(b: Uint8Array) { this.room(b.length); this.buf.set(b, this.n); this.n += b.length; }
  private put(v: number, n: number) {
    this.bits |= v << this.nbits; this.nbits += n;
    while (this.nbits >= 8) { this.buf[this.n++] = this.bits; this.bits >>>= 8; this.nbits -= 8; }
  }

  /** Starts an IDAT chunk holding one piece of `size` bytes uncompressed. */
  open(size: number) {
    this.room(size * 2 + 64);
    this.chunkAt = this.n; this.n += 8;
    this.s1 = 1; this.s2 = 0; this.runV = -1; this.runN = 0; this.prev = -1;
    this.put(0b010, 3);                                       // a block of fixed codes, not the last
  }
  /** Ends the piece with a sync flush and the chunk with its CRC; returns the piece's Adler-32. */
  close(): number {
    this.flush();
    this.put(LIT_CODE[256]!, LIT_LEN[256]!);                   // end of block
    this.block(new Uint8Array(0), 0, 0);                      // the sync flush: an empty stored block
    const len = this.n - this.chunkAt - 8, b = this.buf, at = this.chunkAt;
    b[at] = len >>> 24; b[at + 1] = len >>> 16; b[at + 2] = len >>> 8; b[at + 3] = len;
    b[at + 4] = 73; b[at + 5] = 68; b[at + 6] = 65; b[at + 7] = 84;     // IDAT
    const crc = crc32(b.subarray(at + 4, this.n));
    this.room(4);
    b[this.n] = crc >>> 24; b[this.n + 1] = crc >>> 16; b[this.n + 2] = crc >>> 8; b[this.n + 3] = crc; this.n += 4;
    return (((this.s2 % BASE) << 16) | (this.s1 % BASE)) >>> 0;
  }
  /** Adds pixels [from, to) of `px` filtered with Sub (each byte less the byte one pixel before), through `scratch`. */
  coded(px: Uint8Array, from: number, to: number, scratch: Uint8Array) {
    const n = to - from;
    for (let k = 0; k < n; k++) scratch[k] = px[from + k]! - px[from + k - 3]!;
    for (let i = 0; i < n;) {
      const v = scratch[i]!;
      let j = i + 1;
      while (j < n && scratch[j] === v) j++;
      this.bytes(v, j - i);
      i = j;
    }
  }
  /** Adds `n` copies of byte `v`. Runs are written out when they end, as a literal and copies of it. */
  bytes(v: number, n: number) {
    if (v === this.runV) { this.runN += n; return; }
    this.flush();
    this.runV = v; this.runN = n;
  }
  private flush() {
    let v = this.runV, n = this.runN;
    if (n <= 0) return;
    // the sums over n bytes of value v, at once
    this.s2 = (this.s2 + n * this.s1 + v * n * (n + 1) / 2) % BASE;
    this.s1 = (this.s1 + n * v) % BASE;
    this.runN = 0;
    if (this.prev !== v) { this.put(LIT_CODE[v]!, LIT_LEN[v]!); this.prev = v; n--; }
    while (n >= 3) {
      const l = n > 258 ? (n - 258 < 3 ? n - 3 : 258) : n, s = LEN_SYM[l]!;
      this.put(LIT_CODE[s]!, LIT_LEN[s]!);
      if (LEN_XBITS[l]) this.put(LEN_XVAL[l]!, LEN_XBITS[l]!);
      this.put(0, 5);                                         // distance 1
      n -= l;
    }
    for (; n > 0; n--) this.put(LIT_CODE[v]!, LIT_LEN[v]!);
  }
  /** Adds bytes [from, to) of `d` as they are, in a stored block of their own: pictures and art, which fixed codes would only make longer. */
  stored(d: Uint8Array, from: number, to: number) {
    if (to <= from) return;
    this.flush();
    this.put(LIT_CODE[256]!, LIT_LEN[256]!);                   // end the block of fixed codes
    let s1 = this.s1, s2 = this.s2;
    for (let i = from; i < to;) {
      const end = Math.min(to, i + 3800);
      for (; i < end; i++) { s1 += d[i]!; s2 += s1; }
      s1 %= BASE; s2 %= BASE;
    }
    this.s1 = s1; this.s2 = s2; this.prev = d[to - 1]!;
    this.block(d, from, to);
    this.put(0b010, 3);                                       // and back to fixed codes
  }
  private block(d: Uint8Array, from: number, to: number) {
    const len = to - from;
    this.put(0, 3);
    if (this.nbits) this.put(0, 8 - this.nbits);
    const b = this.buf, n = this.n;
    b[n] = len; b[n + 1] = len >> 8; b[n + 2] = ~len; b[n + 3] = ~len >> 8;
    b.set(d.subarray(from, to), n + 4);
    this.n += len + 4;
  }
}

/** [from, to) pairs, each `widen` longer, sorted and joined where they overlap or touch */
function merged(s: number[], widen = 0): number[] {
  if (s.length <= 2) return s.length ? [s[0]!, s[1]! + widen] : [];
  const r: [number, number][] = [];
  for (let i = 0; i < s.length; i += 2) r.push([s[i]!, s[i + 1]! + widen]);
  r.sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  for (const [a, b] of r) {
    if (out.length && a <= out[out.length - 1]!) out[out.length - 1] = Math.max(out[out.length - 1]!, b);
    else out.push(a, b);
  }
  return out;
}


/** Codes columns [from, to) of a canvas row into the open piece, Sub-filtered on the way. Only what was drawn is read
    (each span with one more pixel, where the background resumes); the rest is background, which Sub turns into zeros.
    Pictures are stored, the rest coded. The pixel before `from` is background, or, at the row's start, nothing. */
function codeRow(w: Writer, px: Uint8Array, at: number, from: number, to: number, spans: number[], pics: number[], bg: number[], scratch: Uint8Array) {
  let x = from, pi = 0;
  if (from === 0) {
    // the first pixel is filtered against nothing
    const first = spans.length > 0 && spans[0] === 0;
    for (let k = 0; k < 3; k++) w.bytes(first ? px[at + k]! : bg[k]!, 1);
    x = 1;
  }
  for (let i = 0; i < spans.length; i += 2) {
    const a = Math.max(x, spans[i]!), b = Math.min(to, spans[i + 1]!);
    if (b <= a) continue;
    w.bytes(0, (a - x) * 3);
    for (let p = a; p < b;) {
      while (pi < pics.length && pics[pi + 1]! <= p) pi += 2;
      const pic = pi < pics.length && pics[pi]! < b;
      const codeTo = pic ? Math.max(p, pics[pi]!) : b;
      w.coded(px, at + p * 3, at + codeTo * 3, scratch);
      if (!pic) break;
      const picTo = Math.min(b, pics[pi + 1]!);
      for (let k = at + codeTo * 3, end = at + picTo * 3, o = 0; k < end; k++, o++) scratch[o] = px[k]! - px[k - 3]!;
      w.stored(scratch, 0, (picTo - codeTo) * 3);
      p = picTo;
    }
    x = b;
  }
  w.bytes(0, (to - x) * 3);
}

export interface Plan {
  /** rows whose left half is the champion card's, as it is */
  keepLeft: (y: number) => boolean;
  /** rows whose right half is the champion card's, as it is; the others are background where nothing is drawn */
  keepRight: (y: number) => boolean;
}
/** A card: the champion's card with what the canvas drew on top. Halves of rows the plan keeps are copied from the
    champion's card and must not be drawn on; the others are written anew, as background and what was drawn. */
export function writeOver(card: Card, c: { px: Uint8Array; spans: number[][]; pictures: number[][]; bg: number }, plan: Plan): Uint8Array {
  const w = new Writer(card.right.reduce((n, r) => n + r.length, 0) + card.left.reduce((n, r) => n + r.length, 0) + 300_000);
  w.copy(card.head); w.copy(card.start);
  const px = c.px, bg = [c.bg >> 16, (c.bg >> 8) & 255, c.bg & 255];
  const scratch = new Uint8Array(LEFT_BYTES);
  // a half nothing is drawn on is the same piece every time
  const blank: (null | { piece: Uint8Array; adler: number })[] = [null, null];
  let adler = 1;
  for (let y = 0; y < H; y++) {
    const at = y * W * 3, spans = merged(c.spans[y]!, 1), pics = merged(c.pictures[y]!);
    // the right half's filtering starts from the left half's last pixel, which is background on every card
    if (spans.length && bg.some((v, k) => px[at + (SPLIT - 1) * 3 + k] !== v)) throw new Error(`row ${y} was drawn on at the split`);
    for (const side of [0, 1]) {
      const from = side ? SPLIT : 0, to = side ? W : SPLIT, size = side ? RIGHT_BYTES : LEFT_BYTES;
      let drawn = false;
      for (let i = 0; i < spans.length && !drawn; i += 2) drawn = spans[i]! < to && spans[i + 1]! > from + (side ? 1 : 0);
      if (side ? plan.keepRight(y) : plan.keepLeft(y)) {
        if (drawn) throw new Error(`row ${y} is the champion card's and was drawn on`);
        w.copy(side ? card.right[y]! : card.left[y]!);
        adler = adlerCombine(adler, side ? card.rightAdler[y]! : card.leftAdler[y]!, size);
        continue;
      }
      const b = blank[side];
      if (!drawn && b) { w.copy(b.piece); adler = adlerCombine(adler, b.adler, size); continue; }
      const start = w.n;
      w.open(size);
      if (!side) w.bytes(SUB, 1);
      codeRow(w, px, at, from, to, drawn ? spans : [], drawn ? pics : [], bg, scratch);
      const a = w.close();
      if (!drawn) blank[side] = { piece: w.buf.slice(start, w.n), adler: a };
      adler = adlerCombine(adler, a, size);
    }
  }
  w.copy(zend(adler)); w.copy(chunk('IEND', new Uint8Array(0)));
  return w.buf.subarray(0, w.n);
}
