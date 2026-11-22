# Essentia & Research (src/magic) - API note

Design: `docs/OVERHAUL_PLAN.md` part B. Original names; Thaumcraft is only the inspiration. Optional all the way: the tech
spine and the progression solver never need a magic recipe (content.test.ts proves the game completes; the solver reads the
desk and altar rows from `recipesMagic.ts` so their outputs count as obtainable).

## Data (pure)
- `aspects.ts`: 6 primal (cinder, loam, brook, gale, rune, rift), 12 compound (two primals each), 3 late (spark, soul, void).
  `kin(a, b)` (equal or direct component), `kinOf`, `aspectsText`.
- `aspectTable.ts`: THE fingerprint table (`KEYWORD_RULES`, `CATEGORY_BASE`, `AGE_BONUS_PER_AGE`, `OVERRIDES`, caps).
- `fingerprint.ts`: `aspectsOf(key)` for every block and item: override, else first recipe (inputs / output count, +craft, +own
  words), else keywords + category + age; four strongest, 1..8. Deterministic, memoised.
- `board.ts`: 5 x 5 board, `boardSolved`, `solveBoard(spec, aspects)` (joins anchors one by one, may pass through anchors not
  yet joined), `boardHint`.
- `entries.ts`: `RESEARCH`, 24 entries (Ember 7, Bronze 10, Forge 7) with `requires`, `board`, `unlocks { recipes, flags }`.
  Flags: vial_study, hearth_cinder, still_clarity, aura_reading, node_tap, hearth_siphon, compound_draw.
- `research.ts`: `ResearchState { v, scanned, known, lore, entries }`, `scanObject(state, key, fp, mult)`, `placeToken`,
  `removeToken`, `hintFor`, `unlockedRecipes`, `hasFlag`, `sanitizeResearch`. `gates.ts`: `RESEARCH_GATES`, `craftGateReason`.
- `nodes.ts`: wellsprings from the seed (`nodeInChunk`, `nodesNear`; 1 in 10 chunks; 70% primal), `NODE_POOL` 32, refill 1 / 15 s,
  `NODE_REACH` 6, `compass`.
- `essentiaNet.ts`: `jarsFor(blockAt, x, y, z, radius)` (jars in reach + every jar joined by `essentia_tube`s), `shortfall`.
- `ageMap.ts`: ages by name; W0 edited only `AGE_INDEX` (now ember 0, bronze 1, forge 2, current 3, atomic 4, star 5). Rune Desk, Essentia Tube and Arcane Pedestal are `forge(2, ...)` at the Bronze Furnace (`recipesMagic.ts`).

## Content (`src/content/itemsMagic.ts`, `recipesMagic.ts`, fixture `specRosterMagic.ts`)
Items: field_notebook, glass_vial, 21 `vial_<aspect>` (4 units), rods `vis_rod` / `bronze_rod` / `iron_rod` (`RODS`: capacity
16/32/64, draw 1/2/3), foci `focus_kindle` / `focus_light` / `focus_ward` / `focus_blink` (`FOCI`: cost 2/1/6/4, cooldown), vein_lens.
Blocks: essentia_jar (32), void_jar (128), essentia_tube, rune_desk, infusion_altar, arcane_pedestal, clay_servant (oriented),
magic_light (item-less, light 14). Registry recipes: notebook (hand), rod and jar (workbench), glass_vial, rune_desk,
essentia_tube, arcane_pedestal (forge). `ARCANE_RECIPES` (desk, with aspect `cost`) and `INFUSIONS` (altar: `center`, `around`,
`cost`, `seconds`) live outside RECIPES. Icons and faces: `src/render/textures/iconsMagic.ts`. Sounds: `src/audio/sfxMagic.ts`
(scan_chime, essentia_pour, rod_hum, research_solve, infuse, cast).

