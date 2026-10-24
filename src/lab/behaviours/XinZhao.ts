/* Xin Zhao: Audacious Charge is a dash onto the target (its 650 cast range in the game file), and its attack
   speed lasts ASDuration. */
import { behaviour } from '../behaviour.ts';

export default behaviour('XinZhao', {
  reviewed: '16.20.1',
  sources: ['Audacious Charge has no dash speed in the game data: 2500 units a second is an assumption.'],
  actions: {
    e: { dash: { speed: 2500, distance: 650, direction: 'toward' } },
  },
  windows: [{ option: 'audacious', after: 'e', for: 'ASDuration' }],
});
