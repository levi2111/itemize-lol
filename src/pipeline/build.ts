/* Compiles a mirrored patch into the dataset under data/dist/<patch>/. Offline:
   run `data:fetch` first. */
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { ChampionModelFile, ItemModelFile, RuneModelFile } from '../models/dsl.ts';
import type { ChampionData, DatasetManifest, ItemData, ModelStatus, RuneData, RuneSet, Slot } from '../shared/types.ts';
import { SLOTS } from '../shared/types.ts';
import { checkAnchors } from './anchors.ts';
import { newLog } from './calc.ts';
import { compileChampion } from './champion.ts';
import type { RawManifest } from './fetch.ts';
import { compileItems } from './items.ts';
import { resolveChampion, resolveItem, resolveRune, type Lock, type ModelIssue } from './models.ts';
import { compileRunes } from './runes.ts';
import { compileTiming } from './timing.ts';
import { DATA_DIR, distDir, rawDir, ROOT } from './paths.ts';

const MODELS_DIR = join(ROOT, 'src', 'models');
const LOCK_PATH = join(MODELS_DIR, 'models.lock.json');

export interface BuildReport {
  patch: string;
  anchors: { passed: number; failed: string[]; missing: string[] };
  /** hand-written models that failed to bind to this patch */
  modelIssues: ModelIssue[];
  /** hand-written models whose spell changed shape since they were accepted */
  stale: string[];
  /** hand-written models never accepted with --accept */
  unlocked: string[];
  unknownParts: Record<string, number>;
  unknownStats: Record<string, number>;
  /** disagreements between Data Dragon and the game files, grouped */
  sourceMismatches: Record<string, number>;
  warnings: string[];
  coverage: { abilities: Record<ModelStatus, number>; items: Record<ModelStatus, number> };
}

const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));
const emptyCoverage = (): Record<ModelStatus, number> => ({ verified: 0, curated: 0, stale: 0, auto: 0, none: 0, unmodeled: 0 });
/** 16.20.1 -> 26.20: since 2025 the client's patch names run ten ahead of the data version. */
export const displayPatch = (v: string) => { const [maj, min] = v.split('.'); return `${Number(maj) >= 15 ? Number(maj) + 10 : maj}.${min}`; };

export async function latestMirroredPatch(): Promise<string> {
  const dir = join(DATA_DIR, 'raw');
  const patches = existsSync(dir) ? (await readdir(dir)).filter(p => existsSync(join(dir, p, 'manifest.json'))) : [];
  const newest = patches.sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).at(-1);
  if (!newest) throw new Error('no mirrored patch found: run `npm run data:fetch` first');
  return newest;
}

async function loadModels<T>(sub: string): Promise<T[]> {
  const dir = join(MODELS_DIR, sub);
  if (!existsSync(dir)) return [];
  const files = (await readdir(dir)).filter(f => f.endsWith('.ts')).sort();
  const out: T[] = [];
  for (const f of files) {
    const mod = await import(pathToFileURL(join(dir, f)).href);
    const exported: unknown = mod.default;
    for (const m of Array.isArray(exported) ? exported : [exported]) if (m) out.push(m as T);
  }
  return out;
}

export interface BuildOptions {
  patch?: string;
  /** record the current shape of every hand-written model as reviewed */
  accept?: boolean;
  /** write the dataset even if an anchor fails */
  force?: boolean;
  log?: (msg: string) => void;
}

