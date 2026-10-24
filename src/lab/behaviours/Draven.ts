/* Draven: Spinning Axe and Blood Rush are instant self-casts that do not stop his attacks (the game file's cast
   times are animations), and Blood Rush's attack speed is a buff for a few seconds, which the timeline keeps.
   Whirling Death is cast through the spell object DravenRCast, whose axes are the missile DravenR. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Draven', {
  reviewed: '16.20.1',
  sources: [
    'Whirling Death\'s axes fly at 2000 units a second, the missile speed of DravenR in the game file; its range is global.',
  ],
  actions: {
    // a buff on the next attack: cast it once in attack range (550, edge to edge, plus his 65 radius)
    q: { lock: 0, range: 550 + 65 },
    w: { lock: 0 },
    r: { speed: 2000, range: 20000 },
  },
  windows: [{ option: 'bloodRush', after: 'w', for: 'AttackSpeedDuration' }],
  notes: [
    'Catching a Spinning Axe does not refresh Blood Rush here.',
    'Both passes of Whirling Death land when the axes reach the target.',
  ],
});
