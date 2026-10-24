/* Garen: Decisive Strike and Courage are instant (the game file's cast times are animations); Decisive Strike
   resets his attack and empowers the next one. Judgment is a three second spin, during which he cannot attack
   but can still cast Courage and Demacian Justice. Neither Judgment nor Demacian Justice has a usable reach in
   the game file. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Garen', {
  reviewed: '16.20.1',
  sources: [
    'Judgment\'s 325 spin radius and Demacian Justice\'s 400 range are from the League wiki; the game file has a 35 radius and no range for them.',
  ],
  actions: {
    // a buff on the next attack: cast it once in attack range (175, edge to edge, plus his 65 radius)
    q: { lock: 0, range: 175 + 65 },
    w: { lock: 0 },
    e: { lock: 0, range: 325, channel: 'Duration', allows: ['w', 'r'] },
    r: { range: 400 },
  },
  notes: [
    'Garen does not walk while Judgment spins here; the target is taken to stay inside it for the whole spin.',
  ],
});
