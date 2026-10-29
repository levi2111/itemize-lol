/* The engine's front door: validate a request, play the combo, measure sustained
   damage, and report where every point of damage came from. Pure and synchronous. */
import type { CastSlot, ChampionData, DamageType, ItemData, Slot } from '../shared/types.ts';
import { CAST_SLOTS, SLOTS } from '../shared/types.ts';
import { defaultSequence, Fight, type Hit } from './sim.ts';
import { CalcError, CRIT_MODES, type AbilityInfo, type Action, type Amount, type BuildInput, type ByType, type CalcRequest, type CalcResult, type CritMode, type DataSource, type FightResult, type ItemInfo, type SourceLine, type StatLine, type TargetInput, type TargetStats } from './types.ts';

export const LIMITS = {
  items: 6,
  /** per action in `counts` */
  count: 30,
  sequence: 80,
  /** seconds of sustained attacking after which a target counts as unkillable */
  horizon: 60,
  /** seconds simulated for DPS when there is no target to kill */
  window: 10,
} as const;

/** A cooldown in the game data shorter than this is a recast lockout, an ammo timer or a toggle rather than the
    ability's own (Teemo's mushrooms, Caitlyn's traps, Karthus's Defile), so in a fight such an ability is cast once.
    Cassiopeia's Twin Fang, at 0.75 s, is the shortest real one. */
const SHORTEST_COOLDOWN = 0.75;
/** The share of a basic attack before it lands, when nothing else can be done; a cast can take the rest of it.
    The game has a wind-up per champion that the dataset does not carry yet. */
const WINDUP = 0.25;

const TYPES: DamageType[] = ['physical', 'magic', 'true'];
const ACTIONS: Action[] = ['aa', ...CAST_SLOTS];
const LINE_ORDER: SourceLine['key'][] = ['aa', 'q', 'w', 'e', 'r', 'p', 'items'];
const r2 = (n: number) => Math.round(n * 100) / 100;
const r4 = (n: number) => Math.round(n * 10000) / 10000;
const zero = (): Amount => ({ raw: 0, dealt: 0 });
const byType = (): ByType => ({ physical: zero(), magic: zero(), true: zero() });

function int(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v)) throw new CalcError(field, `${field} must be a number`);
  const n = Math.round(v);
  if (n < min || n > max) throw new CalcError(field, `${field} must be between ${min} and ${max}`);
  return n;
}
function real(v: unknown, field: string, min: number, max: number): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw new CalcError(field, `${field} must be a number between ${min} and ${max}`);
  return v;
}

interface Checked {
  champ: ChampionData;
  items: ItemData[];
  build: BuildInput;
  target: TargetStats | null;
  sequence: Action[];
  crits: CritMode;
}

