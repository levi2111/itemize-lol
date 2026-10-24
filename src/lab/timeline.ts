/* The lab: a fight played out on a clock and a floor instead of as a list.
   Fight (src/engine/sim.ts) still does every damage calculation. This file decides when each
   action starts, when its damage lands, and where both champions stand while it happens:
   attack windups and the attack timer, cast times, cooldowns, range, projectile travel and dashes.
   It is a preview of what timing data would buy. Most timing numbers are not in the dataset yet
   (see timingsFor), so every one carries where it came from and the page lets them be edited. */
import { Fight } from '../engine/sim.ts';
import type { Action, BuildInput, CritMode, TargetInput } from '../engine/types.ts';
import { CAST_SLOTS, type CastSlot, type ChampionData, type DamageType, type ItemData, type SpellData } from '../shared/types.ts';
import { TIMINGS, type HandTiming } from './timings.ts';

/** Server tick: the game updates 30 times a second, so nothing here is finer than that. */
export const TICK = 1 / 30;
/** A champion's gameplay radius when nothing says otherwise. Ranges are measured edge to edge. */
export const RADIUS = 65;
/** Share of an attack's period spent winding up, when nothing says otherwise. */
const WINDUP_SHARE = 0.2;
/** Speed of a ranged basic attack's projectile, when nothing says otherwise. */
const ATTACK_MISSILE_SPEED = 2000;
/** Range of an ability the data gives no range for. */
const SPELL_RANGE = 600;

/** `model`: written by hand in src/lab/timings.ts. `edited`: changed on the page. */
export type From = 'data' | 'model' | 'assumed' | 'edited';
export interface Timed { v: number; from: From }

/** How one action plays out in time and space. */
export interface ActionTiming {
  /** basic attack: share of the attack period spent winding up. Ability: seconds locked in the cast */
  lock: Timed;
  /** how close the champion must be, edge to edge */
  range: Timed;
  /** units per second the damage travels once the lock ends; 0 lands at once */
  speed: Timed;
  /** a dash toward the target: the damage lands when it ends */
  dash?: { speed: Timed; distance: Timed };
}
export type Timings = Record<Action, ActionTiming>;

const at = (v: number[] | undefined, rank: number) => v === undefined ? undefined : v[Math.min(Math.max(rank, 0), v.length - 1)];
function value(spell: SpellData | undefined, rank: number, names: string[]): number | undefined {
  for (const n of names) {
    const v = at(spell?.dataValues[n], rank);
    if (v !== undefined && v > 0) return v;
  }
  return undefined;
}
const data = (v: number): Timed => ({ v, from: 'data' });
const assumed = (v: number): Timed => ({ v, from: 'assumed' });

/** What the dataset knows about each action's timing, then the hand-written timings, with assumptions filling the rest. */
export function timingsFor(champ: ChampionData, ranks: Record<CastSlot, number>): Timings {
  const out = fromData(champ, ranks), hand = TIMINGS[champ.id];
  if (!hand) return out;
  const model = (v: number): Timed => ({ v, from: 'model' });
  for (const [action, h] of Object.entries(hand) as [Action, HandTiming][]) {
    const t = out[action];
    if (h.lock !== undefined) t.lock = model(h.lock);
    if (h.range !== undefined) t.range = model(h.range);
    if (h.speed !== undefined) t.speed = model(h.speed);
    if (h.dash) t.dash = { speed: model(h.dash.speed), distance: model(h.dash.distance) };
    if (h.dash === null) delete t.dash;
  }
  return out;
}

function fromData(champ: ChampionData, ranks: Record<CastSlot, number>): Timings {
  const out = {
    aa: {
      lock: assumed(WINDUP_SHARE),
      range: data(champ.stats.attackRange),
      speed: champ.ranged ? assumed(ATTACK_MISSILE_SPEED) : data(0),
    },
  } as Timings;
  for (const slot of CAST_SLOTS) {
    const spell = champ.spells[champ.slots[slot].spell], rank = ranks[slot];
    const range = value(spell, rank, ['CastRange', 'Range', 'MaxRange']);
    const speed = value(spell, rank, ['MissileSpeed', 'ProjectileSpeed']);
    const dashSpeed = value(spell, rank, ['DashSpeed']);
    const dashDistance = value(spell, rank, ['DashTotalDistance', 'DashDistance', 'DashRange', 'DashLength']);
    const t: ActionTiming = {
      lock: spell?.castTime !== undefined ? data(spell.castTime) : assumed(0.25),
      range: range ? data(range) : assumed(Math.max(SPELL_RANGE, champ.stats.attackRange)),
      speed: speed ? data(speed) : assumed(0),
    };
    if (dashSpeed && dashDistance) {
      t.dash = { speed: data(dashSpeed), distance: data(dashDistance) };
      // a dash is its own reach: it starts from as far as it travels
      if (!range) t.range = { v: dashDistance, from: 'data' };
    }
    out[slot] = t;
  }
  return out;
}

