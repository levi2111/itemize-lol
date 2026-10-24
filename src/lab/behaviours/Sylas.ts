/* Sylas: Chain Lash's chains land as they are thrown and its explosion, most of its damage, DetonationDelay
   later. Kingslayer lunges onto the target. One E is Abscond and Abduct together, as the model counts it: played as
   Abduct (SylasE2), the chain thrown when its cast ends and pulling him to the target (a dash of his own, not a
   pull of the target), which resets his attack. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Sylas', {
  reviewed: '16.20.1',
  sources: [
    'Kingslayer\'s 400 reach is from the League Wiki; its lunge speed of 1500 is assumed (the game data has neither).',
    'Abduct\'s pull is drawn at the chain\'s 2500 units a second (SylasE2) over its 850 cast range.',
  ],
  actions: {
    q: { speed: 0, hitDelays: { explosion: 'DetonationDelay' } },
    w: { range: 400, dash: { speed: 1500, distance: 400, direction: 'toward' } },
    e: { spell: 'SylasE2', dash: { speed: 2500, distance: 850, direction: 'toward', afterLock: true } },
  },
  notes: ['Abscond, the first dash of E, is not played.'],
});
