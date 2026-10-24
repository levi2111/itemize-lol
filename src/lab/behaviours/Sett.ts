/* Sett: Knuckle Down is an instant buff on his next two attacks, which it resets. A right punch follows the left
   quickly: the timer after a left punch is cut by SettPassive's AttackSpeed. Haymaker punches out to its full
   reach after its long windup. The Show Stopper grabs within DistanceToFirstHit and holds Sett for the carry,
   the slam landing at its end. */
import { behaviour } from '../behaviour.ts';

/** SettPassive.AttackSpeed, read as how much faster the right punch follows the left */
const RIGHT_PUNCH = 1.5;

export default behaviour('Sett', {
  reviewed: '16.20.1',
  sources: [
    'Haymaker\'s 790 reach is from the League Wiki; the game file gives the spell only its 210 radius.',
    'The right punch following the left after the attack period divided by SettPassive\'s AttackSpeed (1.5) is an assumption from that value\'s name; the tooltip only says "quickly".',
    'The Show Stopper\'s carry is taken to last its GrabDuration.',
  ],
  actions: {
    // a buff on the next two attacks: cast it in attack range (125, edge to edge, plus his 65 radius)
    q: { lock: 0, range: 125 + 65 },
    w: { range: 790 },
    r: { range: 'DistanceToFirstHit', channel: 'GrabDuration', delay: 'GrabDuration' },
  },
  hooks: {
    onStart(c) { if (c.action === 'aa') c.state.aaAt = c.t; },
    onLand(c) {
      // the model flips the punch as this attack lands: rightNext 0 means this one is the left
      if (c.action !== 'aa' || c.counter('rightNext') || c.state.aaAt === undefined) return;
      const at = c.state.aaAt;
      c.setAttackReadyAt(at + (c.attackReadyAt() - at) / RIGHT_PUNCH);
    },
  },
  notes: ['The carry of The Show Stopper does not move either champion here.'],
});
