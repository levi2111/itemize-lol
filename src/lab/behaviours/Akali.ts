/* Perfect Execution is two casts: the vault (AkaliR) and, at least CooldownBetweenCasts later, the thrust
   (AkaliRb, a shorter cast). The model already counts which R is which. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Akali', {
  reviewed: '16.20.1',
  sources: ['The 10 seconds Akali has to recast Perfect Execution are from the League Wiki; the game data has no value for it.'],
  actions: {
    r: {
      recasts: { count: 2, window: 10, gap: 'CooldownBetweenCasts' },
      variants: [{ cast: 2, spell: 'AkaliRb' }],
      notes: ['Neither dash of Perfect Execution moves her here: the game data gives them no speed.'],
    },
  },
  notes: [
    'Shuriken Flip is one action, as in the model: the backflip, the shuriken\'s flight and the recast dash are not timed apart.',
    'The empowered attack\'s doubled range is not modeled.',
  ],
});
