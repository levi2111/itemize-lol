/* Vayne: Tumble empowers her next attack wherever she rolls, and Final Hour needs no target, so both are cast in
   attack range. Silver Bolts has no active. Final Hour's attack damage lasts BaseDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Vayne', {
  reviewed: '16.20.1',
  actions: {
    // a roll and a buff on her next attack: its 300 range is the roll, not a reach. Cast it in attack range
    q: { range: 550 + 65 },
    w: { requires: 0 },
    // in attack range (550, edge to edge, plus her 65 radius), so the buff is not spent walking
    r: { range: 550 + 65 },
  },
  windows: [{ option: 'finalHour', after: 'r', for: 'BaseDuration' }],
  notes: [
    'Silver Bolts is never cast: it is on every third hit.',
    'Tumble rolls in place here, and Final Hour\'s shorter Tumble cooldown is not played.',
  ],
});
