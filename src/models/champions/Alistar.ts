import { champion } from '../dsl.ts';

export default champion('Alistar', {
  reviewed: '16.20.1',
  // Triumphant Roar only heals
  p: {},
  q: {
    hits: [{ id: 'slam', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'ram', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    hits: [
      // TotalDamage is the sum of every pulse over Duration
      { id: 'trample', type: 'magic', amount: 'TotalDamage', over: 'Duration', note: 'The full 5 seconds of Trample are counted.' },
      // a target that stays in Trample gives all the stacks, so the charged attack follows; only its bonus is counted here
      {
        id: 'charged', label: 'Trample charged attack', type: 'magic', amount: 'AttackBonusDamage',
        note: 'Trample counts the bonus damage of the charged attack that follows it; add the auto attack to the combo.',
      },
    ],
  },
  // Unbreakable Will only removes crowd control and reduces the damage Alistar takes
  r: {},
});
