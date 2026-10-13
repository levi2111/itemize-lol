import { champion } from '../dsl.ts';

/* Kayle's damage is her basic attacks and what rides on them. Divine Ascent is
   one stack count doing two things: attack speed per stack, and once Aflame a
   fire wave on every attack made at full stacks. Stats are worked out once per
   fight, so the attack speed reads an option (the stacks she walks in with),
   while the waves also count the stacks her attacks add during the combo. */
export default champion('Kayle', {
  reviewed: '16.20.1',
  vars: {
    // Transcendent keeps her at full stacks for good
    startZeal: 'if(level >= KaylePassive.LevelForPassiveRank3, KaylePassive.EnrageMaxStacks, min(zeal, KaylePassive.EnrageMaxStacks))',
    exalted: 'startZeal + gained >= KaylePassive.EnrageMaxStacks',
  },
  options: {
    // kept up in a long fight, not there yet at the start of a short one
    zeal: { label: 'Zeal stacks at the start', kind: 'int', default: 'if(sustained, KaylePassive.EnrageMaxStacks, 0)', min: 0 },
  },
  // gained: Zeal stacks from attacks this fight; sundered: when this fight's Radiant Blast shred runs out
  counters: { gained: { max: 'KaylePassive.EnrageMaxStacks' }, sundered: {} },
  p: {
    rules: [
      // the attack that brings the last stack already launches a wave, so the stack comes first
      { id: 'zeal', on: 'attack', type: 'magic', amount: 0, then: 'gained += 1' },
      // the wave crits with the attack that launched it
      {
        id: 'wave', label: 'Fire wave', on: 'attack', when: 'level >= LevelForPassiveRank2 && exalted', type: 'magic',
        amount: 'PassiveWaveDamage', crit: 'PassiveWaveDamage * critDamage',
      },
    ],
    // EnrageTotalASPerStack is in percent points
    statMods: [{ stat: 'attackSpeed', value: 'EnrageTotalASPerStack / 100 * startZeal' }],
    notes: [
      'Once Kayle is Aflame, attacks at full Zeal stacks launch a fire wave. Each attack in the combo adds a stack, on top of "Zeal stacks at the start"; once she is Transcendent the stacks are always full.',
      'The attack speed counts only the stacks set with "Zeal stacks at the start", not the ones gained during the combo. Sustained damage assumes full stacks.',
      'Kayle is counted as a melee champion at every level, so items with a weaker effect for ranged champions are overstated once she is Arisen and attacks at range.',
    ],
  },
  q: {
    // the shred lands after the sword's own damage
    hits: [{ id: 'sword', type: 'magic', amount: 'TotalDamage', then: 'sundered = time + ShredDuration' }],
    // ShredPercent is in percent points
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'ShredPercent / 100', when: 'time < sundered' },
      { stat: 'mr', kind: 'reducePct', value: 'ShredPercent / 100', when: 'time < sundered' },
    ],
    notes: ['Radiant Blast lowers the target\'s armor and magic resist for what follows it in the combo, until its duration runs out. Its own damage is dealt before the reduction.'],
  },
  // Celestial Blessing only heals and grants move speed
  w: {},
  e: {
    // the bonus on top of the next attack only; the attack itself is an aa in the combo
    hits: [{
      id: 'starfire', type: 'magic', amount: 'ActiveTotalExecuteDamage * target.missingHp',
      note: 'Starfire Spellblade counts only the missing health damage it adds to the next attack, from the health the target has lost when it is cast; put a basic attack after it in the combo.',
    }],
    rules: [
      { id: 'spellblade', label: 'Starfire Spellblade passive', on: 'onhit', type: 'magic', amount: 'EPassiveTotalDamage' },
    ],
  },
  r: {
    hits: [{ id: 'judgment', type: 'magic', amount: 'TotalDamage' }],
  },
});
