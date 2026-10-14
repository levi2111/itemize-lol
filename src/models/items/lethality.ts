/* Lethality items: bursts of true damage and attack damage after takedowns. Names on the right of
   each formula are the item's own data values and calculations: `npm run data:report -- --item <id>`
   lists them. docs/models.md says how an item's settings (options, procs, uses) work.

   Youmuu's Ghostblade, Serylda's Grudge, Axiom Arc, Edge of Night and Serpent's Fang have no model:
   their passives and actives move, slow, refund cooldowns or block, and their stats are counted anyway. */
import { item } from '../dsl.ts';

const P = '16.20.1';

export default [
  item(6697, 'Hubris', {
    reviewed: P,
    options: {
      eminence: { label: 'Eminence active from a recent takedown', default: false },
      kills: { label: 'Eminence stacks: champions killed so far', default: 0 },
    },
    statMods: [{ stat: 'ad', value: 'BaseADBonus + ADPerStatue * kills', when: 'eminence' }],
    notes: ['Eminence\'s Attack Damage counts every stack set, the takedown that started it included.'],
  }),
  item(2520, 'Bastionbreaker', {
    reviewed: P,
    rules: [{ id: 'charge', label: 'Shaped Charge', on: 'spell', type: 'true', amount: 'AbilityDamageCalc', cooldown: 'Cooldown', procs: true }],
  }),
  item(3179, 'Umbral Glaive', {
    reviewed: P,
    options: { unseen: { label: 'Unseen by enemies when the combo starts', default: false } },
    counters: { stalk: { max: 1, start: 'unseen' } },
    rules: [{ id: 'nightstalker', label: 'Nightstalker', on: 'attack', when: 'stalk', type: 'true', amount: 'ProcDamage', then: 'stalk = 0', procs: true }],
    notes: ['Nightstalker fires on the first attack only when the combo starts unseen. Stealth gained during the combo is not tracked; count those attacks by hand.'],
  }),
];
