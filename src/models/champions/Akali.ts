import { champion } from '../dsl.ts';

/* Two things the game data leaves to prose. Assassin's Mark arms one attack
   after an ability lands, so it is a counter the next attack spends. And Perfect
   Execution is two casts seconds apart, the second scaling with the health the
   target has lost by then: each R in a combo is one of them, in turn, so what
   Akali does between the two counts toward the execute. */
export default champion('Akali', {
  reviewed: '16.20.1',
  // kama: 1 while the next attack is empowered. rStage: 0 before the vault, 2 once the thrust is ready
  counters: { kama: { max: 1 }, rStage: {} },
  p: {
    rules: [
      // she cannot draw a second ring while the attack is waiting, so abilities in a row arm it once
      { id: 'ring', on: 'spell', type: 'magic', amount: 0, then: 'kama = 1' },
      { id: 'kama', label: 'Swinging Kama', on: 'attack', when: 'kama', type: 'magic', amount: 'Damage', then: 'kama = 0' },
    ],
    notes: ['The first attack after a damaging ability is counted as empowered, as if Akali crossed the ring each time.'],
  },
  q: {
    hits: [{ id: 'kunai', type: 'magic', amount: 'Damage' }],
  },
  // Twilight Shroud is stealth, move speed and energy
  w: {},
  e: {
    hits: [
      { id: 'shuriken', label: 'Shuriken', type: 'magic', amount: 'E1Damage' },
      { id: 'dash', label: 'Recast dash', type: 'magic', amount: 'E2DamageCalc', note: 'Both the shuriken and the recast dash of Shuriken Flip are counted.' },
    ],
  },
  r: {
    hits: [
      { id: 'vault', label: 'Vault', when: 'rStage == 0', type: 'magic', amount: 'Cast1Damage', then: 'rStage = 1' },
      // grows evenly with missing health up to its maximum at the execute threshold
      {
        id: 'thrust', label: 'Thrust', when: 'rStage == 2', type: 'magic',
        amount: 'Cast2DamageMin + (Cast2DamageMax - Cast2DamageMin) * min(1, target.missingHpPct / (1 - MaxExecuteThreshold))',
        then: 'rStage = 0',
      },
      // deals nothing: keeps the thrust out of the cast that vaulted
      { id: 'ready', when: 'rStage == 1', type: 'magic', amount: 0, then: 'rStage = 2' },
    ],
    notes: ['Each R in the combo is one cast: the first is the vault, the second the thrust, which scales with the health the target has lost by then. Add R twice for both.'],
  },
});
