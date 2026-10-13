import { champion } from '../dsl.ts';

export default champion('Orianna', {
  reviewed: '16.20.1',
  counters: { winding: { max: 'OriannaP.StackCount' } },
  p: {
    rules: [
      // each attack on the same target hits for more per stack already wound up, then adds one
      {
        id: 'windup', label: 'Clockwork Windup', on: 'onhit', type: 'magic',
        amount: 'TotalDamage + StackDamage * winding', then: 'winding += 1',
        note: 'Clockwork Windup stacks are assumed to stay up between attacks.',
      },
    ],
  },
  q: {
    // the reduction is for enemies after the first; a lone target is the first
    hits: [{ id: 'ball', type: 'magic', amount: 'TotalDamageTooltip' }],
  },
  w: {
    hits: [{ id: 'pulse', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    // the resistances it grants are defensive; the damage is only dealt along the Ball's path
    hits: [{ id: 'pass', type: 'magic', amount: 'TotalDamageTooltip', note: 'Command: Protect is counted as the Ball flying through the target on its way.' }],
  },
  r: {
    hits: [{ id: 'shockwave', type: 'magic', amount: 'TotalDamage' }],
  },
});
