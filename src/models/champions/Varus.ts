import { champion } from '../dsl.ts';

/* Blight is the kit: attacks stack it, Chain of Corruption fills it, and the next
   other ability spends it for a share of the target's maximum health. The stacks
   are a counter, so the order of the combo decides what a detonation is worth.
   Piercing Arrow's charge scales the arrow, the detonation it causes and Blighted
   Quiver's active alike. */
export default champion('Varus', {
  reviewed: '16.20.1',
  vars: {
    // a fully drawn arrow also strengthens the blight it detonates
    chargeAmp: 'if(cast.q && charged, VarusQ.MaxChargeAmp, 0)',
  },
  options: {
    charged: { label: 'Piercing Arrow fully charged', default: true },
    vengeance: { label: 'Living Vengeance active (champion takedown)', default: false },
  },
  counters: { blight: { max: 'VarusW.MaxStacks' }, quiver: {} },
  p: {
    statMods: [
      { stat: 'attackSpeed', value: 'ChampionAS', when: 'vengeance' },
      // attack damage and ability power come from bonus attack speed, the takedown's own included
      { stat: 'ad', value: 'ChampionAD', phase: 'convert', when: 'vengeance' },
      { stat: 'ap', value: 'ChampionAP', phase: 'convert', when: 'vengeance' },
    ],
    notes: ['The takedown bonus is off unless "Living Vengeance active" is set.'],
  },
  q: {
    hits: [
      { id: 'arrow', type: 'physical', amount: 'if(charged, TotalDamageMax, TotalDamageMinTooltip)', note: 'Piercing Arrow is counted fully charged and with the target as the first enemy hit, unless "Piercing Arrow fully charged" is turned off.' },
      // Blighted Quiver's active rides on the arrow and is worked out after the arrow has landed
      {
        id: 'quiver', label: 'Blighted Quiver', type: 'magic', when: 'quiver',
        amount: 'if(charged, VarusW.MaxQEmpowerPercentHP, VarusW.QEmpowerPercentHP) * target.missingHp', then: 'quiver = 0',
      },
    ],
  },
  w: {
    // the active deals nothing by itself; it arms the next Piercing Arrow
    hits: [{ id: 'arm', type: 'magic', amount: 0, then: 'quiver = 1', note: 'Blighted Quiver\'s active is added to the next Piercing Arrow; put W before Q in the combo.' }],
    rules: [
      { id: 'onhit', on: 'onhit', type: 'magic', amount: 'OnHitDamage', then: 'blight += 1' },
      // any other damaging ability spends the stacks
      {
        id: 'detonate', label: 'Blight detonation', on: 'spell', when: 'blight > 0', type: 'magic',
        amount: 'PercentHPPerStack * blight * target.maxHp * (1 + chargeAmp)', then: 'blight = 0',
      },
    ],
  },
  e: {
    hits: [{ id: 'hail', type: 'physical', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{ id: 'tendril', type: 'magic', amount: 'TotalDamage' }],
    rules: [
      // runs after the detonation of what was already there: the root then builds the stacks back up
      {
        id: 'infect', on: 'spell', when: 'cast.r', type: 'magic', amount: 0, then: 'blight = PassiveStacks',
        note: 'Chain of Corruption leaves the target at full Blight stacks for the next ability, although they build up over the root.',
      },
    ],
  },
});
