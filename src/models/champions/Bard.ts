import { champion } from '../dsl.ts';

/* Bard's damage is Cosmic Binding and his Meeps. A Meep rides along on a basic
   attack and is used up by it; how hard it hits grows with the Chimes he has
   collected over the game, and how many he has depends on how long he has gone
   without attacking. Both are things only the player knows, so both are options. */
export default champion('Bard', {
  reviewed: '16.20.1',
  options: {
    chimes: { label: 'Chimes collected', kind: 'int', default: 0, min: 0 },
    meeps: { label: 'Meeps following Bard when the fight starts', kind: 'int', default: 1, min: 0 },
  },
  counters: { spent: {} },
  p: {
    rules: [
      // one Meep per attack while any are left; another arrives every spawn cooldown of the fight
      {
        id: 'meep', label: 'Meep', on: 'attack', type: 'magic',
        when: 'spent < meeps + floor(time / BaseMeepSpawnCD)',
        amount: 'MeepDamageNoChime + DamagePerCheckpoint * floor(chimes / TooltipChimeDamageCheckpoint)',
        then: 'spent += 1',
      },
    ],
    notes: [
      'Each basic attack uses up one Meep. Bard starts with 1 unless "Meeps following Bard when the fight starts" is set; how many he can hold grows with Chimes.',
      'A new Meep arrives at the base rate; the faster return that Chimes give is not counted.',
    ],
  },
  q: {
    // the bolt carries on to a second enemy; a lone target takes it once
    hits: [{ id: 'bolt', type: 'magic', amount: 'TotalDamage' }],
  },
  // Caretaker's Shrine only heals and grants move speed
  w: {},
  // Magical Journey is a portal
  e: {},
  // Tempered Fate only puts units in stasis
  r: {},
});
