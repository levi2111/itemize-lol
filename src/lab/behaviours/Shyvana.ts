/* Shyvana: each attack takes Cooldown_Reduction off Emberstrike's cooldown. Inferno Aegis is instant and is
   counted as detonated at once. In Dragon Form Molten Burst is ShyvanaEDragon, longer and faster. Dragon's
   Descent is a flight onto the target; it needs full Dragon Fury, which the model does not track, so it is cast
   once a fight (its cooldown in the game file is 0). */
import { behaviour } from '../behaviour.ts';

/** ShyvanaQ.Cooldown_Reduction */
const PER_ATTACK = 0.5;

export default behaviour('Shyvana', {
  reviewed: '16.20.1',
  sources: ['Dragon\'s Descent has no flight speed in the game data: 1100 units a second over its 1050 cast range is an assumption.'],
  actions: {
    // a buff on the next attacks: cast it in attack range (150, edge to edge, plus her 65 radius)
    q: { range: 150 + 65 },
    w: { lock: 0 },
    e: { variants: [{ when: 'inDragon', spell: 'ShyvanaEDragon' }] },
    r: { dash: { speed: 1100, distance: 1050, direction: 'toward' } },
  },
  hooks: {
    canStart(c) {
      if (c.action !== 'r' || !c.state.descended) return true;
      c.note('Dragon\'s Descent needs full Dragon Fury: it is cast once a fight here.');
      return false;
    },
    onStart(c) { if (c.action === 'r') c.state.descended = 1; },
    onLand(c) {
      if (c.action === 'aa') c.setReadyAt('q', Math.max(c.t, c.readyAt('q') - PER_ATTACK));
    },
  },
  notes: ['One Emberstrike is the cast and its recast together, as the model counts it.'],
});
