import { champion } from '../dsl.ts';

/* The game data has every amount as a single calculation. What the model adds:
   - Taste Their Fear has two amounts and the site's lone target is the case that
     can be Isolated, so that is the default and the other an option.
   - Unseen Threat is spent by one basic attack. He has it when he opens from out
     of sight, and going invisible with Void Assault gives it back.
   - None of the evolutions change damage on one target: the three evolved spikes
     do not stack on the same enemy, the rest is range, cooldown and stealth. */
export default champion('Khazix', {
  reviewed: '16.20.1',
  vars: {
    threatReady: '(unseen && !opened) || cloaked',
  },
  options: {
    isolated: { label: 'Target is Isolated (no allies nearby)', default: true },
    unseen: { label: 'Opening unseen (first attack has Unseen Threat)', default: true },
  },
  // opened: the Unseen Threat he started the fight with is spent; cloaked: Void Assault has readied another
  counters: { opened: {}, cloaked: {} },
  p: {
    rules: [{
      id: 'threat', on: 'attack', when: 'threatReady', type: 'magic', amount: 'TotalDamage', then: ['opened = 1', 'cloaked = 0'],
      note: 'Unseen Threat is on the first basic attack of a combo, and again on the first one after each Void Assault.',
    }],
  },
  q: {
    hits: [{
      id: 'slash', type: 'physical', amount: 'if(isolated, IsoDamage, BaseDamage)',
      note: 'Taste Their Fear deals its Isolated damage unless "Target is Isolated" is turned off.',
    }],
  },
  w: {
    hits: [{ id: 'spike', type: 'physical', amount: 'BaseDamage' }],
  },
  e: {
    hits: [{ id: 'landing', type: 'physical', amount: 'TotalDamage' }],
  },
  r: {
    // no damage of its own; the invisibility is what readies Unseen Threat again
    hits: [{ id: 'cloak', type: 'magic', amount: 0, then: 'cloaked = 1' }],
  },
});
