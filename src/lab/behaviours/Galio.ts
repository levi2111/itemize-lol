/* Galio: the game file has Shield of Durand's charge and Hero's Entrance's channel per rank (mChannelDuration),
   which the timing reader does not take. Shield of Durand charges to full over 1.25 seconds while its reach
   grows from 275 to 450 (mCastRangeGrowthDuration, mCastRangeGrowthMax); the model's "fully charged" option
   picks which. Justice Punch winds up, then lunges up to 650 within its 0.5 second total time. Hero's Entrance
   lands 2.75 seconds after the cast, on an ally taken to be next to the target. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Galio', {
  reviewed: '16.20.1',
  sources: [
    'Shield of Durand: mCastRangeGrowthDuration 1.25, castRange 275 and mCastRangeGrowthMax 450 in the game file.',
    'Justice Punch: castRangeDisplayOverride 650 and spellTotalTime 0.5 in the game file.',
    'Hero\'s Entrance: mChannelDuration 2.75 in the game file; the flight is drawn across it.',
  ],
  actions: {
    w: { lock: 'if(wCharged, 1.25, 0)', range: 'if(wCharged, 450, 275)' },
    e: { dash: { speed: '650 / 0.5', distance: 650, direction: 'toward' } },
    r: { lock: 2.75, dash: { speed: '4000 / 2.75', distance: 4000, direction: 'toward' } },
  },
  notes: [
    'Shield of Durand is held in place while it charges; in the game Galio can walk slowly meanwhile.',
    'Hero\'s Entrance is aimed at an ally standing by the target.',
  ],
});
