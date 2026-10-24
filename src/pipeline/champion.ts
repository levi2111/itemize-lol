/* Stage 2a: one champion's game record + spells -> SpellData and base stats.
   Numbers come from the game files. Data Dragon supplies names and icons and is
   compared against the game files; disagreements are reported, never silently resolved. */
import type { BaseStats, ChampionData, Slot, SpellData } from '../shared/types.ts';
import { CAST_SLOTS } from '../shared/types.ts';
import { clean, compileCalcs, matchNameCase, type CompileLog } from './calc.ts';
import { expandTooltip, findDamageRefs, type NameResolver, type StringTable } from './tooltip.ts';

type Raw = Record<string, any>;

export type CompiledChampion = Omit<ChampionData, 'models' | 'vars' | 'options' | 'counters' | 'timing'>;

const mf = (v: Raw | undefined): number | undefined => typeof v?.baseValue === 'number' ? clean(v.baseValue) : undefined;
const lower = (s: string) => s.toLowerCase();

/* Ability resource fields on the champion record, not yet named by the hash list. */
const RESOURCE_BASE = '{726ee5cd}', RESOURCE_PER_LEVEL = '{6216bf7b}';

/** The cooldown of a spell whose file leaves the field out: the game file omits a field at its default, and
    Data Dragon's cooldowns for those spells are 10 at every rank. */
const DEFAULT_COOLDOWN = 10;

/** Champions the attack-range heuristic gets wrong at level 1. */
const RANGED_OVERRIDE: Record<string, boolean> = { Gnar: true };

function findRecord(bin: Raw, id: string): Raw {
  const records = Object.entries(bin).filter(([, v]) => v?.__type === 'CharacterRecord');
  const root = records.find(([k]) => lower(k) === `characters/${lower(id)}/characterrecords/root`);
  const rec = (root ?? records[0])?.[1];
  if (!rec) throw new Error(`${id}: no CharacterRecord in game data`);
  return rec;
}

function compileSpell(id: string, obj: Raw, table: StringTable, log: CompileLog): SpellData {
  const s: Raw = obj.mSpell ?? {};
  const dataValues: Record<string, number[]> = {};
  // per-mode overrides (DataValuesModeOverride) are ignored on purpose: Summoner's Rift only
  for (const d of s.DataValues ?? s.mDataValues ?? []) {
    const name = d?.name ?? d?.mName, values = d?.values ?? d?.mValues;
    if (name && Array.isArray(values)) dataValues[name] = values.map(clean);
  }
  const effects: number[][] = [[]];
  for (const e of s.mEffectAmount ?? []) effects.push(Array.isArray(e?.value) ? e.value.map(clean) : []);
  const keys = s.mClientData?.mTooltipData?.mLocKeys ?? {};
  const levels = s.mClientData?.mTooltipData?.mLists?.LevelUp?.levelCount;
  const out: SpellData = {
    id,
    maxRank: typeof levels === 'number' ? levels : 1,
    dataValues, effects,
    calcs: compileCalcs(s.mSpellCalculations, log),
    damageRefs: [],
  };
  const name = keys.keyName ? table[lower(keys.keyName)] : undefined;
  if (name) out.name = name;
  // cooldowns are indexed by rank; costs start at rank 1
  if (Array.isArray(s.cooldownTime)) out.cooldown = s.cooldownTime.map(clean);
  else out.cooldown = Array<number>(7).fill(DEFAULT_COOLDOWN);
  if (Array.isArray(s.mana)) out.cost = [s.mana[0] ?? 0, ...s.mana].map(clean);
  const castTime = s.mCastTime ?? s.spellCastTime;
  if (typeof castTime === 'number') out.castTime = clean(castTime);
  const tip = [expandTooltip(keys.keyTooltip, table), expandTooltip(keys.keyTooltipExtendedBelowLine, table)].filter(Boolean).join('<br>');
  if (tip) out.tooltip = tip;
  return out;
}

