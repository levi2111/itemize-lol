/* Rengar: Savagery is an instant buff on his next attack; cast it in attack range. Max Ferocity Savagery
   grants EmpoweredQAS for ASDuration, which the timeline keeps (a plain one does not). Bola Strike flies as
   RengarEMis. Thrill of the Hunt camouflages him after FadeTime and he then leaps on the target: drawn as
   FadeTime spent closing LeapRange, its bonus landing as he arrives. His basic abilities' real cooldowns are ammo
   recharges in the game file (their cooldown values are 0.25 seconds), so each is played as one charge. */
import { behaviour } from '../behaviour.ts';

/** RengarPassive.MaxFerocity */
const MAX_FEROCITY = 4;

export default behaviour('Rengar', {
  reviewed: '16.20.1',
  sources: ['Each basic ability\'s cooldown is its ammoRecharge in the game file, by rank: Savagery 6/5.5/5/4.5/4, Battle Roar 16/14.5/13/11.5/10, Bola Strike 10; ability haste shortens it.'],
  actions: {
    // a buff on the next attack: cast it in attack range (125, edge to edge, plus his 65 radius)
    q: { range: 125 + 65, charges: { count: 1, recharge: '(6.5 - 0.5 * rank) * 100 / (100 + abilityHaste)' } },
    w: { charges: { count: 1, recharge: '(17.5 - 1.5 * rank) * 100 / (100 + abilityHaste)' } },
    e: { spell: 'RengarEMis', charges: { count: 1, recharge: '10 * 100 / (100 + abilityHaste)' } },
    r: { lock: 'FadeTime', dash: { speed: 'LeapRange / FadeTime', distance: 'LeapRange', direction: 'toward' } },
  },
  windows: [{ option: 'savageryAs', after: 'q', for: 'ASDuration' }],
  hooks: {
    onLand(c) {
      // the model settles Ferocity as the cast lands: a Savagery cast below full Ferocity grants no attack speed
      if (c.action === 'q' && c.option('startFerocity') + c.counter('gained') < MAX_FEROCITY) c.setOption('savageryAs', 0);
    },
  },
  notes: [
    'Thrill of the Hunt holds Rengar for its FadeTime and ends with the leap on the target; put an attack after it.',
    'The leap from brush (Unseen Predator) is not played; his attacks are plain attacks.',
    'Plain Savagery\'s attack speed on the next two attacks is not counted (the model has no option for it).',
  ],
});
