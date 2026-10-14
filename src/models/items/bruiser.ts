/* Fighter items: attack damage with health, haste, shred and stacking bonuses. Names on the right of
   each formula are the item's own data values and calculations: `npm run data:report -- --item <id>`
   lists them. docs/models.md says how an item's settings (options, procs, uses) work. */
import { item } from '../dsl.ts';

const P = '16.20.1';
// counts the tooltips spell out in words; the game data has no value for them
const ECLIPSE_HITS = 2;

export default [
  item(3161, 'Spear of Shojin', {
    reviewed: P,
    options: { stacks: { label: 'Focused Will stacks when the combo starts', default: 0, max: 'StackCount' } },
    counters: { will: { max: 'StackCount', start: 'stacks' } },
    statMods: [{ stat: 'basicHaste', value: 'AHBase' }],
    // one stack per cast that deals damage; it counts from that cast's next hit on
    rules: [{ id: 'stack', on: 'spell', type: 'physical', amount: 0, then: 'will += 1' }],
    amps: [{ value: 'will * SpellDamageIncrease * if(ranged, RangedMod, 1)', from: ['ability', 'passive'] }],
    notes: ['Focused Will gains a stack per ability cast that deals damage, and amplifies ability and passive damage from the next cast on.'],
  }),
  item(3071, 'Black Cleaver', {
    reviewed: P,
    options: { stacks: { label: 'Carve stacks on the target when the combo starts', default: 0, max: 'MaxStacks' } },
    counters: { carve: { max: 'MaxStacks', start: 'stacks' } },
    rules: [{ id: 'carve', on: 'damage', when: 'hit.physical', type: 'physical', amount: 0, then: 'carve += 1' }],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'carve * ShredPerStack' }],
    notes: ['Carve gains a stack per instance of physical damage and applies from the next hit on.'],
  }),
  item(6610, 'Sundered Sky', {
    reviewed: P,
    rules: [{
      // what it adds to an attack whose crit the engine has already averaged in
      id: 'strike', label: 'Lightshield Strike', on: 'attack', type: 'physical',
      amount: 'ad * (critDamage * CritModifier - 1)', crit: 'ad * (critDamage * CritModifier - critDamage)',
      cooldown: 'Cooldown', procs: true,
    }],
    notes: [
      'Lightshield Strike is counted as what it adds to an ordinary attack. An attack that would have critically struck anyway is taken to strike for the reduced amount too, so with enough crit chance it adds nothing; the damage it then costs is not counted.',
    ],
  }),
  item(6692, 'Eclipse', {
    reviewed: P,
    counters: { hits: {}, lastHit: {}, readyAt: {} },
    // a hit later than the window after the last one starts the count over; none count while it cools down
    rules: [
      { id: 'byAttack', on: 'attack', when: 'time >= readyAt', type: 'physical', amount: 0, then: ['hits = if(time - lastHit > WindowDuration, 0, hits) + 1', 'lastHit = time'] },
      { id: 'byAbility', on: 'spell', when: 'time >= readyAt', type: 'physical', amount: 0, then: ['hits = if(time - lastHit > WindowDuration, 0, hits) + 1', 'lastHit = time'] },
      {
        id: 'moon', label: 'Ever Rising Moon', on: 'after', when: `hits >= ${ECLIPSE_HITS}`, type: 'physical',
        amount: 'MaxHealthDamageCalc * target.maxHp', then: ['hits = 0', 'readyAt = time + Cooldown'], procs: true,
      },
    ],
    notes: ['Ever Rising Moon counts each attack and each ability cast that deals damage as one hit, and lands after the second.'],
  }),
  item(2501, "Overlord's Bloodmail", {
    reviewed: P,
    options: { missing: { label: 'Percent of your health missing during the combo', default: 0, max: 100 } },
    statMods: [
      { stat: 'ad', phase: 'convert', value: 'bonusHp * HPToADPercentage' },
      // the attack damage Tyranny adds in the same phase is increased too
      { stat: 'ad', phase: 'convert', value: '(ad + bonusHp * HPToADPercentage) * MissingHealthAD * min(1, missing / 100 / MissingHealthThreshold)', when: 'missing' },
    ],
    notes: ['Retribution is taken to grow evenly with your missing health, from nothing at full health to its maximum.'],
  }),
  item(3053, "Sterak's Gage", {
    reviewed: P,
    statMods: [{ stat: 'ad', value: 'BonusAD' }],
  }),
  item(3073, 'Experimental Hexplate', {
    reviewed: P,
    options: { overdrive: { label: 'Overdrive is active, as after casting your ultimate', default: false } },
    statMods: [
      { stat: 'ultHaste', value: 'UltimateHaste' },
      { stat: 'attackSpeed', value: 'if(ranged, BonusASRanged, BonusASMelee) / 100', when: 'overdrive' },
    ],
    notes: ["Overdrive's attack speed counts only when its setting is on: stats hold for the whole combo, so casting the ultimate in it does not turn it on."],
  }),
  item(3004, 'Manamune', {
    reviewed: P,
    options: { manaflow: { label: 'Max mana gained from Manaflow so far, all of it by default', default: 'MaxMana', max: 'MaxMana' } },
    statMods: [
      { stat: 'mana', value: 'manaflow' },
      { stat: 'ad', phase: 'convert', value: 'BonusADFromMana' },
    ],
    notes: ["With all of its Manaflow mana the blade becomes Muramana, which is not in the game data; it is counted as Manamune with that mana, without Muramana's Shock."],
  }),
  item(2517, 'Endless Hunger', {
    reviewed: P,
    // {e4d9f16b} is HasteFromADMelee and {87892572} HasteFromADRanged: the hashes of those names
    statMods: [{ stat: 'abilityHaste', phase: 'convert', value: "if(ranged, calc('{87892572}'), calc('{e4d9f16b}'))" }],
  }),
  item(3168, 'Immortal Path', {
    reviewed: P,
    options: { healthy: { label: 'You are above half health', default: true } },
    amps: [{ value: 'DamageMod', when: 'healthy' }],
  }),
  item(3170, 'Swiftmarch', {
    reviewed: P,
    statMods: [{ stat: 'ap', phase: 'convert', value: 'MSToAdaptiveCalc', when: 'ap > bonusAd' }],
    notes: ['Noxian Fervor is counted only when its Adaptive Force becomes Ability Power. The game data does not say how much Attack Damage it is worth, so it adds nothing unless the build has more Ability Power than bonus Attack Damage.'],
  }),
];
