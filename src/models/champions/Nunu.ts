import { champion } from '../dsl.ts';

/* Snowball Barrage's game data gives the damage of one snowball and of the root.
   That a volley is three snowballs is only in the tooltip's prose, and that the
   ability is thrown three times is a value on its recast spell. The model puts
   the whole ability, every volley and the root, into one cast. */
export default champion('Nunu', {
  reviewed: '16.20.1',
  options: {
    freljord: { label: 'Call of the Freljord attack speed active', default: false },
  },
  p: {
    // the cleave only hits other enemies near the attacked one, so a lone target takes none of it
    statMods: [{ stat: 'attackSpeed', value: 'ASIncrease', when: 'freljord' }],
    notes: ['Call of the Freljord lasts 4 seconds after damaging a champion; its attack speed is off unless "Call of the Freljord attack speed active" is set.'],
  },
  q: {
    // the true damage in the tooltip is against minions and monsters only
    hits: [{ id: 'bite', type: 'magic', amount: 'TotalChampionDamage' }],
  },
  w: {
    hits: [{ id: 'snowball', type: 'magic', amount: 'MaximumSnowballDamage', note: 'A fully grown snowball is counted: rolled for 5 seconds before it hits.' }],
  },
  e: {
    hits: [
      // three snowballs per volley is stated only in the tooltip; the number of volleys is on the recast spell
      {
        id: 'snowballs', type: 'magic', amount: 'TotalSnowballDamage', count: '3 * NunuESnowballBurstFire.MaxBursts',
        note: 'All three volleys of Snowball Barrage are counted, three snowballs each.',
      },
      { id: 'root', label: 'Snowball Barrage root', type: 'magic', amount: 'TotalRootDamage', note: 'The root damage at the end of Snowball Barrage is counted: the target is still near Willump after 3 seconds.' },
    ],
  },
  r: {
    hits: [{ id: 'blizzard', type: 'magic', amount: 'MaximumDamage', note: 'The full 3 second channel of Absolute Zero is counted.' }],
  },
});
