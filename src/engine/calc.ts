/* The engine's front door: validate a request, play the combo, measure sustained
   damage, and report where every point of damage came from. Pure and synchronous. */
import type { CastSlot, ChampionData, DamageType, ItemData, RuneData, Slot } from '../shared/types.ts';
import { CAST_SLOTS, SLOTS } from '../shared/types.ts';
import { defaultSequence, Fight, type Hit } from './sim.ts';
import { CalcError, CRIT_MODES, type AbilityInfo, type Action, type Amount, type BuildInput, type ByType, type CalcRequest, type CalcResult, type CritMode, type DataSource, type ItemInfo, type SourceLine, type TargetInput } from './types.ts';

export const LIMITS = {
  items: 6,
  /** a keystone, five minor runes and three shards */
  runes: 9,
  /** per action in `counts` */
  count: 30,
  sequence: 80,
  /** seconds of sustained attacking after which a target counts as unkillable */
  horizon: 60,
  /** seconds simulated for DPS when there is no target to kill */
  window: 10,
} as const;

const TYPES: DamageType[] = ['physical', 'magic', 'true'];
const ACTIONS: Action[] = ['aa', ...CAST_SLOTS];
const LINE_ORDER: SourceLine['key'][] = ['aa', 'q', 'w', 'e', 'r', 'p', 'items', 'runes'];
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
  runes: RuneData[];
  build: BuildInput;
  target: TargetInput | null;
  sequence: Action[];
  crits: CritMode;
}

/** Settings by id for things in the build (items, runes): each one must be in the build and name a control it has. */
function settingsFor(raw: unknown, field: string, owners: { id: number; name: string; model: ItemData['model'] }[], what: string): Record<string, Record<string, number | boolean>> {
  const out: Record<string, Record<string, number | boolean>> = {};
  if (raw === undefined) return out;
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) throw new CalcError(field, `${field} must be an object keyed by ${what} id`);
  for (const [id, set] of Object.entries(raw)) {
    const it = owners.find(i => String(i.id) === id);
    if (!it) throw new CalcError(field, `${what} ${id} is not in the build`);
    if (!set || typeof set !== 'object') throw new CalcError(field, `the settings of ${what} ${id} must be an object`);
    for (const [k, v] of Object.entries(set)) {
      if (!it.model.controls?.some(c => c.id === k)) throw new CalcError(field, `${it.name} has no setting "${k}"`);
      if ((typeof v !== 'number' || !Number.isFinite(v)) && typeof v !== 'boolean') throw new CalcError(field, `setting "${k}" of ${it.name} must be a number or true/false`);
    }
    out[id] = { ...set as Record<string, number | boolean> };
  }
  return out;
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
  const itemOptions = settingsFor(b.itemOptions, 'build.itemOptions', items, 'item');

  if (b.runes !== undefined && !Array.isArray(b.runes)) throw new CalcError('build.runes', 'build.runes must be a list');
  const runeIds = (b.runes ?? []).filter((x): x is number => x !== null && x !== undefined);
  if (runeIds.length > LIMITS.runes) throw new CalcError('build.runes', `a build holds at most ${LIMITS.runes} runes`);
  const runes = runeIds.map(id => {
    const r = typeof id === 'number' ? data.rune?.(id) : undefined;
    if (!r) throw new CalcError('build.runes', `unknown rune ${String(id)}`);
    return r;
  });
  if (runes.filter(r => r.kind === 'keystone').length > 1) throw new CalcError('build.runes', 'a build holds one keystone');
  const runeOptions = settingsFor(b.runeOptions, 'build.runeOptions', runes, 'rune');

  let target: TargetInput | null = null;
  if (req.target !== null && req.target !== undefined) {
    target = {
      hp: real(req.target.hp, 'target.hp', 1, 1_000_000),
      armor: real(req.target.armor, 'target.armor', -1000, 10_000),
      mr: real(req.target.mr, 'target.mr', -1000, 10_000),
      bonusHp: req.target.bonusHp === undefined ? 0 : real(req.target.bonusHp, 'target.bonusHp', 0, 1_000_000),
    };
  }

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
  return { champ, items, runes, build: { champion: champ.id, level, ranks, items: ids, options, itemOptions, runes: runeIds, runeOptions }, target, sequence, crits };
}