function check(data: DataSource, req: CalcRequest): Checked {
  const b = req?.build;
  if (!b || typeof b !== 'object') throw new CalcError('build', 'build is required');
  const champ = typeof b.champion === 'string' ? data.champion(b.champion) : undefined;
  if (!champ) throw new CalcError('build.champion', `unknown champion "${String(b.champion)}"`);
  const level = int(b.level, 'build.level', 1, 18);
  const ranks = {} as Record<CastSlot, number>;
  for (const s of CAST_SLOTS) ranks[s] = int(b.ranks?.[s] ?? 0, `build.ranks.${s}`, 0, champ.slots[s].maxRank);

  if (b.items !== undefined && !Array.isArray(b.items)) throw new CalcError('build.items', 'build.items must be a list');
  const ids = (b.items ?? []).filter((x): x is number => x !== null && x !== undefined);
  if (ids.length > LIMITS.items) throw new CalcError('build.items', `a build holds at most ${LIMITS.items} items`);
  const items = ids.map(id => {
    const it = typeof id === 'number' ? data.item(id) : undefined;
    if (!it) throw new CalcError('build.items', `unknown item ${String(id)}`);
    return it;
  });

  const options: Record<string, number | boolean> = {};
  for (const [k, v] of Object.entries(b.options ?? {})) {
    if (!champ.options.some(o => o.id === k)) throw new CalcError('build.options', `${champ.name} has no option "${k}"`);
    if (typeof v !== 'number' && typeof v !== 'boolean') throw new CalcError('build.options', `option "${k}" must be a number or true/false`);
    options[k] = v;
  }
  const itemOptions: Record<string, Record<string, number | boolean>> = {};
  if (b.itemOptions !== undefined && (typeof b.itemOptions !== 'object' || b.itemOptions === null || Array.isArray(b.itemOptions))) {
    throw new CalcError('build.itemOptions', 'build.itemOptions must be an object keyed by item id');
  }
  for (const [id, set] of Object.entries(b.itemOptions ?? {})) {
    const it = items.find(i => String(i.id) === id);
    if (!it) throw new CalcError('build.itemOptions', `item ${id} is not in the build`);
    if (!set || typeof set !== 'object') throw new CalcError('build.itemOptions', `the settings of item ${id} must be an object`);
    for (const [k, v] of Object.entries(set)) {
      if (!it.model.controls?.some(c => c.id === k)) throw new CalcError('build.itemOptions', `${it.name} has no setting "${k}"`);
      if ((typeof v !== 'number' || !Number.isFinite(v)) && typeof v !== 'boolean') throw new CalcError('build.itemOptions', `setting "${k}" of ${it.name} must be a number or true/false`);
    }
    itemOptions[id] = { ...set };
  }

  const target = req.target === null || req.target === undefined ? null : resolveTarget(data, req.target);

  const c = req.combo ?? {};
  let sequence: Action[];
  if (c.sequence !== undefined) {
    if (!Array.isArray(c.sequence) || c.sequence.length > LIMITS.sequence) throw new CalcError('combo.sequence', `combo.sequence must be a list of at most ${LIMITS.sequence} actions`);
    for (const a of c.sequence) if (!ACTIONS.includes(a)) throw new CalcError('combo.sequence', `unknown action "${String(a)}"`);
    sequence = c.sequence;
  } else {
    const counts: Partial<Record<Action, number>> = {};
    for (const a of ACTIONS) counts[a] = int(c.counts?.[a] ?? 0, `combo.counts.${a}`, 0, LIMITS.count);
    sequence = defaultSequence(counts);
  }
  const crits = c.crits ?? 'average';
  if (!CRIT_MODES.includes(crits)) throw new CalcError('combo.crits', `combo.crits must be one of ${CRIT_MODES.join(', ')}`);
  return { champ, items, build: { champion: champ.id, level, ranks, items: ids, options, itemOptions }, target, sequence, crits };
}

function lines(champ: ChampionData, hits: Hit[], spread: Fight['spread'], sequence: Action[]): SourceLine[] {
  const label = (k: SourceLine['key']) => k === 'aa' ? 'Auto attack' : k === 'items' ? 'Item effects' : champ.slots[k].name;
  const out = new Map<SourceLine['key'], SourceLine>();
  for (const key of LINE_ORDER) {
    out.set(key, {
      key, label: label(key), type: 'none', total: zero(), byType: byType(), parts: [],
      qty: key === 'p' || key === 'items' ? null : sequence.filter(a => a === key).length,
    });
  }
  for (const h of hits) {
    const l = out.get(h.line)!;
    l.total.raw += h.raw; l.total.dealt += h.dealt;
    l.byType[h.type].raw += h.raw; l.byType[h.type].dealt += h.dealt;
    const id = `${h.owner}/${h.rule}`;
    let part = l.parts.find(p => p.id === id && p.type === h.type);
    if (!part) l.parts.push(part = { id, label: h.label, type: h.type, hits: 0, total: zero() });
    part.hits += h.instances; part.total.raw += h.raw; part.total.dealt += h.dealt;
  }
  for (const l of out.values()) {
    const used = TYPES.filter(t => l.byType[t].raw > 0);
    l.type = used.length === 0 ? 'none' : used.length === 1 ? used[0]! : 'mixed';
    // What one action sets off runs side by side, so the longest part is its length; actions follow
    // one another, so their lengths add up. Either way rate x seconds is the damage dealt over time.
    const perAction = new Map<number, number>(), timed = zero();
    for (const p of l.parts) {
      const byAction = spread.get(p.id);
      if (!byAction) continue;
      let seconds = 0;
      for (const [action, s] of byAction) { seconds += s; perAction.set(action, Math.max(perAction.get(action) ?? 0, s)); }
      p.over = { seconds: r2(seconds), perSecond: round({ raw: p.total.raw / seconds, dealt: p.total.dealt / seconds }) };
      timed.raw += p.total.raw; timed.dealt += p.total.dealt;
    }
    if (perAction.size) {
      const seconds = [...perAction.values()].reduce((a, b) => a + b, 0);
      l.over = { seconds: r2(seconds), perSecond: round({ raw: timed.raw / seconds, dealt: timed.dealt / seconds }) };
    }
    round(l.total);
    for (const t of TYPES) round(l.byType[t]);
    for (const p of l.parts) round(p.total);
  }
  return [...out.values()];
}
function round(a: Amount): Amount { a.raw = r2(a.raw); a.dealt = r2(a.dealt); return a; }

