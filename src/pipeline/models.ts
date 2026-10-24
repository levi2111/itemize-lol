/* Stage 3: bind hand-written models to this patch's game data.

   Every name a model uses is checked against the compiled spells. A model that no
   longer binds (a calculation was renamed or removed) is reported and that ability
   falls back to the automatic model, so a patch can never make a model quietly
   read zeros. A model that still binds but whose spell changed shape since it was
   last accepted is kept and marked stale. */
import { createHash } from 'node:crypto';
import { evaluate, walk, type EvalEnv } from '../shared/expr.ts';
import { BUILTIN_VARS, CAST_VARS, HIT_VARS, RANK_VARS, STAT_ALIASES, TARGET_VARS } from '../shared/names.ts';
import type { AbilityModel, Amp, CalcData, ChampionData, CounterDef, Expr, ItemControl, ItemModel, OptionDef, ResistMod, Rule, Slot, SpellData, StatMod } from '../shared/types.ts';
import { DAMAGE_SOURCES, SLOTS } from '../shared/types.ts';
import type { AmpSrc, ChampionSrc, CounterSrc, Formula, ItemSrc, ResistSrc, RuleSrc, StatModSrc } from '../models/dsl.ts';
import { parseExpr, type Resolve, type ResolveQuoted } from '../models/parse.ts';
import { autoAbilityModel, autoItemModel } from './automodel.ts';
import type { CompiledChampion } from './champion.ts';
import type { CompiledItem } from './items.ts';
import type { CompiledRune } from './runes.ts';

export interface Lock {
  champions: Record<string, Partial<Record<Slot, string>>>;
  items: Record<string, string>;
  /** kept apart from items: some rune ids are also item ids */
  runes?: Record<string, string>;
}
export interface ModelIssue { where: string; message: string }

interface NameScope {
  calcs: Record<string, CalcData>;
  dataValues: Record<string, unknown>;
  effects: number;
}
const ci = (pool: Record<string, unknown>, name: string) => pool[name] !== undefined ? name : Object.keys(pool).find(k => k.toLowerCase() === name.toLowerCase());

function lookup(scope: NameScope, name: string, spell?: string): Expr | undefined {
  const tag = spell ? { spell } : {};
  const eff = /^e(\d+)$/.exec(name);
  if (eff && Number(eff[1]) >= 1 && Number(eff[1]) <= scope.effects) return { k: 'eff', index: Number(eff[1]), ...tag };
  const calc = ci(scope.calcs, name);
  if (calc) return { k: 'calc', name: calc, ...tag };
  const dv = ci(scope.dataValues, name);
  if (dv) return { k: 'dv', name: dv, ...tag };
  return undefined;
}

interface Binder {
  expr(f: Formula | boolean): Expr;
}

function binder(own: NameScope | undefined, ownId: string, others: (spell: string) => { id: string; scope: NameScope } | undefined, locals: Set<string>): Binder {
  const resolve: Resolve = path => {
    const [a, b, ...rest] = path as [string, string | undefined, ...string[]];
    if (rest.length) throw new Error(`"${path.join('.')}" has too many parts`);
    if (b === undefined) {
      if (locals.has(a) || (BUILTIN_VARS as readonly string[]).includes(a)) return { k: 'var', name: a };
      const alias = STAT_ALIASES[a];
      if (alias) return { k: 'stat', ...alias };
      const hit = own && lookup(own, a);
      if (hit) return hit;
      throw new Error(`unknown name "${a}"${own ? ` (not a calculation, data value or effect of ${ownId})` : ''}`);
    }
    if (a === 'target') {
      if (!(TARGET_VARS as readonly string[]).includes(b)) throw new Error(`unknown target property "${b}"`);
      return { k: 'var', name: `target.${b}` };
    }
    if (a === 'hit') {
      if (!(HIT_VARS as readonly string[]).includes(b)) throw new Error(`unknown damage type "${b}"`);
      return { k: 'var', name: `hit.${b}` };
    }
    if (a === 'cast') {
      if (!(CAST_VARS as readonly string[]).includes(b)) throw new Error(`unknown ability "${b}"`);
      return { k: 'var', name: `cast.${b}` };
    }
    if (a === 'rank') {
      if (!(RANK_VARS as readonly string[]).includes(b)) throw new Error(`unknown rank "${b}"`);
      return { k: 'var', name: `rank.${b}` };
    }
    const other = others(a);
    if (!other) throw new Error(`unknown spell "${a}"`);
    const hit = lookup(other.scope, b, other.id);
    if (!hit) throw new Error(`"${b}" is not a calculation, data value or effect of ${other.id}`);
    return hit;
  };
  const quoted: ResolveQuoted = (fn, name) => {
    if (fn === 'stacks') return { k: 'stacks', buff: name };
    if (!own) throw new Error(`${fn}('${name}') needs a spell`);
    const pool = fn === 'calc' ? own.calcs : own.dataValues;
    if (pool[name] === undefined) throw new Error(`${ownId} has no ${fn === 'calc' ? 'calculation' : 'data value'} '${name}'`);
    return fn === 'calc' ? { k: 'calc', name } : { k: 'dv', name };
  };
  return {
    expr(f) {
      if (typeof f === 'number') return { k: 'num', v: f };
      if (typeof f === 'boolean') return { k: 'num', v: f ? 1 : 0 };
      return parseExpr(f, resolve, quoted);
    },
  };
}

