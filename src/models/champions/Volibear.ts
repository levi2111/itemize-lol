import { champion } from '../dsl.ts';

/* Volibear's formulas are one calculation per ability; the structure is in what
   happens around them. The Relentless Storm counts attacks and abilities toward
   Lightning Claws, Frenzied Maul bites a target it has already marked, and
   Thundering Smash is a basic attack the engine already counts. */
export default champion('Volibear', {
  reviewed: '16.20.1',
  vars: {
    // the tooltip states five stacks; BounceCounterMax is how many enemies the lightning reaches
    full: 5,
  },
  options: {
    // stats are worked out once per fight, so the attack speed follows this and not the stacks built in a combo
    storm: { label: 'The Relentless Storm stacks at the start', kind: 'int', default: 'if(sustained, full, 0)', min: 0, max: 5 },
    stormbringer: { label: 'Stormbringer active (bonus health)', default: false },
  },
  // built: stacks gained this fight; wounded: the target carries Frenzied Maul's mark
  counters: { built: {}, wounded: {} },
  p: {
    rules: [
      // the stack lands before the attack's on-hit, so the attack that reaches five already carries the lightning
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'built += 1' },
      // Thundering Smash's stack comes with its attack, and Frenzied Maul adds its own ahead of its on-hit
      { id: 'stackSpell', on: 'spell', when: '!cast.q && !cast.w', type: 'magic', amount: 0, then: 'built += 1' },
      // the lightning chains on to other enemies; a lone target takes it once
      { id: 'claws', label: 'Lightning Claws', on: 'onhit', when: 'storm + built >= full', type: 'magic', amount: 'ChainLightningDamage' },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedCalc * storm' }],
    notes: [
      'Every attack and every damaging ability adds a stack of The Relentless Storm, and stacks are kept for the whole combo; from the fifth on, attacks and Frenzied Maul carry Lightning Claws.',
      'The attack speed is not built up during a combo: set "The Relentless Storm stacks at the start" to the stacks Volibear fights with. Sustained damage assumes all five.',
    ],
  },
  q: {
    // CalculatedDamage is the whole empowered attack; the engine already counts the attack itself
    hits: [{
      id: 'smash', type: 'physical', amount: 'CalculatedDamage - ad',
      note: 'Thundering Smash counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  w: {
    hits: [{
      id: 'maul', type: 'physical', amount: 'if(wounded, EmpoweredDamage, TotalDamage)', appliesOnHit: true,
      then: ['wounded = 1', 'built += 1'],
      note: 'The first Frenzied Maul of a combo marks the target; every later one is the empowered bite.',
    }],
  },
  e: {
    hits: [{ id: 'bolt', type: 'magic', amount: 'CalculatedDamage + PercentDamage * target.maxHp' }],
  },
  r: {
    hits: [{ id: 'landing', type: 'physical', amount: 'SweetSpotDamageTooltip', note: 'Counts the target as directly underneath Volibear when he lands.' }],
    // Frenzied Maul scales with bonus health
    statMods: [{ stat: 'hp', value: 'HealthAmount', when: 'stormbringer' }],
    notes: ['The bonus health from Stormbringer, which Frenzied Maul scales with, counts only when "Stormbringer active" is set.'],
  },
});
