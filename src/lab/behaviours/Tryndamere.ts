/* Tryndamere: Bloodlust and Undying Rage are instant and need no target. Spinning Slash spins him onto the
   target, from within its cast range; the game data has no speed for it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Tryndamere', {
  reviewed: '16.20.1',
  sources: ['Spinning Slash covers its 660 length (the slash spell in the game file) at an assumed 1300 units a second; the game data has no speed.'],
  actions: {
    q: { lock: 0, range: 20000 },
    // out of its 650 cast range (from his centre, he has a 65 radius) he walks in first
    e: { lock: 0, dash: { speed: 1300, distance: 660, direction: 'toward' }, variants: [{ beyond: 650 - 65, dash: null }] },
    r: { lock: 0, range: 20000 },
  },
  notes: ['Critical strikes taking ChampCDRefund off Spinning Slash\'s cooldown are not played.'],
});
