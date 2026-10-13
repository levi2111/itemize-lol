import { champion } from '../dsl.ts';

/* Two things the game data leaves open. W is two abilities on one key: Crash Down
   while mounted, Mount Up while dismounted, and every cast switches the form.
   "Starts dismounted" picks the form a fight begins in. And Break the Mold's
   stolen resistances build hit by hit, so each of Rell's hits lands on a little
   less magic resist than the one before. */
export default champion('Rell', {
  reviewed: '16.20.1',
  vars: {
    // the armored form only exists once W has a rank
    armored: 'rank.w && (dismounted != swapped)',
  },
  options: {
    dismounted: { label: 'Starts dismounted (armored form)', default: false },
  },
  // mold: Break the Mold stacks on the target; swapped: 1 while W has changed the form the fight started in
  counters: { mold: { max: 'RellP.MaxStacks' }, swapped: {} },
  p: {
    rules: [
      // a share of her own resistances, which the armored form raises; the attack's stack lands after its damage
      {
        id: 'onhit', label: 'Break the Mold', on: 'onhit', type: 'magic',
        amount: 'OnHitDamage * (1 + RellW_Dismount.ResistanceIncrease * armored)', then: 'mold += 1',
      },
    ],
    // each stack takes a share of the target's resistance, and never less than the floor; it cannot push a resistance below zero.
    // five seconds of duration, refreshed by every hit, outlasts any gap in a combo
    resists: [
      { stat: 'armor', kind: 'reduceFlat', value: 'min(target.armor, mold * max(StealPercent * target.armor, StealFloor))', when: 'mold && target.armor > 0' },
      { stat: 'mr', kind: 'reduceFlat', value: 'min(target.mr, mold * max(StealPercent * target.mr, StealFloor))', when: 'mold && target.mr > 0' },
    ],
    notes: [
      'Each attack and each damaging ability adds one Break the Mold stack after its own damage; the stolen armor and magic resist are kept for the rest of the combo.',
    ],
  },
  q: {
    hits: [{ id: 'thrust', type: 'magic', amount: 'Damage', then: 'mold += 1' }],
  },
  w: {
    hits: [
      { id: 'crash', label: 'Crash Down', when: '!armored', type: 'magic', amount: 'DismountDamage', then: 'mold += 1' },
      // the flip is a bonus on her next attack, and that attack brings the stack
      {
        id: 'flip', label: 'Mount Up', when: 'armored', type: 'magic', amount: 'FlipDamage',
        note: 'Mount Up counts only what it adds to her next attack; put a basic attack after it in the combo.',
      },
      // last, so that neither hit above sees the form this cast leaves her in
      { id: 'form', type: 'magic', amount: 0, then: 'swapped = 1 - swapped' },
    ],
    // stats are worked out once per fight, so the attack speed follows the form the fight starts in
    statMods: [{ stat: 'attackSpeed', value: 'DismountedASBoost', when: 'dismounted' }],
    notes: [
      'Crash Down unless "Starts dismounted" is set, then Mount Up; every W in a combo switches between the two.',
      'The armored form\'s attack speed is counted for the whole fight when "Starts dismounted" is set, and not at all otherwise.',
    ],
  },
  e: {
    // the explosion rides on her next attack or Shattering Strike, which is counted on its own
    hits: [{
      id: 'explosion', type: 'magic', amount: 'MaxHealthDamageCalc * target.maxHp',
      note: 'Full Tilt counts the explosion it adds to her next attack or Shattering Strike; put one after it in the combo.',
    }],
  },
  r: {
    hits: [{ id: 'storm', type: 'magic', amount: 'TotalDamage', over: 'Duration', then: 'mold += 1', note: 'Magnet Storm is counted for its full duration.' }],
  },
});
