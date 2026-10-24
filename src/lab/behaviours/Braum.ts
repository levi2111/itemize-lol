/* Glacial Fissure's cast spell (BraumRWrapper) has no missile of its own; the fissure is BraumRMissile. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Braum', {
  reviewed: '16.20.1',
  sources: ['The fissure\'s speed of 1400 is BraumRMissile\'s missile speed in the game file.'],
  actions: {
    r: { speed: 1400 },
  },
});
