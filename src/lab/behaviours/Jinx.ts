/* Jinx: Switcheroo! is an instant weapon swap; in the combo it flips the model's "Using Fishbones" option,
   which then says the weapon she starts with. Fishbones' rockets fly at JinxQAttack's speed. Zap! is cast as
   JinxWMissile, whose cast time shortens with bonus attack speed down to JinxLowEndWCastTime (the slot spell
   has a placeholder range). Flame Chompers! are thrown, arm in GrenadeArmTime and snap on the target.
   Super Mega Death Rocket! reaches the whole map. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Jinx', {
  reviewed: '16.20.1',
  sources: [
    'Rockets fly at 2000 (JinxQAttack in the game file).',
    'Zap!\'s cast time starts at JinxWMissile\'s 0.6 seconds and loses 0.01 for each JinxWASpeedCastTimeScalarPerHundrethSecond of bonus attack speed.',
    'Flame Chompers! land in JinxEHit\'s 0.4 seconds (game file) before arming.',
  ],
  attack: { variants: [{ when: 'rockets', missileSpeed: 2000 }] },
  actions: {
    q: { lock: 0 },
    w: { spell: 'JinxWMissile', lock: 'max(JinxW.JinxLowEndWCastTime, 0.6 - bonusAs * 0.01 / JinxW.JinxWASpeedCastTimeScalarPerHundrethSecond)' },
    e: { delay: '0.4 + GrenadeArmTime' },
    r: { range: 25000 },
  },
  hooks: {
    onLand(c) {
      if (c.action === 'q') c.setOption('rockets', c.option('rockets') ? 0 : 1);
    },
  },
  notes: [
    'Fishbones\' bonus attack range is not drawn: her attacks keep Pow-Pow\'s range.',
    'Super Mega Death Rocket! flies at its starting speed all the way; the game speeds it up after a while.',
  ],
});
