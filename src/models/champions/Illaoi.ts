import { champion } from '../dsl.ts';

/* Illaoi's damage is mostly Tentacle slams, and the game data only has the damage
   of one slam. Which abilities make Tentacles slam, how many are in reach, and what
   a spirit pulled out by Test of Spirit sends back to its owner is what the model adds.

   - Tentacle Smash slams with a Tentacle of its own.
   - Harsh Lesson makes every Tentacle in reach slam at the target.
   - Test of Spirit deals nothing itself: Tentacles slam at the spirit on their own,
     and a share of what the spirit takes is echoed to the target.
   - Leap of Faith spawns a Tentacle for each champion hit, and one more for a spirit. */
export default champion('Illaoi', {
  reviewed: '16.20.1',
  options: {
    tentacles: { label: 'Tentacles in reach of the target', kind: 'int', default: 1, min: 0 },
  },
  // spiritUntil, leapUntil: the moment this fight's spirit and Leap of Faith's Tentacles are gone
  counters: { spiritUntil: {}, leapUntil: {}, leapTentacles: {} },
  vars: {
    // the increase from Tentacle Smash's rank is part of the calculation, and is nothing before it has a rank
    slam: 'IllaoiQ.TentacleDamageTotal',
    echo: 'IllaoiE.EchoPercent',
    spirit: 'time < spiritUntil',
    nearby: 'tentacles + if(time < leapUntil, leapTentacles, 0)',
    // slams landing together: full, half, then a quarter each. The game data has no value for the falloff
    together: 'min(nearby, 1) + 50% * clamp(nearby - 1, 0, 1) + 25% * max(nearby - 2, 0)',
  },
  p: {
    rules: [
      {
        id: 'slams', label: 'Tentacle slams', on: 'ability', when: 'cast.w', type: 'physical', amount: 'slam * together',
        note: 'Harsh Lesson makes every Tentacle in reach slam at the target: 1 unless "Tentacles in reach of the target" is changed, plus the ones Leap of Faith spawned while they last.',
      },
      // they slam at the spirit, not at its owner, so only the echo is counted
      {
        id: 'spiritSlams', label: 'Tentacle slams at the spirit', on: 'ability', when: 'cast.e', type: 'physical',
        amount: 'slam * together * echo', count: 'ceil(IllaoiE.SpiritDuration / IllaoiE.TimeBetweenVesselTentacleSlams)',
        over: 'IllaoiE.SpiritDuration',
        note: 'Test of Spirit counts the slams Tentacles in reach make at the spirit on their own over its full duration, and of those only the share echoed to the target.',
      },
    ],
    notes: ['When several Tentacles slam together, the second is counted at 50% and each further one at 25%.'],
  },
  q: {
    hits: [
      // its own Tentacle, whatever the number in reach
      { id: 'slam', type: 'physical', amount: 'TentacleDamageTotal' },
      { id: 'echo', label: 'Echo from the spirit', when: 'spirit', type: 'physical', amount: 'TentacleDamageTotal * echo' },
    ],
  },
  w: {
    hits: [{
      id: 'lesson', type: 'physical', amount: 'max(WMinDamage, HealthPercentTotal * target.maxHp)',
      note: 'Harsh Lesson counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  e: {
    hits: [{ id: 'pull', type: 'physical', amount: 0, then: 'spiritUntil = time + SpiritDuration' }],
    notes: ['After Test of Spirit, Tentacle Smash and Leap of Faith are counted as hitting the target and its spirit, for as long as the spirit lasts. Basic attacks and Harsh Lesson are counted on the target itself.'],
  },
  r: {
    hits: [
      {
        id: 'impact', type: 'physical', amount: 'DamageCalc', then: ['leapTentacles = 1 + spirit', 'leapUntil = time + Duration'],
        note: 'Leap of Faith spawns one Tentacle for the target, and one more for its spirit when Test of Spirit came first. They slam with the others until Leap of Faith ends.',
      },
      { id: 'echo', label: 'Echo from the spirit', when: 'spirit', type: 'physical', amount: 'DamageCalc * echo' },
    ],
  },
});
