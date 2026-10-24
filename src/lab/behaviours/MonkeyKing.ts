/* Wukong: Crushing Blow is an instant buff on his next attack, which it resets, and every hit of his takes
   CooldownDecrease off its cooldown. Warrior Trickster is a dash of RangeClamp at DashSpeed; Nimbus Strike a
   dash to the target at DashSpeed (no distance in the game file) whose attack speed lasts AttackSpeedDuration.
   Cyclone is a spin of SpinDuration in which he cannot attack, cast twice within RecastWindow, at least
   LockoutTimeBetweenCasts apart. */
import { behaviour } from '../behaviour.ts';

/** MonkeyKingDoubleAttack.CooldownDecrease */
const CUT = 0.5;
// cast in melee: his attack range (175, edge to edge) plus his 65 radius
const MELEE = 175 + 65;

export default behaviour('MonkeyKing', {
  reviewed: '16.20.1',
  sources: ['Nimbus Strike\'s 650 reach is MonkeyKingNimbus\'s cast range in the game file.'],
  actions: {
    q: { lock: 0, range: MELEE },
    w: { dash: { speed: 'DashSpeed', distance: 'RangeClamp', direction: 'toward' } },
    e: { dash: { speed: 'DashSpeed', distance: 650, direction: 'toward' } },
    r: { lock: 0, range: MELEE, channel: 'SpinDuration', recasts: { count: 2, window: 'RecastWindow', gap: 'LockoutTimeBetweenCasts' } },
  },
  windows: [{ option: 'nimbus', after: 'e', for: 'AttackSpeedDuration' }],
  hooks: {
    onLand(c) { if (c.action !== 'w' && c.action !== 'q') c.setReadyAt('q', Math.max(c.t, c.readyAt('q') - CUT)); },
  },
  notes: [
    'Each attack, Nimbus Strike and each Cyclone take 0.5 seconds off Crushing Blow\'s cooldown (a spin once, not per tick); the Clone\'s attacks do not.',
    'Crushing Blow\'s extra attack range is not counted.',
  ],
});
