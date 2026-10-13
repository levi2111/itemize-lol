import { champion } from '../dsl.ts';

/* What the game data leaves open for Draven:
   - Spinning Axe is a bonus on one attack, but a caught axe is readied again, so
     a Draven who keeps catching has it on attack after attack. One cast is one
     axe; the option puts an axe on every attack instead.
   - Whirling Death passes through the target on the way out and again on the way
     back, and its damage falloff starts over when it turns around.
   - The execute reads League of Draven's stacks, which static data cannot know. */
export default champion('Draven', {
  reviewed: '16.20.1',
  vars: {
    // "would leave an enemy with less health than": checked on what a pass has just left
    reaped: 'hasTarget && target.hp > 0 && target.hp < adoration * DravenRCast.RPassiveStacksCoefficient',
  },
  options: {
    catching: { label: 'Catching every Spinning Axe', default: 'sustained' },
    bloodRush: { label: 'Blood Rush attack speed active', default: false },
    adoration: { label: 'League of Draven stacks', kind: 'int', default: 0, min: 0 },
  },
  // League of Draven only pays gold; its stacks feed Whirling Death's execute
  p: {},
  q: {
    // the bonus on top of the next attack only; the attack itself is an aa in the combo
    hits: [{
      id: 'axe', type: 'physical', amount: 'TotalDamage', when: '!catching',
      note: 'Spinning Axe counts only what it adds to one attack; put a basic attack after it, and add Q again for each axe caught.',
    }],
    rules: [{
      id: 'juggle', on: 'attack', when: 'catching', type: 'physical', amount: 'TotalDamage',
      note: 'Sustained damage, and a combo with "Catching every Spinning Axe" set, has a Spinning Axe on every basic attack. That is generous at high attack speed, where the axes spend too long in the air to keep up.',
    }],
  },
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeed', when: 'bloodRush' }],
    notes: ['The attack speed is off unless "Blood Rush attack speed active" is set.'],
  },
  e: {
    hits: [{ id: 'axe', type: 'physical', amount: 'TotalDamage' }],
  },
  r: {
    hits: [
      { id: 'out', label: 'Axes going out', type: 'physical', amount: 'RCalculatedDamage' },
      { id: 'executeOut', label: 'League of Draven execute', type: 'true', when: 'reaped', amount: 'target.hp' },
      // a lone target is the first enemy hit on each pass, so neither is reduced
      { id: 'back', label: 'Axes coming back', type: 'physical', amount: 'RCalculatedDamage', note: 'Both passes of Whirling Death are counted, at full damage.' },
      {
        id: 'execute', label: 'League of Draven execute', type: 'true', when: 'reaped', amount: 'target.hp',
        note: 'Whirling Death only executes when "League of Draven stacks" is set: it finishes a target that a pass leaves below that much health.',
      },
    ],
  },
});
