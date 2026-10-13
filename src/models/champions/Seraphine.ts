import { champion } from '../dsl.ts';

/* Stage Presence is two things, and neither is a formula the game data can state:
   - Echo: every third basic ability is cast twice. Only the prose says "third".
   - Notes: every ability cast gives her one, and her next attack fires them all,
     each for the passive's damage. Notes held by allies fire too, for a share. */
export default champion('Seraphine', {
  reviewed: '16.20.1',
  vars: {
    // the cast being played is the third: the passive has already counted it
    echoing: 'echo + echoStacks >= 3',
  },
  options: {
    echoStacks: { label: 'Echo stacks at the start (2 = the next basic ability echoes)', kind: 'int', default: 0, min: 0, max: 2 },
    allies: { label: 'Nearby allies holding Notes', kind: 'int', default: 0, min: 0, max: 4 },
  },
  counters: {
    echo: {},
    notes: { max: 'SeraphinePassive.MaxNotes' },
  },
  p: {
    rules: [
      { id: 'gain', on: 'ability', type: 'magic', amount: 0, then: 'notes += 1' },
      { id: 'stack', on: 'ability', when: '!cast.r', type: 'magic', amount: 0, then: 'echo += 1' },
      // the echo is a cast of its own, so it gives a Note too; the starting stacks sit on top of the counter, so emptying both is minus the option
      { id: 'echoed', on: 'after', when: 'echoing', type: 'magic', amount: 0, then: ['notes += 1', 'echo = 0 - echoStacks'] },
      // an ally gets a Note whenever she does, so each holds as many as she has
      { id: 'allyNotes', label: 'Notes from allies', on: 'attack', when: 'notes > 0', type: 'magic', amount: 'AutoDamage * AllyNoteDamagePercent', count: 'notes * allies' },
      {
        id: 'notes', label: 'Notes', on: 'attack', when: 'notes > 0', type: 'magic', amount: 'AutoDamage', count: 'notes', then: 'notes = 0',
        note: 'Every ability cast gives a Note, up to the maximum; the next auto attack in the combo fires them all.',
      },
    ],
    notes: ['Every third basic ability is cast twice, and the second cast is counted on the same target.'],
  },
  q: {
    hits: [
      // grows evenly with missing health, from the plain damage to the empowered one at the threshold
      { id: 'blast', type: 'magic', amount: 'ExplosionDamage + (TotalEmpoweredDamage - ExplosionDamage) * min(1, target.missingHpPct / (1 - ExecuteThreshold))' },
      { id: 'echo', label: 'Echo', when: 'echoing', type: 'magic', amount: 'ExplosionDamage + (TotalEmpoweredDamage - ExplosionDamage) * min(1, target.missingHpPct / (1 - ExecuteThreshold))' },
    ],
  },
  // Surround Sound only shields, heals and speeds up; the passive still counts its cast for Echo and a Note
  w: {},
  e: {
    hits: [
      { id: 'wave', type: 'magic', amount: 'FinalDamage' },
      { id: 'echo', label: 'Echo', when: 'echoing', type: 'magic', amount: 'FinalDamage' },
    ],
  },
  r: {
    hits: [{ id: 'wave', type: 'magic', amount: 'R1TotalDamage' }],
  },
});
