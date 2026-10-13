import { champion } from '../dsl.ts';

/* Mortal Will is what the game data cannot say about Pantheon: every attack and
   every cast is a stack, and at the cap the next Q, W or E spends them all for
   its bonus. The model keeps the stacks and puts each bonus behind them.

   He normally walks into a fight with the stacks full, which a counter cannot
   start at, so that first charge is an option beside the counter. */
export default champion('Pantheon', {
  reviewed: '16.20.1',
  vars: {
    empowered: 'will >= PantheonPassive.ActionsToEmpower || (willReady && !spent)',
  },
  options: {
    willReady: { label: 'Mortal Will ready at the start of the fight', default: true },
  },
  // will: stacks gained this fight; spent: the charge he started with is gone
  counters: { will: { max: 'PantheonPassive.ActionsToEmpower' }, spent: {} },
  p: {
    // counted after the action, so the cast that completes the stacks is not itself empowered
    rules: [{ id: 'stack', on: 'after', type: 'physical', amount: 0, then: 'will += 1' }],
    notes: ['Mortal Will is ready when the fight starts, so the first Q, W or E is empowered; after that the attacks and abilities in the combo have to stack it up again.'],
  },
  q: {
    hits: [
      // the thrown spear is the same hit plus an ability power ratio; a combo in melee range taps
      {
        id: 'spear', type: 'physical',
        amount: 'if(hasTarget && target.hpPct < CritHealthThreshold, ExecuteDamageCalcModified, TapDamageCalc)',
        note: 'Comet Spear is counted as the tap, and deals its enhanced damage when the target is already below the health threshold as it is cast.',
      },
      // an empowered cast empties the stacks and earns none of its own: -1 before the passive adds one
      { id: 'will', label: 'Mortal Will bonus', type: 'physical', amount: 'EmpoweredDamageCalc', when: 'empowered', then: ['will = -1', 'spent = 1'] },
    ],
  },
  w: {
    hits: [
      { id: 'vault', type: 'physical', amount: 'MaxHealthDamageCalc * target.maxHp' },
      // the empowered attack strikes three times; the engine's attack is the first. the rest of the total is
      // split over the other two, one rule each so that each applies on-hit effects
      {
        id: 'second', label: 'Empowered attack, second strike', type: 'physical', when: 'empowered',
        amount: '(EmpoweredDamageMultCalcModified - ad) / 2', crit: '(EmpoweredDamageMultCalcModified - ad) / 2 * critDamage', appliesOnHit: true,
        note: 'Empowered Shield Vault counts only what the triple strike adds to the attack; put a basic attack after it in the combo.',
      },
      // each strike is a stack: these two here, the third with the attack
      {
        id: 'third', label: 'Empowered attack, third strike', type: 'physical', when: 'empowered',
        amount: '(EmpoweredDamageMultCalcModified - ad) / 2', crit: '(EmpoweredDamageMultCalcModified - ad) / 2 * critDamage', appliesOnHit: true,
        then: ['will = 1', 'spent = 1'],
      },
    ],
  },
  e: {
    hits: [
      // DamageCalc is the whole channel; the game deals it in AttacksPerSecond jabs
      {
        id: 'jabs', type: 'physical', amount: 'DamageCalc / (ShieldDuration * AttacksPerSecond)', count: 'ShieldDuration * AttacksPerSecond',
        over: 'ShieldDuration',
        note: 'The full channel of Aegis Assault is counted, then the shield slam.',
      },
      { id: 'slam', label: 'Shield slam', type: 'physical', amount: 'ShieldDamageCalc' },
      // empowered it only adds resistances and move speed, but it still spends the stacks
      { id: 'spend', type: 'physical', amount: 0, when: 'empowered', then: ['will = -1', 'spent = 1'] },
    ],
  },
  r: {
    hits: [
      { id: 'spear', label: 'Spear from above', type: 'physical', amount: 'PantheonQ.HoldDamageCalc' },
      {
        id: 'crash', type: 'magic', amount: 'DamageCalc', then: 'will = PantheonPassive.ActionsToEmpower',
        note: 'Grand Starfall counts the spear and the full landing damage; the landing deals less toward the edges of its area.',
      },
    ],
    statMods: [{ stat: 'armorPenPct', value: 'ArmorPenetration' }],
  },
});
