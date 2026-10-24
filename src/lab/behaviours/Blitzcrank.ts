/* Rocket Grab's cast spell has a range of 10000; the hand (RocketGrabMissile) has the real one. Overdrive is
   a self-cast whose attack speed lasts Duration. Power Fist is cast at once: the file has no mCastTime for
   it, and its spellCastTime and total time are the same template numbers as Garen's Decisive Strike, also an
   instant empowered attack. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Blitzcrank', {
  reviewed: '16.20.1',
  actions: {
    q: { spell: 'RocketGrabMissile' },
    w: { range: 25000 },
    e: { lock: 0 },
  },
  windows: [{ option: 'overdrive', after: 'w', for: 'Duration' }],
  notes: ['The pull is not played out: the target stays where it stands.'],
});
