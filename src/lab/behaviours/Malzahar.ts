/* Malzahar: Call of the Void opens two portals beside the target that fire DelayPostCast later; the game file's
   MalzaharQMissile is the portals' bolt, not something he throws. The Voidlings of Void Swarm come out after
   SummonDelay and run to the target, so Void Swarm is cast from where he attacks. Nether Grasp suppresses the
   target for SuppressDuration while he channels. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Malzahar', {
  reviewed: '16.20.1',
  actions: {
    q: { speed: 0, delay: 'DelayPostCast' },
    // his attack range (500, edge to edge) plus his 65 radius
    w: { range: 500 + 65, delay: 'SummonDelay' },
    r: { channel: 'SuppressDuration' },
  },
  notes: ['The Voidlings\' attacks land together when they come out, not spread over their lifetime.'],
});
