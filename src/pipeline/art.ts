/* Stage 3: the pictures. The site serves its own copies of the game art, packed so that a
   whole picker arrives in one request: one sheet of every item icon, one of every champion
   portrait, one strip of five ability icons per champion and one splash per champion,
   and one strip of the game's stat icons (the ones item tooltips put beside a stat), cut from its texticons.png.
   Originals are mirrored into data/raw/<patch>/art/; the packed files go to web/art/<version>/,
   where <version> is a hash of their contents, so they can be cached forever. */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { ChampionIndexEntry } from '../server/dataset.ts';
import type { ChampionData, ItemData, Slot } from '../shared/types.ts';
import { CDRAGON, CDRAGON_CDN, DDRAGON, cdragonPath, get, pool } from './fetch.ts';
import { DATA_DIR, ROOT, distDir, rawDir } from './paths.ts';

const ITEM_PX = 64, CHAMPION_PX = 120, ABILITY_PX = 64, SPLASH_WIDTH = 960;
const KIT: Slot[] = ['p', 'q', 'w', 'e', 'r'];
const STAT_ICONS_PATH = join(ROOT, 'src', 'pipeline', 'stat-icons.json');
interface StatIcons { about: string; checked: string; size: number; icons: Record<string, { x: number; y: number; pixels: string }> }

/** One sheet of square tiles, read left to right, top to bottom, in the order of `ids`. */
export interface ArtSheet { cols: number; rows: number; ids: (string | number)[] }
/** web/art/index.json: what the site needs to find a picture. */
export interface ArtIndex {
  version: string; patch: string; items: ArtSheet; champions: ArtSheet; kit: Slot[];
  /** stats.webp: one strip, a tile per stat in this order */
  stats: string[];
}

export interface ArtOptions {
  patch?: string;
  /** re-download originals that are already in the mirror */
  force?: boolean;
  /** record the stat icons as they are now, after a person has looked at them (see stat-icons.json) */
  accept?: boolean;
  log?: (msg: string) => void;
}

