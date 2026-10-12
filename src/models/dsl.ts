/* The shape of a hand-written model. See docs/models.md for the guide and
   src/models/champions/Samira.ts for a worked example.

   A model never contains game numbers. It names calculations and data values from
   the game files and says how they combine: how many times a hit lands, what it
   scales with on the target, what it adds to a basic attack. Balance patches then
   flow through untouched, and only mechanical reworks need a person. */
import type { DamageType, Slot, StatModTarget, Trigger } from '../shared/types.ts';

/** A formula in the model language, or a plain number. */
export type Formula = string | number;

export interface RuleSrc {
  /** stable id, defaults to the rule's position; shows up in breakdowns and tests */
  id?: string;
  label?: string;
  /** defaults to `cast` under `hits`, required under `rules` */
  on?: Trigger;
  type: DamageType;
  amount: Formula;
  count?: Formula;
  when?: Formula;
  /** damage of one instance when it crits; the engine then uses the crit-chance-weighted average */
  crit?: Formula;
  /** true = applies on-hit effects fully, or a fraction for reduced effectiveness */
  appliesOnHit?: boolean | number;
  cooldown?: Formula;
  /** counter updates: "plasma += 1", "plasma = 0" */
  then?: string | string[];
  note?: string;
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
  /** stacks tracked across a combo, starting at 0 */
  counters?: Record<string, { max?: Formula }>;
}

export interface ItemSrc {
  reviewed: string;
  verified?: boolean;
  rules?: RuleSrc[];
  statMods?: StatModSrc[];
  amps?: AmpSrc[];
  resists?: ResistSrc[];
  counters?: Record<string, { max?: Formula }>;
  notes?: string[];
}

export const champion = (id: string, src: ChampionSrc) => ({ id, src });
export const item = (id: number, name: string, src: ItemSrc) => ({ id, name, src });
export type ChampionModelFile = ReturnType<typeof champion>;
export type ItemModelFile = ReturnType<typeof item>;
