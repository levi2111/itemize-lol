import { champion } from '../dsl.ts';

/* Yunara's damage is her basic attacks, which are the engine's own. The kit adds
   magic damage on top of them: a share of every critical strike, an on-hit amount
   from Cultivation of Spirit's passive, and a second one while it is active.
   Transcend One's Self switches Cultivation of Spirit on and turns Arc of
   Judgment into Arc of Ruin, whose numbers live on the ultimate.

   Stats are worked out once per fight, so the attack speed needs the option; the
   on-hit damage and the laser also follow a Q or R cast in the combo, for as long
   as the buff lasts. */
export default champion('Yunara', {
  reviewed: '16.20.1',
  vars: {
    transcended: 'rank.r && (transcendent || time < transcendUntil)',
    // the Transcendent State keeps Cultivation of Spirit active throughout
    unleashed: 'unleash || time < unleashUntil || transcended',
  },
  options: {
    unleash: { label: 'Cultivation of Spirit active', default: false },
    transcendent: { label: 'Transcendent State active', default: false },
  },
  counters: { unleashUntil: {}, transcendUntil: {} },
  p: {
    rules: [
      // taken as a share of the critical strike's whole damage before resistances, averaged by crit chance like the attack itself
      {
        id: 'vow', on: 'attack', type: 'magic', amount: 'Calc_Damage_Amp * ad * critDamage * critChance',
        note: 'The bonus on critical strikes is a share of the strike\'s damage before armor, averaged by crit chance.',
      },
    ],
  },
  q: {
    hits: [{ id: 'cast', type: 'magic', amount: 0, then: 'unleashUntil = time + Buff_Duration' }],
    rules: [
      { id: 'passive', on: 'onhit', type: 'magic', amount: 'Calc_Passive_Damage' },
      { id: 'active', label: 'Cultivation of Spirit active', on: 'onhit', when: 'unleashed', type: 'magic', amount: 'Calc_Damage' },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'Calc_Attack_Speed', when: 'unleashed' }],
    // the spread attacks only hit other enemies near the target
    notes: [
      'Casting Q in a combo adds its extra on-hit damage to the attacks made while it lasts. Set "Cultivation of Spirit active" to also count its attack speed, and to count it in damage per second.',
      'Attacks spreading to nearby enemies are not counted: they do not hit the main target.',
    ],
  },
  w: {
    hits: [
      { id: 'bead', label: 'Arc of Judgment', when: '!transcended', type: 'magic', amount: 'Calc_Damage_Initial' },
      {
        id: 'linger', label: 'Arc of Judgment lingering', when: '!transcended', type: 'magic', amount: 'Calc_Damage_Per_Second', count: 'Linger_Duration', over: 'Linger_Duration',
        note: 'Arc of Judgment counts its first hit and one full linger of damage over time; a target that stays inside the bead longer takes more.',
      },
      { id: 'ruin', label: 'Arc of Ruin', when: 'transcended', type: 'magic', amount: 'YunaraR.Calc_RW_Damage' },
    ],
    notes: ['Arc of Judgment unless the Transcendent State is active, then Arc of Ruin.'],
  },
  // Kanmei's Steps is move speed and Untouchable Shadow is a dash
  e: {},
  r: {
    // deals nothing itself; starts the state that Q and W read
    hits: [{ id: 'cast', type: 'magic', amount: 0, then: 'transcendUntil = time + Buff_Duration' }],
    notes: ['Casting R in a combo activates Cultivation of Spirit and turns later W casts into Arc of Ruin for its duration. Set "Transcendent State active" to fight in it from the start, attack speed included.'],
  },
});
