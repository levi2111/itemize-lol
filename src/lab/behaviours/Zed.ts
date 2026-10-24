/* Zed: Death Mark makes him untargetable and puts him beside the target, so it is a blink of ZedR's 625 range that
   arrives as the cast ends. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Zed', {
  reviewed: '16.20.1',
  sources: ['Death Mark reaches ZedR\'s 625 range and its 0.25 second cast in the game file.'],
  actions: {
    r: { dash: { speed: 625 / 0.25, distance: 625, direction: 'toward' } },
  },
  notes: [
    'Swapping places with a shadow (the recasts of Living Shadow and Death Mark) is not played.',
    'Death Mark\'s detonation is not timed apart: the model adds its share to each hit while the mark lasts.',
  ],
});
