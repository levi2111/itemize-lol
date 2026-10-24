/* Master Yi: Alpha Strike's strikes are AlphaStrikeBounces hits, the first after AlphaStrikeMissile's 0.2
   seconds and each next after AlphaStrikeBounce's 0.18 (their fixed flight times in the game file); he is
   held, untargetable, until the last, when the damage lands. Each attack takes BasicAttackCDR off its
   cooldown, and a Double Strike's second strike another. Meditate is a channel of HealDuration. Wuju Style and
   Highlander are instant; Highlander's attack speed lasts RDuration, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

/** AlphaStrike.BasicAttackCDR; MasterYiPassive.AttackCount */
const PER_ATTACK = 1, COUNT = 4;
const STRIKES = '0.2 + 0.18 * (AlphaStrikeBounces - 1)';

export default behaviour('MasterYi', {
  reviewed: '16.20.1',
  actions: {
    q: { speed: 0, channel: STRIKES, delay: STRIKES },
    w: { channel: 'HealDuration' },
    // buffs on his attacks: cast them in attack range (175, edge to edge, plus his 65 radius)
    e: { lock: 0, range: 175 + 65 },
    r: { lock: 0, range: 175 + 65 },
  },
  windows: [{ option: 'highlander', after: 'r', for: 'RDuration' }],
  hooks: {
    onLand(c) {
      if (c.action !== 'aa') return;
      // the model's strike count before this attack adds itself: the attack that reaches AttackCount strikes twice
      const strikes = PER_ATTACK * (c.counter('strikes') + 1 >= COUNT ? 2 : 1);
      c.setReadyAt('q', Math.max(c.t, c.readyAt('q') - strikes));
    },
  },
  notes: [
    'Meditate is channelled in full; cancelling it at once, as an attack reset, is not played.',
    'Wuju Style\'s and Highlander\'s durations do not pause during Alpha Strike or Meditate here.',
  ],
});
