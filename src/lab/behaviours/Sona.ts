/* Sona: a song puts her other two on BaseGlobalCD. Aria of Perseverance has no cooldown in the game data; its 10
   seconds are played as a single charge recharging that long, shortened by ability haste. */
import { behaviour } from '../behaviour.ts';

/** BaseGlobalCD of SonaQ, SonaW and SonaE */
const GLOBAL = 0.5;
const SONGS = ['q', 'w', 'e'] as const;

export default behaviour('Sona', {
  reviewed: '16.20.1',
  sources: ['Aria of Perseverance\'s 10 second cooldown is from the League Wiki; the game data has none.'],
  actions: {
    w: { charges: { count: 1, recharge: '10 * 100 / (100 + abilityHaste)' } },
  },
  hooks: {
    onStart(c) {
      if (!(SONGS as readonly string[]).includes(c.action)) return;
      for (const s of SONGS) if (s !== c.action) c.setReadyAt(s, Math.max(c.readyAt(s), c.t + GLOBAL));
    },
  },
});
