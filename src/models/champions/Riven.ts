import { champion } from '../dsl.ts';

/* Broken Wings is three casts that each deal the same damage and each count as an
   ability for Runic Blade, so one Q in the combo is one slash. Runic Blade's
   charges are a counter: every ability adds one, every attack spends one. */
export default champion('Riven', {
  reviewed: '16.20.1',
  options: {
    exile: { label: 'Blade of the Exile active', default: true },
  },
  counters: { charges: { max: 'RivenPassive.Charges' } },
  p: {
    rules: [
      { id: 'charge', on: 'ability', type: 'physical', amount: 0, then: 'charges += 1' },
      // the bonus crits along with the attack that carries it
      {
        id: 'blade', on: 'attack', when: 'charges > 0', type: 'physical',
        amount: 'TotalDamage', crit: 'TotalDamage * critDamage', then: 'charges += -1',
      },
    ],
    notes: ['Each ability in the combo charges one attack after it with Runic Blade; attacks before any ability, or beyond the charges held, get no bonus.'],
  },
  q: {
    hits: [{
      id: 'slash', type: 'physical', amount: 'FirstSlashDamage',
      note: 'Each Q in the combo is one slash of Broken Wings; add three for the whole ability.',
    }],
  },
  w: {
    hits: [{ id: 'burst', type: 'physical', amount: 'TotalDamage' }],
  },
  // Valor is a dash and a shield; it still charges Runic Blade like any ability
  e: {},
  r: {
    hits: [{
      id: 'windSlash', label: 'Wind Slash', type: 'physical',
      // the data has no value for where the scaling tops out: at three quarters of the target's health missing
      amount: 'MinDamage + (MaxDamage - MinDamage) * min(1, target.missingHpPct / 75%)',
      // the activation and the recast are two abilities
      then: 'charges += 1',
      note: 'Wind Slash grows with the health the target has lost by the time R comes up in the combo, reaching its maximum at 75% missing health; put R last to finish with it.',
    }],
    // BonusAD, written as a share of total attack damage so it does not read the stat it changes
    statMods: [{ stat: 'ad', phase: 'percent', value: 'PercentBonusAD', when: 'exile' }],
    notes: [
      'The attack damage of Blade of the Exile is counted for the whole combo; turn off "Blade of the Exile active" for a trade without the ultimate.',
      'One R is the activation and Wind Slash together, so it grants two Runic Blade charges.',
    ],
  },
});
