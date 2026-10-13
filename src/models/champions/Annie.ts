import { champion } from '../dsl.ts';

/* Annie's own spells are one amount each. What the game data leaves open is
   Tibbers: his burn is given per second for a lifetime no enemy stands in, and
   his attacks have a damage value but no attack speed. Both are steppers. */
export default champion('Annie', {
  reviewed: '16.20.1',
  options: {
    tibbersSeconds: { label: 'Seconds the target stays in Tibbers\' burn', kind: 'int', default: 3, min: 0 },
    tibbersAttacks: { label: 'Tibbers basic attacks on the target', kind: 'int', default: 0, min: 0 },
  },
  // Pyromania only stuns
  p: {},
  q: {
    hits: [{ id: 'fireball', type: 'magic', amount: 'TotalDamage' }],
  },
  w: {
    hits: [{ id: 'wave', type: 'magic', amount: 'TotalDamage' }],
  },
  e: {
    // dealt when an enemy hits the shielded ally, once per shield
    hits: [{
      id: 'return', label: 'Molten Shield struck', type: 'magic', amount: 'DamageReturn',
      note: 'Molten Shield is counted as if the target hits the shielded ally; it deals nothing otherwise.',
    }],
  },
  r: {
    hits: [
      { id: 'burst', label: 'Summon', type: 'magic', amount: 'InitialBurstDamage' },
      // damage is given per second; nobody stands in it for Tibbers' whole lifetime
      {
        id: 'burn', label: 'Tibbers\' burn', type: 'magic', amount: 'TibbersAuraDamage', count: 'min(tibbersSeconds, TibbersLifetime)', over: 'min(tibbersSeconds, TibbersLifetime)',
        note: 'Tibbers\' burn is counted for "Seconds the target stays in Tibbers\' burn", 3 unless changed.',
      },
      // the game data has no attack speed for Tibbers, so the number of attacks is the user's
      { id: 'maul', label: 'Tibbers\' attacks', type: 'magic', amount: 'TibbersAADamage', count: 'tibbersAttacks' },
    ],
    // the passive half: magic penetration from the first rank on
    statMods: [{ stat: 'magicPenPct', value: 'RPercentPenBuff' }],
    notes: ['Tibbers\' own attacks are not counted unless "Tibbers basic attacks on the target" is set.'],
  },
});
