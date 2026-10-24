/* Karma: Mantra itself is instant. R in the combo stands for what Mantra adds to the next Inner Flame, so it
   flies as the empowered missile (KarmaQMissileMantra), alongside the Q cast after it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Karma', {
  reviewed: '16.20.1',
  actions: {
    r: { spell: 'KarmaQMissileMantra', lock: 0 },
  },
  notes: [
    'Focused Resolve\'s second hit, when the tether holds, lands with the first here; in the game it comes TetherDuration later.',
    'Gathering Fire\'s Mantra cooldown refund on ability hits is not counted.',
  ],
});
