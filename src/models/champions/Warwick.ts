import { champion } from '../dsl.ts';

/* Warwick's bite and his ultimate are strikes: both apply on-hit effects, so
   Eternal Hunger rides on them as it does on attacks. Infinite Duress has one
   calculation for the whole channel; that it lands as three strikes, each with
   its own on-hit, is only in the tooltip's prose. */
export default champion('Warwick', {
  reviewed: '16.20.1',
  options: {
    bloodHunt: { label: 'Blood Hunt attack speed active', default: false },
    lowHealth: { label: 'Blood Hunt target at low health (bonus increased)', default: false },
  },
  p: {
    rules: [{ id: 'hunger', on: 'onhit', type: 'magic', amount: 'OnHitDamage' }],
  },
  q: {
    // TargetPercentHPDamage is in percent points; the cap on it is for monsters
    hits: [{ id: 'bite', type: 'magic', amount: 'BaseBiteDamage + TargetPercentHPDamage / 100 * target.maxHp', appliesOnHit: true }],
  },
  w: {
    // PassiveASBonus is in percent points; the tooltip states the low-health increase, the game data has no value for it.
    // a target at low health is past the first threshold too, so that option alone turns the bonus on
    statMods: [{ stat: 'attackSpeed', value: 'PassiveASBonus / 100 * (1 + 200% * lowHealth)', when: 'bloodHunt || lowHealth' }],
    notes: ['The attack speed is off unless "Blood Hunt attack speed active" is set: the target is below half health, or Blood Hunt was cast on it.'],
  },
  // Primal Howl only reduces damage taken and fears
  e: {},
  r: {
    // the tooltip states three strikes; the game data has no value for the count.
    // a hit's own on-hit goes off once however high its count, so the strikes are written out
    hits: [
      { id: 'first', type: 'magic', amount: 'DamageCumulative / 3', appliesOnHit: true, over: 'RDuration' },
      { id: 'second', type: 'magic', amount: 'DamageCumulative / 3', appliesOnHit: true, over: 'RDuration' },
      {
        id: 'third', type: 'magic', amount: 'DamageCumulative / 3', appliesOnHit: true, over: 'RDuration',
        note: 'The full Infinite Duress channel is counted: three strikes, each applying on-hit effects.',
      },
    ],
  },
});
