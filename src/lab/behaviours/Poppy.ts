/* Poppy: Steadfast Presence is instant (the game file gives it no cast time). Heroic Charge is a dash onto
   the target at DashSpeed. Keeper's Verdict charges for DurationUntilFullyCharged before the swing
   (PoppyRSpell); released at once, it is the uncharged swing (PoppyRSpellInstant). Its shockwave flies as
   PoppyRMissile. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Poppy', {
  reviewed: '16.20.1',
  sources: [
    'Heroic Charge dashes up to its 475 cast range (PoppyE in the game file) at its DashSpeed.',
    'The swing of Keeper\'s Verdict takes 0.33 seconds: PoppyRSpell\'s cast time in the game file. Uncharged it reaches PoppyR\'s 500 cast range.',
  ],
  actions: {
    // a field around herself that deals nothing unless it stops a dash: it can be cast anywhere
    w: { lock: 0, range: 20000 },
    e: { dash: { speed: 'DashSpeed', distance: 475, direction: 'toward' } },
    r: { lock: 'DurationUntilFullyCharged + 0.33', variants: [{ when: 'uncharged', spell: 'PoppyRSpellInstant', range: 500 }] },
  },
  notes: ['Keeper\'s Verdict is drawn at its uncharged range: its reach growing as it charges is not drawn.'],
});
