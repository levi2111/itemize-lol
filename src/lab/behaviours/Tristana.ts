/* Tristana: Rapid Fire is instant and its attack speed lasts BuffDuration. Rocket Jump is a jump onto the target,
   from within its range.
   An Explosive Charge reaching ActiveMaxStacks on a champion refreshes Rocket Jump: a hook watches the model's
   bomb counter. */
import { behaviour } from '../behaviour.ts';

/** TristanaE.ActiveMaxStacks */
const STACKS = 4;

export default behaviour('Tristana', {
  reviewed: '16.20.1',
  sources: ['Rocket Jump has no speed in the game data: 1100 units a second over its 900 cast range is an assumption.'],
  actions: {
    // a buff on her attacks: cast it in attack range (550, edge to edge, plus her 55 radius)
    q: { lock: 0, range: 550 + 55 },
    // out of reach (900 from her centre, she has a 55 radius) she walks in first
    w: { dash: { speed: 1100, distance: 900, direction: 'toward' }, variants: [{ beyond: 900 - 55, dash: null }] },
  },
  windows: [{ option: 'rapidFire', after: 'q', for: 'BuffDuration' }],
  hooks: {
    onLand(c) {
      if (c.action !== 'aa' && c.action !== 'w' && c.action !== 'r') return;
      // the hit about to land adds the bomb's last stack
      if (c.counter('charge') === STACKS - 1 && c.t < c.counter('fuse')) {
        c.setReadyAt('w', c.t);
        c.note('Explosive Charge at full stacks refreshed Rocket Jump.');
      }
    },
  },
  notes: [
    'Draw a Bead\'s extra attack range from levels is not added to her reach here.',
    'Buster Shot\'s knockback does not move the target here.',
  ],
});
