# Writing a behaviour

The Fight Lab plays a combo out in time (`src/lab/timeline.ts`). Damage comes from the champion's model (`src/models/champions/`, see [models.md](models.md)); *when* things happen comes from three layers, each marked on the page:

| Layer | Where | Marked |
| --- | --- | --- |
| Game files | `timing` in each compiled champion (`data/dist/<patch>/champions/<Id>.json`), read by `src/pipeline/timing.ts` | `data` |
| Behaviour | `src/lab/behaviours/<Id>.ts`, hand-written | `model` |
| The page | what the user edits | `edited` |

Anything none of them gives is a placeholder, marked `assumed`.

## What the game files already give

For every champion, with no behaviour at all:

- **Basic attack**: windup share (`timing.attack.windup`), the windup modifier, projectile speed (0 for melee), gameplay radius. Windup seconds follow the game's formula: `windup / baseAS + (windup / AS − windup / baseAS) × modifier`.
- **Every spell object** (`timing.spells[<SpellId>]`): `castTime`, `totalTime`, `range` and `radius` by rank, `missileSpeed`, `missileTime` (fixed-time projectiles), `width`, `channel`, `fixedCooldown` (haste does not apply), `targeting`, `tags` (the game's own: `Trait_AttackReset`, `Trait_ChannelSpell`, `PositiveEffect_EmpowerAttack`, `Trait_PlayerSelectedDashDirection`…).
- **Defaults the timeline derives**: an ability uses its slot's spell object. Its lock is that spell's cast time; its range is its range at rank (for self-centred spells, the radius); its projectile is its own missile or a spell object named `<Spell>Missile`; it resets the attack timer if it has `Trait_AttackReset`; a `DashSpeed` with a `DashTotalDistance`/`DashDistance`/`DashRange` data value makes it a dash.

So a behaviour only says what the files get wrong or cannot say. A champion whose abilities are plain casts needs no behaviour file at all.

## Reading a champion

```
node -e "const c=require('./data/dist/16.20.1/champions/Ahri.json');console.log(JSON.stringify(c.timing,null,1));for(const [k,s] of Object.entries(c.spells))console.log(k,JSON.stringify(s.dataValues))"
npm run data:report -- --champion Ahri      # tooltips, calculations and the damage model, per ability
```

The slot spells are `c.slots.q.spell` etc. Many abilities have several spell objects (a missile, a recast, an empowered form, a second form): their names and timing are in `timing.spells`.

## A behaviour file

```ts
import { behaviour } from '../behaviour.ts';

export default behaviour('Samira', {
  reviewed: '16.20.1',
  sources: ['Inferno Trigger lasting 2 seconds is in its tooltip.'],
  attack: { variants: [{ within: 'SamiraPassive.SwordRange', missileSpeed: 0 }] },
  actions: {
    q: {
      spell: 'SamiraQGun',
      variants: [
        { during: ['e'], spell: 'SamiraQBufferedSword' },
        { within: 'SamiraPassive.SwordRange', spell: 'SamiraQSword' },
      ],
    },
    e: { dash: { speed: 'DashSpeed', distance: 'DashTotalDistance', direction: 'through' } },
    r: { channel: 2 },
  },
  windows: [{ option: 'wildRush', after: 'e', for: 'AttackSpeedDuration' }],
  distance: [{ option: 'inMelee', within: 'SamiraPassive.SwordRange' }],
  hooks: { /* see src/lab/behaviours/Samira.ts */ },
});
```

The file name is the champion id. After adding a file run `npm run lab:index`.

### Formulas

The models' formula language. A name resolves, in order, to: the champion's options, counters and helper formulas; builtins (`level`, `rank`, `distance` = edge-to-edge distance to the target, `time`, `adaptivePhysical`…); the champion's stats (`ad`, `bonus.ad`…); `target.*`; then a data value or calculation of the **action's spell** at its rank. `OtherSpell.Value` reads another spell object's value. Use the game's names; type a number only when the game data has none, and say where it came from in `sources`.

### `actions.<slot>`

| Field | |
| --- | --- |
| `spell` | The spell object whose timing the cast uses, when it is not the slot's own (Samira's Q is really `SamiraQGun`). |
| `lock` | Seconds the champion is locked in the cast. Defaults to the spell's cast time. |
| `range` | Reach, from the champion's centre to the target's edge. |
| `speed` | Projectile speed; 0 lands at once. |
| `delay` | Seconds from release to landing for damage that waits without flying (a delayed explosion). |
| `dash` | `{ speed, distance, direction }`: `toward` stops at the target, `through` goes the full distance, `away` moves off. `null` removes a dash the data implied. Damage lands at the end of the dash. |
| `channel` | Seconds after the lock with no attacks or other casts. |
| `allows` | Actions that may still be woven in during the channel. |
| `resetsAttack` | Overrides the game's tag. |
| `requires` | The action can only start while this is non-zero. |
| `recasts` | `{ count, window, gap?, cooldownFrom? }`: the ability is cast `count` times in a chain (Riven's Q, Ahri's R), each within `window` seconds of the last and at least `gap` apart. The cooldown starts when the chain ends (or lapses), or with the first cast when `cooldownFrom: 'first'`. Variants can pick a cast with `cast: 2`. |
| `charges` | `{ count, recharge? }`: the ability holds `count` charges, each coming back `recharge` seconds (default: its cooldown) after the previous one. |
| `variants` | See below. |
| `options` | Options set while this cast's damage lands, then put back. |