const hasContent = (s: SpellData) => Object.keys(s.dataValues).length > 0 || Object.keys(s.calcs).length > 0 || s.effects.length > 1;

export function compileChampion(dd: Raw, bin: Raw, table: StringTable, log: CompileLog): CompiledChampion {
  const id: string = dd.id;
  const warnings: string[] = [];
  const rec = findRecord(bin, id);

  // ---- base stats ----
  const want = (field: string, ddKey: string | undefined, fallback?: number): number => {
    const game = mf(rec[field]);
    const official: number | undefined = ddKey ? dd.stats?.[ddKey] : undefined;
    if (game === undefined) {
      if (official !== undefined) return official;
      if (fallback !== undefined) return fallback;
      warnings.push(`stat ${field} missing from game record`);
      return 0;
    }
    if (official !== undefined && Math.abs(official - game) > 0.011) warnings.push(`Data Dragon ${ddKey}=${official} but game record has ${game}`);
    return game;
  };
  const baseAs = want('attackSpeedModifiable', 'attackspeed');
  const res: Raw = rec.primaryAbilityResource ?? {};
  const usesMana = (res.arType ?? 0) === 0 && mf(res[RESOURCE_BASE]) !== undefined;
  const stats: BaseStats = {
    hp: want('baseHPModifiable', 'hp'), hpPerLevel: want('hpPerLevelModifiable', 'hpperlevel', 0),
    mana: usesMana ? mf(res[RESOURCE_BASE])! : 0,
    manaPerLevel: usesMana ? mf(res[RESOURCE_PER_LEVEL]) ?? 0 : 0,
    ad: want('baseDamageModifiable', 'attackdamage'), adPerLevel: want('damagePerLevelModifiable', 'attackdamageperlevel', 0),
    armor: want('baseArmorModifiable', 'armor'), armorPerLevel: want('armorPerLevelModifiable', 'armorperlevel', 0),
    mr: want('baseMR', 'spellblock'), mrPerLevel: want('mrPerLevel', 'spellblockperlevel', 0),
    moveSpeed: want('baseMoveSpeedModifiable', 'movespeed'),
    attackRange: want('attackRangeModifiable', 'attackrange'),
    attackSpeed: baseAs,
    attackSpeedRatio: mf(rec.attackSpeedRatioModifiable) ?? baseAs,
    // game files hold percent points (1.8 = 1.8% per level)
    attackSpeedPerLevel: clean(want('attackSpeedPerLevelModifiable', 'attackspeedperlevel', 0) / 100),
    critDamage: typeof rec.critDamageMultiplier === 'number' ? rec.critDamageMultiplier : 2,
  };
  if (usesMana && typeof dd.stats?.mp === 'number' && Math.abs(dd.stats.mp - stats.mana) > 0.011) {
    warnings.push(`Data Dragon mp=${dd.stats.mp} but game record has ${stats.mana}`);
  }

  // ---- spells ----
  const prefix = lower(`Characters/${id}/Spells/`);
  const objects = Object.entries(bin).filter(([k, v]) => v?.__type === 'SpellObject' && lower(k).startsWith(prefix)) as [string, Raw][];
  const byPath = new Map(objects.map(([k, v]) => [lower(k), { path: k, obj: v }]));
  const idOf = (path: string) => path.split('/').pop()!;

  const slotPaths: Partial<Record<Slot, string>> = {};
  CAST_SLOTS.forEach((slot, i) => {
    const rel: string | undefined = rec.spellNames?.[i];
    if (rel) slotPaths[slot] = lower(`Characters/${id}/Spells/${rel}`);
  });
  if (typeof rec.mCharacterPassiveSpell === 'string') slotPaths.p = lower(rec.mCharacterPassiveSpell);

  // spells sharing an ability folder follow that ability's rank
  const folderSlot = new Map<string, Slot>();
  for (const [slot, path] of Object.entries(slotPaths) as [Slot, string][]) {
    const parts = path.split('/');
    if (parts.length > 4) folderSlot.set(parts.slice(0, -1).join('/'), slot);
  }

  const spells: Record<string, SpellData> = {};
  const slotIds: Partial<Record<Slot, string>> = {};
  for (const [path, obj] of objects) {
    const sid = idOf(path);
    const spell = compileSpell(sid, obj, table, log);
    const slot = (Object.entries(slotPaths) as [Slot, string][]).find(([, p]) => p === lower(path))?.[0];
    const followed = slot ?? folderSlot.get(lower(path).split('/').slice(0, -1).join('/'));
    if (followed) spell.slot = followed;
    if (slot) slotIds[slot] = sid;
    if (!slot && !hasContent(spell)) continue;
    if (spells[sid]) { warnings.push(`two spell objects named ${sid}; kept the first`); continue; }
    spells[sid] = spell;
  }

  for (const spell of Object.values(spells)) {
    matchNameCase(spell.calcs, other => other === undefined ? spell : Object.values(spells).find(s => lower(s.id) === lower(other)));
  }

  // ---- names, icons, max ranks from Data Dragon ----
  const slots = {} as ChampionData['slots'];
  CAST_SLOTS.forEach((slot, i) => {
    const d: Raw | undefined = dd.spells?.[i];
    const sid = slotIds[slot];
    if (!sid) { warnings.push(`no game spell found for ${slot.toUpperCase()}`); }
    else if (d?.id && lower(d.id) !== lower(sid)) warnings.push(`${slot.toUpperCase()}: Data Dragon calls it ${d.id}, game data ${sid}`);
    const spell = sid ? spells[sid] : undefined;
    if (spell && typeof d?.maxrank === 'number') spell.maxRank = d.maxrank;
    slots[slot] = { spell: sid ?? '', name: d?.name ?? spell?.name ?? slot.toUpperCase(), icon: d?.image?.full ?? '', maxRank: d?.maxrank ?? spell?.maxRank ?? (slot === 'r' ? 3 : 5) };
    // cooldowns are compared with Data Dragon's, which also confirms the default a file leaves out
    const official: unknown = d?.cooldown;
    if (spell?.cooldown && Array.isArray(official) && official.some((v, r) => typeof v === 'number' && Math.abs(v - (spell.cooldown![r + 1] ?? NaN)) > 0.011)) {
      warnings.push(`${slot.toUpperCase()}: Data Dragon cooldown=${official.join('/')} but game data has ${spell.cooldown.slice(1, official.length + 1).join('/')}`);
    }
  });
  const pid = slotIds.p;
  if (!pid) warnings.push('no game spell found for the passive');
  slots.p = { spell: pid ?? '', name: dd.passive?.name ?? 'Passive', icon: dd.passive?.image?.full ?? '', maxRank: 0 };

  // ---- tooltip damage mentions ----
  const find = (pool: Record<string, unknown> | undefined, name: string) => pool && Object.keys(pool).find(k => lower(k) === lower(name));
  const spellByName = (name: string) => Object.values(spells).find(s => lower(s.id) === lower(name));
  for (const spell of Object.values(spells)) {
    if (!spell.tooltip) continue;
    const names: NameResolver = {
      calc: (n, other) => find((other ? spellByName(other) : spell)?.calcs, n),
      dv: (n, other) => find((other ? spellByName(other) : spell)?.dataValues, n),
    };
    spell.damageRefs = findDamageRefs(spell.tooltip, names);
  }

  const range = stats.attackRange;
  return {
    id, key: Number(dd.key), name: dd.name, title: dd.title, tags: dd.tags ?? [], resource: dd.partype ?? '',
    ranged: RANGED_OVERRIDE[id] ?? range >= 325,
    stats, slots, spells, warnings,
    // the game weighs adaptive force toward ability power for these champions when the two are tied
    adaptive: (rec.mAdaptiveForceToAbilityPowerWeight ?? 0) >= 0.5 ? 'magic' : 'physical',
  };
}
