import { champion } from '../dsl.ts';

/* Ryze's three spells are one formula each. What the game data leaves to prose:
   - Arcane Mastery turns ability power into mana, and every spell scales with
     bonus mana.
   - Overload hits harder on a target with Flux. Flux comes from Spell Flux and is
     spent by the next Overload or Rune Prison, so whether it is there depends on
     the order of casts. A combo given as counts has no order, so it is an option
     that is on by default: Spell Flux into Overload is how he is played. */
export default champion('Ryze', {
  reviewed: '16.20.1',
  vars: {
    // the bonus is a value of Realm Warp, read at its rank, and exists before Realm Warp is learned; in percent points
    fluxBonus: 'if(flux && rank.e > 0, RyzeR.OverloadDamageBonus / 100, 0)',
  },
  options: {
    flux: { label: 'Target has Flux when Overload lands', default: true },
  },
  p: {
    // the tooltip value is in percent points. only the share on bonus mana counts as bonus mana,
    // so it is added from bonus mana alone, after items have settled ability power
    statMods: [{ stat: 'mana', phase: 'convert', value: 'bonusMana * PassiveManaCalcTooltip / 100' }],
  },
  q: {
    hits: [{
      id: 'blast', type: 'magic', amount: 'QDamageCalc * (1 + fluxBonus)',
      note: 'Every Overload is counted with its bonus against a target with Flux, as when each follows a Spell Flux, unless "Target has Flux when Overload lands" is turned off.',
    }],
  },
  w: {
    hits: [{ id: 'prison', type: 'magic', amount: 'WDamageCalc' }],
  },
  e: {
    hits: [{ id: 'orb', type: 'magic', amount: 'EDamageCalc' }],
  },
  // Realm Warp only teleports; its passive is the Flux bonus Overload reads above
  r: {},
});
