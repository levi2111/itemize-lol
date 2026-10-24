/* K'Sante: Ntofo Strikes' cast time shortens from MaxCastTime to MinCastTime with his bonus armor and magic
   resist, up to DefenseCapforCooldown. Path Maker charges (TimeToFullCharge for the full charge the model
   counts by default, MinChargeTime otherwise) and rams up to MaxDashBase, or MinDashBase uncharged. Footwork
   is a short dash. All Out tackles the target and lasts AllOutDuration, which the timeline keeps as the
   model's "All Out active": while it lasts Path Maker and Footwork dash faster and further, Ntofo Strikes'
   cooldown is cut by RCooldownReduction and Footwork's by CooldownModAO, and going All Out refreshes Path
   Maker (hooks). */
import { behaviour } from '../behaviour.ts';

/** KSanteQ.RCooldownReduction and KSanteE.CooldownModAO. */
const Q_CUT = 1 / 3, E_CUT = 0.5;

const aoDash = { speed: 'DashSpeedAO', distance: 'MaxDashBase', direction: 'toward' } as const;

export default behaviour('KSante', {
  reviewed: '16.20.1',
  actions: {
    q: { lock: 'MaxCastTime - (MaxCastTime - MinCastTime) * min(1, (bonusArmor + bonusMr) / DefenseCapforCooldown)' },
    w: {
      lock: 'TimeToFullCharge',
      dash: { speed: 'DashSpeedBase', distance: 'MaxDashBase', direction: 'toward' },
      variants: [
        { when: 'allOut && !charged', lock: 'MinChargeTime', dash: aoDash },
        { when: 'allOut', dash: aoDash },
        { when: '!charged', lock: 'MinChargeTime', dash: { speed: 'DashSpeedBase', distance: 'MinDashBase', direction: 'toward' } },
      ],
    },
    e: {
      dash: { speed: 'FreeTargetSpeedBase', distance: 'FreeTargetRangeBase', direction: 'toward' },
      variants: [{ when: 'allOut', dash: { speed: 'FreeTargetSpeedAO', distance: 'FreeTargetRangeAO', direction: 'toward' } }],
    },
    r: {
      dash: { speed: 'TackleSpeed', distance: 'TackleRange', direction: 'toward' },
      variants: [{ when: 'wall', channel: 'KsanteAnimLockWall' }],
    },
  },
  windows: [{ option: 'allOut', after: 'r', for: 'AllOutDuration' }],
  hooks: {
    onStart(c) {
      c.state[`${c.action}At`] = c.t;
    },
    onLand(c) {
      if (c.action === 'r') c.setReadyAt('w', c.t);
      const cut = c.action === 'q' ? Q_CUT : c.action === 'e' ? E_CUT : 0;
      if (!cut || !c.option('allOut')) return;
      const from = c.state[`${c.action}At`]!;
      c.setReadyAt(c.action as 'q' | 'e', from + (c.readyAt(c.action as 'q' | 'e') - from) * (1 - cut));
    },
  },
  notes: [
    'Path Maker\'s charge and ram are drawn as one: he moves at the ram\'s speed from the start and strikes when the charge ends.',
    'All Out\'s knock-back, and the target carried through a wall, are not drawn: K\'Sante ends next to the target.',
    'The third Ntofo Strike (the shockwave at two stacks) is timed like the others here.',
    'Ntofo Strikes\' cooldown shortening with his bonus armor and magic resist is not counted.',
  ],
});
