/* Pyke: Bone Skewer is a stab when tapped (PykeQMelee) and a thrown harpoon when held (PykeQRange): held for
   ChargeTimeToGetMaxRange it reaches MaxRangeDistance, and pulls the target PullDistance toward him. Ghostwater Dive is instant (the game file gives it no
   cast time). Phantom Undertow dashes through the target, and the phantom left behind returns to him,
   hitting it, StunDelay later. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Pyke', {
  reviewed: '16.20.1',
  sources: [
    'The held harpoon\'s 0.2 second throw is PykeQRange\'s cast time in the game file. The stab\'s reach of 400 is an assumption; the game data has none.',
    'Phantom Undertow has no dash speed in the game data: 1500 units a second is an assumption.',
  ],
  actions: {
    q: {
      spell: 'PykeQRange', lock: 'PykeQ.ChargeTimeToGetMaxRange + 0.2', range: 'PykeQ.MaxRangeDistance', pull: 'PykeQ.PullDistance',
      variants: [{ within: 400 - 65, spell: 'PykeQMelee', range: 400, speed: 0 }],
    },
    w: { lock: 0 },
    e: { dash: { speed: 1500, distance: 'DashDistance', direction: 'through' }, delay: 'StunDelay' },
  },
  notes: [
    'The held harpoon is charged to its full range, then thrown with PykeQRange\'s 0.2 second cast.',
    'Death From Below\'s recast after a kill is not played.',
  ],
});
