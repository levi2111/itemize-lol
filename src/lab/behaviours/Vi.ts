/* Vi: Vault Breaker is charged, then a dash of MinDashRange plus ExtraDashRangeAtMaxCharge at full charge (the
   model's "charged"). Denting Blows has no active. Relentless Force is an instant buff on her next attack, which
   it resets, holding two charges with StaticCooldown between casts. Cease and Desist dashes onto the target at
   RBaseSpeed. */
import { behaviour } from '../behaviour.ts';

export default behaviour('Vi', {
  reviewed: '16.20.1',
  sources: [
    'Vault Breaker reaching full charge after 1.25 seconds is from the League Wiki; the game data has no value for it. Its dash is taken at ViQMissile\'s 1500 units a second in the game file.',
    'Relentless Force\'s 2 charges are in its tooltip; they come back every 12 seconds at rank 1 down to 8 at rank 5 (ViE\'s ammoRecharge in the game file), cut by ability haste.',
    'Cease and Desist\'s reach of 800 is ViR\'s range in the game file.',
  ],
  actions: {
    // the dash's reach, from her centre (she has a 65 radius): further away she walks in first
    q: {
      lock: 1.25, range: 'MinDashRange + ExtraDashRangeAtMaxCharge + 65',
      dash: { speed: 1500, distance: 'MinDashRange + ExtraDashRangeAtMaxCharge', direction: 'toward' },
      variants: [{ when: '!charged', lock: 0, range: 'MinDashRange + 65', dash: { speed: 1500, distance: 'MinDashRange', direction: 'toward' } }],
    },
    w: { requires: 0 },
    // the game file's 0.25 seconds is the empowered attack's; cast it in attack range (125, edge to edge, plus her 65 radius)
    e: { lock: 0, range: 125 + 65, charges: { count: 2, recharge: '(13 - rank) * 100 / (100 + abilityHaste)', gap: 'StaticCooldown' } },
    r: { dash: { speed: 'RBaseSpeed', distance: 800, direction: 'toward' } },
  },
  notes: [
    'Vault Breaker\'s dash is drawn during its charge, so the punch lands when the charge ends.',
    'Denting Blows is never cast: it is on every third hit.',
  ],
});
