import { champion } from '../dsl.ts';

/* Two things the game data leaves to prose:
   - Threaded Volley's calculation is one rock; five are hurled and a lone target
     takes all of them, each after the first at reduced damage.
   - Unraveled Earth's stones only detonate when the target is moved through them.
     Seismic Shove deals no damage of its own, but it is what does the moving, so
     the detonation waits for both to be in the combo. */
export default champion('Taliyah', {
  reviewed: '16.20.1',
  options: {
    workedGround: { label: 'Casting Threaded Volley on Worked Ground', default: false },
    dash: { label: 'Target dashes through Unraveled Earth', default: false },
  },
  counters: { field: {}, shoved: {} },
  // Rock Surfing only gives move speed
  p: {},
  q: {
    hits: [
      { id: 'rock', label: 'First rock', when: '!workedGround', type: 'magic', amount: 'RockDamage' },
      // the tooltip states five rocks; the game data has no value for the count
      {
        id: 'rocks', label: 'Further rocks', when: '!workedGround', type: 'magic',
        amount: 'RockDamage * (1 - ExtraMissileReducedDamagePercent / 100)', count: 4,
        note: 'All 5 rocks of Threaded Volley are counted on the one target.',
      },
      // on worked ground the volley is a single boulder instead
      { id: 'boulder', label: 'Boulder', when: 'workedGround', type: 'magic', amount: 'BigRockDamage' },
    ],
  },
  w: {
    // the knock itself deals nothing; it carries the target through the stones
    hits: [{ id: 'shove', type: 'magic', amount: 0, then: 'shoved = 1' }],
  },
  e: {
    hits: [{ id: 'scatter', type: 'magic', amount: 'ScatterDamage', then: 'field = 1' }],
    rules: [
      // once per cast: the field is spent by the detonation, and so is the shove
      {
        id: 'detonate', label: 'Stone detonation', on: 'after', when: 'field && (shoved || dash)', type: 'magic',
        amount: 'MaxDetonationDamageTooltip', then: ['field = 0', 'shoved = 0'],
        note: 'The stones detonate only with Seismic Shove in the same combo, or with "Target dashes through Unraveled Earth" set. The maximum detonation damage (4 stones) is counted.',
      },
    ],
  },
  // Weaver's Wall deals no damage
  r: {},
});
