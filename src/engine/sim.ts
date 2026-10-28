/* One fight: a build, a target, and a sequence of actions played against it.
   Stats are worked out once up front; then each action deals its damage and fires
   whatever rules it triggers, in order, against a target whose health goes down as
   the fight goes on. */
import { evaluate, growth, type EvalEnv, type Scope } from '../shared/expr.ts';
import type {
  Amp, CastSlot, ChampionData, CounterDef, DamageSource, DamageType, Expr, ItemControl, ItemData, ResistMod, Rule, Slot, SpellData, StatId, StatKind, StatMod, StatModTarget, Trigger,
} from '../shared/types.ts';
import { CAST_SLOTS, SLOTS } from '../shared/types.ts';
import type { Action, BuildInput, CritMode, StatBlock, StatLine, TargetStats } from './types.ts';

/** Attack speed limits. The cap is one attack per 0.333 s. */
const AS_MIN = 0.2, AS_MAX = 3.003;
/** Used when the game data gives an ability no cast time. Only matters for cooldown-gated effects. */
const DEFAULT_CAST_TIME = 0.25;
/** A rule's repeat count is played hit by hit up to this many, so each can see the health the last one left. */
const MAX_INSTANCES = 60;

/** `bonus` is the part of `resist` that is bonus, which `bonusPctPen` (penetration of bonus resistance only) also cuts. */
export function resistAfterPen(resist: number, pctPen: number, flatPen: number, bonus = 0, bonusPctPen = 0): number {
  // penetration does nothing to a target already at or below zero, and cannot push it below zero
  if (resist <= 0) return resist;
  return Math.max(0, (resist - bonus * bonusPctPen) * (1 - pctPen) - flatPen);
}
export const damageMultiplier = (resist: number) => resist >= 0 ? 100 / (100 + resist) : 2 - 100 / (100 - resist);

interface Owner {
  key: string;
  /** breakdown line its damage is reported under */
  line: 'aa' | Slot | 'items';
  label: string;
  slot?: Slot;
  /** what an amp limited to some sources sees this owner's damage as */
  source: DamageSource;
  rules: Rule[];
  statMods: StatMod[];
  amps: Amp[];
  resists: ResistMod[];
  counterMax: Record<string, CounterDef>;
  scope: Scope;
  /** prefix that keeps one item's counters and settings apart from another's */
  ns: string;
  /** the champion's own rules also see its options and helper formulas */
  champion: boolean;
  /** an item's settings the caller can change */
  controls: ItemControl[];
  itemId?: number;
}

/** How a rule is being fired: by its trigger, as an active being used, or as a proc the caller counted by hand. */
type FireMode = 'trigger' | 'use' | 'proc';

export interface Hit {
  line: Owner['line'];
  owner: string;
  rule: string;
  label: string;
  type: DamageType;
  raw: number;
  dealt: number;
  instances: number;
  /** a basic attack, or a rule with its own crit amount: damage that can be a critical strike */
  crit: boolean;
}

const NO_SCOPE: Scope = { id: '(none)', dv: () => undefined, eff: () => undefined, calc: () => undefined };
const AUTO_ATTACK: Owner = {
  key: 'aa', line: 'aa', label: 'Auto attack', source: 'attack', rules: [], statMods: [], amps: [], resists: [], counterMax: {}, scope: NO_SCOPE, ns: '', champion: false, controls: [],
};
const ZERO_MODS = (): Record<StatModTarget, number> => ({
  ad: 0, ap: 0, hp: 0, mana: 0, armor: 0, mr: 0, attackSpeed: 0, critChance: 0, critDamage: 0, abilityHaste: 0, basicHaste: 0, ultHaste: 0, lethality: 0,
  armorPenPct: 0, magicPenFlat: 0, magicPenPct: 0, moveSpeed: 0, movePct: 0, lifeSteal: 0, omnivamp: 0,
});
const line = (base: number, bonus: number): StatLine => ({ base, bonus, total: base + bonus });

