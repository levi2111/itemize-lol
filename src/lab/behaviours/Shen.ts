/* Shen: Twilight Assault and Spirit's Refuge are instant; the blade's flight back adds nothing to the next
   attacks' timing. Twilight Assault's attack speed lasts for its NumEnhancedAttacks attacks, within
   AttackBuffDuration. Shadow Dash is a dash at DashBonusSpeed on top of his move speed. Stand United holds
   Shen for its ChannelDuration. */
import { behaviour } from '../behaviour.ts';

/** ShenQ.NumEnhancedAttacks */
const ATTACKS = 3;

export default behaviour('Shen', {
  reviewed: '16.20.1',
  sources: ['Shadow Dash\'s speed being DashBonusSpeed plus Shen\'s move speed is read from that value\'s name; its 600 length is ShenE\'s cast range.'],
  actions: {
    q: { lock: 0, speed: 0 },
    w: { lock: 0, range: 20000 },
    e: { lock: 0, dash: { speed: 'DashBonusSpeed + moveSpeed', distance: 600, direction: 'toward' } },
    r: { range: 20000, channel: 'ChannelDuration' },
  },
  windows: [{ option: 'twilightSpeed', after: 'q', for: 'AttackBuffDuration' }],
  hooks: {
    onStart(c) { if (c.action === 'q') c.state.empowered = ATTACKS; },
    onLand(c) {
      if (c.action !== 'aa' || !c.state.empowered) return;
      c.state.empowered--;
      if (!c.state.empowered) c.setOption('twilightSpeed', 0);
    },
  },
  notes: ['Stand United is cast on an ally anywhere; Shen does not move with it here.'],
});
