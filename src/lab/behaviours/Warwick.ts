/* Warwick: Blood Hunt's active grants its passive attack speed against the target for Duration. Infinite Duress
   is a leap of 2.5 times his move speed, then a RDuration channel holding the target while he strikes three times. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Warwick', {
  reviewed: '16.20.1',
  sources: [
    'Infinite Duress leaping 250% of his move speed is from the League Wiki ("a huge distance that scales with his Move Speed" in the tooltip); the leap\'s speed of 1800 is assumed, the game data has none.',
  ],
  actions: {
    r: { dash: { speed: 1800, distance: '2.5 * moveSpeed', direction: 'toward' }, channel: 'RDuration' },
  },
  windows: [{ option: 'bloodHunt', after: 'w', for: 'Duration' }],
  notes: ['Jaws of the Beast is the tap: the hold, leaping behind the target, is not played.'],
});
