/* Diana: Crescent Strike's damage comes from its arcing missile; Pale Cascade is an instant self-cast whose
   spheres only hit what is next to her; Lunar Rush is a dash that comes back almost at once on a target marked
   with Moonlight; Moonfall's explosion waits for its delay. Moonsilver Blade's tripled attack speed is a buff
   for a few seconds after each ability, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

/** Seconds Moonlight lasts (DianaQ.MoonlightDuration) and Lunar Rush's cooldown after a reset (DianaTeleport.CDResetTime). */
const MOONLIGHT = 3, RESET = 0.25;
const afterAbility = (after: 'q' | 'w' | 'e' | 'r') => ({ option: 'afterAbility', after, for: 'DianaPassive.BuffDuration' });

export default behaviour('Diana', {
  reviewed: '16.20.1',
  sources: [
    'Lunar Rush has no dash speed in the game data; 2500 units a second is an assumption.',
    'The spheres of Pale Cascade orbit about 200 units from Diana (an approximation); the game file\'s 1000 radius is the shield\'s.',
  ],
  actions: {
    q: { spell: 'DianaQOuterMissile' },
    w: { lock: 0, range: 200, speed: 0 },
    e: { dash: { speed: 2500, distance: 825, direction: 'toward' } },
    r: { delay: 'Delay' },
  },
  windows: [afterAbility('q'), afterAbility('w'), afterAbility('e'), afterAbility('r')],
  hooks: {
    onStart(c) {
      // the tripled attack speed is only there after an ability
      if (!c.state.begun) { c.state.begun = 1; c.setOption('afterAbility', 0); }
    },
    onLand(c) {
      if (c.action === 'q') c.state.moonlight = c.t + MOONLIGHT;
      // Lunar Rush onto a target with Moonlight consumes it and is ready again
      if (c.action === 'e' && c.t <= (c.state.moonlight ?? -1)) {
        c.state.moonlight = -1;
        c.setReadyAt('e', c.t + RESET);
      }
    },
  },
  notes: [
    'Lunar Rush is ready again right after landing on a target Crescent Strike marked with Moonlight in the last 3 seconds.',
    'Moonsilver Blade\'s attack speed is tripled for its duration after each ability and plain before the first.',
  ],
});
