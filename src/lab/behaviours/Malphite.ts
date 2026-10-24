/* Malphite: Thunderclap is an instant buff on his next attack, which it resets (the model keeps its
   aftershocks on the fight's clock). Unstoppable Force is an unstoppable dash to the target area: the game file
   has no cast time and no speed for it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Malphite', {
  reviewed: '16.20.1',
  sources: [
    'Unstoppable Force\'s dash speed of 1835 plus his move speed is from the League Wiki.',
    'Its 1000 unit reach is UFSlash\'s cast range in the game file.',
  ],
  actions: {
    // a buff on the next attack: cast it in attack range (125, edge to edge, plus his 80 radius)
    w: { lock: 0, range: 125 + 80 },
    r: { lock: 0, dash: { speed: '1835 + moveSpeed', distance: 1000, direction: 'toward' } },
  },
});
