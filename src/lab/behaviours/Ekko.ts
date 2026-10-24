/* Ekko: Timewinder's timing is its missile, EkkoQMis (the slot's own spell object has a placeholder range).
   Phase Dive dashes, then the next attack within its buff blinks him onto the target from further out; the
   attack's range cannot change here, so the dash and the blink are drawn as one dash onto the target. The
   tooltip says he can use his other abilities during the dash: they are woven into it. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Ekko', {
  reviewed: '16.20.1',
  sources: [
    'Phase Dive has no dash speed in the game data: the dash and the blink (DashDistance plus AttackRangeIncrease) are assumed to take its 0.25 second cast, 2600 units a second.',
  ],
  actions: {
    q: { spell: 'EkkoQMis', variants: [{ during: ['e'] }] },
    w: { variants: [{ during: ['e'] }] },
    e: { dash: { speed: 2600, distance: 'DashDistance + AttackRangeIncrease', direction: 'toward' } },
    r: { variants: [{ during: ['e'] }] },
  },
  notes: [
    'Phase Dive\'s blink is part of its dash here, so the empowered attack after it starts from next to the target.',
    'Timewinder\'s return is counted when it first hits.',
  ],
});
