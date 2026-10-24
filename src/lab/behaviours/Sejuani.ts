/* Sejuani: Arctic Assault is a charge at DashSpeed over MaxTravelDistance that ends on the champion it hits;
   the game file names its length in a way the defaults do not read. Permafrost's cooldown is 1.5 seconds, but a
   champion it stuns gains no stacks for PerChampionCD, so on one target it comes back only that often. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Sejuani', {
  reviewed: '16.20.1',
  actions: {
    q: { dash: { speed: 'DashSpeed', distance: 'MaxTravelDistance', direction: 'toward' } },
    e: { charges: { count: 1, recharge: 'PerChampionCD' } },
  },
  notes: [
    'Winter\'s Wrath\'s second swing lands with the first.',
    'Permafrost is counted as ready on the target every PerChampionCD, its four stacks assumed built in time.',
  ],
});
