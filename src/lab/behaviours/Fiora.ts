/* Fiora: Lunge is a short dash and stab whose game file gives a negative cast time (read here as the lunge's
   0.375 seconds) and no distance; a stab that hits halves its cooldown. Riposte parries for its duration, then
   stabs out to its displayed range. Bladework is an instant attack reset whose attack speed lasts for the next
   two attacks, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

/** FioraQ.CDRefundPercent */
const REFUND = 0.5;

export default behaviour('Fiora', {
  reviewed: '16.20.1',
  sources: [
    'Lunge\'s 400 unit dash is from the League wiki; its 0.375 seconds are the game file\'s castTime (-0.375).',
    'Riposte\'s 750 reach is its castRangeDisplayOverride in the game file (its castRange is 3000).',
  ],
  actions: {
    q: { lock: 0.375, dash: { speed: '400 / 0.375', distance: 400, direction: 'toward' } },
    w: { lock: 'ParryDuration', range: 750 },
    // a buff on the next two attacks: cast it once in attack range (150, edge to edge, plus her 65 radius)
    e: { lock: 0, range: 150 + 65 },
  },
  windows: [{ option: 'bladework', after: 'e', for: 'BuffDuration' }],
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.state.qAt = c.t;
      if (c.action === 'e') c.state.blade = 2;
    },
    onLand(c) {
      if (c.action === 'q') c.setReadyAt('q', c.state.qAt! + (c.readyAt('q') - c.state.qAt!) * (1 - REFUND));
      // Bladework's attack speed ends with its second attack
      if (c.action === 'aa' && c.state.blade) {
        c.state.blade--;
        if (!c.state.blade) c.setOption('bladework', 0);
      }
    },
  },
  notes: [
    'Lunge is counted as striking the target, so its cooldown is always halved.',
    'Bladework\'s attack speed lasts for its two attacks or its duration, whichever ends first.',
  ],
});
