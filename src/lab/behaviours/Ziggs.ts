/* Ziggs: Bouncing Bomb flies as ZiggsQSpell and lands up to MaxRange away (the slot spell's range is 10000). Mega
   Inferno Bomb takes ZiggsRBoom's fixed flight time to land. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ziggs', {
  reviewed: '16.20.1',
  sources: ['Mega Inferno Bomb lands 1.2 seconds after it is thrown: ZiggsRBoom\'s missile time in the game file, for targets within its 2775 range.'],
  actions: {
    q: { spell: 'ZiggsQSpell', range: 'ZiggsQ.MaxRange' },
    r: { speed: 0, delay: 1.2 },
  },
  notes: ['Bouncing Bomb is counted as exploding where it first lands.'],
});
