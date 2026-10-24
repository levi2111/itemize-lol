/* Sivir: Boomerang Blade flies as SivirQMissile (the slot spell's range is 10000), its cast cut by bonus attack
   speed as its data values say. Ricochet is an instant attack reset whose attack speed lasts BuffDuration, and
   Spell Shield is instant with nothing to reach; the timeline keeps Ricochet's buff. While On The Hunt lasts
   (UltDuration), each attack takes AttackCooldownRefund off her basic abilities' cooldowns. */
import { behaviour } from '../behaviour.ts';

/** SivirR.AttackCooldownRefund */
const REFUND = 0.5;

export default behaviour('Sivir', {
  reviewed: '16.20.1',
  actions: {
    q: { spell: 'SivirQMissile', lock: 'SivirQ.QBaseCastTime * (1 - min(SivirQ.QAttackSpeedCastReductionMax, bonusAs * SivirQ.QAttackSpeedCastReductionPercent))' },
    // a buff on her attacks: cast it in attack range (500, edge to edge, plus her 65 radius)
    w: { lock: 0, range: 500 + 65 },
    e: { lock: 0, range: 20000 },
    r: { speed: 0 },
  },
  windows: [
    { option: 'ricochet', after: 'w', for: 'BuffDuration' },
    { option: 'hunting', after: 'r', for: 'UltDuration' },
  ],
  hooks: {
    onLand(c) {
      if (c.action !== 'aa' || !c.option('hunting')) return;
      for (const slot of ['q', 'w', 'e'] as const) c.setReadyAt(slot, Math.max(c.t, c.readyAt(slot) - REFUND));
    },
  },
  notes: ['Boomerang Blade\'s return pass lands with the outgoing one.'],
});
