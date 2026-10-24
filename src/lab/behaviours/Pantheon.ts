/* Pantheon: the model counts Comet Spear as the tap (PantheonQTap), a thrust that refunds TapCooldownRefund
   of its cooldown (a hook). Shield Vault leaps onto the target. Aegis Assault channels for ShieldDuration,
   jabbing, then slams with the shield. */
import { behaviour } from '../behaviour.ts';

/** PantheonQ.TapCooldownRefund */
const TAP_REFUND = 0.6;

export default behaviour('Pantheon', {
  reviewed: '16.20.1',
  sources: ['Shield Vault has no leap speed in the game data: 1500 units a second over its 600 cast range is an assumption.'],
  actions: {
    q: { spell: 'PantheonQTap' },
    w: { dash: { speed: 1500, distance: 600, direction: 'toward' } },
    // cast within the shield slam's reach, so that the slam lands too
    e: { range: 'ShieldSwipeRadius', channel: 'ShieldDuration' },
  },
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.state.qAt = c.t;
    },
    onLand(c) {
      if (c.action === 'q') c.setReadyAt('q', c.state.qAt! + (c.readyAt('q') - c.state.qAt!) * (1 - TAP_REFUND));
    },
  },
  notes: [
    'Aegis Assault\'s shield slam is counted when the channel starts, its jabs over the channel.',
    'Grand Starfall\'s preparation and fall are not timed: it lands when cast.',
  ],
});
