/* Auto-build: the items that make a build best at one thing (combo damage, sustained DPS or staying alive),
   within an amount of gold or a number of items. Every build is scored by the engine itself, so whatever it
   models (crit with Infinity Edge, penetration against the target's armor, on-hit, amplifiers, stacks at their
   defaults) counts the same as on the page.

   Scoring every build is out of reach: about 105 finished Summoner's Rift items in six slots. So the search
   first leaves out what cannot win and then scores every build that is left:
     1. the rules: the Rift's shop, one pair of boots and the game's other "only so many of" groups (ItemData.limits);
     2. items that add little on their own to the kept items are dropped, and at most POOL of the rest are tried;
     3. every build of those under the limit is scored. With a gold limit only builds that have no room left
        for another item count, since adding one never costs damage;
     4. past EXACT builds, it builds slot by slot instead, keeping the best BEAM at each step, then swaps items
        until no swap helps. That result is the best found, not proven best, and says so (`exact`);
     5. with a gold limit, what is left buys components, best value first.
   Runs in the browser, in a Web Worker (worker.ts), and in the tests. Pure and synchronous. */
import { buildStats, calculate, comboDamage, sustainedDps } from '../engine/calc.ts';
import { damageMultiplier } from '../engine/sim.ts';
import type { BuildInput, ComboInput, DataSource, TargetInput } from '../engine/types.ts';
import type { ChampionData, DamageType, ItemData } from '../shared/types.ts';

export type Goal = 'burst' | 'dps' | 'tank';
export const GOALS: readonly Goal[] = ['burst', 'dps', 'tank'];

export interface AutoBuildRequest {
  /** the champion, level, ranks and options as the page has them; `items` is ignored (see `keep`), and
      `itemOptions` applies to the kept items that have settings */
  build: BuildInput;
  target: TargetInput | null;
  combo: ComboInput;
  goal: Goal;
  /** a budget for the whole build, kept items included; or how many finished items, kept ones included */
  limit: { gold: number } | { items: number };
  /** item ids the build keeps */
  keep: number[];
  /** item ids never to use */
  never: number[];
  /** with a gold limit: spend what is left on components */
  fill?: boolean;
  /** with an item count: boots may be one of the items */
  boots?: boolean;
  /** for tankiness: the share of the damage taken that is physical, magic and true. Half physical, half magic if left out */
  taken?: Record<DamageType, number>;
}

export interface FoundBuild {
  /** kept items first, then the finished items found, then components */
  items: number[];
  gold: number;
  score: number;
}
export interface AutoBuildResult {
  goal: Goal;
  /** the best builds, best first; at most three */
  builds: FoundBuild[];
  /** the kept items on their own */
  base: number;
  /** finished items the rules allow */
  allowed: number;
  /** of those, the ones tried */
  tried: number;
  /** builds scored by the engine */
  scored: number;
  /** every build that could win was scored */
  exact: boolean;
  /** why there is nothing to show, when there is nothing */
  problem: string | null;
}

/** finished items tried, at most */
export const POOL = 22;
/** builds scored one by one, at most; past this it builds slot by slot */
export const EXACT = 6000;
/** partial builds kept at each step of building slot by slot */
export const BEAM = 8;
/** components leftover gold may buy, the best for their gold */
const PARTS = 8;
/** an item adding less than this share of the best single item's gain is left out */
const SMALL = 0.03;
const SLOTS = 6;

const rift = (it: ItemData) => it.shops.includes('sr');
const isBoots = (it: ItemData) => it.tags.includes('Boots');
/** A finished item of the Rift's shop: a completed item, or boots past the first pair. Starting items and
    the support quest's later forms are left out: a build can't buy them as they are. */
export const finished = (it: ItemData) => rift(it) && it.gold > 0 && !it.tags.includes('Lane')
  && (isBoots(it) ? it.gold > 300 : !it.component && it.tier >= 5);
/** What leftover gold buys. */
const part = (it: ItemData) => rift(it) && it.gold > 0 && it.component && !isBoots(it) && !it.tags.includes('Lane');

