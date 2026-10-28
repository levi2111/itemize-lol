/* The compiled dataset: what the pipeline writes and the engine reads.
   Everything here is plain JSON so the engine can run on a server or in a browser. */

export type DamageType = 'physical' | 'magic' | 'true';
export type Slot = 'p' | 'q' | 'w' | 'e' | 'r';
export const SLOTS: readonly Slot[] = ['p', 'q', 'w', 'e', 'r'];
export const CAST_SLOTS = ['q', 'w', 'e', 'r'] as const;
export type CastSlot = typeof CAST_SLOTS[number];

/** A champion stat a formula can read. */
export type StatId =
  | 'ap' | 'ad' | 'armor' | 'mr' | 'attackSpeed' | 'moveSpeed' | 'critChance' | 'critDamage'
  | 'cdr' | 'abilityHaste' | 'maxHealth' | 'currentHealth' | 'healthPct' | 'missingHealth' | 'missingHealthPct'
  | 'mana' | 'lifeSteal' | 'omnivamp' | 'physicalVamp' | 'lethality' | 'armorPenPct' | 'magicPenFlat' | 'magicPenPct'
  | 'tenacity' | 'attackRange' | 'healShieldPower';
export type StatKind = 'total' | 'base' | 'bonus';

/** Formula AST. The first block is compiled from game data; the second is only produced by hand-written models. */
export type Expr =
  | { k: 'num'; v: number }
  /** a named data value of a spell at that spell's current rank; `spell` set when it lives on another spell */
  | { k: 'dv'; name: string; spell?: string }
  /** legacy numbered effect amount (1-based) at the spell's current rank */
  | { k: 'eff'; index: number; spell?: string }
  | { k: 'stat'; stat: StatId; kind: StatKind; of?: 'target' }
  | { k: 'sum'; parts: Expr[] }
  | { k: 'mul'; parts: Expr[] }
  /** by champion level, 1..18. `growth` follows the stat growth curve instead of a straight line */
  | { k: 'lerp'; start: Expr; end: Expr; curve: 'linear' | 'growth' }
  | { k: 'breaks'; level1: Expr; perLevel: Expr; breakpoints: { level: number; add?: Expr; perLevel?: Expr }[] }
  /** indexed by champion level */
  | { k: 'table'; values: number[] }
  /** another calculation, on the same spell unless `spell` is set */
  | { k: 'calc'; name: string; spell?: string }
  | { k: 'clamp'; x: Expr; floor?: number; ceil?: number }
  /** stacks of a buff: not knowable from static data, supplied by a model or assumed 0 */
  | { k: 'stacks'; buff: string }
  /** 100 / (100 + ability haste) */
  | { k: 'cdMul' }
  /** number of completed items of at least this tier in the build */
  | { k: 'itemCount'; epicness: number }
  | { k: 'ifRanged'; ranged: Expr; melee: Expr }
  /** something the compiler does not understand; evaluating it marks the result unreliable */
  | { k: 'unknown'; what: string }
  // ---- authored ----
  | { k: 'var'; name: string }
  | { k: 'op'; op: BinaryOp; a: Expr; b: Expr }
  | { k: 'fn'; fn: FnName; args: Expr[] };

export type BinaryOp = '+' | '-' | '*' | '/' | '<' | '<=' | '>' | '>=' | '==' | '!=' | '&&' | '||';
export type FnName = 'min' | 'max' | 'floor' | 'ceil' | 'round' | 'abs' | 'if' | 'not' | 'clamp';

export interface CalcData {
  expr: Expr;
  /** the game tags some calculations with the damage type they deal */
  damageType?: DamageType;
  /** shown as a percentage in tooltips, i.e. the value is a fraction */
  percent?: boolean;
}

/** One damage mention found in a tooltip: `<magicDamage>@TotalDamage@ magic damage</magicDamage>`. */
export interface DamageRef {
  type: DamageType;
  /** what the placeholder names */
  ref: { kind: 'calc' | 'dv' | 'eff'; name: string; spell?: string };
  /** the placeholder was written as @X*100@ */
  times100: boolean;
  /** which part of the tooltip it sits in */
  section: 'passive' | 'active' | 'body';
  /** index of the enclosing damage tag: placeholders sharing a tag are parts of one amount */
  group: number;
  /** words that follow the placeholder inside the tag, e.g. "max Health", "per stack" */
  qualifier: string;
  /** a short window of the surrounding prose, for reviewers */
  context: string;
}

