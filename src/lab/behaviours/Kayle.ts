/* Kayle: from LevelForPassiveRank1 her attacks are ranged waves (KayleBasicAttack3) reaching
   UpgradedAttackRange, and from LevelForPassiveRank3 FinalAttackRange (Divine Ascent's tooltip). Radiant
   Blast's sword flies as KayleQMis, which the slot spell does not name. Divine Judgment strikes when its
   InvulnDuration ends, around whoever it was cast on: here Kayle herself, so it reaches AoERadius. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kayle', {
  reviewed: '16.20.1',
  sources: [
    'Her ranged attacks fly at 5000 and Radiant Blast at 1600 (KayleBasicAttack3, KayleQMis in the game file).',
    'Her attack range is 525 from level 6 and 625 from level 16 (KaylePassive\'s UpgradedAttackRange and FinalAttackRange in the game file), typed because an attack form\'s range is a number.',
  ],
  attack: {
    variants: [
      { when: 'level >= KaylePassive.LevelForPassiveRank3', missileSpeed: 5000, range: 625 },
      { when: 'level >= KaylePassive.LevelForPassiveRank1', missileSpeed: 5000, range: 525 },
    ],
  },
  actions: {
    q: { speed: 1600 },
    r: { delay: 'InvulnDuration', range: 'AoERadius' },
  },
});
