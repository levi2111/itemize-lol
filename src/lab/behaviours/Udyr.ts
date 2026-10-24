/* Udyr: every stance arms Monk Training, attack speed for his next two attacks within UdyrPassive.AttackSpeedDuration
   (the model's monkTraining, ended by a hook after the second attack). Wilding Claw's attack speed lasts
   AttackSpeedDurationBase. A stance puts the others on UdyrPassive.GlobalCD, a hook. */
import { behaviour } from '../behaviour.ts';

/** UdyrPassive.GlobalCD */
const GLOBAL_CD = 1.5;
const SLOTS = ['q', 'w', 'e', 'r'] as const;
const monk = (after: typeof SLOTS[number]) => ({ option: 'monkTraining', after, for: 'UdyrPassive.AttackSpeedDuration' });

export default behaviour('Udyr', {
  reviewed: '16.20.1',
  actions: {
    // a self-cast with no reach in the game file: cast it in attack range (125, edge to edge, plus his 65 radius)
    w: { range: 125 + 65 },
  },
  windows: [
    ...SLOTS.map(monk),
    { option: 'clawStance', after: 'q', for: 'if(awakenQ, AttackSpeedDurationEmpowered, AttackSpeedDurationBase)' },
  ],
  hooks: {
    onStart(c) {
      if (c.action === 'aa') return;
      c.state.monk = 2;
      for (const slot of SLOTS) if (slot !== c.action) c.setReadyAt(slot, Math.max(c.readyAt(slot), c.t + GLOBAL_CD));
    },
    onLand(c) {
      if (c.action !== 'aa' || !c.state.monk) return;
      c.state.monk--;
      if (!c.state.monk) c.setOption('monkTraining', 0);
    },
  },
  notes: [
    'The shared stance cooldown is the game data\'s UdyrPassive.GlobalCD; its tooltip does not state it. Awaken\'s shorter one is not played.',
    'Blazing Stampede\'s attacks dashing him to the target are not played.',
  ],
});
