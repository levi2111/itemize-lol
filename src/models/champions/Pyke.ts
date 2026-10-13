import { champion } from '../dsl.ts';

/* Two things the formulas alone do not say about Pyke:
   - Gift of the Drowned Ones turns every point of health he would gain from
     items into attack damage, so a health item is an attack damage item on him.
   - Death From Below is two abilities in one: a kill below its threshold, and
     half the threshold as physical damage above it. */
export default champion('Pyke', {
  reviewed: '16.20.1',
  vars: {
    // "below RDamage health": checked once, on the health the target has when the X lands
    drowned: 'hasTarget && target.hp < PykeR.RDamage',
  },
  p: {
    // both read the bonus health items gave, then take it away; health from levels stays.
    // the stored damage he regenerates is healing
    statMods: [
      { stat: 'ad', value: 'bonusHp / HPPerBAD', phase: 'convert' },
      { stat: 'hp', value: '-bonusHp', phase: 'convert' },
    ],
    notes: ['Health from items becomes attack damage instead, and Pyke\'s maximum health stays at what his level gives.'],
  },
  q: {
    // the stab and the thrown harpoon deal the same
    hits: [{ id: 'skewer', type: 'physical', amount: 'TotalDamage' }],
  },
  // Ghostwater Dive only camouflages and speeds him up
  w: {},
  e: {
    hits: [{ id: 'phantom', type: 'physical', amount: 'TotalDamage' }],
  },
  r: {
    hits: [
      // listed first: once it has fired the target has no health left, so the strike below stays quiet
      {
        id: 'execute', type: 'true', when: 'drowned', amount: 'target.hp',
        note: 'Death From Below kills a target that is below its threshold when it lands, counted as true damage equal to the health the target has left. Put it last in the combo.',
      },
      { id: 'strike', label: 'Death From Below (above the threshold)', type: 'physical', when: '!drowned', amount: 'ReducedDamageFinal' },
    ],
  },
});
