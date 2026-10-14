/* What callers send the engine and what they get back. This is also the wire
   format of POST /api/v1/calc. */
import type { CastSlot, ChampionData, DamageType, ItemData, ModelStatus, Slot } from '../shared/types.ts';

export type Action = 'aa' | CastSlot;

export interface BuildInput {
  champion: string;
  level: number;
  ranks: Record<CastSlot, number>;
  /** item ids, in slot order; empty slots left out or null */
  items: (number | null)[];
  /** values for the champion's options (see ChampionData.options); omitted ones use their default */
  options?: Record<string, number | boolean>;
  /** settings of the build's items, by item id and then the control's id (see ItemModel.controls); omitted ones use their default */
  itemOptions?: Record<string, Record<string, number | boolean>>;
}

/** The enemy as plain numbers. `null` means raw output: no resistances, no health. */
export interface TargetInput {
  hp: number;
  armor: number;
  mr: number;
  /** health beyond the champion's own, from items; a few effects scale with it. 0 when unknown */
  bonusHp?: number;
}

export interface ComboInput {
  /** how many of each action; the engine weaves them into a default order */
  counts?: Partial<Record<Action, number>>;
  /** or the exact order, which matters for effects that read the target's health or stack */
  sequence?: Action[];
  /** how critical strikes count in the combo: at the build's crit chance (the default), none, or every one that can.
      Sustained damage and time to kill always use the average */
  crits?: CritMode;
}
export type CritMode = 'average' | 'never' | 'always';
export const CRIT_MODES: readonly CritMode[] = ['average', 'never', 'always'];

export interface CalcRequest {
  build: BuildInput;
  target: TargetInput | null;
  combo: ComboInput;
}

export interface Amount {
  /** before armor and magic resist */
  raw: number;
  /** after them; equals raw when there is no target */
  dealt: number;
}
export type ByType = Record<DamageType, Amount>;

export interface SourceLine {
  key: 'aa' | Slot | 'items';
  label: string;
  /** times it was used in the combo; null for passives and item effects, which are triggered */
  qty: number | null;
  /** the single type it deals, or mixed, or none */
  type: DamageType | 'mixed' | 'none';
  total: Amount;
  byType: ByType;
  /** what the line is made of: one entry per rule that fired */
  parts: { id: string; label: string; type: DamageType; hits: number; total: Amount; over?: OverTime }[];
  /** set when part of the line is not instant: those parts taken together */
  over?: OverTime;
  /** set when the line holds hits that can crit: its total with no crits, at the build's crit chance, and with every one */
  crits?: Record<CritMode, Amount>;
}

/** Damage that takes time to land: a burn, a channel, a zone the target stands in. */
export interface OverTime {
  /** how long it runs in this combo. Parts set off by one action run side by side; a second cast adds its own time */
  seconds: number;
  /** damage per second while it runs: `perSecond x seconds` is the damage dealt over time, so casting twice doubles the time, not the rate */
  perSecond: Amount;
}

export interface StatLine {
  total: number;
  base: number;
  bonus: number;
}
export interface StatBlock {
  level: number;
  hp: StatLine; mana: StatLine; ad: StatLine; ap: StatLine; armor: StatLine; mr: StatLine; moveSpeed: StatLine;
  /** total = attacks per second, base = at level 1 with no bonuses, bonus = bonus attack speed as a fraction */
  attackSpeed: StatLine;
  critChance: number;
  /** damage multiplier of a crit, e.g. 2.3 */
  critDamage: number;
  lethality: number;
  armorPenPct: number;
  magicPenFlat: number;
  magicPenPct: number;
  abilityHaste: number;
  /** ability haste for Q, W and E only, on top of abilityHaste */
  basicHaste: number;
  /** ability haste for R only, on top of abilityHaste */
  ultHaste: number;
  lifeSteal: number;
  omnivamp: number;
  attackRange: number;
  gold: number;
}

export interface ModelInfo {
  status: ModelStatus;
  notes: string[];
}

/** One cast of an ability on its own, with this build, against the target at full health. */
export interface AbilityInfo extends ModelInfo {
  /** everything the cast sets off: its hits, on-hit and spell effects of items, the passive; null without a rank */
  cast: (Amount & { byType: ByType }) | null;
  /** seconds between casts: the game's number at this rank, the ability haste that applies to it, and the result */
  cooldown: { base: number; haste: number; seconds: number } | null;
}

/** An item's named effect: what one firing deals and how often it fired in the combo. */
export interface ItemEffect {
  /** the rule's id; a `uses` or `procs` setting of the item has the same id */
  id: string;
  label: string;
  type: DamageType;
  /** one firing on its own against the target at full health, before what it sets off */
  one: Amount;
  /** firings in the combo */
  fired: number;
}

export interface ItemInfo extends ModelInfo {
  id: number;
  /** the item's settings as this build used them: what the caller set, or the default. A proc left to the combo is null */
  settings: Record<string, number | null>;
  effects: ItemEffect[];
}

export interface CalcResult {
  patch: string;
  stats: StatBlock;
  /** the order the combo was played in */
  sequence: Action[];
  combo: {
    /** how critical strikes were counted */
    crits: CritMode;
    total: Amount;
    byType: ByType;
    /** raw minus dealt: what armor and magic resist took */
    blocked: number;
    lines: SourceLine[];
    /** target health left, null without a target */
    hpLeft: number | null;
    kills: boolean;
  };
  /** sustained basic attacks with everything they trigger */
  dps: Amount;
  /** seconds of sustained basic attacks to kill from full health; null without a target or beyond the horizon */
  timeToKill: number | null;
  /** the passive has no cast and no cooldown */
  abilities: Record<Slot, AbilityInfo>;
  /** the value each of the champion's options had: what the caller set, or the default for this build */
  options: Record<string, number>;
  items: ItemInfo[];
  /** things the caller should tell the user: assumptions, and anything the engine could not evaluate */
  caveats: string[];
}

/** Where the engine reads compiled data from. */
export interface DataSource {
  patch: string;
  champion(id: string): ChampionData | undefined;
  item(id: number): ItemData | undefined;
}

export class CalcError extends Error {
  field: string;
  constructor(field: string, message: string) { super(message); this.field = field; }
}
