/* The worked example for behaviours. The game file has each of Flair's forms as a spell of its own
   (SamiraQGun, SamiraQSword, SamiraQBufferedSword); which one a cast becomes depends on distance and on
   whether she is mid-Wild Rush. Style is her passive's combo meter: a different action than the last
   one raises it, and Inferno Trigger needs all six grades (SamiraR's cast requirement in the game file). */
import { behaviour, type HookContext } from '../behaviour.ts';

/** What counts as one kind of action for Style. Q's variants: 0 woven into E (a sword slash), 1 sword, -1 gun. */
const kind = (c: HookContext) => c.action === 'aa' ? (c.variant === 0 ? 'aa-melee' : 'aa') : c.action === 'q' ? (c.variant >= 0 ? 'q-sword' : 'q-gun') : c.action;
const GRADES = 6;

export default behaviour('Samira', {
  reviewed: '16.20.1',
  sources: ['Inferno Trigger lasting 2 seconds is in its tooltip, as in the damage model.'],
  attack: {
    // in sword range her attacks are slashes: no projectile
    variants: [{ within: 'SamiraPassive.SwordRange', missileSpeed: 0 }],
  },
  actions: {
    q: {
      spell: 'SamiraQGun',
      variants: [
        { during: ['e'], spell: 'SamiraQBufferedSword' },
        { within: 'SamiraPassive.SwordRange', spell: 'SamiraQSword' },
      ],
    },
    w: { channel: 'SlashDuration' },
    e: { dash: { speed: 'DashSpeed', distance: 'DashTotalDistance', direction: 'through' } },
    r: { channel: 2 },
  },
  windows: [{ option: 'wildRush', after: 'e', for: 'AttackSpeedDuration' }],
  distance: [{ option: 'melee', within: 'SamiraPassive.SwordRange' }],
  hooks: {
    onStart(c) {
      const k = kind(c), last = c.state.kind;
      if (c.action === 'r') return;
      c.state.style = Math.min(GRADES, (c.state.style ?? 0) + (last === undefined || last !== kindIndex(k) ? 1 : 0));
      c.state.kind = kindIndex(k);
    },
    canStart(c) {
      if (c.action !== 'r') return true;
      if ((c.state.style ?? 0) >= GRADES) return true;
      c.note('Inferno Trigger waits for all six Style grades: different actions in a row (attack, melee attack, gun Q, sword Q, W, E) each add one.');
      return false;
    },
  },
  notes: [
    'Style starts the fight at 0 and does not run out.',
    'Blade Whirl\'s second slash is counted when the first lands.',
  ],
});

const KINDS = ['aa', 'aa-melee', 'q-gun', 'q-sword', 'w', 'e'];
function kindIndex(k: string): number { return KINDS.indexOf(k); }
