/* The lab: a fight played out on a clock and a floor instead of as a list.
   Fight (src/engine/sim.ts) still does every damage calculation. This file decides when each action
   starts, when its damage lands and where both champions stand meanwhile: the attack timer and windup,
   cast times, cooldowns, ranges, projectiles, dashes, channels, casts woven into other casts, attack
   resets, buffs that last a while and states that follow from distance.

   Three layers decide each number, and every number says which one it came from: the game files
   (`data`, src/pipeline/timing.ts), the champion's behaviour (`model`, src/lab/behaviours/), and edits made
   on the page (`edited`). What none of them gives is a placeholder (`assumed`).

   Two ways to play: a script of actions, each started as soon as it can be, or a number of seconds in
   which the champion uses the abilities it is allowed, by priority, and attacks in between. */
import { Fight } from '../engine/sim.ts';
import type { Action, BuildInput, CritMode, TargetInput } from '../engine/types.ts';
import { windupSeconds } from '../pipeline/timing.ts';
import { CAST_SLOTS, type CastSlot, type ChampionData, type DamageType, type Expr, type ItemData, type RuneData, type SpellTiming } from '../shared/types.ts';
import { compileFormula, type ActionSrc, type BehaviourSrc, type HookContext, type VariantSrc } from './behaviour.ts';
import { BEHAVIOURS } from './behaviours/index.ts';

/** Server tick: the game updates 30 times a second, so nothing here is finer than that. */
export const TICK = 1 / 30;
const DEFAULT_RADIUS = 65;
const DEFAULT_WINDUP = 0.3;
const ASSUMED_ATTACK_MISSILE = 2000;
const ASSUMED_RANGE = 600;
const ASSUMED_CAST = 0.25;

export type From = 'data' | 'model' | 'assumed' | 'edited';
export interface Timed { v: number; from: From }

/** How one action plays out, as this fight settled it. */
export interface ActionTiming {
  /** the spell object whose timing it uses */
  spell?: string;
  /** basic attack: share of the attack period spent winding up. Ability: seconds locked in the cast */
  lock: Timed;
  /** how far it reaches: for attacks edge to edge, for abilities from the champion's centre to the target's edge */
  range: Timed;
  /** units per second of its projectile; 0 when it has none */
  speed: Timed;
  /** seconds from release to landing, for damage that waits without flying */
  delay: Timed;
  /** seconds locked after the cast, channelling */
  channel: Timed;
  dash?: { speed: Timed; distance: Timed; direction: 'toward' | 'through' | 'away' };
  resetsAttack: boolean;
}
export type EditKey = 'lock' | 'range' | 'speed' | 'delay' | 'channel' | 'dashSpeed' | 'dashDistance';
export type Edits = Partial<Record<Action, Partial<Record<EditKey, number>>>>;

interface CompiledVariant {
  src: VariantSrc;
  within?: Expr; beyond?: Expr; when?: Expr;
  timing: ActionTiming;
  options?: Record<string, number>;
  label: string;
}
interface Plan {
  base: ActionTiming;
  variants: CompiledVariant[];
  requires?: Expr;
  allows: Action[];
}

export type Behaviour = 'stand' | 'away' | 'toward' | 'strafe';
export type Mode =
  | { kind: 'script'; script: Action[]; keepAttacking: boolean; fillWithAutos: boolean }
  | { kind: 'seconds'; seconds: number; abilities: CastSlot[] };

export interface Scenario {
  champ: ChampionData;
  items: ItemData[];
  runes?: RuneData[];
  build: BuildInput;
  target: { champ: ChampionData; level: number };
  /** centre to centre at the start */
  distance: number;
  behaviour: Behaviour;
  mode: Mode;
  edits?: Edits;
  crits?: CritMode;
  /** script mode: seconds after which the fight stops */
  horizon?: number;
}

