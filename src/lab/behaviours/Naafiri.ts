/* Naafiri: the game files keep the two swapped abilities under their old ids, so the W slot (The Call of the
   Pack) reads NaafiriR and the R slot (Hounds' Pursuit) reads NaafiriW. Darkin Daggers is two casts: the
   recast (NaafiriQRecast) within RecastWindow, at least RecastLockout after the first; the model's qCast
   option lets each cast count its own dagger. The Call of the Pack is a self-cast whose attack damage and extra
   Packmates (the model's "hunt") last its Duration. Hounds' Pursuit is a dash onto the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Naafiri', {
  reviewed: '16.20.1',
  sources: ['Hounds\' Pursuit dashes up to its 900 cast range (NaafiriW in the game file) at its DashSpeed.'],
  actions: {
    q: {
      recasts: { count: 2, window: 'RecastWindow', gap: 'RecastLockout' },
      variants: [
        { cast: 1, options: { qCast: 1 } },
        { cast: 2, spell: 'NaafiriQRecast', options: { qCast: 2 } },
      ],
    },
    // a buff on herself with nothing to reach: it can be cast anywhere
    w: { range: 20000 },
    r: { dash: { speed: 'DashSpeed', distance: 900, direction: 'toward' } },
  },
  windows: [{ option: 'hunt', after: 'w', for: 'Duration' }],
  notes: [
    'The first dagger\'s bleed is counted whole when it hits; the recast\'s cashing in of what is left is not drawn.',
    'Hounds\' Pursuit\'s recast after a takedown is not played.',
  ],
});
