/* Taliyah: Threaded Volley's rocks fly as TaliyahQMis (TaliyahQMisBig on Worked Ground), which the slot spell does
   not name; she is free again after the cast. Seismic Shove erupts KnockupDelay after it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Taliyah', {
  reviewed: '16.20.1',
  sources: ['The rocks fly at 3600 units a second and the boulder at 2000: TaliyahQMis and TaliyahQMisBig in the game file.'],
  actions: {
    q: { speed: 3600, variants: [{ when: 'workedGround', speed: 2000 }] },
    w: { delay: 'KnockupDelay' },
  },
  notes: ['All five rocks of Threaded Volley land with the first; in game they follow over about a second while she moves and casts.'],
});
