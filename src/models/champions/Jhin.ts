import { champion } from '../dsl.ts';

/* Jhin's basic attacks are the engine's own: total attack damage, crits averaged.
   Whisper changes what feeds them (attack damage from crit chance and attack
   speed, weaker crits) and makes every fourth shot a guaranteed crit with
   missing-health damage on top. */
export default champion('Jhin', {
  reviewed: '16.20.1',
  vars: {
    // Curtain Call grows linearly with the target's missing health, up to MaxIncreaseCalc on a dead one
    curtain: 'JhinR.DamageCalc * (1 + JhinR.PercentMissingAmp * target.missingHpPct)',
  },
  options: {
    grenadeKills: { label: 'Dancing Grenade: enemies killed by earlier bounces', kind: 'int', default: 0, min: 0 },
  },
  counters: { shots: {} },
  p: {
    rules: [
      { id: 'chamber', on: 'attack', type: 'physical', amount: 0, then: 'shots += 1' },
      // the attack itself was dealt at the averaged crit; this is the rest of a certain one
      { id: 'fourthCrit', label: 'Fourth shot crit', on: 'attack', when: 'shots >= MaxAmmo', type: 'physical', amount: 'ad * (critDamage - 1) * (1 - critChance)' },
      {
        id: 'fourthExecute', label: 'Fourth shot', on: 'attack', when: 'shots >= MaxAmmo', type: 'physical',
        amount: 'FourthShotExecutePercent * target.missingHp', then: 'shots = 0',
        note: 'Every fourth attack is the last bullet. Its missing health damage is worked out after the shot itself has landed.',
      },
    ],
    statMods: [
      { stat: 'ad', value: 'TotalADPercent', phase: 'percent' },
      // the penalty scales the whole crit, bonus crit damage from items included
      { stat: 'critDamage', value: '-CritReductionPercent * critDamage', phase: 'convert' },
    ],
    notes: ['Attack speed stays at its level 1 value and the reload is not timed, so damage per second is approximate.'],
  },
  q: {
    // the cartridge only bounces to enemies it has not hit, so a lone target takes it once
    hits: [{
      id: 'grenade', type: 'physical', amount: 'TotalDamage * (1 + PercentAmpOnKill * min(grenadeKills, NumberOfBounces))',
      note: 'One hit, with no earlier bounce kills unless "enemies killed by earlier bounces" is set.',
    }],
  },
  w: {
    hits: [{ id: 'shot', type: 'physical', amount: 'TotalDamage' }],
  },
  e: {
    hits: [{ id: 'trap', type: 'magic', amount: 'TotalDamage', note: 'One Lotus Trap at full damage; a second trap right after it deals less.' }],
  },
  r: {
    hits: [
      // fired as fast as the channel allows: one shot per minimum delay, the fourth right after these three
      { id: 'shots', type: 'physical', amount: 'curtain', count: 3, over: '3 * MInimumDelayBetweenShots' },
      // the last shot's crit is its own multiplier, not Whisper's reduced one
      { id: 'final', label: 'Fourth shot', type: 'physical', amount: 'curtain * FourthShotMultiplier', note: 'All 4 shots of Curtain Call are counted, each against the health the last one left.' },
    ],
  },
});
