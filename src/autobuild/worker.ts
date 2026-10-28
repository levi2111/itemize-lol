/* The auto-build's Web Worker: the page asks, this runs the search (search.ts) off the page's thread and answers.
   It reads the compiled data from beside its own module (src/server/engine-files.ts says where): every item once,
   and each champion when first needed. The page starts it as a module worker and may end it mid-search.

     in:  { id, req: AutoBuildRequest, enemy: { id, level } | null }   enemy: the target champion, for tankiness
     out: { id, result: AutoBuildResult & { taken, ms } } or { id, error: message }    ms: the search alone
     in:  { warm: champion id }   loads the data a search for that champion needs, and answers nothing */
import type { DataSource } from '../engine/types.ts';
import type { ChampionData, ItemData } from '../shared/types.ts';
import { autoBuild, damageTaken, type AutoBuildRequest } from './search.ts';

interface Ask { id: number; req: AutoBuildRequest; enemy: { id: string; level: number } | null }
interface Warm { warm: string }
// the worker's own scope, without the DOM's types in the build
const scope = globalThis as unknown as { onmessage: ((e: { data: Ask | Warm }) => void) | null; postMessage(m: unknown): void };

const dataAt = (path: string) => new URL(`../data/${path}`, import.meta.url);
const get = async <T>(path: string): Promise<T> => {
  const r = await fetch(dataAt(path));
  if (!r.ok) throw new Error(`could not load ${path} (${r.status})`);
  return r.json() as Promise<T>;
};
let items: Promise<Map<number, ItemData>> | null = null;
const champions = new Map<string, Promise<ChampionData>>();
const itemsOnce = () => items ??= get<ItemData[]>('items.json').then(list => new Map(list.map(it => [it.id, it])));
const champion = (id: string) => {
  let c = champions.get(id);
  if (!c) { c = get<ChampionData>(`champions/${encodeURIComponent(id)}.json`); champions.set(id, c); c.catch(() => champions.delete(id)); }
  return c;
};

scope.onmessage = async ({ data: msg }) => {
  if ('warm' in msg) { Promise.all([itemsOnce(), champion(msg.warm)]).catch(() => {}); return; }
  const ask = msg;
  try {
    const [all, champ, enemy] = await Promise.all([itemsOnce(), champion(ask.req.build.champion), ask.enemy ? champion(ask.enemy.id) : null]);
    const known = new Map([champ, enemy].filter((c): c is ChampionData => !!c).map(c => [c.id, c]));
    const data: DataSource = { patch: '', champion: id => known.get(id), item: id => all.get(id) };
    const t0 = performance.now();
    const req = { ...ask.req };
    if (req.goal === 'tank' && ask.enemy && enemy) req.taken = damageTaken(data, enemy.id, ask.enemy.level);
    const result = autoBuild(data, all.values(), req);
    scope.postMessage({ id: ask.id, result: { ...result, taken: req.taken ?? null, ms: performance.now() - t0 } });
  } catch (e) {
    scope.postMessage({ id: ask.id, error: e instanceof Error ? e.message : String(e) });
  }
};
