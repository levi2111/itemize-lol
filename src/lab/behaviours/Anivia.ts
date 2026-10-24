/* Flash Frost's cast spell has no missile of its own: the ice is FlashFrostSpell. Chill comes from the ice
   for SlowDuration and from Glacial Storm while the target stands in it, so the timeline keeps the model's
   "chilled" option instead of leaving it on. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Anivia', {
  reviewed: '16.20.1',
  actions: {
    q: { spell: 'FlashFrostSpell' },
  },
  windows: [
    { option: 'chilled', after: 'q', for: 'FlashFrost.SlowDuration' },
    { option: 'chilled', after: 'r', for: 'stormSeconds' },
  ],
  hooks: {
    // the option is on by default for the plain calculation; in a fight nothing is Chilled before Q or R
    onStart(c) { if (!c.state.started) { c.state.started = 1; c.setOption('chilled', 0); } },
  },
  notes: [
    'Chill is counted from Flash Frost\'s release, not from the ice reaching the target.',
    'Glacial Storm is counted as Chilling for as long as the target stands in it, though it only Chills once fully formed.',
  ],
});