export interface SpellData {
  /** object name in game data, e.g. SamiraR */
  id: string;
  name?: string;
  /** the ability slot whose rank this spell follows, when the game data ties it to one */
  slot?: Slot;
  maxRank: number;
  cooldown?: number[];
  cost?: number[];
  castTime?: number;
  /** index = rank, 0 is the unlearned rank */
  dataValues: Record<string, number[]>;
  /** index 0 unused so that effects[n] is Effect<n>Amount; inner index = rank */
  effects: number[][];
  calcs: Record<string, CalcData>;
  /** tooltip template with includes expanded; tooling only, never served */
  tooltip?: string;
  damageRefs: DamageRef[];
}

export interface BaseStats {
  hp: number; hpPerLevel: number;
  mana: number; manaPerLevel: number;
  ad: number; adPerLevel: number;
  armor: number; armorPerLevel: number;
  mr: number; mrPerLevel: number;
  moveSpeed: number;
  attackRange: number;
  /** attacks per second at level 1 */
  attackSpeed: number;
  /** what bonus attack speed is multiplied by; differs from `attackSpeed` on many champions */
  attackSpeedRatio: number;
  /** percent bonus attack speed per level, as a fraction */
  attackSpeedPerLevel: number;
  /** damage multiplier of a critical strike before items */
  critDamage: number;
}

// ---------- models: how formulas turn into damage ----------

/** When a rule fires. */
export type Trigger =
  /** the owning ability is cast (only valid on q/w/e/r) */
  | 'cast'
  /** a basic attack lands */
  | 'attack'
  /** on-hit: a basic attack, or an ability hit that applies on-hit effects */
  | 'onhit'
  /** any ability is used, damaging or not (spellblade effects) */
  | 'ability'
  /** an ability dealt damage, once per cast (spell effects such as burns and echoes) */
  | 'spell'
  /** every single instance of damage, with hit.physical / hit.magic / hit.true saying which type it was */
  | 'damage'
  /** after every action, for reactions to counters crossing a threshold */
  | 'after'
  /** an item's active, used at the start of the combo as many times as its `uses` control says (items only) */
  | 'use';

export interface Rule {
  id: string;
  label?: string;
  on: Trigger;
  type: DamageType;
  /** damage of one instance before resistances */
  amount: Expr;
  /** how many instances one firing deals to a single target */
  count?: Expr;
  /** seconds one firing's instances are spread over (a burn, a channel, a zone); reported as damage per second next to the total */
  over?: Expr;
  /** the rule only fires when this is non-zero */
  when?: Expr;
  /** amount of one instance when it critically strikes; makes the hit use expected crit value */
  crit?: Expr;
  /** this hit applies on-hit effects at this effectiveness (1 = fully) */
  appliesOnHit?: number;
  /** seconds before the rule can fire again */
  cooldown?: Expr;
  /** counter updates applied after the rule fires */
  then?: { counter: string; op: 'set' | 'add'; value: Expr }[];
  /** free-text assumption shown to the user, e.g. "all 10 shots hit" */
  note?: string;
}

/** Multiplies damage dealt: 0.15 = +15%. Separate amps multiply with each other. */
export interface Amp {
  value: Expr;
  when?: Expr;
  /** damage types it applies to; all when omitted */
  types?: DamageType[];
  /** what the damage has to come from; all when omitted */
  from?: DamageSource[];
}
/** Who dealt a piece of damage: a basic attack, an ability (Q W E R), the champion's passive, or an item. */
export type DamageSource = 'attack' | 'ability' | 'passive' | 'item';
export const DAMAGE_SOURCES: readonly DamageSource[] = ['attack', 'ability', 'passive', 'item'];

/** Changes the target's resistance for as long as its condition holds, e.g. armor shred that builds with hits. */
export interface ResistMod {
  stat: 'armor' | 'mr';
  /** `reduce*` lower the target's resistance; `pen*` add to the attacker's penetration. `penBonusPct` penetrates the bonus part only */
  kind: 'reducePct' | 'reduceFlat' | 'penPct' | 'penBonusPct' | 'penFlat';
  value: Expr;
  when?: Expr;
}

/** A permanent or conditional stat change granted by a passive or an item. */
export interface StatMod {
  stat: StatModTarget;
  value: Expr;
  when?: Expr;
  /** `flat` adds to bonus, `percent` multiplies the total (value 0.3 = +30%), `convert` runs after both */
  phase: 'flat' | 'percent' | 'convert';
}
export type StatModTarget =
  | 'ad' | 'ap' | 'hp' | 'mana' | 'armor' | 'mr' | 'attackSpeed' | 'critChance' | 'critDamage' | 'abilityHaste'
  /** ability haste for Q, W and E only, and for R only */
  | 'basicHaste' | 'ultHaste'
  | 'lethality' | 'armorPenPct' | 'magicPenFlat' | 'magicPenPct' | 'moveSpeed' | 'movePct' | 'lifeSteal' | 'omnivamp';

