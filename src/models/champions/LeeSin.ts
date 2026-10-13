import { champion } from '../dsl.ts';

/* Sonic Wave and Resonating Strike share the Q slot: the game data gives the
   recast a minimum and a maximum, and only the tooltip's prose says the target's
   missing health moves it between them. */
export default champion('LeeSin', {
  reviewed: '16.20.1',
  options: {
    flurry: { label: 'Flurry attack speed active', default: false },
  },
  p: {
    // lasts two attacks after each ability, so it is a switch rather than always on; PassiveAS is in percent points
    statMods: [{ stat: 'attackSpeed', value: 'PassiveAS / 100', when: 'flurry' }],
  },
  q: {
    hits: [
      { id: 'wave', label: 'Sonic Wave', type: 'physical', amount: 'InitialDamage' },
      // by the time he arrives the target has already lost what Sonic Wave dealt
      {
        id: 'strike', label: 'Resonating Strike', type: 'physical',
        amount: 'RecastDamage + (EmpoweredDamage - RecastDamage) * target.missingHpPct',
        note: 'Sonic Wave and the Resonating Strike recast are both counted; the recast grows with the health the target has lost by then.',
      },
    ],
  },
  // Safeguard shields, Iron Will gives omnivamp
  w: {},
  e: {
    // Cripple, the recast, only slows
    hits: [{ id: 'tempest', type: 'magic', amount: 'InitialDamage' }],
  },
  r: {
    // the bonus-health damage is dealt to enemies the kicked target flies into, never to the target itself
    hits: [{ id: 'kick', type: 'physical', amount: 'Damage' }],
  },
});
