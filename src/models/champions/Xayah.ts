import { champion } from '../dsl.ts';

/* Xayah's damage is in her Feathers. Double Daggers, Featherstorm and the attacks
   after any ability each leave some on the ground, and Bladecaller pulls them all
   back through the target, each one hitting for a little less than the last. The
   game data has one Feather's damage and the falloff per Feather; how many are out
   is a counter the combo builds.

   Deadly Plumage lasts for several attacks, so it is a state rather than a hit:
   casting it in a combo turns it on, and an option does the same for damage per
   second, where nothing is cast. */
export default champion('Xayah', {
  reviewed: '16.20.1',
  vars: {
    // the least a Feather still deals; only the tooltip's prose states it
    featherFloor: '10%',
    // Feathers that come back before the falloff has reached that floor
    falling: 'min(feathers, 1 + (1 - featherFloor) / XayahE.FeatherFalloff)',
    // the multipliers of every Feather out, added up: 1, 1 - falloff, 1 - 2 falloffs, ... and the floor for the rest
    recall: 'falling - XayahE.FeatherFalloff * falling * (falling - 1) / 2 + featherFloor * (feathers - falling)',
  },
  options: {
    deadlyPlumage: { label: 'Deadly Plumage active', default: false },
  },
  // cuts: attacks left that drop a Feather; feathers: Feathers on the ground; plumage: Deadly Plumage was cast
  counters: { cuts: { max: 'XayahPassive.PStackMax' }, feathers: {}, plumage: { max: 1 } },
  p: {
    // Clean Cuts adds nothing against the attack's own target; it only leaves the Feather behind it
    rules: [
      { id: 'arm', on: 'ability', type: 'physical', amount: 0, then: 'cuts += PStacksPerCast' },
      { id: 'feather', on: 'attack', when: 'cuts > 0', type: 'physical', amount: 0, then: ['cuts += -1', 'feathers += 1'] },
    ],
  },
  q: {
    // a lone target is the first one each dagger hits, so neither is reduced
    hits: [{ id: 'daggers', type: 'physical', amount: 'TotalDamage', count: 2, then: 'feathers += 2', note: 'Both daggers of Double Daggers are counted.' }],
  },
  w: {
    hits: [{
      id: 'activate', type: 'physical', amount: 0, then: 'plumage = 1',
      note: 'Casting Deadly Plumage adds its second blade to every later attack in the combo. For damage per second, set "Deadly Plumage active".',
    }],
    rules: [
      // a share of the attack that set it off, so it is larger when that attack crits; BonusDamagePercent is in percent points
      {
        id: 'blade', label: 'Deadly Plumage blade', on: 'attack', when: 'plumage || deadlyPlumage', type: 'physical',
        amount: 'ad * BonusDamagePercent / 100', crit: 'ad * critDamage * BonusDamagePercent / 100',
      },
    ],
    // WAttackSpeedAmount is in percent points; stats are settled before the fight, so only the option can grant it
    statMods: [{ stat: 'attackSpeed', value: 'WAttackSpeedAmount / 100', when: 'deadlyPlumage' }],
  },
  e: {
    // FeatherDamage already carries the crit scaling; every Feather is dealt at the average of the falloff
    hits: [{
      id: 'feathers', type: 'physical', amount: 'FeatherDamage * recall / feathers', count: 'feathers', then: 'feathers = 0',
      note: 'Bladecaller hits with every Feather left earlier in the combo: two from Double Daggers, five from Featherstorm and one from each attack empowered by an ability. With none out it deals nothing.',
    }],
    notes: ['Feathers are taken to still be on the ground when Bladecaller is cast.'],
  },
  r: {
    // the game data has no value for the number of Feathers; Featherstorm throws five, and a target is damaged once
    hits: [{
      id: 'storm', type: 'physical', amount: 'Damage', then: 'feathers += 5',
      note: 'All five Feathers of Featherstorm are counted as hitting on the way back with Bladecaller, which needs the target close to Xayah.',
    }],
  },
});