/** Sustained basic attacks from a fresh start: damage per second and, against a target, how long a kill takes. */
function sustain(c: Checked): { dps: Amount; timeToKill: number | null; caveats: Set<string> } {
  const f = new Fight(c.champ, c.items, c.build, c.target, { sustained: true });
  const sum = (from: number) => f.hits.slice(from).reduce((s, h) => ({ raw: s.raw + h.raw, dealt: s.dealt + h.dealt }), zero());
  if (!c.target) {
    const attacks = Math.max(1, Math.round(LIMITS.window * f.stats.attackSpeed.total));
    for (let i = 0; i < attacks; i++) f.act('aa');
    const t = sum(0);
    return { dps: { raw: t.raw / f.time, dealt: t.dealt / f.time }, timeToKill: null, caveats: f.caveats };
  }
  const total = zero();
  while (f.time < LIMITS.horizon) {
    const hpBefore = f.targetHp!, t0 = f.time, period = f.attackPeriod;
    // an attack's hits are whatever the log gained; consecutive hits of one rule merge, so diff totals instead
    const before = sum(0);
    f.act('aa');
    const after = sum(0);
    const hit = { raw: after.raw - before.raw, dealt: after.dealt - before.dealt };
    if (f.targetHp === 0 && hit.dealt > 0) {
      // the killing attack is counted only as far as it was needed, so time to kill moves smoothly with health
      const part = hpBefore / hit.dealt;
      const ttk = t0 + part * period;
      total.raw += hit.raw * part; total.dealt += hpBefore;
      return { dps: { raw: total.raw / ttk, dealt: total.dealt / ttk }, timeToKill: ttk, caveats: f.caveats };
    }
    total.raw += hit.raw; total.dealt += hit.dealt;
    if (hit.dealt <= 0 && f.time > 5) break;
  }
  const t = Math.max(f.time, 1e-9);
  return { dps: { raw: total.raw / t, dealt: total.dealt / t }, timeToKill: null, caveats: f.caveats };
}

/** The fight on the clock (see FightResult). The champion attacks whenever its attack is ready and it is not
    casting, attack first when an ability is ready at the same moment, so the cast goes into the attack's backswing;
    otherwise it casts the first ability that is ready. A cast takes its cast time, and its cooldown, after ability
    haste, starts with it. Played until the target dies, the horizon, or without a target the window. */
