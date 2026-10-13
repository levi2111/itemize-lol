import { champion } from '../dsl.ts';

export default champion('Nami', {
  reviewed: '16.20.1',
  options: {
    bounces: { label: 'Ebb and Flow bounces before it reaches the target', kind: 'int', default: 0, min: 0, max: 2 },
  },
  // Surging Tides only gives move speed
  p: {},
  q: {
    hits: [{ id: 'bubble', type: 'magic', amount: 'TotalDamageTT' }],
  },
  w: {
    // a champion is hit once per cast; each bounce before the enemy shifts the damage by BounceScaling, which turns positive with enough ability power
    hits: [{ id: 'stream', type: 'magic', amount: 'TotalDamage * (1 + min(bounces, MaxTargets - 1) * BounceScaling)' }],
    notes: ['Ebb and Flow is counted as cast straight at the target unless bounces are set; each bounce before it changes the damage by the bounce modifier.'],
  },
  e: {
    // the blessing adds its damage to the next attacks and abilities of whoever holds it; the cast is counted as all of them landing
    hits: [{
      id: 'blessing', type: 'magic', amount: 'TotalDamage', count: 'HitCount',
      note: 'All 3 empowered hits of Tidecaller\'s Blessing are counted on the target; this is only the bonus, so add the attacks or abilities that carry it to the combo.',
    }],
  },
  r: {
    hits: [{ id: 'wave', type: 'magic', amount: 'TotalDamage' }],
  },
});
