import { champion } from '../dsl.ts';

/* Harrier is a mark, not a stack: Valor puts one on the target, Blinding Assault,
   Vault and the end of Behind Enemy Lines each put one back, and the next basic
   attack spends it for bonus damage. The order of the combo therefore decides
   how many attacks are empowered. */
export default champion('Quinn', {
  reviewed: '16.20.1',
  vars: {
    // a fresh mark from an ability replaces the one Valor placed, so the two never add up
    marked: 'harrier || (valorMark && !opened)',
  },
  options: {
    valorMark: { label: 'Target starts marked with Harrier', default: true },
    heightened: { label: 'Heightened Senses attack speed active', default: false },
  },
  // harrier: a mark from an ability is on the target; opened: Valor's opening mark is gone
  counters: { harrier: { max: 1 }, opened: { max: 1 } },
  p: {
    rules: [
      { id: 'harrier', on: 'attack', when: 'marked', type: 'physical', amount: 'BonusDamage', then: ['harrier = 0', 'opened = 1'] },
    ],
    // how often Valor marks again is worked out by the game's script and is not in the data
    notes: ['Harrier counts the mark the target starts with and the ones Quinn\'s abilities apply. The marks Valor adds again every few seconds are not counted.'],
  },
  q: {
    hits: [{ id: 'dive', type: 'physical', amount: 'TotalDamage', then: 'harrier = 1' }],
  },
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedBonus', when: 'heightened' }],
    notes: ['The attack speed from attacking a Harrier target is off unless "Heightened Senses attack speed active" is set.'],
  },
  e: {
    hits: [{ id: 'vault', type: 'physical', amount: 'TotalDamage', then: 'harrier = 1' }],
  },
  r: {
    // the damage is the recast that ends the flight; it marks the target again
    hits: [{ id: 'skystrike', type: 'physical', amount: 'Damage', then: 'harrier = 1', note: 'Behind Enemy Lines is counted as the strike that ends it.' }],
  },
});