function bindRule(src: RuleSrc, index: number, defaultOn: Rule['on'] | undefined, b: Binder, counters: Set<string>): Rule {
  const on = src.on ?? defaultOn;
  if (!on) throw new Error(`rule ${src.id ?? index} needs "on"`);
  const rule: Rule = { id: src.id ?? `${on}${index}`, on, type: src.type, amount: b.expr(src.amount) };
  if (src.label) rule.label = src.label;
  if (src.count !== undefined) rule.count = b.expr(src.count);
  if (src.over !== undefined) rule.over = b.expr(src.over);
  if (src.when !== undefined) rule.when = b.expr(src.when);
  if (src.crit !== undefined) rule.crit = b.expr(src.crit);
  if (src.appliesOnHit) rule.appliesOnHit = src.appliesOnHit === true ? 1 : src.appliesOnHit;
  if (src.cooldown !== undefined) rule.cooldown = b.expr(src.cooldown);
  if (src.note) rule.note = src.note;
  const thens = src.then === undefined ? [] : Array.isArray(src.then) ? src.then : [src.then];
  if (thens.length) {
    rule.then = thens.map(stmt => {
      const m = /^\s*([A-Za-z_]\w*)\s*(\+=|=)\s*(.+)$/.exec(stmt);
      if (!m) throw new Error(`cannot read counter update "${stmt}"`);
      if (!counters.has(m[1]!)) throw new Error(`"${m[1]}" is not a declared counter`);
      return { counter: m[1]!, op: m[2] === '=' ? 'set' as const : 'add' as const, value: b.expr(m[3]!) };
    });
  }
  return rule;
}

const bindStatMod = (s: StatModSrc, b: Binder): StatMod => ({
  stat: s.stat, value: b.expr(s.value), phase: s.phase ?? 'flat',
  ...(s.when !== undefined && { when: b.expr(s.when) }),
});

const bindAmp = (a: AmpSrc, b: Binder): Amp => {
  for (const f of a.from ?? []) if (!DAMAGE_SOURCES.includes(f)) throw new Error(`amp "from" names "${f}"; it can be ${DAMAGE_SOURCES.join(', ')}`);
  return {
    value: b.expr(a.value),
    ...(a.when !== undefined && { when: b.expr(a.when) }),
    ...(a.types && { types: a.types }),
    ...(a.from?.length && { from: a.from }),
  };
};
const bindCounter = (c: CounterSrc, b: Binder): CounterDef => ({
  ...(c.max !== undefined && { max: b.expr(c.max) }),
  ...(c.start !== undefined && { start: b.expr(c.start) }),
});
/** `procs` and `uses` give the user a control over an item's rule; a champion's rules have their options instead. */
const itemOnly = (r: RuleSrc) => {
  if (r.on === 'use') throw new Error(`rule ${r.id ?? ''} is on "use", which only an item's active can be`);
  if (r.procs !== undefined || r.uses !== undefined) throw new Error(`rule ${r.id ?? ''} has "procs" or "uses", which only items can have`);
};
const bindResist = (r: ResistSrc, b: Binder): ResistMod => ({
  stat: r.stat, kind: r.kind, value: b.expr(r.value),
  ...(r.when !== undefined && { when: b.expr(r.when) }),
});

