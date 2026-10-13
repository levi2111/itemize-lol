import { champion } from '../dsl.ts';

/* Brand's abilities are one line each; the kit is in Blaze. Every ability that
   lands adds a stack, each stack burns for a share of the target's maximum health,
   the third makes the target detonate, and Pillar of Flame hits harder on a target
   that is already burning. So the order of the combo matters, and a counter keeps it. */
export default champion('Brand', {
  reviewed: '16.20.1',
  vars: {
    // the tooltip states three stacks; the game data has no value for the count
    blazeMax: 3,
    // one stack's whole burn; PercentHealthDamage is in percent points
    burn: 'BrandPassive.PercentHealthDamage / 100 * target.maxHp',
  },
  options: {
    // a lone target takes every other bounce, so three at most, and one when the fireball has nothing to bounce off
    bounces: { label: 'Pyroclasm bounces that hit the target', kind: 'int', default: 3, min: 1, max: 3 },
  },
  counters: { blaze: { max: 'blazeMax' }, detonated: { max: 1 } },
  p: {
    rules: [
      // a stack past the third only refreshes the burn, so it adds none; Pyroclasm adds its own stacks below
      {
        id: 'burn', label: 'Blaze burn', on: 'spell', when: '!cast.r && blaze < blazeMax', type: 'magic', amount: 'burn', then: 'blaze += 1',
        // "over 4 seconds" is only in the tooltip's prose
        over: 4,
        note: 'Each Blaze stack is counted as its full 4-second burn, and Blaze is assumed to stay on the target for the whole combo.',
      },
      // the stacks are never reset: the target cannot be stacked up again for seconds after it detonates, and it stays Ablaze
      {
        id: 'detonate', label: 'Blaze detonation', on: 'after', when: 'blaze >= blazeMax && !detonated', type: 'magic',
        amount: 'ExplosionDamage * target.maxHp', then: 'detonated = 1',
        note: 'The third Blaze stack detonates 2 seconds later; the detonation is counted once per combo.',
      },
    ],
  },
  q: {
    hits: [{ id: 'fireball', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{
      id: 'pillar', type: 'magic', amount: 'if(blaze > 0, EmpoweredDamage, TotalDamage)',
      note: 'Pillar of Flame deals its increased damage when an earlier ability in the combo has set the target Ablaze.',
    }],
  },
  e: {
    hits: [{ id: 'blast', type: 'magic', amount: 'EDamageCalc' }],
  },
  r: {
    hits: [
      {
        id: 'bounce', type: 'magic', amount: 'TotalDamage', count: 'bounces',
        note: 'Unless "Pyroclasm bounces that hit the target" is lowered, Pyroclasm hits the target 3 times, bouncing off Brand or another enemy in between.',
      },
      // every bounce adds a stack
      { id: 'burn', label: 'Blaze burn', type: 'magic', amount: 'burn', count: 'min(bounces, blazeMax - blaze)', over: 4, then: 'blaze += bounces' },
    ],
  },
});
