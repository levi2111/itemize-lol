/* Rakan: Gleaming Quill's feather flies as RakanQMis. Grand Entrance is a dash at BaseDashSpeed, then the
   spiral into the air (RakanWCast), whose knock-up is the damage. The Quickness is a sprint that deals its
   damage when he first touches the target: drawn as a dash at his sped-up move speed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Rakan', {
  reviewed: '16.20.1',
  sources: [
    'The feather flies at 1850 units a second: RakanQMis in the game file.',
    'Grand Entrance dashes up to its 650 cast range (RakanW); the spiral after it takes 0.35 seconds (RakanWCast\'s cast time). Both from the game file.',
  ],
  actions: {
    q: { speed: 1850 },
    // the sprint: he runs into the target at his move speed raised by InitialCastSpeed, for up to Duration
    r: { dash: { speed: 'moveSpeed * (1 + InitialCastSpeed / 100)', distance: 'moveSpeed * (1 + InitialCastSpeed / 100) * Duration', direction: 'toward' } },
    w: { dash: { speed: 'BaseDashSpeed', distance: 650, direction: 'toward' }, channel: 0.35, delay: 0.35 },
  },
  notes: ['The Quickness\'s speed is counted at its InitialCastSpeed throughout; the extra speed from touching a champion is not.'],
});
