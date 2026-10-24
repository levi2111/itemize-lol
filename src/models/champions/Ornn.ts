import { champion } from '../dsl.ts';

/* Brittle is what ties the kit together: Bellows Breath and both passes of the
   ultimate leave it on the target, and the next thing of Ornn's that displaces
   them (an attack, Searing Charge's shockwave, the ultimate sent back) spends it
   for a share of their maximum health. The game data only has the amount, under
   Bellows Breath; who applies it and who spends it is the model. */
export default champion('Ornn', {
  reviewed: '16.20.1',
  vars: {
    brittleDamage: 'OrnnW.BrittlePercentMaxHPCalc * target.maxHp',
  },
  options: {
    terrain: { label: 'Searing Charge rams into terrain', default: true },
    recast: { label: 'Call of the Forge God is sent back through the target', default: true },
    masterworks: { label: 'Items upgraded to Masterwork', kind: 'int', default: 0, min: 0, max: 5 },
    rCast: { label: 'Call of the Forge God cast counted (0 both, 1 the elemental coming in, 2 sending it back)', kind: 'int', default: 0, min: 0, max: 2, timeline: true },
  },
  counters: { brittle: { max: 1 } },
  p: {
    rules: [
      // attacks knock a Brittle target back, which spends the mark
      { id: 'brittle', label: 'Brittle', on: 'attack', when: 'brittle', type: 'magic', amount: 'brittleDamage', then: 'brittle = 0' },
    ],
    // Living Forge raises only the bonus part of these stats, so each is added from the bonus the items give
    statMods: [
      { stat: 'hp', value: 'bonusHp * (BaseStatAmp + AdditionalMythicStatAmp * masterworks)' },
      { stat: 'armor', value: 'bonusArmor * (BaseStatAmp + AdditionalMythicStatAmp * masterworks)' },
      { stat: 'mr', value: 'bonusMr * (BaseStatAmp + AdditionalMythicStatAmp * masterworks)' },
    ],
    notes: [
      'Brittle is assumed to still be on the target when the next attack or knock-up lands.',
      'The extra stats of a Masterwork item itself are not added; "Items upgraded to Masterwork" only raises Living Forge\'s bonus.',
    ],
  },
  q: {
    hits: [{ id: 'fissure', type: 'physical', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{
      id: 'breath', type: 'magic', count: 'NumberOfTicks',
      // without a target the maximum health reads 0 and the minimum damage is what counts
      amount: 'max(MinimumDamagePerTick, PercentHPPerTick * target.maxHp)',
      then: 'brittle = 1',
      note: 'Every tick of Bellows Breath is counted, and the last one leaves the target Brittle.',
    }],
  },
  e: {
    hits: [
      { id: 'charge', type: 'physical', amount: 'TotalDamage' },
      // the shockwave's knock-up spends Brittle; the charge alone does not
      { id: 'brittle', label: 'Brittle', type: 'magic', when: 'terrain && brittle', amount: 'brittleDamage', then: 'brittle = 0' },
    ],
    notes: ['Searing Charge is assumed to ram into terrain and knock the target up; turn off "Searing Charge rams into terrain" if it does not.'],
  },
  r: {
    hits: [
      { id: 'pass', label: 'Elemental coming in', type: 'magic', amount: 'RDamageCalc', when: 'rCast != 2', then: 'brittle = 1' },
      // the knock-up of the second pass spends the Brittle the first one applied, then the pass applies it again
      { id: 'brittle', label: 'Brittle', type: 'magic', when: 'recast && brittle && rCast != 1', amount: 'brittleDamage', then: 'brittle = 0' },
      {
        id: 'back', label: 'Elemental sent back', type: 'magic', when: 'recast && rCast != 1', amount: 'RDamageCalc', then: 'brittle = 1',
        note: 'Both passes of Call of the Forge God are counted, and the target is left Brittle; turn off "Call of the Forge God is sent back through the target" to count the first pass only.',
      },
    ],
  },
});