export interface FightOptions {
  /** simulating sustained basic attacks rather than a combo: effects that ramp up count as ramped */
  sustained?: boolean;
  /** how critical strikes count; see ComboInput.crits */
  crits?: CritMode;
}

export class Fight {
  readonly champ: ChampionData;
  readonly items: ItemData[];
  readonly level: number;
  readonly ranks: Record<CastSlot, number>;
  readonly sustained: boolean;
  readonly crits: CritMode;
  readonly caveats = new Set<string>();
  readonly hits: Hit[] = [];
  /** rules whose damage takes time to land, by `owner/rule`: the seconds it runs for, per action that set it off */
  readonly spread = new Map<string, Map<number, number>>();
  /** how many times each rule fired, by `owner/rule`, whether or not it dealt damage */
  readonly fired = new Map<string, number>();
  /** how many actions have been played; what a rule sets off within one action runs side by side */
  private action = 0;
  stats!: StatBlock;
  time = 0;

  private readonly options = new Map<string, number>();
  /** items' settings as this fight settled them, by the item's namespace and the control's id */
  private readonly settings = new Map<string, number>();
  /** `owner/rule` of procs the caller counted by hand: they fire that many times at the end of the combo, and never on their own */
  private readonly counted = new Set<string>();
  private readonly counters = new Map<string, number>();
  private readonly lastFired = new Map<string, number>();
  private readonly owners: Owner[] = [];
  /** the target's stats as the fight started, and the health it has left */
  private readonly target: TargetStats & { left: number } | null;
  private readonly env: EvalEnv;
  private current: Owner | undefined;
  private varDepth = 0;
  /** type of the damage instance a `damage` rule is reacting to */
  private hitType: DamageType | undefined;
  /** the ability whose cast is being played */
  private casting: CastSlot | undefined;
  /** a preview is being played: one rule on its own, setting nothing else off */
  private quiet = false;
  /** stats are worked out; from here on a formula reading crit chance means the chance that a hit crits */
  private settled = false;

  constructor(champ: ChampionData, items: ItemData[], build: BuildInput, target: TargetStats | null, opts: FightOptions = {}) {
    this.champ = champ;
    this.items = items;
    this.level = build.level;
    this.ranks = build.ranks;
    this.sustained = !!opts.sustained;
    this.crits = opts.crits ?? 'average';
    this.target = target ? { ...target, left: target.hp.total } : null;
    this.env = {
      level: build.level,
      ranged: champ.ranged,
      stat: (stat, kind, of) => this.readStat(stat, kind, of),
      scope: spell => this.spellScope(spell),
      variable: name => this.readVar(name),
      // Buff stacks are not knowable from static data. Models that depend on them use counters or options instead.
      stacks: () => 0,
      itemCount: epicness => this.items.filter(i => !i.component && i.tier >= epicness).length,
      unknown: what => { this.caveats.add(`Could not evaluate ${what}; it was counted as 0.`); },
    };

    for (const slot of SLOTS) {
      const model = champ.models[slot];
      const spell = champ.spells[model.spell];
      this.owners.push({
        key: slot, line: slot, label: champ.slots[slot].name, slot, source: slot === 'p' ? 'passive' : 'ability', rules: model.rules,
        statMods: model.statMods ?? [], amps: model.amps ?? [], resists: model.resists ?? [], counterMax: champ.counters,
        scope: spell ? this.scopeOf(spell) : NO_SCOPE, ns: '', champion: true, controls: [],
      });
    }
    for (const it of items) {
      const m = it.model;
      this.owners.push({
        key: `item:${it.id}`, line: 'items', label: it.name, source: 'item', rules: m.rules,
        statMods: m.statMods, amps: m.amps ?? [], resists: m.resists ?? [], counterMax: m.counters,
        scope: { id: `item ${it.id}`, dv: n => it.dataValues[n], eff: () => undefined, calc: n => it.calcs[n] },
        ns: `item:${it.id}:`, champion: false, controls: m.controls ?? [], itemId: it.id,
      });
    }

    this.computeStats(build);
    this.settled = true;
    this.startCounters();
  }

