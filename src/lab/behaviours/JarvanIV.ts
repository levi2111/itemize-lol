/* Jarvan IV: a Dragon Strike that reaches a planted Demacian Standard pulls him to it at EDashSpeed, the
   E-Q combo. The standard is thrown onto the target and stands for its aura's duration, which the timeline
   keeps as the model's "Near a planted Demacian Standard"; a Q while it stands is the pull. Cataclysm is a
   leap onto the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('JarvanIV', {
  reviewed: '16.20.1',
  sources: [
    'Demacian Standard standing 8 seconds is its aura\'s duration in the tooltip (Effect4Amount).',
    'The pull reaches Dragon Strike\'s 770 cast range (game file).',
    'Cataclysm has no leap speed in the game data: 1500 units a second over its 650 cast range is an assumption.',
  ],
  actions: {
    q: { variants: [{ when: 'standard', dash: { speed: 'JarvanIVDemacianStandard.EDashSpeed', distance: 770, direction: 'toward' } }] },
    r: { dash: { speed: 1500, distance: 650, direction: 'toward' } },
  },
  windows: [{ option: 'standard', after: 'e', for: 8 }],
  notes: [
    'The standard is counted as planted on the target, so Jarvan is near it while he fights there.',
    'The pull stops at the target; the knock-up it causes on the way is not drawn.',
  ],
});
