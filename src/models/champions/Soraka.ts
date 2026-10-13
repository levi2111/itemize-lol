import { champion } from '../dsl.ts';

export default champion('Soraka', {
  reviewed: '16.20.1',
  // Salvation only grants move speed
  p: {},
  q: {
    hits: [{ id: 'star', type: 'magic', amount: 'TotalDamage' }],
  },
  // Astral Infusion only heals an ally
  w: {},
  e: {
    hits: [
      { id: 'field', label: 'Starfield landing', type: 'magic', amount: 'TotalDamage' },
      // the same amount again when the zone disappears, if the target is still inside
      { id: 'erupt', label: 'Starfield eruption', type: 'magic', amount: 'TotalDamage', note: 'Both hits of Equinox are counted: the target is assumed to still be in the zone when it disappears.' },
    ],
  },
  // Wish only heals
  r: {},
});
