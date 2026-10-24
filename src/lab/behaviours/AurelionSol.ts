/* Breath of Light is a channel lasting the model's qSeconds. Falling Star is not a projectile from Aurelion
   Sol (the cast spell's missile speed is his flight's): the star lands a fixed time after the cast, as
   AurelionSolRMissile, or AurelionSolR2Missile for The Skies Descend. */
import { behaviour } from '../behaviour.ts';

export default behaviour('AurelionSol', {
  reviewed: '16.20.1',
  sources: ['Falling Star lands 1.25 s and The Skies Descend 2 s after the cast: the fixed travel times of AurelionSolRMissile and AurelionSolR2Missile in the game file.'],
  actions: {
    q: { channel: 'qSeconds' },
    r: {
      speed: 0, delay: 1.25,
      variants: [{ when: 'skies', delay: 2 }],
    },
  },
  notes: ['Astral Flight is not played out: Breath of Light during it is the model\'s "flying" option.'],
});
