/* Spellblade: after an ability, the next attack hits harder. Names on the right of each formula are
   the item's own data values and calculations: `npm run data:report -- --item <id>` lists them.
   docs/models.md says how an item's settings (options, procs, uses) work.

   Every Spellblade is written the same way. Left to the combo it fires on an attack (or an ability
   hit that applies on-hit effects) following an ability, at most once per cooldown; its `procs`
   setting lets the user count it by hand instead. */
import { item } from '../dsl.ts';

const P = '16.20.1';

export default [
  item(3057, 'Sheen', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'physical', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0', procs: true },
    ],
  }),
  item(3100, 'Lich Bane', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'magic', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0', procs: true },
    ],
  }),
  item(3078, 'Trinity Force', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'physical', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0', procs: true },
    ],
  }),
  item(6662, 'Iceborn Gauntlet', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'physical', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0', procs: true },
    ],
  }),
  item(3508, 'Essence Reaver', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'blade = 1' },
      { id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'physical', amount: 'SpellbladeDamage', cooldown: 'Cooldown', then: 'blade = 0', procs: true },
    ],
  }),
  item(2510, 'Dusk and Dawn', {
    reviewed: P,
    counters: { blade: { max: 1 } },
    rules: [
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'blade = 1' },
      {
        id: 'spellblade', label: 'Spellblade', on: 'onhit', when: 'blade', type: 'magic', amount: 'SpellbladeDamage', cooldown: 'Cooldown',
        then: 'blade = 0', appliesOnHit: true, procs: true,
      },
    ],
    notes: ['Spellblade sets off every on-hit effect a second time, the champion\'s own included.'],
  }),

  // not Spellblades: a proc on damaging a champion, on a cooldown of its own
  item(3144, "Scout's Slingshot", {
    reviewed: P,
    counters: { attacks: {} },
    rules: [
      // the tooltip's second per attack has no data value: each attack since the last proc counts as one second
      { id: 'count', on: 'attack', type: 'magic', amount: 0, then: 'attacks += 1' },
      { id: 'bullseye', label: 'Bullseye', on: 'damage', type: 'magic', amount: 'DamageAmount', cooldown: 'Cooldown - attacks', then: 'attacks = 0', procs: true },
    ],
    notes: ['Each attack takes a second off the cooldown of Bullseye, the attack that set it off included.'],
  }),
  item(3145, 'Hextech Alternator', {
    reviewed: P,
    rules: [{ id: 'revved', label: 'Revved', on: 'damage', type: 'magic', amount: 'DamageAmount', cooldown: 'Cooldown', procs: true }],
  }),
];
