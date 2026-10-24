/* Stat shards: one pick from each of three rows, shared by every tree. Names on the right are the shard's
   own named values (`runes.json`, or `npm run data:report -- --rune <id>`). Adaptive Force is attack
   damage or ability power, by whichever the build has more of; `adaptivePhysical` says which. */
import { rune } from '../dsl.ts';

const P = '16.20.1';

export default [
  rune(5008, 'Adaptive Force', {
    reviewed: P,
    statMods: [
      { stat: 'ad', value: 'StatGain1', when: 'adaptivePhysical' },
      { stat: 'ap', value: 'StatGain2', when: 'not(adaptivePhysical)' },
    ],
  }),
  // the game's value is in percent points
  rune(5005, 'Attack Speed', { reviewed: P, statMods: [{ stat: 'attackSpeed', value: 'StatGain / 100' }] }),
  rune(5007, 'Ability Haste', { reviewed: P, statMods: [{ stat: 'abilityHaste', value: 'HasteGain' }] }),
  rune(5010, 'Move Speed', { reviewed: P, statMods: [{ stat: 'movePct', value: 'StatGain1 / 100' }] }),
  rune(5011, 'Health', { reviewed: P, statMods: [{ stat: 'hp', value: 'StatGain' }] }),
  rune(5001, 'Health Scaling', {
    reviewed: P,
    statMods: [{ stat: 'hp', value: 'StatGainMin + (StatGainMax - StatGainMin) * (level - 1) / 17' }],
    notes: ['Health Scaling is taken to grow evenly from level 1 to level 18.'],
  }),
  rune(5013, 'Tenacity and Slow Resist', { reviewed: P, notes: ['Tenacity and slow resist do not change damage.'] }),
];
