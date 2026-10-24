/* Nasus: Siphoning Strike is an instant buff on his next attack, which it resets (the game file's half second
   is the empowered attack's own animation). Fury of the Sands lasts Duration, its bonus health being the
   model's "fury", and while it lasts Siphoning Strike's cooldown is QCDR shorter: a hook takes that off. */
import { behaviour } from '../behaviour.ts';

/** NasusR.QCDR */
const QCDR = 0.5;

export default behaviour('Nasus', {
  reviewed: '16.20.1',
  actions: {
    // a buff on the next attack: cast it in attack range (125, edge to edge, plus his 80 radius)
    q: { lock: 0, range: 125 + 80 },
  },
  windows: [{ option: 'fury', after: 'r', for: 'Duration' }],
  hooks: {
    onStart(c) {
      if (c.action === 'q') { c.state.qAt = c.t; c.state.qStorm = c.option('fury'); }
    },
    onLand(c) {
      if (c.action !== 'q' || !c.state.qStorm) return;
      c.setReadyAt('q', c.state.qAt! + (c.readyAt('q') - c.state.qAt!) * (1 - QCDR));
    },
  },
  notes: ['Siphoning Strike\'s damage is counted when it is cast; the attack it empowers follows it in the combo.'],
});