/** The build holds no more of any group than the game allows. */
function fits(set: ItemData[]): boolean {
  const held = new Map<string, number>();
  for (const it of set) {
    for (const [group, cap] of Object.entries(it.limits ?? {})) {
      const n = (held.get(group) ?? 0) + 1;
      if (n > cap) return false;
      held.set(group, n);
    }
  }
  return true;
}

/** Health over the damage it takes per point dealt: how much raw damage, split as `taken` says, it survives. */
export function effectiveHealth(stats: { hp: { total: number }; armor: { total: number }; mr: { total: number } }, taken: Record<DamageType, number>): number {
  const per = taken.physical * damageMultiplier(stats.armor.total) + taken.magic * damageMultiplier(stats.mr.total) + taken.true;
  return per > 0 ? stats.hp.total / per : stats.hp.total;
}

/** Ranks at a level without a max order: R at 6, 11 and 16, the rest one each first, then Q, E, W. */
function ranksAt(champ: ChampionData, level: number): BuildInput['ranks'] {
  const r = Math.min(champ.slots.r.maxRank, level >= 16 ? 3 : level >= 11 ? 2 : level >= 6 ? 1 : 0);
  const ranks = { q: 0, w: 0, e: 0, r };
  let left = level - r;
  for (const k of ['q', 'e', 'w'] as const) if (left > 0 && champ.slots[k].maxRank > 0) { ranks[k]++; left--; }
  for (const k of ['q', 'e', 'w'] as const) { const add = Math.min(left, champ.slots[k].maxRank - ranks[k]); ranks[k] += add; left -= add; }
  return ranks;
}

/** The split of what an enemy champion deals: its auto attacks and each ability once, at its level, with no items. */
export function damageTaken(data: DataSource, enemy: string, level: number): Record<DamageType, number> {
  const champ = data.champion(enemy);
  const half = { physical: 0.5, magic: 0.5, true: 0 };
  if (!champ) return half;
  const r = calculate(data, {
    build: { champion: champ.id, level, ranks: ranksAt(champ, level), items: [] },
    target: null, combo: { counts: { aa: 3, q: 1, w: 1, e: 1, r: 1 } },
  });
  const t = r.combo.byType, sum = t.physical.raw + t.magic.raw + t.true.raw;
  return sum > 0 ? { physical: t.physical.raw / sum, magic: t.magic.raw / sum, true: t.true.raw / sum } : half;
}

