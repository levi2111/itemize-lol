import { champion } from '../dsl.ts';

/* Ricochet is the part the game data cannot settle: its bounces go to other
   enemies, so a lone target takes none of them. With a second enemy to bounce
   off, one bounce of each attack comes back. Both are options. */
export default champion('Sivir', {
  reviewed: '16.20.1',
  vars: {
    // a bounce can only happen while Ricochet is up
    ricocheting: 'ricochet || bounce',
  },
  options: {
    ricochet: { label: 'Ricochet active', default: false },
    bounce: { label: 'Ricochet bounces back off another enemy nearby', default: false },
    // the lab's timeline keeps On The Hunt's duration for its cooldown refunds; it changes no damage
    hunting: { label: 'On The Hunt active', default: false, timeline: true },
  },
  // Fleet of Foot only grants move speed
  p: {},
  q: {
    // TotalDamage already holds the crit chance scaling, so there is no separate crit
    hits: [
      { id: 'out', label: 'Blade going out', type: 'physical', amount: 'TotalDamage' },
      { id: 'back', label: 'Blade coming back', type: 'physical', amount: 'TotalDamage', note: 'Both passes of Boomerang Blade are counted, at full damage: no falloff from minions hit first.' },
    ],
  },
  w: {
    rules: [
      // each target can be struck twice: the attack itself, then one bounce coming back
      {
        id: 'bounce', label: 'Ricochet bounce', on: 'attack', when: 'bounce', type: 'physical',
        amount: 'BounceDamage', crit: 'BounceDamage * critDamage',
        note: 'A lone target takes no Ricochet bounces. With "Ricochet bounces back off another enemy nearby" set, every basic attack adds one bounce on the target.',
      },
    ],
    statMods: [{ stat: 'attackSpeed', value: 'RicochetAttackSpeed', when: 'ricocheting' }],
    notes: ['The attack speed is off unless "Ricochet active" is set, and then lasts the whole fight.'],
  },
  // Spell Shield only blocks an ability and heals
  e: {},
  // On The Hunt only grants move speed and refunds cooldowns
  r: {},
});
