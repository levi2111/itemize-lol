/* Fallback models, derived from tooltip templates for everything nobody has
   written a model for yet.

   The rule is to be conservative and say what was assumed. A tooltip names the
   calculations and their damage types reliably; how they combine it only says in
   prose. So an automatic model counts the first damage amount the tooltip gives for
   a cast, applies a repeat count only when the prose states one as a literal number
   with "each", and lists everything it left out in the notes. */
import type { AbilityModel, DamageRef, Expr, ItemModel, Rule, Slot } from '../shared/types.ts';
import type { CompiledChampion } from './champion.ts';
import type { CompiledItem } from './items.ts';
import { unresolved } from './tooltip.ts';

const WORD_NUMBERS: Record<string, number> = { twice: 2, thrice: 3, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };
const HIT_NOUN = '(?:times?|shots?|hits?|waves?|bolts?|missiles?|strikes?|slashes?|blades?|bullets?|attacks?|ticks?|pulses?|blasts?)';

const tv = (name: string): Expr => ({ k: 'var', name: `target.${name}` });
const refExpr = (r: DamageRef): Expr => {
  const spell = r.ref.spell ? { spell: r.ref.spell } : {};
  if (r.ref.kind === 'calc') return { k: 'calc', name: r.ref.name, ...spell };
  if (r.ref.kind === 'dv') return { k: 'dv', name: r.ref.name, ...spell };
  return { k: 'eff', index: Number(r.ref.name), ...spell };
};

/** Turns one tooltip placeholder into an amount, or explains why it cannot. */
function partAmount(r: DamageRef, isPercent: boolean): { expr?: Expr; skipped?: string } {
  const q = r.qualifier;
  const value = refExpr(r);
  const of = (what: string): Expr => ({ k: 'mul', parts: [value, tv(what)] });
  if (/\bper\b|\bfor each\b/.test(q)) return { skipped: `"${r.ref.name} ${q}" scales with a count the tooltip does not fix` };
  if (/max(imum)? health/.test(q)) return { expr: of('maxHp') };
  if (/current health/.test(q)) return { expr: of('hp') };
  if (/missing health/.test(q)) return { expr: of('missingHp') };
  if (isPercent || r.times100) return { skipped: `"${r.ref.name}" is a percentage of something the tooltip does not name` };
  return { expr: value };
}

/** A literal repeat count stated next to the damage: "10 times … each shot dealing [X]", "twice for [X] each". */
function repeatCount(context: string): number | undefined {
  const [before = '', rest = ''] = context.split('[');
  const after = rest.split(']')[1] ?? '';
  // only the sentence the damage sits in may supply the count
  const sentence = before.split(/[.!?]/).pop() ?? '';
  if (!/\beach\b/i.test(sentence) && !/^\s*each\b/i.test(after)) return undefined;
  if (/\bup to\b|\bat least\b|\bevery\b/i.test(sentence)) return undefined;
  const word = /\b(twice|thrice)\b/i.exec(sentence)?.[1]
    ?? new RegExp(`\\b(\\d+|two|three|four|five|six|seven|eight|nine|ten)\\s+${HIT_NOUN}\\b`, 'i').exec(sentence)?.[1];
  if (!word) return undefined;
  const n = WORD_NUMBERS[word.toLowerCase()] ?? Number(word);
  return Number.isInteger(n) && n >= 2 && n <= 30 ? n : undefined;
}

export function autoAbilityModel(champ: CompiledChampion, slot: Slot): AbilityModel {
  const spellId = champ.slots[slot].spell;
  const spell = champ.spells[spellId];
  const model: AbilityModel = { status: 'none', spell: spellId, rules: [], notes: [] };
  if (!spell) { model.status = 'unmodeled'; model.notes.push('No game data found for this ability.'); return model; }
  const refs = spell.damageRefs;
  if (!refs.length) {
    // "No damage" is only a safe reading of a tooltip we could read in full. A spell with formulas
    // and no legible tooltip is unknown, not harmless.
    if (unresolved(spell.tooltip) && Object.keys(spell.calcs).length > 0) {
      model.status = 'unmodeled';
      model.notes.push('The description of this ability could not be read, so its damage is not counted.');
    }
    return model;
  }

  if (slot === 'p') {
    // Passives fire on conditions only prose describes. Guessing a trigger would put
    // made-up damage on every attack, so they wait for a hand-written model.
    model.status = 'unmodeled';
    model.notes.push('This passive deals damage that is not modeled yet.');
    return model;
  }

  const castable = refs.filter(r => r.section !== 'passive');
  if (!castable.length) {
    model.status = 'unmodeled';
    model.notes.push('Only this ability\'s passive part deals damage, which is not modeled yet.');
    return model;
  }
  const first = castable[0]!;
  const group = castable.filter(r => r.group === first.group);
  const parts: Expr[] = [];
  for (const r of group) {
    const calc = r.ref.kind === 'calc' ? (r.ref.spell ? champ.spells[r.ref.spell] : spell)?.calcs[r.ref.name] : undefined;
    const { expr, skipped } = partAmount(r, !!calc?.percent);
    if (expr) parts.push(expr);
    else if (skipped) model.notes.push(`Left out: ${skipped}.`);
  }
  if (!parts.length) { model.status = 'unmodeled'; return model; }

  const rule: Rule = { id: 'auto', on: 'cast', type: first.type, amount: parts.length === 1 ? parts[0]! : { k: 'sum', parts } };
  const n = repeatCount(first.context);
  if (n) { rule.count = { k: 'num', v: n }; rule.note = `Assumes all ${n} hits land on the target.`; }
  model.rules.push(rule);
  model.status = 'auto';
  model.notes.push('Estimated from the tooltip: counts the first damage amount it lists for a cast.');
  if (rule.note) model.notes.push(rule.note);
  const others = [...new Set(castable.filter(r => r.group !== first.group).map(r => r.ref.name))].filter(nm => !group.some(g => g.ref.name === nm));
  if (others.length) model.notes.push(`Not counted: ${others.join(', ')}.`);
  if (refs.some(r => r.section === 'passive')) model.notes.push('The passive part of this ability is not counted.');
  return model;
}

/** "Attacks deal [X] bonus magic damage On-Hit": the one item pattern safe to read automatically. */
const ON_HIT = /attacks (?:deal|apply)(?: an additional)? \[\{(\w+)\} (?:bonus )?(?:physical|magic|true) damage\]\s*(?:%i:\w+%\s*)?on-hit/i;

export function autoItemModel(item: CompiledItem): ItemModel {
  const model: ItemModel = { status: 'none', rules: [], statMods: [], counters: {}, notes: [] };
  if (!item.damageRefs.length) return model;
  const first = item.damageRefs[0]!;
  const m = ON_HIT.exec(first.context);
  const calc = first.ref.kind === 'calc' ? item.calcs[first.ref.name] : undefined;
  if (m && item.damageRefs.filter(r => r.group === first.group).length === 1 && !calc?.percent && !first.times100) {
    model.rules.push({ id: 'onhit', on: 'onhit', type: first.type, amount: refExpr(first) });
    model.status = 'auto';
    model.notes.push('On-hit damage read from the tooltip.');
    if (item.damageRefs.some(r => r.group !== first.group)) model.notes.push('Other effects of this item are not counted.');
    return model;
  }
  model.status = 'unmodeled';
  model.notes.push('Only this item\'s stats are counted; its passive damage is not modeled yet.');
  return model;
}
