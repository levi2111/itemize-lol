/* Stage 2b: items. Data Dragon decides which items exist in each shop and gives names,
   prices and tags; the game files give complete stats (Data Dragon omits haste, lethality
   and penetration) and the passives' numbers.

   Three shops are kept: Summoner's Rift, ARAM and Arena. Data Dragon lists the maps an item
   is sold on, but its lists cannot be taken as they are (see SHOPS), so each shop has its own
   filter. ARAM and Arena sell their own copies of many Rift items, with other ids and often
   other stats; a copy is an item of its own here, sold in its own shop. */
import type { ItemData, ItemRole, ItemShop, StatModTarget } from '../shared/types.ts';
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
/** The shop's role filters: the game files list an item's as flags, one number per role. */
const ROLE_FLAGS: [number, ItemRole][] = [[1, 'Fighter'], [2, 'Marksman'], [4, 'Assassin'], [16, 'Mage'], [8, 'Tank'], [32, 'Support']];
const rolesOf = (g: Raw | undefined): ItemRole[] => {
  const flags: number[] = (g?.mItemAttributes ?? []).filter((n: unknown) => typeof n === 'number');
  return ROLE_FLAGS.filter(([bit]) => flags.some(f => f & bit)).map(([, role]) => role);
};

/** What players call items, beyond Data Dragon's own list (`colloq`). By name, so a shop's copy of an item has them too. */
const NICKNAMES: Record<string, string[]> = {
  "Lord Dominik's Regards": ['ldr', 'doms'],
  "Rabadon's Deathcap": ['cap', 'dcap'],
  "Berserker's Greaves": ['zerks', 'zerkers'],
  "Sorcerer's Shoes": ['sorcs'],
  'Plated Steelcaps': ['tabi'],
  "Mercury's Treads": ['mercs'],
  'Morellonomicon': ['morello'],
  'Thornmail': ['thorns'],
  'Boots of Swiftness': ['swifties'],
  'Ionian Boots of Lucidity': ['ionians', 'lucidity'],
  // one-word names have no initials to go by
  'Hullbreaker': ['hb'],
  'Heartsteel': ['hs'],
  // where the initials miss or are shared: Vampiric Scepter is "vs" too, Iceborn's are "ig", and Blackfire Torch's "bt" is Bloodthirster
  'Void Staff': ['vs'],
  'Iceborn Gauntlet': ['ibg'],
  'Blackfire Torch': ['bft'],
};
/** Data Dragon's that name another item: Cull is not a Doran's Blade, Last Whisper is the "lw" Lord Dominik's builds from,
    and Seeker's Armguard only builds into Zhonya's. */
const NOT_NICKNAMES: Record<string, string[]> = { 'Cull': ['dblade'], "Lord Dominik's Regards": ['lw'], "Seeker's Armguard": ['zhg', 'zonyas'] };
/** Data Dragon's that are stat words: the picker reads these as the stat, which finds all such items rather than one. */
const STAT_WORDS = new Set(['grievous', 'lethality']);
const nickname = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
const aliasesOf = (name: string, colloq: unknown): string[] => {
  const dd = typeof colloq === 'string' ? colloq.split(';').map(nickname) : [];
  const wrong = new Set(NOT_NICKNAMES[name] ?? []);
  return [...new Set([...dd, ...(NICKNAMES[name] ?? [])])].filter(a => a.length > 1 && !wrong.has(a) && !STAT_WORDS.has(a));
};

/** What an item's tooltip says it does, for the picker's search. Anti-heal reads "Grievous Wounds", or "40% Wounds" alone. */
const TRAITS: [string, RegExp][] = [['antiheal', /\bWounds\b/], ['shield', /<shield>/i]];

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
  // groups that cap how many of their items one build holds; 0 caps nothing
  const caps = new Map<string, number>();
  for (const [key, v] of Object.entries(bin) as [string, Raw][]) {
    if (v?.__type === 'ItemGroup' && typeof v.mMaxGroupOwnable === 'number' && v.mMaxGroupOwnable > 0) caps.set(key.replace(/^Items\/ItemGroups\//, ''), v.mMaxGroupOwnable);
  }

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
  // what an item turns into once bought: Data Dragon lists Muramana with Manamune as its "special recipe", and
  // Bounty of Worlds two steps on from World Atlas; the search finds an item by these names as well
  const formsOf = new Map<number, string[]>();
  for (const [id, it] of Object.entries(dd)) {
    let from = Number(it.specialRecipe), steps = 0;
    while (from && !shopsOf.has(from) && steps++ < 4) from = Number(dd[from]?.specialRecipe);
    const base = from && shopsOf.has(from) ? from : 0;
    if (base && !shopsOf.has(Number(id)) && it.name !== dd[base]?.name) formsOf.set(base, [...new Set([...(formsOf.get(base) ?? []), it.name as string])]);
  }
  // an item the shop lists under no role (the upgraded boots, a support item's later forms) is listed under its recipe's
  const rolesFrom = (id: number, depth = 0): ItemRole[] => {
    const own = rolesOf(game.get(id));
    if (own.length || depth > 3) return own;
    const from = (dd[id]?.from ?? []).flatMap((f: string) => rolesFrom(Number(f), depth + 1));
    return ROLE_FLAGS.map(([, role]) => role).filter(role => from.includes(role));
  };

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
      roles: rolesFrom(id),
      aliases: aliasesOf(it.name, it.colloq),
      forms: formsOf.get(id) ?? [],
      traits: TRAITS.filter(([, re]) => re.test(tooltip ?? '')).map(([t]) => t),
      tier: typeof g.epicness === 'number' ? g.epicness : 0,
      limits: Object.fromEntries(groups(g).filter(n => caps.has(n)).map(n => [n, caps.get(n)!])),
      stats, dataValues, calcs,
      damageRefs: tooltip ? findDamageRefs(tooltip, { calc: n => find(calcs, n), dv: n => find(dataValues, n) }) : [],
    };
    if (tooltip) item.tooltip = tooltip;
    items.push(item);
  }
  items.sort((a, b) => a.id - b.id);
  return { items, warnings };
}
