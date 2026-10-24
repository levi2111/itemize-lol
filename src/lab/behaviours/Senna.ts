/* Senna: Piercing Darkness uses her attack's timing (usesAttackTiming in the game file): its cast is her attack
   windup, shortened by attack speed as the attack's is, and each of her attacks takes CDReductionOnHit off its
   cooldown. Dawning Shadow is global, and PostCastAnimLock holds her after the beam. */
import { behaviour } from '../behaviour.ts';

/** SennaQ.CDReductionOnHit */
const PER_ATTACK = 1;

export default behaviour('Senna', {
  reviewed: '16.20.1',
  sources: ['Piercing Darkness\'s windup is her attack\'s from the game file: a 0.34375 share of the attack at her 0.625 base attack speed, with a 0.6 windup modifier.'],
  actions: {
    q: { lock: '0.34375 / 0.625 + (0.34375 / attackSpeed - 0.34375 / 0.625) * 0.6' },
    r: { range: 20000, channel: 'PostCastAnimLock' },
  },
  hooks: {
    onLand(c) {
      if (c.action === 'aa') c.setReadyAt('q', Math.max(c.t, c.readyAt('q') - PER_ATTACK));
    },
  },
  notes: ['Every attack is counted as hitting a champion, so each takes a second off Piercing Darkness.'],
});
