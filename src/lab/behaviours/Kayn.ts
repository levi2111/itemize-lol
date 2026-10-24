/* Kayn: Reaping Slash is a dash, then a spin. The Shadow Assassin's Blade's Reach is cast by his shadow
   (KaynAssW, longer): he can keep moving, and it strikes after its cast. Umbral Trespass needs a champion he
   has damaged in the last 3.15 seconds (hook); he dives into the target, stays InfestDuration and bursts
   out, with the Shadow Assassin's longer AssCastRange. */
import { behaviour } from '../behaviour.ts';

/** Umbral Trespass's mark, "marked for 3.15 seconds" in its tooltip. */
const MARK = 3.15;

export default behaviour('Kayn', {
  reviewed: '16.20.1',
  sources: [
    'Reaping Slash has no dash speed in the game data: 1200 units a second over its 350 cast range is an assumption.',
    'The shadow\'s Blade\'s Reach strikes after KaynAssW\'s 0.6 second cast (game file).',
  ],
  actions: {
    q: { dash: { speed: 1200, distance: 350, direction: 'toward' } },
    w: { variants: [{ when: 'shadow', spell: 'KaynAssW', lock: 0, delay: 0.6 }] },
    r: {
      lock: 'InfestDuration',
      dash: { speed: 'BaseCastRange / MinimumInfestTime', distance: 'AssCastRange', direction: 'toward' },
      variants: [{ when: 'shadow', range: 'AssCastRange' }],
    },
  },
  hooks: {
    canStart(c) {
      if (c.action !== 'r') return true;
      if (c.state.hitAt !== undefined && c.t - c.state.hitAt <= MARK) return true;
      c.note('Umbral Trespass waits for a champion Kayn has damaged in the last 3.15 seconds.');
      return false;
    },
    onLand(c) {
      if (c.action !== 'e') c.state.hitAt = c.t;
    },
  },
  notes: [
    'Umbral Trespass is held for its whole InfestDuration, as when it is not recast; the dive in is drawn over MinimumInfestTime and he bursts out beside the target.',
  ],
});
