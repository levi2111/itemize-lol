/* Rocket Grab pulls the first enemy it hits all the way to Blitzcrank. Overdrive is a self-cast whose attack
   speed lasts Duration. Power Fist is cast at once: the file has no mCastTime for it, and its spellCastTime and
   total time are the same template numbers as Garen's Decisive Strike, also an instant empowered attack. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Blitzcrank', {
  reviewed: '16.20.1',
  sources: ['Rocket Grab\'s pull covers its whole 1079 range (RocketGrab in the game file), so whatever it hooks lands next to him.'],
  actions: {
    q: { pull: 1079 },
    w: { range: 25000 },
    e: { lock: 0 },
  },
  windows: [{ option: 'overdrive', after: 'w', for: 'Duration' }],
  notes: ['Rocket Grab\'s pull is instant here; in the game the target is dragged back over a moment.'],
});
