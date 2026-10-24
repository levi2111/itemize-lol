/* Lucian: Relentless Pursuit is a dash of MaxDistance (the game file gives no DashDistance), and Piercing
   Light and Ardent Blaze can be cast while he dashes, woven in. Each Lightslinger double shot takes
   CDRefundChampion off its cooldown. The Culling fires for Duration, during which he cannot attack but can
   still dash; its bullets fly 1200. */
import { behaviour } from '../behaviour.ts';

/** LucianE.CDRefundChampion */
const REFUND = 2;

export default behaviour('Lucian', {
  reviewed: '16.20.1',
  sources: ['The Culling\'s 1200 reach is LucianRMissile\'s range in the game file.'],
  actions: {
    q: { variants: [{ during: ['e'] }] },
    w: { variants: [{ during: ['e'] }] },
    e: { dash: { speed: 'DashSpeed', distance: 'MaxDistance', direction: 'toward' } },
    r: { range: 1200, channel: 'Duration', allows: ['e'] },
  },
  hooks: {
    // the model's lightslinger counter is armed when this attack fires the second shot
    onLand(c) { if (c.action === 'aa' && c.counter('lightslinger')) c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - REFUND)); },
  },
  notes: [
    'Each Lightslinger double shot takes 2 seconds off Relentless Pursuit\'s cooldown, once per double shot.',
    'Piercing Light\'s cast time is the game file\'s 0.35 seconds at every level.',
  ],
});
