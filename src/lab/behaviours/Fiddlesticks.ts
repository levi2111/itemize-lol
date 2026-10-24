/* Fiddlesticks: Bountiful Harvest is a DrainDuration channel (the game file's channel time, which an action
   with a behaviour keeps only when it says so); a channel that runs to its end takes most of what is left off
   its cooldown. Crowstorm is a channel after which he blinks to the target area. */
import { behaviour } from '../behaviour.ts';

/** Bountiful Harvest: the share of the remaining cooldown a full channel takes off (tooltip). */
const CUT = 0.6;
/** Crowstorm's blink is instant: drawn as a dash this fast, about a server tick over its range. */
const BLINK = 25000;

export default behaviour('Fiddlesticks', {
  reviewed: '16.20.1',
  sources: [
    'The 60% cut to Bountiful Harvest\'s remaining cooldown after a full channel is in its tooltip.',
    'Crowstorm\'s 800 range is its castRangeDisplayOverride in the game file; the blink has no speed in the game data, so it is drawn at 25000 units a second.',
  ],
  actions: {
    w: { channel: 'DrainDuration' },
    r: { lock: 'ChannelTime', dash: { speed: BLINK, distance: 800, direction: 'toward', afterLock: true } },
  },
  hooks: {
    onLand(c) {
      if (c.action !== 'w') return;
      // the drain starts as the cast ends and is taken to run its full length
      const end = c.t + c.value('DrainDuration'), ready = c.readyAt('w');
      if (ready > end) c.setReadyAt('w', end + (ready - end) * (1 - CUT));
    },
  },
  notes: [
    'Bountiful Harvest is counted as channelled to its end, which also cuts its cooldown.',
    'Crowstorm\'s crows land from the end of its channel, where he blinks to.',
  ],
});
