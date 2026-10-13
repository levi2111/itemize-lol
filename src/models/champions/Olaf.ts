import { champion } from '../dsl.ts';

/* Olaf's two damaging abilities are one calculation each. What the model adds:
   Undertow's armor shred arriving with the axe and running out, and the three
   things that change his attacks without dealing damage themselves: Berserker
   Rage's attack speed from his own missing health (the engine keeps the
   attacker at full health, so that is an option), Tough It Out's attack speed
   and Ragnarok's attack damage. */
export default champion('Olaf', {
  reviewed: '16.20.1',
  options: {
    missingHealth: { label: 'Olaf\'s missing health (%)', kind: 'int', default: 0, min: 0, max: 100 },
    toughItOut: { label: 'Tough It Out attack speed active', default: false },
    ragnarok: { label: 'Ragnarok active', default: false },
  },
  // shredUntil: when Undertow's armor shred on the target runs out
  counters: { shredUntil: {} },
  p: {
    // grows evenly with missing health and is full once his health is down to MaxStatsThreshold; the life steal is not damage
    statMods: [{ stat: 'attackSpeed', value: 'MaxAttackSpeed * min(1, missingHealth / 100 / (1 - MaxStatsThreshold))' }],
    notes: ['Berserker Rage\'s attack speed follows "Olaf\'s missing health", which starts at 0.'],
  },
  q: {
    // the shred lands with the axe, so Undertow's own damage does not benefit from it
    hits: [{ id: 'axe', type: 'physical', amount: 'TotalDamage', then: 'shredUntil = time + DebuffDuration' }],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ShredAmount', when: 'time < shredUntil' }],
    notes: ['Undertow\'s armor shred applies to what follows it in the combo, for as long as it lasts.'],
  },
  w: {
    // the shield is not damage
    statMods: [{ stat: 'attackSpeed', value: 'Attackspeed', when: 'toughItOut' }],
    notes: ['Tough It Out deals no damage. Its attack speed is off unless "Tough It Out attack speed active" is set.'],
  },
  e: {
    hits: [{ id: 'swing', type: 'true', amount: 'TotalDamage' }],
  },
  r: {
    // PercentTotalADAmp multiplies his whole attack damage, the flat part included, so the two are separate phases
    // rather than the tooltip's AD calculation, which leaves the flat part out of the share
    statMods: [
      { stat: 'ad', value: 'FlatAD', when: 'ragnarok' },
      { stat: 'ad', phase: 'percent', value: 'PercentTotalADAmp', when: 'ragnarok' },
    ],
    notes: ['Ragnarok deals no damage. Its attack damage, which also raises Reckless Swing, is off unless "Ragnarok active" is set.'],
  },
});
