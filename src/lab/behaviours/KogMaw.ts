/* Kog'Maw: Bio-Arcane Barrage is instant and does not stop his attacks (the model keeps its duration on the
   fight's clock). Void Ooze's slot spell has a 10000 cast range; the ooze is KogMawVoidOozeMissile. Living
   Artillery is a shell that lands after a delay. */
import { behaviour } from '../behaviour.ts';

export default behaviour('KogMaw', {
  reviewed: '16.20.1',
  sources: ['Living Artillery landing 1.1 seconds after it is fired is from the League Wiki; the game data has no value for it.'],
  actions: {
    w: { lock: 0 },
    e: { spell: 'KogMawVoidOozeMissile' },
    r: { delay: 1.1 },
  },
  notes: ['Bio-Arcane Barrage\'s extra attack range is not counted: his attacks keep their normal range.'],
});
