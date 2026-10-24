/* Miss Fortune: Strut's attack speed lasts ActiveDuration, which the timeline keeps. Make It Rain falls
   CastDelay after the cast. Bullet Time is a channel of BaseChannelDuration whose waves fly at
   MissFortuneBullets' speed out to its range; the game file gives the slot spell neither. */
import { behaviour } from '../behaviour.ts';

export default behaviour('MissFortune', {
  reviewed: '16.20.1',
  sources: ['Bullet Time\'s waves fly 1450 at 2000 units a second: MissFortuneBullets in the game file.'],
  actions: {
    e: { delay: 'CastDelay' },
    r: { range: 1450, speed: 2000, channel: 'BaseChannelDuration' },
  },
  windows: [{ option: 'strut', after: 'w', for: 'ActiveDuration' }],
});
