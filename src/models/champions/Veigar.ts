import { champion } from '../dsl.ts';

/* Phenomenal Evil is ability power that Veigar keeps between fights, so the stacks
   he arrives with are an option. Each ability that strikes the target adds one
   more; stats are settled before the fight, so those are a counter whose ability
   power is added to the abilities cast after it, at their own ratio. */
export default champion('Veigar', {
  reviewed: '16.20.1',
  vars: {
    gainedAp: 'struck * VeigarPassive.APPerStack',
  },
  options: {
    evil: { label: 'Phenomenal Evil stacks', kind: 'int', default: 0, min: 0 },
  },
  // struck: stacks gained from abilities landing during this fight
  counters: { struck: {} },
  p: {
    statMods: [{ stat: 'ap', value: 'evil * APPerStack' }],
    notes: ['Set "Phenomenal Evil stacks" to the stacks Veigar has collected. Each ability in the combo adds one more for the abilities after it.'],
  },
  q: {
    // the bolt hits the first two enemies; one target takes it once
    hits: [{ id: 'bolt', type: 'magic', amount: 'TotalDamage + gainedAp * APRatio', then: 'struck += VeigarPassive.dAbilityStacks' }],
  },
  w: {
    hits: [{ id: 'matter', type: 'magic', amount: 'TotalDamage + gainedAp * APRatio', then: 'struck += VeigarPassive.dAbilityStacks' }],
  },
  e: {
    // the cage deals no damage; stunning the target is still an ability striking it
    hits: [{ id: 'cage', type: 'magic', amount: 0, then: 'struck += VeigarPassive.dAbilityStacks' }],
    notes: ['Event Horizon deals no damage; it is counted as stunning the target, which grants a stack of Phenomenal Evil.'],
  },
  r: {
    // grows evenly with missing health; the tooltip puts the maximum below 33% health and the game data has no value for that
    hits: [{
      id: 'burst', type: 'magic',
      amount: '(MinDamage + gainedAp * APRatio) * (1 + (MaxExecuteMult - 1) * min(1, target.missingHpPct / (1 - 33%)))',
      then: 'struck += VeigarPassive.dAbilityStacks',
      note: 'Primordial Burst grows with the health the target has lost by the time it lands, so cast it last in the combo.',
    }],
  },
});
