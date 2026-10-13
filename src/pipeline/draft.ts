/* Binds one champion's model file against the mirrored patch, in memory.

   `data:build` compiles everything and rewrites data/dist/, which is slow to wait
   for and cannot be done by several writers at once. This reads the same raw files
   and the one model file, and hands back what the build would have written for
   that champion, so a model can be checked while it is being written. */
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ChampionModelFile } from '../models/dsl.ts';
import type { ChampionData } from '../shared/types.ts';
import { latestMirroredPatch } from './build.ts';
import { newLog } from './calc.ts';
import { compileChampion } from './champion.ts';
import { resolveChampion, type Lock, type ModelIssue } from './models.ts';
import { rawDir, ROOT } from './paths.ts';

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
