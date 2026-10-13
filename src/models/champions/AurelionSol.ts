import { champion } from '../dsl.ts';

/* What the game data leaves open for Aurelion Sol:
   - Breath of Light is damage per second plus a burst each full second on the same
     enemy. How long the breath lasts is a channel time at ranks 1 to 4 and has no
     limit at rank 5 or during Astral Flight, so the seconds are an option capped
     by the channel time where there is one.
   - Stardust is permanent and reads as 0 in every calculation that uses it. It is
     an option, plus what the abilities of this fight absorb.
   - Astral Flight deals nothing itself; it raises Breath of Light's flat damage. */
export default champion('AurelionSol', {
  reviewed: '16.20.1',
  vars: {
    dust: 'stardust + gathered',
    // the channel time only binds outside Astral Flight; at rank 5 the data value is far above any option
    qSeconds: 'if(flying && rank.w > 0, breath, min(breath, AurelionSolQ.MaxChannelDuration))',
    qBursts: 'floor(qSeconds / AurelionSolQ.BurstAfter)',
  },
  options: {
    stardust: { label: 'Stardust', kind: 'int', default: 0, min: 0 },
    breath: { label: 'Seconds Breath of Light stays on the target', kind: 'int', default: 4, min: 1 },
    flying: { label: 'Breath of Light used during Astral Flight', default: false },
    skies: { label: 'Falling Star is The Skies Descend', default: false },
  },
  // stardust absorbed from the target during this fight; added after the cast that absorbs it
  counters: { gathered: {} },
  p: {
    rules: [
      // each burst of Breath of Light adds a share of the target's maximum health per stardust
      {
        id: 'stardust', label: 'Stardust burst', on: 'spell', when: 'cast.q', type: 'magic', count: 'qBursts',
        amount: 'if(dust > 0, dust * QMaxHealthTrueDamagePerStack * target.maxHp, 0)',
        over: 'qSeconds',
        then: 'gathered += AurelionSolQ.QMassStolen * qBursts',
      },
    ],
    notes: ['Stardust is 0 unless "Stardust" is set; what the abilities in the combo absorb is added after each cast.'],
  },
  q: {
    hits: [
      // damage is given per second; a channel that ends on a part of a second is dealt as one amount
      { id: 'beam', type: 'magic', amount: 'DamagePerSecond', count: 'qSeconds', over: 'qSeconds' },
      {
        // the bursts land through the same channel as the beam
        id: 'burst', label: 'Breath of Light burst', type: 'magic', amount: 'BurstDamage', count: 'qBursts', over: 'qSeconds',
        note: 'Breath of Light is counted for its whole channel on the one target, with a burst each full second. At rank 5 and during Astral Flight it has no time limit and lasts "Seconds Breath of Light stays on the target" (4 unless changed).',
      },
    ],
  },
  w: {
    rules: [
      // the tooltip's "flat damage" is read as everything but the stardust share of maximum health
      {
        id: 'flight', label: 'Astral Flight bonus to Breath of Light', on: 'spell', when: 'cast.q && flying', type: 'magic',
        amount: 'TrueDamageBonus * (AurelionSolQ.DamagePerSecond * qSeconds + AurelionSolQ.BurstDamage * qBursts)',
        over: 'qSeconds',
      },
    ],
    notes: ['Astral Flight deals no damage itself. Set "Breath of Light used during Astral Flight" to count its bonus and unlimited breath.'],
  },
  e: {
    hits: [
      {
        id: 'hole', type: 'magic', amount: 'DamagePerSecond', count: 'Duration', over: 'Duration',
        note: 'The target is counted as staying in Singularity for its whole duration.',
      },
      // the execute; the stardust it absorbs arrives when the black hole ends
      {
        id: 'execute', label: 'Singularity execute', type: 'true',
        amount: 'if(hasTarget && target.hp > 0 && target.hpPct * 100 < BaseExecutionThreshold + dust * ExecutionGrowthPerBreakpoint, target.hp, 0)',
        then: 'gathered += ChampionMassPerSecond * Duration',
        note: 'Singularity kills the target if its own damage leaves it under the execute threshold, which assumes it was dragged to the center.',
      },
    ],
  },
  r: {
    hits: [
      { id: 'star', type: 'magic', amount: 'MaxDamageTooltip', when: '!skies', then: 'gathered += MassStolen' },
      // a target hit by the star itself is not hit by its shockwave
      {
        id: 'skies', label: 'The Skies Descend', type: 'magic', amount: 'R2Damage', when: 'skies', then: 'gathered += MassStolen',
        note: 'The Skies Descend counts the impact only; its shockwave hits enemies the star missed.',
      },
    ],
  },
});