export type ChampState = 'idle' | 'move' | 'windup' | 'cast' | 'dash' | 'channel' | 'wait';
export interface Frame {
  t: number;
  a: { x: number; y: number; state: ChampState };
  b: { x: number; y: number };
  hp: number;
  shots: { x: number; y: number; action: Action }[];
}
export interface Landed {
  t: number;
  action: Action | 'item' | 'rune' | 'passive';
  line: string;
  label: string;
  type: DamageType;
  raw: number;
  dealt: number;
}
export interface Span {
  lane: Action;
  kind: 'windup' | 'cast' | 'dash' | 'channel' | 'travel' | 'cooldown';
  from: number;
  to: number;
}
export interface Played {
  frames: Frame[];
  events: Landed[];
  spans: Span[];
  maxHp: number;
  target: TargetInput;
  killedAt: number | null;
  end: number;
  /** total dealt; in seconds mode, within the window */
  dealt: number;
  /** what was started, when, with which variant (-1 for none), and whether it was woven into another action */
  started: { index: number; action: Action; t: number; filler: boolean; variant: number; woven: boolean }[];
  /** each action's timing as the fight settled it, with its variants */
  timings: Record<Action, ActionTiming & { variants: { label: string; timing: ActionTiming }[] }>;
  /** options the timeline sets itself (buffs, distance), which a page should not offer */
  managed: string[];
  radius: { a: number; b: number };
  notes: string[];
}

const data = (v: number): Timed => ({ v, from: 'data' });
const model = (v: number): Timed => ({ v, from: 'model' });
const assumed = (v: number): Timed => ({ v, from: 'assumed' });
const at = (v: number[] | undefined, rank: number) => v === undefined ? undefined : v[Math.min(Math.max(rank, 0), v.length - 1)];

/** The behaviour file of a champion, if one was written. */
export const behaviourOf = (id: string): BehaviourSrc | undefined => BEHAVIOURS[id];

/** The dataset's timing of one spell object, read at a rank, before any behaviour. */
function fromData(champ: ChampionData, spell: string, rank: number, attackRange: number): ActionTiming {
  const t: SpellTiming | undefined = champ.timing?.spells[spell];
  const sd = champ.spells[spell];
  const dv = (names: string[]) => { for (const n of names) { const v = at(sd?.dataValues[n], rank); if (v !== undefined && v > 0) return v; } return undefined; };
  const cast = t?.castTime ?? sd?.castTime;
  // a spell's projectile is often a spell object of its own, named after it
  const missile = t?.missileSpeed ? t : champ.timing?.spells[`${spell}Missile`];
  const self = t?.targeting === 'Self' || t?.targeting === 'SelfAoe';
  const range = at(t?.range, rank), radius = at(t?.radius, rank);
  let reach: Timed;
  // a spell centred on the champion reaches as far as its radius, or its range when it has no radius
  if (self && radius) reach = data(radius);
  else if (range) reach = data(range);
  else if (self) reach = data(attackRange);
  else if (radius) reach = data(radius);
  else reach = assumed(Math.max(ASSUMED_RANGE, attackRange));
  const out: ActionTiming = {
    spell,
    lock: cast !== undefined ? data(cast) : assumed(ASSUMED_CAST),
    range: reach,
    speed: missile?.missileSpeed ? data(missile.missileSpeed) : data(0),
    delay: missile?.missileTime ? data(missile.missileTime) : data(0),
    channel: t?.channel ? data(t.channel) : data(0),
    resetsAttack: !!t?.tags?.includes('Trait_AttackReset'),
  };
  const dashSpeed = dv(['DashSpeed']), dashDistance = dv(['DashTotalDistance', 'DashDistance', 'DashRange', 'DashLength']);
  if (dashSpeed && dashDistance) {
    out.dash = { speed: data(dashSpeed), distance: data(dashDistance), direction: 'toward' };
    if (!range) out.range = data(dashDistance);
  }
  if (!champ.timing) {
    if (!out.speed.v) out.speed = assumed(0);
    out.range = { ...out.range, from: out.range.from === 'data' && !range ? 'assumed' : out.range.from };
  }
  return out;
}

