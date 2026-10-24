/* Bandage Toss holds two charges and pulls Amumu to the target at DashSpeed. Its recharge and the short
   static cooldown between casts are in the game file (mAmmoRechargeTime, the fixed 3 s cooldown) but not in
   any value a formula reads, so they are written out here. */
import { behaviour } from '../behaviour.ts';

/** BandageToss's cooldown in the game data: the wait between two charges, not reduced by haste */
const STATIC = 3;

export default behaviour('Amumu', {
  reviewed: '16.20.1',
  sources: [
    'Two charges: Bandage Toss\'s tooltip.',
    'Recharge 16/15/14/13/12 s: BandageToss\'s ammo recharge in the game file (timing.ammoRecharge).',
    'The pull\'s reach of 1100 is BandageToss\'s cast range in the game file.',
  ],
  actions: {
    q: {
      dash: { speed: 'DashSpeed', distance: 1100, direction: 'toward' },
      charges: { count: 2, recharge: '(17 - rank) * 100 / (100 + abilityHaste)' },
    },
  },
  hooks: {
    // charges hold no wait between casts of their own
    onStart(c) { if (c.action === 'q') c.setReadyAt('q', c.t + STATIC); },
  },
  notes: ['Bandage Toss pulls Amumu from the moment it is cast; the bandage\'s own flight before the pull is not timed, and its damage lands when he arrives.'],
});
