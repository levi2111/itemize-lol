# The fruit fly

A simulated fruit fly that lives on the page, off until the settings menu lets it out. It came from Metanoia, where its decision 0096 and `docs/architecture/fly.md` are the full record: how the circuit was chosen, how well it stands in for the whole brain, the source of every number. This file says what the site took, and what it changed.

## What it is

Its brain is 2,000 real neurons of the FlyWire connectome (release v783) with their synapse counts, run in Shiu et al. 2024's leaky integrate-and-fire model in a Web Worker. The cursor is a hand above the screen. The fly sees it loom, feels key presses and clicks, rides along when the page scrolls, and flees with the timing its circuit gives it. A press on the fly is a swat: the hand takes 80 ms to come down, and the fly is squashed if it is still under it then. The press never reaches what lies under the fly. A squash leaves a smear, and a new fly arrives 4 s later, one generation on.

- **Real:** the connectome (which neurons, which connect, how many synapses, the sign from the predicted transmitter), the model and its parameters.
- **Added, because the circuit ran away:** synaptic fatigue (`stabilisation` in `src/fly/brain.ts`).
- **Written by hand:** how the page becomes input, how the output neurons' spikes become movement, the walk, the flight and landing, finding food by smell. Every number of these is in `src/fly/biology.ts`, marked measured, estimated or assumed, with its source. Most are assumed.

It reads the page's geometry only: positions and sizes of elements, scroll offsets, the pointer, that a key was pressed. Never text, which key, or what was clicked.

## The pieces

| File | What it holds |
|---|---|
| `src/fly/circuit.json`, `circuit.ts` | The circuit and its type |
| `src/fly/brain.ts` | Shiu et al.'s model, event-driven, and the fatigue |
| `src/fly/biology.ts` | Every number of the senses, the motor layer and the body; the foods |
| `src/fly/senses.ts` | The page as input rates |
| `src/fly/motor.ts` | Output spikes to behaviour: escape mode from spike timing, steering, feeding, grooming, backing up |
| `src/fly/body.ts` | The walk, walls and edges, the jump, flight, landing |
| `src/fly/loop.ts` | One fly's loop, the swat's strike |
| `src/fly/store.ts` | What persists in localStorage `fly` |
| `src/fly/protocol.ts`, `worker.ts` | The brain's thread and what it says to the page |
| `src/fly/controller.ts`, `draw.ts` | The canvases, the listeners, the drawing: the only two files that touch the page |
| `web/app.js`, "the fly" | The block of the settings menu |

## How it gets to the browser

As the auto-build's engine does: the repository's own TypeScript with the types taken out and nothing else changed (`flyFiles` in `src/server/engine-files.ts`), the file names in imports rewritten. The Node server serves it under `/fly/`, made from `src/` on each load. `scripts/site.ts` writes it to `assets/fly.<hash>/` and points `<meta name="fly">` there. It has a folder of its own so that a new patch doesn't send the circuit again.

Nothing of it loads until a visitor switches it on, or comes back with it on (localStorage `fly-on`), and then only after the page's `load`. `app.js` imports `controller.js`, which starts `worker.js`, which fetches `circuit.json`: 633 KB, 126 KB over Brotli.

`tsconfig.fly.json` checks `src/fly/` and its tests apart from the rest. The fly is the one part of the build with the DOM's types, and the brain's loops index typed arrays on every line, where `noUncheckedIndexedAccess` would only add a `!` to each. `npm run typecheck` runs both.

## What changed from Metanoia

- **No Fly tab.** Gone with it: the dish, the magnifier, the brain view and switching groups of neurons on, the rates, the histogram of reaction times, the table of numbers. The settings menu keeps the record as numbers (the middle reaction time for the histogram), the size, food, Dust, Blind and Scrambled wiring.
- **Food has no dish.** It lands at the fly's head, where it tastes it at once, lies on the page and scrolls with it, and is gone after 2 minutes. At most 6 lie at once.
- **Smears scroll with the page** too, on a phone, where the document scrolls.
- **The panels** it walks along and lands on are this site's (`panelSelector`), and there is no title bar to keep out of.
- **The receipt's paper** is pale, so on `.sheet` the fly and its swat are drawn for a light ground.
- **The circuit** leaves out what only the brain view read: soma positions, cell types, FlyWire IDs (715 KB to 633 KB). The extraction itself stays in Metanoia (`scripts/fly-circuit.ts`), and is not needed here unless the circuit changes.
- **The canvases** are made by the controller, and the brain's cost is no longer measured.

## Licence

FlyWire's data is **CC BY-NC 4.0**: "Published versions of FlyWire's data are available under CC BY-NC 4.0 license" (flywire.ai/principles, read on 2026-10-30). The credit is under Details in the settings menu, on both pages, and in the circuit's `source`. A site that earned money from it would not fit that licence. Shiu et al.'s code and tables are MIT; the annotations repository states no licence.

## Measured

On the published build (`wrangler dev`), 2026-10-30, headless Chrome without a GPU, the whole browser as a share of one core over 20 s:

| | |
|---|---|
| Fly off | 0.6% |
| Fly on | 15.4% |
| Fly on, page hidden | 0.5% |

Driven with real input events: a fast approach set off an escape 8 times in 8. A strike (the cursor onto the fly, pressing at once) squashed it 12 times in 20. Tapping it on a phone, which has no hand to see coming, 12 in 12. A press on the fly over a button sent the button no click. Forty rounds of switching tabs and redrawing the page, the pointer far off, set off no escape. A scroll of 80 px carried it 81 px. Food from the menu, the fly left to itself: sugar and banana fed 6 times in 6, in about 90 ms. Bitter and vinegar never fed, as they shouldn't.

`test/fly-behaviour.test.ts` gives the same reaction times as Metanoia on the smaller circuit: 208, 371, 731 and 1,290 ms at 800, 400, 200 and 100 mm/s.

## Tests

`test/fly-brain.test.ts`: the model against its closed form, the responses, scrambled wiring, the fatigue. `test/fly-behaviour.test.ts`: the senses, escape mode, the motor layer, the body, the closed loop against an in-process brain. `test/fly-store.test.ts`: what persists. `test/fly-files.test.ts`: what the browser gets, and the credit on both pages.
