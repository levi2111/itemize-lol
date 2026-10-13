import { champion } from '../dsl.ts';

/* Two kits on one set of keys. The Spider Form abilities are spells of their own
   with no slot, so each is read from the slot that shares its key and scales with
   that slot's rank. "Spider Form" picks the form a fight starts in, and in an
   exact sequence every R switches it, so `q, w, r, q, aa` is Neurotoxin, Volatile
   Spiderling, Venomous Bite, a spider attack.

   Spider Queen's bonus on attacks is given by Spider Form's rank. Rappel raises it
   for a few seconds; that raise is a rule on E, so it scales with E's rank. */
export default champion('Elise', {
  reviewed: '16.20.1',
  vars: {
    inSpider: 'spider != shifted',
    rappelled: 'rappel || time < rappelUntil',
  },
  options: {
    spider: { label: 'Spider Form', default: false },
    rappel: { label: 'Rappel\'s bonus to Spider Queen active', default: false },
    frenzy: { label: 'Skittering Frenzy attack speed active', default: false },
    spiderlings: { label: 'Spiderlings attacking the target', kind: 'int', default: 0, min: 0 },
  },
  // rappelUntil: the moment the bonus from this fight's Rappel runs out
  counters: { shifted: {}, rappelUntil: {} },
  p: {
    rules: [
      // kept here so that R stays an ability without a cast of its own to play
      { id: 'shift', on: 'ability', when: 'cast.r', type: 'magic', amount: 0, then: 'shifted = 1 - shifted' },
      // an on-hit effect, so Venomous Bite carries it too
      { id: 'fangs', label: 'Spider Queen', on: 'onhit', when: 'inSpider && rank.r', type: 'magic', amount: 'EliseR.PassiveTotalDamage' },
    ],
    notes: ['Spider Queen adds nothing to attacks in Human Form; set "Spider Form" or put R in the combo.'],
  },
  q: {
    hits: [
      {
        id: 'neurotoxin', label: 'Neurotoxin', when: '!inSpider', type: 'magic', amount: 'BaseDamage + HumanPercentHealth * target.hp',
        note: 'Neurotoxin scales with the health the target has left when it is cast.',
      },
      {
        id: 'bite', label: 'Venomous Bite', when: 'inSpider', type: 'magic',
        amount: 'EliseSpiderQCast.BaseDamage + EliseSpiderQCast.MissingHPDamage * target.missingHp', appliesOnHit: true,
        note: 'Venomous Bite scales with the health the target has lost by the time it is cast, and applies on-hit effects once, Spider Queen\'s bonus included.',
      },
    ],
    notes: ['Neurotoxin unless "Spider Form" is set, then Venomous Bite.'],
  },
  w: {
    hits: [{ id: 'spiderling', label: 'Volatile Spiderling', when: '!inSpider', type: 'magic', amount: 'TotalDamage' }],
    // set up front for the whole fight: the engine works stats out once
    statMods: [{ stat: 'attackSpeed', value: 'EliseSpiderW.ActiveAttackSpeed', when: 'frenzy' }],
    notes: ['Volatile Spiderling unless "Spider Form" is set. Skittering Frenzy deals no damage; its attack speed needs "Skittering Frenzy attack speed active".'],
  },
  e: {
    // Cocoon only stuns. Rappel deals nothing itself; descending starts the bonus
    hits: [{ id: 'descend', label: 'Rappel', when: 'inSpider', type: 'magic', amount: 0, then: 'rappelUntil = time + EliseSpiderE.BuffDuration' }],
    rules: [
      // what Rappel adds on top of Spider Queen's own bonus
      {
        id: 'rappel', label: 'Spider Queen after Rappel', on: 'onhit', when: 'inSpider && rappelled && rank.r', type: 'magic',
        amount: 'EliseR.PassiveTotalDamage * EliseSpiderE.PBonusIncrease',
      },
    ],
    notes: ['Cocoon deals no damage. In Spider Form, E in the combo raises Spider Queen\'s bonus damage for the next few seconds; "Rappel\'s bonus to Spider Queen active" keeps it up for the whole fight.'],
  },
  r: {
    rules: [
      // the game data has no attack speed for Spiderlings, so they are paced by Elise's own attacks
      {
        id: 'spiderlings', label: 'Spiderling attacks', on: 'attack', when: 'inSpider', type: 'magic',
        amount: 'SpiderlingTotalDamage', count: 'min(spiderlings, BaseSpiderlingsStored)',
      },
    ],
    notes: [
      'Switching form deals no damage.',
      'Spiderlings are not counted unless "Spiderlings attacking the target" is set. Each one, up to the number Spider Form can hold, then attacks once per basic attack Elise makes in Spider Form.',
    ],
  },
});
