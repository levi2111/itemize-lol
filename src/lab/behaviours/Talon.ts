/* Talon: Noxian Diplomacy is a leap onto the target from range and, in melee range, a stab (TalonQAttack, an
   attack-like cast) that critically strikes; the model's "leap" option follows which one it was. Both reset the
   attack; out of the leap's reach he walks in first. Rake's blades and Shadow Assault's ring fly as missiles the slot
   spells do not name. Assassin's Path only vaults terrain, which the lab has none of. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Talon', {
  reviewed: '16.20.1',
  sources: [
    'The leap\'s speed is taken from TalonQ\'s 2000 missile speed in the game file; its reach is TalonQ\'s 575 range. TalonQ\'s 0.52 second cast is the empowered attack\'s animation.',
    'Rake\'s blades fly out at 2500 units a second (TalonWMissileOne) and Shadow Assault\'s at 2400 (TalonRMisOne) in the game file.',
  ],
  actions: {
    q: {
      lock: 0, speed: 0,
      dash: { speed: 2000, distance: 575, direction: 'toward' },
      variants: [
        // in his 125 attack range, edge to edge, he stabs without leaping
        { within: 125, spell: 'TalonQAttack', dash: null, options: { leap: 0 } },
        // out of the leap's reach (575 from his centre, he has a 65 radius) he walks in first
        { beyond: 575 - 65, dash: null },
        { options: { leap: 1 } },
      ],
    },
    w: { speed: 2500 },
    e: { requires: 0 },
    r: { speed: 2400 },
  },
  notes: [
    'Rake\'s return and Shadow Assault\'s second pass land with their first; in game the blades come back later.',
    'Assassin\'s Path is never cast: it needs terrain to vault.',
  ],
});
