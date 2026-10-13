import { champion } from '../dsl.ts';

/* Aphelios has no ability ranks of his own: his points go into attack damage (Q),
   attack speed (W) and lethality (E), and what the Q key does depends on the gun
   in his main hand. The two guns are options, numbered in the order Alune first
   hands them out, and Phase swaps them for the rest of the fight. The five weapon
   abilities scale with level and live on spells of their own, so every name here
   is written with its spell. */
export default champion('Aphelios', {
  reviewed: '16.20.1',
  vars: {
    mainNow: 'if(swapped, offHand, mainHand)',
    offNow: 'if(swapped, mainHand, offHand)',
    // the tooltip unlocks the weapon ability at level 2, whatever the ranks are
    qWeapon: 'if(level >= 2, mainNow, 0)',
    // with Calibrum in the main hand a marked target is attacked with the other gun
    attackWeapon: 'if(mark && mainNow == 1, offNow, mainNow)',
    // the tooltip caps chakrams at 20; the game data has no value for it
    held: 'min(chakrams + caught, 20)',
    // each chakram adds less than the one before, down to a floor; this many are still above it
    steep: 'min(held, ceil((ApheliosCrescendumQ.MiniDamageRatioMax - ApheliosCrescendumQ.MiniDamageRatioMin) / ApheliosCrescendumQ.MiniDamageRatioDecPer))',
    chakramDamage: 'steep * ApheliosCrescendumQ.MiniDamageMax - ad * ApheliosCrescendumQ.MiniDamageRatioDecPer * steep * (steep - 1) / 2 + (held - steep) * ApheliosCrescendumQ.MiniDamageMin',
    // Onslaught: the game data has the total and the number of shots, attack speed adds shots
    shots: 'floor(ApheliosSeverumQ.NumAttacks)',
    shot: 'ApheliosSeverumQ.TotalDamage / ApheliosSeverumQ.NumAttacks',
  },
  options: {
    mainHand: { label: 'Main-hand weapon (1 Calibrum, 2 Severum, 3 Gravitum, 4 Infernum, 5 Crescendum)', kind: 'int', default: 1, min: 1, max: 5 },
    offHand: { label: 'Off-hand weapon (1 Calibrum, 2 Severum, 3 Gravitum, 4 Infernum, 5 Crescendum)', kind: 'int', default: 2, min: 1, max: 5 },
    chakrams: { label: 'Chakrams already orbiting Aphelios', kind: 'int', default: 0, min: 0, max: 20 },
  },
  // mark, rMark: Calibrum's mark on the target and whether Moonlight Vigil put it there; caught: chakrams gained this fight; volley: an Onslaught is firing
  counters: { swapped: {}, mark: { max: 1 }, rMark: { max: 1 }, caught: {}, volley: {} },
  p: {
    rules: [
      // kept here so that W stays an ability without damage
      { id: 'phase', on: 'ability', when: 'cast.w', type: 'physical', amount: 0, then: 'swapped = 1 - swapped' },
      // AttackDamage is the whole Infernum attack; the engine already counts the attack itself
      {
        id: 'infernum', label: 'Infernum attack', on: 'attack', when: 'attackWeapon == 4', type: 'physical',
        amount: 'ApheliosInfernumQ.AttackDamage - ad', crit: '(ApheliosInfernumQ.AttackDamage - ad) * critDamage',
      },
      {
        id: 'chakrams', label: 'Chakrams', on: 'attack', when: 'mainNow == 5 && held > 0', type: 'physical',
        amount: 'chakramDamage', crit: 'chakramDamage * critDamage',
        note: 'Chakrams add damage to Crescendum attacks only; they come from abilities that use Crescendum during the combo, or from "Chakrams already orbiting Aphelios".',
      },
      // the long-range attack on a marked target, fired with Crescendum, sends a chakram back
      { id: 'markChakram', on: 'attack', when: 'mark && mainNow == 1 && offNow == 5', type: 'physical', amount: 0, then: 'caught += 1' },
      {
        id: 'mark', label: 'Calibrum mark', on: 'attack', when: 'mark', type: 'physical',
        amount: 'ApheliosCalibrumQ.BonusDamagePerMark + rMark * ApheliosR.CalibrumRMarkBonusDamage', then: ['mark = 0', 'rMark = 0'],
        note: 'A Calibrum mark is spent by the next basic attack in the combo.',
      },
    ],
    notes: ['The weapons are set with "Main-hand weapon" and "Off-hand weapon"; Phase (W) in a combo swaps them from then on.'],
  },
  q: {
    hits: [
      { id: 'moonshot', label: 'Moonshot', when: 'qWeapon == 1', type: 'physical', amount: 'ApheliosCalibrumQ.SpellDamage', then: 'mark = 1' },

      { id: 'onslaughtStart', when: 'qWeapon == 2', type: 'physical', amount: 0, then: 'volley = 1' },
      // shots alternate between Severum and the off-hand gun, Severum first
      {
        id: 'onslaught', label: 'Onslaught', when: 'qWeapon == 2', type: 'physical', count: 'shots',
        amount: 'shot', crit: 'shot * critDamage', over: 'ApheliosSeverumQ.Duration',
        then: ['volley = 0', 'mark = max(mark, offNow == 1)', 'caught += (offNow == 5) * floor(shots / 2)'],
        note: 'Every shot of Onslaught is counted, each applying on-hit effects at reduced damage. Attack speed adds whole shots only.',
      },

      {
        id: 'eclipse', label: 'Binding Eclipse', when: 'qWeapon == 3', type: 'magic', amount: 'ApheliosGravitumQ.Damage',
        note: 'Binding Eclipse only hits a target already slowed by Gravitum; that is assumed.',
      },

      { id: 'duskwave', label: 'Duskwave', when: 'qWeapon == 4', type: 'physical', amount: 'ApheliosInfernumQ.QWaveDamage' },
      // the attack that follows the wave is a full off-hand attack
      {
        id: 'duskwaveAttack', label: 'Duskwave attack', when: 'qWeapon == 4', type: 'physical',
        amount: 'ad', crit: 'ad * critDamage', appliesOnHit: true,
        then: ['mark = max(mark, offNow == 1)', 'caught += offNow == 5'],
      },

      {
        id: 'sentry', label: 'Sentry', when: 'qWeapon == 5', type: 'physical',
        // shots are not rounded, so attack speed has no steps here
        count: 'ApheliosCrescendumQ.TurretDurationActive * attackSpeed', over: 'ApheliosCrescendumQ.TurretDurationActive',
        amount: 'ApheliosCrescendumQ.TurretDamage', crit: 'ApheliosCrescendumQ.TurretDamage * critDamage',
        then: 'mark = max(mark, offNow == 1)',
        note: 'The Sentry is counted firing at the one target for its whole active time, at Aphelios\' attack speed.',
      },
    ],
    rules: [
      // the tooltip gives Onslaught's on-hit effectiveness as a calculation (OnHitDamageReduction); this field only takes a number
      { id: 'onslaughtOnHit', on: 'damage', when: 'volley', type: 'physical', amount: 0, appliesOnHit: 0.25 },
    ],
    statMods: [{ stat: 'ad', value: 'rank * ApheliosP.ADPerRank' }],
    notes: [
      'The ability of the main-hand weapon: Moonshot, Onslaught, Binding Eclipse, Duskwave or Sentry.',
      'Ranks in Q are Aphelios\' attack damage upgrades. The weapon ability is only counted with at least one rank.',
    ],
  },
  // Phase swaps the weapons; see the passive
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'rank * ApheliosP.ASPerRank' }],
    notes: ['Ranks in W are Aphelios\' attack speed upgrades. Phase only swaps the weapons with at least one rank.'],
  },
  // the E key only shows the next weapon
  e: {
    statMods: [{ stat: 'lethality', value: 'rank * ApheliosP.APPerRank' }],
    notes: ['Ranks in E are Aphelios\' lethality upgrades.'],
  },
  r: {
    hits: [
      { id: 'blast', type: 'physical', amount: 'MaxDamage' },
      { id: 'infernumBlast', label: 'Infernum blast', when: 'mainNow == 4', type: 'physical', amount: 'InfernumRBonusDamage' },
      // an attack with the main-hand gun; CritDamageModCalc is already weighted by crit chance
      {
        id: 'attack', label: 'Moonlight Vigil attack', type: 'physical',
        amount: 'if(mainNow == 4, ApheliosInfernumQ.AttackDamage, ad) * CritDamageModCalc', appliesOnHit: true,
        then: ['mark = max(mark, mainNow == 1)', 'rMark = max(rMark, mainNow == 1)', 'caught += (mainNow == 5) * (1 + CrescendumRBonusMinis)'],
      },
    ],
    notes: ['Moonlight Vigil uses the main-hand weapon: Calibrum marks the target for the next basic attack, Infernum adds to the blast, Crescendum gives chakrams.'],
  },
});
