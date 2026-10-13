import { champion } from '../dsl.ts';

/* Talon's game data has every amount; what it leaves out is how they chain.
   Each ability hit wounds the target, both passes of Rake and Shadow Assault
   included, and the attack that finds three wounds sets off the bleed. The
   wounds are a counter, so the order of the combo decides which attack bleeds. */
export default champion('Talon', {
  reviewed: '16.20.1',
  options: {
    leap: { label: 'Noxian Diplomacy cast from range (no critical strike)', default: false },
  },
  // "max 3 stacks" is only in the tooltip's prose
  counters: { wound: { max: 3 } },
  p: {
    rules: [{
      id: 'bleed', label: 'Blade\'s End bleed', on: 'attack', when: 'wound >= 3', type: 'physical', amount: 'BleedDamage', over: 'BleedDuration', then: 'wound = 0',
      note: 'The whole bleed is counted, on the attack that follows three ability hits. Each pass of Rake and of Shadow Assault is one hit.',
    }],
  },
  q: {
    // the melee cast always crits, so that is its amount and not a crit chance average. CriticalDamage, rebuilt: its
    // "bonus crit damage" is the part from items, which the engine reads as the whole crit damage; the 2 is the base
    // every champion record has
    hits: [{
      id: 'stab', type: 'physical', amount: 'if(leap, LeapDamage, LeapDamage * (EnhancedDamageMod + critDamage - 2))', then: 'wound += 1',
      note: 'Noxian Diplomacy is counted as cast in melee range, where it always critically strikes, unless "Noxian Diplomacy cast from range" is set.',
    }],
  },
  w: {
    hits: [
      { id: 'out', label: 'Rake going out', type: 'physical', amount: 'TotalInitialDamage', then: 'wound += 1' },
      { id: 'back', label: 'Rake returning', type: 'physical', amount: 'TotalReturnDamage', then: 'wound += 1', note: 'Both passes of Rake are counted.' },
    ],
  },
  // Assassin's Path only vaults over terrain
  e: {},
  r: {
    hits: [{
      id: 'blades', type: 'physical', amount: 'Damage', count: 2, then: 'wound += 2',
      note: 'Both passes of the Shadow Assault blades are counted.',
    }],
  },
});
