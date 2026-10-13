import { champion } from '../dsl.ts';

/* Corki's game data gives totals: the whole burn of Valkyrie, the whole spray of
   Gatling Gun, one missile. What the model adds is the order things happen in:
   the spray lands tick by tick while its shred builds up under it, and every
   third missile is the Big One. */
export default champion('Corki', {
  reviewed: '16.20.1',
  options: {
    shredded: { label: 'Gatling Gun shred already on the target', default: false },
  },
  // shred: Gatling Gun stacks on the target; fired: missiles since the last Big One
  counters: { shred: { max: 'GGun.ShredCap' }, fired: {} },
  p: {
    // on top of the attack itself, and it crits with it
    rules: [{ id: 'munitions', on: 'attack', type: 'true', amount: 'BasicAttackTOOLTIP', crit: 'CriticalStrikeTOOLTIP' }],
    notes: ['The bonus true damage Hextech Munitions adds to Spellblade items is not counted.'],
  },
  q: {
    hits: [{ id: 'bomb', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    // MaximumDamage is the whole burn; split so each tick sees the health the last one left
    hits: [{
      id: 'burn', type: 'magic', amount: 'MaximumDamage / MaximumTicks', count: 'MaximumTicks', over: 'TrailDuration',
      note: 'The target is counted as standing in Valkyrie\'s fire for its whole duration.',
    }],
  },
  e: {
    hits: [{
      id: 'spray', type: 'physical', amount: 'TotalDamage / (SprayDuration * TicksPerSecond)', count: 'SprayDuration * TicksPerSecond', over: 'SprayDuration',
      note: 'Every tick of Gatling Gun is counted. Its shred builds over the first ticks and is kept for the rest of the combo.',
    }],
    // each tick adds a stack after its own damage, so the first one lands on full resistances
    rules: [{ id: 'stack', on: 'damage', when: 'cast.e', type: 'physical', amount: 0, then: 'shred += 1' }],
    // ShredMax is stored negative and is the total at ShredCap stacks
    resists: [
      { stat: 'armor', kind: 'reduceFlat', value: 'if(shredded, ShredCap, shred) * abs(ShredMax) / ShredCap' },
      { stat: 'mr', kind: 'reduceFlat', value: 'if(shredded, ShredCap, shred) * abs(ShredMax) / ShredCap' },
    ],
  },
  r: {
    hits: [
      { id: 'load', type: 'physical', amount: 0, then: 'fired += 1' },
      { id: 'missile', type: 'physical', amount: 'RSmallMissileDamage', when: 'fired < 3' },
      // "every third missile" is only in the tooltip's prose
      {
        id: 'bigOne', label: 'The Big One', type: 'physical', amount: 'RBigMissileDamage', when: 'fired >= 3', then: 'fired = 0',
        note: 'Every third Missile Barrage in the combo is the Big One, counting from none fired.',
      },
    ],
  },
});
