/* Twitch: leaving Ambush's camouflage gives AttackSpeedMod for AttackSpeedDuration, taken from the cast, as he
   attacks right after it. Contaminate needs Deadly Venom on the target. Spray and Pray is instant and lasts
   Duration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Twitch', {
  reviewed: '16.20.1',
  actions: {
    // cast it in attack range (550, edge to edge, plus his 65 radius), so the attack speed is not spent walking
    q: { range: 550 + 65 },
    e: { requires: 'venom' },
    r: { lock: 0 },
  },
  windows: [
    { option: 'ambush', after: 'q', for: 'AttackSpeedDuration' },
    { option: 'sprayAndPray', after: 'r', for: 'Duration' },
  ],
  notes: [
    'Ambush\'s camouflage fading in over MaxFadeTime is not played: its attack speed starts with the cast.',
    'Spray and Pray\'s extra attack range is not added to his reach.',
    'Contaminate waits for Deadly Venom on the target.',
  ],
});