## Runtime (`magic.ts`, class `Magic`, owned by `Game`, saved with `world.persist('magic')`)
- `use(target | null)` (first in `Interaction.beforeUse`, after the workshop): notebook scan / open; a held rod gathers (a
  wellspring in reach with research 'wellsprings' at twice the rate, else the richest drawable aspect of the blocks within 3 -
  primal only until 'compound_draw'); with an empty vial carried the units fill vials, else they charge the rod (`charge`, capped
  by the best rod carried). Rod on an altar starts an infusion. Foci spend charge. Vials on jars, pedestal / altar put and take,
  rune desk opens screen 'rune_desk', Vial of Cinder on a burning furnace (+90 s, 'warm_hearth'), Vial of Clarity on a
  distillery flask (takes 250 L of water out, 'still_trace').
- `tick(dt)`: ward timer (`player.damageScale` 0.5 for 30 s), infusion draw (1 unit / 0.4 s from jars within 4 or tubed; done when
  paid and `seconds` passed; the heart becomes the result), every second: clay servants (fed 1 Spring per 30 s from a jar they
  touch or tube to; `hooks.crank` on every hand_crank they touch -> `Workshop.crank`) and the hearth siphon (a Cinder jar touching
  or tubed to a burning furnace with < 15 s left adds a quarter vial's burn per unit).
- `desk(x,y,z): DeskApi` (`rows()` with ingredients, cost, `problem`; `make(id)`); payment: jars within 3 / tubed, then carried
  vials (whole vials; the rest of a vial is lost). `notebook(): NotebookApi` (+ `study`, `canStudy`, `goals`, `charge`).
- Views for Game / renderer: `jarText`, `altarText`, `servantText`, `rodReading` (crosshair, research 'aura_reading'),
  `lensLabel` (held notebook + carried lens), `jarFills`, `nodesAround`, `displays`, `infusionAt`, `matchInfusion`, `goals`.
- `MagicHooks` (set by Game): stokeFurnace, furnaceFire, lightFurnace (`sim.light`), purifyFlask (`sim.distill` mix), crank.
- Save: research, jars, land draws, charge, pedestals, altars, infusion, servants, wellspring draws, stats; damaged data dropped.

## UI and render
- `src/ui/screens/notebook/notebookScreen.ts`: tabs Research (entries grouped by age, 44 px board, aspect chips with lore, Take
  back, Hint), Aspects, Notes (scan carried items, rod charge, study vials), Goals (eight optional side goals).
- `deskScreen.ts`: every arcane recipe with ingredient and essentia chips (green = have), reason, Make.
- `src/render/magic/magicRenderer.ts`: jar fill boxes, wellspring crystals (core + halo, spin, bob, fade as drawn), items on
  pedestals and altars through a second GroundItemRenderer. `stats` for checks.
- Codex: the Essentia tab (`scripts/codex`), aspects in the item drawer, magic branches in the progression tree.

## Glassware (src/content/itemsGlass.ts) - vials in the chemistry
- A Glass Vial works wherever an empty Glass Beaker is taken (sap tap, distillery); sugar has a vial row. 1 glass -> 2 of either.
- Water in a beaker or vial boils on its own on a furnace top (`ContainerSpec.boilScale`); sap cooks to resin there
  (`holds: 'sap'`, `returns`). Tests: `src/sim/glassware.test.ts`, `src/player/glassTap.test.ts`.

## Tests and checks
`src/magic/*.test.ts` (fingerprints, boards solvable with each age's aspects, state, runtime: rods, wellsprings, tubes, desk,
altar, foci, servants, siphon, still, study, save); `node scripts/e2e-magic.mjs [--no-build] [--device=desktop|phonePortrait]`
(scan, notebook board by taps, gated vial, rod, jar, boiling vial, desk screen, infusion, Light focus, wellspring, servant),
chained in `npm run e2e`; `node scripts/codex/preview.mjs <dir>` covers the Essentia tab.

## Known limits / next
- Tubes are glass blocks with their own small network, not the fluid-pipe machinery (21 aspects do not fit the FluidKey union).
- The rest of a partly used vial at the desk is lost; foci have no hand animation; wellspring crystals are unlit meshes.
- Not built: spark / soul / void as drawable aspects (only through overrides of late blocks), golems that walk, an aura HUD dial.
