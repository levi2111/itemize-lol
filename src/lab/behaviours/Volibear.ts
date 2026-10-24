/* Volibear: Thundering Smash is a buff on his next attack, instant and resetting the attack timer, so it is cast in
   attack range and its bonus lands with that attack. Stormbringer is a leap at DashSpeed onto the target, and its
   bonus health lasts TransformDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Volibear', {
  reviewed: '16.20.1',
  sources: [
    'Thundering Smash is cast from his attack range: 150 edge to edge plus his 80 radius (game file).',
    'Stormbringer leaps up to VolibearR\'s 700 range in the game file.',
  ],
  actions: {
    q: { range: 150 + 80 },
    r: { dash: { speed: 'DashSpeed', distance: 700, direction: 'toward' } },
  },
  windows: [{ option: 'stormbringer', after: 'r', for: 'TransformDuration' }],
  notes: ['Sky Splitter is counted as striking when it is cast: the delay before its bolt lands is not in the game data.'],
});
