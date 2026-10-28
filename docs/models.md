# Writing a model

A model says how an ability's or item's formulas turn into damage on one target. The numbers stay in the game data; the model supplies the structure the game data does not have.

## The loop

```
npm run data:report -- --champion Samira     # what the game data has, next to the tooltip
# edit src/models/champions/Samira.ts
npm run data:build                           # binds the model; errors name the formula and the unknown name
npm run calc -- Samira --level 13 --ranks 5,1,5,2 --combo r:1 --target 2400,80,50
npm run data:accept                          # once it reads right: records the reviewed shape
```

The report lists, per ability: cooldown and cost, the tooltip, every data value with its per-rank values, every calculation as a formula, the damage mentions found in the tooltip, and the model currently in use. For items: `npm run data:report -- --item 3153` (id or part of the name).

While writing, `--draft` skips the build: `npm run data:report -- --champion Samira --draft` and `npm run calc -- Samira --draft …` bind the champion's model file as it is on disk, in memory, and print the same binding errors. Nothing under `data/dist/` is touched, so several champions can be worked on at once; the build is then run once at the end.

`npm run data:crosscheck -- --champion Samira` shows where the wiki's ability tables imply a hit count, as a hint for what to look for.

## A champion file

```ts
import { champion } from '../dsl.ts';

export default champion('Samira', {
  reviewed: '16.20.1',                          // patch you wrote or re-read it against
  r: {
    hits: [{ type: 'physical', amount: 'DamageCalc', count: 10, crit: 'CriticalDamageCalc',
             note: 'All 10 shots of Inferno Trigger are counted.' }],
  },
});
```

The file name is the champion's id. Slots you leave out keep their automatic model. A slot written as `r: {}` is a statement that the ability deals no damage.

- `hits` — what one cast deals to one target. Each entry fires when the ability is cast.
- `rules` — damage set off by something else. Each needs `on` (below). Passives only have rules.
- `statMods`, `amps`, `resists` — see "Beyond hits".
- `notes` — assumptions the user should know. A rule's `note` is added to them.

Set `verified: ['q', 'r']` on the champion once a person has checked those slots against the live game.

### A hit or rule

| Field | |
| --- | --- |
| `type` | `physical`, `magic` or `true`. |
| `amount` | Damage of one instance before resistances. A formula. |
| `count` | How many instances. Played one by one, so each sees the health the last one left. |
| `over` | Seconds the damage takes to land, for anything that is not instant: a burn, a channel, a zone, a pet's attacks. See "Damage over time". |
| `when` | The rule only fires when this is non-zero. |
| `crit` | Damage of one instance when it crits. The engine then uses the crit-chance-weighted average, or the crit or non-crit amount when the caller asks for every crit or none. |
| `appliesOnHit` | `true`, or a fraction for reduced effectiveness: the hit also sets off on-hit effects. |
| `cooldown` | Seconds before it can fire again. |
| `then` | Counter updates after it fires: `'plasma += 1'`, `'plasma = 0'`, or a list of them. |
| `on` | When it fires (rules only). |
| `id`, `label` | Shown in breakdowns; `id` is what tests refer to. |

A rule with `amount: 0` deals nothing and exists for its `then` or `appliesOnHit`.

### Triggers

| `on` | Fires |
| --- | --- |
| `cast` | When the owning ability is cast. The default under `hits`. |
| `attack` | On each basic attack. |
| `onhit` | On each basic attack, and on each ability hit with `appliesOnHit`. |
| `ability` | When any ability is used, before its own hits, damaging or not. For "after using an ability" effects. |
| `spell` | Once per cast that dealt damage. For burns, echoes and the like. |
| `damage` | After every single instance of damage. `hit.physical`, `hit.magic`, `hit.true` say which type. |
| `after` | After every action. For reacting to a counter crossing a threshold. |
| `use` | An item's active, used at the start of the combo (items only, see "What the user can set"). |

Within one action the champion's rules run first, passive then Q W E R, then items in build order.

## Formulas

Arithmetic with `+ - * /`, comparisons, `&&`, `||`, `!`, parentheses, and `25%` as a way to write `0.25`. Functions: `min`, `max`, `floor`, `ceil`, `round`, `abs`, `clamp(x, lo, hi)`, `if(cond, then, else)`, `not(x)`.

Names, in the order they are looked up:

| Name | Is |
| --- | --- |
| a counter, option or `vars` entry of this champion | its current value |
| `level`, `rank`, `ranged`, `melee`, `time`, `sustained`, `hasTarget`, `adFromLevels` | builtins |
| `ad`, `bonusAd`, `baseAd`, `ap`, `maxHp`, `bonusHp`, `armor`, `bonusArmor`, `mr`, `bonusMr`, `mana`, `attackSpeed`, `bonusAs`, `critChance`, `critDamage`, `lethality`, `abilityHaste`, `moveSpeed`, `lifeSteal`, `omnivamp` | the attacker's stats |
| `e1`, `e2`, … | the spell's numbered effect amounts at its rank |
| anything else | a calculation, then a data value, of the slot's own spell |

