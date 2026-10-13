import { champion } from '../dsl.ts';

/* Tryndamere's damage is his basic attacks; the kit decides how often they crit.
   Fury is critical strike chance, and stats are worked out once per fight, so the
   Fury he walks in with is an option that feeds the stat. What the fight adds on
   top (attacks, Spinning Slash, Undying Rage) is a counter, and the crits it buys
   are a rule on each attack, since the engine's own attack was already dealt at
   the starting chance. Bloodlust's attack damage follows his own missing health,
   which the engine does not track: an option as well. */
export default champion('Tryndamere', {
  reviewed: '16.20.1',
  vars: {
    // the Fury bar holds 100; the game data has no value for it
    furyCap: 100,
    // PassiveCritConversionTooltip is in percent points per point of Fury
    perFury: 'TryndamerePassive.PassiveCritConversionTooltip / 100',
    // crit chance right now: the stat holds the starting Fury's share, this moves it by what the fight changed since
    critNow: 'clamp(critChance + gained * perFury, 0, 1)',
  },
  options: {
    // kept up in a long fight, not there yet at the start of a short one
    fury: { label: 'Fury when the fight starts', kind: 'int', default: 'if(sustained, furyCap, 0)', min: 0, max: 100 },
    missingHealth: { label: 'Tryndamere\'s missing health (%)', kind: 'int', default: 0, min: 0, max: 100 },
  },
  // Fury gained since the fight started; negative once Bloodlust has spent the starting Fury
  counters: { gained: { max: 'furyCap - fury' } },
  p: {
    statMods: [{ stat: 'critChance', value: 'fury * perFury' }],
    rules: [
      // the attack itself was dealt at the stat's averaged crit; this is the share of a crit that Fury gained mid-fight adds.
      // the tooltip states 5 Fury per attack and 10 on a critical strike; the game data has no value for either
      {
        id: 'crit', label: 'Critical strikes from Fury gained in the fight', on: 'attack', type: 'physical',
        amount: 'ad * (critDamage - 1) * (critNow - critChance)', then: 'gained += 5 + 5 * critNow',
      },
    ],
    notes: [
      'A combo starts at "Fury when the fight starts" (0 unless set) and builds Fury with every attack, Spinning Slash and Undying Rage; sustained damage assumes full Fury.',
      'Critical strikes are averaged, so each attack adds the Fury of an average attack.',
    ],
  },
  q: {
    // the active only heals; what it costs is the Fury
    hits: [{ id: 'spend', type: 'physical', amount: 0, then: 'gained = -fury' }],
    // none at full health, the maximum from RemainingHealthThreshold down
    statMods: [{ stat: 'ad', value: 'MaximumBonusAD * min(1, missingHealth / 100 / (1 - RemainingHealthThreshold))' }],
    notes: [
      'Bloodlust\'s attack damage follows "Tryndamere\'s missing health", which starts at 0. It is assumed to grow evenly from nothing at full health to its maximum.',
      'Casting Bloodlust spends the Fury built during the combo. Critical strike chance from "Fury when the fight starts" cannot be taken away mid-fight and stays.',
    ],
  },
  // Mocking Shout only lowers the enemy's attack damage and slows
  w: {},
  e: {
    hits: [{ id: 'spin', type: 'physical', amount: 'TotalDamage', then: 'gained += ChampFuryGain' }],
  },
  r: {
    // no damage of its own: the Fury is critical strike chance for the attacks that follow
    hits: [{ id: 'rage', type: 'physical', amount: 0, then: 'gained += TryndRFuryGain' }],
    notes: ['Undying Rage deals no damage; the Fury it grants raises the critical strike chance of the attacks after it.'],
  },
});
