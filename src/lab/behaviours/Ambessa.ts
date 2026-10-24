/* Ambessa's Q in the model is both Cunning Sweep and Sundering Slam, so its lock is the sweep, the swap
   cooldown before the slam can be cast, and the slam. Repudiation braces for Buff_Duration before it slams;
   Public Execution suppresses for Suppress_Duration before the slam that deals its damage. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ambessa', {
  reviewed: '16.20.1',
  sources: [
    'Sundering Slam\'s 0.25 s cast is AmbessaQ2\'s cast time in the game file, which a formula cannot read.',
    'Repudiation\'s reach of 325 is AmbessaW\'s cast range in the game file; the timeline would otherwise take its radius of 100.',
  ],
  actions: {
    q: { spell: 'AmbessaQ1', lock: 'AmbessaQ.Swap_Static_Cooldown + 0.25' },
    w: { range: 325, delay: 'Buff_Duration' },
    r: { delay: 'Suppress_Duration', channel: 'Suppress_Duration' },
  },
  notes: [
    'Drakehound\'s Step, the short dash after each ability, is not played out: Ambessa stays where she cast.',
    'Public Execution\'s blink is not played out: she casts it from where she stands.',
  ],
});
