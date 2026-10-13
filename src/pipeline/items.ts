/* Stage 2b: items. Data Dragon decides which items exist in the Summoner's Rift shop
   and gives names, prices and tags; the game files give complete stats (Data Dragon
   omits haste, lethality and penetration) and the passives' numbers. */
import type { ItemData, StatModTarget } from '../shared/types.ts';
import { clean, compileCalcs, matchNameCase, type CompileLog } from './calc.ts';
import { expandTooltip, findDamageRefs, type StringTable } from './tooltip.ts';

type Raw = Record<string, any>;
export type CompiledItem = Omit<ItemData, 'model'>;

const SUMMONERS_RIFT = '11';

const STAT_FIELDS: Record<string, StatModTarget> = {
  mFlatPhysicalDamageMod: 'ad',
  mFlatMagicDamageMod: 'ap',
  mFlatHPPoolMod: 'hp',
  flatMPPoolMod: 'mana',
  mFlatArmorMod: 'armor',
  mFlatSpellBlockMod: 'mr',
  mPercentAttackSpeedMod: 'attackSpeed',
  mFlatCritChanceMod: 'critChance',
  mFlatCritDamageMod: 'critDamage',
  mAbilityHasteMod: 'abilityHaste',
  PhysicalLethality: 'lethality',
  mPercentArmorPenetrationMod: 'armorPenPct',
  mFlatMagicPenetrationMod: 'magicPenFlat',
  mPercentMagicPenetrationMod: 'magicPenPct',
  mFlatMovementSpeedMod: 'moveSpeed',
  mPercentMovementSpeedMod: 'movePct',
  mPercentLifeStealMod: 'lifeSteal',
  PercentOmnivampMod: 'omnivamp',
};
/** Data Dragon stat names for the subset it publishes, to cross-check the game files. */
const DD_STATS: Record<string, StatModTarget> = {
  FlatPhysicalDamageMod: 'ad', FlatMagicDamageMod: 'ap', FlatHPPoolMod: 'hp', FlatMPPoolMod: 'mana', FlatArmorMod: 'armor',
  FlatSpellBlockMod: 'mr', PercentAttackSpeedMod: 'attackSpeed', FlatCritChanceMod: 'critChance', FlatMovementSpeedMod: 'moveSpeed',
  PercentMovementSpeedMod: 'movePct', PercentLifeStealMod: 'lifeSteal',
};

export function compileItems(ddItems: Raw, bin: Raw, table: StringTable, log: CompileLog): { items: CompiledItem[]; warnings: string[] } {
  const warnings: string[] = [];
  const game = new Map<number, Raw>();
  for (const v of Object.values(bin) as Raw[]) if (v?.__type === 'ItemData' && typeof v.itemID === 'number') game.set(v.itemID, v);

  const inShop = (it: Raw | undefined): boolean => {
    if (!it?.maps?.[SUMMONERS_RIFT] || !it.gold?.purchasable || !(it.gold.total > 0)) return false;
    if (it.requiredAlly || it.requiredChampion || it.inStore === false) return false;
    const tags: string[] = it.tags ?? [];
    return !tags.includes('Consumable') && !tags.includes('Trinket');
  };
  const dd = ddItems.data as Record<string, Raw>;

  const items: CompiledItem[] = [];
  const seenNames = new Set<string>();
  for (const [idStr, it] of Object.entries(dd)) {
    const id = Number(idStr);
    if (!inShop(it)) continue;
    const tags: string[] = it.tags ?? [];
    if (seenNames.has(it.name)) continue;
    seenNames.add(it.name);

    const g = game.get(id);
    if (!g) { warnings.push(`item ${id} ${it.name}: in Data Dragon but not in game data, skipped`); continue; }

    const stats: ItemData['stats'] = {};
    for (const [field, stat] of Object.entries(STAT_FIELDS)) {
      if (typeof g[field] === 'number' && g[field] !== 0) stats[stat] = clean(g[field]);
    }
    for (const [ddKey, stat] of Object.entries(DD_STATS)) {
      const official: unknown = it.stats?.[ddKey];
      if (typeof official === 'number' && Math.abs(official - (stats[stat] ?? 0)) > 0.011) {
        warnings.push(`item ${id} ${it.name}: Data Dragon ${ddKey}=${official} but game data has ${stats[stat] ?? 0}`);
      }
    }

    const dataValues: Record<string, number> = {};
    for (const d of g.mDataValues ?? []) if (d?.mName && typeof d.mValue === 'number') dataValues[d.mName] = clean(d.mValue);
    const calcs = compileCalcs(g.mItemCalculations, log);
    matchNameCase(calcs, other => other === undefined ? { calcs, dataValues } : undefined);
    const tooltip = expandTooltip(g.mItemDataClient?.mTooltipData?.mLocKeys?.keyTooltip, table);
    const find = (pool: Record<string, unknown>, name: string) => Object.keys(pool).find(k => k.toLowerCase() === name.toLowerCase());

    const item: CompiledItem = {
      id, name: it.name, gold: it.gold.total, tags, plaintext: it.plaintext ?? '',
      // only a component if it builds into something the shop sells: boots "build into" upgrades it does not
      component: Array.isArray(it.into) && it.into.some((to: string) => inShop(dd[to])),
      tier: typeof g.epicness === 'number' ? g.epicness : 0,
      stats, dataValues, calcs,
      damageRefs: tooltip ? findDamageRefs(tooltip, { calc: n => find(calcs, n), dv: n => find(dataValues, n) }) : [],
    };
    if (tooltip) item.tooltip = tooltip;
    items.push(item);
  }
  items.sort((a, b) => a.id - b.id);
  return { items, warnings };
}
