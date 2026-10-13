import { champion } from '../dsl.ts';

/* Rammus's damage comes from his resistances: Spiked Shell turns armor and magic
   resist into attack damage, and Defensive Ball Curl raises both and answers every
   attack against him. The game data has the formulas; the model adds that the
   curl's resistances feed the passive, and that its damage is per enemy attack. */
export default champion('Rammus', {
  reviewed: '16.20.1',
  options: {
    curl: { label: 'Defensive Ball Curl active', default: false },
    attacksTaken: { label: 'Enemy attacks taken during Defensive Ball Curl', kind: 'int', default: 3, min: 0 },
    rolling: { label: 'Soaring Slam cast during Powerball', default: false },
  },
  p: {
    // runs last, so it sees the resistances Defensive Ball Curl and items leave him with
    statMods: [{ stat: 'ad', phase: 'convert', value: 'TotalDamage' }],
  },
  q: {
    hits: [{ id: 'collision', type: 'magic', amount: 'PowerBallDamage' }],
  },
  w: {
    // a flat amount, then a share of the total including that flat amount
    statMods: [
      { stat: 'armor', value: 'FlatBonusArmor', when: 'curl' },
      { stat: 'armor', phase: 'percent', value: 'BonusArmorPercent', when: 'curl' },
      { stat: 'mr', value: 'FlatBonusMR', when: 'curl' },
      { stat: 'mr', phase: 'percent', value: 'BonusMRPercent', when: 'curl' },
    ],
    hits: [{
      // the return damage scales with the curl's own resistances, also when the option leaves them off his stats
      id: 'return', label: 'Damage returned to attackers', type: 'magic', count: 'attacksTaken',
      amount: 'ReturnDamageCalc + if(curl, 0, DamageArmorRatio * BonusArmorTooltip + DamageMRRatio * BonusMRTooltip)',
      note: 'Defensive Ball Curl only deals damage when the enemy attacks Rammus: one cast counts the number in "Enemy attacks taken during Defensive Ball Curl", 3 unless set.',
    }],
    notes: ['The armor and magic resist of Defensive Ball Curl, and the attack damage Spiked Shell makes of them, are counted only with "Defensive Ball Curl active" set.'],
  },
  // Frenzying Taunt only taunts a champion; its damage is to monsters
  e: {},
  r: {
    hits: [
      { id: 'slam', type: 'magic', amount: 'InitialDamageCalc' },
      // the roll ends with the slam instead of colliding, so this replaces Q's own hit
      {
        id: 'powerball', label: 'Powerball damage in the center', type: 'magic', when: 'rolling && rank.q', amount: 'PowerBall.PowerBallDamage',
        note: 'With "Soaring Slam cast during Powerball" set, R also deals Powerball\'s damage to a target in the center; leave Q out of the combo then.',
      },
    ],
  },
});