  /** The share of hits that can crit that do: the crit chance, or none or all of them when the caller asks. */
  get critRate(): number {
    return this.crits === 'never' ? 0 : this.crits === 'always' ? 1 : this.stats.critChance;
  }

  // ---------- reading the world ----------

  private rankOf(slot: Slot | undefined): number {
    if (!slot || slot === 'p') return 1;
    return this.ranks[slot] ?? 0;
  }
  private active(owner: Owner): boolean {
    return !owner.slot || owner.slot === 'p' || this.rankOf(owner.slot) >= 1;
  }
  private scopeOf(spell: SpellData): Scope {
    const rank = () => Math.max(0, this.rankOf(spell.slot ?? this.current?.slot));
    const at = (v: number[] | undefined) => v === undefined ? undefined : v[Math.min(rank(), v.length - 1)];
    return { id: spell.id, dv: n => at(spell.dataValues[n]), eff: i => at(spell.effects[i]), calc: n => spell.calcs[n] };
  }
  private spellScope(id: string): Scope | undefined {
    const spell = this.champ.spells[id] ?? Object.values(this.champ.spells).find(s => s.id.toLowerCase() === id.toLowerCase());
    return spell && this.scopeOf(spell);
  }

  private needsTarget(): number {
    this.caveats.add('Some effects scale with the target\'s health or resistances and count as 0 in raw output.');
    return 0;
  }
  private targetVar(name: string): number | undefined {
    const t = this.target;
    if (!t) return this.needsTarget();
    // armor and magic resist are the target's own, before anything in the fight lowers them
    switch (name) {
      case 'maxHp': return t.hp.total;
      case 'baseHp': return t.hp.base;
      case 'bonusHp': return t.hp.bonus;
      case 'hp': return t.left;
      case 'missingHp': return t.hp.total - t.left;
      case 'hpPct': return t.hp.total ? t.left / t.hp.total : 0;
      case 'missingHpPct': return t.hp.total ? 1 - t.left / t.hp.total : 0;
      case 'armor': return t.armor.total;
      case 'baseArmor': return t.armor.base;
      case 'bonusArmor': return t.armor.bonus;
      case 'mr': return t.mr.total;
      case 'baseMr': return t.mr.base;
      case 'bonusMr': return t.mr.bonus;
    }
    return undefined;
  }

  private readStat(stat: StatId, kind: StatKind, of?: 'target'): number {
    const s = this.stats;
    const of3 = (l: StatLine) => kind === 'base' ? l.base : kind === 'bonus' ? l.bonus : l.total;
    if (of === 'target') {
      const t = this.target;
      switch (stat) {
        case 'maxHealth': return t ? of3(t.hp) : this.needsTarget();
        case 'armor': return t ? of3(t.armor) : this.needsTarget();
        case 'mr': return t ? of3(t.mr) : this.needsTarget();
      }
      const name = ({ currentHealth: 'hp', missingHealth: 'missingHp', healthPct: 'hpPct', missingHealthPct: 'missingHpPct' } as Partial<Record<StatId, string>>)[stat];
      const v = name ? this.targetVar(name) : undefined;
      if (v === undefined) { this.env.unknown(`the target's ${stat}`); return 0; }
      return v;
    }
    switch (stat) {
      case 'ad': return of3(s.ad);
      case 'ap': return of3(s.ap);
      case 'armor': return of3(s.armor);
      case 'mr': return of3(s.mr);
      case 'maxHealth': return of3(s.hp);
      case 'mana': return of3(s.mana);
      case 'moveSpeed': return of3(s.moveSpeed);
      case 'attackSpeed': return of3(s.attackSpeed);
      // Stat changes see the stat. Damage sees the rate, so that models which average crits by hand
      // (a passive's bonus "on crit", say) follow the caller's choice of never or always as well.
      case 'critChance': return this.settled ? this.critRate : s.critChance;
      case 'critDamage': return s.critDamage;
      case 'abilityHaste': return s.abilityHaste;
      // the game expresses cooldown reduction as a negative fraction
      case 'cdr': return -s.abilityHaste / (100 + s.abilityHaste);
      case 'lethality': return s.lethality;
      case 'armorPenPct': return s.armorPenPct;
      case 'magicPenFlat': return s.magicPenFlat;
      case 'magicPenPct': return s.magicPenPct;
      case 'lifeSteal': return s.lifeSteal;
      case 'omnivamp': return s.omnivamp;
      case 'attackRange': return s.attackRange;
      // the attacker is assumed to be at full health
      case 'currentHealth': return s.hp.total;
      case 'healthPct': return 1;
      case 'missingHealth': case 'missingHealthPct': return 0;
      case 'physicalVamp': case 'tenacity': case 'healShieldPower': return 0;
    }
  }

