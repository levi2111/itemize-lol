/* Rell: Shattering Strike's slot spell has a direction limit for its range; the thrust reaches 600. In her
   armored form (the model's `armored`) W is Mount Up (RellW_MountUp), which resets her attack for the flip.
   Magnet Storm pulls from InitialRadius. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Rell', {
  reviewed: '16.20.1',
  sources: ['Shattering Strike reaches 600: RellQ\'s displayed cast range in the game file.'],
  actions: {
    q: { range: 600 },
    // Mount Up empowers her next attack: cast it in attack range (175, edge to edge, plus her 65 radius)
    w: { variants: [{ when: 'armored', spell: 'RellW_MountUp', range: 175 + 65 }] },
    r: { range: 'InitialRadius' },
  },
  notes: ['Crash Down\'s leap is not drawn: Rell casts it from its range.'],
});
