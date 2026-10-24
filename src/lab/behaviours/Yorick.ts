/* Yorick: Last Rites is a buff on his next attack, with no cast time in the game file, resetting the attack
   timer, cast in attack range (175 edge to edge plus his 80 radius in the game file). The Maiden of Eulogy of the Isles arrives RSummonDelay after the cast, so her attacks land after it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Yorick', {
  reviewed: '16.20.1',
  actions: {
    q: { lock: 0, range: 175 + 80 },
    r: { delay: 'RSummonDelay' },
  },
  notes: ['The Maiden\'s counted attacks land together once she arrives: the game data gives her no attack speed.'],
});
