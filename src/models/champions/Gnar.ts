import { champion } from '../dsl.ts';

/* Two kits on one set of keys, and which one is up depends on Rage rather than on
   a cast, so the form is an option for the whole fight. Mini Gnar has Boomerang
   Throw, Hop and the Hyper passive on W; Mega Gnar has Boulder Toss, Wallop,
   Crunch and GNAR!. Both forms' formulas live on the same four spells. */
export default champion('Gnar', {
  reviewed: '16.20.1',
  options: {
    mega: { label: 'Mega Gnar', default: false },
    hop: { label: 'Hop attack speed active', default: false },
    wall: { label: 'GNAR! throws the target into a wall', default: false },
  },
  counters: { hyper: {} },
  // Rage Gene deals no damage; it is the stats each form fights with
  p: {
    statMods: [
      { stat: 'attackSpeed', value: 'TotalAS', when: '!mega' },
      { stat: 'ad', value: 'TotalMegaGnarAD', when: 'mega' },
      // Hop and Crunch scale with his own maximum health
      { stat: 'hp', value: 'TotalMegaGnarHealth', when: 'mega' },
    ],
    notes: ['Mini Gnar unless "Mega Gnar" is set: the form decides his stats and which version of each ability is cast.'],
  },
  q: {
    hits: [
      { id: 'boomerang', label: 'Boomerang Throw', when: '!mega', type: 'physical', amount: 'MiniTotalDamage' },
      { id: 'boulder', label: 'Boulder Toss', when: 'mega', type: 'physical', amount: 'MegaTotalDamage' },
    ],
  },
  w: {
    hits: [{ id: 'wallop', label: 'Wallop', when: 'mega', type: 'physical', amount: 'MegaTotalDamage' }],
    rules: [
      // Hyper: Mini Gnar's attacks and ability hits each leave a stack, and the one past the cap spends them
      { id: 'stack', on: 'onhit', when: '!mega', type: 'magic', amount: 0, then: 'hyper += 1' },
      { id: 'stackSpell', on: 'spell', when: '!mega && (cast.q || cast.e)', type: 'magic', amount: 0, then: 'hyper += 1' },
      {
        id: 'hyper', label: 'Hyper', on: 'after', when: 'hyper > MiniMaxStacks', type: 'magic',
        amount: 'MiniTotalDamage + MiniPercentHPDamage * target.maxHp', then: 'hyper = 0',
      },
    ],
    notes: ['As Mini Gnar W has no cast: Hyper triggers on every third attack or ability hit. Wallop needs "Mega Gnar".'],
  },
  e: {
    hits: [
      { id: 'hop', label: 'Hop', when: '!mega', type: 'physical', amount: 'MiniTotalDamage', note: 'Hop is counted as bouncing off the target.' },
      { id: 'crunch', label: 'Crunch', when: 'mega', type: 'physical', amount: 'MegaTotalDamage' },
    ],
    // a Hop that turns him into Mega Gnar grants none
    statMods: [{ stat: 'attackSpeed', value: 'MinibAS', when: 'hop && !mega' }],
  },
  r: {
    hits: [{ id: 'toss', when: 'mega', type: 'physical', amount: 'if(wall, WallDamage, Damage)' }],
    notes: ['GNAR! can only be cast as Mega Gnar: it deals nothing unless "Mega Gnar" is set. The wall bonus needs "GNAR! throws the target into a wall".'],
  },
});