  private readVar(name: string): number | undefined {
    const owner = this.current;
    switch (name) {
      case 'level': return this.level;
      case 'rank': return this.rankOf(owner?.slot);
      case 'ranged': return this.champ.ranged ? 1 : 0;
      case 'melee': return this.champ.ranged ? 0 : 1;
      case 'time': return this.time;
      case 'sustained': return this.sustained ? 1 : 0;
      case 'hasTarget': return this.target ? 1 : 0;
      case 'adFromLevels': return this.stats.ad.base - this.champ.stats.ad;
    }
    if (name.startsWith('target.')) return this.targetVar(name.slice(7));
    if (name.startsWith('hit.')) return this.hitType === name.slice(4) ? 1 : 0;
    if (name.startsWith('cast.')) return this.casting === name.slice(5) ? 1 : 0;
    if (name.startsWith('rank.')) return this.rankOf(name.slice(5) as Slot);
    if (owner && name in owner.counterMax) return this.counters.get(owner.ns + name) ?? 0;
    // helper formulas are evaluated without an owner but still belong to the champion
    if (owner && !owner.champion) {
      const v = this.settings.get(owner.ns + name);
      if (v !== undefined) return v;
      // a setting being settled may read another one that is not settled yet
      return owner.controls.some(c => c.id === name) ? 0 : undefined;
    }
    if (name in this.champ.counters) return this.counters.get(name) ?? 0;
    const opt = this.options.get(name);
    if (opt !== undefined) return opt;
    const v = this.champ.vars[name];
    if (v) {
      if (this.varDepth > 12) { this.env.unknown(`helper formula ${name} (it refers to itself)`); return 0; }
      this.varDepth++;
      try { return this.eval(v, undefined); } finally { this.varDepth--; }
    }
    // an option being settled may read another one that is not settled yet
    if (this.champ.options.some(o => o.id === name)) return 0;
    return undefined;
  }

  private eval(e: Expr, owner: Owner | undefined): number {
    const before = this.current;
    this.current = owner;
    try { return evaluate(e, this.env, owner?.scope ?? NO_SCOPE); } finally { this.current = before; }
  }

  // ---------- stats ----------

