/* Stage 2b: items. Data Dragon decides which items exist in each shop and gives names,
   prices and tags; the game files give complete stats (Data Dragon omits haste, lethality
   and penetration) and the passives' numbers.

   Three shops are kept: Summoner's Rift, ARAM and Arena. Data Dragon lists the maps an item
   is sold on, but its lists cannot be taken as they are (see SHOPS), so each shop has its own
   filter. ARAM and Arena sell their own copies of many Rift items, with other ids and often
   other stats; a copy is an item of its own here, sold in its own shop. */
import type { ItemData, ItemShop, StatModTarget } from '../shared/types.ts';
import { clean, compileCalcs, matchNameCase, type CompileLog } from './calc.ts';
import { expandTooltip, findDamageRefs, type StringTable } from './tooltip.ts';

type Raw = Record<string, any>;
export type CompiledItem = Omit<ItemData, 'model'>;

const RIFT = '11', ARAM = '12', ARENA = '30';
/** Data Dragon's map for a mode that reuses ARAM's old item copies; not a shop kept here. */
const ARAM_LEGACY = '453';

const groups = (g: Raw | undefined): string[] => (g?.mItemGroups ?? []).map((s: string) => s.replace(/^Items\/ItemGroups\//, ''));

/** What Data Dragon's map lists get wrong, shop by shop. Each check sees the Data Dragon entry and the game file's. */
const SHOPS: Record<ItemShop, (id: number, dd: Raw, game: Raw) => boolean> = {
  // Listed for the Rift but not sold there: copies of Rift items with six-digit ids, Arena's
  // prismatic items under stale 66xxxx ids (Arena sells them as 44xxxx), and ARAM's Guardian's items.
  sr: (id, dd, game) => !!dd.maps?.[RIFT] && id < 100_000 && !groups(game).includes('GuardianItems'),
  // Items listed for ARAM and the legacy mode only are copies of items long removed from the game.
  aram: (_id, dd) => !!dd.maps?.[ARAM] && !(dd.maps?.[ARAM_LEGACY] && !dd.maps?.[RIFT]),
  // "Legendary Fighter Item" and the like are tokens that turn into a random item when bought.
  arena: (_id, dd, game) => !!dd.maps?.[ARENA] && !game.consumeOnAcquire,
};
export const ITEM_SHOPS = Object.keys(SHOPS) as ItemShop[];

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

  const buyable = (it: Raw | undefined): boolean => {
    if (!it?.gold?.purchasable || !(it.gold.total > 0)) return false;
    if (it.requiredAlly || it.requiredChampion || it.inStore === false) return false;
    const tags: string[] = it.tags ?? [];
    return !tags.includes('Consumable') && !tags.includes('Trinket');
  };
  const dd = ddItems.data as Record<string, Raw>;

  // Each shop sells one item per name: where Data Dragon lists two for the same shop, the lower id is kept.
  const shopsOf = new Map<number, ItemShop[]>();
  for (const shop of ITEM_SHOPS) {
    const seen = new Set<string>();
    const ids = Object.keys(dd).map(Number).sort((a, b) => a - b);
    for (const id of ids) {
      const it = dd[id]!, g = game.get(id);
      if (!buyable(it) || !SHOPS[shop](id, it, g ?? {}) || seen.has(it.name)) continue;
      seen.add(it.name);
      shopsOf.set(id, [...(shopsOf.get(id) ?? []), shop]);
    }
  }
  const sells = (shop: ItemShop, id: string) => shopsOf.get(Number(id))?.includes(shop) ?? false;

  const items: CompiledItem[] = [];
  for (const [id, shops] of shopsOf) {
    const it = dd[id]!;
    const tags: string[] = it.tags ?? [];
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
    // an active is described under a key of its own; it follows the passives, marked so its damage reads as the active's
    const keys = g.mItemDataClient?.mTooltipData?.mLocKeys;
    const passive = expandTooltip(keys?.keyTooltip, table), active = expandTooltip(keys?.keyActive, table);
    const tooltip = active ? `${passive ? passive + '<br>' : ''}<spellActive>Active</spellActive> ${active}` : passive;
    const find = (pool: Record<string, unknown>, name: string) => Object.keys(pool).find(k => k.toLowerCase() === name.toLowerCase());

    const item: CompiledItem = {
      id, name: it.name, gold: it.gold.total, tags, plaintext: it.plaintext ?? '', shops,
      // only a component if it builds into something one of its shops sells: boots "build into" upgrades they do not
      component: Array.isArray(it.into) && it.into.some((to: string) => shops.some(s => sells(s, to))),
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
