/* Precision Protocol is two empowered attacks: the first cast, and a recast (CamilleQ2) within
   QTotalRecastTime that is empowered when it comes QRampUpTime after the first. The model counts both in one
   Q; its "qCast" option lets each cast here count its own attack. Each cast is itself the attack it
   empowers, so it does not hand out a further attack the way a reset would. Tactical Sweep slices after
   ChargeDuration. Hookshot's recast is a dash at DashSpeed, twice as far towards a champion, and its attack
   speed lasts ASDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Camille', {
  reviewed: '16.20.1',
  actions: {
    q: {
      resetsAttack: false,
      recasts: { count: 2, window: 'QTotalRecastTime', gap: 'QRampUpTime' },
      variants: [
        { cast: 1, options: { qCast: 1 } },
        { cast: 2, spell: 'CamilleQ2', resetsAttack: false, options: { qCast: 2 } },
      ],
    },
    w: { delay: 'ChargeDuration' },
    e: { dash: { speed: 'DashSpeed', distance: 'E2LongDashRange', direction: 'toward' } },
  },
  windows: [{ option: 'hookshot', after: 'e', for: 'ASDuration' }],
  notes: [
    'The recast of Precision Protocol waits the ramp-up time, so it is always the empowered one.',
    'Hookshot\'s first cast and the pull to the wall are not timed: the dash is the recast.',
    'The Hextech Ultimatum\'s leap is not played out: Camille casts it from its range.',
  ],
});