  private computeStats(build: BuildInput): void {
    const b = this.champ.stats, g = growth(this.level);
    const mods = ZERO_MODS();
    let armorKept = 1, magicKept = 1;
    const add = (stat: StatModTarget, v: number) => {
      // percentage penetration from separate sources multiplies together
      if (stat === 'armorPenPct') armorKept *= 1 - v;
      else if (stat === 'magicPenPct') magicKept *= 1 - v;
      else mods[stat] += v;
    };
    const assemble = (): StatBlock => {
      const asBonus = b.attackSpeedPerLevel * g + mods.attackSpeed;
      const ms = (b.moveSpeed + mods.moveSpeed) * (1 + mods.movePct);
      return {
        level: this.level,
        hp: line(b.hp + b.hpPerLevel * g, mods.hp),
        mana: line(b.mana + b.manaPerLevel * g, mods.mana),
        ad: line(b.ad + b.adPerLevel * g, mods.ad),
        ap: line(0, mods.ap),
        armor: line(b.armor + b.armorPerLevel * g, mods.armor),
        mr: line(b.mr + b.mrPerLevel * g, mods.mr),
        moveSpeed: { base: b.moveSpeed, bonus: ms - b.moveSpeed, total: ms },
        attackSpeed: { base: b.attackSpeed, bonus: asBonus, total: Math.min(AS_MAX, Math.max(AS_MIN, b.attackSpeed + b.attackSpeedRatio * asBonus)) },
        critChance: Math.min(1, Math.max(0, mods.critChance)),
        critDamage: b.critDamage + mods.critDamage,
        lethality: mods.lethality,
        armorPenPct: 1 - armorKept,
        magicPenFlat: mods.magicPenFlat,
        magicPenPct: 1 - magicKept,
        abilityHaste: mods.abilityHaste,
        basicHaste: mods.basicHaste,
        ultHaste: mods.ultHaste,
        lifeSteal: mods.lifeSteal,
        omnivamp: mods.omnivamp,
        attackRange: b.attackRange,
        gold: this.items.reduce((s, i) => s + i.gold, 0),
      };
    };
    const totalOf = (stat: StatModTarget): number => {
      const s = this.stats;
      switch (stat) {
        case 'ad': return s.ad.total;
        case 'ap': return s.ap.total;
        case 'hp': return s.hp.total;
        case 'mana': return s.mana.total;
        case 'armor': return s.armor.total;
        case 'mr': return s.mr.total;
        case 'attackSpeed': return s.attackSpeed.bonus;
        case 'moveSpeed': return s.moveSpeed.total;
        default: return mods[stat];
      }
    };

    for (const it of this.items) for (const [k, v] of Object.entries(it.stats)) add(k as StatModTarget, v);
    this.stats = assemble();

    // Options may read stats (an evolution threshold, say), so they are settled on item stats
    // alone, before any conditional stat change that could itself depend on an option.
    for (const o of this.champ.options) {
      const given = build.options?.[o.id];
      let v = given === undefined ? this.eval(o.default, undefined) : Number(given);
      if (o.kind === 'bool') v = v ? 1 : 0;
      else v = Math.round(Math.min(o.max ?? Infinity, Math.max(o.min ?? -Infinity, v)));
      this.options.set(o.id, Number.isFinite(v) ? v : 0);
    }
    // items' settings, the same way. A proc nobody counted has no value: the combo decides how often it fires
    for (const owner of this.owners) {
      for (const c of owner.controls) {
        const given = build.itemOptions?.[String(owner.itemId)]?.[c.id];
        if (c.kind === 'procs' && given === undefined) continue;
        let v = given === undefined ? (c.default ? this.eval(c.default, owner) : 0) : Number(given);
        if (c.kind === 'bool') v = v ? 1 : 0;
        else v = Math.round(Math.min(c.max ?? Infinity, Math.max(c.min ?? 0, v)));
        this.settings.set(owner.ns + c.id, Number.isFinite(v) ? v : 0);
        if (c.kind === 'procs' && c.rule && !this.sustained) this.counted.add(`${owner.key}/${c.rule}`);
      }
    }

    for (const phase of ['flat', 'percent', 'convert'] as const) {
      const pending: [StatModTarget, number][] = [];
      for (const owner of this.owners) {
        if (!this.active(owner)) continue;
        for (const mod of owner.statMods) {
          if (mod.phase !== phase) continue;
          if (mod.when && !this.eval(mod.when, owner)) continue;
          const v = this.eval(mod.value, owner);
          pending.push([mod.stat, phase === 'percent' ? totalOf(mod.stat) * v : v]);
        }
      }
      // mods of one phase all see the stats as the previous phase left them
      for (const [stat, v] of pending) add(stat, v);
      if (pending.length) this.stats = assemble();
    }
  }