And dotted names:

| | |
| --- | --- |
| `target.maxHp`, `target.hp`, `target.missingHp`, `target.hpPct`, `target.missingHpPct`, `target.armor`, `target.mr` | the enemy at that moment of the fight; `armor` and `mr` are its own, before shred and penetration |
| `target.baseHp`, `target.bonusHp`, `target.baseArmor`, `target.bonusArmor`, `target.baseMr`, `target.bonusMr` | the base and bonus parts of those. The practice tool's dummy has 1000 base health and no base resistances; a champion's base is its own stats at its level; the rest is bonus |
| `KaisaQ.e6`, `KaisaPassive.PBaseDamage` | a name on another spell of the same champion, at that spell's rank |
| `rank.q` | another ability's rank |
| `cast.r` | 1 while R's cast is being played |
| `hit.magic` | 1 when the damage a `damage` rule reacts to is magic |

Names that are not valid identifiers (unresolved hashes such as `{405deeb1}`) are written `calc('{405deeb1}')` or `dv('…')`. Prefer the named data values behind them when there are any: a hash becomes a real name the day someone resolves it, and the model would stop binding.

Unknown names are build errors. That is the point: it is what makes a renamed calculation loud.

`target.*` is 0 in raw output and adds a caveat for the user. Guard with `hasTarget &&` when the effect should simply stay quiet without a target.

## Beyond hits

**Helper formulas** shared by several rules:

```ts
vars: {
  qEvolved: 'bonusAd + adFromLevels >= KaisaQ.e6',
  missiles: 'if(qEvolved, KaisaQ.e7, KaisaQ.e2)',
},
```

They have no spell of their own, so game names in them are always written `Spell.Name`.

**Counters** are stacks that live for one fight and start at 0, or at `start` (a formula, which may read an option). Declare them, change them in `then`, read them by name. `max` clamps.

```ts
counters: { plasma: {} },
p: { rules: [
  { on: 'onhit', type: 'magic', amount: 'PBaseDamage + PCurrentPerStackDamage * plasma', then: 'plasma += 1' },
  { on: 'after', when: 'plasma > PMaxStacks', type: 'magic', amount: 'PExecutePercentage * target.missingHp', then: 'plasma = 0' },
] },
```

**Options** are switches the caller can set (`options` in the calc request). The default is a formula, so it can depend on the build.

```ts
options: { melee: { label: 'Fighting in melee range', default: false } },
```

**Stat changes**: `statMods: [{ stat: 'attackSpeed', value: 'BonusAttackSpeed', when: 'wildRush' }]`. `phase: 'percent'` multiplies the stat's total (`value: 'APAmp'` for +30% AP); `phase: 'convert'` runs last and can read the finished stats.

**Damage amplification**: `amps: [{ value: 'SpellItemDamageAmp', when: 'hasTarget && target.hpPct < HealthThreshold', types: ['magic', 'true'] }]`. `value` is the bonus: 0.2 means 20% more. `from: ['ability', 'passive']` limits it to damage from those sources (`attack`, `ability`, `passive`, `item`).

**Shred and penetration that builds during a fight**: `resists: [{ stat: 'armor', kind: 'reducePct', value: 'carve * ShredPerStack' }]`. Kinds are `reducePct`, `reduceFlat`, `penPct`, `penBonusPct`, `penFlat`. `penBonusPct` penetrates the bonus part only (Last Breath, All Out). They apply in the game's order: flat reduction, which comes off base and bonus in proportion, then percent reduction, percent penetration of the whole and then of the bonus part, and flat penetration last. Permanent penetration is a stat and needs no model.

## Damage over time

A combo is a list of actions, not a timeline, so a burn's whole damage is dealt when it is applied. `over` says how long it really takes:

```ts
r: { hits: [{ type: 'magic', amount: 'TotalDamagePerSecond * TickRate', count: 'BuffDuration / TickRate', over: 'BuffDuration' }] },
```

The total is unchanged. The result additionally carries the rule's damage per second and its duration (`over` on the part and on the line, see `src/engine/types.ts`), and the site shows them under the total: `240/s · 15s`. That is what lets a reader tell a 15 second aura from a nuke of the same size.

- Set it on every hit or rule whose damage is spread over more than about a second: damage over time, channels, zones and auras the target stands in, pets and turrets attacking for a while, delayed repeats. Not on instant hits, even multi-part ones, and not on the delay before a single detonation.
- It is the seconds **this firing's damage** covers. The reported rate is the damage divided by the seconds, added up over the combo, so the two have to describe the same thing. When an option shortens what is counted (`min(seconds, BuffDuration)`), `over` uses the same expression.
- A burn that is refreshed rather than stacked is usually written so that a re-application pays only for the time the old one ran. Its `over` is then that same time, not the full duration: `amount: 'DamagePerSecond * ran'`, `over: 'ran'`. Otherwise the rate reads low.
- What one action sets off runs side by side (the longest part is its length); a second cast adds its own time. Two entries that describe one stretch of time, such as the strikes of a spin before and after a shred lands, each get the whole stretch.
- The fight's clock does not wait for it. `time` moves by cast times only.
- An ability with an instant hit and a burn has two entries; only the burn has `over`.

