/* The preview images made at build time, written by scripts/site.ts into .build/site/og/:
     /og/<id>.png         each champion's card (Data Dragon id: /og/Vayne.png, /og/MonkeyKing.png),
                          the image of a champion's own page and the base of every shared build's card
     /og/default.png      the site's card, for a page without a build
     /og/items/<id>.bin   each item's icon, ICON pixels square, raw RGB, for the Worker to draw
   All of it follows from the dataset, the art, the glyphs and the code drawing it, so it is kept in
   .build/og-cache/ under a hash of those and only drawn again when one of them changes. */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { constants, deflateRawSync, inflateRawSync } from 'node:zlib';
import sharp from 'sharp';
import { ART_END, ART_W, BG, ICON, championCard } from '../src/og/card.ts';
import { readAtlas } from '../src/og/font.ts';
import { H } from '../src/og/png.ts';
import type { ArtIndex } from '../src/pipeline/art.ts';
import { ROOT } from '../src/pipeline/paths.ts';
import { Dataset } from '../src/server/dataset.ts';

const hex = (c: number) => '#' + c.toString(16).padStart(6, '0');

/** The splash art for the top right of a card: darkened, and faded into the background towards the text and, by ART_END, completely. */
async function artPanel(file: string): Promise<Uint8Array> {
  const bg = hex(BG);
  const shade = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${ART_W}" height="${H}">
    <defs>
      <linearGradient id="l" x1="0" x2="1"><stop offset="0" stop-color="${bg}"/><stop offset=".12" stop-color="${bg}" stop-opacity=".8"/><stop offset=".4" stop-color="${bg}" stop-opacity=".3"/><stop offset=".7" stop-color="${bg}" stop-opacity="0"/></linearGradient>
      <linearGradient id="b" x1="0" x2="0" y1="0" y2="${ART_END}" gradientUnits="userSpaceOnUse"><stop offset=".5" stop-color="${bg}" stop-opacity="0"/><stop offset=".8" stop-color="${bg}" stop-opacity=".6"/><stop offset="1" stop-color="${bg}"/></linearGradient>
    </defs>
    <rect width="100%" height="100%" fill="url(#b)"/><rect width="100%" height="100%" fill="url(#l)"/>
  </svg>`);
  // the art fills the panel down to ART_END, cut where sharp finds the most to look at (a face, usually), and background below
  const top = await sharp(file).resize({ width: ART_W, height: ART_END + 20, fit: 'cover', position: sharp.strategy.attention }).toBuffer();
  const px = new Uint8Array(await sharp({ create: { width: ART_W, height: H, channels: 3, background: bg } }).composite([{ input: top, top: 0, left: 0 }]).png().toBuffer()
    .then(b => sharp(b).modulate({ brightness: 0.8 }).blur(0.6).composite([{ input: shade }]).removeAlpha().raw().toBuffer()));
  // six bits a channel, with ordered dither so the fades do not band: a darkened backdrop loses nothing visible and compresses by a third
  const bayer = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
  for (let y = 0, i = 0; y < H; y++) for (let x = 0; x < ART_W; x++) {
    const d = bayer[(y & 3) * 4 + (x & 3)]! / 16 * 4 - 2;
    for (let k = 0; k < 3; k++, i++) px[i] = Math.max(0, Math.min(255, Math.round((px[i]! + d) / 4) * 4));
  }
  // the first column is exactly the background, so a card's left half always meets it the same way, and so is all below the art
  const bgPx = [BG >> 16, (BG >> 8) & 255, BG & 255];
  for (let y = 0; y < H; y++) for (let x = 0; x < (y < ART_END ? 1 : ART_W); x++) px.set(bgPx, (y * ART_W + x) * 3);
  return px;
}

const compress = (b: Uint8Array) => deflateRawSync(b, { level: 9, finishFlush: constants.Z_SYNC_FLUSH });
const card = (art: Uint8Array, fonts: ReturnType<typeof readAtlas>, o: Parameters<typeof championCard>[2]) => championCard(art, fonts, o, compress);

export async function buildOg(site: string) {
  const data = new Dataset();
  const art: ArtIndex = JSON.parse(readFileSync(join(ROOT, 'web', 'art', 'index.json'), 'utf8'));
  const glyphs = readFileSync(join(ROOT, 'src', 'og', 'glyphs.bin'));
  const hash = createHash('sha256');
  for (const f of ['src/og/card.ts', 'src/og/canvas.ts', 'src/og/font.ts', 'src/og/png.ts', 'scripts/og.ts']) hash.update(readFileSync(join(ROOT, f)));
  hash.update(glyphs).update(art.version).update(JSON.stringify(data.manifest)).update(JSON.stringify(data.index.map(c => [c.id, c.name, c.title])));
  const key = hash.digest('hex').slice(0, 16);
  const cache = join(ROOT, '.build', 'og-cache'), done = join(cache, key);

  if (!existsSync(done)) {
    // drawn into a folder of this process's own: wrangler dev may start the same build while one runs
    const t = Date.now(), tmp = join(cache, `${key}.${process.pid}.tmp`);
    mkdirSync(join(tmp, 'items'), { recursive: true });
    const fonts = readAtlas(inflateRawSync(glyphs));
    const patch = data.manifest.displayPatch;
    const more = ['Combo damage, DPS and time to kill,', 'for any champion and six items.'];
    const splash = (id: string) => join(ROOT, 'web', 'art', art.version, 'splash', `${id}.webp`);
    let bytes = 0;
    for (const c of data.index) {
      if (!existsSync(splash(c.id))) continue;
      const png = card(await artPanel(splash(c.id)), fonts, { title: c.name, sub: c.title.charAt(0).toUpperCase() + c.title.slice(1), lead: 'Which build hits harder?', more, patch });
      writeFileSync(join(tmp, `${c.id}.png`), png);
      bytes += png.length;
    }
    writeFileSync(join(tmp, 'default.png'), card(await artPanel(splash('Kaisa')), fonts,
      { title: 'Build vs build', sub: 'League of Legends item builds, side by side', lead: 'Which build hits harder?', more, patch }));
    // the icons, cut from the site's sheet of them
    const sheet = join(ROOT, 'web', 'art', art.version, 'items.webp');
    const { data: all, info } = await sharp(sheet).flatten({ background: hex(BG) }).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    await Promise.all(art.items.ids.map(async (id, n) => {
      const x = (n % art.items.cols) * (info.width / art.items.cols), y = Math.floor(n / art.items.cols) * (info.height / art.items.rows);
      const icon = await sharp(all, { raw: { width: info.width, height: info.height, channels: 3 } })
        .extract({ left: x, top: y, width: info.width / art.items.cols, height: info.height / art.items.rows }).resize(ICON, ICON, { kernel: 'lanczos3' }).raw().toBuffer();
      writeFileSync(join(tmp, 'items', `${id}.bin`), icon);
    }));
    // older drawings go, and what builds that were stopped left behind, but not another build's work in progress
    const alive = (pid: number) => { try { process.kill(pid, 0); return true; } catch { return false; } };
    for (const old of readdirSync(cache)) {
      const pid = /\.(\d+)\.tmp$/.exec(old)?.[1];
      if (old !== key && (!pid || (Number(pid) !== process.pid && !alive(Number(pid))))) rmSync(join(cache, old), { recursive: true, force: true });
    }
    try { renameSync(tmp, done); } catch { rmSync(tmp, { recursive: true, force: true }); }   // another build finished first
    if (!existsSync(done)) throw new Error('og cache: nothing drawn');
    console.log(`og -> ${data.index.length} champion cards (${(bytes / data.index.length / 1024).toFixed(0)} KB each), ${art.items.ids.length} icons, in ${((Date.now() - t) / 1000).toFixed(0)} s`);
  }
  cpSync(done, join(site, 'og'), { recursive: true });
  return key;
}

if (import.meta.main) await buildOg(join(ROOT, '.build', 'site'));
