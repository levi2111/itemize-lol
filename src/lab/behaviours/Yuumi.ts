/* Yuumi: Attached, Prowling Projectile is steered for TimeToAfterburners before it accelerates into the target
   (the empowered missile the model counts); on foot it flies straight at StartingSpeed. Final Chapter is a
   UltDuration channel during which she can still cast Zoomies, and Zoomies' attack speed lasts MSDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Yuumi', {
  reviewed: '16.20.1',
  sources: [
    'Prowling Projectile reaches 1150: YuumiQSkillShot\'s range in the game file.',
    'Zoomies being castable during Final Chapter is in its tooltip.',
    'Zoomies has no cooldown in the game data, only an ammo recharge of 18 seconds at rank 1 down to 14 at rank 5 (YuumiE in the game file).',
  ],
  actions: {
    q: { range: 1150, delay: 'TimeToAfterburners', variants: [{ when: '!attached', speed: 'StartingSpeed', delay: 0 }] },
    // its ammo recharge, as one charge coming back
    e: { charges: { count: 1, recharge: '(19 - rank) * 100 / (100 + abilityHaste)' } },
    r: { channel: 'UltDuration', allows: ['e'] },
  },
  windows: [{ option: 'zoomies', after: 'e', for: 'MSDuration' }],
  notes: ['Attached, Yuumi cannot attack; the timeline cannot stop her, so leave attacks out of an attached combo.'],
});
