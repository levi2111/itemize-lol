/* A shared build link, read on the server the way the page reads it, for link previews.
   The page (web/app.js) keeps its state in `S`. The share button packs it into the link's `s`
   (encodeState); a page opened from a link unpacks it (decodeState, applyState), loads the
   champion's kit (loadKit, which drops ranks and options the kit does not have), and asks
   POST /api/v1/calc for its numbers (recalc). This file repeats those steps, defaults and quirks
   included, so that a preview never shows other numbers than the page it links to. When app.js
   changes how it reads a link, this changes with it; test/share.test.ts pins the pairs down. */
import { championAsTarget } from '../engine/calc.ts';
import type { CalcRequest, CritMode, TargetInput } from '../engine/types.ts';
import type { ChampionIndexEntry, ServedData } from './dataset.ts';

/** The two pages. The receipt has no switch for crits and one set of ranks, so it reads less of a link. */
export type Layout = 'tabs' | 'receipt';
export const LAYOUT_PATH: Record<Layout, string> = { tabs: '/', receipt: '/receipt' };

/** Longer than any link the page writes (about 600 characters with every setting used); a longer one is refused unread. */
export const MAX_LINK = 4096;
const SLOTS = ['q', 'w', 'e', 'r'] as const;
const ACTIONS = ['aa', ...SLOTS] as const;
type Ranks = Record<(typeof SLOTS)[number], number>;

/** The page's state before a link is applied: `S` in app.js and the values written in the pages' inputs. */
export const PAGE_DEFAULTS = {
  champion: 'Kaisa', level: 13, ranks: { q: 5, w: 1, e: 5, r: 2 },
  names: ['On-hit', 'AP burst'],
  dummy: { hp: 2400, ar: 80, mr: 50 },
  enemy: { id: 'Ornn', level: 13 },
  combo: { aa: 3, q: 1, w: 1, e: 0, r: 0 },
} as const;

/** `s` as decodeState reads it: base64url of UTF-8 JSON. Anything else is null, as on the page; so is a link that is not an object, which the page would read as an empty build. */
export function decodeShare(text: string | null | undefined): Record<string, unknown> | null {
  if (!text || text.length > MAX_LINK || !/^[\w-]+$/.test(text)) return null;
  try {
    const binary = atob(text.replace(/-/g, '+').replace(/_/g, '/'));
    const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
    // fatal and BOM-keeping, as decodeURIComponent(escape(...)) is: bad UTF-8 or a leading BOM fail there too
    const json = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
    const v: unknown = JSON.parse(json);
    return v && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : null;
  } catch { return null; }
}
/** The `s` of a link: the page takes the run of base64url characters after `s=`, from the query first and then from the hash. */
export function linkParam(search: string): string | null {
  return /[?&]s=([\w-]+)/.exec(search)?.[1] ?? null;
}

/** The body recalc posts to /api/v1/calc. */
export interface CalcBody {
  champion: string; level: number; ranks: Ranks; options: Record<string, number>;
  builds: { items: number[]; ranks?: Ranks; itemOptions?: Record<string, Record<string, number>> }[];
  target: TargetInput | null;
  combo: { counts: Record<(typeof ACTIONS)[number], number>; crits: CritMode };
}

/** What a page opened from the link shows, and what it asks the API. */
export interface SharedBuild {
  layout: Layout;
  champion: ChampionIndexEntry;
  level: number;
  /** one build, or two when comparing */
  builds: SharedBuildSide[];
  target: { kind: 'dummy'; hp: number; armor: number; mr: number }
    | { kind: 'champ'; champion: ChampionIndexEntry; level: number; hp: number; armor: number; mr: number }
    | { kind: 'raw' };
  body: CalcBody;
  /** one engine request per build, as POST /api/v1/calc makes them from the body */
  requests: CalcRequest[];
}
export interface SharedBuildSide {
  key: 'a' | 'b';
  items: number[];
  /** what the page's name field holds, the link's or the page's own default ("On-hit", "AP burst") */
  name: string;
  /** the name was written by whoever made the link: it is not empty and not the page's default */
  typed: boolean;
}

const finite = (v: unknown) => Number.isFinite(Number(v));
/** applyState's int(): a number in the link, rounded and clamped, or the default. */
const int = (v: unknown, lo: number, hi: number, d: number) => finite(v) ? Math.max(lo, Math.min(hi, Math.round(Number(v)))) : d;
const own = (o: unknown): [string, unknown][] => o && typeof o === 'object' ? Object.entries(o) : [];

