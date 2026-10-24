/* Quinn: attacking a Harrier target grants Heightened Senses' attack speed (the model's "heightened") for
   its BuffDuration, a hook switching it on as the marked attack lands. Behind Enemy Lines channels for two
   seconds; its damage is the Skystrike that ends it, counted as Quinn arrives. */
import { behaviour, type HookContext } from '../behaviour.ts';

/** QuinnW.BuffDuration */
const SENSES = 2;
const marked = (c: HookContext) => c.counter('harrier') > 0 || (c.option('valorMark') > 0 && !c.counter('opened'));

export default behaviour('Quinn', {
  reviewed: '16.20.1',
  sources: [
    'Behind Enemy Lines channels for 2 seconds (tooltip); Skystrike hits within 700 (QuinnRFinale\'s radius in the game file).',
  ],
  actions: {
    r: { range: 700, channel: 2, delay: 2 },
  },
  hooks: {
    onStart(c) {
      if (c.state.sensesUntil !== undefined && c.t >= c.state.sensesUntil) c.setOption('heightened', 0);
    },
    onLand(c) {
      if (c.action !== 'aa' || !marked(c)) return;
      c.state.sensesUntil = c.t + SENSES;
      c.setOption('heightened', 1);
    },
  },
  notes: [
    'Behind Enemy Lines is drawn as the channel where Quinn stands, and Skystrike as landing when it ends.',
    'Vault\'s dash and leap back are not drawn.',
  ],
});
