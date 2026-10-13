import { champion } from '../dsl.ts';

/* Azir's damage is his soldiers. An attack near one is not a basic attack at
   all: the soldiers stab instead, for magic damage, and carry on-hit effects at
   reduced strength. The engine's basic attack is always his own, so the stab is
   what one W in the combo stands for. Summoning a soldier deals nothing. */
export default champion('Azir', {
  reviewed: '16.20.1',
  options: {
    soldiers: { label: 'Sand Soldiers in reach of the target', kind: 'int', default: 1, min: 1 },
    discShots: { label: 'Sun Disc shots that hit the target', kind: 'int', default: 0, min: 0 },
  },
  counters: { discFired: {} },
  p: {
    rules: [
      // the Sun Disc is a turret firing on its own; its shots are the user's to count, dealt once per fight
      {
        id: 'disc', label: 'Sun Disc', on: 'after', when: 'discShots > 0 && !discFired', type: 'magic',
        amount: 'TowerDamage', count: 'discShots', then: 'discFired = 1',
      },
    ],
    notes: ['The Sun Disc is not counted unless "Sun Disc shots that hit the target" is set; each shot is then counted at its listed damage.'],
  },
  q: {
    // however many soldiers pass through the target, it takes the damage once
    hits: [{ id: 'sands', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{
      // soldiers after the first add a share; SubsequentDamageMod is in percent points.
      // on-hit effects land once per order at OnHitMultiplier, which the field can only take as a number
      id: 'stab', label: 'Soldier attack', type: 'magic',
      amount: 'TotalDamage * (1 + (soldiers - 1) * SubsequentDamageMod / 100)', appliesOnHit: 0.5,
      note: 'Each W in the combo is one attack made through the Sand Soldiers, with on-hit effects at half damage. Use it in place of basic attacks; a basic attack in the combo is Azir\'s own, away from his soldiers.',
    }],
    notes: ['One Sand Soldier strikes the target unless "Sand Soldiers in reach of the target" is raised.'],
  },
  e: {
    hits: [{ id: 'dash', type: 'magic', amount: 'TotalDamage' }],
  },
  r: {
    hits: [{ id: 'wall', type: 'magic', amount: 'TotalDamage' }],
  },
});
