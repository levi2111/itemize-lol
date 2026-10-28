# itemize.lol

Compare League of Legends item builds by the damage they actually deal. This repository holds the backend (data pipeline, damage engine, HTTP API) and the site it serves.

```
npm install
npm run data:update     # mirror the current patch and compile it (about a minute, 60 MB of downloads)
npm start               # http://localhost:8787
npm test
```

Requires Node 24 or newer. TypeScript runs directly; there is no build step for development.

## Where the numbers come from

No public source gives real ability damage. Each one has part of it:

| Source | What it has | What it lacks |
| --- | --- | --- |
| **Data Dragon** (Riot, official) | Names, icons, prices, tooltip templates | Every formula. It is also sometimes wrong: in 16.20.1 it lists attack damage per level as 0 for 172 of 173 champions. |
| **Game files**, mirrored by Community Dragon | The real formulas and per-rank values, base stats, complete item stats | How the formulas combine. Samira's R has one calculation: a single shot. That she fires ten is written only in the tooltip's prose. |
| **The wiki** (and Meraki's export of it) | Hit counts, written by people | Currency. Its Samira numbers were a balance pass behind when this was built. CC BY-SA licensed. |

So the dataset is built in three layers, each doing only what it is reliable for.

1. **Numbers: automatic, from game files.** `src/pipeline/calc.ts` compiles every calculation in the game data into a small formula tree. Nothing numeric is ever typed by hand, so balance patches flow through on the next `data:update`.
2. **Structure: hand-written models.** `src/models/` says how the formulas turn into damage: how many times a hit lands, what it scales with on the target, what it adds to an attack, what stacks. Models name calculations and never contain game numbers. [docs/models.md](docs/models.md) is the guide.
3. **Fallback: read from the tooltip.** Anything without a model gets one derived from the tooltip template (`src/pipeline/automodel.ts`). It is deliberately conservative, lists what it assumed, and is marked as an estimate everywhere it is shown.

The wiki is used only by `npm run data:crosscheck`, a development tool that flags abilities whose model disagrees with the wiki's hit counts. Nothing from it is copied into the dataset or served.

### What keeps it honest

- **Every ability and item carries a status**, returned by the API and shown in the UI.

  | Status | Meaning |
  | --- | --- |
  | `verified` | Hand-written and confirmed against the live game by a person. |
  | `curated` | Hand-written from the game data and tooltip; the spell has not changed shape since. |
  | `stale` | Hand-written, but the spell changed shape since it was accepted. Still used, flagged for review. |
  | `auto` | Estimated from the tooltip. |
  | `none` | The tooltip was read in full and mentions no damage. |
  | `unmodeled` | Deals damage that is not counted yet. |

- **Models are checked against each patch.** A model that names a calculation the patch no longer has fails to bind: the build reports it and that ability falls back to the estimate. It can never silently read zero.
- **Reworks are detected.** Each model is fingerprinted with the shape of the spell it reads (formula structure, value names, tooltip text, but not the tuned numbers). `src/models/models.lock.json` records the fingerprints last reviewed; a mismatch marks the model `stale`.
- **The undocumented format has canaries.** The game data's stat codes are not documented and have been renumbered before. `src/pipeline/anchors.ts` lists calculations whose meaning is not in doubt ("Samira R scales with AD"). If they stop matching, the build refuses to write a dataset.
- **Sources are compared.** Where Data Dragon and the game files disagree, the build says so and uses the game files.

## Each patch

A new patch ships by itself. Every three hours `.github/workflows/patch.yml` runs `npm run patch:update` (`scripts/patch-update.ts`), which asks Data Dragon for the newest patch. When there is one, it mirrors and compiles it, packs its art into `web/art/`, drops the previous patch's dataset, runs the typecheck and the tests, commits to `main` and deploys. Run it by hand the same way, or from the Actions tab (Run workflow).

It opens an issue when a person has to look:

- **Models to look at** (the patch shipped): the issue lists them.
  - `does not bind` — a name changed, and the ability or item falls back to an estimate. Fix the model in `src/models/`.
  - `spell changed since it was accepted` — the site marks it "needs review". Re-read it with `npm run data:report -- --champion <id>`, fix the model if needed, then `npm run data:accept`.
- **Patch update stopped** (nothing shipped; it tries again every three hours, and keeps one issue open until it is closed): the run's log says why.
  - `ANCHOR FAILED …` — the data format itself changed. Fix `src/pipeline/calc.ts` before trusting anything.
  - `stat icons changed on texticons.png …` (from the art step) — an icon on the game's sheet of stat icons looks different. The site shows seven of them beside the totals, and nothing says where on the sheet each one sits, so `src/pipeline/stat-icons.json` records it by hand. Look at the sheet, fix a position if an icon moved, then `npm run data:art -- --accept`.
  - A test failed.

Item popularity (`npm run data:popularity`, the picker's order) needs a Riot API key. With a `RIOT_API_KEY` repository secret, the update samples it once a patch has been out for three days; a development key lasts a day, so the secret needs a personal key. Without one, a new patch keeps the last sample, and `npm run patch:update -- --popularity` with a key in the environment samples it by hand.

`data/raw/` is a cache and stays out of git. `npm run data:update` mirrors, compiles and packs the newest patch without the rest.

## Coverage today (patch 26.20)

Every champion has a hand-written model: 864 of the 865 abilities and passives are `curated`, none are `verified` yet. The one left `unmodeled` is Mel's Rebuttal, whose damage is a share of whatever enemy projectile it reflects. Summoner's Rift items: 72 are hand-written, every fighter, marksman and mage item whose passive or active changes damage among them, and 57 of those have settings the site lets the user change (stacks, a condition, uses of an active, procs counted by hand). 11 have stats that count and a passive that does not: the Doran's items, Tear of the Goddess, Bramble Vest, and support and tank items (Zeke's Convergence, Redemption, Ardent Censer, Bloodsong and the other support quest items). ARAM's and Arena's copies of a Rift item use the Rift item's model when it binds; Arena changed the passives of 39 of its copies, which are marked `stale` for that. Arena's own items are mostly unmodeled. Items are the model-writing backlog now: `npm run data:report -- --status unmodeled`.

What `curated` does not promise: nobody has checked these against the live game. The weakest spots are the things the game data has no number for and a model had to assume, each behind an option with a note: how fast a pet, clone or turret attacks (Shaco's boxes, Heimerdinger's turrets, Malzahar's Voidlings, Yorick's Maiden, Zyra's plants, Kindred's Wolf), and how much of a long effect a target really sits through (Renekton's Dominus, Xerath's barrage).

`npm run data:crosscheck` lists 46 abilities to review. It only compares a rule's repeat count with the wiki's, so it also flags models that write a second hit as its own rule (Ahri's orb going out and coming back) or use the game's total-damage calculation; at the time of writing all 46 are of that kind.

## API

All under `/api/v1`. Reads are cacheable and revalidate by ETag.

| | |
| --- | --- |
| `GET /meta` | Patch, data sources, coverage, and the legal notice. |
| `GET /champions` | Every champion: id, name, tags, base stats, model status per ability, and the `slug` of its page on the site. |
| `GET /champions/:id` | One kit: ability names, icons, max ranks, status, notes, options. |
| `GET /champions/:id/target?level=` | That champion's health, armor and magic resist at a level, for using it as the target. |
| `GET /items` | The items of three shops, Summoner's Rift, ARAM and Arena: name, gold, tags, the shops that sell each (`shops`), stats, status, notes, and what a page can let the user set about each (`controls`) and its named effects (`effects`). |
| `POST /calc` | The calculation. One or two builds against one target. |
| `POST /links` | A short link for a build: `{ "s": <the page's state>, "layout": "tabs" \| "receipt" }` in, `{ "id", "url" }` out. See Short links. |

```jsonc
// POST /api/v1/calc
{
  "champion": "Kaisa", "level": 13,
  "ranks": { "q": 5, "w": 1, "e": 5, "r": 2 },
  "builds": [{ "items": [6672, 3006, 3124, 3115] }, { "items": [6655, 3020, 3115, 4645], "ranks": { "q": 3, "w": 1, "e": 5, "r": 2 } }],
  "target": { "hp": 2400, "armor": 80, "mr": 50 },     // or { "champion": "Ornn", "level": 13 }, or null for raw output
  "combo": { "counts": { "aa": 3, "q": 1, "w": 1 }, "crits": "average" }   // or { "sequence": ["aa", "q", "aa", "w", "aa"] }
}
```

A build's own `ranks` replace the shared ones for that build. `crits` is how the combo counts critical strikes: `average` (at the build's crit chance, the default), `never` or `always`; DPS and time to kill always use the average. A source line that can crit carries `crits`: its total in each of the three, so a page can show a hit with and without one.

Each result has computed stats, combo damage (raw and after mitigation, by type and by source, down to the rule that fired), sustained DPS, time to kill, and the assumptions behind the numbers. `src/engine/types.ts` is the contract.

A champion's `options` (a form, stacks, seconds spent in an aura; listed by `GET /champions/:id`) go in the request as `"options": { "cougar": true, "auraSeconds": 4 }` and apply to every build; the result echoes the value each one had, defaults included.

An item's settings (its `controls` in `GET /items`) belong to a build: `"builds": [{ "items": [3078, 3161], "itemOptions": { "3161": { "stacks": 4 }, "3078": { "spellblade": 3 } } }]`. There are four kinds: `bool` and `int` are a state the fight starts in (stacks already gained, a condition), `uses` is how many times an active is used at the start of the combo, and `procs` is how many times an effect fires in the combo in place of what the combo sets off on its own (left out, the combo decides). Each result's `items` echo the settings used (a proc left to the combo is `null`) and list the item's named `effects`: what one firing deals against the target at full health, and how often it fired. Each result's `abilities` carry one cast of the ability on its own (`cast`, everything it sets off) and its `cooldown` after ability haste; that is what the site shows when an ability is pointed at. Damage that takes time to land (a burn, a channel, a zone) is still dealt in full, and its source line carries `over`: the seconds it runs and its damage per second. The site shows that under the total as `240/s · 15s`.

The engine (`src/engine/`, `src/shared/`) has no Node dependencies and reads plain JSON, so it can also be bundled for the browser later.

## Layout

```
src/pipeline/   fetch -> compile -> bind models -> write data/dist/<patch>/
src/models/     hand-written models: champions/*.ts, items/*.ts, models.lock.json
src/shared/     dataset types, formula evaluator
src/engine/     stats, mitigation, the fight simulation, the calculation
src/server/     HTTP API, and the Node server that also serves the site; share links read as the page reads them, and what a preview says
src/worker/     the same API as a Cloudflare Worker, and the short links with their link previews
migrations/     the short links' table, for D1 (wrangler d1 migrations) and for the Node server's SQLite file alike
src/og/         the preview images: a PNG writer that reuses a champion card's compressed rows, glyphs, the card's layout
web/            the site, wired to the API: two layouts, one page each (index.html the tabs, receipt.html the receipt), one app.js for both.
                The tabs page alone has the Crits switch, ranks per build and the shops in the item picker. Both have each item's
                settings menu (the button on its slot), the card an ability shows when pointed at, and the introduction
                a first visit opens: a welcome, then a five-stop tour of the page (the ? in the top bar brings it back)
scripts/        calc.ts (one calculation from the command line), outliers.ts (sanity scan), bundle.ts (packs the dataset for the Worker),
                site.ts (prepares web/ for Cloudflare), og.ts (the champions' cards), og-glyphs.ts (the glyphs, with Chrome)
```

Environment: `PORT`, `ITEMIZE_PATCH`, `ITEMIZE_DATA_DIR`, `CALC_PER_MINUTE`, `LINKS_PER_MINUTE`, `ITEMIZE_LINKS`, `TRUST_PROXY` (see `src/server/main.ts`); `ITEMIZE_CONTACT` sets the contact in the pipeline's User-Agent.

## Deploying

Production is a Cloudflare Worker (`wrangler.jsonc`). Cloudflare serves the site as static files, with the headers in `web/_headers`, and the Worker answers `/api/v1` from the dataset packed into it at build time, and the short links (`/b/<id>`). Every page is a plain file the Worker never sees: on the Workers Free plan, once the 100,000 requests of a day are used up, Cloudflare answers whatever would run the Worker with a 429, and that leaves the pages up. Before each deploy `scripts/site.ts` copies `web/` to `.build/site/` and renames the scripts after their contents, so everything but the pages themselves is cached forever. The tabs are at `/` and the receipt layout at `/receipt`; the gear in the top bar swaps between them and remembers the choice in the browser. The browser also keeps the last build the visitor changed, and both pages open on it; a share link (see Short links) opens on its own build, which replaces theirs only once they edit it. If a patch has since moved that build's combo or DPS by 1% or more, or changed which build leads, one line on their first visit after says so. Saved builds stay in the browser too (the Saved builds menu in the top bar of both pages, one list under `saved` in localStorage): the server never sees them.

Each champion also has a page of its own for searches to land on: `/vayne` is the tabs page with Vayne already chosen, and a title, description, canonical and link preview of its own. The slug is the champion's name in lower case, apostrophes and periods dropped and every other gap a hyphen: `kaisa`, `dr-mundo`, `nunu-willump`, `wukong`. Data Dragon ids and a few other names redirect to it with a 301 (`/MonkeyKing`, `/Vayne`, `/leesin`, `/kai-sa`, `/mundo`). `/receipt/vayne` is the same page in the receipt layout, for visitors who chose that one; its canonical is `/vayne`, as `/receipt`'s is `/`. Choosing another champion on such a page moves the address to that champion's page. `src/server/pages.ts` makes all of it: `scripts/site.ts` writes the pages as `vayne.html` and `receipt/vayne.html` (Cloudflare serves `/vayne` from `vayne.html` with a 200; `vayne/index.html` would redirect to `/vayne/`), with `sitemap.xml`, `robots.txt` and `_redirects`, and the Node server makes the same per request.

```
npm run dev:worker      # the Worker, locally
npm run deploy          # publish it
```

Pushing to `main` runs the tests and then deploys (`.github/workflows/ci.yml`). `npm start` remains the Node server for development; both run the same `src/server/app.ts`.

### Short links

**Copy build link** copies `https://itemize.lol/b/x7Kq2Pa`. The page sends its state (the same string a long link carries in `?s=`) and its layout to `POST /api/v1/links`, which keeps them in a Cloudflare D1 database and names them. The id is 7 base62 characters of a SHA-256 of the layout and the state, so the same build always gets the same link and is stored once; if a different build already holds those 7, the link takes 8, and so on (`src/server/links.ts`). A row is the id, the layout, the state and the day it was made, nothing about who made it. `POST /links` checks that the state is a build the page can read (`src/server/share.ts`), takes at most 4,096 characters, and allows 20 a minute per address (`LINK_LIMIT` in `wrangler.jsonc`; `LINKS_PER_MINUTE` on Node).

- `/b/<id>` runs the Worker first (`run_worker_first`), which looks the id up (in Cloudflare's cache first: an id never changes what it holds, so a link is read from D1 about once per data centre) and answers with the layout's page, the build written into it as `<script type="application/json" id="shared-build">`, and the build's link preview. `brought()` in `web/app.js` opens it. A visitor who chose the other layout is sent there by `layout.js` with the build handed over, as the layout menu hands it over. Once the visitor edits the build, the address moves to the layout's page (a champion page that shared one goes back to the champion's page). An id that does not exist gets the tabs page with its own build and a 404.
- When a short link cannot be made (offline, the limit, D1 down or past its daily allowance) the button copies the long link, `/?s=…` or `/receipt?s=…`, so sharing never breaks. Long links, and the older `#s=` ones, still open their build, but their preview is the site's own.
- Capacity on the Free plan: 100,000 rows written a day (a new link writes one; sharing a build that already has a link writes none), 5 million rows read a day, 500 MB per database. A link is about 350 bytes, so that is over a million links. Past a daily allowance D1 refuses until 00:00 UTC; the button falls back to long links meanwhile, and links already cached keep opening.
- On Node, `npm start` keeps them in `data/links.sqlite` (`ITEMIZE_LINKS` to move it) with `node:sqlite`, made by the same migrations. Locally, `npm run dev:worker` uses a local copy of D1 in `.wrangler/`: run `npx wrangler d1 migrations apply itemize-links --local` once.

**Setting it up, once.** These change your Cloudflare account, so they are yours to run:

1. `npx wrangler d1 create itemize-links`. It prints a `database_id`.
2. Put it in `wrangler.jsonc` in place of `00000000-0000-0000-0000-000000000000` (`d1_databases`), and commit. Until then `wrangler deploy` fails, so do this before merging.
3. `npx wrangler d1 migrations apply itemize-links --remote` makes the table.
4. CI applies new migrations before each deploy (`.github/workflows/ci.yml`). The `CLOUDFLARE_API_TOKEN` secret needs the D1 Edit permission for that, next to Workers Scripts Edit; without it the step fails and nothing is deployed.

### Link previews

A shared build is a short link, `/b/<id>`. Pasted into Discord, Slack, X, Reddit, WhatsApp or iMessage it unfurls into a short title ("Vayne · Build comparison", or "Vayne · Build damage" for one build) and a 1200×630 image of the result; there is no description line, so the image does the talking. `/`, `/receipt` and the champion pages carry the site's own tags (a champion page its own), whatever is in their address.

- `src/worker/preview.ts` reads the stored build as the page does (`src/server/share.ts`), runs the engine, and writes the head's title, Open Graph and Twitter tags (no description, and the page's own is removed, or Discord would show it) (`src/server/preview.ts`, `src/server/links.ts`). A build that cannot be read keeps the site's own tags. The Node server writes the same tags but draws no image, so its previews show the site's card.
- The image is `/og/b/<version>/<layout>/<s>.png`, drawn by the Worker and kept in Cloudflare's cache. The version names the data, the art and the drawing code, so an address never shows stale numbers. Drawing takes a few milliseconds of CPU because almost nothing is drawn per request: `npm run site` draws every champion's card at build time (`scripts/og.ts`, served at `/og/<id>.png`, which is also the image of the champion's own page), and a build's card copies its compressed rows and compresses only the rows it draws on (`src/og/png.ts`). The cards are cached in `.build/og-cache/`, so later builds take seconds.
- Text is drawn from glyphs rasterised from the site's fonts. After changing the faces or sizes in `src/og/font.ts`, run `node scripts/og-glyphs.ts` (it needs Chrome) and commit `src/og/glyphs.bin`.
- Changing what a link holds means changing `encodeState`/`applyState` in `web/app.js` and `src/server/share.ts` together; `test/share.test.ts` pins down the pairs.

## Riot's rules

Checked against Riot's [Legal Jibber Jabber](https://www.riotgames.com/en/legal) and [developer policies](https://developer.riotgames.com/policies/general) in October 2026. Re-read them before launch; they change.

**Done in code**

- The required notice is shown on every page (`LEGAL` in `src/server/app.ts`).
- No Riot logos or trademarks in the site's name or branding.
- Only information present in the game client is used, and nothing identifies or tracks players.
- Game data is mirrored once per patch at build time, not fetched per visitor. The same goes for the art: the site serves its own packed copies (`npm run data:art`) and loads nothing from Riot's servers.

**To do before monetizing — these need you, not code**

1. **Register the product on the [Riot Developer Portal](https://developer.riotgames.com/).** Riot requires registration for every product that serves players, with or without the API, and allows monetization only for products whose registration is Approved or Acknowledged. Riot's fan-content policy otherwise prohibits commercial projects.
2. **Declare the data sources in that registration**: Data Dragon, plus game-file data via Community Dragon. Riot's policy lists Data Dragon as the sanctioned source and says products "should use supported services". Community Dragon describes itself as operating in a gray area that Riot has acknowledged. Nearly every stats site depends on it, but get it on the record for this one. If Riot objects, only `src/pipeline/fetch.ts` needs a different source: nothing downstream knows where the files came from.
3. **Keep a free tier.** Ads and subscriptions are allowed; charging requires a free tier to exist, and paid content must be transformative.
4. **Do not present the site as official** or endorsed by Riot.

## Not built yet

- Runes, summoner spells, and the target's own items (the UI marks that last one "soon").
- Attack speed that ramps within a fight. Ramping effects count as fully ramped for sustained damage and not at all in a short combo; each affected item says so in its notes.
