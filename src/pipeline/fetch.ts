/* Stage 1: mirror the upstream files for one patch into data/raw/<patch>/.
   Everything downstream reads from that mirror, so a build is reproducible and
   never talks to the network. */
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { rawDir } from './paths.ts';

export const DDRAGON = 'https://ddragon.leagueoflegends.com';
const CDRAGON = 'https://raw.communitydragon.org';
/** Community Dragon's lookup service: finds a picture by what it is instead of by file name. */
export const CDRAGON_CDN = 'https://cdn.communitydragon.org';
const USER_AGENT = `itemize.lol-pipeline/0.1 (${process.env.ITEMIZE_CONTACT ?? 'https://itemize.lol'})`;

export interface RawFile {
  /** path relative to the patch's raw directory */
  path: string;
  url: string;
  source: 'ddragon' | 'cdragon';
  sha256: string;
  bytes: number;
}
export interface RawManifest {
  patch: string;
  /** Data Dragon version, e.g. 16.20.1 */
  ddragon: string;
  /** Community Dragon patch path and the exact game build it reports */
  cdragon: { path: string; build: string };
  fetchedAt: string;
  files: RawFile[];
}

export async function get(url: string, attempt = 1): Promise<Buffer> {
  try {
    const res = await fetch(url, { headers: { 'user-agent': USER_AGENT }, signal: AbortSignal.timeout(180_000) });
    if (!res.ok) throw Object.assign(new Error(`${res.status} ${res.statusText} for ${url}`), { status: res.status });
    return Buffer.from(await res.arrayBuffer());
  } catch (err) {
    const status = (err as { status?: number }).status;
    if (attempt >= 4 || (status !== undefined && status < 500 && status !== 429)) throw err;
    await new Promise(r => setTimeout(r, 750 * 2 ** attempt));
    return get(url, attempt + 1);
  }
}

/** Runs `fn` over `items` with a small fixed concurrency so we stay polite to community-run hosts. */
export async function pool<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]!);
    }
  }));
  return out;
}

export async function latestPatch(): Promise<string> {
  const versions = JSON.parse((await get(`${DDRAGON}/api/versions.json`)).toString('utf8')) as string[];
  const v = versions[0];
  if (!v) throw new Error('Data Dragon returned no versions');
  return v;
}

/** 16.20.1 -> 16.20: Community Dragon keys its mirrors by major.minor. */
export const cdragonPath = (ddragonVersion: string) => ddragonVersion.split('.').slice(0, 2).join('.');

export interface FetchOptions {
  patch?: string;
  /** re-download files that are already in the mirror */
  force?: boolean;
  log?: (msg: string) => void;
}

export async function fetchPatch(opts: FetchOptions = {}): Promise<RawManifest> {
  const log = opts.log ?? (() => {});
  const dd = opts.patch ?? await latestPatch();
  const cd = cdragonPath(dd);
  const dir = rawDir(dd);
  const files: RawFile[] = [];

  const grab = async (source: RawFile['source'], path: string, url: string): Promise<Buffer> => {
    const dest = join(dir, path);
    let buf: Buffer;
    if (!opts.force && existsSync(dest)) buf = await readFile(dest);
    else {
      buf = await get(url);
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, buf);
    }
    files.push({ path, url, source, sha256: createHash('sha256').update(buf).digest('hex'), bytes: buf.length });
    return buf;
  };

  log(`patch ${dd} (Community Dragon ${cd})`);
  const champIndex = JSON.parse((await grab('ddragon', 'ddragon/champion.json', `${DDRAGON}/cdn/${dd}/data/en_US/champion.json`)).toString('utf8'));
  await grab('ddragon', 'ddragon/championFull.json', `${DDRAGON}/cdn/${dd}/data/en_US/championFull.json`);
  await grab('ddragon', 'ddragon/item.json', `${DDRAGON}/cdn/${dd}/data/en_US/item.json`);

  const build = JSON.parse((await grab('cdragon', 'cdragon/content-metadata.json', `${CDRAGON}/${cd}/content-metadata.json`)).toString('utf8')).version as string;
  await grab('cdragon', 'cdragon/items.bin.json', `${CDRAGON}/${cd}/game/items.cdtb.bin.json`);
  await grab('cdragon', 'cdragon/stringtable.json', `${CDRAGON}/${cd}/game/en_us/data/menu/en_us/lol.stringtable.json`);

  const ids = Object.keys(champIndex.data).sort();
  let done = 0;
  await pool(ids, 4, async id => {
    const alias = id.toLowerCase();
    await grab('cdragon', `cdragon/characters/${alias}.bin.json`, `${CDRAGON}/${cd}/game/data/characters/${alias}/${alias}.bin.json`);
    if (++done % 25 === 0 || done === ids.length) log(`  champions ${done}/${ids.length}`);
  });

  files.sort((a, b) => a.path.localeCompare(b.path));
  const manifest: RawManifest = { patch: dd, ddragon: dd, cdragon: { path: cd, build }, fetchedAt: new Date().toISOString(), files };
  await writeFile(join(dir, 'manifest.json'), JSON.stringify(manifest, null, 1));
  log(`mirrored ${files.length} files, ${(files.reduce((s, f) => s + f.bytes, 0) / 1e6).toFixed(1)} MB -> ${dir}`);
  return manifest;
}