function fightOn(c: Checked): FightResult & { caveats: Set<string> } {
  const f = new Fight(c.champ, c.items, c.build, c.target, { sustained: true, timed: true });
  const caveats = new Set<string>();
  // Only what a cast deals is cast. A passive in an ability's slot (Vayne's Silver Bolts), a toggle (Jinx's weapons)
  // or a buff (Kai'Sa's Supercharge) works through the attacks and the champion's options, and casting it would
  // only cost time
  const abilities = [...new Set(c.sequence)].filter((a): a is CastSlot => a !== 'aa' && c.build.ranks[a] >= 1 && c.champ.models[a].rules.some(r => r.on === 'cast'));
  // Each ability holds charges, one coming back every `recharge` seconds, and waits `lockout` between two casts.
  // Most hold one, back after their cooldown; one with charges in the game data (Vel'Koz's Plasma Fission) holds
  // those, and its cooldown is the wait between casts. One with no usable cooldown is cast once.
  const state = abilities.map(slot => {
    const cd = f.cooldown(slot), ammo = f.charges(slot);
    const u = { slot, max: 1, recharge: Infinity, lockout: 0, charges: 1, back: Infinity, free: 0 };
    if (ammo) Object.assign(u, { max: ammo.max, charges: ammo.max, recharge: ammo.recharge, lockout: cd?.seconds ?? 0 });
    else if (cd && cd.base >= SHORTEST_COOLDOWN) u.recharge = cd.seconds;
    else caveats.add(`${c.champ.slots[slot].name} has ${cd ? `a cooldown of ${cd.base} s in the game data, which is not its real one` : 'no cooldown in the game data'}, so the fight casts it once.`);
    return u;
  });
  const ready = (u: typeof state[number]) => u.charges >= 1 ? u.free : Math.max(u.free, u.back);
  const uses: Record<Action, number> = { aa: 0, q: 0, w: 0, e: 0, r: 0 };
  const end = c.target ? LIMITS.horizon : LIMITS.window;
  const hp = c.target ? c.target.hp.total : Infinity;
  let busy = 0, nextAttack = 0, at = 0, killed = false;
  // the last thing that happened: when, what had been dealt before it, and what it dealt
  let last = { at: 0, raw: 0, dealt: 0, addRaw: 0, addDealt: 0 };
  for (;;) {
    at = Math.min(Math.max(busy, Math.min(nextAttack, ...state.map(ready))), f.nextTick);
    if (killed || at >= end) break;
    const before = { ...f.total };
    if (f.nextTick <= at) f.landTicks(at);
    else {
      f.time = at;
      if (nextAttack <= at) {
        f.act('aa'); uses.aa++;
        busy = at + WINDUP * f.attackPeriod; nextAttack = at + f.attackPeriod;
      } else {
        const u = state.find(x => ready(x) <= at)!;
        // the charges that came back by now, then the one this cast uses; the clock for the next starts when one is missing
        for (; u.back <= at; u.back = u.charges < u.max ? u.back + u.recharge : Infinity) u.charges++;
        u.charges--;
        if (u.back === Infinity) u.back = at + u.recharge;
        u.free = at + u.lockout;
        f.act(u.slot); uses[u.slot]++;
        busy = at + f.castTime(u.slot);
      }
    }
    last = { at, raw: before.raw, dealt: before.dealt, addRaw: f.total.raw - before.raw, addDealt: f.total.dealt - before.dealt };
    killed = f.targetHp === 0;
  }
  for (const k of f.caveats) caveats.add(k);
  const out = (dps: Amount, timeToKill: number | null, seconds: number) => ({ dps, timeToKill, seconds, abilities, uses, caveats });
  // the last action counts as dealt evenly until the next one would have happened
  const span = at - last.at;
  if (killed) {
    const part = last.addDealt > 0 ? (hp - last.dealt) / last.addDealt : 1;
    const ttk = Math.max(0.01, last.at + part * span);
    if (ttk <= end) return out({ raw: (last.raw + part * last.addRaw) / ttk, dealt: hp / ttk }, ttk, ttk);
  }
  const part = span > 0 ? Math.min(1, (end - last.at) / span) : 1;
  return out({ raw: (last.raw + part * last.addRaw) / end, dealt: (last.dealt + part * last.addDealt) / end }, null, end);
}

