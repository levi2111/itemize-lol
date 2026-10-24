/* Spell Thief casts only what Zoe has picked up: a summoner spell or an item active dropped in the fight.
   The game file gives it a quarter-second cooldown and a one-second channel, which would let a fight use it
   over and over; the lab uses it once. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Zoe', {
  reviewed: '16.20.1',
  // a single charge that does not come back within a fight
  actions: { w: { charges: { count: 1, recharge: 1000 } } },
  notes: ['Spell Thief is used once a fight: what it casts depends on spells picked up, which the lab does not model.'],
});