/** Applies a behaviour's settings (an action's own, or a variant's) over a timing. */
function overlay(champ: ChampionData, base: ActionTiming, src: VariantSrc | ActionSrc, rank: number, attackRange: number, value: (f: Expr, spell?: string) => number): ActionTiming {
  let t = { ...base };
  if (src.spell && src.spell !== base.spell) {
    if (!champ.spells[src.spell] && !champ.timing?.spells[src.spell]) throw new Error(`${champ.id}: no spell "${src.spell}"`);
    const fresh = fromData(champ, src.spell, rank, attackRange);
    // a variant's spell brings its own timing; a dash the action has stays unless the variant says otherwise
    t = { ...fresh, dash: base.dash, resetsAttack: fresh.resetsAttack || base.resetsAttack };
  }
  const spell = t.spell;
  const num = (f: string | number | undefined) => f === undefined ? undefined : value(compileFormula(f, champ, spell), spell);
  const set = (k: 'lock' | 'range' | 'speed' | 'delay' | 'channel', f: string | number | undefined) => { const v = num(f); if (v !== undefined) t[k] = model(v); };
  set('lock', src.lock); set('range', src.range); set('speed', src.speed); set('delay', src.delay); set('channel', src.channel);
  if (src.dash === null) delete t.dash;
  else if (src.dash) t.dash = { speed: model(num(src.dash.speed)!), distance: model(num(src.dash.distance)!), direction: src.dash.direction ?? 'toward' };
  if (src.resetsAttack !== undefined) t.resetsAttack = src.resetsAttack;
  return t;
}

function describe(v: VariantSrc): string {
  const parts: string[] = [];
  if (v.during) parts.push(`during ${v.during.map(a => a.toUpperCase()).join('/')}`);
  if (v.within !== undefined) parts.push(`within ${v.within}`);
  if (v.beyond !== undefined) parts.push(`beyond ${v.beyond}`);
  if (v.when !== undefined) parts.push(`when ${v.when}`);
  return parts.join(', ') || 'always';
}

interface Shot { action: Action; x: number; y: number; speed: number; started: number; variant: number; options?: Record<string, number> }
interface Busy { action: Action; state: 'windup' | 'cast' | 'dash' | 'channel'; until: number; timing: ActionTiming; variant: number; options?: Record<string, number>; allows: Action[] }

