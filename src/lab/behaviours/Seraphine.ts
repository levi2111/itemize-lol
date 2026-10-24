/* Seraphine: High Note and Beat Drop are cast through SeraphineQCast and SeraphineECast, whose 0.25 second casts
   the slot spells (castTime 0) leave out; High Note's note flies as SeraphineQInitialMissile. Encore reaches RRange. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Seraphine', {
  reviewed: '16.20.1',
  sources: [
    'The 0.25 second casts are SeraphineQCast\'s and SeraphineECast\'s in the game file.',
    'High Note flies at 1300 units a second: SeraphineQInitialMissile in the game file.',
  ],
  actions: {
    q: { lock: 0.25, speed: 1300 },
    e: { lock: 0.25 },
    r: { range: 'RRange' },
  },
  notes: ['An echoed cast lands with the cast that triggered it.'],
});
