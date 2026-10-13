import { champion } from '../dsl.ts';

/* Petricite Burst is a charge per ability cast, spent by the next basic attack,
   which then deals the passive's damage in place of its own. The game data has
   that damage and the cap; that the charges come one per cast, and that Abscond
   and Abduct are two casts on one key, are what the model adds. Hijack's damage
   is whatever ultimate it stole, which no build of Sylas' own can tell. */
export default champion('Sylas', {
  reviewed: '16.20.1',
  options: {
    everyAttack: { label: 'Petricite Burst charge held for every attack', default: false },
  },
  counters: { charges: { max: 'SylasPassive.PassiveCharges' } },
  p: {
    rules: [
      { id: 'charge', on: 'ability', type: 'magic', amount: 0, then: 'charges += 1' },
      // PassiveDamage is the whole empowered attack; the engine already counts the attack itself.
      // it crits along with the attack that carries it
      {
        id: 'burst', on: 'attack', when: 'everyAttack || charges > 0', type: 'magic',
        amount: 'PassiveDamage - ad', crit: '(PassiveDamage - ad) * critDamage',
        then: 'charges = max(0, charges - 1)',
      },
    ],
    // a charge lasts one attack, so the attack speed only holds across a fight when casts keep coming
    statMods: [{ stat: 'attackSpeed', value: 'PassiveAttackSpeed', when: 'everyAttack' }],
    notes: [
      'Each ability cast gives one charge and the next basic attack spends it; put attacks after abilities in the combo.',
      'The attack under Petricite Burst is still counted as physical damage; in the game the whole hit is magic.',
      'The attack speed from holding a charge counts only with "Petricite Burst charge held for every attack" set, which also empowers every attack.',
    ],
  },
  q: {
    hits: [
      { id: 'lash', label: 'Chains', type: 'magic', amount: 'Damage' },
      {
        id: 'explosion', label: 'Explosion', type: 'magic', amount: 'ExplosionDamage',
        note: 'The explosion where the chains cross is counted along with the chains themselves.',
      },
    ],
  },
  w: {
    hits: [{ id: 'lunge', type: 'magic', amount: 'MinDamage' }],
  },
  e: {
    // the dash and the chain throw are two casts, each good for a charge
    hits: [{
      id: 'abduct', label: 'Abduct', type: 'magic', amount: 'Damage', then: 'charges += 1',
      note: 'One E is Abscond and Abduct together, the chains hitting the target, so it grants two Petricite Burst charges.',
    }],
  },
  // Hijack deals nothing itself; it still charges Petricite Burst like any ability
  r: {
    notes: ['Hijack deals no damage of its own, and the stolen ultimate is not counted: it depends on the enemy it was taken from.'],
  },
});