  /** Counters with a `start` begin there, once options and settings are known: stacks gained before the fight. */
  private startCounters(): void {
    const start = (owner: Owner | undefined, ns: string, defs: Record<string, CounterDef>) => {
      for (const [name, c] of Object.entries(defs)) {
        if (!c.start) continue;
        const v = this.eval(c.start, owner);
        this.counters.set(ns + name, c.max ? Math.min(v, this.eval(c.max, owner)) : v);
      }
    };
    start(undefined, '', this.champ.counters);
    for (const owner of this.owners) if (!owner.champion) start(owner, owner.ns, owner.counterMax);
  }

  // ---------- dealing damage ----------

  get targetHp(): number | null { return this.target ? this.target.left : null; }

  /** Every option of the champion as this fight settled it: the caller's value, or the default worked out from the build. */
  get optionValues(): Record<string, number> { return Object.fromEntries(this.options); }

  /** One item's settings as this fight settled them; a proc left to the combo is null. */
  itemSettings(itemId: number): Record<string, number | null> {
    const owner = this.owners.find(o => o.itemId === itemId);
    return Object.fromEntries((owner?.controls ?? []).map(c => [c.id, this.settings.get(owner!.ns + c.id) ?? null]));
  }

  /** The target's resistance to this type right now, after shred and penetration. */
  private resistance(type: 'physical' | 'magic'): number {
    const t = this.target!, s = this.stats;
    const stat = type === 'physical' ? 'armor' : 'mr';
    let reduceFlat = 0, keptByReduce = 1, keptByPen = 1 - (type === 'physical' ? s.armorPenPct : s.magicPenPct), keptByBonusPen = 1;
    let flatPen = type === 'physical' ? s.lethality : s.magicPenFlat;
    for (const owner of this.owners) {
      if (!this.active(owner)) continue;
      for (const r of owner.resists) {
        if (r.stat !== stat || (r.when && !this.eval(r.when, owner))) continue;
        const v = this.eval(r.value, owner);
        if (r.kind === 'reduceFlat') reduceFlat += v;
        else if (r.kind === 'reducePct') keptByReduce *= 1 - v;
        else if (r.kind === 'penPct') keptByPen *= 1 - v;
        else if (r.kind === 'penBonusPct') keptByBonusPen *= 1 - v;
        else flatPen += v;
      }
    }
    // order: flat reduction, percent reduction, percent penetration (of all of it, then of the bonus part), flat penetration.
    // Reductions take from base and bonus alike: flat reduction in proportion to each, as the wiki's worked example has it
    const own = t[stat];
    let resist = own.total - reduceFlat, bonus = own.total > 0 ? own.bonus * resist / own.total : 0;
    if (resist > 0) { resist *= keptByReduce; bonus *= keptByReduce; }
    return resistAfterPen(resist, 1 - keptByPen, flatPen, bonus, 1 - keptByBonusPen);
  }

  /** `from` is whoever deals the damage: an amp can be limited to some sources (abilities only, say). */
  private amplify(from: DamageSource, type: DamageType, raw: number): number {
    for (const owner of this.owners) {
      if (!this.active(owner)) continue;
      for (const a of owner.amps) {
        if (a.types && !a.types.includes(type)) continue;
        if (a.from && !a.from.includes(from)) continue;
        if (a.when && !this.eval(a.when, owner)) continue;
        raw *= 1 + this.eval(a.value, owner);
      }
    }
    return raw;
  }

