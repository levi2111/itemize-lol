/* Kassadin: Nether Blade is an instant attack reset whose charged attack is the next one in the combo. Force
   Pulse is a cone, and every ability used near him takes ReductionPerSpellCast off its cooldown (hook; his
   own casts are the ones counted). Riftwalk is a teleport onto the target, drawn as a dash over its cast. */
import { behaviour } from '../behaviour.ts';

/** ForcePulse.ReductionPerSpellCast. */
const PULSE_CUT = 0.75;

export default behaviour('Kassadin', {
  reviewed: '16.20.1',
  sources: [
    'Force Pulse\'s 600 unit cone is from the League wiki; the game file has only its 350 radius.',
    'Riftwalk is drawn over RiftWalk\'s 0.25 second cast in the game file.',
  ],
  actions: {
    // a buff on the next attack: cast it in attack range (150, edge to edge, plus his 65 radius)
    w: { lock: 0, range: 150 + 65 },
    e: { range: 600 },
    r: { dash: { speed: 'CastRange / 0.25', distance: 'CastRange', direction: 'toward' } },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'q' || c.action === 'w' || c.action === 'r') c.setReadyAt('e', Math.max(c.t, c.readyAt('e') - PULSE_CUT));
    },
  },
  notes: ['Abilities other champions use near Kassadin, which also shorten Force Pulse\'s cooldown, are not counted.'],
});
