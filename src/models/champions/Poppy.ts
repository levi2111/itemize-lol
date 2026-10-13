import { champion } from '../dsl.ts';

/* The game data gives Hammer Shock and Heroic Charge the damage of one hit. That
   the ground erupts a second time, that the wall adds a second tackle and that
   Steadfast Presence only hurts an enemy whose dash it stops are written in the
   tooltips' prose. */
export default champion('Poppy', {
  reviewed: '16.20.1',
  options: {
    wall: { label: 'Heroic Charge carries the target into terrain', default: false },
    dashStopped: { label: "Steadfast Presence stops the target's dash", default: false },
    uncharged: { label: "Keeper's Verdict released without charging", default: false },
  },
  p: {
    rules: [
      // the buckler throw is a basic attack with bonus damage, ready again after its cooldown
      {
        id: 'buckler', on: 'attack', type: 'magic', amount: 'TotalDamage', cooldown: 'ActualCooldown',
        note: 'Iron Ambassador is ready for the first attack of the fight.',
      },
    ],
  },
  q: {
    // HealthDamagePercent is in percent points
    hits: [{
      id: 'smash', type: 'physical', amount: 'BaseDamage + HealthDamagePercent / 100 * target.maxHp', count: 2,
      note: 'Both hits of Hammer Shock are counted: the smash and the eruption a second later.',
    }],
  },
  w: {
    // the passive part only adds armor and magic resist
    hits: [{ id: 'interrupt', type: 'magic', amount: 'InterruptDamage', when: 'dashStopped' }],
    notes: ['Steadfast Presence deals damage only to an enemy whose dash it stops; that is off unless "Steadfast Presence stops the target\'s dash" is set.'],
  },
  e: {
    hits: [
      { id: 'tackle', type: 'physical', amount: 'TackleDamage' },
      { id: 'wall', label: 'Heroic Charge into terrain', type: 'physical', amount: 'TackleDamage', when: 'wall' },
    ],
    notes: ['The terrain damage is off unless "Heroic Charge carries the target into terrain" is set.'],
  },
  r: {
    hits: [
      { id: 'charged', type: 'physical', amount: 'Damage', when: '!uncharged', note: "Keeper's Verdict is counted as a charged swing unless \"Keeper's Verdict released without charging\" is set." },
      { id: 'snap', label: "Keeper's Verdict uncharged", type: 'physical', amount: 'HalfDamage', when: 'uncharged' },
    ],
  },
});
