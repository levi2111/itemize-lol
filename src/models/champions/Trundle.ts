import { champion } from '../dsl.ts';

/* Trundle's damage is his attacks. Chomp is an attack with a bonus and then
   attack damage, Frozen Domain is attack speed, and Subjugate is one calculation
   for the whole drain. What the model adds is how the drain is paid out, half at
   once and the rest in ticks, with the stolen resistances growing under it. */
export default champion('Trundle', {
  reviewed: '16.20.1',
  vars: {
    // share of Subjugate's shred on the target right now
    drained: 'if(subjugated, 1, if(time < drainedUntil, drain, 0))',
  },
  options: {
    // Chomp comes back before its attack damage runs out, so a long fight has it throughout
    chomped: { label: 'Chomp attack damage active', default: 'sustained' },
    frozenDomain: { label: 'Standing in Frozen Domain (attack speed)', default: false },
    subjugated: { label: 'Subjugate\'s full shred already on the target', default: false },
  },
  // drain: share of Subjugate's shred applied so far; drainedUntil: when it runs out
  counters: { drain: { max: 1 }, drainedUntil: {} },
  // King's Tribute only heals
  p: {},
  q: {
    // TotalDamage is the whole empowered attack; the engine already counts the attack itself
    hits: [{
      id: 'bite', type: 'physical', amount: 'TotalDamage - ad',
      note: 'Chomp counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
    // the attack damage is a stat, and stats are settled before the fight, so it cannot switch on after the bite
    statMods: [{ stat: 'ad', value: 'BonusAD', when: 'chomped' }],
    notes: ['Chomp\'s attack damage is not gained during the combo: it counts from the first hit when "Chomp attack damage active" is set, as in sustained damage, and not at all otherwise.'],
  },
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'ASBonus', when: 'frozenDomain' }],
    notes: ['Frozen Domain deals no damage. Its attack speed is off unless "Standing in Frozen Domain" is set.'],
  },
  // Pillar of Ice only knocks back and slows
  e: {},
  r: {
    hits: [
      // the shred is taken as landing with the damage, so the first half does not benefit from it
      {
        id: 'drain', type: 'magic', amount: 'TotalPercentHPDamage * target.maxHp * PercentOfDamageAndShredUpfront',
        then: ['drain = PercentOfDamageAndShredUpfront', 'drainedUntil = time + ShredDuration'],
      },
      {
        id: 'ticks', label: 'Subjugate draining', type: 'magic', count: 'NumberOfTicks',
        amount: 'TotalPercentHPDamage * target.maxHp * (1 - PercentOfDamageAndShredUpfront) / NumberOfTicks',
        // one tick a second for 4 seconds; ActualDurationOfDrainBuff (5) is the buff, which outlasts the last tick
        over: 'DurationOfDrainForTooltip',
        note: 'The whole drain of Subjugate is counted at the cast, and its full shred applies to what follows in the combo for as long as it lasts.',
      },
    ],
    // each tick steals its share after its own damage
    rules: [{ id: 'steal', on: 'damage', when: 'cast.r && hit.magic', type: 'magic', amount: 0, then: 'drain += (1 - PercentOfDamageAndShredUpfront) / NumberOfTicks' }],
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'ArmorMRShred * drained' },
      { stat: 'mr', kind: 'reducePct', value: 'ArmorMRShred * drained' },
    ],
  },
});
