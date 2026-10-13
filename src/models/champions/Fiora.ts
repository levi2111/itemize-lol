import { champion } from '../dsl.ts';

/* Fiora's damage is the Vitals: a share of the target's maximum health as true
   damage each time she strikes one. The game data has the damage of one Vital
   and of Grand Challenge's four; how many she gets to strike outside her
   ultimate is the player's doing, so that is an option. */
export default champion('Fiora', {
  reviewed: '16.20.1',
  vars: {
    // the basic attack as the engine deals it, crits averaged
    attack: 'ad * (1 + critChance * (critDamage - 1))',
  },
  options: {
    vitals: { label: 'Vitals struck outside Grand Challenge', kind: 'int', default: 1, min: 0 },
    bladework: { label: 'Bladework attack speed active', default: false },
  },
  counters: { struck: {} },
  p: {
    rules: [
      // any attack or damaging ability can strike the Vital; a new one only shows once the last is struck
      { id: 'vital', label: 'Vital', on: 'attack', when: 'struck < vitals', type: 'true', amount: 'PassiveDamageTotal * target.maxHp', then: 'struck += 1' },
      // Bladework's bonus rides on an attack, and Grand Challenge brings its own four
      { id: 'vitalSpell', label: 'Vital', on: 'spell', when: 'struck < vitals && !cast.e && !cast.r', type: 'true', amount: 'PassiveDamageTotal * target.maxHp', then: 'struck += 1' },
    ],
    notes: ['One Vital is struck, by the first attack, Lunge or Riposte, unless "Vitals struck outside Grand Challenge" is changed.'],
  },
  q: {
    hits: [{ id: 'lunge', type: 'physical', amount: 'TotalDamage', appliesOnHit: true }],
  },
  w: {
    hits: [{ id: 'stab', type: 'magic', amount: 'StabDamage' }],
  },
  e: {
    // the first attack deals its fixed share and cannot crit, the second always crits at Bladework's own multiplier;
    // the engine counts both attacks at the averaged crit, so with enough crit chance there is nothing left to add
    hits: [{
      id: 'bladework', type: 'physical', amount: 'max(0, ad * (AttackOnePercentTAD + AttackTwoPercentTAD) - 2 * attack)',
      note: 'Bladework counts only what it adds to its two attacks; put two basic attacks after it in the combo.',
    }],
    statMods: [{ stat: 'attackSpeed', value: 'ASPercent', when: 'bladework' }],
    notes: ['The attack speed is off unless "Bladework attack speed active" is set. It lasts for two attacks only, so damage per second with it on is overstated.'],
  },
  r: {
    hits: [{
      id: 'vitals', label: 'Four Vitals', type: 'true', amount: 'FioraPassive.RDamageTotal * target.maxHp',
      note: 'All four Vitals of Grand Challenge are counted; Fiora has to strike each of them within its duration.',
    }],
  },
});
