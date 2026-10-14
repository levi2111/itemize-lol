/* Critical strike items and the marksman items that go with them. Names on the right of each
   formula are the item's own data values and calculations: `npm run data:report -- --item <id>`
   lists them. docs/models.md says how an item's settings (options, procs, uses) work.

   Every Energized item is written the same way. Energized is charged when the fight starts, so left
   to the combo its effect fires on the first attack (Voltaic Cyclosword: the first attack or ability
   that deals damage) and not again, in the combo or in sustained damage: recharging takes moving and
   attacking, which the game data does not measure. Its `procs` setting lets the user count it by hand. */
import { item } from '../dsl.ts';

const P = '16.20.1';

const energized = (first: string) => `Energized is taken to be charged when the fight starts, from walking up to the target, so it fires on ${first}. `
  + 'Recharging it takes moving and attacking, which the game data does not measure, so neither the combo nor sustained damage counts it again.';

export default [
  item(3036, "Lord Dominik's Regards", {
    reviewed: P,
    options: { bonusHealth: { label: "The target's bonus health, in hundreds", default: 'if(hasTarget, target.bonusHp, 0) / 100', max: 'MaxBonusHealth / 100' } },
    amps: [{ value: 'MaxBonusDamagePercent * min(1, bonusHealth * 100 / MaxBonusHealth)' }],
    notes: ["Giant Slayer scales with the target's bonus health, which a dummy and a champion without items do not have: set it for a target with items."],
  }),
  item(6676, 'The Collector', {
    reviewed: P,
    rules: [{
      id: 'death', label: 'Death', on: 'after', when: 'hasTarget && target.hp > 0 && target.hpPct < ExecuteThreshold', type: 'true',
      amount: 'if(target.hpPct < ExecuteThreshold, target.hp, 0)',
    }],
  }),
  item(3085, "Runaan's Hurricane", {
    reviewed: P,
    notes: ["Wind's Fury bolts only hit other enemies, so they add nothing against a single target."],
  }),
  item(3032, 'Yun Tal Wildarrows', {
    reviewed: P,
    options: {
      crit: { label: 'Critical Strike Chance from Practice Makes Lethal, in percent (usually full)', default: 'CritMax', max: 'CritMax' },
      flurry: { label: 'Flurry is ready when the fight starts', default: true },
    },
    statMods: [
      { stat: 'critChance', value: 'crit * 1%' },
      // sustained: the share of the time it is up, its cooldown running down a second per second and more per attack
      {
        stat: 'attackSpeed', phase: 'convert', when: 'flurry',
        value: 'ASMod * if(sustained, min(1, ASDuration * (1 + attackSpeed * (AACDR + critChance * (CritCDR - AACDR))) / Cooldown), 1)',
      },
    ],
    notes: [
      'Practice Makes Lethal counts the Critical Strike Chance its setting gives; what attacks add to it during the fight is not counted.',
      'Flurry is counted for the whole combo, from its first attack. Sustained damage counts it for the share of the time it is up, as attacks and Critical Strikes shorten its cooldown.',
    ],
  }),
  item(2512, 'Fiendhunter Bolts', {
    reviewed: P,
    counters: { barrage: { max: 'NumberOfAttacks' }, until: {}, bolt: { max: 1 } },
    statMods: [{ stat: 'ultHaste', value: 'UltimateHaste' }],
    rules: [
      { id: 'arm', on: 'ability', when: 'cast.r', type: 'physical', amount: 0, cooldown: 'Cooldown', then: ['barrage = NumberOfAttacks', 'until = time + Duration'] },
      // an attack that would not crit crits at reduced damage: what it adds over a plain attack
      {
        id: 'barrage', label: 'Opening Barrage', on: 'attack', when: 'barrage > 0 && time < until', type: 'physical',
        amount: 'ad * (critDamage * CritModifier - 1)', crit: 0, then: ['barrage = max(0, barrage - 1)', 'bolt = 1'], procs: true,
      },
      // an attack that crits anyway deals bonus true damage
      { id: 'bolt', label: 'Opening Barrage', on: 'after', when: 'bolt', type: 'true', amount: 'BonusTrueDamage * ad * critDamage * critChance', then: 'bolt = 0' },
    ],
    notes: [
      'Opening Barrage empowers the attacks that follow your ultimate in the combo; with none after it, set its count by hand.',
      'Opening Barrage\'s bonus true damage is taken to be a share of the Critical Strike\'s damage before resistances.',
    ],
  }),
  item(2523, 'Hexoptics C44', {
    reviewed: P,
    options: { distance: { label: 'Distance to the target when attacking, in hundreds of units', default: 'if(ranged, MaxRange / 100, 1)', max: 'MaxRange / 100' } },
    amps: [{ value: 'MaxDamageAmp * min(1, distance * 100 / MaxRange)', from: ['attack'] }],
    notes: ['Magnification is taken to grow evenly with distance. A ranged champion is taken to attack from far enough for all of it, a melee one from a hundred units.'],
  }),
  item(3087, 'Statikk Shiv', {
    reviewed: P,
    counters: { charge: { max: 1, start: 1 } },
    rules: [{ id: 'electrospark', label: 'Electrospark', on: 'attack', when: 'charge', type: 'magic', amount: 'ChainDamage', then: 'charge = 0', procs: true }],
    notes: [energized('the first attack'), 'Electroshock only makes Energized recharge sooner, which is not counted either.'],
  }),
  item(3094, 'Rapid Firecannon', {
    reviewed: P,
    counters: { charge: { max: 1, start: 1 } },
    rules: [{ id: 'sharpshooter', label: 'Sharpshooter', on: 'attack', when: 'charge', type: 'magic', amount: 'BonusDamage', then: 'charge = 0', procs: true }],
    notes: [energized('the first attack')],
  }),
  item(3095, 'Stormrazor', {
    reviewed: P,
    counters: { charge: { max: 1, start: 1 } },
    rules: [{ id: 'bolt', label: 'Bolt', on: 'attack', when: 'charge', type: 'magic', amount: 'TotalProcDamage', then: 'charge = 0', procs: true }],
    notes: [energized('the first attack')],
  }),
  item(6699, 'Voltaic Cyclosword', {
    reviewed: P,
    counters: { charge: { max: 1, start: 1 }, until: {} },
    // Galvanize: damage from an ability spends a ready Energized as well as an attack does
    rules: [{
      id: 'firmament', label: 'Firmament', on: 'damage', when: 'hasTarget && charge', type: 'physical',
      amount: 'if(ranged, PercentCurrentHPRanged, PercentCurrentHPMelee) * 1% * target.hp',
      then: ['charge = 0', 'until = time + LethalityBonusDuration'], procs: true,
    }],
    resists: [{ stat: 'armor', kind: 'penFlat', value: 'if(ranged, LethalityBonusModRanged, LethalityBonusModMelee)', when: 'time < until' }],
    notes: [energized('the first attack or ability that deals damage'), "Firmament's Lethality applies to the damage that follows it for its duration."],
  }),
];
