/* Karthus: Lay Waste holds two charges, one second apart (mMaxAmmo and mAmmoRechargeTime in the game
   file), and erupts a moment after it is cast. Defile is a toggle the model counts for "Seconds the target
   stands in Defile" per cast, so a hook keeps a cast from starting while the last one's seconds still run.
   Requiem channels three seconds and only then strikes. */
import { behaviour } from '../behaviour.ts';

/** Requiem's channel, "channels for 3 seconds" in its tooltip. */
const REQUIEM = 3;

export default behaviour('Karthus', {
  reviewed: '16.20.1',
  sources: [
    'Lay Waste\'s 2 charges coming back 1 second apart are in the game file (mMaxAmmo, mAmmoRechargeTime), not among its values.',
    'Lay Waste erupting 0.5 seconds after its cast is from the League wiki; the game file has no delay for it.',
  ],
  actions: {
    q: { delay: 0.5, charges: { count: 2, recharge: 1 } },
    r: { channel: REQUIEM, delay: REQUIEM },
  },
  hooks: {
    canStart(c) {
      if (c.action !== 'e' || c.state.eAt === undefined || c.t >= c.state.eAt + c.option('defileSeconds')) return true;
      c.note('Defile stays on: a new cast waits until the seconds the last one counted have run.');
      return false;
    },
    onStart(c) {
      if (c.action === 'e') c.state.eAt = c.t;
    },
  },
});
