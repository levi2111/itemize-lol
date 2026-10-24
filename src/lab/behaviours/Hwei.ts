/* Hwei: each of Q, W and E opens a choice of three spells, and the slot spell is only the selector. The
   cast is the spell the model counts: Q is the "Subject: Disaster spell" option's (Devastating Fire's
   missile, Severing Bolt striking Delay after its cast, Molten Fissure's eruptions), W is Stirring Lights
   and E is Grim Visage (the three Torment spells deal the same damage). */
import { behaviour } from '../behaviour.ts';

export default behaviour('Hwei', {
  reviewed: '16.20.1',
  actions: {
    q: {
      spell: 'HweiQQ',
      variants: [
        { when: 'disaster == 2', spell: 'HweiQW', delay: 'Delay' },
        { when: 'disaster == 3', spell: 'HweiQE' },
      ],
    },
    w: { spell: 'HweiWE' },
    e: { spell: 'HweiEQ' },
  },
  notes: ['Stirring Lights do not run out here; in the game they last HweiWE\'s 9 second Duration.'],
});
