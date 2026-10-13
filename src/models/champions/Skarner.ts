import { champion } from '../dsl.ts';

/* Skarner's damage is Quaking and the boulder. The game data gives what Quaking
   burns over its whole duration; that it starts with the third stack, that attacks
   and Impale add the stacks, and that every later application starts the duration
   over, is the model.

   The burn is counted where it is applied: the third stack brings the whole burn,
   and each application after it pays for the time the burn has run since the last
   one, which is exactly what that refresh adds. */
export default champion('Skarner', {
  reviewed: '16.20.1',
  vars: {
    // share of the duration that ran since the last application
    ran: 'clamp((time - refreshed) / SkarnerPassive.Duration, 0, 1)',
    // sustained attacking has no last hit to burn out after, so there only the time that ran is counted
    burn: 'if(quaking >= SkarnerPassive.StacksToTriggerPassive, ran, if(sustained, 0, quaking + 1 >= SkarnerPassive.StacksToTriggerPassive))',
    quake: 'SkarnerPassive.PercentHealthDamage * target.maxHp * burn',
  },
  options: {
    shatteredEarth: { label: 'Shattered Earth attack speed active', default: false },
  },
  // quaking: Quaking stacks on the target; refreshed: when Quaking was last applied
  counters: { quaking: { max: 'SkarnerPassive.StacksToTriggerPassive' }, refreshed: {} },
  p: {
    rules: [
      {
        id: 'quaking', label: 'Quaking', on: 'onhit', type: 'magic', amount: 'quake',
        // the seconds this firing pays for: the whole burn at the third stack, the time since the last application after it
        over: 'burn * Duration',
        then: ['refreshed = time', 'quaking += 1'],
        note: 'Quaking burns from the third stack for as long as the combo keeps applying it, and then for its full duration after the last hit.',
      },
      // Shattered Earth rides on attacks, which add the stack themselves; Seismic Bastion and Ixtal's Impact add none
      {
        id: 'quakingImpale', label: 'Quaking', on: 'spell', when: 'cast.r', type: 'magic', amount: 'quake',
        over: 'burn * Duration',
        then: ['refreshed = time', 'quaking += 1'],
      },
    ],
  },
  q: {
    hits: [
      // the bonus on top of the next three attacks only; the attacks themselves are aa in the combo
      {
        id: 'attacks', type: 'physical', amount: 'AbilityDamage', count: 3,
        note: 'Shattered Earth counts the bonus damage of all three empowered attacks; add the auto attacks to the combo.',
      },
      // throwing the boulder instead of the last attack deals the same two amounts
      { id: 'slam', label: 'Shattered Earth final attack', type: 'physical', amount: 'MaxHPPercent * target.maxHp' },
    ],
    statMods: [{ stat: 'attackSpeed', value: "dv('AttackSpeed')", when: 'shatteredEarth' }],
    notes: ['Shattered Earth\'s attack speed is off unless "Shattered Earth attack speed active" is set.'],
  },
  w: {
    hits: [{ id: 'quake', type: 'magic', amount: 'Damage' }],
  },
  e: {
    hits: [{ id: 'pin', type: 'physical', amount: 'PinDamage', note: 'Ixtal\'s Impact is counted as slamming the target into a wall; without a wall it deals no damage.' }],
  },
  r: {
    hits: [{ id: 'impale', type: 'magic', amount: 'Damage' }],
  },
});
