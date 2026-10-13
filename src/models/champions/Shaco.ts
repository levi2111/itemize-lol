import { champion } from '../dsl.ts';

/* Shaco's numbers all hang on one fact the game data cannot know: whether he is
   behind his target. From behind his attacks gain Backstab, Two-Shiv Poison gains
   a second amount, and the attack out of Deceive becomes a certain critical strike
   at a reduced modifier. That is one option, on by default because it is how the
   kit is played.

   The boxes are the other open question. The game data gives the damage of one
   shot; that a box fires for 5 seconds is tooltip prose and the half-second
   between shots is not in the data at all, so the shots are a stepper. */
export default champion('Shaco', {
  reviewed: '16.20.1',
  options: {
    behind: { label: 'Striking from behind', default: true },
    boxShots: { label: 'Shots each Jack in the Box lands on the target (10 is its full 5 seconds)', kind: 'int', default: 10, min: 0, max: 10 },
    clone: { label: 'Hallucinate clone attacking alongside Shaco', default: false },
  },
  vars: {
    low: 'hasTarget && target.hpPct < TwoShivPoison.ExecuteHealthThreshold',
  },
  p: {
    rules: [
      // added to the attack's own damage, so it crits with it
      { id: 'backstab', on: 'attack', when: 'behind', type: 'physical', amount: 'BasicAttackDamage', crit: 'BasicAttackDamage * critDamage' },
    ],
    notes: ['Attacks, Deceive and Two-Shiv Poison are counted as striking from behind unless "Striking from behind" is turned off.'],
  },
  q: {
    hits: [{
      // the engine counts the attack and Backstab at their crit average. from behind the attack always crits, at
      // QCritDamageMod when the roll fails and at full crit damage when it succeeds: this adds the difference
      id: 'strike', type: 'physical',
      amount: 'if(behind, TotalDamage * QCritDamageMod + (ad + ShacoPassive.BasicAttackDamage) * (QCritDamageMod - 1), TotalDamage)',
      crit: 'TotalDamage * critDamage',
      note: 'Deceive counts only what it adds to the next attack, including the guaranteed critical strike from behind; put a basic attack after it in the combo.',
    }],
  },
  w: {
    // a lone target takes the single-target amount with every shot
    hits: [{
      id: 'box', label: 'Jack in the Box shots', type: 'magic', amount: 'STDamage', count: 'boxShots',
      // half a second between shots, as the stepper's 10 shots in 5 seconds has it
      over: 'boxShots * 0.5',
      note: 'Jack in the Box is counted as firing at the target alone for "Shots each Jack in the Box lands on the target", its full 5 seconds unless changed. A Feared target that walks away takes fewer.',
    }],
  },
  e: {
    hits: [{
      // one instance: the shiv and Backstab's addition are both raised below the health threshold, judged before it lands
      id: 'shiv', type: 'magic',
      amount: 'if(low, TotalExecuteDamage, TotalDamage) + behind * if(low, ShacoPassive.ShivDamageExecute, ShacoPassive.ShivDamage)',
    }],
  },
  r: {
    hits: [
      { id: 'explosion', label: 'Clone explosion', type: 'magic', amount: 'ExplosionTotalDamage', note: 'The clone is counted as exploding next to the target.' },
      // the tooltip states three mini boxes; each fires at the one enemy, so each deals the single-target amount
      {
        id: 'boxes', label: 'Mini Jack in the Box shots', type: 'magic', amount: 'STDamage', count: '3 * boxShots',
        // the three boxes fire side by side, so the time is one box's
        over: 'boxShots * 0.5',
        note: 'All three mini boxes are counted as firing at the target alone, each for "Shots each Jack in the Box lands on the target".',
      },
    ],
    rules: [
      // the clone has Shaco's attack speed, so it is counted as attacking once for each of his attacks
      {
        id: 'clone', label: 'Clone attack', on: 'attack', when: 'clone', type: 'physical',
        amount: 'ad * CloneAADamagePercent', crit: 'ad * critDamage * CloneAADamagePercent',
        note: 'With "Hallucinate clone attacking alongside Shaco" set, the clone attacks once for each of Shaco\'s attacks. Its Backstab and on-hit effects are not counted.',
      },
    ],
  },
});
