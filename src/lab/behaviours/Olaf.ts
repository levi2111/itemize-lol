/* Olaf: Undertow's axe flies as OlafAxeThrow. Reckless Swing's cast time shortens with bonus attack speed,
   from Cast_Time_Base to Cast_Time_Min at Cast_Time_Attack_Speed_Cap, and each attack takes ChampionRefresh
   off its cooldown (a hook). Tough It Out's attack speed and Ragnarok's attack damage are the model's
   "toughItOut" and "ragnarok" for their Duration; each attack or Reckless Swing on the champion extends
   Ragnarok by DurationExtension (a hook keeps it on past its window). */
import { behaviour } from '../behaviour.ts';

/** OlafRecklessStrike.ChampionRefresh; OlafRagnarok.Duration and DurationExtension */
const REFRESH = 1, RAGNAROK = 3, EXTEND = 2.5;

export default behaviour('Olaf', {
  reviewed: '16.20.1',
  sources: ['Undertow\'s axe flies at 1600 units a second: OlafAxeThrow in the game file.'],
  actions: {
    q: { speed: 1600 },
    // a buff on himself with nothing to reach: it can be cast anywhere
    r: { range: 20000 },
    e: { lock: 'Cast_Time_Base - (Cast_Time_Base - Cast_Time_Min) * min(1, bonusAs / (Cast_Time_Attack_Speed_Cap / 100))' },
  },
  windows: [
    { option: 'toughItOut', after: 'w', for: 'Duration' },
    { option: 'ragnarok', after: 'r', for: 'Duration' },
  ],
  hooks: {
    onStart(c) {
      if (c.state.ragnarokUntil) c.setOption('ragnarok', c.t < c.state.ragnarokUntil ? 1 : 0);
    },
    onLand(c) {
      if (c.action === 'r') c.state.ragnarokUntil = c.t + RAGNAROK;
      if (c.action !== 'aa' && c.action !== 'e') return;
      if (c.state.ragnarokUntil) {
        const on = c.t < c.state.ragnarokUntil;
        c.setOption('ragnarok', on ? 1 : 0);
        if (on) c.state.ragnarokUntil += EXTEND;
      }
      if (c.action === 'aa') c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - REFRESH));
    },
  },
  notes: [
    'Undertow\'s cooldown refund for picking the axe up is not counted.',
    'Reckless Swing\'s cast time follows the attack speed Olaf starts the fight with.',
  ],
});