export type Behaviour = 'stand' | 'away' | 'toward' | 'strafe';
export interface Scenario {
  champ: ChampionData;
  items: ItemData[];
  build: BuildInput;
  target: { champ: ChampionData; level: number };
  /** centre to centre at the start */
  distance: number;
  behaviour: Behaviour;
  script: Action[];
  /** keep attacking once the script is done, until the target dies or time runs out */
  keepAttacking: boolean;
  /** attack while the next ability in the script is still on cooldown */
  fillWithAutos: boolean;
  timings: Timings;
  crits?: CritMode;
  /** seconds after which the fight stops */
  horizon?: number;
}

export type ChampState = 'idle' | 'move' | 'windup' | 'cast' | 'dash' | 'wait';
export interface Frame {
  t: number;
  a: { x: number; y: number; state: ChampState };
  b: { x: number; y: number };
  /** the target's health as it is shown: damage over time drains across its duration */
  hp: number;
  shots: { x: number; y: number; action: Action }[];
}
export interface Landed {
  t: number;
  action: Action | 'item';
  line: string;
  label: string;
  type: DamageType;
  raw: number;
  dealt: number;
  /** seconds it is spread over; 0 is instant */
  over: number;
}
export interface Span {
  lane: Action;
  kind: 'windup' | 'cast' | 'dash' | 'travel' | 'cooldown';
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
  /** which script entries were played, and when each started */
  started: { index: number; action: Action; t: number; filler: boolean }[];
  notes: string[];
}

interface Shot { action: Action; x: number; y: number; speed: number; started: number }

