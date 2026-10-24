/* Darius: Decimate swings after a long windup and reaches further than the game file's range; Crippling Strike
   is an instant buff on the next attack (the game file's cast time is the empowered attack's animation);
   Apprehend pulls the target to him and Noxian Guillotine leaps onto it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Darius', {
  reviewed: '16.20.1',
  sources: [
    'Decimate\'s 0.75 second windup and its 425 unit blade radius are from the League wiki; the game file has a 0.23 second cast time and a 270 range.',
    'Apprehend\'s pull covers its whole 535 range (DariusAxeGrabCone in the game file), so whoever it catches lands next to him.',
    'Noxian Guillotine\'s leap has no speed in the game data: it is taken to cover its 475 range within its 0.37 second cast (about 1300 units a second).',
  ],
  actions: {
    q: { lock: 0.75, range: 425 },
    // a self-cast buff on the next attack: cast it once in attack range (175, edge to edge, plus his 65 radius)
    w: { lock: 0, range: 175 + 65 },
    e: { pull: 535 },
    r: { dash: { speed: 1300, distance: 475, direction: 'toward' } },
  },
  notes: [
    'Decimate is counted as hitting with the blade wherever the target stands within its reach; Darius cannot walk during its windup here.',
    'Apprehend\'s pull is instant here; in the game the target is dragged in over a moment.',
  ],
});
