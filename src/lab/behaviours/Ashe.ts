/* Ranger's Focus lasts BuffDuration: the timeline holds the model's "rangersFocus" option (its attack speed
   and flurry) for that long, and ends the flurry the cast itself turned on (the model's "focus" counter,
   which otherwise lasts the whole combo). Volley's arrows are VolleyAttack, with a longer reach than the cast
   spell's. Enchanted Crystal Arrow crosses the map. */
import { behaviour } from '../behaviour.ts';

/** AsheQ's MaxStacks: Focus stacks Ranger's Focus needs, one per attack made while it is not active */
const STACKS = 4;

export default behaviour('Ashe', {
  reviewed: '16.20.1',
  sources: [
    'Volley\'s reach of 1200 and arrow speed of 1500 are VolleyAttack\'s in the game file.',
    'Enchanted Crystal Arrow has unlimited range (its tooltip and the game file give it none); 25000 stands for that.',
  ],
  actions: {
    w: { range: 1200, speed: 1500 },
    r: { range: 25000 },
  },
  windows: [{ option: 'rangersFocus', after: 'q', for: 'BuffDuration' }],
  hooks: {
    // Focus stacks: full when the fight starts, as the model takes them; spent by the cast, earned back by attacks
    canStart(c) { return c.action !== 'q' || (!c.option('rangersFocus') && (c.state.stacks ?? STACKS) >= STACKS); },
    onStart(c) {
      if (c.action === 'q') c.state.stacks = 0;
      else if (c.action === 'aa' && !c.option('rangersFocus')) c.state.stacks = Math.min(STACKS, (c.state.stacks ?? STACKS) + 1);
    },
    onLand(c) { if (c.action === 'aa' && !c.option('rangersFocus')) c.setCounter('focus', 0); },
  },
  notes: ['Ranger\'s Focus is ready when the fight starts; after that it needs four attacks made while it is not active. Focus stacks do not run out here.'],
});
