import { champion } from '../dsl.ts';

/* Three things the game data leaves open for Swain:
   - Death's Hand gives the damage of the first bolt and of each further one; that
     there are five, and that a target close enough takes all of them, is prose.
   - Demonic Ascension has damage per second and no duration: it lasts for as long
     as he keeps draining a champion. The time is an option, and Demonflare is
     cast as often as its delay and cooldown allow within it.
   - Soul Fragments are kept between fights, so they are an option. */
export default champion('Swain', {
  reviewed: '16.20.1',
  options: {
    fragments: { label: 'Soul Fragments collected', kind: 'int', default: 0, min: 0 },
    bolts: { label: 'Death\'s Hand bolts that hit the target', kind: 'int', default: 5, min: 1, max: 5 },
    // unfed, the Demonic Energy he transforms with runs out after this long
    drain: { label: 'Seconds Demonic Ascension drains the target', kind: 'int', default: 'SwainR.DemonPowerMax / SwainR.DemonPowerDegen', min: 1 },
  },
  p: {
    // none of his own damage scales with health; this is for items that do
    statMods: [{ stat: 'hp', value: 'fragments * HealthIncrement' }],
  },
  q: {
    hits: [
      { id: 'first', label: 'First bolt', type: 'magic', amount: 'InitialDamage' },
      // the tooltip states five bolts; the game data has no value for the count
      {
        id: 'further', label: 'Further bolts', type: 'magic', amount: 'ExtraBoltDamage', count: 'bolts - 1',
        note: 'All 5 bolts of Death\'s Hand are counted, as when cast from close range; set "Death\'s Hand bolts that hit the target" for fewer.',
      },
    ],
  },
  w: {
    hits: [{ id: 'eye', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    // only the detonation deals damage; the recast pulls
    hits: [{ id: 'detonation', type: 'magic', amount: 'SecondaryDamage' }],
  },
  r: {
    hits: [
      // damage is given per second and dealt every TimeBetweenTicks seconds
      { id: 'drain', label: 'Drain', type: 'magic', amount: 'DamageCalc * TimeBetweenTicks', count: 'drain / TimeBetweenTicks', over: 'drain' },
      // castable after DemonflareCastDelay seconds, then again every DemonflareCooldownTooltip seconds
      {
        id: 'demonflare', label: 'Demonflare', type: 'magic', amount: 'DemonflareDamageTotal',
        count: 'if(drain >= DemonflareCastDelay, 1 + floor((drain - DemonflareCastDelay) / DemonflareCooldownTooltip), 0)',
        // several casts are spread over the drain they are counted within; a single one is an instant hit
        over: 'if(drain >= DemonflareCastDelay + DemonflareCooldownTooltip, drain, 0)',
        note: 'Demonic Ascension has no fixed duration: one cast counts the drain for "Seconds Demonic Ascension drains the target" (unless changed, as long as his Demonic Energy lasts without recharging), and Demonflare each time it is ready within that time.',
      },
    ],
  },
});
