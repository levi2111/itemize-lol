import { champion } from '../dsl.ts';

/* Everything Dragon Practice does reads its stacks from a buff the static data
   cannot see, so every stack-scaled amount is rebuilt from the data values with
   the stacks as an option:
   - the magic damage it adds to Q, W and each bolt of E,
   - the extra bolts of Flap, Flap, Flap,
   - Super Scorcher Breath's burn and execute once it has enough stacks.
   Q's first two upgrades only reach other enemies: it damages each target once
   per cast, so the splash and the explosions beyond the target add nothing here. */
export default champion('Smolder', {
  reviewed: '16.20.1',
  vars: {
    bolts: 'floor(SmolderE.NumOfAttacksBase + practice * SmolderE.NumAttackStackRatio)',
    burning: 'practice >= SmolderQ.StackTier3',
  },
  options: {
    practice: { label: 'Dragon Practice stacks', kind: 'int', default: 0, min: 0 },
    center: { label: 'MMOOOMMMM! hits with its center', default: true },
  },
  // burnUntil: when the burn from the last Super Scorcher Breath runs out
  counters: { burnUntil: {} },
  p: {
    rules: [
      // scales with crit like the breath itself, at its own ratio
      { id: 'breath', label: 'Dragon Practice on Super Scorcher Breath', on: 'spell', when: 'cast.q', type: 'magic', amount: 'practice * QDamagePerStack * (1 + critChance * QCritRatio * (critDamage - 1))' },
      { id: 'sneeze', label: 'Dragon Practice on Achooo!', on: 'spell', when: 'cast.w', type: 'magic', amount: 'practice * WDamagePerStack' },
      // the crit share of a bolt's bonus is a bare number inside EBonusDamage; the game data has no value for it
      { id: 'flap', label: 'Dragon Practice on Flap, Flap, Flap', on: 'spell', when: 'cast.e', type: 'magic', count: 'bolts', amount: 'practice * EDamagePerStack * (1 + critChance * 0.75 * (critDamage - 1))' },
    ],
    notes: ['Set "Dragon Practice stacks" to the stacks Smolder has; stacks gained during the combo are not added.'],
  },
  q: {
    hits: [
      // TotalDamage already averages the crit in
      { id: 'breath', type: 'physical', amount: 'TotalDamage', appliesOnHit: true },
      // Tier3_Burn is the share of maximum health with the stacks read as 0
      {
        id: 'burn', label: 'Super Scorcher Breath burn', type: 'true', when: 'burning',
        amount: '(Tier3_Burn + practice * Tier3_Burn_Stack_Mult) * target.maxHp', then: 'burnUntil = time + Tier3_DotLength',
        over: 'Tier3_DotLength',
        note: 'With enough Dragon Practice stacks each Super Scorcher Breath adds its whole burn, and a burning target that drops under the execute threshold is killed.',
      },
    ],
    rules: [{
      id: 'execute', label: 'Super Scorcher Breath execute', on: 'after', type: 'true', amount: 'target.hp',
      when: 'burning && hasTarget && time < burnUntil && target.hp > 0 && target.hp < Tier3_ExecuteThreshold * target.maxHp',
    }],
  },
  w: {
    hits: [
      { id: 'sneeze', type: 'physical', amount: 'InitialDamage' },
      // a lone champion sets off one explosion; the reduced repeats come from other champions hit
      { id: 'explosion', label: 'Achooo! explosion', type: 'physical', amount: 'ExplosionDamage', note: 'Achooo! counts the sneeze and the one explosion from hitting a champion.' },
    ],
  },
  e: {
    hits: [{ id: 'bolts', type: 'physical', amount: 'DamagePerHit', count: 'bolts', note: 'Every bolt of Flap, Flap, Flap is counted on the one target.' }],
  },
  r: {
    hits: [{
      id: 'fire', type: 'physical', amount: 'if(center, TooltipOnly_TotalSweetspotDamage, TotalDamage)',
      note: 'MMOOOMMMM! is counted hitting with its center unless "MMOOOMMMM! hits with its center" is turned off.',
    }],
  },
});
