/* Renata: with no ally in the lab, Bailout is cast on herself, and its attack speed (the model's "bailout")
   lasts its Duration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Renata', {
  reviewed: '16.20.1',
  actions: {
    // a buff on herself with nothing to reach: it can be cast anywhere
    w: { range: 20000 },
  },
  windows: [{ option: 'bailout', after: 'w', for: 'Duration' }],
});
