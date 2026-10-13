import { champion } from '../dsl.ts';

/* The game data has every amount as a single calculation. What the model adds:
   Martial Cadence's per-target cooldown, Dragon Strike's armor shred arriving
   after its own damage and running out, and the two halves of Demacian
   Standard's attack speed (one permanent, one only near the flag). */
export default champion('JarvanIV', {
  reviewed: '16.20.1',
  options: {
    standard: { label: 'Near a planted Demacian Standard', default: false },
  },
  // shredUntil: when Dragon Strike's armor shred on the target runs out
  counters: { shredUntil: {} },
  p: {
    rules: [
      // MaximumCadenceDamage caps it against monsters only, so it is left out
      {
        id: 'cadence', on: 'attack', type: 'physical',
        amount: 'max(MinimumCadenceDamage, TooltipCurrentHealthDamage * target.hp)', cooldown: 'TooltipCooldown',
        note: 'Martial Cadence is counted on the first attack and again each time its per-target cooldown has passed.',
      },
    ],
  },
  q: {
    // the shred lands with the lance, so Dragon Strike's own damage does not benefit from it
    hits: [{ id: 'lance', type: 'physical', amount: 'TotalDamage', then: 'shredUntil = time + e3' }],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'BaseARShred', when: 'time < shredUntil' }],
    notes: ['Dragon Strike\'s armor shred applies to what follows it in the combo, for as long as it lasts.'],
  },
  // Golden Aegis only shields and slows
  w: {},
  e: {
    hits: [{ id: 'standard', type: 'magic', amount: 'TotalDamage' }],
    statMods: [
      { stat: 'attackSpeed', value: 'PermanentAttackSpeed' },
      { stat: 'attackSpeed', value: 'BaseAuraAS', when: 'standard' },
    ],
    notes: ['The attack speed aura of the planted standard is off unless "Near a planted Demacian Standard" is set.'],
  },
  r: {
    hits: [{ id: 'leap', type: 'physical', amount: 'DamageCalc' }],
  },
});
