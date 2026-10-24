/* Vex: Personal Space's shockwave reaches AOERadius around her, not the slot spell's 750 radius. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Vex', {
  reviewed: '16.20.1',
  actions: {
    w: { range: 'AOERadius' },
  },
  notes: [
    'Mistral Bolt flies at its starting 600 units a second all the way: the faster wave it becomes after a delay has no speed in the game data.',
    'Shadow Surge\'s recast dash lands with the shadow here and does not move her.',
  ],
});
