/* Shaco: Deceive is a blink onto the target, over in its PseudoCastTime. Jack in the Box fires once armed,
   ArmTime after it lands. Hallucinate's clone fights beside him for CloneLifetime, which the timeline keeps. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Shaco', {
  reviewed: '16.20.1',
  sources: ['Deceive\'s 400 blink is its cast range in the game file; the blink is drawn as covering it within PseudoCastTime.'],
  actions: {
    q: { lock: 'PseudoCastTime', dash: { speed: '400 / PseudoCastTime', distance: 400, direction: 'toward' } },
    w: { delay: 'ArmTime' },
  },
  windows: [{ option: 'clone', after: 'r', for: 'CloneLifetime' }],
  notes: [
    'Jack in the Box is counted as placed at the target, firing as soon as it arms.',
    'Hallucinate\'s explosion and mini boxes land with the cast, though the clone fights on beside Shaco.',
  ],
});
