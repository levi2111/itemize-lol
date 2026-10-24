/* What Ahri's file gets wrong by default: Fox-Fire is self-centred with a 1000 radius and its own missile
   is the orbit, not the seeking flame; Orb of Deception's way back is a second missile, which the model's
   `back` rule stands for; and Spirit Rush is three dashes within RRecastWindow, at least RDashCooldown apart,
   whose speed and length are only RBaseDashSpeed and RDashDistance. */
import { behaviour } from '../behaviour.ts';

/** Seconds from the orb passing a target `gap` units away (edge to edge) to its coming back through it: it flies
    on to its 970 range at 2500, as the timeline flies it out, then returns from 60 units a second, gaining 1900
    a second; 65 is Ahri's radius. */
const back = (gap: number) => {
  const left = 970 - 65 - gap;
  return left / 2500 + (Math.sqrt(60 ** 2 + 2 * 1900 * left) - 60) / 1900;
};

export default behaviour('Ahri', {
  reviewed: '16.20.1',
  sources: [
    'Orb of Deception: its 970 range (AhriQ) and 2500 speed out (AhriQMissile) are in the game file; the way back starts at 60 units a second and gains 1900 a second (AhriQReturnMissile\'s mInitialSpeed and mAcceleration in the raw game file, which the dataset does not compile).',
  ],
  actions: {
    // the orb comes back later the nearer the target stands: one form per 200 units, timed at its middle
    q: { variants: ([[200, 100], [400, 300], [600, 500], [800, 700], [Infinity, 850]] as const).map(([to, mid]) => ({ ...(to < Infinity && { within: to }), hitDelays: { back: back(mid) } })) },
    // the fox-fires seek enemies within AcquisitionRange and fly as AhriWDamageMissile
    w: { spell: 'AhriWDamageMissile', range: 'AhriW.AcquisitionRange' },
    r: {
      // the game file has no cast time: the dash is the whole lock
      lock: 0,
      // each dash covers its full length, whichever way she goes
      dash: { speed: 'RBaseDashSpeed', distance: 'RDashDistance', direction: 'through' },
      recasts: { count: 'RMaxCasts', window: 'RRecastWindow', gap: 'RDashCooldown' },
    },
  },
  notes: [
    'Orb of Deception\'s way back lands as the orb comes back through where the target stood when it was cast, Ahri standing still; the orb is not slowed on its way out.',
    'Spirit Rush\'s bolts land when each dash ends.',
  ],
});
