/* Reads the game's tooltip templates. They are the only place the game says which
   calculation deals which type of damage, so the automatic models start from here. */
import type { DamageRef, DamageType } from '../shared/types.ts';

export type StringTable = Record<string, string>;

/** Expands {{ Other_Key }} includes. Keys are case-insensitive. */
export function expandTooltip(key: string | undefined, table: StringTable, depth = 0): string | undefined {
  if (!key) return undefined;
  let text = table[key.toLowerCase()];
  if (text === undefined && key.includes('@')) {
    // Some keys carry a variable the game fills in at runtime: Spell_KhazixQ_Tooltip_@IsEvolved@.
    // Static data cannot know the state, so take the lowest-numbered variant, which is the default one.
    for (const state of ['0', '1', '2']) {
      text = table[key.toLowerCase().replace(/@[^@]+@/g, state)];
      if (text !== undefined) break;
    }
  }
  if (text === undefined) return undefined;
  if (depth > 4) return text;
  return text.replace(/\{\{\s*([\w@.]+)\s*\}\}/g, (whole, inner: string) => expandTooltip(inner, table, depth + 1) ?? whole);
}

/** True when a tooltip still has an include we could not expand: whatever it says is incomplete. */
export const unresolved = (tooltip: string | undefined) => !tooltip || /\{\{[^}]*\}\}/.test(tooltip);

const DAMAGE_TAGS: Record<string, DamageType> = { physicaldamage: 'physical', magicdamage: 'magic', truedamage: 'true' };
const SECTION_MARK = /<(spellPassive|spellActive|charge|release|recast|toggle)>/gi;

/** Tags and placeholders removed, whitespace collapsed. */
export const plain = (s: string) => s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

export interface NameResolver {
  /** exact name of a calculation or data value, matched without regard to case */
  calc(name: string, spell?: string): string | undefined;
  dv(name: string, spell?: string): string | undefined;
}

export function findDamageRefs(tooltip: string, names: NameResolver): DamageRef[] {
  const refs: DamageRef[] = [];
  const marks = [...tooltip.matchAll(SECTION_MARK)].map(m => ({ at: m.index, passive: m[1]!.toLowerCase() === 'spellpassive' }));
  const sectionAt = (i: number): DamageRef['section'] => {
    const last = marks.filter(m => m.at < i).at(-1);
    return last ? (last.passive ? 'passive' : 'active') : 'body';
  };
  const tags = /<(physicalDamage|magicDamage|trueDamage)>([\s\S]*?)<\/\1>/gi;
  let group = 0;
  for (const tag of tooltip.matchAll(tags)) {
    const type = DAMAGE_TAGS[tag[1]!.toLowerCase()]!;
    const inner = tag[2]!;
    const holders = [...inner.matchAll(/@([^@*]+?)(\*-?[\d.]+)?@/g)];
    if (!holders.length) continue;
    const context = plain(tooltip.slice(Math.max(0, tag.index - 140), tag.index)) + ' [' + plain(inner.replace(/@([^@]+)@/g, '{$1}')) + '] '
      + plain(tooltip.slice(tag.index + tag[0].length, tag.index + tag[0].length + 60));
    holders.forEach((h, i) => {
      const ref = resolve(h[1]!.trim(), names);
      if (!ref) return;
      const next = holders[i + 1];
      const qualifier = plain(inner.slice(h.index + h[0].length, next ? next.index : undefined)).toLowerCase();
      // the damage tags double as colour for stat names: "100 Bonus Attack Damage" is not a hit
      if (/attack damage|ability power/.test(qualifier)) return;
      refs.push({ type, ref, times100: h[2] === '*100', section: sectionAt(tag.index), group, qualifier, context });
    });
    group++;
  }
  return refs;
}

function resolve(raw: string, names: NameResolver): DamageRef['ref'] | undefined {
  let spell: string | undefined, name = raw;
  const cross = /^spell\.([^:]+):(.+)$/i.exec(raw);
  if (cross) { spell = cross[1]!; name = cross[2]!; }
  const eff = /^Effect(\d+)Amount$/i.exec(name);
  if (eff) return { kind: 'eff', name: eff[1]!, ...(spell && { spell }) };
  const calc = names.calc(name, spell);
  if (calc) return { kind: 'calc', name: calc, ...(spell && { spell }) };
  const dv = names.dv(name, spell);
  if (dv) return { kind: 'dv', name: dv, ...(spell && { spell }) };
  // @f1@ and friends are filled in by game scripts at runtime: nothing to read statically
  return undefined;
}
