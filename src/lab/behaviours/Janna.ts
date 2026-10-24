/* Janna: Howling Gale is cast, grows for the model's "Seconds Howling Gale grows" and is sent off with the
   recast (HowlingGaleSpell), then travels at that spell's speed. Monsoon is a channel of Duration seconds. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Janna', {
  reviewed: '16.20.1',
  sources: [
    'Howling Gale\'s release takes HowlingGaleSpell\'s 0.25 second cast and flies at its 667.667 units a second (game file).',
  ],
  actions: {
    q: { lock: 'galeCharge + 0.25', speed: 667.667 },
    r: { channel: 'Duration' },
  },
  notes: ['Howling Gale\'s range growing with its charge is not counted.'],
});
