/* Mage items that grow: over a fight (burns, damage that ramps in combat) or over a game (stacks,
   mana). Names on the right of each formula are the item's own data values and calculations:
   `npm run data:report -- --item <id>` lists them. docs/models.md says how an item's settings
   (options, procs, uses) work.

   Every burn set off by abilities is written the same way: one full burn when a damaging ability
   lands, and none again until it has run out; its `procs` setting counts full burns by hand.
   Every "bonus damage for each second in combat" is written the same way too: the fight's clock,
   plus a `combat` setting for the seconds already spent in combat when the combo starts. */
import { item } from '../dsl.ts';

const P = '16.20.1';

export default [
  item(6653, "Liandry's Torment", {
    reviewed: P,
    options: { combat: { label: 'Seconds already in combat when the combo starts', default: 0, max: 'MaxStackNumber' } },
    rules: [{
      id: 'torment', label: 'Torment', on: 'spell', when: 'hasTarget', type: 'magic',
      amount: 'BurnPercentHealthDamage * TickFrequency * target.maxHp', count: 'BurnDuration / TickFrequency', over: 'BurnDuration', cooldown: 'BurnDuration',
      procs: true,
    }],
    amps: [{ value: 'min(DamageIncreaseMax, DamageIncreasePerSecond * floor(combat + time))' }],
    notes: ['Torment is counted as one full burn each time it is applied or refreshed after running out.'],
  }),
  item(2503, 'Blackfire Torch', {
    reviewed: P,
    options: { burning: { label: 'The target is burning from Baleful Blaze', default: true } },
    statMods: [{ stat: 'ap', phase: 'percent', value: 'APPerStack', when: 'burning && !sustained' }],
    rules: [{
      id: 'blaze', label: 'Baleful Blaze', on: 'spell', type: 'magic',
      amount: 'BurnDamagePerSecondCalc * TickFrequency', count: 'BurnDuration / TickFrequency', over: 'BurnDuration', cooldown: 'BurnDuration',
      procs: true,
    }],
    notes: [
      'Baleful Blaze is counted as one full burn each time it is applied or refreshed after running out.',
      'Blackfire counts the target as burning for the whole combo, the first ability included. Sustained attacks set off no burn, so they get no Blackfire.',
    ],
  }),
  item(2508, 'Fated Ashes', {
    reviewed: P,
    rules: [{
      id: 'inflame', label: 'Inflame', on: 'spell', type: 'magic',
      amount: 'BurnFlatDamagePerSecond * TickFrequency', count: 'BurnDuration / TickFrequency', over: 'BurnDuration', cooldown: 'BurnDuration',
      procs: true,
    }],
    notes: ['Inflame is counted as one full burn each time it is applied or refreshed after running out.'],
  }),
  item(4633, 'Riftmaker', {
    reviewed: P,
    options: { combat: { label: 'Seconds already in combat when the combo starts', default: 0, max: 'SecondsInCombat' } },
    statMods: [{ stat: 'ap', phase: 'convert', value: 'bonusHp * HealthToAPConversionPercent' }],
    amps: [{ value: 'min(EternityDamageIncreaseMax, EternityDamageIncreasePerSecond * floor(combat + time))' }],
  }),
  item(3147, 'Haunting Guise', {
    reviewed: P,
    options: { combat: { label: 'Seconds already in combat when the combo starts', default: 0, max: 'SecondsInCombat' } },
    amps: [{ value: 'min(DamageIncreaseMax, DamageIncreasePerSecond * floor(combat + time))' }],
  }),
  item(6657, 'Rod of Ages', {
    reviewed: P,
    options: { stacks: { label: 'Timeless stacks gained so far, all of them by default', default: 'MaxStacks', max: 'MaxStacks' } },
    statMods: [
      { stat: 'hp', value: 'HealthPerStack * stacks' },
      { stat: 'mana', value: 'ManaPerStack * stacks' },
      { stat: 'ap', value: 'APPerStack * stacks' },
    ],
    notes: ['The level Timeless grants at full stacks is not counted: set the champion one level higher to include it.'],
  }),
  item(3003, "Archangel's Staff", {
    reviewed: P,
    options: { manaflow: { label: 'Max mana gained from Manaflow so far, all of it by default', default: 'MaxMana', max: 'MaxMana' } },
    statMods: [
      { stat: 'mana', value: 'manaflow' },
      { stat: 'ap', phase: 'convert', value: 'bonusMana * APFromMana' },
    ],
    notes: ["With all of its Manaflow mana the staff becomes Seraph's Embrace, which is not in the game data; it is counted as Archangel's Staff with that mana."],
  }),
  item(3041, "Mejai's Soulstealer", {
    reviewed: P,
    options: { glory: { label: 'Glory stacks from takedowns', default: 0, max: 'MaxGloryStacks' } },
    statMods: [{ stat: 'ap', value: 'APPerGlory * glory' }],
  }),
  item(1082, 'Dark Seal', {
    reviewed: P,
    options: { glory: { label: 'Glory stacks from takedowns', default: 0, max: 'MaxGloryStacks' } },
    statMods: [{ stat: 'ap', value: 'APPerGlory * glory' }],
  }),
  item(2522, 'Actualizer', {
    reviewed: P,
    counters: { until: {} },
    // used at the start of the combo: Empowered from then for its duration
    rules: [{ id: 'empower', label: 'Mana Made Real', on: 'use', type: 'magic', amount: 0, then: 'until = time + Duration' }],
    amps: [{ value: 'ManaCalc', when: 'time < until', from: ['ability'] }],
    notes: ['Mana Made Real amplifies ability damage only while it lasts; its faster basic ability cooldowns are not counted.'],
  }),
];
