import { champion } from '../dsl.ts';

/* Rumble's basic abilities have two versions, and which one a cast gets depends
   on the Heat the casts before it built up. The game data has both versions'
   damage and every Heat amount; the model keeps the bar and picks between them.

   Flamespitter and The Equalizer are given as a total and as damage per second;
   how much of them a lone target takes is what the model adds. */
export default champion('Rumble', {
  reviewed: '16.20.1',
  vars: {
    heat: 'min(startHeat + built, RumbleHeatSystem.OverheatingHeat)',
    danger: 'heat >= RumbleHeatSystem.DangerZoneHeat',
    overheated: 'heat >= RumbleHeatSystem.OverheatingHeat',
  },
  options: {
    startHeat: { label: 'Heat at the start of the fight', kind: 'int', default: 0, min: 0 },
    equalizerSeconds: { label: 'Seconds the target burns in The Equalizer', kind: 'int', default: 'RumbleCarpetBomb.MaxBurnSeconds', min: 1 },
  },
  // built: Heat generated this fight; harpoons: Electro Harpoons that hit the target; hot: the last of them was a Danger Zone one
  counters: { built: {}, harpoons: { max: 2 }, hot: {} },
  p: {
    rules: [
      // Heat is generated as the cast begins, so the cast that reaches the Danger Zone is already empowered
      {
        id: 'heat', on: 'ability', when: 'cast.q || cast.w || cast.e', type: 'magic', amount: 0,
        then: 'built += cast.q * RumbleFlameThrower.InitialHeatCost + cast.w * RumbleShield.HeatCost + cast.e * RumbleGrenade.FirstCastHeatCost',
      },
      { id: 'overheat', label: 'Overheated attack', on: 'onhit', when: 'overheated', type: 'magic', amount: 'TotalBaseDamage + OverheatPercBonusDamage * target.maxHp' },
    ],
    // stats are settled before the fight, so the attack speed only follows the starting Heat
    statMods: [{ stat: 'attackSpeed', value: 'OverheatAS', when: 'overheated' }],
    notes: [
      'Heat is followed through the combo: each Q, W or E generates it, and a cast that leaves Rumble in the Danger Zone is the empowered version. Set "Heat at the start of the fight" for the Heat Rumble walks in with; Heat cooling off is not counted.',
      'At full Heat Rumble is overheated for the rest of the combo: his attacks deal the bonus damage, and abilities cast after that are still counted although he would be silenced. The Overheat attack speed is counted only when the starting Heat is already full.',
    ],
  },
  q: {
    // both versions are totals over the channel, dealt in TotalTicks equal ticks
    hits: [{
      id: 'flames', type: 'magic', count: 'TotalTicks', over: 'FlamespitterDuration',
      amount: 'if(danger, EmpoweredDamage + EmpoweredHealth * target.maxHp, FlatDamage + HealthDamage * target.maxHp) / TotalTicks',
      note: 'Every tick of Flamespitter\'s full duration is counted.',
    }],
  },
  // Scrap Shield only shields and speeds Rumble up; the Heat it generates is counted
  w: {},
  e: {
    hits: [{
      id: 'harpoon', type: 'magic', amount: 'if(danger, EmpDamage, TotalDamage)',
      // the magic resist loss is taken to land with the harpoon's damage, so it helps from the next hit on
      then: ['harpoons += 1', 'hot = danger'],
      note: 'One cast is one harpoon; add E to the combo twice for both charges. The magic resist reduction starts after the harpoon that applies it and is kept for the rest of the combo, at the stronger value once a second harpoon has hit.',
    }],
    // the tooltip states the Danger Zone's 50% on the reduction; the game data has no value for it
    resists: [{ stat: 'mr', kind: 'reducePct', value: 'if(harpoons >= 2, EnhancedMagicPen, PercMagicPen) * if(hot, 150%, 100%)', when: 'harpoons >= 1' }],
  },
  r: {
    // damage is given per second; a target that never leaves the trail burns for MaxBurnSeconds
    hits: [{
      id: 'burn', type: 'magic', amount: 'DamagePerSecond', count: 'min(equalizerSeconds, MaxBurnSeconds)',
      over: 'min(equalizerSeconds, MaxBurnSeconds)',
      note: 'One cast counts the target burning in The Equalizer\'s trail for its whole duration; lower "Seconds the target burns in The Equalizer" for a target that walks out.',
    }],
  },
});
