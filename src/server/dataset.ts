/* Loads a compiled dataset from disk for the API. The index and items are small and
   read up front; champion files are read on first use and kept. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DataSource } from '../engine/types.ts';
import { DATA_DIR, distDir } from '../pipeline/paths.ts';
import { servedPatches, type PatchKind } from '../shared/patch.ts';
import type { BaseStats, ChampionData, DatasetManifest, ItemData, ModelStatus, Slot } from '../shared/types.ts';
import { patchSet, type PatchSet } from './patches.ts';

export interface ChampionIndexEntry {
  id: string; key: number; name: string; title: string; tags: string[]; ranged: boolean;
  stats: BaseStats;
  status: Record<Slot, ModelStatus>;
}

/** What the API serves from. On Node it is read from disk, on Workers it is bundled with the code. */
export interface ServedData extends DataSource {
  readonly patch: string;
  readonly manifest: DatasetManifest;
  readonly index: ChampionIndexEntry[];
  readonly items: ItemData[];
}

export class Dataset implements ServedData {
  readonly patch: string;
  readonly manifest: DatasetManifest;
  readonly index: ChampionIndexEntry[];
  readonly items: ItemData[];
  private readonly dir: string;
  private readonly itemById: Map<number, ItemData>;
  private readonly ids: Map<string, string>;
  private readonly champions = new Map<string, ChampionData>();

  constructor(patch?: string) {
    this.patch = patch ?? livePatch();
    this.dir = distDir(this.patch);
    const read = (f: string) => JSON.parse(readFileSync(join(this.dir, f), 'utf8'));
    this.manifest = read('manifest.json');
    this.index = read('champions.json');
    this.items = read('items.json');
    this.itemById = new Map(this.items.map(i => [i.id, i]));
    // ids are matched without regard to case; the lookup also keeps request strings away from the file system
    this.ids = new Map(this.index.map(c => [c.id.toLowerCase(), c.id]));
  }

  champion(id: string): ChampionData | undefined {
    const real = this.ids.get(String(id).toLowerCase());
    if (!real) return undefined;
    let c = this.champions.get(real);
    if (!c) {
      c = JSON.parse(readFileSync(join(this.dir, 'champions', `${real}.json`), 'utf8')) as ChampionData;
      this.champions.set(real, c);
    }
    return c;
  }

  item(id: number): ItemData | undefined {
    return this.itemById.get(id);
  }
}

/** The patch the site opens on, as data/dist/latest.json names it. */
export const livePatch = (): string => {
  const latest = join(DATA_DIR, 'dist', 'latest.json');
  if (!existsSync(latest)) throw new Error('no dataset found: run `npm run data:fetch` and `npm run data:build` first');
  return JSON.parse(readFileSync(latest, 'utf8')).patch;
};

/** The patches to serve from data/dist (src/shared/patch.ts, servedPatches), around `live` or else the live patch. */
export function servedFromDisk(live = livePatch()): { patch: string; kind: PatchKind }[] {
  const dir = join(DATA_DIR, 'dist');
  const compiled = readdirSync(dir).filter(p => existsSync(join(dir, p, 'manifest.json')));
  return servedPatches(compiled, live);
}

/** Every patch served, read from disk. */
export const loadPatches = (live?: string): PatchSet =>
  patchSet(servedFromDisk(live).map(({ patch, kind }) => ({ data: new Dataset(patch), kind })));
