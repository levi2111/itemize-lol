/* Hecarim: Rampage is instant and can be cast during his other casts (canCastOrQueueWhileCasting in the game
   file); each hit adds a stack that takes time off its cooldown. Devastating Charge is a run at the target,
   faster as it goes, ending in the empowered attack the model counts: drawn as a dash at the average of its
   speeds, with the model's "move speed active" option on until it lands. Onslaught of Shadows is a dash whose
   distance is MaxDashRange. */
import { behaviour } from '../behaviour.ts';

/** HecarimRapidSlash.RampageCooldownReduction and MaxStacks. */
const CUT = 0.75, MAX = 3;

export default behaviour('Hecarim', {
  reviewed: '16.20.1',
  actions: {
    q: { lock: 0, variants: [{ during: ['e', 'r'] }] },
    e: { lock: 0, dash: { speed: 'moveSpeed * (1 + (MinMoveSpeed + MaxMoveSpeed) / 2)', distance: 'DistanceToMaxDamage', direction: 'toward' } },
    r: { dash: { speed: 'DashSpeed', distance: 'MaxDashRange', direction: 'toward' } },
  },
  windows: [{ option: 'charging', after: 'e', for: 'Duration', from: 'start' }],
  hooks: {
    onStart(c) {
      // the charge's move speed ends with its attack, which lands before anything after it starts
      if (c.action !== 'e' && c.option('charging') && !c.state.charge) c.setOption('charging', 0);
      if (c.action === 'e') c.state.charge = 1;
    },
    onLand(c) {
      if (c.action === 'e') c.state.charge = 0;
      if (c.action !== 'q') return;
      c.state.rampage = Math.min(MAX, (c.state.rampage ?? c.option('rampageStacks')) + 1);
      c.setReadyAt('q', Math.max(c.t, c.readyAt('q') - CUT * c.state.rampage));
    },
  },
  notes: [
    'Devastating Charge runs at the target at the middle of its move speed range and is counted as reaching full damage, as the model\'s option says.',
    'Rampage stacks never run out here, and each takes 0.75 seconds off its cooldown.',
  ],
});
