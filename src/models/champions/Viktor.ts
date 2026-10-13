import { champion } from '../dsl.ts';

/* Glorious Evolution upgrades each ability once. Only one upgrade changes damage
   on one target: Hextech Ray's aftershock. The others add a shield, move speed,
   slows, and a storm that grows when enemies die. Which abilities are upgraded
   is not in the stats, so it is an option. */
export default champion('Viktor', {
  reviewed: '16.20.1',
  options: {
    // on by default: Hextech Ray is the first upgrade and is in place for most of the game
    eUpgraded: { label: 'Hextech Ray upgraded (aftershock)', default: true },
  },
  // Glorious Evolution only collects Hex Fragments
  p: {},
  q: {
    hits: [
      { id: 'blast', type: 'magic', amount: 'TotalMissileDamage' },
      // AttackTotalDMG is the whole empowered attack; the engine already counts the attack itself
      {
        id: 'discharge', label: 'Siphon Power empowered attack', type: 'magic', amount: 'AttackTotalDMG - ad',
        note: 'Siphon Power counts what it adds to the next attack; put a basic attack after it in the combo. That attack\'s own damage is counted as physical, in game it turns magic.',
      },
    ],
  },
  // Gravity Field only slows and stuns
  w: {},
  e: {
    hits: [
      { id: 'ray', type: 'magic', amount: 'LaserDamage' },
      {
        id: 'aftershock', label: 'Hextech Ray aftershock', type: 'magic', amount: 'AftershockDamage', when: 'eUpgraded',
        note: 'The aftershock of the upgraded Hextech Ray is counted; turn off "Hextech Ray upgraded" for a Viktor without that upgrade yet.',
      },
    ],
  },
  r: {
    hits: [
      { id: 'burst', type: 'magic', amount: 'InitialBurstDamage' },
      {
        id: 'storm', label: 'Arcane Storm per second', type: 'magic', amount: 'SubsequentBurstDamage', count: 'MaxTicks', over: 'MaxTicks * TickCadence',
        note: 'Every tick of Arcane Storm is counted, as if the target stays inside it for its full duration.',
      },
    ],
  },
});
