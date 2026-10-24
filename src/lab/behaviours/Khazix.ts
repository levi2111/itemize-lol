/* Kha'Zix: Leap is a jump onto the target. Void Assault is instant and cast NumberOfCasts times within
   RecastWindow, at least RecastCD apart, its cooldown starting after the last. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Khazix', {
  reviewed: '16.20.1',
  sources: ['Leap has no speed in the game data: 1400 units a second over its 700 cast range is an assumption.'],
  actions: {
    e: { dash: { speed: 1400, distance: 700, direction: 'toward' } },
    r: { lock: 0, recasts: { count: 'NumberOfCasts', window: 'RecastWindow', gap: 'RecastCD' } },
  },
  notes: ['Evolutions are not played: Leap keeps its base range and Void Assault its two casts.'],
});
