/* Trundle: Chomp is an instant buff on his next attack, which it resets (the game file's half second is the bite's
   animation); its attack damage lasts SapDebuffDuration. Frozen Domain's attack speed is counted for its Duration,
   as if he stays in it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Trundle', {
  reviewed: '16.20.1',
  actions: {
    // cast it in attack range (175, edge to edge, plus his 65 radius)
    q: { lock: 0, range: 175 + 65 },
  },
  windows: [
    { option: 'chomped', after: 'q', for: 'SapDebuffDuration' },
    { option: 'frozenDomain', after: 'w', for: 'Duration' },
  ],
  notes: ['Chomp\'s bite is counted when it is cast, and its attack damage from then; the attack it empowers follows it in the combo.'],
});
