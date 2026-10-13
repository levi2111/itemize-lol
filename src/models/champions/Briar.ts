import { champion } from '../dsl.ts';

/* Crimson Curse is a bleed that every attack and ability refreshes and stacks, so
   what one application is worth depends on how long ago the last one was. The game
   data gives the damage of one stack over the full duration; the model keeps the
   stack count and the time of the last application, and pays the bleed out as it
   is applied: the seconds that ran since the last application, plus (in a combo)
   what the new stack adds to the run-out after the last one.

   Snack Attack and Blood Frenzy share the W slot. Casting W in a combo is the
   bite; the frenzy's attack speed is an option, on by default because Briar's
   attacks on a champion happen in a frenzy (W, or the one Certain Death starts). */
export default champion('Briar', {
  reviewed: '16.20.1',
  vars: {
    // the tooltip calculation is one stack over the whole duration
    bleedPerSecond: 'BriarP.BleedDamageOverDurationTooltip / BriarP.BleedDuration',
    bleedAge: 'time - bleedAt',
    // stacks still on the target, and after this application
    bleedOn: 'if(bleed > 0 && bleedAge < BriarP.BleedDuration, bleed, 0)',
    bleedNext: 'min(bleedOn + 1, BriarP.MaxBleedStacks)',
    // each stack past the first adds a share of the first one's damage
    bleedRateOn: 'if(bleedOn, 1 + BriarP.BleedPercentAdd * (bleedOn - 1), 0)',
    bleedRateNext: '1 + BriarP.BleedPercentAdd * (bleedNext - 1)',
    // sustained attacking only counts bleed that has had the time to tick
    bleedDamage: 'bleedPerSecond * (bleedRateOn * bleedAge + if(sustained, 0, BriarP.BleedDuration * (bleedRateNext - bleedRateOn)))',
  },
  options: {
    frenzy: { label: 'Blood Frenzy active', default: true },
    wall: { label: 'Chilling Scream knocks the target into terrain', default: false },
  },
  // bleed: Crimson Curse stacks; bleedAt: when it was last applied; shredUntil: when Head Rush's shred runs out
  counters: { bleed: {}, bleedAt: {}, shredUntil: {} },
  p: {
    rules: [
      // over is what each application adds to the bleed's run: its whole duration when fresh, else the seconds since the last one.
      // they add up to the time the bleed ran, so the rate shown is its average over the stacks it went through
      { id: 'bleed', label: 'Crimson Curse', on: 'attack', type: 'physical', amount: 'bleedDamage', over: 'if(bleedOn, bleedAge, BleedDuration)', then: ['bleed = bleedNext', 'bleedAt = time'] },
      // Snack Attack rides on an attack, which applies the stack itself
      { id: 'bleedSpell', label: 'Crimson Curse', on: 'spell', when: '!cast.w', type: 'physical', amount: 'bleedDamage', over: 'if(bleedOn, bleedAge, BleedDuration)', then:['bleed = bleedNext', 'bleedAt = time'] },
    ],
    notes: [
      'Each attack and each damaging ability adds one stack of Crimson Curse.',
      'In a combo the bleed is counted until it runs out after the last hit; in sustained damage only the bleed that has already ticked is counted.',
    ],
  },
  q: {
    // the shred lands with the hit, so it helps from the next damage on
    hits: [{ id: 'leap', type: 'physical', amount: 'TotalDamage', appliesOnHit: true, then: 'shredUntil = time + ShredDuration' }],
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'ShredPercent', when: 'time < shredUntil' },
      { stat: 'mr', kind: 'reducePct', value: 'ShredPercent', when: 'time < shredUntil' },
    ],
    notes: ['Head Rush\'s armor and magic resist reduction applies to the damage that follows it in the combo, for as long as it lasts.'],
  },
  w: {
    // TotalAttackBonusDamage is the whole bite, attack included; the engine already counts the attack itself.
    // the frenzy's splash only hits enemies around the target
    hits: [{
      id: 'bite', label: 'Snack Attack', type: 'physical',
      amount: 'TotalAttackBonusDamage - ad + TotalAttackPercentMissingHealth / 100 * target.missingHp',
      note: 'Snack Attack counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
    statMods: [{ stat: 'attackSpeed', value: 'BerserkAS', when: 'frenzy' }],
    notes: ['Blood Frenzy\'s attack speed is counted unless "Blood Frenzy active" is turned off.'],
  },
  e: {
    hits: [
      { id: 'scream', type: 'magic', amount: 'Damage', note: 'Chilling Scream is counted fully charged.' },
      { id: 'wall', label: 'Chilling Scream into terrain', type: 'magic', amount: 'WallHitDamage', when: 'wall' },
    ],
    notes: ['The terrain bonus is off unless "Chilling Scream knocks the target into terrain" is set.'],
  },
  r: {
    // the frenzy it starts is the same option as Blood Frenzy; its other bonuses are defensive
    hits: [{ id: 'landing', type: 'magic', amount: 'Damage' }],
  },
});
