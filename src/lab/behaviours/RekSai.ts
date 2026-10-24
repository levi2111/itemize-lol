/* Rek'Sai: each key is an Unburrowed or a Burrowed ability, as the model's `inBurrow` says; she is Burrowed
   only when the fight starts so, until W or R brings her up. Burrowed, Q is Prey Seeker (its missile is
   RekSaiQBurrowedMis) and E is Tunnel, a dash at RekSaiE's DashSpeed. W is always the Un-burrow
   (RekSaiWBurrowed), knocking up within KnockupRange. Queen's Wrath's attack speed (the model's "wrathSpeed")
   lasts for its three attacks, at most BuffDuration. Void Rush is a leap at LeapMovementSpeed onto a target
   she has damaged in the last PreyMarkDuration, and resets Un-burrow's cooldown. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** RekSaiR.PreyMarkDuration */
const PREY = 5;
const burrowed = (c: HookContext) => c.option('burrowed') > 0 && !c.counter('surfaced');

export default behaviour('RekSai', {
  reviewed: '16.20.1',
  sources: [
    'Prey Seeker flies 1500 at 1950 units a second: RekSaiQBurrowedMis in the game file.',
    'Void Rush leaps up to its 1500 cast range (RekSaiR in the game file).',
  ],
  actions: {
    q: { variants: [{ when: 'inBurrow', spell: 'RekSaiQBurrowed', speed: 1950, range: 1500 }] },
    w: { spell: 'RekSaiWBurrowed', range: 'RekSaiW.KnockupRange' },
    e: { variants: [{ when: 'inBurrow', spell: 'RekSaiEBurrowed', dash: { speed: 'RekSaiE.DashSpeed', distance: 'RekSaiE.DashDistance', direction: 'toward' } }] },
    r: { dash: { speed: 'LeapMovementSpeed', distance: 1500, direction: 'toward' } },
  },
  windows: [{ option: 'wrathSpeed', after: 'q', for: 'BuffDuration' }],
  hooks: {
    onStart(c) {
      // the attack speed lasts for the attacks Queen's Wrath empowers
      if (c.action === 'aa') c.setOption('wrathSpeed', c.counter('wrath') > 0 ? 1 : 0);
    },
    canStart(c) {
      if (c.action !== 'r' || (c.state.prey !== undefined && c.t - c.state.prey <= PREY)) return true;
      c.note('Void Rush waits for a target Rek\'Sai has damaged in the last 5 seconds.');
      return false;
    },
    onLand(c) {
      c.state.prey = c.t;
      if (c.action === 'q' && burrowed(c)) c.setOption('wrathSpeed', 0);
      // coming up: the Unburrowed abilities keep their own cooldowns, unused until now
      if ((c.action === 'w' || c.action === 'r') && burrowed(c)) {
        c.setReadyAt('q', c.t);
        c.setReadyAt('e', c.t);
      }
      if (c.action === 'r') c.setReadyAt('w', c.t);
    },
  },
  notes: [
    'W is always the Un-burrow, as in the model; burrowing again is not played.',
    'Prey Seeker and Tunnel use their Unburrowed counterparts\' cooldowns.',
  ],
});
