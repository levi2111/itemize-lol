/* Items with a damaging active, and the Cleave of the Tiamat family. Names on the right of each
   formula are the item's own data values and calculations: `npm run data:report -- --item <id>`
   lists them. docs/models.md says how an item's settings (options, procs, uses) work.

   An active is used at the start of the combo, once unless the user says otherwise. Cleave that
   only hits enemies near the target adds nothing against a single target and gets no rule. */
import { item } from '../dsl.ts';

const P = '16.20.1';

const cleaveMissesTarget = 'Cleave only hits enemies near the target, so it adds nothing against a single target.';

export default [
  item(3146, 'Hextech Gunblade', {
    reviewed: P,
    rules: [{ id: 'bolt', label: 'Lightning Bolt', on: 'use', type: 'magic', amount: 'ActiveDamage' }],
  }),
  item(3152, 'Hextech Rocketbelt', {
    reviewed: P,
    rules: [{ id: 'supersonic', label: 'Supersonic', on: 'use', type: 'magic', amount: 'FireboltDamage' }],
    notes: ['Supersonic is counted once per use: a target hit by several of its missiles takes the damage once.'],
  }),
  item(6631, 'Stridebreaker', {
    reviewed: P,
    rules: [{ id: 'shockwave', label: 'Breaking Shockwave', on: 'use', type: 'physical', amount: 'SlashDamage' }],
    notes: [cleaveMissesTarget],
  }),
  item(6698, 'Profane Hydra', {
    reviewed: P,
    rules: [{ id: 'cleave', label: 'Heretical Cleave', on: 'use', type: 'physical', amount: 'SlashDamageBase' }],
    notes: [cleaveMissesTarget],
  }),
  item(3074, 'Ravenous Hydra', {
    reviewed: P,
    rules: [{ id: 'crescent', label: 'Ravenous Crescent', on: 'use', type: 'physical', amount: 'PrimaryDamage' }],
    notes: [cleaveMissesTarget],
  }),
  item(3077, 'Tiamat', {
    reviewed: P,
    rules: [{ id: 'crescent', label: 'Crescent', on: 'use', type: 'physical', amount: 'PrimaryDamage' }],
    notes: [cleaveMissesTarget],
  }),
  item(3748, 'Titanic Hydra', {
    reviewed: P,
    // each use deals its empowered Cleave up front and takes the place of the next attack's Cleave
    counters: { empowered: {} },
    rules: [
      { id: 'crescent', label: 'Titanic Crescent', on: 'use', type: 'physical', amount: 'CalcValueC', then: 'empowered += 1' },
      { id: 'cleave', label: 'Cleave', on: 'onhit', when: 'empowered == 0', type: 'physical', amount: 'OnHitDamageCalc' },
      { id: 'spend', on: 'onhit', when: 'empowered > 0', type: 'physical', amount: 0, then: 'empowered = empowered - 1' },
    ],
    notes: [
      'Cleave counts only its damage to the target; the cone behind the target hits other enemies.',
      'Titanic Crescent is counted when it is used, as the empowered Cleave of the next attack. It is taken to replace that attack\'s normal Cleave rather than add to it.',
    ],
  }),
];
