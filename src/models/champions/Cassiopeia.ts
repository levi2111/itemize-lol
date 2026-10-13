import { champion } from '../dsl.ts';

/* Cassiopeia's damage is Twin Fang, and Twin Fang is two amounts: what it always
   deals and what it adds against a Poisoned target. Whether the target is poisoned
   depends on Noxious Blast and Miasma having landed moments before, which a combo
   without timings cannot know, so it is an option that is on by default. */
export default champion('Cassiopeia', {
  reviewed: '16.20.1',
  options: {
    poisoned: { label: 'Target is Poisoned when Twin Fang lands', default: true },
  },
  // Serpentine Grace only changes move speed
  p: {},
  q: {
    // the calculation is the total over the poison's duration
    hits: [{ id: 'poison', type: 'magic', amount: 'TooltipTotalDamage', over: 'PoisonDuration', note: 'The full duration of Noxious Blast\'s poison is counted.' }],
  },
  w: {
    // damage is given per second; the cloud lasts CloudDuration seconds
    hits: [{
      id: 'cloud', type: 'magic', amount: 'DamagePerSecond', count: 'CloudDuration', over: 'CloudDuration',
      note: 'The target is counted as standing in Miasma for its whole duration.',
    }],
  },
  e: {
    hits: [
      { id: 'fang', type: 'magic', amount: 'BasicDamage' },
      {
        id: 'poisoned', label: 'Twin Fang on a Poisoned target', type: 'magic', amount: 'BonusPoisonedDamage', when: 'poisoned',
        note: 'Twin Fang includes its bonus against a Poisoned target unless "Target is Poisoned when Twin Fang lands" is turned off.',
      },
    ],
  },
  r: {
    hits: [{ id: 'gaze', type: 'magic', amount: 'RDamage' }],
  },
});
