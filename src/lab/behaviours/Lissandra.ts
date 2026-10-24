/* Lissandra: Ice Shard's slot spell has a 10000 cast range; the shard is LissandraQMissile. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Lissandra', {
  reviewed: '16.20.1',
  actions: { q: { spell: 'LissandraQMissile' } },
  notes: ['Glacial Path\'s recast, the teleport to the claw, is not cast.'],
});
