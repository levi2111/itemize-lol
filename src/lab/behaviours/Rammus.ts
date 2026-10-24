/* Rammus: Powerball is a roll into the target, drawn at his move speed plus MinimumMoveSpeed (it accelerates
   from there over RollDuration). Defensive Ball Curl's resistances (the model's "curl") last BuffDuration.
   Soaring Slam is a hop onto the target area, its speed growing with his move speed between MinDashSpeed and
   MaxDashSpeed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Rammus', {
  reviewed: '16.20.1',
  sources: ['Soaring Slam\'s speed as DashSpeedGrowth times his move speed, clamped to MinDashSpeed and MaxDashSpeed, is an assumption from those values; it reaches BaseCastRange.'],
  actions: {
    q: { dash: { speed: 'moveSpeed * (1 + MinimumMoveSpeed)', distance: 'RollDuration * moveSpeed * (1 + MinimumMoveSpeed)', direction: 'toward' } },
    // a stance on himself: it can be cast anywhere
    w: { range: 20000 },
    r: { dash: { speed: 'clamp(DashSpeedGrowth * moveSpeed, MinDashSpeed, MaxDashSpeed)', distance: 'BaseCastRange', direction: 'toward' } },
  },
  windows: [{ option: 'curl', after: 'w', for: 'BuffDuration' }],
  notes: [
    'Powerball is drawn at its starting speed; its acceleration is not.',
    'Soaring Slam cast during Powerball is the model\'s option, not a weave here.',
  ],
});
