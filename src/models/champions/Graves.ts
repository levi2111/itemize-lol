import { champion } from '../dsl.ts';

/* Graves' basic attack is a shell of pellets, not one hit of total attack damage:
   the first pellet deals SingleBulletDamage, each further one MultiBulletDamage,
   and a critical strike fires more pellets at a smaller multiplier instead of the
   usual crit. The engine has already dealt a normal attack, so New Destiny adds
   the difference between that and the shell. */
export default champion('Graves', {
  reviewed: '16.20.1',
  options: {
    blastOnly: { label: 'Collateral Damage: caught by the explosion only', default: false },
  },
  p: {
    rules: [
      // 4 pellets, 6 on a crit: stated in the tooltip's prose only. the engine's attack was ad, or ad * critDamage on a crit
      {
        id: 'pellets', label: 'Shotgun pellets', on: 'attack', type: 'physical',
        amount: 'SingleBulletDamage + 3 * MultiBulletDamage - ad',
        crit: '(SingleBulletDamage + 5 * MultiBulletDamage) * (1 + CritDamageMult) - ad * critDamage',
        note: 'Every pellet of each attack is counted on the one target: 4, or 6 on a critical strike.',
      },
    ],
    notes: ['The reload after every two shells is not timed, so damage per second is overstated.'],
  },
  q: {
    hits: [
      { id: 'round', type: 'physical', amount: 'TotalDamage' },
      { id: 'detonation', label: 'Detonation', type: 'physical', amount: 'TotalDetonationDamage', note: 'Both the round and its detonation are counted.' },
    ],
  },
  w: {
    hits: [{ id: 'impact', type: 'magic', amount: 'ImpactDamage' }],
  },
  // Quickdraw is a dash that reloads a shell and grants armor and magic resist
  e: {},
  r: {
    // the explosion goes on to enemies behind the one the cartridge hit, so a lone target takes one or the other
    hits: [{
      id: 'cartridge', type: 'physical', amount: 'if(blastOnly, FalloffDamage, Damage)',
      note: 'The cartridge\'s direct hit is counted, unless "caught by the explosion only" is set.',
    }],
  },
});
