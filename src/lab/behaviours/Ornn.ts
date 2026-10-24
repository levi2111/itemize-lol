/* Ornn: Bellows Breath holds him for BreathDuration while he stomps forward breathing fire over its
   RectangleLength, its last bout leaving Brittle. Call of the Forge God is two casts: the elemental coming in,
   then his headbutt (OrnnRCharge) sending it back through the target (OrnnRWave2); the model's rCast option
   lets each cast count its own pass. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ornn', {
  reviewed: '16.20.1',
  sources: [
    'The elemental sent back flies at 1650 units a second: OrnnRWave2 in the game file.',
    'The game data has no timing for the elemental\'s run toward Ornn: the headbutt one second after the summon, and a window of three seconds for it, are assumptions.',
  ],
  actions: {
    w: { range: 'RectangleLength', channel: 'BreathDuration', delay: 'BreathDuration' },
    r: {
      recasts: { count: 2, window: 3, gap: 1 },
      variants: [
        { cast: 1, options: { rCast: 1 } },
        { cast: 2, spell: 'OrnnRCharge', speed: 1650, range: 'OrnnR.RCastRange', options: { rCast: 2 } },
      ],
    },
  },
  notes: [
    'The elemental is counted as summoned just behind the target, so its first pass hits as it is cast.',
    'Searing Charge is drawn stopping at the target; whether it meets terrain is the model\'s option.',
  ],
});
