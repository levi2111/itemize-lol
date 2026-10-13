import { champion } from '../dsl.ts';

/* Feast stacks are kept between fights, so they are an option. The game data
   reads them from a buff the model cannot see; the two places they change damage
   are written out here: the max health share of Vorpal Spikes, and the health
   each stack grants, which Feast's own damage scales with. */
export default champion('Chogath', {
  reviewed: '16.20.1',
  vars: {
    // no stacks before Feast has a rank
    eaten: 'if(rank.r >= 1, feast, 0)',
  },
  options: {
    feast: { label: 'Feast stacks', kind: 'int', default: 0, min: 0 },
  },
  // Carnivore only restores health and mana on kills
  p: {},
  q: {
    hits: [{ id: 'rupture', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  w: {
    hits: [{ id: 'scream', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  e: {
    // the spikes are separate from the attacks that launch them; the percentages are in percent points
    hits: [{
      id: 'spikes', type: 'magic', count: 'MaximumAttacks',
      amount: 'FlatDamageCalc + (PercentHealthDamage + eaten * FeastStackMultiplier) / 100 * target.maxHp',
      note: 'The spikes of all 3 empowered attacks are counted; add the basic attacks themselves to the combo.',
    }],
  },
  r: {
    hits: [{ id: 'bite', type: 'true', amount: 'RDamage' }],
    // the health from stacks is bonus health, which RDamage scales with
    statMods: [{ stat: 'hp', value: 'feast * RHealthPerStack' }],
  },
});
