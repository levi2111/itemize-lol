import { champion } from '../dsl.ts';

/* Malphite's formulas are one calculation per ability; two of them read his own
   armor. What the model adds is Thunderclap: its passive raises that armor, and
   its active is not a hit but a bonus on the next attack plus an aftershock on
   every attack for a few seconds. */
export default champion('Malphite', {
  reviewed: '16.20.1',
  options: {
    graniteShield: { label: 'Granite Shield holding', default: false },
    thunderclap: { label: 'Thunderclap aftershocks active from the start', default: false },
  },
  // clap: the empowered attack is waiting; shockEnd: the time a cast Thunderclap's aftershocks run out
  counters: { clap: {}, shockEnd: {} },
  // Granite Shield only shields
  p: {},
  q: {
    hits: [{ id: 'shard', type: 'magic', amount: 'QDamageCalc' }],
  },
  w: {
    // a share of total armor, which Ground Slam and Thunderclap's own damage then scale with
    statMods: [{ stat: 'armor', phase: 'percent', value: 'BonusArmorPassive * if(graniteShield, BonusArmorPassiveMultiplier, 1)' }],
    hits: [{ id: 'cast', type: 'physical', amount: 0, then: ['clap = 1', 'shockEnd = time + ThunderclapBuffDuration'] }],
    rules: [
      { id: 'clap', label: 'Thunderclap empowered attack', on: 'attack', when: 'clap', type: 'physical', amount: 'TotalBonusDamage', then: 'clap = 0' },
      // the cone points at the attacked enemy, so the one target takes every aftershock
      { id: 'aftershock', label: 'Thunderclap aftershock', on: 'onhit', when: 'thunderclap || time < shockEnd', type: 'physical', amount: 'ThunderclapSplash' },
    ],
    notes: [
      'Thunderclap deals no damage of its own: the next attack after it in the combo deals its bonus damage, and every attack while it lasts sets off an aftershock. Set "Thunderclap aftershocks active from the start" to have the aftershocks from the first attack on, as in sustained damage.',
      'Thunderclap\'s armor is counted at its normal amount; set "Granite Shield holding" for the larger amount while the shield is up.',
    ],
  },
  e: {
    hits: [{ id: 'slam', type: 'magic', amount: 'EDamageCalc' }],
  },
  r: {
    hits: [{ id: 'impact', type: 'magic', amount: 'TotalDamage' }],
  },
});
