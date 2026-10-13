import { champion } from '../dsl.ts';

/* Hecarim's attack damage comes partly from his move speed, so Warpath is a stat
   conversion that runs after everything that changes move speed, Devastating
   Charge included. Rampage grows with its own stacks, and Devastating Charge is
   an attack whose damage is replaced rather than added to. */
export default champion('Hecarim', {
  reviewed: '16.20.1',
  vars: {
    // stacks the next Rampage is cast with: each Rampage that hits adds one for the following ones
    rampage: 'min(HecarimRapidSlash.MaxStacks, rampageStacks + slashes)',
  },
  options: {
    rampageStacks: { label: 'Rampage stacks when the fight starts', kind: 'int', default: 0, min: 0 },
    fullCharge: { label: 'Devastating Charge lands at full charge distance', default: true },
    charging: { label: 'Devastating Charge move speed active', default: false },
  },
  counters: { slashes: {} },
  p: {
    statMods: [{ stat: 'ad', value: 'BonusAD', phase: 'convert' }],
    notes: ['Warpath turns move speed from items into attack damage. The game\'s move speed soft cap is not applied, so very fast builds read slightly high.'],
  },
  q: {
    // RampageBonusDamagePerc is in percent points per stack
    hits: [{
      id: 'cleave', type: 'physical', amount: 'Damage * (1 + rampage * RampageBonusDamagePerc / 100)', then: 'slashes += 1',
      note: 'Each Rampage in the combo is cast with the stacks the earlier ones gave, on top of "Rampage stacks when the fight starts".',
    }],
  },
  w: {
    // TotalDamage is the whole duration; it is dealt in ticks of TickTime
    hits: [{
      id: 'dread', type: 'magic', amount: 'TotalDamage / (BuffDuration / TickTime)', count: 'BuffDuration / TickTime',
      over: 'BuffDuration',
      note: 'The target is counted as staying in Spirit of Dread for its whole duration.',
    }],
  },
  e: {
    // the attack's whole damage becomes this amount, so it is a strike of its own rather than a bonus on top of an auto attack.
    // a crit adds the attack's usual crit bonus
    hits: [{
      id: 'charge', type: 'physical', appliesOnHit: true,
      amount: 'if(fullCharge, MaxDamage, MinDamage)', crit: 'if(fullCharge, MaxDamage, MinDamage) + ad * (critDamage - 1)',
      note: 'Devastating Charge is the whole empowered attack, on-hit effects included: do not add an auto attack for it. It is counted at full charge distance; with "Devastating Charge lands at full charge distance" off it is the minimum.',
    }],
    // the move speed only matters here for what Warpath makes of it
    statMods: [{ stat: 'movePct', value: 'MaxMoveSpeed', when: 'charging' }],
    notes: ['With "Devastating Charge move speed active" the whole combo is dealt at its full move speed, which Warpath turns into attack damage. The game\'s move speed soft cap is not applied, so this reads high.'],
  },
  r: {
    // the riders pass through each enemy once
    hits: [{ id: 'riders', type: 'magic', amount: 'DamageDone' }],
  },
});
