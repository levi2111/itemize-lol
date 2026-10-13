import { champion } from '../dsl.ts';

/* Master Yi's damage is his basic attacks, and the kit is what rides on them:
   - Double Strike counts attacks; the extra strike is an attack of its own.
   - Alpha Strike gives the damage of one strike. A lone target takes all of
     them, the repeats reduced, and every one applies on-hit effects at a
     fraction of their strength.
   - Wuju Style and Highlander are states rather than hits. */
export default champion('MasterYi', {
  reviewed: '16.20.1',
  vars: {
    wuju: 'wujuStyle || time < wujuUntil',
  },
  options: {
    wujuStyle: { label: 'Wuju Style active', default: false },
    highlander: { label: 'Highlander active', default: false },
  },
  // strikes: Double Strike stacks; alpha: 1 while Alpha Strike's repeat strikes are being played; wujuUntil: when this fight's Wuju Style runs out
  counters: { strikes: {}, alpha: {}, wujuUntil: {} },
  p: {
    rules: [
      // only real attacks stack it: Alpha Strike's on-hit does not
      { id: 'stack', on: 'attack', type: 'physical', amount: 0, then: 'strikes += 1' },
      // the second strike crits and applies on-hit effects, and that on-hit is already a stack toward the next one
      {
        id: 'second', label: 'Second strike', on: 'attack', when: 'strikes >= AttackCount', type: 'physical',
        amount: 'TotalDamage', crit: 'TotalDamage * critDamage', appliesOnHit: true, then: 'strikes = 1',
        note: 'Double Strike is counted from the first attack of the combo. Its second strike counts toward the next one, so after the first it comes every third attack.',
      },
    ],
  },
  q: {
    hits: [
      // the repeat strikes on the same enemy land at once, the full one when he reappears
      { id: 'vanish', type: 'physical', amount: 0, then: 'alpha = 1' },
      {
        id: 'repeat', label: 'Repeat strikes', type: 'physical', count: 'AlphaStrikeBounces - 1', then: 'alpha = 0',
        amount: 'SubesquentDamage', crit: 'SubesquentDamage * (1 + BonusCritDamageRatio * (critDamage - 1))',
      },
      {
        id: 'strike', type: 'physical', amount: 'TotalDamage', crit: 'TotalDamage + CritBonus', appliesOnHit: 0.75,
        note: 'Every strike of Alpha Strike is counted on the one target: one at full damage and the rest reduced, each applying on-hit effects at reduced strength.',
      },
    ],
    // a rule's own on-hit goes off once however many strikes it has, so each repeat strike sets it off here instead.
    // the engine takes on-hit strength as a plain number: BaseOnHitMultiplier above, and that times SubsequentHitMultiplier here
    rules: [{ id: 'onhit', on: 'damage', when: 'alpha', type: 'physical', amount: 0, appliesOnHit: 0.1875 }],
  },
  // Meditate only heals and reduces the damage Master Yi takes
  w: {},
  e: {
    hits: [{
      id: 'activate', type: 'true', amount: 0, then: 'wujuUntil = time + Duration',
      note: 'Casting Wuju Style empowers the attacks that follow it in the combo, until its duration runs out. For damage per second, set "Wuju Style active".',
    }],
    rules: [{ id: 'wuju', on: 'onhit', when: 'wuju', type: 'true', amount: 'TotalDamage' }],
  },
  r: {
    // RASBonus is in percent points
    statMods: [{ stat: 'attackSpeed', value: 'RASBonus / 100', when: 'highlander' }],
    notes: ['The attack speed is off unless "Highlander active" is set.'],
  },
});
