/* Yunara: Cultivation of Spirit's active consumes Resource_Max Unleash, built by her attacks (Resource_Champion
   each on a champion), and lasts Buff_Duration; Transcend One's Self lasts Buff_Duration and keeps Cultivation of
   Spirit active (both are timed windows of the model's options). Arc of Judgment's cast shortens with bonus attack
   speed, from Cast_Time_Base to Cast_Time_Min at Cast_Time_Attack_Speed_Cap; in the Transcendent State it is Arc of
   Ruin (YunaraW2), a laser with a longer cast. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** YunaraQ: Resource_Max, Resource_Champion, Resource_Duration, Resource_Loss, Resource_Loss_Interval */
const MAX = 8, PER_ATTACK = 2, HOLD = 6, LOSS = 1, INTERVAL = 0.5;

/** Unleash now: it holds for HOLD seconds after the last gain, then drains */
const unleash = (c: HookContext) => {
  const s = c.state.unleash ?? 0, since = c.t - (c.state.gainedAt ?? 0);
  return since <= HOLD ? s : Math.max(0, s - Math.floor((since - HOLD) / INTERVAL) * LOSS);
};

export default behaviour('Yunara', {
  reviewed: '16.20.1',
  sources: [
    'Arc of Judgment has no cooldown in the game file; its 10 seconds are from Data Dragon.',
    'The cast is taken to shorten in a straight line with bonus attack speed up to its cap; the data values give only the ends.',
  ],
  actions: {
    // buffs on her attacks: cast from attack range, 575 edge to edge plus her 65 radius (game file)
    q: { range: 575 + 65 },
    r: { range: 575 + 65 },
    w: {
      lock: 'Cast_Time_Base - (Cast_Time_Base - Cast_Time_Min) * min(1, bonusAs * 100 / Cast_Time_Attack_Speed_Cap)',
      charges: { count: 1, recharge: '10 * 100 / (100 + abilityHaste)' },
      variants: [{
        when: 'transcended', spell: 'YunaraW2', speed: 0,
        lock: 'YunaraW.Cast_Time_Base_Empowered - (YunaraW.Cast_Time_Base_Empowered - YunaraW.Cast_Time_Min_Empowered) * min(1, bonusAs * 100 / YunaraW.Cast_Time_Attack_Speed_Cap_Empowered)',
      }],
    },
  },
  windows: [
    { option: 'unleash', after: 'q', for: 'Buff_Duration' },
    { option: 'transcendent', after: 'r', for: 'Buff_Duration' },
  ],
  hooks: {
    onLand(c) {
      if (c.action !== 'aa') return;
      c.state.unleash = Math.min(MAX, unleash(c) + PER_ATTACK);
      c.state.gainedAt = c.t;
    },
    canStart(c) {
      if (c.action !== 'q') return true;
      if (unleash(c) >= MAX) return true;
      c.note('Cultivation of Spirit waits for 8 Unleash: each attack on a champion gives 2.');
      return false;
    },
    onStart(c) {
      if (c.action === 'q') c.state.unleash = 0;
    },
  },
  notes: ['Unleash starts the fight empty.'],
});
