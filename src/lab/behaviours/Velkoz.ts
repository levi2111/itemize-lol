/* Vel'Koz: Plasma Fission reaches as far as VelkozQMissile flies. Void Rift holds two charges, its own cooldown
   being only the wait between casts (a hook). Tectonic Disruption erupts after a delay, taken at its longest.
   Life Form Disintegration Ray is channelled. */
import { behaviour } from '../behaviour.ts';

/** VelkozW's cooldown in the game data: the time between two casts */
const BETWEEN = 1.5;

export default behaviour('Velkoz', {
  reviewed: '16.20.1',
  sources: [
    'Plasma Fission\'s reach of 1100 is VelkozQMissile\'s range in the game file.',
    'Void Rift\'s 2 charges are in its tooltip; they come back every 18 seconds at rank 1 down to 14 at rank 5 (VelkozW\'s ammoRecharge in the game file), cut by ability haste.',
    'The ray\'s 2.5 second channel is in its tooltip, as in the damage model.',
  ],
  actions: {
    q: { range: 1100 },
    w: { charges: { count: 2, recharge: '(19 - rank) * 100 / (100 + abilityHaste)' } },
    e: { speed: 0, delay: 'MaxDetonationTime' },
    r: { channel: 2.5 },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'w') c.setReadyAt('w', c.t + BETWEEN);
    },
  },
  notes: ['Tectonic Disruption is taken to erupt after MaxDetonationTime; closer to Vel\'Koz it erupts sooner, from MinDetonationTime.'],
});
