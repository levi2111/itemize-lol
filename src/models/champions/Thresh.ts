import { champion } from '../dsl.ts';

/* Two things the game data cannot say on its own:
   - Souls are a buff the static data cannot see, so every calculation that reads
     them counts none. They are an option here, and what they add is rebuilt from
     the data values.
   - Flay's passive is given as a minimum and a maximum. Where an attack falls
     between them is how long ago Thresh last attacked, which the fight's clock knows. */
export default champion('Thresh', {
  reviewed: '16.20.1',
  vars: {
    // share of the full charge built up since the last attack; before the first one it is the option's choice,
    // and without it the attack counts as following another at the same pace
    flayCharge: 'if(swung, clamp((time - swungAt) / ThreshE.FullChargeDuration, 0, 1), if(flayCharged, 1, min(1, 1 / (attackSpeed * ThreshE.FullChargeDuration))))',
  },
  options: {
    souls: { label: 'Souls collected', kind: 'int', default: 0, min: 0 },
    // a trade opens with a charged attack; damage per second is about the attacks that follow each other
    flayCharged: { label: 'Flay fully charged for the first attack', default: 'not(sustained)' },
  },
  // swung: Thresh has attacked this fight; swungAt: when
  counters: { swung: { max: 1 }, swungAt: {} },
  p: {
    // the armor each soul also gives is not modeled
    statMods: [{ stat: 'ap', value: 'souls * StatValuePerSoul' }],
    notes: ['Set "Souls collected" to the souls Thresh has gathered: they add ability power and damage to his attacks.'],
  },
  q: {
    // the recast only moves Thresh
    hits: [{ id: 'hook', type: 'magic', amount: 'TotalDamage' }],
  },
  // Dark Passage only shields and carries an ally
  w: {},
  e: {
    hits: [{ id: 'flay', type: 'magic', amount: 'TotalDamage' }],
    rules: [{
      id: 'chains', label: 'Flay on attack', on: 'attack', type: 'magic',
      amount: 'souls * DmgPerSoul + ad * PassiveADRatioTT * flayCharge',
      then: ['swung = 1', 'swungAt = time'],
      note: 'The first attack of a combo is counted with Flay fully charged; later attacks only have the charge built up since the attack before, a full charge taking 10 seconds. Damage per second counts every attack at that reduced charge.',
    }],
  },
  r: {
    // only the first wall broken deals damage, so a lone target takes it once
    hits: [{ id: 'wall', type: 'magic', amount: 'TotalDamage', note: 'The Box only deals damage if the target runs into a wall; that one hit is counted.' }],
  },
});
