/* The shape of a hand-written model. See docs/models.md for the guide and
   src/models/champions/Samira.ts for a worked example.

   A model never contains game numbers. It names calculations and data values from
   the game files and says how they combine: how many times a hit lands, what it
   scales with on the target, what it adds to a basic attack. Balance patches then
   flow through untouched, and only mechanical reworks need a person. */
import type { DamageSource, DamageType, RuleDamage, Slot, StatModTarget, Trigger } from '../shared/types.ts';

/** A formula in the model language, or a plain number. */
export type Formula = string | number;

export interface RuleSrc {
  /** stable id, defaults to the rule's position; shows up in breakdowns and tests */
  id?: string;
  label?: string;
  /** defaults to `cast` under `hits`, required under `rules` */
  on?: Trigger;
  /** `adaptive`: physical or magic, by whichever of bonus attack damage and ability power is higher */
  type: RuleDamage;
  amount: Formula;
  count?: Formula;
  /** seconds this damage takes to be dealt, for anything that is not instant: shown as damage per second next to the total */
  over?: Formula;
  when?: Formula;
  /** damage of one instance when it crits; the engine then uses the crit-chance-weighted average */
  crit?: Formula;
  /** true = applies on-hit effects fully, or a fraction for reduced effectiveness */
  appliesOnHit?: boolean | number;
  cooldown?: Formula;
  /** counter updates: "plasma += 1", "plasma = 0" */
  then?: string | string[];
  note?: string;
  /** items: the user can set how many times this fires in the combo, in place of what the combo sets off on its own.
      `true` labels the control with the rule's label; a string is the control's own label */
  procs?: boolean | string;
  /** items, rules `on: 'use'` (an active): how many times it is used in the combo unless the user says; 1 when left out */
  uses?: Formula;
}

export interface StatModSrc {
  stat: StatModTarget;
  value: Formula;
  when?: Formula;
  phase?: 'flat' | 'percent' | 'convert';
}

export interface AmpSrc {
  /** 0.15 = +15% damage */
  value: Formula;
  when?: Formula;
  types?: DamageType[];
  /** only damage from these: `attack` (basic attacks), `ability` (Q W E R), `passive`, `item`, `rune` */
  from?: DamageSource[];
}

export interface ResistSrc {
  stat: 'armor' | 'mr';
  kind: 'reducePct' | 'reduceFlat' | 'penPct' | 'penFlat';
  value: Formula;
  when?: Formula;
}

export interface AbilitySrc {
  /** spell whose names the formulas use, when it is not the slot's own spell */
  spell?: string;
  /** damage dealt to one target by one cast */
  hits?: RuleSrc[];
  /** damage triggered by something else: attacks, other abilities, counters */
  rules?: RuleSrc[];
  statMods?: StatModSrc[];
  amps?: AmpSrc[];
  resists?: ResistSrc[];
  notes?: string[];
}

export interface OptionSrc {
  label: string;
  /** set only by the lab's timeline (a behaviour's window, distance or variant): never offered to users */
  timeline?: boolean;
  kind?: 'bool' | 'int';
  default: Formula | boolean;
  min?: number;
  max?: number;
}

export interface ChampionSrc extends Partial<Record<Slot, AbilitySrc>> {
  /** patch the author wrote or last re-read this model against */
  reviewed: string;
  /** slots a person has confirmed against the live game */
  verified?: Slot[];
  /** named formulas the rules share; may refer to each other */
  vars?: Record<string, Formula>;
  /** toggles and steppers the UI can expose; the default applies when the caller says nothing */
  options?: Record<string, OptionSrc>;
  /** stacks tracked across a combo, starting at 0 or at `start` */
  counters?: Record<string, CounterSrc>;
}

export interface CounterSrc {
  max?: Formula;
  /** the value it starts the fight with; may read options */
  start?: Formula;
}

export interface ItemOptionSrc extends Omit<OptionSrc, 'max'> {
  /** a number, or a formula of the item's data values, so the game's number stays in the game data: "MaxStacks", "AttackCount - 1" */
  max?: number | string;
}

export interface ItemSrc {
  reviewed: string;
  verified?: boolean;
  rules?: RuleSrc[];
  statMods?: StatModSrc[];
  amps?: AmpSrc[];
  resists?: ResistSrc[];
  counters?: Record<string, CounterSrc>;
  /** what the user can set about the item, by build: stacks already gained, a condition that holds. Read by name */
  options?: Record<string, ItemOptionSrc>;
  notes?: string[];
}

export const champion = (id: string, src: ChampionSrc) => ({ id, src });
export const item = (id: number, name: string, src: ItemSrc) => ({ id, name, src });
/** A rune's model has the shape of an item's. Its formulas read the rune's own named values and calculations. */
export const rune = (id: number, name: string, src: ItemSrc) => ({ id, name, src });
export type ChampionModelFile = ReturnType<typeof champion>;
export type ItemModelFile = ReturnType<typeof item>;
export type RuneModelFile = ReturnType<typeof rune>;
