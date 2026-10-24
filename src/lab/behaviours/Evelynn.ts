/* Evelynn: Allure's charm and magic resist reduction need the mark to have been on the target for 2.5 seconds,
   so its effect waits that long after the cast. Last Caress strikes, then teleports her backwards. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Evelynn', {
  reviewed: '16.20.1',
  sources: [
    'The 2.5 seconds Allure\'s mark must last for its charm and shred are in its tooltip.',
    'Last Caress\'s teleport backwards is about 700 units (League wiki); it is drawn at the 2500 units a second of EvelynnRTrail in the game file.',
  ],
  actions: {
    w: { speed: 0, delay: 2.5 },
    r: { dash: { speed: 2500, distance: 700, direction: 'away' } },
  },
  notes: [
    'Allure\'s magic resist reduction is counted on everything that lands 2.5 seconds or more after it, as if the next hit then expunges the fully formed mark.',
    'Hate Spike\'s three recast spikes are counted with its first cast, as the model does.',
  ],
});
