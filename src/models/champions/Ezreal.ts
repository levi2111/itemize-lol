import { champion } from '../dsl.ts';

/* Ezreal's formulas are one calculation per ability; the structure is around them.
   Rising Spell Force is attack speed from ability hits, and stats are worked out
   once per fight, so its stacks are an option rather than a counter. Essence Flux
   deals nothing on its own: its damage belongs to whatever hits the mark next. */
export default champion('Ezreal', {
  reviewed: '16.20.1',
  vars: {
    stacks: 'min(spellForce, EzrealPassive.MaxStacks)',
  },
  options: {
    // kept up by landing abilities in a long fight, not there yet in a short combo
    spellForce: { label: 'Rising Spell Force stacks', kind: 'int', default: 'if(sustained, EzrealPassive.MaxStacks, 0)', min: 0 },
  },
  p: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedPerStack * stacks' }],
    notes: ['Rising Spell Force is not built up during a combo: set "Rising Spell Force stacks" to the stacks Ezreal fights with. Sustained damage assumes full stacks.'],
  },
  q: {
    hits: [{ id: 'shot', type: 'physical', amount: 'Damage', appliesOnHit: true }],
  },
  w: {
    // counted at the cast instead of on the hit that detonates it, so the order of the combo does not lose it
    hits: [{ id: 'detonation', type: 'magic', amount: 'Damage', note: 'Essence Flux is counted as detonated; it only deals its damage once another attack or ability hits the marked target.' }],
  },
  e: {
    hits: [{ id: 'bolt', type: 'magic', amount: 'Damage' }],
  },
  r: {
    hits: [{ id: 'arc', type: 'magic', amount: 'Damage' }],
  },
});
