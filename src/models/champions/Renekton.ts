import { champion } from '../dsl.ts';

/* Every basic ability has two versions, and which one a cast gets depends on the
   Fury Renekton holds at that moment. The game data has both versions' damage and
   every Fury amount; the model keeps the bar: what builds it, what spends it, and
   which version the cast therefore is.

   Ruthless Predator is the next attack struck two or three times, each strike
   with its own on-hit effects, so it is written as those strikes rather than as a
   bonus on the engine's attack. */
export default champion('Renekton', {
  reviewed: '16.20.1',
  vars: {
    fury: 'startFury + built',
    enraged: 'fury >= RenektonPredator.FuryCost',
  },
  options: {
    startFury: { label: 'Fury at the start of the fight', kind: 'int', default: 0, min: 0, max: 100 },
    auraSeconds: { label: 'Seconds the target stays in Dominus\'s aura', kind: 'int', default: 'RenektonReignOfTheTyrant.BuffDuration', min: 0 },
    dominus: { label: 'Dominus active (bonus health)', default: false },
  },
  counters: {
    // Fury gained less Fury spent this fight; the size of the bar is not in the ability data
    built: { max: '100 - startFury' },
    // whether the cast being played spent Fury
    emp: {},
    // when the armor reduction of an empowered Dice wears off
    shredUntil: {},
  },
  p: {
    rules: [
      // Slice never spends Fury, only its recast does: Slice and Dice settles that itself
      { id: 'spend', on: 'ability', when: 'cast.q || cast.w', type: 'physical', amount: 0, then: ['emp = enraged', 'built += -emp * FuryCost'] },
      // the strikes of an empowered Ruthless Predator generate none
      { id: 'attack', on: 'onhit', when: '!(cast.w && emp)', type: 'physical', amount: 0, then: 'built += FuryPerAttack' },
    ],
    notes: [
      'Fury is followed through the combo: attacks and abilities build it, and Cull the Meek, Ruthless Predator and the second dash of Slice and Dice are empowered when enough is there as they are cast. Set "Fury at the start of the fight" for the Fury Renekton walks in with.',
      'The Fury Dominus gives each second and the faster Fury gain at low health are not counted.',
    ],
  },
  q: {
    hits: [
      { id: 'swing', type: 'physical', when: '!emp', amount: 'BasicDamage', then: 'built += ChampionFuryGain' },
      { id: 'fury', label: 'Cull the Meek with Fury', type: 'physical', when: 'emp', amount: 'EmpDamage' },
    ],
  },
  w: {
    hits: [
      // only the first strike can crit, for the attack's usual bonus on top of the strike
      {
        id: 'first', label: 'First strike', type: 'physical', amount: 'HitDamage', crit: 'HitDamage + ad * (critDamage - 1)',
        appliesOnHit: true, then: 'built += if(emp, 0, BonusFuryVsChamps)',
      },
      { id: 'second', label: 'Second strike', type: 'physical', amount: 'HitDamage', appliesOnHit: true },
      { id: 'third', label: 'Third strike with Fury', type: 'physical', when: 'emp', amount: 'HitDamage', appliesOnHit: true },
    ],
    notes: ['Ruthless Predator is counted as the whole attack it empowers, on-hit effects included: two strikes, three with Fury. Do not add an auto attack for it.'],
  },
  e: {
    hits: [
      { id: 'slice', label: 'Slice', type: 'physical', amount: 'BasicDamage', then: ['built += ChampionRageGeneration', 'emp = enraged', 'built += -emp * RenektonPredator.FuryCost'] },
      { id: 'dice', label: 'Dice', type: 'physical', when: '!emp', amount: 'BasicDamage', then: 'built += ChampionRageGeneration' },
      // the armor reduction is taken to land with the dash's damage, so it helps from the next hit on
      { id: 'fury', label: 'Dice with Fury', type: 'physical', when: 'emp', amount: 'EmpDamage', then: 'shredUntil = time + ShredTimer' },
    ],
    // EnragedArmorShred is in percent points
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'EnragedArmorShred / 100', when: 'time < shredUntil' }],
    notes: ['One cast counts both dashes of Slice and Dice. The Fury the first dash generates counts toward empowering the second.'],
  },
  r: {
    // TotalDamagePerSecond is dealt in ticks every TickRate seconds
    hits: [{
      id: 'aura', type: 'magic', amount: 'TotalDamagePerSecond * TickRate', count: 'min(auraSeconds, BuffDuration) / TickRate',
      over: 'min(auraSeconds, BuffDuration)',
      then: 'built += FuryOnCast',
      note: 'One cast counts the target staying in Dominus\'s aura for its whole duration; lower "Seconds the target stays in Dominus\'s aura" for a shorter fight.',
    }],
    // the health matters to items that scale with it
    statMods: [{ stat: 'hp', value: 'HealthGain', when: 'dominus' }],
  },
});
