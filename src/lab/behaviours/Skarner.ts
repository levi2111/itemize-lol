/* Skarner: Shattered Earth's attack speed lasts for its three empowered attacks, within RockHoldDuration; the
   timeline keeps it. Ixtal's Impact is a charge onto the target at MaximumSpeed, then a drag of DistancePostGrab
   into a wall, the pin landing at its end. */
import { behaviour } from '../behaviour.ts';

/** the attacks Shattered Earth empowers, from its tooltip */
const ATTACKS = 3;
const DRAG = 'DistancePostGrab / MaximumSpeed';

export default behaviour('Skarner', {
  reviewed: '16.20.1',
  actions: {
    // a buff on the next attacks: cast it in attack range (150, edge to edge, plus his 80 radius)
    q: { range: 150 + 80 },
    e: {
      lock: 0, dash: { speed: 'MaximumSpeed', distance: 'ChargeDuration * MaximumSpeed', direction: 'toward' },
      channel: DRAG, delay: DRAG,
    },
  },
  windows: [{ option: 'shatteredEarth', after: 'q', for: 'RockHoldDuration' }],
  hooks: {
    onStart(c) { if (c.action === 'q') c.state.empowered = ATTACKS; },
    onLand(c) {
      if (c.action !== 'aa' || !c.state.empowered) return;
      c.state.empowered--;
      if (!c.state.empowered) c.setOption('shatteredEarth', 0);
    },
  },
  notes: [
    'Ixtal\'s Impact runs at its top speed from the start, and a wall is taken to be there at the end of the drag.',
    'Throwing the boulder (Shattered Earth\'s recast) is not played: the third empowered attack stands for it.',
  ],
});