export async function buildDataset(opts: BuildOptions = {}): Promise<BuildReport> {
  const log = opts.log ?? (() => {});
  const patch = opts.patch ?? await latestMirroredPatch();
  const raw = rawDir(patch);
  const manifest: RawManifest = await readJson(join(raw, 'manifest.json'));
  const table: Record<string, string> = (await readJson(join(raw, 'cdragon', 'stringtable.json'))).entries;
  const ddChampions = (await readJson(join(raw, 'ddragon', 'championFull.json'))).data as Record<string, any>;
  const ddItems = await readJson(join(raw, 'ddragon', 'item.json'));
  const itemsBin = await readJson(join(raw, 'cdragon', 'items.bin.json'));
  const lock: Lock = existsSync(LOCK_PATH) ? await readJson(LOCK_PATH) : { champions: {}, items: {} };

  const championModels = new Map((await loadModels<ChampionModelFile>('champions')).map(m => [m.id, m.src]));
  const runeModels = new Map((await loadModels<RuneModelFile>('runes')).map(m => [m.id, m]));
  const itemModelList = await loadModels<ItemModelFile>('items');
  const itemModels = new Map(itemModelList.map(m => [m.id, m]));

  const clog = newLog();
  const report: BuildReport = {
    patch, anchors: { passed: 0, failed: [], missing: [] }, modelIssues: [], stale: [], unlocked: [],
    unknownParts: {}, unknownStats: {}, sourceMismatches: {}, warnings: [],
    coverage: { abilities: emptyCoverage(), items: emptyCoverage() },
  };
  const newLock: Lock = { champions: {}, items: {}, runes: {} };
  if (itemModels.size < itemModelList.length) {
    const twice = itemModelList.filter((m, i) => itemModelList.findIndex(x => x.id === m.id) !== i);
    for (const m of twice) report.modelIssues.push({ where: `item ${m.id} ${m.name}`, message: 'modeled in two places; only the last one read is used' });
  }
  const mismatch = (w: string) => {
    const m = /^Data Dragon (\w+)=/.exec(w) ?? /Data Dragon (\w+)=/.exec(w);
    if (m) report.sourceMismatches[m[1]!] = (report.sourceMismatches[m[1]!] ?? 0) + 1;
    else report.warnings.push(w);
  };

  // ---- champions ----
  const champions: ChampionData[] = [];
  for (const id of Object.keys(ddChampions).sort()) {
    const bin = await readJson(join(raw, 'cdragon', 'characters', `${id.toLowerCase()}.bin.json`));
    const compiled = compileChampion(ddChampions[id], bin, table, clog);
    const src = championModels.get(id);
    const resolved = resolveChampion(compiled, src, lock);
    report.modelIssues.push(...resolved.issues);
    for (const w of compiled.warnings) mismatch(`${id}: ${w}`);
    for (const slot of SLOTS) {
      const status = resolved.models[slot].status;
      report.coverage.abilities[status]++;
      const fp = resolved.fingerprints[slot];
      if (status === 'stale') report.stale.push(`${id}.${slot}`);
      if (fp) {
        (newLock.champions[id] ??= {})[slot] = fp;
        if (!lock.champions[id]?.[slot]) report.unlocked.push(`${id}.${slot}`);
      }
    }
    champions.push({ ...compiled, vars: resolved.vars, options: resolved.options, counters: resolved.counters, models: resolved.models, timing: compileTiming(id, bin, compiled.ranged) });
  }
  for (const id of championModels.keys()) if (!ddChampions[id]) report.modelIssues.push({ where: id, message: 'model file names a champion that does not exist' });

  // ---- items ----
  const compiledItems = compileItems(ddItems, itemsBin, table, clog);
  compiledItems.warnings.forEach(mismatch);
  // ARAM's and Arena's copies of a Rift item have ids of their own, and use the Rift item's model when it binds
  const riftByName = new Map(compiledItems.items.filter(i => i.shops.includes('sr')).map(i => [i.name, i]));
  const items: ItemData[] = compiledItems.items.map(it => {
    const original = itemModels.has(it.id) ? undefined : riftByName.get(it.name);
    if (original && itemModels.has(original.id)) {
      const { model, issues } = resolveItem(it, itemModels.get(original.id)!.src, lock, original);
      // a copy the model does not fit falls back to its estimate quietly: the model was written for the original
      if (issues.length) model.notes = model.notes.filter(n => !n.startsWith('A hand-written model exists'));
      model.notes = model.notes.map(n => n.startsWith('This item changed since') ? `This copy's passive differs from the Summoner's Rift item's, whose model it uses; numbers may be off.` : n);
      report.coverage.items[model.status]++;
      if (model.status === 'stale') report.stale.push(`item ${it.id} ${it.name} (${it.shops.join(', ')} copy of ${original.id})`);
      return { ...it, model };
    }
    const src = itemModels.get(it.id);
    const { model, fingerprint, issues } = resolveItem(it, src?.src, lock);
    report.modelIssues.push(...issues);
    report.coverage.items[model.status]++;
    if (model.status === 'stale') report.stale.push(`item ${it.id} ${it.name}`);
    if (fingerprint) {
      newLock.items[String(it.id)] = fingerprint;
      if (!lock.items[String(it.id)]) report.unlocked.push(`item ${it.id} ${it.name}`);
    }
    return { ...it, model };
  });
  const itemIds = new Set(items.map(i => i.id));
  for (const m of itemModels.values()) if (!itemIds.has(m.id)) report.modelIssues.push({ where: `item ${m.id} ${m.name}`, message: 'model file names an item that is not in the shop this patch' });

  // ---- runes ----
  // mirrors made before runes were read have no rune files; the dataset then has no runes
  let runeSet: RuneSet | undefined;
  if (existsSync(join(raw, 'cdragon', 'perks.bin.json'))) {
    const compiled = compileRunes(await readJson(join(raw, 'cdragon', 'perks.bin.json')), await readJson(join(raw, 'cdragon', 'perks.json')), await readJson(join(raw, 'cdragon', 'perkstyles.json')), clog);
    const runes: RuneData[] = compiled.runes.map(r => {
      const { model, fingerprint, issues } = resolveRune(r, runeModels.get(r.id)?.src, lock);
      report.modelIssues.push(...issues);
      if (model.status === 'stale') report.stale.push(`rune ${r.id} ${r.name}`);
      if (fingerprint) {
        newLock.runes![String(r.id)] = fingerprint;
        if (!lock.runes?.[String(r.id)]) report.unlocked.push(`rune ${r.id} ${r.name}`);
      }
      return { ...r, model };
    });
    for (const m of runeModels.values()) if (!runes.some(r => r.id === m.id)) report.modelIssues.push({ where: `rune ${m.id} ${m.name}`, message: 'model file names a rune that does not exist this patch' });
    runeSet = { ...compiled.set, runes };
  } else log('no rune files in the mirror (run data:fetch again to add them): the dataset has no runes');

  // ---- format canaries ----
  const byId = new Map(champions.map(c => [c.id, c]));
  const itemById = new Map(items.map(i => [i.id, i]));
  report.anchors = checkAnchors((owner, spell, calc) =>
    typeof owner === 'number' ? itemById.get(owner)?.calcs[calc] : byId.get(owner)?.spells[spell ?? '']?.calcs[calc]);
  report.unknownParts = Object.fromEntries(clog.unknownParts);
  report.unknownStats = Object.fromEntries(clog.unknownStats);
  if (report.anchors.failed.length && !opts.force) {
    for (const f of report.anchors.failed) log(`ANCHOR FAILED  ${f}`);
    throw new Error('the game data format appears to have changed (see failed anchors above); dataset not written. Fix src/pipeline/calc.ts, or pass --force to write it anyway.');
  }

  // ---- write ----
  const out = distDir(patch);
  await rm(out, { recursive: true, force: true });
  await mkdir(join(out, 'champions'), { recursive: true });
  const statusOf = (c: ChampionData) => Object.fromEntries(SLOTS.map(s => [s, c.models[s].status])) as Record<Slot, ModelStatus>;
  await Promise.all(champions.map(c => writeFile(join(out, 'champions', `${c.id}.json`), JSON.stringify(c))));
  await writeFile(join(out, 'champions.json'), JSON.stringify(champions.map(c => ({
    id: c.id, key: c.key, name: c.name, title: c.title, tags: c.tags, ranged: c.ranged, stats: c.stats, status: statusOf(c),
  }))));
  await writeFile(join(out, 'items.json'), JSON.stringify(items));
  if (runeSet) await writeFile(join(out, 'runes.json'), JSON.stringify(runeSet));
  const coverage = emptyCoverage();
  for (const k of Object.keys(coverage) as ModelStatus[]) coverage[k] = report.coverage.abilities[k];
  const dist: DatasetManifest = {
    patch, displayPatch: displayPatch(patch), builtAt: new Date().toISOString(),
    sources: { ddragon: manifest.ddragon, cdragon: manifest.cdragon },
    champions: champions.length, items: items.length, ...(runeSet && { runes: runeSet.runes.length }), coverage,
  };
  await writeFile(join(out, 'manifest.json'), JSON.stringify(dist, null, 1));
  await writeFile(join(out, 'report.json'), JSON.stringify(report, null, 1));
  await writeFile(join(DATA_DIR, 'dist', 'latest.json'), JSON.stringify({ patch }));
  if (opts.accept) {
    await writeFile(LOCK_PATH, JSON.stringify(newLock, null, 1) + '\n');
    report.unlocked = [];
  }

  // ---- summary ----
  const cov = (c: Record<ModelStatus, number>) => (Object.entries(c) as [ModelStatus, number][]).filter(([, n]) => n).map(([k, n]) => `${n} ${k}`).join(', ');
  log(`patch ${dist.displayPatch} (${patch}): ${champions.length} champions, ${items.length} items -> ${out}`);
  log(`abilities: ${cov(report.coverage.abilities)}`);
  log(`items:     ${cov(report.coverage.items)}`);
  if (runeSet) {
    const rc: Record<string, number> = {};
    for (const r of runeSet.runes) rc[r.model.status] = (rc[r.model.status] ?? 0) + 1;
    log(`runes:     ${Object.entries(rc).map(([k, n]) => `${n} ${k}`).join(', ')}`);
  }
  log(`anchors:   ${report.anchors.passed} passed${report.anchors.missing.length ? `, ${report.anchors.missing.length} could not be checked` : ''}`);
  for (const m of report.anchors.missing) log(`  anchor not found: ${m}`);
  const mm = Object.entries(report.sourceMismatches);
  if (mm.length) log(`Data Dragon disagrees with the game files on: ${mm.map(([k, n]) => `${k} (${n})`).join(', ')}; game files used`);
  const unk = [...Object.entries(report.unknownParts).map(([k, n]) => `${k} ×${n}`), ...Object.entries(report.unknownStats).map(([k, n]) => `stat code ${k} ×${n}`)];
  if (unk.length) log(`not understood: ${unk.join(', ')}`);
  for (const i of report.modelIssues) log(`MODEL DOES NOT BIND  ${i.where}: ${i.message}`);
  if (report.stale.length) log(`stale models (spell changed since last accepted): ${report.stale.join(', ')}`);
  if (report.unlocked.length) log(`${report.unlocked.length} hand-written models not yet accepted (run data:build -- --accept once reviewed)`);
  if (report.warnings.length) log(`${report.warnings.length} other warnings in report.json`);
  return report;
}
