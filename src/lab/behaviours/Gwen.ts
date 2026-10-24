/* Gwen: Snip Snip! cuts around her at once, without the projectile the game file lists. Hallowed Mist is
   instant. Skip 'n Slash's dash comes from the game data; its empowered attacks last BuffDuration, which the
   timeline keeps as the model's "active" option. Needlework is cast three times, LockoutTime apart, the
   recasts being the spell object GwenRRecast; the first needle flies at its missile's speed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Gwen', {
  reviewed: '16.20.1',
  sources: [
    'Needlework\'s recasts within 6 seconds are in its tooltip; its first needle flies at 1800 units a second (GwenRMis in the game file).',
  ],
  actions: {
    q: { speed: 0 },
    w: { lock: 0 },
    r: {
      speed: 1800,
      recasts: { count: 3, window: 6, gap: 'LockoutTime' },
      variants: [{ cast: 2, spell: 'GwenRRecast' }, { cast: 3, spell: 'GwenRRecast' }],
    },
  },
  windows: [{ option: 'skipSlash', after: 'e', for: 'BuffDuration' }],
  notes: [
    'Skip \'n Slash\'s bonus attack range and the cooldown its first empowered attack refunds are not counted.',
    'Each Needlework recast may come up to 6 seconds after the one before it here; in the game all three fall within 6 seconds of the first.',
  ],
});
