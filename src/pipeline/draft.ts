/* Binds one champion's model file, or the item model files, against the patch, in memory.

   `data:build` compiles everything and rewrites data/dist/, which is slow to wait
   for and cannot be done by several writers at once. This reads the same raw files
   and the one model file, and hands back what the build would have written for
   that champion, so a model can be checked while it is being written. Items are
   compiled data already, so their drafts start from the last build's items.json. */
import { existsSync } from 'node:fs';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ChampionModelFile, ItemModelFile } from '../models/dsl.ts';
import type { ChampionData, ItemData } from '../shared/types.ts';
import { latestMirroredPatch } from './build.ts';
import { newLog } from './calc.ts';
import { compileChampion } from './champion.ts';
import { resolveChampion, resolveItem, type Lock, type ModelIssue } from './models.ts';
import { DATA_DIR, distDir, rawDir, ROOT } from './paths.ts';

const MODELS_DIR = join(ROOT, 'src', 'models');
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

export interface Draft {
  champion: ChampionData;
  /** what the build would print as MODEL DOES NOT BIND */
  issues: ModelIssue[];
  /** false when the champion has no model file and everything is automatic */
  modeled: boolean;
}

export async function draftChampion(name: string, patch?: string): Promise<Draft> {
  const raw = rawDir(patch ?? await latestMirroredPatch());
  const dd = (await readJson(join(raw, 'ddragon', 'championFull.json'))).data as Record<string, any>;
  const id = Object.keys(dd).find(k => k.toLowerCase() === name.toLowerCase() || String(dd[k].name).toLowerCase() === name.toLowerCase());
  if (!id) throw new Error(`no champion "${name}"`);
  const table: Record<string, string> = (await readJson(join(raw, 'cdragon', 'stringtable.json'))).entries;
  const bin = await readJson(join(raw, 'cdragon', 'characters', `${id.toLowerCase()}.bin.json`));
  const compiled = compileChampion(dd[id], bin, table, newLog());

  const file = join(MODELS_DIR, 'champions', `${id}.ts`);
  const issues: ModelIssue[] = [];
  let model: ChampionModelFile | undefined;
  if (existsSync(file)) {
    // the query string gets past the module cache, so a long-running caller sees edits
    model = (await import(`${pathToFileURL(file).href}?t=${Date.now()}`)).default;
    if (!model?.src) { issues.push({ where: id, message: 'the file has no default export made with champion()' }); model = undefined; }
    else if (model.id !== id) { issues.push({ where: id, message: `the file is ${id}.ts but its model is for "${model.id}"; the build would not apply it` }); model = undefined; }
  }
  const lockPath = join(MODELS_DIR, 'models.lock.json');
  const lock: Lock = existsSync(lockPath) ? await readJson(lockPath) : { champions: {}, items: {} };
  const resolved = resolveChampion(compiled, model?.src, lock);
  issues.push(...resolved.issues);
  return {
    champion: { ...compiled, vars: resolved.vars, options: resolved.options, counters: resolved.counters, models: resolved.models },
    issues,
    modeled: !!model,
  };
}

export interface ItemDraft {
  /** every item of the last build, those with a model file bound to the files as they are on disk now */
  items: ItemData[];
  /** what the build would print as MODEL DOES NOT BIND; `item` says whose, and a file that cannot be loaded has none */
  issues: (ModelIssue & { item?: number })[];
}

export async function draftItems(patch?: string): Promise<ItemDraft> {
  const latest = join(DATA_DIR, 'dist', 'latest.json');
  const built: ItemData[] = await readJson(join(distDir(patch ?? (await readJson(latest)).patch), 'items.json'));
  const dir = join(MODELS_DIR, 'items');
  const models = new Map<number, ItemModelFile>();
  const issues: ItemDraft['issues'] = [];
  for (const f of (await readdir(dir)).filter(f => f.endsWith('.ts')).sort()) {
    let exported: unknown;
    // the query string gets past the module cache, so a long-running caller sees edits
    try { exported = (await import(`${pathToFileURL(join(dir, f)).href}?t=${Date.now()}`)).default; }
    catch (e) { issues.push({ where: `src/models/items/${f}`, message: `cannot be loaded: ${e instanceof Error ? e.message : String(e)}` }); continue; }
    for (const m of (Array.isArray(exported) ? exported : [exported]) as ItemModelFile[]) {
      if (!m?.src) continue;
      if (models.has(m.id)) issues.push({ where: `item ${m.id} ${m.name}`, message: `${f} models it again; the build would keep only one`, item: m.id });
      models.set(m.id, m);
    }
  }
  const lockPath = join(MODELS_DIR, 'models.lock.json');
  const lock: Lock = existsSync(lockPath) ? await readJson(lockPath) : { champions: {}, items: {} };
  const bare = ({ model: _, ...rest }: ItemData) => rest;
  // ARAM's and Arena's copies of a Rift item use the Rift item's model, as in the build
  const riftByName = new Map(built.filter(i => i.shops.includes('sr')).map(i => [i.name, i]));
  const items = built.map(it => {
    const own = models.get(it.id), original = own ? undefined : riftByName.get(it.name);
    const src = own?.src ?? (original && models.get(original.id)?.src);
    if (!src) return it;
    const r = resolveItem(bare(it), src, lock, original && bare(original));
    if (own) issues.push(...r.issues.map(i => ({ ...i, item: it.id })));
    return { ...it, model: r.model };
  });
  return { items, issues };
}
