/* Yuumi: Attached, Prowling Projectile is steered for TimeToAfterburners before it accelerates into the target
   (the empowered missile the model counts); on foot it flies straight at StartingSpeed. Final Chapter is a
   UltDuration channel during which she can still cast Zoomies, and Zoomies' attack speed lasts MSDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Yuumi', {
  reviewed: '16.20.1',
  sources: [
    'Prowling Projectile reaches 1150: YuumiQSkillShot\'s range in the game file.',
    'Zoomies being castable during Final Chapter is in its tooltip.',
  ],
  actions: {
    q: { range: 1150, delay: 'TimeToAfterburners', variants: [{ when: '!attached', speed: 'StartingSpeed', delay: 0 }] },
    r: { channel: 'UltDuration', allows: ['e'] },
  },
  windows: [{ option: 'zoomies', after: 'e', for: 'MSDuration' }],
  notes: ['Attached, Yuumi cannot attack; the timeline cannot stop her, so leave attacks out of an attached combo.'],
});
