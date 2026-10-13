import { champion } from '../dsl.ts';

/* Wukong's game data has one calculation per ability and a single number for
   the Clone: the share of normal damage it deals. What the model adds: the
   Clone attacks on its own while it stands, and repeats Crushing Blow and
   Cyclone when they are used while it is up; Crushing Blow's armor shred runs
   out; and Cyclone's damage per second lands as ticks over the spin. */
export default champion('MonkeyKing', {
  reviewed: '16.20.1',
  vars: {
    cloneUp: 'time < cloneUntil',
    cloneShare: 'MonkeyKingDecoy.CloneDamageMod',
    spinTick: '(MonkeyKingSpinToWin.DamagePerSecondTotal + MonkeyKingSpinToWin.BasePercentMaxHPDmgPerSec * target.maxHp) * MonkeyKingSpinToWin.SecondsPerTick',
  },
  options: {
    nimbus: { label: 'Nimbus Strike attack speed active', default: false },
  },
  // shredUntil: when Crushing Blow's armor shred on the target runs out; cloneUntil: when the Clone disappears
  counters: { shredUntil: {}, cloneUntil: {} },
  // Stone Skin only gives armor and health regeneration
  p: {},
  q: {
    hits: [
      // the armor is removed before the blow's damage, so the blow itself benefits
      { id: 'shred', type: 'physical', amount: 0, then: 'shredUntil = time + ShredDuration' },
      {
        id: 'blow', type: 'physical', amount: 'BonusDamageTT',
        note: 'Crushing Blow counts only what it adds to the attack; put a basic attack after it in the combo.',
      },
      { id: 'cloneBlow', label: 'Clone\'s Crushing Blow', when: 'cloneUp', type: 'physical', amount: 'BonusDamageTT * cloneShare' },
    ],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ArmorShredPercent', when: 'time < shredUntil' }],
    notes: ['Crushing Blow\'s armor shred applies to its own damage and to what follows it in the combo, for as long as it lasts.'],
  },
  w: {
    hits: [
      { id: 'clone', type: 'physical', amount: 0, then: 'cloneUntil = time + CloneDuration' },
      {
        id: 'cloneAttacks', label: 'Clone\'s attacks', type: 'physical',
        // attacks are not rounded, so attack speed has no steps here
        count: 'CloneDuration * attackSpeed', over: 'CloneDuration',
        amount: 'ad * CloneDamageMod', crit: 'ad * critDamage * CloneDamageMod',
        note: 'The Clone is counted attacking the target for as long as it stands, at Wukong\'s attack speed and without on-hit effects.',
      },
    ],
    notes: ['The Clone repeats Crushing Blow and Cyclone only when Warrior Trickster comes before them in the combo.'],
  },
  e: {
    // the extra clones dash to other enemies
    hits: [{ id: 'strike', type: 'magic', amount: 'TotalDamage' }],
    statMods: [{ stat: 'attackSpeed', value: 'dv(\'AttackSpeed\')', when: 'nimbus' }],
  },
  r: {
    hits: [
      {
        id: 'spin', type: 'physical', amount: 'spinTick', count: 'SpinDuration / SecondsPerTick', over: 'SpinDuration',
        note: 'Every tick of one full Cyclone spin is counted; add R to the combo a second time for the second cast.',
      },
      { id: 'cloneSpin', label: 'Clone\'s Cyclone', when: 'cloneUp', type: 'physical', amount: 'spinTick * cloneShare', count: 'SpinDuration / SecondsPerTick', over: 'SpinDuration' },
    ],
  },
});
