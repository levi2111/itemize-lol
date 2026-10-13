import { champion } from '../dsl.ts';

/* Absolution is three things at once:
   - Mist collected over the game is attack damage and crit chance. The game's own
     calculation reads the stacks from a buff the static data cannot see, so the
     bonus is rebuilt from the data values with the stacks as an option.
   - Every second hit on a champion siphons Mist for a share of its current health,
     after which the target cannot be marked for a while.
   - Her attacks hit for a share of her attack damage on top, and crit for less. */
export default champion('Senna', {
  reviewed: '16.20.1',
  vars: {
    marked: 'time < markUntil',
    // BonusCurentHealthDamage is in percent points. the game stops its growth at the level 11 breakpoint, which the
    // compiled calculation grows straight past; until it honours that breakpoint the last value it reaches is restated here
    siphon: 'min(SennaPassive.BonusCurentHealthDamage, 10) / 100 * target.hp',
  },
  options: {
    mist: { label: 'Mist stacks collected', kind: 'int', default: 0, min: 0 },
  },
  // markUntil: when the mark on the target runs out. immuneUntil: when it can be marked again
  counters: { markUntil: {}, immuneUntil: {} },
  p: {
    rules: [
      // a marked target is siphoned; an unmarked one that is not immune gets the mark. attacks and damaging casts each count once
      {
        id: 'siphon', label: 'Mist siphoned', on: 'attack', when: 'marked', type: 'physical', amount: 'siphon',
        then: ['markUntil = 0', 'immuneUntil = time + DebuffDuration'],
        note: 'Every second attack or ability hit siphons Mist for a share of the target\'s current health; the target then cannot be marked again for a few seconds.',
      },
      { id: 'mark', on: 'attack', when: '!marked && time >= immuneUntil', type: 'physical', amount: 0, then: 'markUntil = time + MarkDuration' },
      {
        id: 'siphonSpell', label: 'Mist siphoned', on: 'spell', when: 'marked', type: 'physical', amount: 'siphon',
        then: ['markUntil = 0', 'immuneUntil = time + DebuffDuration'],
      },
      { id: 'markSpell', on: 'spell', when: '!marked && time >= immuneUntil', type: 'physical', amount: 0, then: 'markUntil = time + MarkDuration' },
      // on-hit, so Piercing Darkness carries it too
      { id: 'cannon', label: 'Relic Cannon', on: 'onhit', type: 'physical', amount: 'BonusOnHitDamage' },
    ],
    statMods: [
      { stat: 'ad', value: 'mist * ADPerStack' },
      // BonusCritChance is in percent points, granted once per StacksForBonus stacks
      { stat: 'critChance', value: 'floor(mist / StacksForBonus) * BonusCritChance / 100' },
      // the modifier scales the whole crit, bonus crit damage from items included
      { stat: 'critDamage', value: '-(1 - CritDamageMod) * critDamage', phase: 'convert' },
    ],
    notes: ['Set "Mist stacks collected" to the souls Senna has gathered: they add attack damage and critical strike chance.'],
  },
  q: {
    hits: [{
      id: 'bolt', type: 'physical', amount: 'TotalDamage', appliesOnHit: true,
      note: 'Piercing Darkness is counted as carrying the bonus damage of Senna\'s attacks along with other on-hit effects.',
    }],
  },
  w: {
    hits: [{ id: 'embrace', type: 'physical', amount: 'Damage' }],
  },
  // Curse of the Black Mist only camouflages and speeds up
  e: {},
  r: {
    hits: [{ id: 'beam', type: 'physical', amount: 'TotalDamage' }],
  },
});
