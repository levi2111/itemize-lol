/* What Ahri's file gets wrong by default: Fox-Fire is self-centred with a 1000 radius and its own missile
   is the orbit, not the seeking flame; Charm's cast spell has a range of 10000 while its missile has the real
   one; and Spirit Rush is three dashes within RRecastWindow, at least RDashCooldown apart, whose speed and
   length are only RBaseDashSpeed and RDashDistance. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ahri', {
  reviewed: '16.20.1',
  actions: {
    // the fox-fires seek enemies within AcquisitionRange and fly as AhriWDamageMissile
    w: { spell: 'AhriWDamageMissile', range: 'AhriW.AcquisitionRange' },
    e: { spell: 'AhriEMissile' },
    r: {
      // the game file has no cast time: the dash is the whole lock
      lock: 0,
      // each dash covers its full length, whichever way she goes
      dash: { speed: 'RBaseDashSpeed', distance: 'RDashDistance', direction: 'through' },
      recasts: { count: 'RMaxCasts', window: 'RRecastWindow', gap: 'RDashCooldown' },
    },
  },
  notes: [
    'Orb of Deception\'s return pass lands together with the outgoing one.',
    'Spirit Rush\'s bolts land when each dash ends.',
  ],
});