/** A spell's shape with the numbers taken out: changes when mechanics change, not when values are tuned. */
function shape(spell: { calcs: Record<string, CalcData>; dataValues: Record<string, unknown>; tooltip?: string }, extra: unknown = null): unknown {
  const strip = (e: Expr): unknown => JSON.parse(JSON.stringify(e, (k, v) => (k === 'v' || k === 'values') ? undefined : v));
  return {
    calcs: Object.keys(spell.calcs).sort().map(n => [n, strip(spell.calcs[n]!.expr), spell.calcs[n]!.damageType ?? null]),
    dataValues: Object.keys(spell.dataValues).sort(),
    // the prose is where hit counts and conditions live, so its literal numbers do count
    tooltip: spell.tooltip ?? null,
    extra,
  };
}
const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);

const spellScope = (s: SpellData): NameScope => ({ calcs: s.calcs, dataValues: s.dataValues, effects: s.effects.length - 1 });

export interface ResolvedChampion {
  vars: Record<string, Expr>;
  options: OptionDef[];
  counters: ChampionData['counters'];
  models: Record<Slot, AbilityModel>;
  fingerprints: Partial<Record<Slot, string>>;
  issues: ModelIssue[];
}

export function resolveChampion(champ: CompiledChampion, src: ChampionSrc | undefined, lock: Lock): ResolvedChampion {
  const issues: ModelIssue[] = [];
  const out: ResolvedChampion = { vars: {}, options: [], counters: {}, models: {} as Record<Slot, AbilityModel>, fingerprints: {}, issues };
  const auto = (slot: Slot) => autoAbilityModel(champ, slot);
  if (!src) {
    for (const slot of SLOTS) out.models[slot] = auto(slot);
    return out;
  }

  const locals = new Set([...Object.keys(src.vars ?? {}), ...Object.keys(src.options ?? {}), ...Object.keys(src.counters ?? {})]);
  const counters = new Set(Object.keys(src.counters ?? {}));
  const others = (name: string) => {
    const s = Object.values(champ.spells).find(x => x.id.toLowerCase() === name.toLowerCase());
    return s && { id: s.id, scope: spellScope(s) };
  };
  const shared = binder(undefined, champ.id, others, locals);
  const fail = (where: string, err: unknown) => issues.push({ where: `${champ.id}.${where}`, message: err instanceof Error ? err.message : String(err) });

  // Shared pieces first. If any of them fails, every slot of this champion falls back.
  let sharedOk = true;
  for (const [name, f] of Object.entries(src.vars ?? {})) {
    try { out.vars[name] = shared.expr(f); } catch (e) { sharedOk = false; fail(`vars.${name}`, e); }
  }
  for (const [id, o] of Object.entries(src.options ?? {})) {
    try {
      out.options.push({ id, label: o.label, kind: o.kind ?? (typeof o.default === 'boolean' ? 'bool' : 'int'), default: shared.expr(o.default), ...(o.min !== undefined && { min: o.min }), ...(o.max !== undefined && { max: o.max }) });
    } catch (e) { sharedOk = false; fail(`options.${id}`, e); }
  }
  for (const [id, c] of Object.entries(src.counters ?? {})) {
    try { out.counters[id] = bindCounter(c, shared); } catch (e) { sharedOk = false; fail(`counters.${id}`, e); }
  }
  if (!sharedOk) {
    out.vars = {}; out.options = []; out.counters = {};
    for (const slot of SLOTS) {
      out.models[slot] = auto(slot);
      if (src[slot]) out.models[slot].notes.push('A hand-written model exists but does not match this patch; showing the estimate instead.');
    }
    return out;
  }
  const sharedShape = { vars: src.vars ?? {}, options: src.options ?? {}, counters: src.counters ?? {} };

  for (const slot of SLOTS) {
    const a = src[slot];
    if (!a) { out.models[slot] = auto(slot); continue; }
    try {
      const spellId = a.spell ?? champ.slots[slot].spell;
      const spell = champ.spells[spellId];
      if (!spell) throw new Error(`spell "${spellId}" does not exist`);
      const b = binder(spellScope(spell), spell.id, others, locals);
      if (slot === 'p' && a.hits?.length) throw new Error('a passive cannot be cast: use "rules" with a trigger');
      [...(a.hits ?? []), ...(a.rules ?? [])].forEach(itemOnly);
      const rules = [
        ...(a.hits ?? []).map((r, i) => bindRule(r, i, 'cast', b, counters)),
        ...(a.rules ?? []).map((r, i) => bindRule(r, i, undefined, b, counters)),
      ];
      const model: AbilityModel = { status: src.verified?.includes(slot) ? 'verified' : 'curated', spell: spell.id, rules, notes: [...(a.notes ?? [])] };
      if (a.statMods?.length) model.statMods = a.statMods.map(s => bindStatMod(s, b));
      if (a.amps?.length) model.amps = a.amps.map(x => bindAmp(x, b));
      if (a.resists?.length) model.resists = a.resists.map(x => bindResist(x, b));
      for (const r of rules) if (r.note) model.notes.push(r.note);

      // every spell the model reads takes part in the fingerprint
      const touched = new Set([spell.id]);
      const exprs = [
        ...rules.flatMap(r => [r.amount, r.count, r.over, r.when, r.crit, r.cooldown, ...(r.then ?? []).map(t => t.value)]),
        ...[...(model.statMods ?? []), ...(model.amps ?? []), ...(model.resists ?? [])].flatMap(s => [s.value, s.when]),
        ...Object.values(out.vars),
      ];
      for (const e of exprs) if (e) for (const n of walk(e)) if ('spell' in n && n.spell) touched.add(n.spell);
      const fp = hash([[...touched].sort().map(id => shape(champ.spells[id]!)), a, sharedShape]);
      out.fingerprints[slot] = fp;
      const locked = lock.champions[champ.id]?.[slot];
      if (locked && locked !== fp) {
        model.status = 'stale';
        model.notes.push('This ability changed since its model was last reviewed; numbers may be off.');
      }
      out.models[slot] = model;
    } catch (e) {
      fail(slot, e);
      out.models[slot] = auto(slot);
      out.models[slot].notes.push('A hand-written model exists but does not match this patch; showing the estimate instead.');
    }
  }
  return out;
}

