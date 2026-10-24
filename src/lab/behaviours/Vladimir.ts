/* Vladimir: Tides of Blood charges for TimetoRampMaxDamage (the full-charge damage the model counts; the game
   file's cast time is a placeholder for the charge), and Transfusion and Hemoplague can be cast while it charges.
   Sanguine Pool holds him in the pool for its 2 seconds: no attacks, no other casts. Hemoplague bursts when it
   expires, Duration after the cast; until then the timeline keeps the plague's damage increase on the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Vladimir', {
  reviewed: '16.20.1',
  sources: [
    'Sanguine Pool lasting 2 seconds, and Vladimir being unable to attack or cast in it, are in its tooltip; with the 0.25 second cast that leaves a 1.75 second channel.',
    'The pool reaches 350 around him (VladimirSanguinePool\'s displayed range in the game file; its cast range of 1050 is not the pool).',
    'Casting Transfusion while charging Tides of Blood is from the League Wiki; Hemoplague is taken to work the same way.',
  ],
  actions: {
    w: { range: 350, channel: 2 - 0.25 },
    e: { lock: 'TimetoRampMaxDamage', allows: ['q', 'r'] },
    // the burst lands when the plague expires; rTimed stops the model keeping the plague up for the rest of the fight
    r: { delay: 'Duration', variants: [{ options: { rTimed: 1 } }] },
  },
  windows: [{ option: 'plagued', after: 'r', for: 'Duration' }],
  notes: [
    'Tides of Blood is held to full charge while standing; he can really walk while charging.',
    'Sanguine Pool cast while charging Tides of Blood (which keeps the charge) is not played.',
  ],
});
