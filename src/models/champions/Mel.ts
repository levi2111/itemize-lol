import { champion } from '../dsl.ts';

/* Mel's kit is held together by Overwhelm, and the game data only gives its
   amounts per stack:
   - Every instance of damage from her attacks and abilities adds a stack, so the
     stacks are counted where the damage is: one per explosion, per tick, per
     projectile.
   - The stacks store damage that is only dealt once it is enough to finish the
     target, and Golden Eclipse hits harder for each of them.
   - Each ability cast loads extra projectiles onto her next basic attack. */
export default champion('Mel', {
  reviewed: '16.20.1',
  vars: {
    // Golden Eclipse's ranks raise these; rank 0 is the amount before it is learned
    stored: 'MelR.PassiveFlatDamage + MelR.PassiveStackDamage * overwhelm',
    // the stored damage is magic damage, so it is compared after the target's magic resistance
    overwhelmed: 'hasTarget && overwhelm > 0 && target.hp > 0 && stored * 100 / (100 + max(0, target.mr)) > target.hp',
    snareTicks: 'snareSeconds * MelE.AreaTicksPerSecond',
  },
  options: {
    snareSeconds: { label: 'Seconds in Solar Snare\'s area', kind: 'int', default: 1, min: 0, max: 3 },
  },
  // overwhelm: stacks on the target; bolts: extra projectiles waiting for the next attack
  counters: { overwhelm: {}, bolts: { max: 'MelPassive.MaxPassiveBonusMissiles' } },
  p: {
    rules: [
      { id: 'arm', on: 'ability', type: 'magic', amount: 0, then: 'bolts += PassiveBonusMissiles' },
      // the attack itself adds a stack, and so does every projectile fired with it
      {
        id: 'bolts', label: 'Extra projectiles', on: 'attack', type: 'magic', amount: 'PassiveBonusMissileDamage', count: 'bolts',
        then: ['overwhelm += 1 + bolts', 'bolts = 0'],
        note: 'Every ability cast loads extra projectiles onto the next basic attack; put an auto attack after the casts to count them.',
      },
      {
        id: 'execute', label: 'Overwhelm', on: 'after', when: 'overwhelmed', type: 'magic', amount: 'stored', then: 'overwhelm = 0',
        note: 'The damage stored by Overwhelm is only dealt when it is enough to finish the target. That check uses the target\'s full magic resistance, so with magic penetration it comes slightly late.',
      },
    ],
  },
  q: {
    hits: [
      { id: 'first', label: 'First explosion', type: 'magic', amount: 'InitialExplosionDamage', then: 'overwhelm += 1' },
      {
        id: 'rest', label: 'Further explosions', type: 'magic', amount: 'TotalExplosionDamage', count: 'ExplosionCount - 1',
        then: 'overwhelm += ExplosionCount - 1',
        note: 'Every explosion of Radiant Volley is counted on the one target.',
      },
    ],
  },
  // Rebuttal's damage is a share of whatever enemy projectile it reflects, which a model cannot know:
  // w is left out on purpose. Casting it still loads the passive's projectiles.
  e: {
    hits: [
      { id: 'orb', label: 'Orb', type: 'magic', amount: 'Damage', then: 'overwhelm += 1' },
      // the area has no duration of its own: it lasts as long as the orb is near, plus a short linger
      {
        id: 'area', label: 'Area', type: 'magic', amount: 'AreaDamagePerSecond / AreaTicksPerSecond', count: 'snareTicks',
        over: 'snareSeconds',
        then: 'overwhelm += snareTicks',
        note: 'Solar Snare counts the orb\'s hit and one second of its damaging area; change "Seconds in Solar Snare\'s area" for more or less. Each tick adds a stack of Overwhelm.',
      },
    ],
  },
  r: {
    // it cannot be cast on a target without Overwhelm, so one stack is the least it ever counts
    hits: [{
      id: 'eclipse', type: 'magic', amount: 'UltFlatDamage + UltStackDamage * max(1, overwhelm)', then: 'overwhelm += 1',
      note: 'Golden Eclipse counts the Overwhelm stacks the combo has put on the target before it: one per instance of damage from attacks and abilities. Cast first, it counts the single stack it needs.',
    }],
  },
});
