import { champion } from '../dsl.ts';

/* Two of Nautilus' abilities ride on his basic attacks. Staggering Blow is an
   attack's bonus that comes back per target after a cooldown, and Titan's Wrath
   deals nothing when cast: it makes the attacks of the next seconds burn. The
   game data gives the amounts; when an attack carries them is the model. */
export default champion('Nautilus', {
  reviewed: '16.20.1',
  options: {
    wrath: { label: 'Titan\'s Wrath shield up from the start', default: false },
  },
  // wrathEnd: the moment a cast Titan's Wrath runs out
  counters: { wrathEnd: {} },
  p: {
    // TotalDamageTooltip is the whole empowered attack; the engine already counts the attack itself
    rules: [{
      id: 'blow', on: 'attack', type: 'physical', amount: 'BonusDamage', cooldown: 'PerTargetCD',
      note: 'Staggering Blow empowers the first attack, and another one each time its cooldown on the target has passed.',
    }],
  },
  q: {
    hits: [{ id: 'anchor', type: 'magic', amount: 'QDamageCalc' }],
  },
  w: {
    hits: [{ id: 'shield', type: 'magic', amount: 0, then: 'wrathEnd = time + ShieldDuration' }],
    rules: [{
      id: 'burn', on: 'attack', when: 'time < wrathEnd || (wrath && time < ShieldDuration)', type: 'magic', amount: 'DotDamageCalc',
      // "over 2 seconds" is only in the tooltip's prose; each attack applies its own burn
      over: 2,
      note: 'Every attack under Titan\'s Wrath is counted with its full damage over time, and the shield is assumed to hold for its whole duration.',
    }],
    notes: ['Titan\'s Wrath deals no damage of its own: attacks made after it in the combo burn the target while it lasts. Set "Titan\'s Wrath shield up from the start" to count it from the first attack instead.'],
  },
  e: {
    hits: [
      { id: 'wave', type: 'magic', amount: 'DamageCalc' },
      // the tooltip states three waves; the game data has no value for the count
      {
        id: 'further', label: 'Further waves', type: 'magic', amount: 'DamageCalc * (1 - ExtraWavePenalty)', count: 2,
        note: 'All three waves of Riptide are counted on the one target.',
      },
    ],
  },
  r: {
    // the chased champion takes the primary damage only; the eruptions on the way are for others
    hits: [{ id: 'charge', type: 'magic', amount: 'PrimaryTargetDamage' }],
  },
});
