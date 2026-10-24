/* Zeri: every basic attack is a Burst Fire in the model, so attacks fly as ZeriQMis (2600 units a second). Burst
   Fire uses her attack's timing (usesAttackTiming in the game file): cast as Q, its cast is her attack windup.
   Lightning Crash's Overcharge attack speed lasts RDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Zeri', {
  reviewed: '16.20.1',
  sources: ['Burst Fire flies at ZeriQMis\'s 2600 units a second in the game file; her attack windup is a 0.15625 share at a modifier of 1.'],
  attack: { missileSpeed: 2600 },
  actions: {
    q: { spell: 'ZeriQMis', lock: '0.15625 / attackSpeed' },
  },
  windows: [{ option: 'overcharged', after: 'r', for: 'RDuration' }],
  notes: [
    'Attacks reach her attack range, not Burst Fire\'s longer one.',
    'Overcharge lasting longer for each hit is not played.',
  ],
});
