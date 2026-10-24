/* Nidalee: each key is a Human Form or a Cougar Form ability, as the model's form (`inCougar`, flipped by each
   R) says, and each Cougar ability is a spell object of its own. Takedown is the whole empowered attack in the
   model, so it is played as that attack: the attack timer runs from it rather than being reset. Pounce leaps
   onto the target, from EnhancedPounceRange when it is Hunted, and then comes back after
   AspectOfTheCougar.PounceCooldown instead of its own: the model's "pounceReset" window is that clock. Swipe
   is a cone in front of her. Aspect of the Cougar is instant (the game file's half second is the animation),
   and comes back at once when Javelin Toss or Bushwhack marks the target in Human Form. Each form keeps its own
   cooldowns, so switching form brings back the other form's: a hook keeps them, and gives the Cougar
   abilities their own lengths (Takedown, Pounce and Swipe: 6 seconds in the game file; Javelin Toss 6, Primal
   Surge 12, so the haste the Human casts show applies to Pounce). */
import { behaviour, type HookContext } from '../behaviour.ts';

const cougar = (c: HookContext) => (c.option('cougar') ? 1 : 0) !== (c.counter('shifted') ? 1 : 0);
const SLOTS = ['q', 'w', 'e'] as const;
/** Pounce's and Javelin Toss's cooldowns, Primal Surge's (game file) and its PrimalSurge.ASDuration */
const POUNCE_CD = 6, JAVELIN_CD = 6, SURGE_CD = 12, SURGE = 7;
const POUNCE_SPEED = 1500;

export default behaviour('Nidalee', {
  reviewed: '16.20.1',
  sources: [
    `Pounce has no leap speed in the game data: ${POUNCE_SPEED} units a second is an assumption. It reaches 400 (Pounce's cast range in the game file), or EnhancedPounceRange toward a Hunted target.`,
    'Takedown reaches the Cougar attack range of 125 (NidaleeCougarBasicAttack) plus its BonusAttackRange, from her 65 radius.',
  ],
  attack: { variants: [{ when: 'inCougar', missileSpeed: 0 }] },
  actions: {
    q: { variants: [{ when: 'inCougar', spell: 'Takedown', range: '125 + BonusAttackRange + 65', resetsAttack: false }] },
    w: {
      variants: [
        { when: 'inCougar && isHunted', spell: 'Pounce', dash: { speed: POUNCE_SPEED, distance: 'EnhancedPounceRange', direction: 'toward' } },
        { when: 'inCougar', spell: 'Pounce', dash: { speed: POUNCE_SPEED, distance: 400, direction: 'toward' } },
      ],
    },
    e: { variants: [{ when: 'inCougar', spell: 'Swipe' }] },
    // a self-cast with no reach to speak of: it can be cast anywhere
    r: { lock: 0, range: 20000 },
  },
  windows: [
    { option: 'primalSurge', after: 'e', for: 'ASDuration' },
    { option: 'pounceReset', after: 'w', for: 'AspectOfTheCougar.PounceCooldown' },
  ],
  hooks: {
    onStart(c) {
      c.state[`${c.action}At`] = c.t;
      if (c.action === 'q' && c.variant < 0) c.state.spearOut = 1;
      // Primal Surge's attack speed runs out on its own clock, whatever a Swipe's window says
      if ((c.state.surgeUntil ?? 0) <= c.t) c.setOption('primalSurge', 0);
    },
    // the model reads the form when damage lands: a Javelin still flying would land as a Takedown
    canStart(c) {
      if (c.action === 'r' && c.state.spearOut) {
        c.note('Aspect of the Cougar waits for a Javelin in flight to land.');
        return false;
      }
      if (c.action === 'w' && cougar(c) && c.state.pounceReset) {
        if (c.option('pounceReset')) return false;
        c.state.pounceReset = 0;
      }
      return true;
    },
    onLand(c) {
      const at = c.state[`${c.action}At`]!;
      if (c.action === 'aa') { c.state.period = c.attackReadyAt() - at; return; }
      // the haste every cooldown here is shortened by, as Javelin Toss, Takedown or Primal Surge show it
      if (c.action === 'q') c.state.haste = (c.readyAt('q') - at) / JAVELIN_CD;
      if (c.action === 'e' && c.variant < 0) c.state.haste = (c.readyAt('e') - at) / SURGE_CD;
      if (c.action === 'q' || c.action === 'w') {
        if (c.variant < 0) {
          // Javelin Toss or Bushwhack marks the target Hunted, which refreshes Aspect of the Cougar
          if (c.action === 'q') c.state.spearOut = 0;
          c.setReadyAt('r', Math.min(c.readyAt('r'), c.t));
        } else if (c.action === 'q') {
          // Takedown is the attack: the next one waits a full attack period from it
          if (c.state.period) c.setAttackReadyAt(at + c.state.period);
        } else if (c.variant === 0) {
          // Pounce at a Hunted target: back after PounceCooldown, which the pounceReset window counts
          c.state.pounceReset = 1;
          c.setReadyAt('w', c.t);
        } else c.setReadyAt('w', at + POUNCE_CD * (c.state.haste ?? 1));
      }
      if (c.action === 'e') {
        if (c.variant < 0) c.state.surgeUntil = c.t + SURGE;
        else {
          c.setReadyAt('e', at + (c.readyAt('e') - at) / 2);
          if ((c.state.surgeUntil ?? 0) <= c.t) c.setOption('primalSurge', 0);
        }
      }
      if (c.action === 'r') {
        // the form changes as this lands: keep this form's cooldowns and bring back the other's
        const from = cougar(c) ? 'c' : 'h', to = from === 'c' ? 'h' : 'c';
        for (const slot of SLOTS) {
          c.state[from + slot] = c.readyAt(slot);
          c.setReadyAt(slot, c.state[to + slot] ?? 0);
        }
      }
    },
  },
  notes: [
    'In Cougar Form her attacks have no projectile, but they keep Human Form\'s attack range here.',
    'Javelin Toss and Bushwhack are counted as marking the target, so Aspect of the Cougar comes back when they land.',
    'Pounce\'s cooldown counts ability haste only once a Javelin Toss, Takedown or Primal Surge has shown it; before that it is 6 seconds flat.',
  ],
});
