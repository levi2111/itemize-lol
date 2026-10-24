/* Kennen: Lightning Rush is a run as a ball at his move speed plus MovementSpeed, for up to DurationAsBall:
   drawn as a dash onto the target, recast there, after which its attack speed lasts DurationAfterBall, kept as
   the model's "Lightning Rush attack speed active". */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kennen', {
  reviewed: '16.20.1',
  actions: {
    e: {
      lock: 0,
      dash: { speed: 'moveSpeed * (1 + MovementSpeed)', distance: 'moveSpeed * (1 + MovementSpeed) * DurationAsBall', direction: 'toward' },
    },
  },
  windows: [{ option: 'rush', after: 'e', for: 'DurationAfterBall' }],
  notes: ['Lightning Rush ends at the target as if recast there; its pass through and beyond is not drawn.'],
});
