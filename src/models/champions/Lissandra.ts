import { champion } from '../dsl.ts';

export default champion('Lissandra', {
  reviewed: '16.20.1',
  options: {
    thralls: { label: 'Frozen thralls that shatter next to the target', kind: 'int', default: 0, min: 0 },
  },
  counters: { shattered: {} },
  p: {
    rules: [
      // a thrall rises from another enemy that died, so it is the user's to count; dealt once per fight
      {
        id: 'thrall', label: 'Frozen thrall', on: 'after', when: 'thralls > 0 && !shattered', type: 'magic',
        amount: 'TotalDamage', count: 'thralls', then: 'shattered = 1',
      },
    ],
    notes: ['Frozen thralls rise from other enemy champions that died nearby; none is counted unless "Frozen thralls that shatter next to the target" is set.'],
  },
  q: {
    // the spear and the shards behind it are one damage instance per enemy
    hits: [{ id: 'shard', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'ring', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    // the claw passes through an enemy once; the recast only teleports
    hits: [{ id: 'claw', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    // the spreading ice damages an enemy once per cast, on an enemy cast and a self cast alike
    hits: [{ id: 'tomb', type: 'magic', amount: 'CalculatedDamage' }],
  },
});
