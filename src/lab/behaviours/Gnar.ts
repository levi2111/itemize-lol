/* Gnar: the form is the model's `mega` option, and each Mega Gnar ability is a spell object of its own. Boulder
   Toss and Boomerang Throw are timed by their missiles (the slot spells carry a placeholder range); Mini Gnar's
   W is a passive with nothing to cast, and GNAR! is Mega Gnar's only and centred on him. Hop and Crunch are
   jumps that take TravelTime; Hop's attack speed lasts MiniASDuration, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Gnar', {
  reviewed: '16.20.1',
  attack: { variants: [{ when: 'mega', missileSpeed: 0 }] },
  actions: {
    q: { spell: 'GnarQMissile', variants: [{ when: 'mega', spell: 'GnarBigQMissile' }] },
    w: { spell: 'GnarBigW', range: 'GnarW.MegaLength', requires: 'mega' },
    e: {
      dash: { speed: 'MiniRange / TravelTime', distance: 'MiniRange', direction: 'toward' },
      variants: [{ when: 'mega', spell: 'GnarBigE', dash: { speed: 'GnarE.MegaRange / GnarE.TravelTime', distance: 'GnarE.MegaRange', direction: 'toward' } }],
    },
    r: { range: 'RAoESize', requires: 'mega' },
  },
  windows: [{ option: 'hop', after: 'e', for: 'MiniASDuration' }],
  notes: [
    'Mega Gnar\'s attacks have no projectile, but keep Mini Gnar\'s attack range here.',
    'Hop lands on the target; its bounce beyond it is not drawn.',
  ],
});