/** A stack counter's limit, and its value when a fight starts (0 when left out). */
export interface CounterDef {
  max?: Expr;
  start?: Expr;
}

export interface OptionDef {
  id: string;
  label: string;
  kind: 'bool' | 'int';
  /** evaluated against the build when the caller does not set it */
  default: Expr;
  min?: number;
  max?: number;
}

/** How trustworthy a model is. The README explains what each status promises. */
export type ModelStatus =
  /** hand-written and confirmed in game by a person */
  | 'verified'
  /** hand-written from game data and tooltip, structure unchanged since it was written */
  | 'curated'
  /** hand-written, but the underlying spell changed shape since: needs a second look */
  | 'stale'
  /** derived from the tooltip by heuristics */
  | 'auto'
  /** deals no damage as far as we can tell */
  | 'none'
  /** deals damage we cannot yet compute */
  | 'unmodeled';

export interface AbilityModel {
  status: ModelStatus;
  /** the spell whose data values and calculations unqualified names refer to */
  spell: string;
  rules: Rule[];
  statMods?: StatMod[];
  amps?: Amp[];
  resists?: ResistMod[];
  /** user-visible assumptions and caveats */
  notes: string[];
}

export interface ChampionData {
  id: string;
  key: number;
  name: string;
  title: string;
  tags: string[];
  resource: string;
  ranged: boolean;
  stats: BaseStats;
  slots: Record<Slot, { spell: string; name: string; icon: string; maxRank: number }>;
  spells: Record<string, SpellData>;
  /** named helper formulas shared by this champion's rules */
  vars: Record<string, Expr>;
  options: OptionDef[];
  counters: Record<string, CounterDef>;
  models: Record<Slot, AbilityModel>;
  /** places where the sources disagreed while compiling */
  warnings: string[];
  /** what this champion's players build (data/popularity): their sampled builds, and the share holding each item id */
  itemPopularity?: { builds: number; shares: Record<string, number> };
}

/** Summoner's Rift, ARAM, Arena. */
export type ItemShop = 'sr' | 'aram' | 'arena';
/** The in-game shop's role filters, in its order. */
export type ItemRole = 'Fighter' | 'Marksman' | 'Assassin' | 'Mage' | 'Tank' | 'Support';

export interface ItemData {
  id: number;
  name: string;
  gold: number;
  tags: string[];
  plaintext: string;
  /** the shops that sell it; ARAM's and Arena's copies of a Rift item are items of their own */
  shops: ItemShop[];
  /** builds into other items: shown under Components in the picker */
  component: boolean;
  /** the shop's role filters that list it */
  roles: ItemRole[];
  /** what players call it, lower case, letters and digits only: "bork", "qss" */
  aliases: string[];
  /** the names of what it turns into once bought: Muramana for Manamune */
  forms: string[];
  /** what it does that the picker's search finds it by: "antiheal", "shield" */
  traits: string[];
  /** the share of sampled builds that hold it, or something built from it (data/popularity); absent without a sample */
  popularity?: number;
  /** epicness tier from game data: 5+ is a completed item */
  tier: number;
  stats: Partial<Record<StatModTarget, number>>;
  dataValues: Record<string, number>;
  calcs: Record<string, CalcData>;
  tooltip?: string;
  damageRefs: DamageRef[];
  model: ItemModel;
}

export interface ItemModel {
  status: ModelStatus;
  rules: Rule[];
  statMods: StatMod[];
  amps?: Amp[];
  resists?: ResistMod[];
  counters: Record<string, CounterDef>;
  /** what the caller can set about the item: stacks, a toggle, how often an effect fires in the combo */
  controls?: ItemControl[];
  notes: string[];
}

/** One thing about an item the caller can set, by build. Formulas of the item read a `bool` or `int` by its id. */
export interface ItemControl {
  id: string;
  label: string;
  /**
   * `bool`, `int`: a state the fight starts in, such as stacks already gained or a condition that holds.
   * `uses`: how many times the active (the rule `rule`, on `use`) is used at the start of the combo.
   * `procs`: how many times the rule `rule` fires in the combo, replacing what the combo would set off
   * on its own. It has no default: left unset, the combo decides.
   */
  kind: 'bool' | 'int' | 'uses' | 'procs';
  /** evaluated against the build when the caller does not set it; never set for `procs` */
  default?: Expr;
  min?: number;
  max?: number;
  rule?: string;
}

export interface DatasetManifest {
  /** Data Dragon version, e.g. 16.20.1 */
  patch: string;
  /** what players call it, e.g. 26.20 */
  displayPatch: string;
  builtAt: string;
  sources: { ddragon: string; cdragon: { path: string; build: string } };
  champions: number;
  items: number;
  coverage: Record<ModelStatus, number>;
}
