/* Viego: Harrowed Path's mist is counted as around him for MistDuration (the model's "mist" attack speed).
   Heartbreaker is a blink onto the target after ViegoRCast's cast, from within its range. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Viego', {
  reviewed: '16.20.1',
  sources: ['Heartbreaker\'s 0.25 second cast is ViegoRCast\'s in the game file; the blink is taken to cover its 500 range within it.'],
  actions: {
    // out of its 500 range (from his centre, he has a 65 radius) he walks in first
    r: { lock: 0.25, dash: { speed: 500 / 0.25, distance: 500, direction: 'toward' }, variants: [{ beyond: 500 - 65, dash: null }] },
  },
  windows: [{ option: 'mist', after: 'e', for: 'MistDuration' }],
  notes: ['Viego is counted as staying in Harrowed Path\'s mist for its whole duration.'],
});
