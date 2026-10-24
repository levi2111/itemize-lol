/* How a champion plays out in time: the hand-written layer of the lab, one file per champion in
   src/lab/behaviours/. The game files already give most timing (src/pipeline/timing.ts): cast times,
   ranges, projectile speeds, attack windups, which spells reset the attack timer. A behaviour adds what
   they cannot say: which of an ability's spell objects a cast really uses, dashes, channels, casts that can
   be woven into another (Samira's Q during her E), states that follow from distance or from a buff
   (Samira's melee range, her E's attack speed), and anything stranger through hooks.

   Formulas are the models' language (docs/models.md): names are data values and calculations of the
   action's spell at its rank, the champion's options, counters and helper formulas, builtins such as
   `level` and `rank`, `target.*`, and `distance` (edge to edge, in units). docs/lab.md is the guide. */
import type { Formula } from '../models/dsl.ts';
import { parseExpr } from '../models/parse.ts';
import { BUILTIN_VARS, STAT_ALIASES, TARGET_VARS } from '../shared/names.ts';
import type { CastSlot, ChampionData, Expr } from '../shared/types.ts';
import type { Action } from '../engine/types.ts';

/** A variant of an action: the first one whose conditions hold replaces the action's own settings for that cast. */
export interface VariantSrc {
  /** holds when the target is at most this far, edge to edge */
  within?: Formula;
  /** holds when the target is further than this, edge to edge */
  beyond?: Formula;
  /** holds while one of these actions is still in progress (its cast, dash or channel); the cast is then
      woven into it without ending it */
  during?: Action[];
  /** holds when this formula is non-zero */
  when?: Formula;
  /** holds for this cast of a recast chain: 1 for the first, 2 for the second… (see ActionSrc.recasts) */
  cast?: number;
  spell?: string;
  lock?: Formula;
  range?: Formula;
  speed?: Formula;
  /** seconds from release to landing, for damage that is not a projectile flying at a speed */
  delay?: Formula;
  dash?: DashSrc | null;
  resetsAttack?: boolean;
  channel?: Formula;
  /** options set while this cast's damage lands, then put back, e.g. `{ sword: 1 }` */
  options?: Record<string, number>;
  /** this cast's cooldown in seconds, in place of the game's (a form with its own cooldowns) */
  cooldown?: Formula;
  /** units the target is moved toward the champion when the cast lands (a pull); negative pushes it away */
  pull?: Formula;
  /** the cast uses the attack timer: it waits for an attack to be ready and starts the next period (Twisted Fate's cards) */
  asAttack?: boolean;
  /** seconds after the cast lands at which some of its model's rules land instead, by rule id (Ahri's orb coming back) */
  hitDelays?: Record<string, Formula>;
}

export interface DashSrc {
  speed: Formula;
  distance: Formula;
  /** `toward` (the default) stops at the target's edge; `through` may pass it; `away` moves off */
  direction?: 'toward' | 'through' | 'away';
  /** the dash starts when the cast's lock ends, instead of with the cast */
  afterLock?: boolean;
}

export interface ActionSrc extends Omit<VariantSrc, 'within' | 'beyond' | 'during' | 'when'> {
  variants?: VariantSrc[];
  /** the action can only start when this is non-zero, e.g. a resource or stacks it needs */
  requires?: Formula;
  /** while `channel` runs, these actions may still be cast, woven in */
  allows?: Action[];
  /** an ability cast several times before its cooldown: Riven's Broken Wings, Ahri's Spirit Rush */
  recasts?: RecastSrc;
  /** an ability holding several charges, each coming back after `recharge` seconds */
  charges?: { count: Formula; recharge?: Formula; gap?: Formula };
  notes?: string[];
}

export interface RecastSrc {
  /** casts in the chain, the first included */
  count: Formula;
  /** seconds after each cast to make the next before the chain ends */
  window: Formula;
  /** seconds between casts of the chain */
  gap?: Formula;
  /** the cooldown starts with the first cast, or when the chain ends (the default) */
  cooldownFrom?: 'first' | 'last';
}

/** An option the timeline sets for a while after an action: a buff with a duration. */
export interface WindowSrc {
  option: string;
  after: Action;
  /** seconds it lasts, a formula of the action's spell */
  for: Formula;
  /** what the option is set to while it lasts; 1 when left out */
  value?: number;
  /** from when: the action's start, or its release (the default) */
  from?: 'start' | 'release';
}

/** An option the timeline keeps in step with distance: on while the target is within range. */
export interface DistanceSrc {
  option: string;
  within: Formula;
  /** a spell whose values the formula reads */
  spell?: string;
}

