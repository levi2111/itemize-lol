import { champion } from '../dsl.ts';

/* Locke is new, so this is written from the game data and the tooltips alone.
   What they leave to the model:
   - Ritual Nails readies a set of nails. Each one that lands marks the target,
     and the next attack or Ashen Pursuit hit sets the marks off, for more per
     nail the more of them there are.
   - Purgatory's damage is one calculation, but its mark also finishes a champion
     that drops low enough while it lasts, at a threshold that grows with every
     champion sealed earlier in the game. */
export default champion('Locke', {
  reviewed: '16.20.1',
  vars: {
    // the bonus for two and for three nails is in percent points
    nailBurst: 'LockeQ.NailDamage * nails * (1 + if(nails >= 3, LockeQ.ThreeMarkBonusPercent, if(nails >= 2, LockeQ.TwoMarkBonusPercent, 0)) / 100)',
    // nails of one cast that land
    landed: 'min(nailsHit, LockeQ.Ammo)',
    sealing: 'hasTarget && target.hp > 0 && time < sealUntil && target.hpPct < LockeR.ExecutionThreshold + sealed * LockeR.ExecuteThresholdPerStack',
  },
  options: {
    nailsHit: { label: 'Soul Nails that hit per Ritual Nails', kind: 'int', default: 'LockeQ.Ammo', min: 1 },
    ignition: { label: 'Soul Ignition attack speed active', default: false },
    sealed: { label: 'Champions sealed by Purgatory so far', kind: 'int', default: 0, min: 0 },
  },
  // nails: Soul Nails on the target; sealUntil: when Purgatory's mark runs out
  counters: { nails: { max: 'LockeQ.MaxStacks' }, sealUntil: {} },
  p: {
    rules: [{
      id: 'stake', on: 'onhit', type: 'magic',
      // the tooltip puts the maximum at 30% health; read as growing evenly until there
      amount: 'MinOnHitDamage + (MaxOnHitDamage - MinOnHitDamage) * min(1, target.missingHpPct / 0.7)',
      note: 'Silver Stake is read as growing evenly with the target\'s missing health, up to its maximum at 30% health.',
    }],
  },
  q: {
    hits: [{
      id: 'nails', type: 'magic', amount: 'MissileDamage', count: 'landed', then: 'nails += landed',
      note: 'Every nail of Ritual Nails is counted hitting the one target unless "Soul Nails that hit per Ritual Nails" is lowered.',
    }],
    rules: [
      { id: 'consume', label: 'Soul Nails consumed', on: 'attack', when: 'nails > 0', type: 'magic', amount: 'nailBurst', then: 'nails = 0' },
      // Ashen Pursuit's hits consume them as an attack does
      { id: 'consumeDash', label: 'Soul Nails consumed', on: 'spell', when: 'cast.e && nails > 0', type: 'magic', amount: 'nailBurst', then: 'nails = 0' },
    ],
    notes: ['The Soul Nails on the target are set off by the next basic attack or Ashen Pursuit in the combo; without one after Ritual Nails they deal nothing more.'],
  },
  w: {
    // the health it burns is Locke's own; what it adds to a fight is attack speed
    statMods: [{ stat: 'attackSpeed', value: "calc('AttackSpeed')", when: 'ignition' }],
    notes: ['The attack speed is off unless "Soul Ignition attack speed active" is set, and is then counted for the whole fight.'],
  },
  e: {
    hits: [
      { id: 'arrival', label: 'Arrival', type: 'magic', amount: 'OnHitDamage' },
      // the dash rides on his next attack; the attack itself is an aa in the combo
      {
        id: 'dash', label: 'Dash on the next attack', type: 'magic', amount: 'DashDamage',
        note: 'Ashen Pursuit counts both the arrival and the dash of the attack that follows; add the auto attack to the combo.',
      },
    ],
  },
  r: {
    hits: [{ id: 'artifact', type: 'magic', amount: 'Damage', then: 'sealUntil = time + Duration' }],
    rules: [{
      id: 'seal', label: 'Purgatory seal', on: 'after', when: 'sealing', type: 'true', amount: 'target.hp', then: 'sealUntil = 0',
      note: 'Purgatory finishes a target that drops below its threshold while marked, read as a share of maximum health. "Champions sealed by Purgatory so far" raises that threshold.',
    }],
  },
});
