import { champion } from '../dsl.ts';

/* Yuumi spends a fight Attached, where she cannot attack and Zoomies goes to her
   ally, so "Attached to an ally" is on by default: it decides which Prowling
   Projectile is cast and whether Zoomies speeds up her own attacks. What her Best
   Friend gains from her is that champion's damage and is left out. */
export default champion('Yuumi', {
  reviewed: '16.20.1',
  options: {
    attached: { label: 'Attached to an ally', default: true },
    zoomies: { label: 'Zoomies attack speed active', default: false },
  },
  // Feline Friendship only heals
  p: {},
  q: {
    hits: [
      // steered from an ally the missile accelerates and deals the higher amount; cast on foot it never does
      {
        id: 'missile', type: 'magic', amount: 'if(attached, TotalMissileDamageEmpowered, TotalMissileDamage)',
        note: 'While Attached, Prowling Projectile is counted as the accelerated missile; it deals the lower amount if it hits before accelerating. With "Attached to an ally" off it is the plain missile.',
      },
    ],
    notes: ['The on-hit damage Prowling Projectile grants her Best Friend is that ally\'s damage and is not counted.'],
  },
  // You and Me! attaches; its passive is heal and shield power and healing for her ally
  w: {},
  e: {
    // a shield, move speed and mana; the attack speed is in percent points and is hers only when she is not Attached
    statMods: [{ stat: 'attackSpeed', value: 'TotalAttackSpeed / 100', when: 'zoomies && !attached' }],
    notes: ['Zoomies deals no damage. While Attached its attack speed goes to her ally; to count it on Yuumi set "Zoomies attack speed active" and turn "Attached to an ally" off.'],
  },
  r: {
    hits: [
      { id: 'wave', type: 'magic', amount: 'TotalMissileDamage' },
      {
        id: 'later', label: 'Further waves', type: 'magic', amount: 'MultiMissileTotal', count: 'NumberOfWaves - 1', over: '(NumberOfWaves - 1) * TimeBetweenWaves',
        note: 'All 5 waves of Final Chapter are counted, those after the first at their reduced damage.',
      },
    ],
  },
});
