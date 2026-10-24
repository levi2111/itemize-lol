/* Kled: Violent Tendencies is a passive with nothing to cast; its attack speed (the model's "violentSpeed")
   is switched on by a hook for the round of four attacks the model counts, from the second attack on, for at
   most ActiveDuration. Bear Trap on a Rope's yank comes TetherPopTime after the trap hooks. Dismounted, Q is
   Pocket Pistol (KledRiderQ) and Jousting and Chaaaaaaaarge!!! cannot be cast. Jousting is a dash through the
   target; the model counts its recast dash in the same cast. Chaaaaaaaarge!!! reaches full power after
   SecondsToMaxPower of charging, which holds him. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Kled', {
  reviewed: '16.20.1',
  sources: ['Jousting\'s 550 unit dash is KledE\'s cast range in the game file.'],
  actions: {
    q: { hitDelays: { yank: 'TetherPopTime' }, variants: [{ when: 'dismounted', spell: 'KledRiderQ' }] },
    w: { lock: 0 },
    e: { requires: '!dismounted', dash: { speed: 'DashSpeed', distance: 550, direction: 'through' } },
    r: { requires: '!dismounted', lock: 'SecondsToMaxPower', variants: [{ when: '!fullCharge', lock: 0 }] },
  },
  hooks: {
    onStart(c) {
      if (c.action !== 'aa') return;
      // the attacks already made in this round, as the model counts them
      const made = c.counter('violent');
      if (!made) { c.state.until = 0; c.setOption('violentSpeed', 0); return; }
      if (!c.state.until) c.state.until = c.t + c.value('KledW.ActiveDuration');
      c.setOption('violentSpeed', c.t <= c.state.until ? 1 : 0);
    },
  },
  notes: [
    'Violent Tendencies\' attack speed is counted from the second attack of a round to the fourth.',
    'Bear Trap on a Rope\'s yank is counted as Kled staying near the hooked target; its pull and Pocket Pistol\'s recoil are not drawn.',
    'Chaaaaaaaarge!!! is drawn as Kled charging where he stands; the run itself is not drawn.',
  ],
});
