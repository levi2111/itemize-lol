/* Irelia: Bladesurge is a dash at 1400 plus her move speed (DashSpeedBonus); it has no cast time, and its
   cooldown comes back when it hits an Unsteady target, which Flawless Duet's stun and Vanguard's Edge make
   for MarkDuration (a hook keeps the mark; Bladesurge spends it). Defiant Dance charges before its strike:
   ChargeTimeForMax for the full damage the model counts by default, then the release (IreliaW2). Flawless
   Duet is one action here, as in the model: the first blade, the recast CDBetweenCast later, then the
   blades fly together. */
import { behaviour } from '../behaviour.ts';

/** IreliaE.MarkDuration and IreliaR.MarkDuration. */
const MARK = 5;

export default behaviour('Irelia', {
  reviewed: '16.20.1',
  sources: [
    'Bladesurge\'s dash reaches its 600 cast range in the game file.',
    'Defiant Dance\'s release takes IreliaW2\'s 0.25 second cast; Flawless Duet\'s recast takes IreliaE2\'s 0.125, and its blades meet in IreliaEMissile\'s 0.25 seconds (all in the game file).',
  ],
  actions: {
    q: { lock: 0, dash: { speed: 'moveSpeed + DashSpeedBonus', distance: 600, direction: 'toward' } },
    w: {
      spell: 'IreliaW2',
      lock: 'IreliaW.ChargeTimeForMax + 0.25',
      variants: [{ when: '!wCharged', lock: 0.25 }],
    },
    e: { lock: 'CDBetweenCast + 0.125', speed: 0, delay: 0.25 },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'e' || c.action === 'r') c.state.marking = 1;
    },
    // she waits for the stun or the barrage to land before Bladesurge, to get its cooldown back
    canStart(c) {
      if (c.action !== 'q' || !c.state.marking) return true;
      c.note('Bladesurge waits for Flawless Duet or Vanguard\'s Edge on its way to land, so that the target is Unsteady.');
      return false;
    },
    onLand(c) {
      if (c.action === 'e' || c.action === 'r') { c.state.unsteady = c.t + MARK; c.state.marking = 0; }
      if (c.action === 'q' && (c.state.unsteady ?? 0) > c.t) {
        c.state.unsteady = 0;
        c.setReadyAt('q', c.t);
        c.note('Bladesurge on an Unsteady target (after Flawless Duet or Vanguard\'s Edge) comes back at once.');
      }
    },
  },
  notes: ['Bladesurge\'s reset when the target dies is not counted.'],
});
