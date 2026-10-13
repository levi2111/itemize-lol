import { champion } from '../dsl.ts';

/* Two things the game data does not say about Miss Fortune:
   - Love Tap only fires on a target that does not carry her mark, so a lone
     target takes it once, until Double Up moves the mark by going through
     another unit first.
   - Double Up's two shots hit two different enemies. One target takes either the
     first shot or the bounce, and only the bounce can critically strike. */
export default champion('MissFortune', {
  reviewed: '16.20.1',
  vars: {
    // a first shot that kills is a first shot at another unit, so the target takes the bounce
    bounced: 'bounce || bounceKill',
  },
  options: {
    bounce: { label: 'Double Up bounces to the target off a unit in front', default: false },
    bounceKill: { label: 'Double Up\'s first shot kills the unit in front (the bounce always crits)', default: false },
    strut: { label: 'Strut attack speed active', default: false },
  },
  // tapped: the target carries the Love Tap mark
  counters: { tapped: {} },
  p: {
    rules: [{
      id: 'tap', label: 'Love Tap', on: 'onhit', when: '!tapped', type: 'physical', amount: 'TotalDamage', then: 'tapped = 1',
      note: 'Love Tap is counted once: a lone target stays marked. A Double Up that bounces to the target triggers it again.',
    }],
  },
  q: {
    hits: [
      // the first shot marked the unit in front, so the bounce finds the target unmarked
      { id: 'mark', type: 'physical', amount: 0, when: 'bounced', then: 'tapped = 0' },
      {
        id: 'shot', type: 'physical', amount: 'TotalDamageTooltip', when: '!bounced', appliesOnHit: true,
        note: 'Double Up counts its first shot, which cannot crit, unless "Double Up bounces to the target off a unit in front" is set.',
      },
      {
        id: 'bounce', label: 'Double Up bounce', type: 'physical', when: 'bounced', appliesOnHit: true,
        amount: 'if(bounceKill, TotalDamageCrit, TotalDamageTooltip)', crit: 'TotalDamageCrit',
      },
    ],
  },
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'ActiveAS', when: 'strut' }],
  },
  e: {
    // damage is given per second and dealt in TicksPerSecond ticks
    hits: [{
      id: 'rain', type: 'magic', amount: 'TotalDamagePerSecond / TicksPerSecond', count: 'TicksPerSecond * BaseDuration',
      over: 'BaseDuration',
      note: 'The target is counted as standing in Make It Rain for its whole duration.',
    }],
  },
  r: {
    hits: [{
      id: 'waves', type: 'physical', amount: 'PhysicalDamagePerWave', count: 'BaseWaves', crit: 'CritDamagePerWave',
      over: 'BaseChannelDuration',
      note: 'Every wave of the full Bullet Time channel is counted.',
    }],
  },
});
