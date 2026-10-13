import { champion } from '../dsl.ts';

/* Two kits on one set of keys. Q, W and E each hold a Human Form ability and a
   Cougar Form one; the cougar formulas live on Aspect of the Cougar and scale with
   its rank. "Cougar Form" picks the form a fight starts in, and in an exact
   sequence every R switches it, so `q, r, w, q, e` is spear, pounce, Takedown on
   the Hunted target, swipe. */
export default champion('Nidalee', {
  reviewed: '16.20.1',
  vars: {
    inCougar: 'cougar != shifted',
    // hunt: 1 once this fight's spear or trap has marked the target, -1 once a Takedown has spent the mark; untouched, the option decides
    isHunted: 'hunt > 0 || (hunted && hunt == 0)',
    // the tooltip states the Hunted bonus as a plain 30%; the game data has no value for it
    takedown: 'AspectOfTheCougar.TotalTakedownDamage * (1 + AspectOfTheCougar.TakedownDamageAmp * target.missingHpPct) * (1 + 30% * isHunted)',
  },
  options: {
    cougar: { label: 'Cougar Form', default: false },
    hunted: { label: 'Target is already Hunted', default: false },
    longSpear: { label: 'Javelin Toss lands at maximum range', default: true },
    primalSurge: { label: 'Primal Surge attack speed active', default: false },
  },
  counters: { shifted: {}, hunt: {} },
  // Prowl itself is move speed and the Hunted mark; what the mark adds is part of Takedown
  p: {
    // kept here so that R stays an ability without damage
    rules: [{ id: 'shift', on: 'ability', when: 'cast.r', type: 'magic', amount: 0, then: 'shifted = 1 - shifted' }],
  },
  q: {
    hits: [
      {
        id: 'spear', label: 'Javelin Toss', when: '!inCougar', type: 'magic',
        amount: 'if(longSpear, HumanMaximumDamage, HumanMinimumDamage)', then: 'hunt = 1',
        note: 'Javelin Toss is counted at its maximum-range damage; with "Javelin Toss lands at maximum range" off it is the minimum.',
      },
      // the attack's whole damage becomes this magic damage, so it is a strike of its own rather than a bonus on top of an auto attack.
      // a crit adds the attack's usual crit bonus, outside the missing health and Hunted multipliers
      {
        id: 'takedown', label: 'Takedown', when: 'inCougar && rank.r', type: 'magic',
        amount: 'takedown', crit: 'takedown + ad * (critDamage - 1)', appliesOnHit: true, then: 'hunt = -1',
        note: 'Takedown is the whole empowered attack, on-hit effects included: do not add an auto attack for it. Its bonus against a Hunted target needs "Target is already Hunted".',
      },
    ],
    notes: ['Javelin Toss unless "Cougar Form" is set, then Takedown.'],
  },
  w: {
    hits: [
      {
        id: 'trap', label: 'Bushwhack', when: '!inCougar', type: 'magic', amount: 'DamagePerSecond', count: 'DotDuration', over: 'DotDuration', then: 'hunt = 1',
        note: 'Bushwhack is counted for its full duration, as if the target walks onto the trap at once.',
      },
      { id: 'pounce', label: 'Pounce', when: 'inCougar && rank.r', type: 'magic', amount: 'AspectOfTheCougar.TotalPounceDamage' },
    ],
    notes: ['Bushwhack unless "Cougar Form" is set, then Pounce.'],
  },
  e: {
    hits: [{ id: 'swipe', label: 'Swipe', when: 'inCougar && rank.r', type: 'magic', amount: 'AspectOfTheCougar.TotalSwipeDamage' }],
    // the heal's attack speed carries over into Cougar Form
    statMods: [{ stat: 'attackSpeed', value: 'BonusAS', when: 'primalSurge' }],
    notes: ['Primal Surge deals no damage; with "Cougar Form" set this is Swipe.'],
  },
  // only changes form
  r: {
    notes: ['The Cougar Form abilities use this rank. Nidalee always has at least one, so they deal nothing while R is at rank 0.'],
  },
});
