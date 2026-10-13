import { champion } from '../dsl.ts';

/* Static Field is two abilities in one slot: a shock that follows every attack
   while the ability is off cooldown, and the blast that puts it on cooldown. The
   order of the combo therefore decides how many shocks there are. */
export default champion('Blitzcrank', {
  reviewed: '16.20.1',
  options: {
    overdrive: { label: 'Overdrive attack speed active', default: false },
  },
  // discharged: Static Field has been cast this fight, so its passive is gone
  counters: { discharged: { max: 1 } },
  // Mana Barrier only shields
  p: {},
  q: {
    hits: [{ id: 'grab', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    statMods: [{ stat: 'attackSpeed', value: 'AttackSpeedMod', when: 'overdrive' }],
    notes: ['The attack speed is off unless "Overdrive attack speed active" is set.'],
  },
  e: {
    // TotalDamage is the whole empowered attack; the engine already counts the attack itself.
    // the game data has no crit calculation: the bonus is multiplied like the attack it rides on
    hits: [{
      id: 'fist', type: 'physical', amount: 'TotalDamage - ad', crit: '(TotalDamage - ad) * critDamage',
      note: 'Power Fist counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
  },
  r: {
    rules: [
      // each attack leaves a mark and marks go off one per ZapCountdown, so sustained attacking cannot shock faster than that
      {
        id: 'shock', label: 'Static Field shock', on: 'attack', when: '!discharged', type: 'magic',
        amount: 'PassiveDamage * if(sustained, min(1, 1 / (attackSpeed * ZapCountdown)), 1)',
        note: 'Every attack made before Static Field is cast adds one shock; attacks after the cast add none, as the ability is on cooldown. Sustained damage counts at most one shock a second.',
      },
    ],
    hits: [{ id: 'field', type: 'magic', amount: 'ActiveDamage', then: 'discharged = 1' }],
  },
});
