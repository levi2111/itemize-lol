/* Zaahen: The Darkin Glaive is two casts, each a buff on his next attack that resets the attack timer: the first,
   and a recast within RecastWindow once that attack has landed (hook). The model counts both in one Q; its "qCast"
   option lets each cast here count its own bonus. Grim Deliverance rises for its cast, then dives DashMaxDistance
   at DashSpeed onto the target. */
import { behaviour } from '../behaviour.ts';

/** his attack range, 175 edge to edge, plus his 65 radius (game file): the buffs are cast in attack range */
const MELEE = 175 + 65;

export default behaviour('Zaahen', {
  reviewed: '16.20.1',
  actions: {
    q: {
      range: MELEE,
      recasts: { count: 2, window: 'RecastWindow' },
      variants: [
        { cast: 1, options: { qCast: 1 } },
        { cast: 2, spell: 'ZaahenQ2', range: MELEE, options: { qCast: 2 } },
      ],
    },
    r: { dash: { speed: 'DashSpeed', distance: 'DashMaxDistance', direction: 'toward' } },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.state.armed = 1;
      else if (c.action === 'aa') c.state.armed = 0;
    },
    canStart(c) {
      if (c.action !== 'q' || c.cast !== 2 || !c.state.armed) return true;
      c.note('The Darkin Glaive\'s recast waits for the attack the first cast empowered.');
      return false;
    },
  },
  notes: ['Each cast\'s bonus is counted when it is cast, not with the attack it empowers.'],
});
