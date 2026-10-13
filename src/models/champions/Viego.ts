import { champion } from '../dsl.ts';

/* Blade of the Ruined King's passive is where the structure is: every on-hit
   takes a share of the target's current health, and an ability marks the target
   so the next attack strikes twice. The mark is a counter, so the order of the
   combo decides which attack gets the second strike. Heartbreaker is itself an
   attack: it applies on-hit effects and spends the mark. */
export default champion('Viego', {
  reviewed: '16.20.1',
  options: {
    mist: { label: 'Standing in Harrowed Path\'s mist', default: false },
  },
  counters: { mark: { max: 1 } },
  // Sovereign's Domination heals and lends Viego another champion's kit; it has no damage of its own
  p: {},
  q: {
    // TotalDamage already carries the stab's crit chance scaling
    hits: [{ id: 'stab', type: 'physical', amount: 'TotalDamage', then: 'mark = 1' }],
    rules: [
      // without a target the current health reads 0 and the minimum damage is what counts
      {
        id: 'blade', label: 'Blade of the Ruined King on-hit', on: 'onhit', type: 'physical',
        amount: 'max(MinDamageOnHit, TotalPercentHealthOnHit * target.hp)', crit: 'max(MinDamageOnHit, HealthCritDamage * target.hp)',
      },
      // on-hit rather than attack, so Heartbreaker's strike spends the mark too; it is cleared before its own on-hit runs
      {
        id: 'second', label: 'Second strike', on: 'onhit', when: 'mark', type: 'physical',
        amount: 'SecondAttackDamage', crit: 'SecondAttackDamage * critDamage', appliesOnHit: true, then: 'mark = 0',
        note: 'The first attack after Blade of the Ruined King or Spectral Maw strikes twice; Heartbreaker spends that mark but does not leave one.',
      },
    ],
  },
  w: {
    hits: [{ id: 'mist', type: 'magic', amount: 'TotalDamage', then: 'mark = 1' }],
  },
  e: {
    statMods: [{ stat: 'attackSpeed', value: "dv('AttackSpeed')", when: 'mist' }],
    notes: ['The attack speed is off unless "Standing in Harrowed Path\'s mist" is set.'],
  },
  r: {
    // TotalPercentHealth is in percent points
    hits: [{
      id: 'strike', type: 'physical', amount: 'TotalDamage + TotalPercentHealth / 100 * target.missingHp', appliesOnHit: true,
      note: 'Heartbreaker scales with the health the target has lost by the time it is cast.',
    }],
  },
});