/** How many times a combo can use an active or count an effect by hand. */
const MAX_COUNTED = 20;

/** The item's options, then a count for each active and each rule marked `procs`, in rule order. */
function itemControls(item: CompiledItem, src: ItemSrc, rules: Rule[], b: Binder): ItemControl[] {
  const out: ItemControl[] = [];
  const ids = new Set<string>();
  const add = (c: ItemControl) => {
    if (ids.has(c.id)) throw new Error(`"${c.id}" names both an option and a rule the user can count; rename one`);
    ids.add(c.id); out.push(c);
  };
  // a limit may be a formula of data values ("AttackCount - 1"): the game's numbers, read once here, as an
  // item's data values do not change with rank. Anything that depends on the fight is refused.
  const limit = (v: number | string | undefined, what: string): number | undefined => {
    if (v === undefined || typeof v === 'number') return v;
    const refuse = (name: string) => { throw new Error(`${what} "${v}" reads ${name}; a limit can only use the item's data values`); };
    const env: EvalEnv = {
      level: 1, ranged: false, stat: s => refuse(s), scope: () => undefined, variable: n => refuse(n),
      stacks: () => 0, itemCount: () => 0, unknown: w => refuse(w),
    };
    const scope = { id: `item ${item.id}`, dv: (n: string) => item.dataValues[n], eff: () => undefined, calc: () => undefined };
    return evaluate(b.expr(v), env, scope);
  };
  for (const [id, o] of Object.entries(src.options ?? {})) {
    const kind = o.kind ?? (typeof o.default === 'boolean' ? 'bool' : 'int');
    const c: ItemControl = { id, label: o.label, kind, default: b.expr(o.default) };
    if (kind === 'int') { c.min = o.min ?? 0; const max = limit(o.max, `option ${id}'s max`); if (max !== undefined) c.max = max; }
    add(c);
  }
  const seen = new Set<string>();
  for (const [i, r] of (src.rules ?? []).entries()) {
    const rule = rules[i]!;
    if (seen.has(rule.id)) throw new Error(`two rules are called "${rule.id}"`);
    seen.add(rule.id);
    const label = (fallback: string) => typeof r.procs === 'string' ? r.procs : rule.label ?? fallback;
    if (rule.on === 'use') {
      if (r.procs !== undefined) throw new Error(`rule ${rule.id} is an active: its count is its uses, so it takes "uses" and not "procs"`);
      if (!rule.label) throw new Error(`active ${rule.id} needs a label: it names the control`);
      add({ id: rule.id, label: rule.label, kind: 'uses', default: b.expr(r.uses ?? 1), min: 0, max: MAX_COUNTED, rule: rule.id });
    } else if (r.uses !== undefined) throw new Error(`rule ${rule.id} has "uses" but is not on "use"`);
    else if (r.procs) add({ id: rule.id, label: label(rule.id), kind: 'procs', min: 0, max: MAX_COUNTED, rule: rule.id });
  }
  return out;
}

