import { champion } from '../dsl.ts';

/* Vel'Koz's kit is tied together by Organic Deconstruction: every ability hit adds
   a stack, the third consumes them for true damage, and from then on the target is
   Researched and the ray deals true damage instead of magic. The game data has the
   amounts; that the rift hits twice, how many stacks the ray adds and when it turns
   true are only in prose, so they live here. */
export default champion('Velkoz', {
  reviewed: '16.20.1',
  vars: {
    // the tooltip only says the ray adds stacks "periodically": three over a full channel, taken as evenly spaced
    rayStacks: 3,
    // share of the ray that lands after the target became Researched
    rayTrue: 'if(researched, 1, clamp(1 - (VelkozPassive.MaxStacks - decon) / (rayStacks + 1), 0, 1))',
  },
  counters: { decon: {}, researched: {} },
  p: {
    rules: [
      // stacks past the third stay on the target, so they are subtracted rather than cleared
      {
        id: 'deconstruct', on: 'after', when: 'decon >= MaxStacks', type: 'true', amount: 'TotalDamage',
        then: ['decon = decon - MaxStacks', 'researched = 1'],
      },
    ],
    notes: ['Deconstruction stacks are counted as never running out during the combo.'],
  },
  q: {
    // the split bolts cannot hit a target the first bolt already hit
    hits: [{ id: 'bolt', type: 'magic', amount: 'TotalDamage', then: 'decon += PassiveStacksToAdd' }],
  },
  w: {
    hits: [
      { id: 'rift', label: 'Rift opening', type: 'magic', amount: 'InitialDamage', then: 'decon += PassiveStacksToAdd' },
      {
        id: 'eruption', label: 'Rift erupting', type: 'magic', amount: 'SecondaryDamage', then: 'decon += PassiveStacksToAdd',
        note: 'Both the opening and the eruption of Void Rift are counted, each adding a Deconstruction stack.',
      },
    ],
  },
  e: {
    hits: [{ id: 'blast', type: 'magic', amount: 'TotalDamage', then: 'decon += PassiveStacksToAdd' }],
  },
  r: {
    hits: [
      // the tooltip states 2.5 seconds for the channel; the game data has no value for it. both parts are the one channel
      { id: 'ray', type: 'magic', amount: 'TotalDamage * (1 - rayTrue)', over: 2.5 },
      // both parts read the stacks as they were at the cast, so only the last one adds the ray's own
      {
        id: 'rayTrue', label: 'Ray on a Researched target', type: 'true', amount: 'TotalDamage * rayTrue', over: 2.5,
        then: 'decon += rayStacks * PassiveStacksToAddPerTick',
        note: 'The full channel is counted, adding 3 evenly spaced Deconstruction stacks. The ray is true damage from the moment Organic Deconstruction has damaged the target: all of it if that happened earlier in the combo.',
      },
    ],
  },
});
