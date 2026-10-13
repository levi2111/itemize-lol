import { champion } from '../dsl.ts';

/* Most of Dr. Mundo's damage depends on health: the target's for the bonesaw,
   his own maximum for attack damage, and how much of his own he is missing for
   Blunt Force Trauma and Maximum Dosage. The engine keeps the attacker at full
   health, so his missing health is an option. */
export default champion('DrMundo', {
  reviewed: '16.20.1',
  options: {
    missingHealth: { label: 'Dr. Mundo\'s missing health (%)', kind: 'int', default: 0, min: 0, max: 100 },
    maximumDosage: { label: 'Maximum Dosage active', default: false },
  },
  // Goes Where He Pleases only resists an immobilizing effect and regenerates health
  p: {},
  q: {
    hits: [{
      id: 'bonesaw', type: 'magic', amount: 'max(MinimumDamage, CurrentHealthDamage * target.hp)',
      note: 'Infected Bonesaw takes a share of the health the target has left when it lands, and never less than its minimum.',
    }],
  },
  w: {
    hits: [
      // the tooltip gives damage per second as four ticks; the game data has no value for the tick rate
      { id: 'zap', type: 'magic', amount: 'DamagePerTick', count: 'Duration * 4', over: 'Duration' },
      { id: 'detonate', label: 'Detonation', type: 'magic', amount: 'TotalDamage', note: 'Heart Zapper is counted for its full duration, every tick, followed by the detonation.' },
    ],
  },
  e: {
    // the swatted corpse only hits other enemies
    hits: [{
      id: 'swing', type: 'physical',
      amount: 'AdditionalDamage * (1 + (MaxDamageAmp - 1) * min(1, missingHealth / 100 / MaxMissingHealthThreshold))',
      note: 'Blunt Force Trauma counts only what it adds to the attack; put a basic attack after it in the combo. It grows with "Dr. Mundo\'s missing health", which starts at 0.',
    }],
    // reads his finished maximum health, items included
    statMods: [{ stat: 'ad', phase: 'convert', value: 'PassiveBonusAD' }],
  },
  r: {
    // the health it adds is base health: it feeds Blunt Force Trauma's attack damage, not the bonus health ratios.
    // at rank 3 the one enemy counts as the nearby champion
    statMods: [{
      stat: 'ad', phase: 'convert', when: 'maximumDosage && rank.e',
      value: 'DrMundoE.PassiveBonusAD * (MissingHealthHeal + (rank >= 3) * BonusPerNearbyChampion) * missingHealth / 100',
    }],
    notes: ['Maximum Dosage deals no damage. With "Maximum Dosage active" the maximum health it adds, a share of "Dr. Mundo\'s missing health", becomes attack damage through Blunt Force Trauma.'],
  },
});
