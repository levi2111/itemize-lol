/* The Darkin Blade is three swings on one cooldown, each a cast of its own in the combo (the model counts
   which); the swings share AatroxQWrapperCast's windup and differ in reach. Umbral Dash is a dash the file
   only gives as EDashSpeed/EMaxRange, and the tooltip lets it be used while winding up his other abilities.
   World Ender's attack damage lasts RDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Aatrox', {
  reviewed: '16.20.1',
  sources: [
    'The Darkin Blade\'s reach per swing (625, 475, 200) is from the League Wiki; the game file gives the swings no range.',
    'Umbral Dash being usable while winding up other abilities is in its tooltip.',
  ],
  actions: {
    q: {
      spell: 'AatroxQWrapperCast',
      recasts: { count: 3, window: 'AatroxQ.QExtensionTime' },
      variants: [
        { cast: 1, range: 625 },
        { cast: 2, range: 475 },
        { cast: 3, range: 200 },
      ],
      notes: [
        'Each swing is one Q in the combo; the next must come within QExtensionTime of the last, and the cooldown starts after the third or when that time runs out.',
        'The third swing reaches 200 from his centre, less than his attack range: he steps in for it.',
      ],
    },
    e: {
      dash: { speed: 'EDashSpeed', distance: 'EMaxRange', direction: 'toward' },
      // woven into another windup it does not move him here: a woven dash is not played out on the floor
      variants: [{ during: ['q', 'w', 'r'] }],
    },
  },
  windows: [{ option: 'worldEnder', after: 'r', for: 'RDuration' }],
  notes: ['Umbral Dash woven into a windup keeps him where he stands; only a dash cast on its own moves him.'],
});
