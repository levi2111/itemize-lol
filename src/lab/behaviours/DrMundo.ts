/* Dr. Mundo: Blunt Force Trauma is an instant buff on his next attack (the game file's one second cast time is
   the swing's animation, during which he can move), and Maximum Dosage's bonus lasts its duration, which the
   timeline keeps instead of the model's switch. */
import { behaviour } from '../behaviour.ts';

export default behaviour('DrMundo', {
  reviewed: '16.20.1',
  actions: {
    // a self-cast buff on the next attack: cast it once in attack range (125, edge to edge, plus his 80 radius)
    e: { lock: 0, range: 125 + 80 },
  },
  windows: [{ option: 'maximumDosage', after: 'r', for: 'Duration' }],
  notes: [
    'Heart Zapper\'s detonation is counted when it is cast, with its zaps spread over its duration after it.',
  ],
});
