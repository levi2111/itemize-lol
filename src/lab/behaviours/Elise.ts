/* Elise: two kits on one set of keys. The model's form is `inSpider` (the starting form, flipped by each
   Spider Form cast), and each Spider Form ability is a spell object of its own: Venomous Bite is a lunge,
   Skittering Frenzy an instant attack reset with an attack speed buff, Rappel a jump into the air and onto the
   target. Spider Form makes her melee. Each form keeps its own cooldowns, so switching form brings back the
   other form's: a hook keeps them. Spider Form itself is instant; the game file's half second is the
   transformation's animation. */
import { behaviour, type HookContext } from '../behaviour.ts';

const spider = (c: HookContext) => (c.option('spider') ? 1 : 0) !== (c.counter('shifted') ? 1 : 0);
const SLOTS = ['q', 'w', 'e'] as const;

export default behaviour('Elise', {
  reviewed: '16.20.1',
  sources: [
    'Venomous Bite\'s lunge reaches its 475 range (EliseSpiderQCast\'s cast range in the game file) at its DashSpeed.',
    'Rappel has no timing in the game data for the time in the air: half a second before descending onto the target, up to 750 away (its cast radius), is an assumption.',
    'Skittering Frenzy\'s 6 second cooldown is EliseSpiderW\'s in the game file; the slot spell\'s is Volatile Spiderling\'s 12.',
    'Spider Form trades 425 of her 550 attack range for melee (Spider Form\'s tooltip in the game\'s string table): 125.',
  ],
  attack: { variants: [{ when: 'inSpider', missileSpeed: 0, range: 125 }] },
  actions: {
    q: { variants: [{ when: 'inSpider', spell: 'EliseSpiderQCast', dash: { speed: 'DashSpeed', distance: 475, direction: 'toward' } }] },
    // a self-cast buff: cast it in Spider Form's attack range (125, edge to edge, plus her 65 radius)
    w: { variants: [{ when: 'inSpider', spell: 'EliseSpiderW', lock: 0, range: 125 + 65, cooldown: '6 * 100 / (100 + abilityHaste)' }] },
    e: { variants: [{ when: 'inSpider', spell: 'EliseSpiderE', lock: 0.5, dash: { speed: 1500, distance: 750, direction: 'toward' }, cooldown: 'EliseHumanE.RappelCooldown * 100 / (100 + abilityHaste)' }] },
    // a self-cast with no reach to speak of: it can be cast anywhere
    r: { lock: 0, range: 20000 },
  },
  windows: [{ option: 'frenzy', after: 'w', for: 'EliseSpiderW.BuffDuration' }],
  hooks: {
    onStart(c) {
      if (c.action === 'q') c.state.qOut = 1;
    },
    // the model reads the form when damage lands: a Neurotoxin still flying would land as a Venomous Bite
    canStart(c) {
      if (c.action !== 'r' || !c.state.qOut) return true;
      c.note('Spider Form waits for a Neurotoxin in flight to land.');
      return false;
    },
    onLand(c) {
      if (c.action === 'q') c.state.qOut = 0;
      // Volatile Spiderling gives no attack speed
      if (c.action === 'w' && !spider(c)) c.setOption('frenzy', 0);
      if (c.action === 'r') {
        // the form changes as this lands: keep this form's cooldowns and bring back the other's
        const from = spider(c) ? 's' : 'h', to = from === 's' ? 'h' : 's';
        for (const slot of SLOTS) {
          c.state[from + slot] = c.readyAt(slot);
          c.setReadyAt(slot, c.state[to + slot] ?? 0);
        }
      }
    },
  },
  notes: ['Each form keeps its own cooldowns.'],
});
