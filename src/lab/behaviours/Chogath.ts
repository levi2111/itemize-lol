/* Cho'Gath: Rupture and Feral Scream have no cast time in the game file, and Rupture erupts well after its
   cast. Vorpal Spikes is an instant buff on the next three attacks; the game file's cast time is the empowered
   attack's animation (ChogathEAttack), not a lock. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Chogath', {
  reviewed: '16.20.1',
  sources: [
    'Rupture\'s 0.5 second cast and the 0.627 seconds before it erupts, and Feral Scream\'s 0.5 second cast, are from the League wiki: the game file has no cast time for either.',
  ],
  actions: {
    q: { lock: 0.5, delay: 0.627 },
    w: { lock: 0.5 },
    e: { lock: 0 },
    // Feast's range is measured edge to edge in the game file (castRangeUseBoundingBoxes): 175 plus Cho'Gath's
    // 80 radius from his centre, and Feast stacks add to it
    r: { range: '175 + 80 + min(MaxBonusCastRange, CastRangePerStack * eaten)' },
  },
  notes: [
    'Vorpal Spikes\' three spikes land when it is cast, as the model counts them all with the cast; the three attacks that carry them follow it in the combo.',
  ],
});
