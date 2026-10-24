/* Fiddlesticks: Bountiful Harvest is a two second channel (the game file has it per rank, which the timing
   reader does not take) that reaches its cast range, not the radius the reader picks for a self-cast; a channel
   that runs to its end takes most of what is left off its cooldown. Crowstorm is a channel after which he
   teleports to the target area: drawn as a move that takes the whole channel. */
import { behaviour } from '../behaviour.ts';

/** Bountiful Harvest: DrainDuration, and the share of the remaining cooldown a full channel takes off (tooltip). */
const DRAIN = 2, CUT = 0.6;

export default behaviour('Fiddlesticks', {
  reviewed: '16.20.1',
  sources: [
    'Bountiful Harvest\'s 650 reach is its castRange in the game file; the 60% cut to its remaining cooldown after a full channel is in its tooltip.',
    'Crowstorm\'s 800 range is its castRangeDisplayOverride in the game file.',
  ],
  actions: {
    w: { channel: 'DrainDuration', range: 650 },
    r: { lock: 'ChannelTime', dash: { speed: '800 / ChannelTime', distance: 800, direction: 'toward' } },
  },
  hooks: {
    onLand(c) {
      if (c.action !== 'w') return;
      // the drain starts as the cast ends and is taken to run its full length
      const end = c.t + DRAIN, ready = c.readyAt('w');
      if (ready > end) c.setReadyAt('w', end + (ready - end) * (1 - CUT));
    },
  },
  notes: [
    'Bountiful Harvest is counted as channelled to its end, which also cuts its cooldown.',
    'Crowstorm\'s teleport is drawn as Fiddlesticks moving to the target during its channel; the crows land from its end.',
  ],
});
