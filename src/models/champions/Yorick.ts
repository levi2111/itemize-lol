import { champion } from '../dsl.ts';

/* Much of Yorick's damage is dealt by what he raises, and the game data has only
   the damage of one attack by a Mist Walker and by the Maiden: no attack speed
   for either, and nothing on how many are out.
   - Mist Walkers standing when a fight starts are the user's to count. They are
     paced by Yorick's own basic attacks.
   - Within a fight a Mist Walker comes from the grave Last Rites leaves on a
     champion, once Mourning Mist's mark awakens it.
   - Eulogy of the Isles deals nothing itself. One cast stands for a number of
     attacks by the Maiden and by each Mist Walker she brings, a stepper, and for
     the mark each of her attacks leaves for Yorick to set off. */
export default champion('Yorick', {
  reviewed: '16.20.1',
  vars: {
    marked: 'cursed || time < markedUntil',
    walkers: 'min(mistWalkers + raised, YorickPassive.YorickPassiveGhoulMax)',
    // the Mist Walkers that come with the Maiden, as far as the limit leaves room for them
    escort: 'max(0, min(YorickR.RGhoulNumbers, YorickPassive.YorickPassiveGhoulMax - walkers))',
  },
  options: {
    mistWalkers: { label: 'Mist Walkers attacking the target', kind: 'int', default: 0, min: 0 },
    maidenAttacks: { label: 'Attacks the Maiden and each Mist Walker summoned with her land on the target', kind: 'int', default: 3, min: 0 },
    cursed: { label: 'Target marked by Mourning Mist', default: false },
  },
  // rites: the next attack carries Last Rites; graves: left by it and not yet awakened;
  // raised: Mist Walkers awakened this fight; markedUntil: the moment Mourning Mist's mark runs out
  counters: { rites: {}, graves: {}, raised: {}, markedUntil: {} },
  p: {
    rules: [
      // the game data has no attack speed for Mist Walkers: they attack when he does
      {
        id: 'walkers', label: 'Mist Walker attacks', on: 'attack', type: 'physical', amount: 'YorickPassiveGhoulDamage', count: 'walkers',
        note: 'Every Mist Walker attacks once per basic attack Yorick makes, up to the most that can be out at once.',
      },
    ],
    notes: ['Mist Walkers are not counted unless "Mist Walkers attacking the target" is set, apart from those a combo itself raises.'],
  },
  q: {
    hits: [{
      id: 'strike', type: 'physical', amount: 'BonusDamage', then: 'rites = 1',
      note: 'Last Rites counts only what it adds to the attack; put a basic attack after it in the combo.',
    }],
    rules: [
      // the empowered attack leaves a grave when it hits a champion
      { id: 'grave', on: 'attack', when: 'rites', type: 'physical', amount: 0, then: ['rites = 0', 'graves += 1'] },
    ],
  },
  // Dark Procession only blocks the way
  w: {},
  e: {
    hits: [{ id: 'mist', type: 'magic', amount: 'Calc_HealthDamage * target.maxHp', then: 'markedUntil = time + MarkDuration' }],
    rules: [
      // a marked target awakens the graves near it; the Mist Walker joins from Yorick's next attack on
      { id: 'awaken', on: 'after', when: 'graves && marked', type: 'physical', amount: 0, then: ['raised += graves', 'graves = 0'] },
    ],
    resists: [{ stat: 'armor', kind: 'reducePct', value: 'ArmorShred', when: 'marked' }],
    notes: [
      'Mourning Mist\'s armor reduction lasts as long as its mark; "Target marked by Mourning Mist" keeps it up for the whole fight.',
      'While the target is marked, the grave left by an attack empowered with Last Rites raises one more Mist Walker.',
    ],
  },
  r: {
    hits: [
      // neither has an attack speed in the game data, so the number of attacks is the user's
      {
        id: 'maiden', label: 'Maiden\'s attacks', type: 'magic', amount: 'YorickBigGhoulDamage', count: 'maidenAttacks',
        note: 'Eulogy of the Isles deals no damage when cast. The Maiden and each Mist Walker summoned with her are counted for "Attacks the Maiden and each Mist Walker summoned with her land on the target", 3 unless changed, out of the many they can land while they live.',
      },
      {
        id: 'escort', label: 'Summoned Mist Walkers\' attacks', type: 'physical', amount: 'YorickPassive.YorickPassiveGhoulDamage',
        count: 'escort * maidenAttacks',
      },
      // each of her attacks marks the target; the mark is spent by Yorick's next damage to it
      {
        id: 'touch', label: 'Maiden\'s mark', type: 'magic', amount: 'RMarkDamagePercent / 100 * target.maxHp', count: 'maidenAttacks',
        note: 'Each of the Maiden\'s attacks marks the target, and Yorick is counted as setting off every mark with his own attacks and abilities.',
      },
    ],
  },
});