export function play(s: Scenario): Played {
  const seconds = s.mode.kind === 'seconds' ? s.mode.seconds : undefined;
  const horizon = seconds ?? s.horizon ?? 15;
  const t0 = new Fight(s.target.champ, [], { champion: s.target.champ.id, level: s.target.level, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [] }, null);
  const target: TargetInput = { hp: t0.stats.hp.total, armor: t0.stats.armor.total, mr: t0.stats.mr.total };
  /** damage already worked out that reaches the target later: instances of damage spread over time */
  const pending: Landed[] = [];
  let t = 0;
  const fight = new Fight(s.champ, s.items, s.build, target, { crits: s.crits, runes: s.runes, spread: true });
  const notes = new Set<string>();
  const events: Landed[] = [], spans: Span[] = [], frames: Frame[] = [], started: Played['started'] = [];
  const beh = behaviourOf(s.champ.id);
  const rA = s.champ.timing?.radius ?? DEFAULT_RADIUS, rB = s.target.champ.timing?.radius ?? DEFAULT_RADIUS;
  const attackRange = s.champ.stats.attackRange;
  const value = (e: Expr, spell?: string, slot: CastSlot | 'p' = 'p') => fight.value(e, spell, slot);
  if (!s.champ.timing) notes.add('This dataset has no timing from the game files; cast times, windups and ranges are placeholders.');

  // ---------- plans: every action's timing, its variants, what it needs ----------
  const plans = {} as Record<Action, Plan>;
  const at0 = s.champ.timing?.attack;
  const aaBase: ActionTiming = {
    lock: beh?.attack?.windup !== undefined ? model(beh.attack.windup) : at0 ? data(at0.windup) : assumed(DEFAULT_WINDUP),
    range: data(attackRange),
    speed: beh?.attack?.missileSpeed !== undefined ? model(beh.attack.missileSpeed) : !s.champ.ranged ? data(0) : at0?.missileSpeed ? data(at0.missileSpeed) : assumed(ASSUMED_ATTACK_MISSILE),
    delay: data(0), channel: data(0), resetsAttack: false,
  };
  plans.aa = {
    base: aaBase, allows: [],
    variants: (beh?.attack?.variants ?? []).map(v => {
      const c = (f: string | number | undefined) => f === undefined ? undefined : compileFormula(f, s.champ, undefined);
      const timing = { ...aaBase };
      if (v.windup !== undefined) timing.lock = model(v.windup);
      if (v.missileSpeed !== undefined) timing.speed = model(v.missileSpeed);
      return { src: v, within: c(v.within), beyond: c(v.beyond), when: c(v.when), timing, options: v.options, label: describe(v) };
    }),
  };
  for (const slot of CAST_SLOTS) {
    const rank = s.build.ranks[slot], src = beh?.actions?.[slot];
    const val = (e: Expr, spell?: string) => value(e, spell, slot);
    let base = fromData(s.champ, s.champ.slots[slot].spell, rank, attackRange);
    if (src) base = overlay(s.champ, base, src, rank, attackRange, val);
    const variants = (src?.variants ?? []).map(v => {
      const timing = overlay(s.champ, base, v, rank, attackRange, val);
      const c = (f: string | number | undefined) => f === undefined ? undefined : compileFormula(f, s.champ, timing.spell);
      return { src: v, within: c(v.within), beyond: c(v.beyond), when: c(v.when), timing, options: v.options, label: describe(v) };
    });
    plans[slot] = {
      base, variants, allows: src?.allows ?? [],
      ...(src?.requires !== undefined && { requires: compileFormula(src.requires, s.champ, base.spell) }),
    };
  }
  // page edits replace the action's own values (not its variants')
  for (const [a, e] of Object.entries(s.edits ?? {}) as [Action, Partial<Record<EditKey, number>>][]) {
    const b = plans[a]?.base;
    if (!b) continue;
    for (const [k, v] of Object.entries(e) as [EditKey, number][]) {
      if (k === 'dashSpeed' || k === 'dashDistance') { if (b.dash) b.dash[k === 'dashSpeed' ? 'speed' : 'distance'] = { v, from: 'edited' }; }
      else b[k] = { v, from: 'edited' };
    }
  }

  // options the timeline keeps itself
  const windows = (beh?.windows ?? []).map(w => ({ ...w, value: w.value ?? 1, spell: w.after === 'aa' ? undefined : plans[w.after].base.spell }));
  const distanceOpts = (beh?.distance ?? []).map(d => ({ option: d.option, within: compileFormula(d.within, s.champ, d.spell) , spell: d.spell }));
  const managed = [...new Set([...windows.map(w => w.option), ...distanceOpts.map(d => d.option)])];
  const windowUntil = new Map<string, { until: number; value: number }>();

  // ---------- the floor ----------
  const a = { x: 0, y: 0, state: 'idle' as ChampState };
  const b = { x: s.distance, y: 0 };
  const centre = () => Math.hypot(b.x - a.x, b.y - a.y);
  const gap = () => Math.max(0, centre() - rA - rB);
  const targetSpeed = t0.stats.moveSpeed.total;
  const ready: Record<CastSlot, number> = { q: 0, w: 0, e: 0, r: 0 };
  let nextAttack = 0, cursor = 0, main: Busy | undefined, woven: Busy | undefined;
  let dash: { dx: number; dy: number; speed: number; left: number } | undefined;
  const shots: Shot[] = [];
  const delayed: { at: number; action: Action; variant: number; options?: Record<string, number>; started: number }[] = [];
  /** a cast woven into a dash whose damage waits until the dash brings the target within its reach */
  let reaching: { action: Action; variant: number; options?: Record<string, number>; timing: ActionTiming; started: number } | undefined;
  const state: Record<string, number> = {};
  let last: HookContext['last'];

  const ctx = (action: Action, variant: number): HookContext => ({
    t, distance: gap(), action, variant, last, state,
    option: id => fight.optionValues[id] ?? 0,
    setOption: (id, v) => fight.setOptions({ [id]: v }),
    counter: n => fight.counter(n), setCounter: (n, v) => fight.setCounter(n, v),
    readyAt: slot => ready[slot], setReadyAt: (slot, v) => { ready[slot] = v; },
    attackReadyAt: () => nextAttack, setAttackReadyAt: v => { nextAttack = v; },
    note: text => notes.add(text),
  });

  const lineOf = new Map<string, { line: string; label: string }>();
  const actionOf = (line: string): Landed['action'] => line === 'aa' || CAST_SLOTS.includes(line as CastSlot) ? line as Action
    : line === 'items' ? 'item' : line === 'runes' ? 'rune' : 'passive';
  /** Runs something through Fight at time `when` and keeps every hit it dealt as an event: now, or, for
      damage spread over time, when each instance reaches the target. */
  const record = (when: number, fn: () => void) => {
    const prevDealt = fight.hits.map(h => h.dealt), prevRaw = fight.hits.map(h => h.raw), mark = fight.landings.length;
    fight.time = when;
    fight.distance = gap();
    fn();
    const late = new Map<string, { raw: number; dealt: number }>();
    for (const l of fight.landings.slice(mark)) {
      const k = `${l.owner}/${l.rule}/${l.type}`, sum = late.get(k) ?? { raw: 0, dealt: 0 };
      sum.raw += l.raw; sum.dealt += l.dealt; late.set(k, sum);
    }
    fight.hits.forEach((h, i) => {
      let dealt = h.dealt - (prevDealt[i] ?? 0), raw = h.raw - (prevRaw[i] ?? 0);
      const k = `${h.owner}/${h.rule}/${h.type}`;
      lineOf.set(`${h.owner}/${h.rule}`, { line: h.line, label: h.label });
      const lt = late.get(k);
      if (lt) { const r = Math.min(raw, lt.raw), d = Math.min(dealt, lt.dealt); raw -= r; dealt -= d; lt.raw -= r; lt.dealt -= d; }
      if (!(raw > 1e-6)) return;
      events.push({ t: when, action: actionOf(h.line), line: h.line, label: h.label, type: h.type, raw, dealt });
    });
    for (const l of fight.landings.slice(mark)) {
      const info = lineOf.get(`${l.owner}/${l.rule}`) ?? { line: 'items', label: l.rule };
      pending.push({ t: when + l.delay, action: actionOf(info.line), line: info.line, label: info.label, type: l.type, raw: l.raw, dealt: l.dealt });
    }
  };

  const land = (action: Action, variant: number, options: Record<string, number> | undefined) => {
    beh?.hooks?.onLand?.(ctx(action, variant));
    const before = options ? Object.fromEntries(Object.keys(options).map(k => [k, fight.optionValues[k] ?? 0])) : undefined;
    if (options) fight.setOptions(options);
    record(t, () => fight.act(action));
    if (before) fight.setOptions(before);
  };

  const timingOf = (action: Action, variant: number) => variant >= 0 ? plans[action].variants[variant]!.timing : plans[action].base;
  /** The first variant of an action whose conditions hold now; `during` is the action it would be woven into. */
  const pickVariant = (action: Action, during: Action | undefined): number => {
    const vs = plans[action].variants;
    for (let i = 0; i < vs.length; i++) {
      const v = vs[i]!;
      if (v.src.during ? !during || !v.src.during.includes(during) : false) continue;
      const spell = v.timing.spell, slot = action === 'aa' ? 'p' : action;
      if (v.within && gap() > value(v.within, spell, slot)) continue;
      if (v.beyond && gap() <= value(v.beyond, spell, slot)) continue;
      if (v.when && !value(v.when, spell, slot)) continue;
      return i;
    }
    return -1;
  };
  /** Can this action be woven into the one in progress? */
  const weavable = (action: Action, into: Busy): number | undefined => {
    if (action === 'aa') return undefined;
    const v = pickVariant(action, into.action);
    if (v >= 0 && plans[action].variants[v]!.src.during) return v;
    return into.allows.includes(action) ? v : undefined;
  };
  const inRange = (action: Action, timing: ActionTiming) => action === 'aa'
    ? centre() <= timing.range.v + rA + rB + 1e-6
    : centre() <= timing.range.v + rB + 1e-6 || !!timing.dash;
  const learned = (action: Action) => action === 'aa' || s.build.ranks[action] >= 1;
  const offCooldown = (action: Action) => action === 'aa' ? t >= nextAttack - 1e-9 : t >= ready[action] - 1e-9;
  const allowed = (action: Action, variant: number) => {
    if (action === 'aa') return true;
    const p = plans[action];
    if (p.requires && !value(p.requires, p.base.spell, action)) return false;
    return beh?.hooks?.canStart ? beh.hooks.canStart(ctx(action, variant)) : true;
  };

  const start = (action: Action, variant: number, filler: boolean, weave: boolean, index: number) => {
    const timing = timingOf(action, variant), plan = plans[action];
    const options = variant >= 0 ? plan.variants[variant]!.options : undefined;
    started.push({ index, action, t, filler, variant, woven: weave });
    beh?.hooks?.onStart?.(ctx(action, variant));
    last = { action, variant, t };
    for (const w of windows) if (w.after === action && w.from === 'start') openWindow(w);
    if (action === 'aa') {
      const period = fight.attackPeriod;
      nextAttack = t + period;
      const windup = at0 ? windupSeconds({ ...at0, windup: timing.lock.v }, s.champ.stats.attackSpeed, fight.stats.attackSpeed.total) : timing.lock.v * period;
      main = { action, state: 'windup', until: t + windup, timing, variant, options, allows: [] };
      spans.push({ lane: 'aa', kind: 'windup', from: t, to: main.until });
      return;
    }
    const cd = fight.cooldown(action);
    if (!cd) notes.add(`${s.champ.slots[action].name} has no cooldown in the game data; it was treated as ready again at once.`);
    ready[action] = t + (cd?.seconds ?? 0);
    if (cd) spans.push({ lane: action, kind: 'cooldown', from: t, to: ready[action] });
    let busy: Busy;
    if (timing.dash && !weave) {
      const d = Math.max(1e-6, centre()), dir = timing.dash.direction;
      const stop = dir === 'toward' ? Math.max(0, d - rA - rB) : timing.dash.distance.v;
      const travel = Math.min(timing.dash.distance.v, stop), sign = dir === 'away' ? -1 : 1;
      dash = { dx: sign * (b.x - a.x) / d, dy: sign * (b.y - a.y) / d, speed: timing.dash.speed.v, left: travel };
      busy = { action, state: 'dash', until: t + Math.max(timing.lock.v, travel / timing.dash.speed.v), timing, variant, options, allows: plan.allows };
    } else busy = { action, state: 'cast', until: t + timing.lock.v, timing, variant, options, allows: plan.allows };
    spans.push({ lane: action, kind: busy.state === 'dash' ? 'dash' : 'cast', from: t, to: busy.until });
    if (weave) woven = busy; else main = busy;
  };

  const openWindow = (w: typeof windows[number]) => {
    const slot = w.after === 'aa' ? 'p' : w.after;
    const len = value(compileFormula(w.for, s.champ, w.spell), w.spell, slot);
    windowUntil.set(w.option, { until: t + len, value: w.value });
    fight.setOptions({ [w.option]: w.value });
  };

  /** The lock of an action ended: its damage leaves (or lands), and a channel may follow. */
  const release = (busy: Busy, isMain: boolean) => {
    const { action, timing, variant, options } = busy;
    if (busy.state === 'dash') dash = undefined;
    for (const w of windows) if (w.after === action && (w.from ?? 'release') === 'release') openWindow(w);
    if (!isMain && main?.state === 'dash' && !inRange(action, timing)) reaching = { action, variant, options, timing, started: t };
    else if (timing.speed.v > 0 && !(timing.dash && busy.state === 'dash')) shots.push({ action, x: a.x, y: a.y, speed: timing.speed.v, started: t, variant, options });
    else if (timing.delay.v > 0) delayed.push({ at: t + timing.delay.v, action, variant, options, started: t });
    else land(action, variant, options);
    if (timing.resetsAttack) nextAttack = Math.min(nextAttack, t);
    if (isMain && timing.channel.v > 0) {
      main = { ...busy, state: 'channel', until: t + timing.channel.v };
      spans.push({ lane: action, kind: 'channel', from: t, to: main.until });
    } else if (isMain) main = undefined;
    else woven = undefined;
  };

  /** What the champion wants to do next, when free. */
  const choose = (): { action: Action; variant: number; filler: boolean; index: number } | 'move' | 'wait' | undefined => {
    if (s.mode.kind === 'seconds') {
      for (const slot of s.mode.abilities) {
        if (!learned(slot) || !offCooldown(slot)) continue;
        const v = pickVariant(slot, undefined);
        if (v >= 0 && plans[slot].variants[v]!.src.during) continue;
        if (!allowed(slot, v) || !inRange(slot, timingOf(slot, v))) continue;
        return { action: slot, variant: v, filler: false, index: -1 };
      }
      const v = pickVariant('aa', undefined);
      if (!inRange('aa', timingOf('aa', v))) return 'move';
      return offCooldown('aa') ? { action: 'aa', variant: v, filler: false, index: -1 } : 'wait';
    }
    const mode = s.mode;
    while (cursor < mode.script.length && !learned(mode.script[cursor]!)) {
      notes.add(`${s.champ.slots[mode.script[cursor] as CastSlot].name} is not learned at these ranks; the script skipped it.`);
      cursor++;
    }
    const want = mode.script[cursor];
    if (want === undefined) {
      if (!mode.keepAttacking) return undefined;
      const v = pickVariant('aa', undefined);
      if (!inRange('aa', timingOf('aa', v))) return 'move';
      return offCooldown('aa') ? { action: 'aa', variant: v, filler: true, index: -1 } : 'wait';
    }
    const v = pickVariant(want, undefined);
    const timing = timingOf(want, v);
    const blocked = !offCooldown(want) || !allowed(want, v);
    if (blocked && want !== 'aa' && mode.fillWithAutos) {
      const av = pickVariant('aa', undefined);
      if (inRange('aa', timingOf('aa', av)) && offCooldown('aa')) return { action: 'aa', variant: av, filler: true, index: -1 };
    }
    if (!inRange(want, timing)) return 'move';
    if (blocked) return 'wait';
    return { action: want, variant: v, filler: false, index: cursor };
  };
  /** While busy: an action that can be woven into the one in progress. */
  const chooseWoven = (into: Busy): { action: Action; variant: number; index: number } | undefined => {
    const candidates: { action: Action; index: number }[] = s.mode.kind === 'seconds'
      ? s.mode.abilities.map(slot => ({ action: slot, index: -1 }))
      : s.mode.script[cursor] !== undefined ? [{ action: s.mode.script[cursor]!, index: cursor }] : [];
    for (const c of candidates) {
      if (c.action === into.action || !learned(c.action) || !offCooldown(c.action)) continue;
      const v = weavable(c.action, into);
      if (v === undefined || !allowed(c.action, v)) continue;
      return { action: c.action, variant: v, index: c.index };
    }
    return undefined;
  };

  record(0, () => fight.begin());
  let killedAt: number | null = null;
  for (let tick = 0; t <= horizon + 1e-9; tick++, t = tick * TICK) {
    // damage worked out earlier reaches the target when its time comes
    pending.sort((x, y) => x.t - y.t);
    while (pending.length && pending[0]!.t <= t + 1e-9) events.push(pending.shift()!);
    // the target's health as it is shown: what has reached it so far
    const hp = Math.max(0, target.hp - events.reduce((sum, e) => sum + e.dealt, 0));
    // the target moves: it does not wait for anyone
    if (s.behaviour !== 'stand' && hp > 0) {
      const d = Math.max(1e-6, centre()), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, step = targetSpeed * TICK;
      if (s.behaviour === 'away') { b.x += ux * step; b.y += uy * step; }
      else if (s.behaviour === 'strafe') { b.x += -uy * step; b.y += ux * step; }
      else if (d > rA + rB) { const m = Math.min(step, d - rA - rB); b.x -= ux * m; b.y -= uy * m; }
    }
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i]!, dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), step = p.speed * TICK;
      if (d <= step + rB) {
        spans.push({ lane: p.action, kind: 'travel', from: p.started, to: t });
        shots.splice(i, 1);
        land(p.action, p.variant, p.options);
      } else { p.x += dx / d * step; p.y += dy / d * step; }
    }
    for (let i = delayed.length - 1; i >= 0; i--) {
      const p = delayed[i]!;
      if (p.at > t + 1e-9) continue;
      spans.push({ lane: p.action, kind: 'travel', from: p.started, to: t });
      delayed.splice(i, 1);
      land(p.action, p.variant, p.options);
    }
    if (dash) {
      const m = Math.min(dash.left, dash.speed * TICK);
      a.x += dash.dx * m; a.y += dash.dy * m; dash.left -= m;
    }
    if (reaching && inRange(reaching.action, reaching.timing)) {
      spans.push({ lane: reaching.action, kind: 'travel', from: reaching.started, to: t });
      land(reaching.action, reaching.variant, reaching.options);
      reaching = undefined;
    } else if (reaching && main?.state !== 'dash') {
      notes.add(`${s.champ.slots[reaching.action as CastSlot]?.name ?? reaching.action} was woven into a dash that never brought the target within its reach, so it missed.`);
      reaching = undefined;
    }
    // buffs that ran out, and options that follow distance
    for (const [opt, w] of windowUntil) if (t >= w.until - 1e-9) { windowUntil.delete(opt); fight.setOptions({ [opt]: 0 }); }
    for (const d of distanceOpts) if (!windowUntil.has(d.option)) fight.setOptions({ [d.option]: gap() <= value(d.within, d.spell) ? 1 : 0 });

    if (woven && t >= woven.until - 1e-9) release(woven, false);
    if (main && main.state !== 'channel' && t >= main.until - 1e-9) release(main, true);
    else if (main?.state === 'channel' && t >= main.until - 1e-9) main = undefined;

    const hpNow = Math.max(0, target.hp - events.reduce((sum, e) => sum + e.dealt, 0));
    if (hpNow <= 1e-6 && killedAt === null) killedAt = t;
    if (killedAt === null) {
      if (!main) {
        const want = choose();
        if (want === 'move') {
          const v = s.mode.kind === 'script' && s.mode.script[cursor] !== undefined ? s.mode.script[cursor]! : 'aa';
          const timing = timingOf(v, pickVariant(v, undefined)), d = centre();
          const reach = v === 'aa' ? timing.range.v + rA + rB : timing.range.v + rB;
          const step = Math.min(fight.stats.moveSpeed.total * TICK, Math.max(0, d - reach));
          a.x += (b.x - a.x) / d * step; a.y += (b.y - a.y) / d * step;
          a.state = 'move';
        } else if (want === 'wait') a.state = 'wait';
        else if (want) {
          if (!want.filler && want.index >= 0) cursor++;
          start(want.action, want.variant, want.filler, false, want.index);
        } else a.state = 'idle';
      } else if (!woven) {
        const w = chooseWoven(main);
        if (w) {
          if (w.index >= 0) cursor++;
          start(w.action, w.variant, false, true, w.index);
        }
      }
    }
    if (main) a.state = main.state;
    else if (a.state !== 'move' && a.state !== 'wait') a.state = 'idle';

    frames.push({ t, a: { x: a.x, y: a.y, state: a.state }, b: { x: b.x, y: b.y }, hp: hpNow, shots: shots.map(p => ({ x: p.x, y: p.y, action: p.action })) });
    if (killedAt !== null && t >= killedAt) break;
    const settled = !main && !woven && !reaching && !shots.length && !delayed.length && !pending.length;
    if (s.mode.kind === 'script' && settled && cursor >= s.mode.script.length && !s.mode.keepAttacking) break;
  }
  const end = frames.at(-1)?.t ?? 0;
  record(end, () => fight.end());
  // in script mode what was already on its way still lands; in seconds mode only what landed in time counts
  if (seconds === undefined && killedAt === null) for (const p of pending.splice(0)) events.push(p);
  events.sort((x, y) => x.t - y.t);
  for (const c of fight.caveats) notes.add(c);
  if (seconds !== undefined && (pending.length || shots.length || delayed.length)) notes.add('Damage still on its way when the time ran out is not counted.');

  const timings = {} as Played['timings'];
  for (const act of ['aa', ...CAST_SLOTS] as Action[]) timings[act] = { ...plans[act].base, variants: plans[act].variants.map(v => ({ label: v.label, timing: v.timing })) };
  return {
    frames, events, spans, maxHp: target.hp, target, killedAt, end,
    dealt: events.reduce((sum, e) => sum + e.dealt, 0),
    started, timings, managed, radius: { a: rA, b: rB }, notes: [...notes, ...(beh?.notes ?? [])],
  };
}