  /** Returns whether anything was dealt. */
  private deal(owner: Owner, rule: string, label: string, type: DamageType, amount: number, crit = false): boolean {
    if (!(amount > 0)) return false;
    const raw = this.amplify(owner.source, type, amount);
    const dealt = !this.target || type === 'true' ? raw : raw * damageMultiplier(this.resistance(type));
    if (this.target) this.target.left = Math.max(0, this.target.left - dealt);
    const last = this.hits.at(-1);
    if (last && last.owner === owner.key && last.rule === rule && last.type === type) { last.raw += raw; last.dealt += dealt; last.instances++; }
    else this.hits.push({ line: owner.line, owner: owner.key, rule, label, type, raw, dealt, instances: 1, crit });
    // rules reacting to damage do not react to the damage they deal themselves
    if (this.hitType === undefined) {
      this.hitType = type;
      try { this.trigger('damage'); } finally { this.hitType = undefined; }
    }
    return true;
  }

  /** Fires one rule. Returns true if it fired, whether or not it did damage. An active being used skips its
      cooldown; a proc the caller counted by hand skips its condition as well, and never fires on its trigger. */
  private fire(owner: Owner, rule: Rule, effectiveness = 1, mode: FireMode = 'trigger'): boolean {
    const key = `${owner.key}/${rule.id}`;
    if (mode === 'trigger' && (rule.on === 'use' || this.counted.has(key))) return false;
    if (mode !== 'proc' && rule.when && !this.eval(rule.when, owner)) return false;
    if (mode === 'trigger' && rule.cooldown) {
      const last = this.lastFired.get(key);
      if (last !== undefined && this.time - last < this.eval(rule.cooldown, owner) - 1e-9) return false;
    }
    const count = rule.count ? this.eval(rule.count, owner) : 1;
    const whole = Number.isInteger(count) && count <= MAX_INSTANCES;
    const label = rule.label ?? owner.label;
    const one = (): number => {
      let amount = this.eval(rule.amount, owner);
      // abilities that can crit are reported at their crit-chance-weighted average, or as the caller asked
      const rate = this.critRate;
      if (rule.crit && rate > 0) amount += rate * (this.eval(rule.crit, owner) - amount);
      return amount * effectiveness;
    };
    let landed = false;
    const crit = !!rule.crit;
    if (whole) for (let i = 0; i < count; i++) landed = this.deal(owner, rule.id, label, rule.type, one(), crit) || landed;
    else if (count > 0) landed = this.deal(owner, rule.id, label, rule.type, one() * count, crit);
    // the damage is still dealt at once and the fight's clock does not wait for it: the duration is only reported
    if (landed && rule.over) {
      const seconds = this.eval(rule.over, owner);
      if (seconds > 0) {
        const byAction = this.spread.get(key) ?? new Map<number, number>();
        byAction.set(this.action, Math.max(byAction.get(this.action) ?? 0, seconds));
        this.spread.set(key, byAction);
      }
    }
    for (const t of rule.then ?? []) {
      const k = owner.ns + t.counter;
      const v = this.eval(t.value, owner);
      const next = t.op === 'set' ? v : (this.counters.get(k) ?? 0) + v;
      const max = owner.counterMax[t.counter]?.max;
      this.counters.set(k, max ? Math.min(next, this.eval(max, owner)) : next);
    }
    this.lastFired.set(key, this.time);
    this.fired.set(key, (this.fired.get(key) ?? 0) + 1);
    if (rule.appliesOnHit) this.trigger('onhit', rule.appliesOnHit);
    return true;
  }

  /** Item rules fired a set number of times: actives (`use`) at the start of the combo, counted procs at the end. */
  private fireCounted(which: 'use' | 'proc'): void {
    if (this.sustained) return;
    for (const owner of this.owners) {
      for (const rule of owner.rules) {
        const counted = which === 'use' ? rule.on === 'use' : this.counted.has(`${owner.key}/${rule.id}`);
        if (!counted) continue;
        const n = this.settings.get(owner.ns + rule.id) ?? 0;
        for (let i = 0; i < n; i++) {
          this.action++;
          this.fire(owner, rule, 1, which);
          this.trigger('after');
        }
      }
    }
  }
  /** Before the combo's first action: the items' actives. */
  begin(): void { this.fireCounted('use'); }
  /** After its last: the procs the caller counted by hand. */
  end(): void { this.fireCounted('proc'); }

