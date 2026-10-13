import { champion } from '../dsl.ts';

/* Heimerdinger's Q deals nothing when cast: the turret it leaves behind does the
   damage. The game data gives the damage of a regular shot and of a charged shot,
   but no attack speed for the turret, so the regular shots are a stepper. Charged
   shots do have a cause the model can follow: the rockets and the grenade charge
   every turret nearby when they hit a champion.

   UPGRADE!!! deals nothing itself either. It turns the next Q, W or E into another
   ability, and R in the combo stands for that ability. */
export default champion('Heimerdinger', {
  reviewed: '16.20.1',
  options: {
    turretShots: { label: 'Regular shots each turret lands on the target', kind: 'int', default: 3, min: 0 },
    upgrade: { label: 'UPGRADE!!! used on (1 Q turret, 2 W rockets, 3 E grenade)', kind: 'int', default: 2, min: 1, max: 3 },
  },
  // turrets: Evolution Turrets placed this fight; apex: the Apex Turret is up
  counters: { turrets: { max: 'HeimerdingerQ.MaxTurrets' }, apex: { max: 1 } },
  vars: {
    // the casts that charge turrets: W, E, and their upgraded versions
    charges: 'cast.w || cast.e || (cast.r && upgrade != 1)',
  },
  // Hextech Affinity only gives move speed
  p: {},
  q: {
    hits: [{
      id: 'shots', label: 'Turret shots', type: 'magic', amount: 'Damage', count: 'turretShots', then: 'turrets += 1',
      note: 'Each Q in the combo places one turret, which lands "Regular shots each turret lands on the target" on it, 3 unless changed.',
    }],
    rules: [
      // five rockets at 20% each, or one grenade, fill the charge; every turret standing then fires its beam once
      {
        id: 'beam', label: 'Turret charged shots', on: 'spell', when: 'charges', type: 'magic', amount: 'DamageBeam', count: 'turrets',
        note: 'Every W, E and upgraded W or E after a turret is placed makes each turret fire one charged shot. Charged shots from the turrets\' own slow charge are not counted.',
      },
    ],
  },
  w: {
    hits: [{ id: 'rockets', type: 'magic', amount: 'TotalDamage', note: 'All 5 rockets are counted on the one target.' }],
  },
  e: {
    hits: [{ id: 'grenade', type: 'magic', amount: 'Damage' }],
  },
  r: {
    hits: [
      // the apex turret is not one of the three and lasts a fixed time; its shots use the same stepper
      {
        id: 'apexShots', label: 'Apex Turret shots', when: 'upgrade == 1', type: 'magic', amount: 'QUltDamage', count: 'turretShots', then: 'apex = 1',
        note: 'The Apex Turret lands "Regular shots each turret lands on the target" on it, like any other turret, and fires one charged shot for each W or E cast after it.',
      },
      {
        id: 'swarm', label: 'Hextech Rocket Swarm', when: 'upgrade == 2', type: 'magic', amount: 'WUltTotalDamage',
        note: 'All 20 rockets of Hextech Rocket Swarm are counted on the one target.',
      },
      // three discharges, but a champion takes damage from the grenade only once
      {
        id: 'lightning', label: 'CH-3X Lightning Grenade', when: 'upgrade == 3', type: 'magic', amount: 'EUltDamage',
        note: 'One discharge of the CH-3X Lightning Grenade is counted: it damages a champion once.',
      },
    ],
    rules: [
      { id: 'apexBeam', label: 'Apex Turret charged shot', on: 'spell', when: 'apex && (cast.w || cast.e)', type: 'magic', amount: 'QUltDamageBeam' },
    ],
    notes: [
      'R in the combo is the upgraded ability chosen in "UPGRADE!!! used on", the rocket swarm unless changed. It replaces that ability\'s normal cast, so leave one Q, W or E out of the combo for it.',
    ],
  },
});
