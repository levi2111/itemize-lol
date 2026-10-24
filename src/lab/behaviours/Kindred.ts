/* Kindred: Dance of Arrows is a short vault (the game file gives its DashSpeed but no length) that resets the
   attack and fires the arrows once she lands; its attack speed lasts BaseASDuration. Vaulting inside Wolf's
   Frenzy, or casting Wolf's Frenzy, sets its cooldown to CDNewValue (its tooltip): a cast inside takes that
   cooldown, and a hook cuts one already running when the zone goes up. Mounting Dread's slot spell is a
   wrapper with a 1200 cast range; the mark itself reaches 500. */
import { behaviour } from '../behaviour.ts';

/** Dance of Arrows' cooldown inside Wolf's Frenzy */
const IN_FRENZY = 'KindredQ.CDNewValue * 100 / (100 + abilityHaste)';

export default behaviour('Kindred', {
  reviewed: '16.20.1',
  sources: [
    'Dance of Arrows\' 300 unit vault is from the League Wiki; its speed is read as DashSpeed plus her move speed.',
    'Mounting Dread\'s 500 range is KindredE\'s cast range in the game file.',
  ],
  actions: {
    q: {
      dash: { speed: 'DashSpeed + moveSpeed', distance: 300, direction: 'toward' },
      variants: [{ when: 'inFrenzy', cooldown: IN_FRENZY }],
    },
    e: { range: 500 },
  },
  windows: [
    { option: 'dance', after: 'q', for: 'BaseASDuration' },
    { option: 'inFrenzy', after: 'w', for: 'ZoneDuration' },
  ],
  hooks: {
    onLand(c) {
      if (c.action === 'w') c.setReadyAt('q', Math.min(c.readyAt('q'), c.t + c.value(IN_FRENZY)));
    },
  },
  notes: [
    'Kindred is counted as staying inside Wolf\'s Frenzy for as long as it lasts.',
    'The range her Marks add is not counted.',
  ],
});
