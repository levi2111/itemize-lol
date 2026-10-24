/* Leona: Shield of Daybreak is an instant buff on her next attack, which it resets. Eclipse detonates when it
   ends, ArmorMRDuration after the cast. Zenith Blade's blade (LeonaZenithBladeMissile) pulls her to the first
   champion it hits: drawn as one dash at the blade's speed, so she arrives as it lands. Solar Flare strikes
   after a delay. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Leona', {
  reviewed: '16.20.1',
  sources: [
    'Zenith Blade\'s blade flies 900 at 2000 units a second: LeonaZenithBladeMissile in the game file.',
    'Solar Flare landing 0.625 seconds after its cast is from the League Wiki; the game data has no value for it.',
  ],
  actions: {
    // a buff on the next attack: cast it in attack range (125, edge to edge, plus her 65 radius)
    q: { lock: 0, range: 125 + 65 },
    w: { delay: 'ArmorMRDuration' },
    e: { dash: { speed: 2000, distance: 900, direction: 'toward' } },
    r: { delay: 0.625 },
  },
  notes: ['Zenith Blade\'s flight and Leona\'s dash to the target are drawn as one dash at the blade\'s speed.'],
});
