/* Nilah: Formless Blade's attack speed (the model's "formlessBlade") lasts BuffDuration after each Q that
   hits, and is off before the first. Cast during Slipstream, Formless Blade becomes the wave along her path
   (NilahEQMis), woven into the dash. Slipstream is a dash through the target, an attack reset, with two
   charges coming back on the game file's ammo recharge. Apotheosis whirls for a second, then bursts. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Nilah', {
  reviewed: '16.20.1',
  sources: [
    'Slipstream holds 2 charges (tooltip); each comes back after 26/22.5/19/15.5/12 seconds, reduced by ability haste (NilahE\'s ammo recharge in the game file).',
    'Apotheosis whirls for 1 second before its burst (tooltip); its 450 radius is from the League Wiki.',
  ],
  actions: {
    q: { variants: [{ during: ['e'], spell: 'NilahEQMis', lock: 0 }] },
    // a buff on herself with nothing to reach: it can be cast anywhere
    w: { range: 20000 },
    e: {
      dash: { speed: 'DashSpeed', distance: 'DashTotalDistance', direction: 'through' },
      charges: { count: 2, recharge: '(29.5 - 3.5 * rank) * 100 / (100 + abilityHaste)' },
    },
    r: { range: 450, channel: 1, delay: 1 },
  },
  windows: [{ option: 'formlessBlade', after: 'q', for: 'BuffDuration' }],
  hooks: {
    // the model counts the attack speed as always on; here it starts with the first Formless Blade
    onStart(c) {
      if (c.state.started) return;
      c.state.started = 1;
      c.setOption('formlessBlade', 0);
    },
  },
  notes: [
    'Formless Blade is counted as hitting, so its attack speed always follows a Q; its extra attack range is not drawn.',
    'Apotheosis\' whirl and burst are counted together, when the whirl ends.',
  ],
});
