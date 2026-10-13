import { champion } from '../dsl.ts';

/* Two things the game data leaves open for Anivia:
   - Frostbite doubles against a Chilled target. Chill comes from Flash Frost or a
     fully formed Glacial Storm landing moments before, which a combo without
     timings cannot know, so it is an option that is on by default.
   - Glacial Storm is a toggle with damage per second and no duration. The time
     the target spends in it is an option; the storm deals its weaker damage
     while it grows and the empowered damage after that. */
export default champion('Anivia', {
  reviewed: '16.20.1',
  options: {
    chilled: { label: 'Target is Chilled when Frostbite lands', default: true },
    stormSeconds: { label: 'Seconds the target stands in Glacial Storm', kind: 'int', default: 3, min: 1 },
  },
  // Rebirth only revives her
  p: {},
  q: {
    hits: [
      { id: 'pass', label: 'Ice passing through', type: 'magic', amount: 'TotalPassthroughDamage' },
      { id: 'detonate', label: 'Detonation', type: 'magic', amount: 'TotalExplosionDamage', note: 'Both the ice passing through the target and its detonation are counted.' },
    ],
  },
  // Crystallize is a wall: terrain and a knockback, no damage
  w: {},
  e: {
    hits: [{
      id: 'wind', type: 'magic', amount: 'if(chilled, EmpoweredDamage, TotalDamage)',
      note: 'Frostbite deals its doubled damage against a Chilled target unless "Target is Chilled when Frostbite lands" is turned off.',
    }],
  },
  r: {
    // damage is given per second and dealt every TickRate seconds; the first GrowthTime seconds are the growing storm
    hits: [
      {
        id: 'growing', label: 'Glacial Storm while it grows', type: 'magic',
        amount: 'TotalDamagePerSecond * TickRate', count: 'min(stormSeconds, GrowthTime) / TickRate',
        // both entries are one stay in the storm, so each covers all of it
        over: 'stormSeconds',
      },
      {
        id: 'formed', label: 'Fully formed Glacial Storm', type: 'magic',
        amount: 'EmpoweredDamagePerSecondTooltipOnly * TickRate', count: 'max(0, stormSeconds - GrowthTime) / TickRate',
        over: 'stormSeconds',
        note: 'Glacial Storm is a toggle: one cast counts the target standing in it for "Seconds the target stands in Glacial Storm" (3 unless changed), from the moment it is placed.',
      },
    ],
  },
});
