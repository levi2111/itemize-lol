/* Sona: a song puts her other two on BaseGlobalCD. */
import { behaviour } from '../behaviour.ts';

const SONGS = ['q', 'w', 'e'] as const;

export default behaviour('Sona', {
  reviewed: '16.20.1',
  hooks: {
    onStart(c) {
      if (!(SONGS as readonly string[]).includes(c.action)) return;
      const global = c.value('BaseGlobalCD');
      for (const s of SONGS) if (s !== c.action) c.setReadyAt(s, Math.max(c.readyAt(s), c.t + global));
    },
  },
});