### Variants

A list; the first whose conditions all hold replaces the action's own settings for that cast:

- `within` / `beyond`: the target is at most / further than this, edge to edge.
- `during: ['e']`: cast while that action is still in progress (its cast, dash or channel). The cast is **woven in** without ending it, and its damage waits until the dash brings the target within its range. This is how Samira's Q during E works.
- `when`: a formula.
- `cast: n`: the n-th cast of a recast chain.

A variant can set `spell`, `lock`, `range`, `speed`, `delay`, `dash`, `channel`, `resetsAttack` and `options`. Setting `spell` takes that spell object's timing from the game files first.

### Windows and distance

- `windows: [{ option, after, for, value?, from? }]`: an option of the champion's model is set (to `value`, default 1) for `for` seconds after `after`'s release (or `from: 'start'`). This is how a buff with a duration turns a model's toggle on and off: Wild Rush's attack speed, a stance, an empowered state.
- `distance: [{ option, within }]`: an option kept on while the target is within that distance, like Samira's melee range.

Options the timeline sets are hidden from the page. They must exist in the champion's model (`options` in its model file); an option only a behaviour sets (a variant's `options`, say) gets `timeline: true` there, so the site never offers it. If a mechanic needs a state the model does not have, say so in your report instead of editing the model.

### Hooks

For what the fields above cannot express: `canStart(ctx)`, `onStart(ctx)`, `onLand(ctx)`. `ctx` gives the time, distance, the action and chosen variant, the previous action, options and counters (read and set), each ability's ready time (refunds), the attack timer, a `state` scratchpad kept all fight, and `note(text)`. Samira's Style meter is a hook. Keep hooks small and say in the file's comment what they model.

### Attack

`attack: { windup?, missileSpeed?, variants? }` overrides the attack's windup share or projectile, and its variants (`within`, `beyond`, `when`, with `windup`, `missileSpeed`, `options`) cover forms like Samira's sword slashes or a stance that changes the attack.

## Checking

```
npm run lab:index
node --test test/lab.test.ts      # binds every behaviour's formulas and plays every action once
```

Then play the champion's real combos with a short script (see `test/lab.test.ts` for the scenario shape) and look at `started` (what began when, which variant, woven or not), `spans` and `events`. The thing to check is whether the order and timing match how the champion plays: what can be woven or cancelled, what resets attacks, how long a dash or channel holds the champion.

## Seconds mode

`mode: { kind: 'seconds', seconds, abilities }` uses the listed abilities by priority as they come off cooldown (when in range and allowed), weaves the ones that can be woven, and attacks in between. A behaviour's `requires`, `canStart` and variants steer it exactly as in a script.
