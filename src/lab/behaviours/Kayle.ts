/* Kayle: from LevelForPassiveRank1 her attacks are ranged waves (KayleBasicAttack3). Radiant Blast's sword
   flies as KayleQMis, which the slot spell does not name. Divine Judgment strikes when its InvulnDuration
   ends, around whoever it was cast on: here Kayle herself, so it reaches AoERadius. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kayle', {
  reviewed: '16.20.1',
  sources: ['Her ranged attacks fly at 5000 and Radiant Blast at 1600 (KayleBasicAttack3, KayleQMis in the game file).'],
  attack: { variants: [{ when: 'level >= KaylePassive.LevelForPassiveRank1', missileSpeed: 5000 }] },
  actions: {
    q: { speed: 1600 },
    r: { delay: 'InvulnDuration', range: 'AoERadius' },
  },
  notes: ['Once Aflame and Transcendent Kayle attacks from UpgradedAttackRange and FinalAttackRange; here her attacks keep her melee range at every level.'],
});