export function autoBuild(data: DataSource, items: Iterable<ItemData>, req: AutoBuildRequest): AutoBuildResult {
  const goal = req.goal;
  if (!GOALS.includes(goal)) throw new Error(`goal must be one of ${GOALS.join(', ')}`);
  const byGold = 'gold' in req.limit;
  const byItems = 'items' in req.limit;
  if (!byGold && !byItems) throw new Error('limit must be { gold } or { items }');
  const budget = byGold ? Math.max(0, Number((req.limit as { gold: number }).gold) || 0) : Infinity;
  const count = byItems ? Math.round(Number((req.limit as { items: number }).items)) : SLOTS;
  if (!(count >= 1 && count <= SLOTS)) throw new Error(`items must be 1 to ${SLOTS}`);

  const keep = req.keep.map(id => data.item(id)).filter((it): it is ItemData => !!it);
  const never = new Set(req.never);
  const keepGold = keep.reduce((s, it) => s + it.gold, 0);
  const taken = req.taken ?? { physical: 0.5, magic: 0.5, true: 0 };
  let scored = 0;
  const score = (set: ItemData[]): number => {
    scored++;
    const ids = set.map(it => it.id), held = new Set(ids.map(String));
    const itemOptions = Object.fromEntries(Object.entries(req.build.itemOptions ?? {}).filter(([id]) => held.has(id)));
    const calc = { build: { ...req.build, items: ids, itemOptions }, target: req.target, combo: req.combo };
    if (goal === 'burst') return comboDamage(data, calc);
    if (goal === 'dps') return sustainedDps(data, calc);
    return effectiveHealth(buildStats(data, calc), taken);
  };
  const result = (over: Partial<AutoBuildResult>): AutoBuildResult => ({ goal, builds: [], base: 0, allowed: 0, tried: 0, scored, exact: true, problem: null, ...over });

  if (keep.length > SLOTS) return result({ problem: 'A build holds six items.' });
  if (!fits(keep)) return result({ problem: 'The kept items break the game\'s rules: two pairs of boots, or two of a kind the shop allows once.' });
  const keptFinished = keep.filter(finished).length;
  if (byItems && keptFinished > count) return result({ problem: `More finished items are kept than the ${count} asked for.` });
  // slots left, and with an item count the finished items still wanted, which also need slots
  const open = byItems ? Math.min(count - keptFinished, SLOTS - keep.length) : SLOTS - keep.length;
  if (keepGold > budget) return result({ problem: 'The kept items already cost more than the gold.' });
  const left = budget - keepGold;
  const base = score(keep);

  // 1. what the rules allow
  const kept = new Set(keep.map(it => it.id));
  let pool = [...items].filter(it => finished(it) && !kept.has(it.id) && !never.has(it.id) && it.gold <= left && fits([...keep, it]));
  if (byItems && req.boots === false) pool = pool.filter(it => !isBoots(it));
  const allowed = pool.length;
  if (open === 0) return result({ builds: [{ items: keep.map(it => it.id), gold: keepGold, score: base }], base, allowed });
  if (byItems && pool.length < open) return result({ base, allowed, problem: 'Not that many items the rules allow are left to add.' });

  // 2. what is worth trying: each item's gain on its own, the best POOL of them, and the best few for their gold
  const gain = new Map(pool.map(it => [it, score([...keep, it]) - base]));
  const top = Math.max(0, ...gain.values());
  const worth = pool.filter(it => gain.get(it)! > top * SMALL);
  const byGain = [...worth].sort((a, b) => gain.get(b)! - gain.get(a)!);
  const chosen = new Set(byGain.slice(0, POOL - 4));
  for (const it of [...worth].sort((a, b) => gain.get(b)! / b.gold - gain.get(a)! / a.gold)) { if (chosen.size >= POOL) break; chosen.add(it); }
  for (const it of byGain) { if (chosen.size >= POOL) break; chosen.add(it); }
  // without anything that helps, an item count still wants its items: they are the cheapest few then
  if (byItems && chosen.size < open) for (const it of [...pool].sort((a, b) => a.gold - b.gold)) { if (chosen.size >= Math.max(open, 1) * 2) break; chosen.add(it); }
  const cands = [...chosen].sort((a, b) => gain.get(b)! - gain.get(a)!);
  const tried = cands.length;

  // 3. every build that could win, if there are few enough
  const done = (picks: ItemData[], gold: number) => {
    if (byItems) return picks.length === open;
    if (picks.length === open) return true;
    // a gold build is done when nothing else fits
    return !cands.some(it => !picks.includes(it) && gold + it.gold <= left && fits([...keep, ...picks, it]));
  };
  const sets: { picks: ItemData[]; gold: number }[] = [];
  let tooMany = false;
  const walk = (from: number, picks: ItemData[], gold: number) => {
    if (tooMany) return;
    if (done(picks, gold)) {
      if (picks.length || !byItems) sets.push({ picks, gold });
      if (sets.length > EXACT) tooMany = true;
      if (picks.length === open) return;
    }
    for (let k = from; k < cands.length; k++) {
      const it = cands[k]!;
      if (gold + it.gold > left) continue;
      const next = [...picks, it];
      if (!fits([...keep, ...next])) continue;
      walk(k + 1, next, gold + it.gold);
    }
  };
  if (open > 0) walk(0, [], 0);

  type Scored = { picks: ItemData[]; gold: number; score: number };
  let ranked: Scored[];
  const exact = !tooMany;
  if (exact) {
    ranked = sets.map(s => ({ ...s, score: s.picks.length ? score([...keep, ...s.picks]) : base }));
  } else {
    // 4. slot by slot, then swaps
    const seen = new Map<string, Scored>();
    const key = (picks: ItemData[]) => picks.map(it => it.id).sort((a, b) => a - b).join(',');
    const consider = (picks: ItemData[], gold: number): Scored | null => {
      const k = key(picks);
      if (seen.has(k)) return seen.get(k)!;
      if (gold > left || !fits([...keep, ...picks])) return null;
      const s = { picks, gold, score: score([...keep, ...picks]) };
      seen.set(k, s);
      return s;
    };
    let beam: Scored[] = [{ picks: [], gold: 0, score: base }];
    for (let depth = 0; depth < open; depth++) {
      const next = new Map<string, Scored>();
      for (const b of beam) {
        for (const it of cands) {
          if (b.picks.includes(it)) continue;
          const s = consider([...b.picks, it], b.gold + it.gold);
          if (s) next.set(key(s.picks), s);
        }
      }
      if (!next.size) break;
      beam = [...next.values()].sort((a, b) => b.score - a.score).slice(0, BEAM);
    }
    const finals = [...seen.values()].filter(s => done(s.picks, s.gold));
    for (const s of finals.sort((a, b) => b.score - a.score).slice(0, 4)) {
      // swap one item for another while that helps
      let cur = s;
      for (let round = 0, better = true; better && round < 4; round++) {
        better = false;
        for (let i = 0; i < cur.picks.length; i++) {
          for (const it of cands) {
            if (cur.picks.includes(it)) continue;
            const picks = cur.picks.map((p, j) => j === i ? it : p);
            const t = consider(picks, cur.gold - cur.picks[i]!.gold + it.gold);
            if (t && t.score > cur.score) { cur = t; better = true; }
          }
        }
      }
    }
    ranked = [...seen.values()].filter(s => done(s.picks, s.gold));
  }
  ranked.sort((a, b) => b.score - a.score);
  if (!ranked.length) return result({ base, allowed, tried, exact, problem: byGold ? 'Nothing fits in that much gold.' : 'No build fits the rules.' });

  // 5. leftover gold buys components, best value first; the leaders are filled, then ranked again
  let builds: FoundBuild[];
  if (byGold && req.fill !== false) {
    // the components worth having: the best few for their gold, each on its own on the kept items
    const rate = new Map([...items].filter(it => part(it) && !never.has(it.id) && it.gold <= left && fits([...keep, it]))
      .map(it => [it, (score([...keep, it]) - base) / it.gold]));
    const parts = [...rate.keys()].filter(it => rate.get(it)! > 0).sort((a, b) => rate.get(b)! - rate.get(a)!).slice(0, PARTS);
    const lead = ranked.slice(0, 5);
    const filled = lead.map(r => {
      const extra: ItemData[] = [];
      let gold = r.gold, now = r.score;
      for (;;) {
        const room = SLOTS - keep.length - r.picks.length - extra.length;
        if (room <= 0) break;
        let best: ItemData | null = null, bestScore = now, bestRate = 0;
        for (const it of parts) {
          if (gold + it.gold > left) continue;
          const set = [...keep, ...r.picks, ...extra, it];
          if (!fits(set)) continue;
          const s = score(set), rate = (s - now) / it.gold;
          if (rate > bestRate) { best = it; bestScore = s; bestRate = rate; }
        }
        if (!best) break;
        extra.push(best); gold += best.gold; now = bestScore;
      }
      return { picks: r.picks, extra, gold, score: now };
    });
    builds = filled.map(f => ({ items: [...keep, ...f.picks, ...f.extra].map(it => it.id), gold: keepGold + f.gold, score: f.score }));
  } else {
    builds = ranked.slice(0, 6).map(r => ({ items: [...keep, ...r.picks].map(it => it.id), gold: keepGold + r.gold, score: r.score }));
  }
  const unique = new Map<string, FoundBuild>();
  for (const b of builds.sort((x, y) => y.score - x.score)) {
    const k = [...b.items].sort((x, y) => x - y).join(',');
    if (!unique.has(k)) unique.set(k, b);
  }
  return result({ builds: [...unique.values()].slice(0, 3), base, allowed, tried, exact });
}
