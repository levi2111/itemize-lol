/* Yasuo: Steel Tempest uses his attack's timing (usesAttackTiming in the game file), so its cast is his attack
   windup, and its cooldown shrinks with bonus attack speed. Two hits within GatheringStormDuration make the third
   cast the whirlwind (YasuoQ3Mis): the three casts are a chain, each a cooldown apart. Cast during Sweeping Blade
   it is the circle around him (YasuoEQCombo), woven into the dash, and the third one knocks up too. Sweeping Blade
   is a dash through the target that cannot be cast on it again for PerTargetCooldown. Last Breath needs an
   airborne target: it can start only while a whirlwind or a third circle's knock-up lasts (hook). */
import { behaviour } from '../behaviour.ts';

/** the knock-up of the third Steel Tempest: KnockUpDurationTOOLTIPONLY */
const AIRBORNE = 1;
/** Yasuo's attack windup in the game file, a 0.22 share at a windup modifier of 1 */
const WINDUP = '0.22 / attackSpeed';

export default behaviour('Yasuo', {
  reviewed: '16.20.1',
  sources: [
    'Steel Tempest\'s cooldown falls by 1% for every 1.67% bonus attack speed, to a third of it at 111% (League Wiki; Yone\'s QAttackSpeedCDPercent and QAttackSpeedCDMax state the same rule).',
    'Sweeping Blade\'s dash speed of BaseDashSpeed plus 60% of his bonus move speed is from the League Wiki; it covers YasuoE\'s 475 cast range in the game file.',
    'The knock-up lasting 1 second is KnockUpDurationTOOLTIPONLY in the game data.',
  ],
  actions: {
    q: {
      lock: WINDUP,
      recasts: { count: 3, window: 'GatheringStormDuration', gap: 'Cooldown * (1 - min(2 / 3, bonusAs / 1.67))', cooldownFrom: 'first' },
      variants: [
        { during: ['e'], cast: 3, spell: 'YasuoEQCombo' },
        { during: ['e'], spell: 'YasuoEQCombo' },
        { cast: 3, spell: 'YasuoQ3Mis', lock: WINDUP },
      ],
    },
    e: {
      dash: { speed: 'BaseDashSpeed + 0.6 * bonusMs', distance: 475, direction: 'through' },
      // the per-target cooldown, as a chain of one cast: the next cast waits PerTargetCooldown
      recasts: { count: 1, window: 0, gap: 'PerTargetCooldown' },
    },
    // a blink onto the target, there as the cast ends
    r: { dash: { speed: 1400 / 0.25, distance: 1400, direction: 'toward' } },
  },
  hooks: {
    onLand(c) {
      // variants 0 and 2: the third circle and the whirlwind knock the target up
      if (c.action === 'q' && (c.variant === 0 || c.variant === 2)) c.state.airborne = c.t;
    },
    canStart(c) {
      if (c.action !== 'r') return true;
      if (c.state.airborne !== undefined && c.t - c.state.airborne <= AIRBORNE) return true;
      c.note('Last Breath waits for an airborne target: the third Steel Tempest (the whirlwind, or the circle during Sweeping Blade) knocks it up.');
      return false;
    },
  },
  notes: [
    'Sweeping Blade has one target here, so each dash waits its per-target cooldown.',
    'Last Breath blinks him beside the target as its cast ends; the time he spends in the air with it is not played.',
  ],
});
