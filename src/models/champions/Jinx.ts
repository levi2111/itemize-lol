import { champion } from '../dsl.ts';

/* Jinx's damage is mostly her basic attacks, and Switcheroo! decides what they
   are: the minigun ramps attack speed, the rocket launcher makes every attack
   hit harder and scale a little worse with attack speed. The weapon is a
   choice held for the whole fight, so it is an option rather than a cast. */
export default champion('Jinx', {
  reviewed: '16.20.1',
  options: {
    rockets: { label: 'Using Fishbones, the rocket launcher', default: false },
    revved: { label: 'Pow-Pow at full attack speed stacks', default: 'sustained' },
    // the tooltip states the five stacks in prose; the game data has no value for the cap
    excited: { label: 'Get Excited! stacks (takedowns)', kind: 'int', default: 0, min: 0, max: 5 },
    farRocket: { label: 'Super Mega Death Rocket has flown for a full second', default: true },
  },
  p: {
    // a share of total attack speed. her attack speed ratio equals her base attack speed, so total = base * (1 + bonus)
    statMods: [{ stat: 'attackSpeed', value: 'excited * ASBuff / 100 * (1 + bonusAs)', phase: 'convert', when: 'excited' }],
  },
  q: {
    rules: [
      // RocketDamage is the whole attack; the engine already counts the attack itself. it crits like the attack does
      {
        id: 'rocket', label: 'Fishbones', on: 'attack', when: 'rockets', type: 'physical',
        amount: 'RocketDamage - ad', crit: '(RocketDamage - ad) * critDamage',
      },
    ],
    statMods: [
      // minigun stacks only carry over to the first rocket, so they are left out while using the launcher
      { stat: 'attackSpeed', value: 'MinigunAttackSpeedMax / 100', when: 'revved && !rockets' },
      { stat: 'attackSpeed', value: '-RocketASPDPenalty', phase: 'percent', when: 'rockets' },
    ],
    notes: [
      'Swapping weapons deals nothing and, as a toggle, does not set off effects that react to abilities: leave Q out of the combo and pick the weapon with "Using Fishbones, the rocket launcher".',
      'With the minigun, damage per second counts its attack speed at full stacks from the first attack.',
    ],
  },
  w: {
    hits: [{ id: 'zap', type: 'physical', amount: 'TotalDamage' }],
  },
  e: {
    // three chompers, but a champion is caught by only one
    hits: [{ id: 'chomper', type: 'magic', amount: 'TotalDamage', note: 'One Flame Chomper is counted; a champion can only be hit by one.' }],
  },
  r: {
    hits: [{
      id: 'rocket', type: 'physical',
      amount: 'if(farRocket, DamageMax, DamageFloor) + PercentDamage / 100 * target.missingHp',
      note: 'Super Mega Death Rocket is counted at its maximum, after a second of flight; with "has flown for a full second" off it is the point-blank minimum. The missing health part uses what the target has lost by the time it is cast.',
    }],
  },
});
