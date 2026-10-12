/* Stage 3: the pictures. The site serves its own copies of the game art, packed so that a
   whole picker arrives in one request: one sheet of every item icon, one of every champion
   portrait, one strip of five ability icons per champion and one splash per champion.
   Originals are mirrored into data/raw/<patch>/art/; the packed files go to web/art/<version>/,
   where <version> is a hash of their contents, so they can be cached forever. */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import type { ChampionIndexEntry } from '../server/dataset.ts';
import type { ChampionData, ItemData, Slot } from '../shared/types.ts';
import { CDRAGON_CDN, DDRAGON, get, pool } from './fetch.ts';
import { DATA_DIR, ROOT, distDir, rawDir } from './paths.ts';

const ITEM_PX = 64, CHAMPION_PX = 120, ABILITY_PX = 64, SPLASH_WIDTH = 960;
const KIT: Slot[] = ['p', 'q', 'w', 'e', 'r'];

/** One sheet of square tiles, read left to right, top to bottom, in the order of `ids`. */
export interface ArtSheet { cols: number; rows: number; ids: (string | number)[] }
/** web/art/index.json: what the site needs to find a picture. */
export interface ArtIndex { version: string; patch: string; items: ArtSheet; champions: ArtSheet; kit: Slot[] }

export interface ArtOptions {
  patch?: string;
  /** re-download originals that are already in the mirror */
  force?: boolean;
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
  };
  await writeFile(join(root, 'index.json'), JSON.stringify(art));

  for (const m of missing) log(`  missing: ${m}`);
  const bytes = names.reduce((s, n) => s + out.get(n)!.length, 0);
  log(`wrote ${names.length} files, ${(bytes / 1e6).toFixed(1)} MB -> ${join(root, version)}`);
  return art;
}
