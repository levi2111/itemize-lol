/* Thresh: Death Sentence reaches as far as its scythe flies (ThreshQMissile), not the slot spell's 10000. The Box's
   walls stand ThreshRCageRadius around him. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Thresh', {
  reviewed: '16.20.1',
  sources: ['Death Sentence\'s reach of 1100 is ThreshQMissile\'s range in the game file.'],
  actions: {
    q: { range: 1100 },
    r: { range: 'ThreshRCageRadius' },
  },
  notes: ['Death Sentence\'s recast, Thresh pulling himself to the target, is not played: it deals no damage.'],
});
