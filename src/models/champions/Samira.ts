import { champion } from '../dsl.ts';

/* The worked example. Run `npm run data:report -- --champion Samira` to see the
   names used below next to the tooltips they come from.

   The game data gives Inferno Trigger one calculation, DamageCalc: the damage of a
   single shot. That she fires ten of them is only written in the tooltip's prose.
   The model is where that fact lives. */
export default champion('Samira', {
  reviewed: '16.20.1',
  options: {
    melee: { label: 'Fighting in melee range', default: false },
    wildRush: { label: 'Wild Rush attack speed active', default: false },
  },
  p: {
    rules: [
      // bonus damage on attacks and on Q, W and E when in melee range; doubles as the target loses health
      { id: 'blade', label: 'Daredevil Impulse', on: 'attack', when: 'melee', type: 'magic', amount: 'BonusMeleeDamage * (1 + target.missingHpPct)' },
      { id: 'bladeSpell', label: 'Daredevil Impulse', on: 'spell', when: 'melee && !cast.r', type: 'magic', amount: 'BonusMeleeDamage * (1 + target.missingHpPct)' },
    ],
    notes: ['The melee bonus is off unless "Fighting in melee range" is set.'],
  },
  q: {
    hits: [{ id: 'shot', type: 'physical', amount: 'DamageCalc', crit: 'CriticalDamageCalc' }],
  },
  w: {
    hits: [{ id: 'slash', type: 'physical', amount: 'DamageCalc', count: 2, note: 'Both slashes of Blade Whirl are counted.' }],
  },
  e: {
    hits: [{ id: 'dash', type: 'magic', amount: 'DashDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'BonusAttackSpeed', when: 'wildRush' }],
  },
  r: {
    hits: [{ id: 'shots', type: 'physical', amount: 'DamageCalc', count: 10, crit: 'CriticalDamageCalc', note: 'All 10 shots of Inferno Trigger are counted.' }],
  },
});
