/* Nautilus: Dredge Line's anchor (NautilusAnchorDragMissile) flies 925 at 2000 units a second and drags
   Nautilus and his target together. It is drawn as one dash at the anchor's speed, so he arrives as it hits;
   the slot spell's own range is a location limit, not the anchor's reach. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Nautilus', {
  reviewed: '16.20.1',
  sources: ['Dredge Line\'s anchor flies 925 at 2000 units a second: NautilusAnchorDragMissile in the game file.'],
  actions: {
    q: { range: 925, dash: { speed: 2000, distance: 925, direction: 'toward' } },
  },
  notes: [
    'Dredge Line\'s flight and the pull are drawn as one dash at the anchor\'s speed; the target is not pulled toward Nautilus.',
    'Depth Charge\'s shockwave has no speed in the game data: it lands when cast.',
  ],
});
