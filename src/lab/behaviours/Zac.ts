/* Zac: Elastic Slingshot charges for up to ChannelTime, rooted, to reach MaxRange, then flies onto the target at
   MaximumSpeed once the charge ends; a nearer target needs less charge (taken in thirds of the range). Let's
   Bounce! bounces for DurationTooltip, during which he can cast only Unstable Matter. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Zac', {
  reviewed: '16.20.1',
  sources: [
    'The charge is taken to grow the range in a straight line over ChannelTime; the flight is timed at MaximumSpeed.',
    'Casting Unstable Matter while bouncing is in Let\'s Bounce!\'s tooltip.',
  ],
  actions: {
    e: {
      lock: 'ChannelTime',
      range: 'MaxRange',
      dash: { speed: 'MaximumSpeed', distance: 'MaxRange', direction: 'toward', afterLock: true },
      variants: [
        { within: 'MaxRange / 3', lock: 'ChannelTime / 3' },
        { within: 'MaxRange * 2 / 3', lock: 'ChannelTime * 2 / 3' },
      ],
    },
    r: { channel: 'DurationTooltip', allows: ['w'] },
  },
  notes: ['Stretching Strikes\' second arm, which takes the place of his next attack, lands with the first here, as in the model.'],
});
