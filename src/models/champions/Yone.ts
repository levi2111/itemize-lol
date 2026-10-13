import { champion } from '../dsl.ts';

/* Yone's formulas are one calculation per ability. What they leave out is the
   two blades and the spirit:
   - Every second attack is half magic damage. The engine's attack is all
     physical, so that attack is cut by the share and the passive deals the
     share itself.
   - Intent doubles crit chance, weakens crits and turns the chance past 100%
     into attack damage: three stat changes, worked out on the finished build.
   - Soul Unbound repeats a share of everything dealt during it, after
     mitigation. The model language has no "damage dealt so far", so the share is
     added to each hit as it lands, which comes to the same total. */
export default champion('Yone', {
  reviewed: '16.20.1',
  vars: {
    casting: 'cast.q || cast.w || cast.e || cast.r',
    // the spirit form lasts seconds, so the option is for a combo and not for sustained attacking
    spirit: '(soulUnbound && !sustained) || time < spiritUntil',
  },
  options: {
    soulUnbound: { label: 'Soul Unbound active for the whole combo', default: false },
  },
  // azakana: the next attack is the Azakana Sword's; swung: this action's basic attack has landed; spiritUntil: the moment the spirit form ends
  counters: { azakana: {}, swung: {}, spiritUntil: {} },
  p: {
    rules: [
      // the split is of the attack itself, not of what the attack sets off, so everything after the attack's own damage is marked
      { id: 'swung', on: 'damage', type: 'physical', amount: 0, then: 'swung = 1' },
      // the engine's attack with its averaged crit, times the share the amp below took off it; then the blades swap
      {
        id: 'azakana', label: 'Azakana Sword', on: 'attack', type: 'magic',
        amount: 'if(azakana, ad * (1 + critChance * (critDamage - 1)) * MagicDamageSplit, 0)', then: 'azakana = 1 - azakana',
        note: 'Every second basic attack deals half its damage as magic damage, starting with the second attack of the fight.',
      },
      { id: 'next', on: 'after', type: 'physical', amount: 0, then: 'swung = 0' },
    ],
    amps: [{ value: '-MagicDamageSplit', when: 'azakana && !swung && !casting', types: ['physical'] }],
    // all three run last and read the build's crit before any of them has changed it
    statMods: [
      { stat: 'critChance', value: 'critChance * CritChanceMultiplier', phase: 'convert' },
      // YoneCritToAD is the attack damage for a whole 100% of crit chance past the cap
      { stat: 'ad', value: 'max(0, critChance * (1 + CritChanceMultiplier) - 1) * YoneCritToAD', phase: 'convert' },
      // the modifier scales the whole crit, bonus crit damage from items included
      { stat: 'critDamage', value: '-(1 - CritDamageMod) * critDamage', phase: 'convert' },
    ],
  },
  q: {
    // the third cast's dash and whirlwind deal the same damage and cannot both hit one target
    hits: [{ id: 'thrust', type: 'physical', amount: 'QDamage', crit: 'TotalDamageCrit', appliesOnHit: true }],
  },
  w: {
    // the tooltip halves the two parts itself; the game data has no value for the split
    hits: [
      { id: 'steel', type: 'physical', amount: '(BaseDamage + MaxHealthDamage * target.maxHp) / 2' },
      { id: 'azakana', type: 'magic', amount: '(BaseDamage + MaxHealthDamage * target.maxHp) / 2' },
    ],
  },
  e: {
    // no damage of its own: what it repeats is the amp below
    hits: [{ id: 'spirit', type: 'true', amount: 0, then: 'spiritUntil = time + ReturnTimer' }],
    // true damage equal to a share of what landed is that share more of every hit, whatever its type
    amps: [{ value: 'DeathmarkPercent', when: 'spirit' }],
    notes: [
      'Soul Unbound repeats a share of the damage dealt after it in the combo, for as long as the spirit form lasts; that share is shown as part of the damage it repeats.',
      'Set "Soul Unbound active for the whole combo" when E is cast first.',
      'Damage from item effects dealt during the spirit form is repeated as well.',
    ],
  },
  r: {
    // TooltipDamage is one half of the strike
    hits: [
      { id: 'steel', type: 'physical', amount: 'TooltipDamage' },
      { id: 'azakana', type: 'magic', amount: 'TooltipDamage' },
    ],
  },
});
