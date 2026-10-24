/* Lillia: her attacks have no projectile. Blooming Blows reaches MaximumRadius, and only its outer edge deals
   the true damage: a target inside MinimumRadius takes the inner hit alone. Watch Out! Eep! winds up for
   MinimumCastTime, longer (up to MaximumCastTime) when aimed further than MinimumDistance, out to
   MaximumDistance. Lilting Lullaby only works on a target with Dream Dust, and its damage lands when the
   drowsy target falls asleep and is woken. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Lillia', {
  reviewed: '16.20.1',
  attack: { missileSpeed: 0 },
  actions: {
    q: {
      range: 'MaximumRadius',
      // the target wholly inside the inner circle: edge to edge, less her radius and twice the target's (65 each)
      variants: [{ within: 'MinimumRadius - 195', options: { outerEdge: 0 } }],
    },
    w: { lock: 'MinimumCastTime', range: 'MaximumDistance', variants: [{ beyond: 'MinimumDistance', lock: 'MaximumCastTime' }] },
    r: { requires: 'dusted', delay: 'DrowsyDuration' },
  },
  notes: [
    'Lilting Lullaby\'s damage is counted as the target falls asleep, as if the next hit wakes it at once.',
    'Watch Out! Eep!\'s longer wind-up is used for any target further than MinimumDistance, edge to edge.',
  ],
});
