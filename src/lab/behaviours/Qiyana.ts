/* Qiyana: with an enchantment held (the model's `held`), Elemental Wrath is Edge of Ixtal, a blast that flies
   (QiyanaQ_Rock and its siblings, which share their timing). Cast during Audacity it fires at her target, so
   it is woven into the dash. Audacity is a dash to the target, at DashSpeed plus her move speed up to
   DashSpeedMax. Terrashape refreshes Elemental Wrath's cooldown (a hook). Supreme Display of Talent's
   shockwave flies as QiyanaRMis. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Qiyana', {
  reviewed: '16.20.1',
  sources: [
    'Audacity reaches its 650 cast range (QiyanaE in the game file); its speed being DashSpeed plus her move speed, capped at DashSpeedMax, is an assumption from those two values.',
    'The shockwave of Supreme Display of Talent flies at 2000 units a second: QiyanaRMis in the game file.',
  ],
  actions: {
    q: {
      variants: [
        { during: ['e'], when: 'held', spell: 'QiyanaQ_Rock' },
        { during: ['e'] },
        { when: 'held', spell: 'QiyanaQ_Rock' },
      ],
    },
    e: { dash: { speed: 'min(DashSpeed + moveSpeed, DashSpeedMax)', distance: 650, direction: 'toward' } },
    r: { speed: 2000 },
  },
  hooks: {
    onLand(c) {
      if (c.action === 'w') c.setReadyAt('q', Math.min(c.readyAt('q'), c.t));
    },
  },
  notes: [
    'Terrashape\'s dash to terrain is not drawn: it is played where Qiyana stands.',
    'Audacity is drawn stopping at the target rather than passing through it.',
    'Supreme Display of Talent is counted as exploding on the target when its shockwave reaches it.',
  ],
});
