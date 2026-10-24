/* Tahm Kench: Abyssal Dive is a dive of ChannelTime to the target, the area hitting AoEDelayFromChannelStart after
   it began. Devour is TahmKenchR (the wrapper has no cast or range) and needs 3 stacks of An Acquired Taste, which
   attacks and Tongue Lash add; a hook counts them. The devoured enemy is out of reach for EnemyDuration. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** TahmKenchPassive: MaxStacks, Duration, PerStackDecayTimer */
const MAX = 3, LASTS = 5, DECAY = 1;
/** stacks still on the target: after Duration without a new one they fall off one every PerStackDecayTimer */
const taste = (c: HookContext) => Math.max(0, (c.state.taste ?? 0) - Math.max(0, Math.ceil((c.t - (c.state.tasteAt ?? 0) - LASTS) / DECAY)));

export default behaviour('TahmKench', {
  reviewed: '16.20.1',
  sources: [
    'Abyssal Dive\'s reach, 1000 at rank 1 and 50 more each rank, is TahmKenchW\'s range in the game file; the dive is taken to cover it in ChannelTime.',
    'Devour\'s 0.25 second cast and 300 range are TahmKenchR\'s in the game file.',
  ],
  actions: {
    w: {
      lock: 'ChannelTime',
      dash: { speed: '(950 + 50 * rank) / ChannelTime', distance: '950 + 50 * rank', direction: 'toward' },
      delay: 'AoEDelayFromChannelStart - ChannelTime',
    },
    // the enemy is inside him: nothing to attack until it is spat out. The slot spell's cooldown is 0 in the game
    // data; Devour's is DataCooldown, cut by ability haste
    r: {
      spell: 'TahmKenchR', channel: 'TahmKenchRWrapper.EnemyDuration',
      cooldown: 'TahmKenchRWrapper.CDCalc * 100 / (100 + abilityHaste)',
    },
  },
  hooks: {
    canStart(c) {
      if (c.action !== 'r' || taste(c) >= MAX) return true;
      c.note('Devour waits for 3 stacks of An Acquired Taste: each attack and Tongue Lash adds one.');
      return false;
    },
    onLand(c) {
      if (c.action === 'r') { c.state.taste = 0; return; }
      if (c.action !== 'aa' && c.action !== 'q') return;
      const now = taste(c);
      // Tongue Lash on 3 stacks stuns and spends them
      c.state.taste = c.action === 'q' && now >= MAX ? 0 : Math.min(MAX, now + 1);
      c.state.tasteAt = c.t;
    },
  },
  notes: [
    'Abyssal Dive\'s cooldown refund on hitting a champion is not played.',
    'Devour holds the enemy for its full duration; spitting it out early is not played.',
  ],
});
