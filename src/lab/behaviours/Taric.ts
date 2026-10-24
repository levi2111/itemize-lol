/* Taric: every ability arms Bravado for his next two attacks within TaricPassive.Duration: doubled attack speed
   and bonus damage (the model's keptUp, kept by the timeline from the cast), and each Bravado attack takes
   TaricPassive.CDR off his basic abilities' cooldowns. A hook counts the two attacks; the model's own Bravado
   counter is armed only when an ability lands, which for Dazzle is a second late, so the hook keeps it at zero and
   keptUp carries the bonus. Dazzle's beam bursts ChargeDuration after the cast. */
import { behaviour } from '../behaviour.ts';

/** TaricPassive.CDR: 1 second at the usual cooldown multiplier */
const CDR = 1;
const bravado = (after: 'q' | 'w' | 'e' | 'r') => ({ option: 'keptUp', after, for: 'TaricPassive.Duration' });

export default behaviour('Taric', {
  reviewed: '16.20.1',
  actions: {
    e: { delay: 'ChargeDuration' },
  },
  windows: [bravado('q'), bravado('w'), bravado('e'), bravado('r')],
  hooks: {
    onStart(c) {
      if (c.action !== 'aa') { c.state.bravado = 2; return; }
      c.setCounter('bravado', 0);
      // the attack after the second Bravado attack is a plain one, at his own attack speed
      if (!c.state.bravado) c.setOption('keptUp', 0);
    },
    onLand(c) {
      if (c.action !== 'aa' || !c.state.bravado) return;
      // Bravado ran out before this attack
      if (!c.option('keptUp')) { c.state.bravado = 0; return; }
      for (const slot of ['q', 'w', 'e'] as const) c.setReadyAt(slot, Math.max(c.t, c.readyAt(slot) - CDR));
      c.state.bravado--;
    },
  },
});
