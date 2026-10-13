import { champion } from '../dsl.ts';

export default champion('TahmKench', {
  reviewed: '16.20.1',
  p: {
    rules: [{ id: 'taste', label: 'An Acquired Taste', on: 'onhit', type: 'magic', amount: 'TotalDamage' }],
  },
  q: {
    hits: [
      { id: 'lash', type: 'magic', amount: 'TotalDamage' },
      // the stack it applies deals the passive's damage as its own instance; the tongue is not an attack, so no on-hit effects
      { id: 'taste', label: 'An Acquired Taste from Tongue Lash', type: 'magic', amount: 'TahmKenchPassive.TotalDamage' },
    ],
  },
  w: {
    hits: [{ id: 'dive', type: 'magic', amount: 'TotalDamage' }],
  },
  // Thick Skin only stores damage taken, heals and shields
  e: {},
  r: {
    // the stacks themselves are not tracked: Devour can also be queued during a Tongue Lash that consumes them
    hits: [{
      id: 'devour', type: 'magic', amount: 'BaseDamage + PercentHPDamage * target.maxHp',
      note: 'Devour only works on an enemy with 3 stacks of An Acquired Taste; the target is assumed to have them.',
    }],
  },
});
