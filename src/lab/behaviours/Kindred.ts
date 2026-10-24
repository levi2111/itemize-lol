/* Kindred: Dance of Arrows is a short vault (the game file gives its DashSpeed but no length) that resets the
   attack and fires the arrows once she lands; its attack speed lasts BaseASDuration. Inside Wolf's Frenzy its
   cooldown is CDNewValue instead of its own: held here as a charge that comes back after CDNewValue, while the
   full cooldown (a window the timeline keeps) only holds it back outside the zone. Mounting Dread's slot spell
   is a wrapper with a 1200 cast range; the mark itself reaches 500. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kindred', {
  reviewed: '16.20.1',
  sources: [
    'Dance of Arrows\' 300 unit vault is from the League Wiki; its speed is read as DashSpeed plus her move speed.',
    'Dance of Arrows\' own cooldown, 9 seconds at every rank, is the spell\'s cooldown in the game file.',
    'Mounting Dread\'s 500 range is KindredE\'s cast range in the game file.',
  ],
  actions: {
    q: {
      dash: { speed: 'DashSpeed + moveSpeed', distance: 300, direction: 'toward' },
      charges: { count: 1, recharge: 'CDNewValue * 100 / (100 + abilityHaste)' },
      requires: 'inFrenzy || !danceCooling',
    },
    e: { range: 500 },
  },
  windows: [
    { option: 'dance', after: 'q', for: 'BaseASDuration' },
    { option: 'danceCooling', after: 'q', for: '9 * 100 / (100 + abilityHaste)', from: 'start' },
    { option: 'inFrenzy', after: 'w', for: 'ZoneDuration' },
  ],
  notes: [
    'Kindred is counted as staying inside Wolf\'s Frenzy for as long as it lasts.',
    'The range her Marks add is not counted.',
  ],
});
