/* Yordle Snap Trap holds MaximumCharges traps that recharge one at a time. The model counts a trap as the
   Headshot it grants, which an attack fires, so a new trap waits for an attack after the last one. 90 Caliber
   Net's cast spell has a range of 10000; the net (CaitlynEMissile) flies 800. Ace in the Hole channels before
   the shot leaves. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Caitlyn', {
  reviewed: '16.20.1',
  sources: [
    'Trap recharge 26/22/18/14/10 s: CaitlynW\'s ammo recharge in the game file (timing.ammoRecharge), which a formula cannot read.',
    'The net\'s reach of 800 is CaitlynEMissile\'s range in the game file.',
    'Ace in the Hole: CaitlynR\'s 0.375 s cast in the game file plus a 1 second channel (League Wiki; the file marks it a channel without a length).',
  ],
  actions: {
    w: { charges: { count: 'MaximumCharges', recharge: '(30 - 4 * rank) * 100 / (100 + abilityHaste)' } },
    e: { range: 800 },
    r: { lock: 1.375 },
  },
  hooks: {
    canStart(c) { return c.action !== 'w' || !c.state.trapHeadshot; },
    onStart(c) {
      if (c.action === 'w') c.state.trapHeadshot = 1;
      else if (c.action === 'aa') c.state.trapHeadshot = 0;
    },
  },
  notes: [
    'A trap is counted as sprung as soon as it is placed, and only one trap\'s Headshot waits for an attack at a time.',
    'The net\'s knock back on Caitlyn is not played out.',
  ],
});