/** One cast of each ranked ability on a fresh fight, and its cooldown: what the page shows when an ability is pointed at. */
function abilityInfo(c: Checked, crits: CritMode): CalcResult['abilities'] {
  const out = {} as CalcResult['abilities'];
  const any = new Fight(c.champ, c.items, c.build, c.target, { crits });
  for (const slot of SLOTS as readonly Slot[]) {
    const m = c.champ.models[slot], info: AbilityInfo = { status: m.status, notes: m.notes, cast: null, cooldown: null };
    out[slot] = info;
    if (slot === 'p' || c.build.ranks[slot] < 1) continue;
    const f = new Fight(c.champ, c.items, c.build, c.target, { crits });
    f.act(slot);
    const cast = { ...zero(), byType: byType() };
    for (const h of f.hits) { cast.raw += h.raw; cast.dealt += h.dealt; cast.byType[h.type].raw += h.raw; cast.byType[h.type].dealt += h.dealt; }
    round(cast);
    for (const t of TYPES) round(cast.byType[t]);
    info.cast = cast;
    const cd = any.cooldown(slot);
    info.cooldown = cd && { base: cd.base, haste: r2(cd.haste), seconds: r2(cd.seconds) };
  }
  return out;
}

/** Each item's settings as the combo used them, and its named effects: one firing on a fresh fight, and how often it fired. */
function itemInfo(c: Checked, fight: Fight, crits: CritMode): ItemInfo[] {
  return c.items.map(it => ({
    id: it.id, status: it.model.status, notes: it.model.notes, settings: fight.itemSettings(it.id),
    effects: it.model.rules.filter(r => r.label && !(r.amount.k === 'num' && r.amount.v === 0)).map(r => ({
      id: r.id, label: r.label!, type: r.type,
      one: round(new Fight(c.champ, c.items, c.build, c.target, { crits }).preview(it.id, r.id)),
      fired: fight.fired.get(`item:${it.id}/${r.id}`) ?? 0,
    })),
  }));
}

export function calculate(data: DataSource, req: CalcRequest): CalcResult {
  const c = check(data, req);
  const play = (crits: CritMode) => {
    const f = new Fight(c.champ, c.items, c.build, c.target, { crits });
    f.begin();
    for (const a of c.sequence) f.act(a);
    f.end();
    return f;
  };
  const fight = play(c.crits);
  const comboLines = lines(c.champ, fight.hits, fight.spread, c.sequence);

  // A line with hits that can crit also gets its total in each way of counting them: the same combo,
  // played again with no crits and with every one. A crit changes the target's health for what comes
  // after it, so each is a whole fight of its own, not the hits rescaled.
  if (fight.hits.some(h => h.crit)) {
    const fights = Object.fromEntries(CRIT_MODES.map(m => [m, m === c.crits ? fight : play(m)])) as Record<CritMode, Fight>;
    const critLines = new Set(CRIT_MODES.flatMap(m => fights[m].hits.filter(h => h.crit).map(h => h.line)));
    const totals = Object.fromEntries(CRIT_MODES.map(m => [m, m === c.crits ? comboLines : lines(c.champ, fights[m].hits, fights[m].spread, c.sequence)])) as Record<CritMode, SourceLine[]>;
    for (const l of comboLines) {
      if (!critLines.has(l.key)) continue;
      l.crits = Object.fromEntries(CRIT_MODES.map(m => [m, { ...totals[m].find(x => x.key === l.key)!.total }])) as Record<CritMode, Amount>;
    }
  }
  const total = zero(), types = byType();
  for (const h of fight.hits) {
    total.raw += h.raw; total.dealt += h.dealt;
    types[h.type].raw += h.raw; types[h.type].dealt += h.dealt;
  }
  const s = sustain(c), fr = fightOn(c);
  const caveats = new Set([...fight.caveats, ...s.caveats, ...fr.caveats]);
  if (req.target?.items?.some(x => x !== null && x !== undefined)) caveats.add('The target\'s items count for their health, armor and magic resist; what their passives do (less damage from attacks or crits, shields) is not counted.');
  for (const slot of CAST_SLOTS) {
    if (c.sequence.includes(slot) && c.build.ranks[slot] < 1) caveats.add(`${c.champ.slots[slot].name} is in the combo but has no rank, so it does nothing.`);
  }

  const st = fight.stats, t = c.target;
  const sl = (l: StatLine) => ({ total: r4(l.total), base: r4(l.base), bonus: r4(l.bonus) });

  return {
    patch: data.patch,
    target: t && { hp: sl(t.hp), armor: sl(t.armor), mr: sl(t.mr) },
    stats: {
      level: st.level, hp: sl(st.hp), mana: sl(st.mana), ad: sl(st.ad), ap: sl(st.ap), armor: sl(st.armor), mr: sl(st.mr), moveSpeed: sl(st.moveSpeed),
      attackSpeed: sl(st.attackSpeed), critChance: r4(st.critChance), critDamage: r4(st.critDamage), lethality: r4(st.lethality),
      armorPenPct: r4(st.armorPenPct), magicPenFlat: r4(st.magicPenFlat), magicPenPct: r4(st.magicPenPct), abilityHaste: r4(st.abilityHaste),
      basicHaste: r4(st.basicHaste), ultHaste: r4(st.ultHaste),
      lifeSteal: r4(st.lifeSteal), omnivamp: r4(st.omnivamp), attackRange: st.attackRange, gold: st.gold,
    },
    sequence: c.sequence,
    combo: {
      crits: c.crits,
      total: round(total),
      byType: { physical: round(types.physical), magic: round(types.magic), true: round(types.true) },
      blocked: r2(total.raw - total.dealt),
      lines: comboLines,
      hpLeft: fight.targetHp === null ? null : r2(fight.targetHp),
      kills: fight.targetHp === 0,
    },
    dps: round(s.dps),
    timeToKill: s.timeToKill === null ? null : r2(s.timeToKill),
    fight: fightView(fr),
    abilities: abilityInfo(c, c.crits),
    options: fight.optionValues,
    items: itemInfo(c, fight, c.crits),
    caveats: [...caveats],
  };
}

