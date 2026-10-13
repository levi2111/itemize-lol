import { champion } from '../dsl.ts';

/* Formless Blade's crit scaling is already inside its DamageCalc, so it gets no
   `crit` of its own. Its empowered attacks deal the same total AD as a basic
   attack (AttackTotalDamageTooltip), so they add nothing to what the engine
   counts; what the buff does change is attack speed. */
export default champion('Nilah', {
  reviewed: '16.20.1',
  options: {
    // up for as long as she keeps landing Q: the buff lasts as long as the cooldown
    formlessBlade: { label: 'Formless Blade attack speed active', default: true },
  },
  // Joy Unending only shares experience and boosts heals and shields
  p: {},
  q: {
    hits: [{ id: 'whip', type: 'physical', amount: 'DamageCalc' }],
    statMods: [
      // runs last so it sees the finished crit chance
      { stat: 'armorPenPct', value: 'CritArmorPen', phase: 'convert' },
      // BonusAttackSpeedCalc is in percent points
      { stat: 'attackSpeed', value: 'BonusAttackSpeedCalc / 100', when: 'formlessBlade' },
    ],
    notes: ['Formless Blade\'s attack speed is counted as active throughout; turn off "Formless Blade attack speed active" for attacks before the first Q lands.'],
  },
  // Jubilant Veil only dodges attacks, reduces magic damage taken and speeds her up
  w: {},
  e: {
    hits: [{ id: 'dash', type: 'physical', amount: 'DashDamage' }],
  },
  r: {
    hits: [
      // the tooltip total is the per-tick damage times the tick count, so their ratio is the count
      {
        id: 'whirl', label: 'Whirl', type: 'physical', amount: 'DamagePerTickCalc',
        count: 'DamagePerTickCalcTooltip / DamagePerTickCalc',
        note: 'Every tick of the Apotheosis whirl is counted, then the final burst.',
      },
      { id: 'burst', label: 'Final burst', type: 'physical', amount: 'DamageCalc' },
    ],
  },
});
