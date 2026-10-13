import { champion } from '../dsl.ts';

/* The game data has every amount as a single calculation. What the model adds:
   - Lay Waste has two amounts and the site's lone target is exactly the case
     that gets the doubled one, so that is the default and the other an option.
   - Wall of Pain deals nothing but cuts the magic resistance of whoever walks
     through it, for a few seconds.
   - Defile is a toggle with damage per second and no duration, so the time the
     target spends in it is an option. */
export default champion('Karthus', {
  reviewed: '16.20.1',
  options: {
    isolated: { label: 'Lay Waste hits only this enemy', default: true },
    defileSeconds: { label: 'Seconds the target stands in Defile', kind: 'int', default: 3, min: 1 },
  },
  // shredUntil: when Wall of Pain's magic resistance reduction on the target runs out
  counters: { shredUntil: {} },
  // Death Defied only lets him keep casting for free after dying
  p: {},
  q: {
    hits: [{
      id: 'blast', type: 'magic', amount: 'if(isolated, QSingleTargetDamage, QDamage)',
      note: 'Lay Waste deals its doubled damage for hitting a single enemy unless "Lay Waste hits only this enemy" is turned off.',
    }],
  },
  w: {
    hits: [{ id: 'wall', type: 'magic', amount: 0, then: 'shredUntil = time + DebuffDuration' }],
    // MagicResistShred is in percent points
    resists: [{ stat: 'mr', kind: 'reducePct', value: 'MagicResistShred / 100', when: 'time < shredUntil' }],
    notes: ['The target is counted as walking through Wall of Pain when it is cast: its magic resistance reduction applies to what follows in the combo, for as long as it lasts.'],
  },
  e: {
    // the game ticks four times a second for a quarter of this each; the total is the same
    hits: [{
      id: 'aura', type: 'magic', amount: 'TotalDPS', count: 'defileSeconds',
      over: 'defileSeconds',
      note: 'Defile is a toggle: one cast counts the target standing in it for "Seconds the target stands in Defile" (3 unless changed).',
    }],
  },
  r: {
    hits: [{ id: 'requiem', type: 'magic', amount: 'TotalDamage' }],
  },
});