## Items

`src/models/items/*.ts` export a list of `item(id, name, { … })` with the same `rules`, `statMods`, `amps`, `resists`, `counters` and `notes`. Every rule needs `on`. Item stats come from game data; an item needs a model only when its passive changes damage. An item with a model and no rules states that its passive adds nothing against a single target. The files are grouped by kind of item (`spellblade.ts`, `onhit.ts`, `mage.ts`, …); an item is modeled in one file only.

`npm run data:report -- --item 3078 --draft` and `npm run calc -- Garen --draft --items 3078` bind every item file as it is on disk, in memory, like `--draft` for a champion.

### What the user can set

Anything about an item that a fight cannot know by itself (stacks gained before it started, a condition, how often a proc lands, an active being used) is a setting. The site shows an item's settings in a menu on its slot, with what one firing of each of its named effects deals; the API takes them per build as `itemOptions: { "3161": { "stacks": 4 } }`.

| | Written as | The setting |
| --- | --- | --- |
| A state the fight starts in | `options: { stacks: { label, default, max } }` | `bool` or `int`, read by name in the item's formulas. `max` may be one of the item's data values or a formula of them (`max: 'StackCount'`, `max: 'AttackCount - 1'`), so the game's number stays in the game data. `min` is 0 unless given. |
| An active | a rule `on: 'use'`, with a `label` | How many times it is used. The actives are used at the start of the combo, in build order, before the first action; each use skips the cooldown but not `when`. `uses` is the default (1 when left out). They are never used in sustained damage. |
| A proc counted by hand | `procs: true` on any rule | How many times it fires. Left unset, the combo decides as it always has. Set to n, the rule never fires on its trigger in the combo; it fires n times at the end of the combo instead, skipping `when` and `cooldown`. Sustained damage ignores it. A string instead of `true` labels the control. |

A counter can start where a setting says: `counters: { will: { max: 'StackCount', start: 'stacks' } }`. That is the usual way to write stacks: the user says how many there are when the combo starts, and the rules keep adding to them.

```ts
item(3161, 'Spear of Shojin', {
  reviewed: '16.20.1',
  options: { stacks: { label: 'Focused Will stacks when the combo starts', default: 0, max: 'StackCount' } },
  counters: { will: { max: 'StackCount', start: 'stacks' } },
  statMods: [{ stat: 'basicHaste', value: 'AHBase' }],
  rules: [{ id: 'stack', on: 'spell', type: 'physical', amount: 0, then: 'will += 1' }],
  amps: [{ value: 'will * SpellDamageIncrease * if(ranged, RangedMod, 1)', from: ['ability', 'passive'] }],
}),
```

- **Named effects.** Every rule with a `label` and an amount that is not 0 is one of the item's effects: the menu shows what one firing deals (on a fresh fight, against the target at full health, its own damage only) and how often it fired in the combo. Give a label to what a player would call the effect, and none to bookkeeping rules.
- **Which rules get `procs`.** Effects whose real count depends on things a list of actions cannot know: energized attacks, Spellblade, every-third-attack procs, effects on a cooldown of their own, a burn applied by abilities. Not plain on-hit damage that rides every attack.
- **Defaults.** Stacks that build during a fight (on hits, casts, seconds in combat) start at 0: the combo builds them. Stacks that grow over a game by time or mana default to what a finished item usually has, and say so in the label. Stacks that need takedowns default to 0. A condition defaults to what holds in an ordinary trade, for example the attacker above half health (the engine assumes full health) and the target in melee range.
- **`amps` `from`** limits an amp to damage from some sources: `attack` (basic attacks), `ability` (Q W E R, including their hits on attacks), `passive`, `item`. Leave it out for "all damage".
- **Haste by kind**: `statMods` can add `basicHaste` (Q W E only) or `ultHaste` (R only). Ability haste only changes the cooldowns the site shows; it does not change how many casts the combo has.

## Conventions

- **Single target.** The site answers "how much does this do to one enemy". Count everything that would land on a lone target and say so in a note when that is generous (all missiles, every tick).
- **One model, both views.** The same rules run in the combo and in the sustained simulation. Use `sustained` for effects that ramp: fully ramped when sustained, not at all in a short combo, with a note saying so.
- **Averages for chance.** Crits are averaged by crit chance. A caller can also ask for no crits or every crit, so in a damage formula `critChance` reads as the share of hits that crit: the chance, 0 or 1. Average by hand with `critChance` and the model follows that choice too; stat changes (`statMods`) still see the stat itself.
- **Write the assumption down.** If a tooltip leaves something open and you chose, add a note. Notes reach the user.
- **Test what is easy to get wrong.** `test/engine.test.ts` derives expected values from the dataset's own numbers, so tests pin the structure and survive balance patches.
