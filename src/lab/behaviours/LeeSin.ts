/* Lee Sin: each basic ability is two casts, the second within its ReactivateTime. Sonic Wave's recast
   (LeeSinQTwo) is a dash to the target the wave hit, and waits for the wave to land; Safeguard (cast on
   himself, instant) is followed by Iron Will, Tempest by Cripple. The model's qCast and eCast say which half a
   cast deals. Every cast arms Flurry: attack speed for his next two attacks, kept by the timeline. */
import { behaviour } from '../behaviour.ts';

const FLURRY = 3;
const flurry = (after: 'q' | 'w' | 'e' | 'r') => ({ option: 'flurry', after, for: FLURRY });

export default behaviour('LeeSin', {
  reviewed: '16.20.1',
  sources: [
    'Flurry lasting 3 seconds is from the League Wiki; the tooltip only says two attacks.',
    'Resonating Strike\'s reach of 1250 is LeeSinQTwo\'s cast range in the game file.',
  ],
  actions: {
    q: {
      recasts: { count: 2, window: 'ReactivateTime' },
      variants: [
        { cast: 1, options: { qCast: 1 } },
        { cast: 2, spell: 'LeeSinQTwo', dash: { speed: 'LeeSinQOne.DashSpeed', distance: 1250, direction: 'toward' }, options: { qCast: 2 } },
      ],
    },
    // a self-cast with nothing to reach
    w: {
      lock: 0, range: 20000,
      recasts: { count: 2, window: 'W1ReactivateTime' },
      variants: [{ cast: 2, spell: 'LeeSinWTwo', range: 20000 }],
    },
    e: {
      recasts: { count: 2, window: 'ReactivateTime' },
      variants: [
        { cast: 1, options: { eCast: 1 } },
        { cast: 2, spell: 'LeeSinETwo', options: { eCast: 2 } },
      ],
    },
  },
  windows: [flurry('q'), flurry('w'), flurry('e'), flurry('r')],
  hooks: {
    canStart(c) {
      if (c.action !== 'q' || c.cast !== 2 || c.state.waveHit) return true;
      c.note('Resonating Strike waits for Sonic Wave to land.');
      return false;
    },
    onStart(c) {
      if (c.action === 'q' && c.cast === 1) c.state.waveHit = 0;
      if (c.action !== 'aa') c.state.flurry = 2;
    },
    onLand(c) {
      if (c.action === 'q' && c.variant === 0) c.state.waveHit = 1;
      // Flurry ends with its second attack
      if (c.action === 'aa' && c.state.flurry) {
        c.state.flurry--;
        if (!c.state.flurry) c.setOption('flurry', 0);
      }
    },
  },
  notes: [
    'Sonic Wave and Tempest are counted as hitting, so their recasts are always there.',
    'Safeguard is cast on Lee Sin himself. Energy is not counted.',
  ],
});
