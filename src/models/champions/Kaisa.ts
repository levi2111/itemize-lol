import { champion } from '../dsl.ts';

/* Kai'Sa is most of the reasons models exist, in one champion:
   - Icathian Rain's tooltip gives damage per missile; a lone target takes all of
     them, each after the first at reduced damage.
   - The missile count depends on an evolution that depends on her stats.
   - Second Skin stacks across attacks and Void Seeker, then pops for a share of
     the target's missing health. */
export default champion('Kaisa', {
  reviewed: '16.20.1',
  vars: {
    // attack damage from levels counts toward the Icathian Rain evolution; ability power has no level growth
    qEvolved: 'bonusAd + adFromLevels >= KaisaQ.e6',
    wEvolved: 'ap >= KaisaW.e2',
    missiles: 'if(qEvolved, KaisaQ.e7, KaisaQ.e2)',
  },
  options: {
    supercharge: { label: 'Supercharge attack speed active', default: false },
  },
  counters: { plasma: {} },
  p: {
    rules: [
      // each attack hits for more per stack already on the target, then adds one
      { id: 'caustic', label: 'Plasma', on: 'onhit', type: 'magic', amount: 'PBaseDamage + PCurrentPerStackDamage * plasma', then: 'plasma += 1' },
      // going past the cap pops the stacks
      { id: 'rupture', label: 'Plasma rupture', on: 'after', when: 'plasma > PMaxStacks', type: 'magic', amount: 'PExecutePercentage * target.missingHp', then: 'plasma = 0' },
    ],
  },
  q: {
    hits: [{
      id: 'missiles', type: 'physical',
      amount: 'TotalIndividualMissileDamage * (1 + (missiles - 1) * ExtraHitReduction)',
      note: 'Every Icathian Rain missile is counted on the one target.',
    }],
  },
  w: {
    hits: [
      { id: 'blast', type: 'magic', amount: 'TotalDamage' },
      // the plasma it applies deals Second Skin's damage once, then adds its stacks
      {
        id: 'plasma', label: 'Plasma from Void Seeker', type: 'magic',
        amount: 'KaisaPassive.PBaseDamage + KaisaPassive.PCurrentPerStackDamage * plasma',
        then: 'plasma += if(wEvolved, e5, e4)',
      },
    ],
  },
  e: {
    // e5 is in percent points
    statMods: [{ stat: 'attackSpeed', value: 'e5 / 100', when: 'supercharge' }],
  },
  r: {},
});
