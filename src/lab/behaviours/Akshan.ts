/* Heroic Swing fires a shot every AttackFrequency seconds for as many shots as the model's "swingShots"
   option says, and Akshan cannot attack while swinging. Comeuppance charges for ChannelDuration before the
   recast fires its bullets, one every CastTimePerBullet. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Akshan', {
  reviewed: '16.20.1',
  actions: {
    e: { channel: 'swingShots * AttackFrequency' },
    // the full charge, then the bullets leave; firing them holds him a while longer
    r: { lock: 'ChannelDuration', channel: 'NumberOfBullets * CastTimePerBullet' },
  },
  notes: [
    'Heroic Swing\'s hook and swing are one action; the swing starts as soon as the hook is cast.',
    'Comeuppance is charged in full, and all its bullets fly as one.',
  ],
});
