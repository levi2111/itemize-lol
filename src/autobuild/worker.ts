/* The auto-build's Web Worker: the page asks, this runs the search (search.ts) off the page's thread and answers.
   It reads the compiled data of the page's patch from beside its own module (src/server/engine-files.ts says where):
   every item once, and each champion when first needed. The page starts it as a module worker and may end it mid-search.

     in:  { id, patch, req: AutoBuildRequest, enemy: { id, level, items? } | null }   enemy: the target champion, for tankiness
     out: { id, result: AutoBuildResult & { taken, ms } } or { id, error: message }    ms: the search alone
     in:  { warm: champion id, patch }   loads the data a search for that champion needs, and answers nothing */
import type { DataSource } from '../engine/types.ts';
import type { ChampionData, ItemData } from '../shared/types.ts';
import { autoBuild, damageTaken, type AutoBuildRequest } from './search.ts';

interface Ask { id: number; patch: string; req: AutoBuildRequest; enemy: { id: string; level: number; items?: number[] } | null }
interface Warm { warm: string; patch: string }
// the worker's own scope, without the DOM's types in the build
const scope = globalThis as unknown as { onmessage: ((e: { data: Ask | Warm }) => void) | null; postMessage(m: unknown): void };

const dataAt = (path: string) => new URL(`../data/${path}`, import.meta.url);
const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(dataAt(path));
  if (!r.ok) throw new Error(`could not load ${path} (${r.status})`);
  return r.json() as Promise<T>;
};
// by patch, then by champion
const items = new Map<string, Promise<Map<number, ItemData>>>();
const champions = new Map<string, Promise<ChampionData>>();
const at = (patch: string, path: string) => `${encodeURIComponent(patch)}/${path}`;
const itemsOnce = (patch: string) => {
  let i = items.get(patch);
  if (!i) { i = get<ItemData[]>(at(patch, 'items.json')).then(list => new Map(list.map(it => [it.id, it]))); items.set(patch, i); i.catch(() => items.delete(patch)); }
  return i;
};
const champion = (patch: string, id: string) => {
  const key = at(patch, `champions/${encodeURIComponent(id)}.json`);
  let c = champions.get(key);
  if (!c) { c = get<ChampionData>(key); champions.set(key, c); c.catch(() => champions.delete(key)); }
  return c;
};

scope.onmessage = async ({ data: msg }) => {
  if ('warm' in msg) { Promise.all([itemsOnce(msg.patch), champion(msg.patch, msg.warm)]).catch(() => {}); return; }
  const ask = msg;
  try {
    const [all, champ, enemy] = await Promise.all([itemsOnce(ask.patch), champion(ask.patch, ask.req.build.champion), ask.enemy ? champion(ask.patch, ask.enemy.id) : null]);
    const known = new Map([champ, enemy].filter((c): c is ChampionData => !!c).map(c => [c.id, c]));
    const data: DataSource = { patch: ask.patch, champion: id => known.get(id), item: id => all.get(id) };
    const t0 = performance.now();
    const req = { ...ask.req };
    if (req.goal === 'tank' && ask.enemy && enemy) req.taken = damageTaken(data, enemy.id, ask.enemy.level, ask.enemy.items ?? []);
    const result = autoBuild(data, all.values(), req);
    scope.postMessage({ id: ask.id, result: { ...result, taken: req.taken ?? null, ms: performance.now() - t0 } });
  } catch (e) {
    scope.postMessage({ id: ask.id, error: e instanceof Error ? e.message : String(e) });
  }
};