export interface HookContext {
  /** seconds since the fight started */
  t: number;
  /** edge to edge, in units */
  distance: number;
  /** the action being started or landing, and the variant chosen for it (its index, or -1) */
  action: Action;
  variant: number;
  /** which cast of a recast chain this is, from 1 */
  cast: number;
  /** the previous action started, if any */
  last?: { action: Action; variant: number; t: number };
  option(id: string): number;
  setOption(id: string, value: number): void;
  counter(name: string): number;
  setCounter(name: string, value: number): void;
  /** when an ability is off cooldown, and changing it (a refund) */
  readyAt(slot: CastSlot): number;
  setReadyAt(slot: CastSlot, t: number): void;
  /** the attack timer: when the next basic attack may start */
  attackReadyAt(): number;
  setAttackReadyAt(t: number): void;
  /** a scratchpad for the behaviour's own bookkeeping, kept for the whole fight */
  state: Record<string, number>;
  /** a formula as a behaviour writes it, read now: a value of the action's spell (or `spell`), a stat, an option… */
  value(f: Formula, spell?: string): number;
  /** seconds one basic attack takes at the champion's attack speed right now */
  attackPeriod(): number;
  /** adds a line to the fight's notes */
  note(text: string): void;
}

export interface Hooks {
  /** may this action start now? Asked after cooldown, range and `requires` */
  canStart?(ctx: HookContext): boolean;
  /** an action started */
  onStart?(ctx: HookContext): void;
  /** an action's damage is about to land */
  onLand?(ctx: HookContext): void;
}

export interface BehaviourSrc {
  /** patch the author wrote or last re-read this against */
  reviewed: string;
  /** where timing numbers that are not in the game files came from */
  sources?: string[];
  attack?: {
    /** share of the attack period winding up, when the game file's is wrong for this champion */
    windup?: number;
    missileSpeed?: number;
    variants?: { within?: Formula; beyond?: Formula; when?: Formula; windup?: number; missileSpeed?: number; range?: number; options?: Record<string, number>; cast?: number }[];
  };
  actions?: Partial<Record<CastSlot, ActionSrc>>;
  windows?: WindowSrc[];
  distance?: DistanceSrc[];
  hooks?: Hooks;
  notes?: string[];
}

export const behaviour = (id: string, src: BehaviourSrc) => ({ id, src });
export type BehaviourFile = ReturnType<typeof behaviour>;

const ci = (pool: Record<string, unknown>, name: string) => pool[name] !== undefined ? name : Object.keys(pool).find(k => k.toLowerCase() === name.toLowerCase());

/** Compiles a behaviour formula for `champ`, reading `spell`'s values. Throws on a name it cannot place. */
export function compileFormula(f: Formula | boolean, champ: ChampionData, spell: string | undefined): Expr {
  if (typeof f === 'number') return { k: 'num', v: f };
  if (typeof f === 'boolean') return { k: 'num', v: f ? 1 : 0 };
  const sp = spell ? champ.spells[spell] : undefined;
  const locals = new Set([...champ.options.map(o => o.id), ...Object.keys(champ.counters), ...Object.keys(champ.vars), 'distance']);
  const own = (name: string, of = sp): Expr | undefined => {
    if (!of) return undefined;
    const tag = of === sp ? {} : { spell: of.id };
    const calc = ci(of.calcs, name);
    if (calc) return { k: 'calc', name: calc, ...tag };
    const dv = ci(of.dataValues, name);
    if (dv) return { k: 'dv', name: dv, ...tag };
    return undefined;
  };
  return parseExpr(String(f), path => {
    const [a, b] = path as [string, string | undefined];
    if (b === undefined) {
      if (locals.has(a) || (BUILTIN_VARS as readonly string[]).includes(a)) return { k: 'var', name: a };
      const alias = STAT_ALIASES[a];
      if (alias) return { k: 'stat', ...alias };
      const hit = own(a);
      if (hit) return hit;
      throw new Error(`${champ.id}: unknown name "${a}" in "${f}"${spell ? ` (not a value of ${spell})` : ''}`);
    }
    if (a === 'target') {
      if (!(TARGET_VARS as readonly string[]).includes(b)) throw new Error(`${champ.id}: unknown target property "${b}" in "${f}"`);
      return { k: 'var', name: `target.${b}` };
    }
    const other = champ.spells[ci(champ.spells, a) ?? ''];
    const hit = own(b, other);
    if (!hit) throw new Error(`${champ.id}: unknown name "${a}.${b}" in "${f}"`);
    return hit;
  }, (fn, name) => {
    if (fn === 'stacks') return { k: 'stacks', buff: name };
    const hit = own(name);
    if (!hit) throw new Error(`${champ.id}: unknown ${fn}('${name}') in "${f}"`);
    return hit;
  });
}
