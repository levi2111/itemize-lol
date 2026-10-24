/* Dr. Mundo: Blunt Force Trauma is an instant buff on his next attack (the game file's one second cast time is
   the swing's animation, during which he can move), and Maximum Dosage's bonus lasts its duration, which the
   timeline keeps instead of the model's switch. */
import { behaviour } from '../behaviour.ts';

export default behaviour('DrMundo', {
  reviewed: '16.20.1',
  actions: {
    e: { lock: 0 },
  },
  windows: [{ option: 'maximumDosage', after: 'r', for: 'Duration' }],
  notes: [
    'Heart Zapper\'s detonation is counted when it is cast, with its zaps spread over its duration after it.',
  ],
});
