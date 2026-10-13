import { champion } from '../dsl.ts';

/* What the game data leaves open for Urgot:
   - Echoing Flames fires the leg that faces the target, and each of the six legs
     has its own cooldown. How many legs come round to the target is footwork, so
     that is an option. The cooldowns are played as a volley: the legs fire one
     per attack and reload together, a cooldown after the volley's first shot.
   - Purge gives the damage of one shot and a rate. Every shot fires a leg cannon
     and applies on-hit effects like an attack, and the engine's clock stands
     still while it fires, so the model keeps those seconds itself.
   - Fear Beyond Death's kill is no number in the data: it is whatever health the
     target has left once it is under the threshold. */
export default champion('Urgot', {
  reviewed: '16.20.1',
  vars: {
    // the fight's clock with the seconds spent firing Purge added
    clock: 'time + purged',
    legReady: 'legs > 0 && (fired < legs || clock - volley >= UrgotPassive.PerLegCD)',
    cannon: 'UrgotPassive.ADDamage + UrgotPassive.PercentHPRatio * target.maxHp',
    // ranks 1 to 4 stop at Duration; at max rank the data value is far above any option
    shots: 'UrgotW.WAttacksPerSecond * min(purgeSeconds, UrgotW.Duration)',
  },
  options: {
    // the tooltip states six legs; the game data has no value for the count. half a circle is the default
    legs: { label: 'Leg cannons brought to face the target', kind: 'int', default: 3, min: 0, max: 6 },
    purgeSeconds: { label: 'Seconds Purge fires at the target', kind: 'int', default: 4, min: 1, max: 20 },
  },
  // fired: legs shot in the current volley; volley: when it began; purged: seconds of Purge so far;
  // purging: 1 while Purge's shots are being played; leash: when the chem-drill lets go
  counters: { fired: {}, volley: {}, purged: {}, purging: {}, leash: {} },
  p: {
    rules: [
      {
        id: 'leg', label: 'Leg cannon', on: 'attack', when: 'legReady', type: 'physical', amount: 'cannon',
        then: ['fired = if(clock - volley >= PerLegCD, 1, fired + 1)', 'volley = if(fired == 1, clock, volley)'],
      },
      // a Purge shot fires a leg the same way; it is not an on-hit effect, so it is not weakened like one
      {
        id: 'legPurge', label: 'Leg cannon', on: 'damage', when: 'purging && legReady', type: 'physical', amount: 'cannon',
        then: ['fired = if(clock - volley >= PerLegCD, 1, fired + 1)', 'volley = if(fired == 1, clock, volley)'],
      },
    ],
    notes: [
      'Three of the six leg cannons are counted as brought round to the target, one per attack or Purge shot, each firing again as soon as its cooldown is over. Change "Leg cannons brought to face the target" to count more or fewer: 6 is circling the target fully, 1 is standing still.',
    ],
  },
  q: {
    hits: [{ id: 'charge', type: 'physical', amount: 'TotalDamage' }],
  },
  w: {
    hits: [
      { id: 'spinUp', type: 'physical', amount: 0, then: 'purging = 1' },
      {
        id: 'shots', type: 'physical', amount: 'DamagePerShot', count: 'shots', over: 'min(purgeSeconds, Duration)', then: 'purging = 0',
        note: 'Purge is counted firing at the one target for its whole duration. At max rank it has no time limit and lasts "Seconds Purge fires at the target" (4 unless changed).',
      },
    ],
    // a rule's own on-hit goes off once however many shots it has, so each shot sets it off here instead.
    // the engine takes on-hit strength as a plain number: this is OnHitDamageReduction
    rules: [{ id: 'onhit', on: 'damage', when: 'purging', type: 'physical', amount: 0, appliesOnHit: 0.5, then: 'purged += 1 / WAttacksPerSecond' }],
  },
  e: {
    hits: [{ id: 'charge', type: 'physical', amount: 'EDamage' }],
  },
  r: {
    hits: [{ id: 'drill', type: 'physical', amount: 'RCalculatedDamage', then: 'leash = time + RSlowDuration' }],
    rules: [
      // the recast kills outright, so it is worth the health that is left
      {
        id: 'mercy', label: 'Execution', on: 'after', type: 'true', amount: 'target.hp', then: 'leash = 0',
        when: 'hasTarget && time < leash && target.hp > 0 && target.hpPct * 100 < RHealthThreshold',
        note: 'Fear Beyond Death kills the target once it is under the health threshold while impaled: whatever health is left then counts as true damage. Damage dealt before the drill, or in the seconds after it, can bring the target there.',
      },
    ],
  },
});
