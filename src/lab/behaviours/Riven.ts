/* Riven: Broken Wings is three short dashes within a recast window, its cooldown running from the first; each
   resets the attack. Ki Burst reaches only its radius and Valor is a quick dash; both Ki Burst and Wind Slash can
   be cast during Valor (the E-W and E-R combos). R is played as the Wind Slash the model counts (RivenIzunaBlade,
   flying as RivenWindslashMissileCenter); Blade of the Exile's attack damage stays the model's option. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Riven', {
  reviewed: '16.20.1',
  sources: [
    'Broken Wings\' 4 second recast window, and its cooldown starting with the first cast, are from the League Wiki; the game data has no value for them.',
    'Each Broken Wings dash is taken to cover its 275 cast range (RivenTriCleave) within its 0.25 second cast.',
    'Ki Burst\'s reach is RivenMartyr\'s 250 radius in the game file (its range of 650 is not the burst).',
    'Valor\'s 250 dash is RivenFeint\'s cast range; its speed of 1450 is assumed (the game data has none).',
    'Wind Slash flies 1100 at 1600 units a second (RivenWindslashMissileCenter in the game file).',
  ],
  actions: {
    q: {
      dash: { speed: 275 / 0.25, distance: 275, direction: 'toward' },
      recasts: { count: 3, window: 4, cooldownFrom: 'first' },
    },
    w: { range: 250, variants: [{ during: ['e'] }] },
    e: { lock: 0, dash: { speed: 1450, distance: 250, direction: 'toward' } },
    r: { spell: 'RivenIzunaBlade', range: 1100, speed: 1600, variants: [{ during: ['e'] }] },
  },
  notes: [
    'The third Broken Wings is timed like the first two; its longer leap is not played.',
    'R is the Wind Slash: Blade of the Exile\'s attack damage follows the model\'s "Blade of the Exile active" option, not the cast.',
  ],
});