/** The headline of a calculation: combo damage, sustained DPS and time to kill, the same numbers `calculate`
    reports, without the breakdown by source, crit, ability and item. A link preview needs no more, and this
    costs a third of the whole (the same fight and the same sustained attacks, nothing else played). */
export interface Headline {
  combo: Pick<CalcResult['combo'], 'total' | 'hpLeft' | 'kills'>;
  dps: Amount;
  timeToKill: number | null;
  fight: Pick<FightResult, 'dps' | 'timeToKill'>;
}
export function headline(data: DataSource, req: CalcRequest): Headline {
  const c = check(data, req);
  const fight = new Fight(c.champ, c.items, c.build, c.target, { crits: c.crits });
  fight.begin();
  for (const a of c.sequence) fight.act(a);
  fight.end();
  const total = zero();
  for (const h of fight.hits) { total.raw += h.raw; total.dealt += h.dealt; }
  const s = sustain(c), { dps, timeToKill } = fightView(fightOn(c));
  return {
    combo: { total: round(total), hpLeft: fight.targetHp === null ? null : r2(fight.targetHp), kills: fight.targetHp === 0 },
    dps: round(s.dps),
    timeToKill: s.timeToKill === null ? null : r2(s.timeToKill),
    fight: { dps, timeToKill },
  };
}
/** The fight as the result reports it, rounded. */
function fightView(fr: ReturnType<typeof fightOn>): FightResult {
  return { dps: round({ ...fr.dps }), timeToKill: fr.timeToKill === null ? null : r2(fr.timeToKill), seconds: r2(fr.seconds), abilities: fr.abilities, uses: fr.uses };
}

/* One number of a calculation each, for a search that compares many builds (src/autobuild/search.ts): the same
   numbers `calculate` reports, without playing anything the number does not need. */

/** The combo's damage, after resistances when there is a target, with crits counted as the request says. */
export function comboDamage(data: DataSource, req: CalcRequest): number {
  const c = check(data, req);
  const fight = new Fight(c.champ, c.items, c.build, c.target, { crits: c.crits });
  fight.begin();
  for (const a of c.sequence) fight.act(a);
  fight.end();
  let dealt = 0;
  for (const h of fight.hits) dealt += h.dealt;
  return dealt;
}
/** Sustained DPS, after resistances when there is a target. */
export function sustainedDps(data: DataSource, req: CalcRequest): number {
  return sustain(check(data, req)).dps.dealt;
}
/** The fight's DPS, abilities included (see FightResult), after resistances when there is a target. */
export function fightDps(data: DataSource, req: CalcRequest): number {
  return fightOn(check(data, req)).dps.dealt;
}
/** The build's stats, unrounded. */
export function buildStats(data: DataSource, req: CalcRequest): Fight['stats'] {
  const c = check(data, req);
  return new Fight(c.champ, c.items, c.build, c.target, { crits: c.crits }).stats;
}

