/* The W-Q combo: Pulverize can be cast while Headbutt is still carrying Alistar to the target, so the
   knock-up lands as he arrives without waiting for the ram to end. Trample hits within its Radius, not the
   cast spell's larger one, and Unbreakable Will is a self-cast the file gives a range of 1. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Alistar', {
  reviewed: '16.20.1',
  actions: {
    q: { variants: [{ during: ['w'] }] },
    e: { range: 'Radius' },
    r: { range: 25000 },
  },
  notes: ['Headbutt is its cast time in the game file; Alistar does not move with it and the knock back is not modeled.'],
});
