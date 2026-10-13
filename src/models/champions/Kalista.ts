import { champion } from '../dsl.ts';

/* Rend is the kit: every attack and Pierce leaves a spear in the target, and the
   active rips them all out, the first for one amount and each further one for
   another. The spears are a counter, so what Rend deals is decided by what came
   before it in the combo. */
export default champion('Kalista', {
  reviewed: '16.20.1',
  vars: {
    inTarget: 'min(spears + lodged, KalistaExpungeWrapper.MaxSpears)',
  },
  options: {
    lodged: { label: 'Rend: spears already in the target', kind: 'int', default: 0, min: 0 },
    oathsworn: { label: 'Oathsworn ally attacks the same target', default: false },
  },
  counters: { spears: {} },
  // Martial Poise only dashes
  p: {},
  q: {
    hits: [{ id: 'spear', type: 'physical', amount: 'TotalDamage' }],
  },
  w: {
    rules: [
      // an after rule that is quiet during W, E and R is left with attacks and Pierce, the two things
      // that mark; one rule so both share the per-target cooldown
      {
        id: 'soulMark', label: 'Soul-Mark', on: 'after', when: 'oathsworn && !cast.w && !cast.e && !cast.r',
        type: 'magic', amount: 'MaxHealthDamage * target.maxHp', cooldown: 'PerTargetCooldown',
        note: 'With the Oathsworn set, their mark is assumed to be on the target whenever Kalista\'s attack or Pierce lands.',
      },
    ],
    notes: ['The Soul-Mark damage is off unless "Oathsworn ally attacks the same target" is set.'],
  },
  e: {
    hits: [{
      // ripping also takes the spears the option started with: the counter drops below zero by that many
      id: 'rend', type: 'physical', when: 'inTarget > 0',
      amount: 'NormalDamage + AdditionalDamage * (inTarget - 1)', then: 'spears = -lodged',
      note: 'Rend rips one spear for each attack and Pierce before it in the combo, plus those set as already in the target. With none it deals nothing.',
    }],
    rules: [
      { id: 'lodge', on: 'attack', type: 'physical', amount: 0, then: 'spears += 1' },
      { id: 'lodgePierce', on: 'spell', when: 'cast.q', type: 'physical', amount: 0, then: 'spears += 1' },
    ],
  },
  // Fate's Call only pulls the Oathsworn in and knocks enemies back
  r: {},
});
