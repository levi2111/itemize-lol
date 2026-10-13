import { champion } from '../dsl.ts';

/* Sona's damage outside her two spells is in her attacks, and the game data only
   has the amounts:
   - Power Chord: every third basic ability charges her next attack. Which of the
     two damage amounts it deals depends on the song she cast last.
   - Hymn of Valor's Melody: her own next attack after Q deals a little more. */
export default champion('Sona', {
  reviewed: '16.20.1',
  options: {
    chordReady: { label: 'Power Chord ready when the fight starts (last song Hymn of Valor)', default: false },
  },
  counters: {
    chord: { max: 'SonaPassive.PowerChordPassiveCountMax' },
    // 1 once the last basic ability cast in this fight was Aria or Song rather than Hymn
    otherSong: {},
    // set by the first Power Chord, so the one brought into the fight is spent once
    spent: {},
    hymn: { max: 'SonaQ.OnHitProcs' },
  },
  p: {
    rules: [
      { id: 'stack', on: 'ability', when: '!cast.r', type: 'magic', amount: 0, then: ['chord += 1', 'otherSong = 1 - cast.q'] },
      // Staccato replaces the plain bonus rather than adding to it; the attack itself is the engine's
      {
        id: 'chord', label: 'Power Chord', on: 'attack', when: 'chord >= PowerChordPassiveCountMax || (chordReady && !spent)', type: 'magic',
        amount: 'if(otherSong || !rank.q, PowerChordDamage, SonaQ.TotalStaccatoDamage)', then: ['chord = 0', 'spent = 1'],
        note: 'Power Chord needs three basic ability casts in the combo and then an auto attack, or "Power Chord ready when the fight starts". It deals Staccato\'s higher damage when Hymn of Valor was the last of them.',
      },
    ],
  },
  q: {
    // one bolt each for the two nearest enemies, so a lone target takes one
    hits: [{ id: 'bolt', type: 'magic', amount: 'TotalDamage', then: 'hymn = OnHitProcs' }],
    rules: [
      {
        id: 'melody', label: 'Hymn of Valor melody', on: 'onhit', when: 'hymn', type: 'magic', amount: 'TotalOnHitDamage', then: 'hymn += -1',
        note: 'The Melody bonus is counted on Sona\'s own next auto attack after Hymn of Valor; attacks by allies in the aura are not.',
      },
    ],
  },
  // Aria of Perseverance heals and shields, and its Power Chord weakens the target's damage; the passive still counts its cast
  w: {},
  // Song of Celerity is move speed, and its Power Chord a slow; the passive still counts its cast
  e: {},
  r: {
    hits: [{ id: 'chord', type: 'magic', amount: 'TotalDamage' }],
  },
});