function lines(champ: ChampionData, hits: Hit[], spread: Fight['spread'], sequence: Action[]): SourceLine[] {
  const label = (k: SourceLine['key']) => k === 'aa' ? 'Auto attack' : k === 'items' ? 'Item effects' : k === 'runes' ? 'Runes' : champ.slots[k].name;
  const out = new Map<SourceLine['key'], SourceLine>();
  for (const key of LINE_ORDER) {
    out.set(key, {
      key, label: label(key), type: 'none', total: zero(), byType: byType(), parts: [],
      qty: key === 'p' || key === 'items' || key === 'runes' ? null : sequence.filter(a => a === key).length,
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
  const f = new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, sustained: true });
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

/** One cast of each ranked ability on a fresh fight, and its cooldown: what the page shows when an ability is pointed at. */
function abilityInfo(c: Checked, crits: CritMode): CalcResult['abilities'] {
  const out = {} as CalcResult['abilities'];
  const any = new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, crits });
  for (const slot of SLOTS as readonly Slot[]) {
    const m = c.champ.models[slot], info: AbilityInfo = { status: m.status, notes: m.notes, cast: null, cooldown: null };
    out[slot] = info;
    if (slot === 'p' || c.build.ranks[slot] < 1) continue;
    const f = new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, crits });
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

/** Each item's (or rune's) settings as the combo used them, and its named effects: one firing on a fresh fight, and how often it fired. */
function itemInfo(c: Checked, fight: Fight, crits: CritMode, of: 'item' | 'rune' = 'item'): ItemInfo[] {
  return (of === 'item' ? c.items : c.runes).map(it => ({
    id: it.id, status: it.model.status, notes: it.model.notes, settings: of === 'item' ? fight.itemSettings(it.id) : fight.runeSettings(it.id),
    effects: it.model.rules.filter(r => r.label && !(r.amount.k === 'num' && r.amount.v === 0)).map(r => ({
      id: r.id, label: r.label!, type: r.type,
      one: round(new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, crits }).preview(it.id, r.id, of)),
      fired: fight.fired.get(`${of}:${it.id}/${r.id}`) ?? 0,
    })),
  }));
}

export function calculate(data: DataSource, req: CalcRequest): CalcResult {
  const c = check(data, req);
  const play = (crits: CritMode) => {
    const f = new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, crits });
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
  const s = sustain(c);
  const caveats = new Set([...fight.caveats, ...s.caveats]);
  for (const slot of CAST_SLOTS) {
    if (c.sequence.includes(slot) && c.build.ranks[slot] < 1) caveats.add(`${c.champ.slots[slot].name} is in the combo but has no rank, so it does nothing.`);
  }

  // the build's stats as the fight starts; stats that follow stacks may have grown during the combo
  const st = new Fight(c.champ, c.items, c.build, c.target, { runes: c.runes, crits: c.crits }).stats;
  const sl = (l: { total: number; base: number; bonus: number }) => ({ total: r4(l.total), base: r4(l.base), bonus: r4(l.bonus) });

  return {
    patch: data.patch,
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
    abilities: abilityInfo(c, c.crits),
    options: fight.optionValues,
    items: itemInfo(c, fight, c.crits),
    runes: itemInfo(c, fight, c.crits, 'rune'),
    caveats: [...caveats],
  };
}

/** A champion's own health and resistances at a level, for using them as the target. */
export function championAsTarget(champ: ChampionData, level: number): TargetInput {
  const f = new Fight(champ, [], { champion: champ.id, level, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [] }, null);
  return { hp: Math.round(f.stats.hp.total), armor: Math.round(f.stats.armor.total), mr: Math.round(f.stats.mr.total) };
}
