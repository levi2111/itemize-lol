/* Pillar of Flame erupts a moment after it is cast. Conflagration is a targeted blast that lands at once;
   the BrandEMissile the file pairs with it by name is the spread to nearby enemies. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Brand', {
  reviewed: '16.20.1',
  sources: ['Pillar of Flame\'s 0.625 s delay before it erupts is from the League Wiki; the game data has no value for it.'],
  actions: {
    w: { delay: 0.625 },
    e: { speed: 0 },
  },
  notes: ['Pyroclasm\'s bounces land together with its first hit.'],
});
