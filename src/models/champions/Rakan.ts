import { champion } from '../dsl.ts';

export default champion('Rakan', {
  reviewed: '16.20.1',
  // Fey Feathers only shields
  p: {},
  q: {
    hits: [{ id: 'quill', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'entrance', type: 'magic', amount: 'TotalDamage' }],
  },
  // Battle Dance only shields an ally
  e: {},
  r: {
    // the touch damages each enemy once per cast, however long the sprint lasts
    hits: [{ id: 'touch', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
});