export async function buildArt(opts: ArtOptions = {}): Promise<ArtIndex> {
  const log = opts.log ?? (() => {});
  const patch: string = opts.patch ?? JSON.parse(await readFile(join(DATA_DIR, 'dist', 'latest.json'), 'utf8')).patch;
  const dist = distDir(patch), mirror = join(rawDir(patch), 'art');
  const index: ChampionIndexEntry[] = JSON.parse(await readFile(join(dist, 'champions.json'), 'utf8'));
  const items: ItemData[] = JSON.parse(await readFile(join(dist, 'items.json'), 'utf8'));
  const missing: string[] = [];

  /** An original from the mirror, downloading it first if needed; undefined if no source has it. */
  const original = async (path: string, ...urls: string[]): Promise<Buffer | undefined> => {
    const dest = join(mirror, path);
    if (!opts.force && existsSync(dest)) return readFile(dest);
    for (const url of urls) {
      try {
        const buf = await get(url);
        await mkdir(dirname(dest), { recursive: true });
        await writeFile(dest, buf);
        return buf;
      } catch { /* try the next source */ }
    }
    missing.push(path);
    return undefined;
  };
  const tile = async (buf: Buffer | undefined, px: number) => buf
    ? sharp(buf).resize(px, px).png().toBuffer()
    : sharp({ create: { width: px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } }).png().toBuffer();
  const sheet = async (tiles: Buffer[], px: number, cols: number) => {
    const rows = Math.ceil(tiles.length / cols);
    return sharp({ create: { width: cols * px, height: rows * px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite(tiles.map((input, i) => ({ input, left: (i % cols) * px, top: Math.floor(i / cols) * px })))
      .webp({ quality: 84, effort: 6 }).toBuffer();
  };
  const out = new Map<string, Buffer>();

  log(`art for patch ${patch}`);
  const itemIds = items.map(i => i.id).sort((a, b) => a - b);
  const itemTiles = await pool(itemIds, 12, async id => tile(await original(`item/${id}.png`, `${DDRAGON}/cdn/${patch}/img/item/${id}.png`), ITEM_PX));
  const itemCols = Math.ceil(Math.sqrt(itemIds.length));
  out.set('items.webp', await sheet(itemTiles, ITEM_PX, itemCols));
  log(`  items ${itemIds.length}`);

  const champIds = index.map(c => c.id).sort();
  const champTiles = await pool(champIds, 12, async id => tile(await original(`champion/${id}.png`, `${DDRAGON}/cdn/${patch}/img/champion/${id}.png`), CHAMPION_PX));
  const champCols = Math.ceil(Math.sqrt(champIds.length));
  out.set('champions.webp', await sheet(champTiles, CHAMPION_PX, champCols));
  log(`  champions ${champIds.length}`);

  let done = 0;
  await pool(champIds, 6, async id => {
    const champ: ChampionData = JSON.parse(await readFile(join(dist, 'champions', `${id}.json`), 'utf8'));
    const tiles: Buffer[] = [];
    for (const k of KIT) {
      const icon = champ.slots[k].icon;
      // Data Dragon names the file; Community Dragon can find the icon by slot when it does not
      const urls = [...(icon ? [`${DDRAGON}/cdn/${patch}/img/${k === 'p' ? 'passive' : 'spell'}/${icon}`] : []), `${CDRAGON_CDN}/${patch}/champion/${champ.key}/ability-icon/${k}`];
      tiles.push(await tile(await original(`kit/${id}.${k}.png`, ...urls), ABILITY_PX));
    }
    out.set(`kit/${id}.webp`, await sheet(tiles, ABILITY_PX, KIT.length));
    const splash = await original(`splash/${id}.jpg`, `${DDRAGON}/cdn/img/champion/splash/${id}_0.jpg`);
    if (splash) out.set(`splash/${id}.webp`, await sharp(splash).resize({ width: SPLASH_WIDTH }).webp({ quality: 74, effort: 6 }).toBuffer());
    if (++done % 25 === 0 || done === champIds.length) log(`  kits and splashes ${done}/${champIds.length}`);
  });

  // The stat icons. Nothing says where on the sheet each one is, so the positions are kept by hand
  // and every tile is checked: an icon that moved or changed stops the build instead of showing the wrong one.
  const icons: StatIcons = JSON.parse(await readFile(STAT_ICONS_PATH, 'utf8'));
  const sheetPng = await original('texticons.png', `${CDRAGON}/${cdragonPath(patch)}/game/assets/ux/fonts/texticons.png`);
  if (!sheetPng) throw new Error('texticons.png could not be downloaded: the stat icons cannot be cut');
  const statIds = Object.keys(icons.icons), px = icons.size, changed: string[] = [];
  const statTiles = await Promise.all(statIds.map(async k => {
    const at = icons.icons[k]!;
    const pixels = await sharp(sheetPng).extract({ left: at.x, top: at.y, width: px, height: px }).ensureAlpha().raw().toBuffer();
    const h = createHash('sha256').update(pixels).digest('hex').slice(0, 16);
    if (h !== at.pixels) { changed.push(k); at.pixels = h; }
    return sharp(pixels, { raw: { width: px, height: px, channels: 4 } }).png().toBuffer();
  }));
  if (changed.length && !opts.accept) {
    throw new Error(`stat icons changed on texticons.png: ${changed.join(', ')}. Look at the sheet (${join(mirror, 'texticons.png')}), fix the positions in src/pipeline/stat-icons.json if an icon moved, then run with --accept.`);
  }
  if (changed.length || (opts.accept && icons.checked !== patch)) {
    icons.checked = patch;
    await writeFile(STAT_ICONS_PATH, JSON.stringify(icons, null, 1) + '\n');
    log(`  stat icons recorded as of ${patch}${changed.length ? `: ${changed.join(', ')} changed` : ''}`);
  }
  out.set('stats.webp', await sharp({ create: { width: statIds.length * px, height: px, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(statTiles.map((input, i) => ({ input, left: i * px, top: 0 }))).webp({ lossless: true }).toBuffer());
  log(`  stat icons ${statIds.length}`);

  const names = [...out.keys()].sort();
  const hash = createHash('sha256');
  for (const name of names) hash.update(name).update(out.get(name)!);
  const version = hash.digest('hex').slice(0, 10);

  const root = join(ROOT, 'web', 'art');
  await mkdir(root, { recursive: true });
  // one version is kept: the site only ever asks for the one named in index.json
  for (const e of await readdir(root, { withFileTypes: true })) if (e.isDirectory() && e.name !== version) await rm(join(root, e.name), { recursive: true });
  for (const name of names) {
    const dest = join(root, version, name);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, out.get(name)!);
  }
  const art: ArtIndex = {
    version, patch,
    items: { cols: itemCols, rows: Math.ceil(itemIds.length / itemCols), ids: itemIds },
    champions: { cols: champCols, rows: Math.ceil(champIds.length / champCols), ids: champIds },
    kit: KIT,
    stats: statIds,
  };
  await writeFile(join(root, 'index.json'), JSON.stringify(art));

  for (const m of missing) log(`  missing: ${m}`);
  const bytes = names.reduce((s, n) => s + out.get(n)!.length, 0);
  log(`wrote ${names.length} files, ${(bytes / 1e6).toFixed(1)} MB -> ${join(root, version)}`);
  return art;
}
