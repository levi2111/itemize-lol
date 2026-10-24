/* Orianna: her abilities start from the Ball. Command: Attack flies it to the target (OrianaIzuna, 1400
   units a second); Dissonance and Shockwave go off where the Ball is, which is counted as on the target, so
   they wait for a Ball in flight to arrive. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Orianna', {
  reviewed: '16.20.1',
  sources: ['The Ball flies at 1400 units a second when commanded to attack: OrianaIzuna in the game file.'],
  actions: { q: { speed: 1400 } },
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.state.ballOut = 1;
    },
    canStart(c) {
      if ((c.action !== 'w' && c.action !== 'r') || !c.state.ballOut) return true;
      c.note('Command: Dissonance and Command: Shockwave wait for the Ball to reach the target.');
      return false;
    },
    onLand(c) {
      if (c.action === 'q') c.state.ballOut = 0;
    },
  },
  notes: ['The Ball is counted as starting on Orianna and staying on the target once it has reached it; Command: Protect\'s pass is counted at once.'],
});