/** `original` is set for another shop's copy of a Rift item, bound with the Rift item's model: the copy
    is then checked against what was reviewed for the original. Its stats are the copy's own and do
    not count; a passive or tooltip that differs marks it stale. */
export function resolveItem(item: CompiledItem, src: ItemSrc | undefined, lock: Lock, original?: CompiledItem): { model: ItemModel; fingerprint?: string; issues: ModelIssue[] } {
  if (!src) return { model: autoItemModel(item), issues: [] };
  try {
    const counters = new Set(Object.keys(src.counters ?? {}));
    const locals = new Set([...counters, ...Object.keys(src.options ?? {})]);
    const b = binder({ calcs: item.calcs, dataValues: item.dataValues, effects: 0 }, `item ${item.id}`, () => undefined, locals);
    const model: ItemModel = {
      status: src.verified ? 'verified' : 'curated',
      rules: (src.rules ?? []).map((r, i) => bindRule(r, i, undefined, b, counters)),
      statMods: (src.statMods ?? []).map(s => bindStatMod(s, b)),
      counters: Object.fromEntries(Object.entries(src.counters ?? {}).map(([id, c]) => [id, bindCounter(c, b)])),
      notes: [...(src.notes ?? [])],
    };
    if (src.amps?.length) model.amps = src.amps.map(x => bindAmp(x, b));
    if (src.resists?.length) model.resists = src.resists.map(x => bindResist(x, b));
    const controls = itemControls(item, src, model.rules, b);
    if (controls.length) model.controls = controls;
    for (const r of model.rules) if (r.note) model.notes.push(r.note);
    const fingerprint = hash([shape(item, (original ?? item).stats), src]);
    const locked = lock.items[String((original ?? item).id)];
    if (locked && locked !== fingerprint) {
      model.status = 'stale';
      model.notes.push('This item changed since its model was last reviewed; numbers may be off.');
    }
    return { model, fingerprint, issues: [] };
  } catch (e) {
    const model = autoItemModel(item);
    model.notes.push('A hand-written model exists but does not match this patch; showing the estimate instead.');
    return { model, issues: [{ where: `item ${item.id} ${item.name}`, message: e instanceof Error ? e.message : String(e) }] };
  }
}

/** A rune binds like an item, against its own named values and calculations. Without a model it is
    `unmodeled`: runes have no tooltip damage mentions to estimate from. */
export function resolveRune(rune: CompiledRune, src: ItemSrc | undefined, lock: Lock): { model: ItemModel; fingerprint?: string; issues: ModelIssue[] } {
  if (!src) return { model: { status: 'unmodeled', rules: [], statMods: [], counters: {}, notes: ['Not modelled yet: it changes nothing in the calculation.'] }, issues: [] };
  const asItem = { id: rune.id, name: rune.name, gold: 0, tags: [], plaintext: '', shops: [], component: false, tier: 0, stats: {}, dataValues: rune.dataValues, calcs: rune.calcs, tooltip: rune.desc, damageRefs: [] } as CompiledItem;
  const res = resolveItem(asItem, src, { champions: {}, items: lock.runes ?? {} });
  if (res.issues.length) res.model = { status: 'unmodeled', rules: [], statMods: [], counters: {}, notes: ['A hand-written model exists but does not match this patch; it changes nothing in the calculation.'] };
  res.model.notes = res.model.notes.map(n => n.startsWith('This item changed since') ? 'This rune changed since its model was last reviewed; numbers may be off.' : n);
  res.issues = res.issues.map(i => ({ ...i, where: `rune ${rune.id} ${rune.name}` }));
  return res;
}