type Totals = { hp: number; armor: number; mr: number };

/** The practice tool's target dummy (game data: characters/practicetool_targetdummy): 1000 base health and no
    base armor or magic resist, so everything the tool adds is bonus. The game counts it as a champion. */
export const DUMMY_BASE: Readonly<Totals> = { hp: 1000, armor: 0, mr: 0 };

/** A champion's health and resistances at a level, in whole numbers as the site shows them: with no items, its base
    stats when it is the target; with items, what they add as well, worked out as for any build (a share of health,
    say, counts what the other items gave). */
export function championAsTarget(champ: ChampionData, level: number, items: ItemData[] = []): Totals {
  const f = new Fight(champ, items, { champion: champ.id, level, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: items.map(i => i.id) }, null);
  return { hp: Math.round(f.stats.hp.total), armor: Math.round(f.stats.armor.total), mr: Math.round(f.stats.mr.total) };
}

/** A target champion's items: ids checked against the data, empty slots left out. Throws a CalcError naming `field`. */
export function targetItems(data: DataSource, ids: unknown, field = 'target.items'): ItemData[] {
  if (ids === undefined || ids === null) return [];
  if (!Array.isArray(ids)) throw new CalcError(field, `${field} must be a list`);
  const held = ids.filter(x => x !== null && x !== undefined);
  if (held.length > LIMITS.items) throw new CalcError(field, `a champion holds at most ${LIMITS.items} items`);
  return held.map(id => {
    const it = typeof id === 'number' ? data.item(id) : undefined;
    if (!it) throw new CalcError(field, `unknown item ${String(id)}`);
    return it;
  });
}

/** The target's health, armor and magic resist, each split into base and bonus (see TargetInput). Throws a CalcError naming the field at fault. */
export function resolveTarget(data: DataSource, t: TargetInput): TargetStats {
  if (!t || typeof t !== 'object' || Array.isArray(t)) throw new CalcError('target', 'target must be an object or null');
  if (t.dummy !== undefined && typeof t.dummy !== 'boolean') throw new CalcError('target.dummy', 'target.dummy must be true or false');
  let base: Totals | null = t.dummy ? DUMMY_BASE : null, held: Totals | null = null;
  if (t.items !== undefined && t.champion === undefined) throw new CalcError('target.items', 'only a champion target holds items');
  if (t.champion !== undefined) {
    if (t.dummy) throw new CalcError('target', 'the target is the dummy or a champion, not both');
    const champ = typeof t.champion === 'string' ? data.champion(t.champion) : undefined;
    if (!champ) throw new CalcError('target.champion', `unknown champion "${String(t.champion)}"`);
    const level = int(t.level ?? 1, 'target.level', 1, 18), items = targetItems(data, t.items);
    base = championAsTarget(champ, level);
    held = items.length ? championAsTarget(champ, level, items) : base;
  }
  const split = (stat: keyof Totals, bonusKey: 'bonusHp' | 'bonusArmor' | 'bonusMr', min: number, max: number): StatLine => {
    // a champion's totals left out are its own with its items'
    const total = t[stat] === undefined && held ? held[stat] : real(t[stat], `target.${stat}`, min, max);
    // what is above the base is bonus; a total below it is all base
    const bonus = t[bonusKey] === undefined ? Math.max(0, total - (base?.[stat] ?? total)) : real(t[bonusKey], `target.${bonusKey}`, 0, Math.max(0, total));
    return { total, base: total - bonus, bonus };
  };
  return { hp: split('hp', 'bonusHp', 1, 1_000_000), armor: split('armor', 'bonusArmor', -1000, 10_000), mr: split('mr', 'bonusMr', -1000, 10_000) };
}