/** The page's state after it has opened the link and loaded the kit, and the request it then sends. */
export function readShare(data: ServedData, s: Record<string, unknown>, layout: Layout): SharedBuild {
  const receipt = layout === 'receipt';
  const byId = (id: unknown) => data.index.find(c => c.id === id);
  const itemIds = new Set(data.items.map(i => i.id));
  const controls = (id: number) => (data.item(id)?.model.controls ?? []).map(c => c.id);

  // boot: Kai'Sa, or the first champion by name if she is ever missing
  let champion = byId(PAGE_DEFAULTS.champion) ?? [...data.index].sort((x, y) => x.name.localeCompare(y.name))[0]!;
  champion = byId(s.c) ?? champion;
  const level = int(s.l, 1, 18, PAGE_DEFAULTS.level);
  const ranks: Ranks = { ...PAGE_DEFAULTS.ranks };
  if (Array.isArray(s.r)) SLOTS.forEach((k, i) => ranks[k] = int((s.r as unknown[])[i], 0, 6, 0));
  const build = (v: unknown) => Array.from({ length: 6 }, (_, i) => {
    const id = Array.isArray(v) ? v[i] : undefined;
    return typeof id === 'number' && itemIds.has(id) ? id : null;
  });
  const builds = { a: build(s.a), b: build(s.b) };
  const names: [string, string] = [PAGE_DEFAULTS.names[0], PAGE_DEFAULTS.names[1]];
  if (Array.isArray(s.n)) for (const i of [0, 1]) names[i] = String(s.n[i] ?? '').slice(0, 40);
  const compare = !!s.m;
  let target: 'raw' | 'dummy' | 'champ' = 'dummy';
  if (s.t === 'raw' || s.t === 'dummy' || s.t === 'champ') target = s.t;
  let dummy: { hp: number; ar: number; mr: number } = { ...PAGE_DEFAULTS.dummy };
  if (s.d) {
    const d = s.d as Record<string, unknown>;
    dummy = { hp: int(d.hp, 1, 100000, 2400), ar: int(d.ar, 0, 2000, 80), mr: int(d.mr, 0, 2000, 50) };
  }
  let enemy = { champion: byId(PAGE_DEFAULTS.enemy.id)!, level: PAGE_DEFAULTS.enemy.level as number };
  const e = Array.isArray(s.e) ? byId(s.e[0]) : undefined;
  if (e) enemy = { champion: e, level: int((s.e as unknown[])[1], 1, 18, 13) };
  const combo = { ...PAGE_DEFAULTS.combo } as CalcBody['combo']['counts'];
  if (Array.isArray(s.q)) ACTIONS.forEach((k, i) => combo[k] = int((s.q as unknown[])[i], 0, 30, 0));
  const options = new Map<string, number>();
  for (const [id, v] of own(s.x).slice(0, 24)) if (finite(v)) options.set(id, Math.round(Number(v)));
  let crits: CritMode = 'average';
  if (!receipt && (s.k === 'average' || s.k === 'never' || s.k === 'always')) crits = s.k;
  let ranksB: Ranks | null = null;
  if (Array.isArray(s.rb) && !receipt) {
    ranksB = { ...PAGE_DEFAULTS.ranks };
    SLOTS.forEach((k, i) => ranksB![k] = int((s.rb as unknown[])[i], 0, 6, 0));
  }
  const itemOpts = { a: new Map<string, Record<string, number>>(), b: new Map<string, Record<string, number>>() };
  for (const k of ['a', 'b'] as const) {
    const given = (s.io as Record<string, unknown> | undefined)?.[k];
    if (!given || typeof given !== 'object') continue;
    for (const [id, set] of own(given).slice(0, 6)) {
      if (!itemIds.has(Number(id)) || !set || typeof set !== 'object') continue;
      for (const c of controls(Number(id))) {
        const v = (set as Record<string, unknown>)[c];
        if (!finite(v)) continue;
        if (!itemOpts[k].has(id)) itemOpts[k].set(id, {});
        itemOpts[k].get(id)![c] = Math.round(Number(v));
      }
    }
  }

  // loadKit: ranks no higher than the kit allows, and only options the champion has
  const champ = data.champion(champion.id)!;
  const maxRank = (k: (typeof SLOTS)[number]) => champ.slots[k].maxRank || (k === 'r' ? 3 : 5);
  for (const k of SLOTS) { ranks[k] = Math.min(ranks[k], maxRank(k)); if (ranksB) ranksB[k] = Math.min(ranksB[k], maxRank(k)); }
  const known = new Set(champ.options.map(o => o.id));
  const opts: Record<string, number> = {};
  for (const [id, v] of options) if (known.has(id)) opts[id] = v;

  // the target: the dummy's dials as the link set them; an enemy's dials are refilled with its own stats once they arrive
  let targetBody: TargetInput | null = null, shown: SharedBuild['target'] = { kind: 'raw' };
  if (target === 'dummy') {
    const t = { hp: Math.max(1, dummy.hp || 1), armor: dummy.ar || 0, mr: dummy.mr || 0 };
    targetBody = { dummy: true, ...t };
    shown = { kind: 'dummy', ...t };
  } else if (target === 'champ') {
    const t = championAsTarget(data.champion(enemy.champion.id)!, enemy.level);
    const dials = { hp: Math.max(1, t.hp || 1), armor: t.armor || 0, mr: t.mr || 0 };
    targetBody = { champion: enemy.champion.id, level: enemy.level, ...dials };
    shown = { kind: 'champ', champion: enemy.champion, level: enemy.level, ...dials };
  }

  // recalc, with itemOptsOf: a build's item settings, kept only for items it holds
  const keys = compare ? (['a', 'b'] as const) : (['a'] as const);
  const body: CalcBody = {
    champion: champion.id, level, ranks, options: opts,
    builds: keys.map(k => {
      const held = new Set(builds[k].filter(Boolean)), io: Record<string, Record<string, number>> = {};
      for (const [id, set] of itemOpts[k]) if (held.has(Number(id)) && Object.keys(set).length) io[id] = set;
      return { items: builds[k].filter(Boolean) as number[], ...(k === 'b' && ranksB && { ranks: ranksB }), ...(Object.keys(io).length && { itemOptions: io }) };
    }),
    target: targetBody, combo: { counts: combo, crits },
  };
  // as POST /api/v1/calc turns the body into one request per build (src/server/app.ts)
  const requests: CalcRequest[] = body.builds.map(b => ({
    build: { champion: body.champion, level: body.level, ranks: b.ranks ?? body.ranks, options: body.options, items: b.items, itemOptions: b.itemOptions },
    target: body.target, combo: body.combo,
  }));
  return {
    layout, champion, level, body, requests, target: shown,
    builds: keys.map((k, i) => ({ key: k, items: body.builds[i]!.items, name: names[i]!, typed: !!names[i]!.trim() && names[i] !== PAGE_DEFAULTS.names[i] })),
  };
}