  /** What one firing of an item's rule deals as the fight stands, its own damage only: on a fresh fight, one proc
      against the target at full health. Its condition and cooldown are skipped. */
  preview(itemId: number, ruleId: string): { raw: number; dealt: number } {
    const owner = this.owners.find(o => o.itemId === itemId), rule = owner?.rules.find(r => r.id === ruleId);
    const out = { raw: 0, dealt: 0 };
    if (!owner || !rule) return out;
    const from = this.hits.length;
    this.action++;
    // nothing reacts to it: a rule on `damage` would otherwise set itself off again, its cooldown not yet started
    this.quiet = true;
    try { this.fire(owner, rule, 1, 'proc'); } finally { this.quiet = false; }
    for (const h of this.hits.slice(from)) if (h.owner === owner.key && h.rule === rule.id) { out.raw += h.raw; out.dealt += h.dealt; }
    return out;
  }

  private trigger(on: Trigger, effectiveness = 1): void {
    if (this.quiet) return;
    for (const owner of this.owners) {
      if (!this.active(owner)) continue;
      for (const rule of owner.rules) if (rule.on === on) this.fire(owner, rule, effectiveness);
    }
  }

  /** Seconds one basic attack takes. */
  get attackPeriod(): number { return 1 / this.stats.attackSpeed.total; }

  /** An ability's cooldown at its rank: the game's number and what ability haste (all of it, plus the basic or
      ultimate kind) makes of it. Null when it has no rank or the game data gives none. */
  cooldown(slot: CastSlot): { base: number; haste: number; seconds: number } | null {
    const cd = this.champ.spells[this.champ.slots[slot].spell]?.cooldown, rank = this.rankOf(slot);
    const base = cd?.[Math.min(rank, cd.length - 1)];
    if (rank < 1 || base === undefined) return null;
    const haste = this.stats.abilityHaste + (slot === 'r' ? this.stats.ultHaste : this.stats.basicHaste);
    return { base, haste, seconds: base * 100 / (100 + haste) };
  }

  act(action: Action): void {
    this.action++;
    if (action === 'aa') {
      const s = this.stats;
      // crits are averaged: 25% crit chance at 2.0x is 1.25x on every attack
      this.deal(AUTO_ATTACK, 'attack', 'Auto attack', 'physical', s.ad.total * (1 + this.critRate * (s.critDamage - 1)), true);
      this.trigger('attack');
      this.trigger('onhit');
      this.trigger('after');
      this.time += this.attackPeriod;
      return;
    }
    const owner = this.owners.find(o => o.slot === action);
    if (!owner || !this.active(owner)) return;
    const before = this.hits.reduce((s, h) => s + h.raw, 0);
    this.casting = action;
    try {
      // "after using an ability" effects are armed by the cast itself, so the same cast's on-hit can spend them
      this.trigger('ability');
      for (const rule of owner.rules) if (rule.on === 'cast') this.fire(owner, rule);
      if (this.hits.reduce((s, h) => s + h.raw, 0) > before) this.trigger('spell');
      this.trigger('after');
    } finally { this.casting = undefined; }
    this.time += this.champ.spells[this.champ.models[action].spell]?.castTime ?? DEFAULT_CAST_TIME;
  }
}

/** Autos first and between casts, casts in Q W E R order: a plain trading pattern. */
export function defaultSequence(counts: Partial<Record<Action, number>>): Action[] {
  const n = (a: Action) => Math.max(0, Math.floor(counts[a] ?? 0));
  const casts: Action[] = CAST_SLOTS.flatMap(s => Array<Action>(n(s)).fill(s));
  let autos = n('aa');
  const out: Action[] = [];
  while (autos > 0 || casts.length) {
    if (autos > 0) { out.push('aa'); autos--; }
    const c = casts.shift();
    if (c) out.push(c);
  }
  return out;
}
