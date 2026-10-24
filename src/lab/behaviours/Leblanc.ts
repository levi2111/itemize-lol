/* LeBlanc: Distortion is a dash of SpellMaxRange that deals its damage where she lands; Ethereal Chains' slot
   spell has a 10000 cast range, the chain is LeblancEMissile. Mimic casts the copy of whichever ability the
   model's "mimicked" says (1 Q, 2 W, 3 E), each a spell object of its own. */
import { behaviour } from '../behaviour.ts';

const DISTORTION = { speed: 1450, distance: 'LeblancW.SpellMaxRange', direction: 'toward' as const };

export default behaviour('Leblanc', {
  reviewed: '16.20.1',
  sources: ['Distortion\'s dash speed of 1450 is from the League Wiki; the game data has none.'],
  actions: {
    w: { dash: DISTORTION },
    e: { spell: 'LeblancEMissile' },
    r: {
      spell: 'LeblancRQ',
      variants: [
        { when: 'mimicked == 2', spell: 'LeblancRW', dash: DISTORTION },
        { when: 'mimicked == 3', spell: 'LeblancREMissile' },
      ],
    },
  },
  hooks: {
    // the model learns which ability Mimic copies when that ability lands, so Mimic waits for it
    canStart(c) {
      if (c.action !== 'r' || !c.state.flying) return true;
      c.note('Mimic waits for the ability it copies to land.');
      return false;
    },
    onStart(c) { if (c.action === 'q' || c.action === 'w' || c.action === 'e') c.state.flying = 1; },
    onLand(c) { if (c.action === 'q' || c.action === 'w' || c.action === 'e') c.state.flying = 0; },
  },
  notes: [
    'Ethereal Chains\' root damage lands with the chain rather than when the tether holds, 1.5 seconds later.',
    'Distortion\'s return is not cast.',
  ],
});