export function play(s: Scenario): Played {
  const horizon = s.horizon ?? 15;
  const t0 = new Fight(s.target.champ, [], { champion: s.target.champ.id, level: s.target.level, ranks: { q: 0, w: 0, e: 0, r: 0 }, items: [] }, null);
  const target: TargetInput = { hp: t0.stats.hp.total, armor: t0.stats.armor.total, mr: t0.stats.mr.total };
  const fight = new Fight(s.champ, s.items, s.build, target, { crits: s.crits });
  const notes = new Set<string>();
  const events: Landed[] = [], spans: Span[] = [], frames: Frame[] = [], started: Played['started'] = [];
  const reach = 2 * RADIUS;

  const a = { x: 0, y: 0, state: 'idle' as ChampState, until: 0, doing: undefined as Action | undefined };
  const b = { x: s.distance, y: 0 };
  const targetSpeed = t0.stats.moveSpeed.total, mySpeed = fight.stats.moveSpeed.total;
  const ready: Record<CastSlot, number> = { q: 0, w: 0, e: 0, r: 0 };
  let nextAttack = 0, cursor = 0, t = 0, dash: { dx: number; dy: number; speed: number; left: number } | undefined;
  const shots: Shot[] = [];
  const dist = () => Math.hypot(b.x - a.x, b.y - a.y);

  /** Plays one action's damage through Fight at time `when`, and keeps what it dealt. */
  const land = (action: Action | 'begin' | 'end', when: number) => {
    const prevDealt = fight.hits.map(h => h.dealt), prevRaw = fight.hits.map(h => h.raw);
    const seen = new Map([...fight.spread].map(([k, m]) => [k, new Set(m.keys())]));
    fight.time = when;
    if (action === 'begin') fight.begin();
    else if (action === 'end') fight.end();
    else fight.act(action);
    fight.hits.forEach((h, i) => {
      const dealt = h.dealt - (prevDealt[i] ?? 0), raw = h.raw - (prevRaw[i] ?? 0);
      if (!(raw > 1e-9)) return;
      let over = 0;
      for (const [idx, sec] of fight.spread.get(`${h.owner}/${h.rule}`) ?? []) if (!seen.get(`${h.owner}/${h.rule}`)?.has(idx)) over = Math.max(over, sec);
      const by: Landed['action'] = h.line === 'aa' || CAST_SLOTS.includes(h.line as CastSlot) ? h.line as Action : 'item';
      events.push({ t: when, action: by, line: h.line, label: h.label, type: h.type, raw, dealt, over });
    });
  };
  /** The health the page shows at `when`: damage over time drains evenly across its duration. */
  const shownHp = (when: number) => {
    let lost = 0;
    for (const e of events) {
      if (e.t > when + 1e-9) continue;
      lost += e.over > 0 ? e.dealt * Math.min(1, (when - e.t) / e.over) : e.dealt;
    }
    return Math.max(0, target.hp - lost);
  };

  /** The action the champion wants to start now, or nothing, and whether it is filling time. */
  const next = (): { action: Action; filler: boolean } | undefined => {
    const scripted = s.script[cursor];
    if (scripted === undefined) return s.keepAttacking ? { action: 'aa', filler: true } : undefined;
    if (scripted !== 'aa' && t < ready[scripted] - 1e-9 && s.fillWithAutos) return { action: 'aa', filler: true };
    return { action: scripted, filler: false };
  };

  const startAction = (action: Action, filler: boolean) => {
    const tm = s.timings[action];
    if (!filler) cursor++;
    started.push({ index: filler ? -1 : cursor - 1, action, t, filler });
    a.doing = action;
    if (action === 'aa') {
      const period = fight.attackPeriod;
      nextAttack = t + period;
      a.state = 'windup';
      a.until = t + tm.lock.v * period;
      spans.push({ lane: 'aa', kind: 'windup', from: t, to: a.until });
      return;
    }
    const cd = fight.cooldown(action);
    if (!cd) notes.add(`${s.champ.slots[action].name} has no cooldown in the game data; it was treated as ready again at once.`);
    ready[action] = t + (cd?.seconds ?? 0);
    if (cd) spans.push({ lane: action, kind: 'cooldown', from: t, to: ready[action] });
    if (tm.dash) {
      const d = dist(), travel = Math.min(tm.dash.distance.v, Math.max(0, d - reach));
      a.state = 'dash';
      dash = { dx: (b.x - a.x) / d, dy: (b.y - a.y) / d, speed: tm.dash.speed.v, left: travel };
      a.until = t + Math.max(tm.lock.v, travel / tm.dash.speed.v);
      spans.push({ lane: action, kind: 'dash', from: t, to: a.until });
    } else {
      a.state = 'cast';
      a.until = t + tm.lock.v;
      spans.push({ lane: action, kind: 'cast', from: t, to: a.until });
    }
  };

  /** The lock of the action in progress has ended: send the damage on its way, or land it. */
  const release = () => {
    const action = a.doing!;
    const tm = s.timings[action];
    a.state = 'idle';
    a.doing = undefined;
    dash = undefined;
    if (tm.speed.v > 0 && !tm.dash) shots.push({ action, x: a.x, y: a.y, speed: tm.speed.v, started: t });
    else land(action, t);
  };

  land('begin', 0);
  let killedAt: number | null = null;
  for (let tick = 0; t <= horizon + 1e-9; tick++, t = tick * TICK) {
    // the target moves first: it does not wait for anyone
    if (s.behaviour !== 'stand' && shownHp(t) > 0) {
      const d = Math.max(1e-6, dist()), ux = (b.x - a.x) / d, uy = (b.y - a.y) / d, step = targetSpeed * TICK;
      if (s.behaviour === 'away') { b.x += ux * step; b.y += uy * step; }
      else if (s.behaviour === 'strafe') { b.x += -uy * step; b.y += ux * step; }
      else if (d > reach) { const m = Math.min(step, d - reach); b.x -= ux * m; b.y -= uy * m; }
    }
    // projectiles home in on the target
    for (let i = shots.length - 1; i >= 0; i--) {
      const p = shots[i]!, dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy), step = p.speed * TICK;
      if (d <= step + RADIUS) {
        spans.push({ lane: p.action, kind: 'travel', from: p.started, to: t });
        land(p.action, t);
        shots.splice(i, 1);
      } else { p.x += dx / d * step; p.y += dy / d * step; }
    }
    if (dash) {
      const m = Math.min(dash.left, dash.speed * TICK);
      a.x += dash.dx * m; a.y += dash.dy * m; dash.left -= m;
    }
    if ((a.state === 'windup' || a.state === 'cast' || a.state === 'dash') && t >= a.until - 1e-9) release();

    const hp = shownHp(t);
    if (hp <= 1e-6 && killedAt === null) killedAt = t;
    if (killedAt === null && (a.state === 'idle' || a.state === 'move' || a.state === 'wait')) {
      const want = next();
      if (want) {
        const tm = s.timings[want.action], d = dist();
        const inRange = d <= tm.range.v + reach + 1e-6;
        const learned = want.action === 'aa' || s.build.ranks[want.action] >= 1;
        if (!learned) {
          notes.add(`${s.champ.slots[want.action as CastSlot].name} is not learned at these ranks; the script skipped it.`);
          cursor++;
          a.state = 'idle';
        } else if (!inRange) {
          const step = Math.min(mySpeed * TICK, d - (tm.range.v + reach));
          a.x += (b.x - a.x) / d * step; a.y += (b.y - a.y) / d * step;
          a.state = 'move';
        } else if (want.action === 'aa' ? t >= nextAttack - 1e-9 : t >= ready[want.action] - 1e-9) {
          startAction(want.action, want.filler);
        } else a.state = 'wait';
      } else a.state = 'idle';
    }

    frames.push({ t, a: { x: a.x, y: a.y, state: a.state }, b: { x: b.x, y: b.y }, hp, shots: shots.map(p => ({ x: p.x, y: p.y, action: p.action })) });
    const settled = !shots.length && a.state !== 'windup' && a.state !== 'cast' && a.state !== 'dash' && events.every(e => e.t + e.over <= t + 1e-9);
    if (killedAt !== null && t >= killedAt) break;
    if (!next() && settled && cursor >= s.script.length) break;
  }
  land('end', t);
  for (const c of fight.caveats) notes.add(c);
  return { frames, events, spans, maxHp: target.hp, target, killedAt, end: frames.at(-1)?.t ?? 0, started, notes: [...notes] };
}
