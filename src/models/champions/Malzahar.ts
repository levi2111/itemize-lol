import { champion } from '../dsl.ts';

/* Three things the game data leaves to the model:
   - Void Swarm's calculation is one attack of one Voidling. How many Voidlings
     come out follows from the stacks his other casts gave him; how often each
     attacks has no value at all, so that is a stepper.
   - Malefic Visions is given as a total over its duration, but Call of the Void
     and Nether Grasp restart that duration. Every restart adds the seconds that
     had already run, which the fight's clock can tell.
   - Nether Grasp is two amounts: the beam, and a zone under the target that
     takes a share of its maximum health. */
export default champion('Malzahar', {
  reviewed: '16.20.1',
  vars: {
    // stacks held when the fight starts count once, toward the first Void Swarm
    stacks: 'clamp(swarm + swarmStacks, 0, MalzaharW.StackCap)',
    // the moment a refresh lands: the portals fire after a delay, the beam keeps refreshing until its channel ends
    refreshAt: 'time + if(cast.r, MalzaharR.CCDuration, MalzaharQ.DelayPostCast)',
  },
  options: {
    swarmStacks: { label: 'Void Swarm stacks at the start', kind: 'int', default: 0, min: 0 },
    voidlingAttacks: { label: 'Attacks each Voidling lands on the target', kind: 'int', default: 3, min: 0 },
  },
  // swarm: stacks gained from casts this fight; visionsEnd: the moment Malefic Visions runs out
  counters: { swarm: {}, visionsEnd: {} },
  // Void Shift only reduces damage taken
  p: {},
  q: {
    hits: [{ id: 'portals', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  w: {
    hits: [
      // the game data has no attack speed for Voidlings, so the number of attacks is the user's
      {
        id: 'voidlings', label: 'Voidling attacks', type: 'magic', amount: 'VoidlingBonusDamageTooltip',
        count: '(1 + stacks) * voidlingAttacks', then: 'swarm = -swarmStacks',
        note: 'Void Swarm summons one Voidling plus one for each Q, E or R cast before it, up to its stack limit. Each Voidling is counted for "Attacks each Voidling lands on the target", 3 unless changed.',
      },
    ],
    rules: [
      { id: 'stack', on: 'ability', when: '!cast.w', type: 'magic', amount: 0, then: 'swarm += 1' },
    ],
  },
  e: {
    hits: [{
      id: 'visions', type: 'magic', amount: 'TotalDamage', over: 'Duration', then: 'visionsEnd = time + Duration',
      note: 'The full duration of Malefic Visions is counted.',
    }],
    rules: [
      // a refresh restarts the full duration, so it adds the part that had already run
      {
        id: 'refresh', label: 'Malefic Visions refreshed', on: 'spell',
        when: '(cast.q && refreshAt < visionsEnd) || (cast.r && time < visionsEnd)', type: 'magic',
        amount: 'TotalDamage * max(0, refreshAt + Duration - visionsEnd) / Duration',
        // the extra seconds are what this firing pays for
        over: 'max(0, refreshAt + Duration - visionsEnd)',
        then: 'visionsEnd = max(visionsEnd, refreshAt + Duration)',
        note: 'Q or R cast while Malefic Visions is on the target restarts its duration, and the extra seconds of damage are counted. Nether Grasp keeps it refreshed for its whole channel.',
      },
    ],
  },
  r: {
    hits: [
      { id: 'beam', type: 'magic', amount: 'TotalDamageTooltip', over: 'CCDuration', note: 'The full channel of Nether Grasp is counted.' },
      // the calculation is the zone's total as a share of maximum health
      {
        id: 'zone', label: 'Null Zone', type: 'magic', amount: 'ZoneDamageTooltip * target.maxHp', over: 'PoolDuration',
        note: 'The target is counted as standing in the zone for its whole duration, which outlasts the suppression.',
      },
    ],
  },
});
