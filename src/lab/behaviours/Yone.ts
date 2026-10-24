/* Yone: Mortal Steel's and Spirit Cleave's casts shorten, and their cooldowns shrink, with bonus attack speed, as
   their data values say. Two hits of Mortal Steel within BuffDuration make the third cast YoneQ3, a dash of
   Q3MaxDistance at Q3DashSpeed: the three casts are a chain, each a cooldown apart. Soul Unbound is a dash of
   EDashRange at EDashSpeed. Fate Sealed blinks him to the target as its cast ends. */
import { behaviour } from '../behaviour.ts';

const Q_LOCK = 'YoneQ.QBaseCastTime * (1 - min(YoneQ.QAttackSpeedCastReductionMax, bonusAs * YoneQ.QAttackSpeedCastReductionPercent))';

export default behaviour('Yone', {
  reviewed: '16.20.1',
  sources: [
    'Mortal Steel\'s 4 second and Spirit Cleave\'s 14 second cooldowns are YoneQ\'s and YoneW\'s in the game file; the attack speed reduction is their data values.',
    'Fate Sealed blinks up to YoneR\'s 1000 range in the game file, reaching the target as its 0.75 second cast ends.',
  ],
  actions: {
    q: {
      lock: Q_LOCK,
      recasts: { count: 3, window: 'BuffDuration', gap: '4 * (1 - min(QAttackSpeedCDMax, bonusAs * QAttackSpeedCDPercent))', cooldownFrom: 'first' },
      variants: [{
        cast: 3, spell: 'YoneQ3', lock: Q_LOCK,
        dash: { speed: 'YoneQ.Q3DashSpeed', distance: 'YoneQ.Q3MaxDistance', direction: 'through' },
      }],
    },
    w: {
      lock: 'WBaseCastTime * (1 - min(WAttackSpeedCastReductionMax, bonusAs * WAttackSpeedCastReductionPercent))',
      // the cooldown cut by attack speed, as a single charge coming back after it
      charges: { count: 1, recharge: '14 * (1 - min(WAttackSpeedCDMax, bonusAs * WAttackSpeedCDPercent))' },
    },
    e: { lock: 0, dash: { speed: 'EDashSpeed', distance: 'EDashRange', direction: 'toward' } },
    r: { dash: { speed: 1000 / 0.75, distance: 1000, direction: 'toward' } },
  },
  notes: [
    'Soul Unbound\'s return, and the mark it sets off, are not played: the model adds the mark\'s share to each hit as it lands.',
    'The attack speed that shortens casts and cooldowns is the build\'s, not buffs gained in the fight.',
  ],
});
