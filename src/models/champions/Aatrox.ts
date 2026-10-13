import { champion } from '../dsl.ts';

/* The Darkin Blade is three casts, each stronger than the one before, so one Q in
   the combo is one swing and a counter remembers which. Deathbringer Stance comes
   back on a cooldown that every attack and ability hit shortens; the model keeps
   the moment it returns in a counter and lets those hits pull it forward. */
export default champion('Aatrox', {
  reviewed: '16.20.1',
  options: {
    edge: { label: 'The Darkin Blade hits with its edge', default: true },
    worldEnder: { label: 'World Ender active', default: false },
  },
  // swings: casts of the current Darkin Blade already made; stanceBack: the time Deathbringer Stance is ready again
  counters: { swings: {}, stanceBack: {} },
  p: {
    rules: [
      // an attack either spends the stance or, like any other hit, shortens the wait for it
      {
        id: 'stance', on: 'attack', type: 'magic',
        amount: 'if(time >= stanceBack, PDamage * target.maxHp, 0)',
        then: 'stanceBack = if(time >= stanceBack, time + PCooldown, stanceBack - PChargeRate)',
      },
    ],
    notes: ['Deathbringer Stance is ready for the first attack, then returns on its cooldown, shortened by each attack and ability hit of the combo.'],
  },
  q: {
    hits: [{
      id: 'swing', type: 'physical',
      amount: 'if(edge, QEdgeDamage, QDamage) * (1 + QRampBonus * swings)',
      // the tooltip states two recasts, and that an edge hit shortens the stance's cooldown twice as much
      then: ['swings = if(swings >= 2, 0, swings + 1)', 'stanceBack += -AatroxPassive.PChargeRate * if(edge, 2, 1)'],
      note: 'Each Q in the combo is one swing of The Darkin Blade, the second and third stronger than the one before; add three for the whole ability.',
    }],
    notes: ['Swings are counted hitting with the edge unless "The Darkin Blade hits with its edge" is turned off.'],
  },
  w: {
    hits: [
      { id: 'chain', type: 'physical', amount: 'WDamage', then: 'stanceBack += -AatroxPassive.PChargeRate' },
      { id: 'pull', label: 'Pull back', type: 'physical', amount: 'WDamage', note: 'Both the chain and the pull back of Infernal Chains are counted; the target takes the second only if it stays in the area.' },
    ],
  },
  // Umbral Dash is a dash, and its passive only heals
  e: {},
  r: {
    statMods: [{ stat: 'ad', phase: 'percent', value: 'RTotalADAmp', when: 'worldEnder' }],
    notes: ['The attack damage of World Ender is off unless "World Ender active" is set.'],
  },
});
