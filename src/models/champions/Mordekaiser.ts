import { champion } from '../dsl.ts';

/* Darkness Rise is the structure here. The game data gives the aura's damage per
   second and how long it outlasts the last hit; that it switches on at the third
   attack or basic ability and that every later one starts its duration over is
   the model.

   The aura is counted where it is kept alive: the hit that switches it on brings
   its whole duration, and each hit after that is paid for the time that passed
   since the one before, which is exactly what its refresh adds. */
export default champion('Mordekaiser', {
  reviewed: '16.20.1',
  vars: {
    // PercentHealthForAura is in percent points of the target's maximum health
    auraPerSecond: 'MordekaiserPassive.AuraDamagePerStack + MordekaiserPassive.PercentHealthForAura / 100 * target.maxHp',
    // read after the hit has added its stack
    lit: 'risen || darkness >= MordekaiserPassive.MaximumStacks',
    // sustained attacking has no last hit to burn on after, so there each attack pays for the time until the next
    auraSeconds: 'if(sustained, 1 / attackSpeed, if(burning, clamp(time - refreshed, 0, MordekaiserPassive.CombatTrackingDuration), MordekaiserPassive.CombatTrackingDuration))',
  },
  options: {
    isolated: { label: 'Obliterate hits only this enemy', default: true },
    risen: { label: 'Darkness Rise active from the start', default: 'sustained' },
    realm: { label: 'Target is in the Realm of Death from the start', default: false },
  },
  // darkness: stacks toward the aura; burning: the aura is on and its duration has been counted;
  // refreshed: when it was last kept alive; banished: Realm of Death was cast
  counters: { darkness: { max: 'MordekaiserPassive.MaximumStacks' }, burning: { max: 1 }, refreshed: {}, banished: { max: 1 } },
  p: {
    rules: [
      { id: 'empowered', label: 'Darkness Rise on attacks', on: 'onhit', type: 'magic', amount: 'BonusAPAuto' },
      // attacks and basic abilities that hit a champion each add a stack
      { id: 'stack', on: 'attack', type: 'magic', amount: 0, then: 'darkness += FuryForAutoHit' },
      { id: 'stackSpell', on: 'spell', when: 'cast.q || cast.e', type: 'magic', amount: 0, then: 'darkness += if(cast.q, FuryForQHit, FuryForEHit)' },
      {
        id: 'aura', label: 'Darkness Rise aura', on: 'attack', when: 'lit', type: 'magic', amount: 'auraPerSecond * auraSeconds',
        // the seconds this hit pays for; this rule and the next are one aura, split by what keeps it alive
        over: 'auraSeconds',
        then: ['burning = 1', 'refreshed = time'],
        note: 'Darkness Rise\'s aura starts with the third attack or basic ability and burns for as long as the combo takes, then for its full duration after the last hit, with the target staying in range.',
      },
      {
        id: 'auraSpell', label: 'Darkness Rise aura', on: 'spell', when: 'lit && (cast.q || cast.e)', type: 'magic', amount: 'auraPerSecond * auraSeconds',
        over: 'auraSeconds',
        then: ['burning = 1', 'refreshed = time'],
      },
    ],
    notes: ['Damage per second counts Darkness Rise\'s aura as already active; set "Darkness Rise active from the start" to have that in a combo.'],
  },
  q: {
    hits: [{
      id: 'smash', type: 'magic', amount: 'if(isolated, EmpoweredDamageTooltip, QDamage)',
      note: 'Obliterate deals its increased single-enemy damage unless "Obliterate hits only this enemy" is turned off.',
    }],
  },
  // Indestructible only shields and heals
  w: {},
  e: {
    hits: [{ id: 'pull', type: 'magic', amount: 'TotalDamage' }],
    statMods: [{ stat: 'magicPenPct', value: 'MagicPen' }],
  },
  r: {
    // no damage of its own; the stolen armor and magic resistance are what a build can feel
    hits: [{ id: 'banish', type: 'magic', amount: 0, then: 'banished = 1' }],
    resists: [
      { stat: 'armor', kind: 'reducePct', value: 'StatStealPercentScalar', when: 'realm || banished' },
      { stat: 'mr', kind: 'reducePct', value: 'StatStealPercentScalar', when: 'realm || banished' },
    ],
    notes: [
      'Realm of Death takes the stolen share of the target\'s armor and magic resistance off for the rest of the combo once it is cast; set "Target is in the Realm of Death from the start" to have that from the first hit, and in damage per second.',
      'The attack damage, ability power, attack speed and health Realm of Death steals are not counted.',
    ],
  },
});
