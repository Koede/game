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
- `board.ts` (Thaumcraft 4 style): a hexagon of hex cells, axial coords, radius by complexity (Ember 2, Bronze 3, Forge 4);
  `BoardSpec { radius, anchors, blocked }` (blocked = ink blots). Neighbours LINK only when one aspect is a direct component
  of the other (`linkable` in aspects.ts; never the same aspect). `boardSolved` (every anchor joined), `solveBoard(spec,
  aspects, keep)` (fewest tokens over every anchor order), `boardHint`.
- `entries.ts`: `RESEARCH`, 24 entries (Ember 7, Bronze 10, Forge 7) with `requires`, `board`, `unlocks { recipes, flags }`.
  Flags: vial_study, hearth_cinder, still_clarity, aura_reading, node_tap, hearth_siphon, compound_draw.
- `research.ts`: `ResearchState { v: 2, scanned, known, lore, entries { done, begun, tokens } }`, `scanObject(state, key, fp,
  mult)`, `beginResearch` (starting notes costs 1 lore of each anchor aspect: `entry.cost`), `combineAspects` (1 + 1 lore ->
  1 of the compound, learning it), `placeToken` (needs begun notes, spends 1 lore; overwriting loses the old one),
  `removeToken` (erasing refunds nothing), `hintFor`, `unlockedRecipes`, `hasFlag`, `sanitizeResearch`. `gates.ts`: `RESEARCH_GATES`, `craftGateReason`.
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
- `src/ui/screens/notebook/notebookScreen.ts`: tabs Research (Thaumonomicon-style map per age: nodes joined to what they need,
  unknown ones shown as ?; the selected entry's cost and Begin research; begun notes as a hex board), Aspects, Notes (scan
  carried items, rod charge, study vials), Goals (eight optional side goals). Opened from a Research Table (block
  `research_table`, Use; screen `{ type: 'notebook', table: true }`) the begun notes can be written: tap a hex, then an aspect
  chip; Erase, Hint, Combine lore. Each write spends one ink from carried `scribing_tools` (64 ink, stack durability).
- `deskScreen.ts`: every arcane recipe with ingredient and essentia chips (green = have), reason, Make.
- `src/render/magic/magicRenderer.ts`: jar fill boxes, wellspring crystals (core + halo, spin, bob, fade as drawn), items on
  pedestals and altars through a second GroundItemRenderer. `stats` for checks.
- Codex: the Essentia tab (`scripts/codex`), aspects in the item drawer, magic branches in the progression tree.

## Thaumcraft-4 model (vis, crucible, instability)
- **Vis** (`vis.ts`): a rod holds one pool per primal (cinder, loam, brook, gale, rune, rift), each up to the best carried rod's
  capacity (16 / 32 / 64). Use draws from the land or a wellspring; a compound splits into its primals. `Magic.vis`,
  `visTotal()`, `primalsOf(cost)`. Rune Desk recipes and every focus (`FOCI[].vis`) spend vis; the desk needs a rod carried.
- **Crucible** (`crucible.ts`, block `crucible`, research 'crucible', 4 stone brick + bucket): water in (vial / beaker / bucket
  of water), a burning furnace or lava under it. Items Used on it dissolve into essentia (cap 64, the rest is flux); an empty
  vial bottles `VIAL_UNITS` of the richest aspect; a catalyst with its `ALCHEMY` essentia present (copper/tin ore, sand,
  charcoal, dirt) comes out as the output. Vials still go to jars, tubes and the altar: essentia is for infusion, vis for arcane.
- **Infusion instability** (`instabilityAt`): 2 per pedestal without a mirrored twin across the altar, +1 per pedestal past two.
  Each second an infusion rolls `instability * MISHAP_PER_S`: half the time a drawn essentia splashes away, otherwise a pedestal
  item is thrown off and the infusion breaks. Altar text shows stable / unstable.
- **Warp** (`Magic.warp`, 0..40, saved, never shown as a number): +1 for each infusion (+2 clay servant, void jar), +1 per infusion
  mishap, +1 for each Forge-age research finished. Every `WARP_ROLL_S` (45 s) at warp >= 2 it rolls `warp * 8%`: a whisper toast,
  or from warp 6 a hollowness that takes 2 food. `uneaseText()` words it in the notebook's Notes tab. **Sanity Soap**
  (`sanity_soap`, Use anywhere) lifts `SOAP_WARP` (3).
- **Arcane Workbench** (block `arcane_workbench`, research 'arcane_bench', Bronze Furnace like the desk): opens the desk screen
  with `bench: true`, listing only `ArcaneRecipe.bench` recipes (`desk(x, y, z, bench)`); today Sanity Soap (charcoal + clay + vis).
  The Rune Desk lists the rest.
- Research map: 'crucible' now follows 'glassware'; 'warm_hearth' and 'still_trace' follow 'crucible'.
- Saves: `vis` (primal map) and `crucibles` replace the old single `charge`, which is dropped on load.

## Wands (cores, caps, plugged foci)
- `WAND_CORES` (reed 16 / bronze 32 / iron 64, the plain rod each is made from) x `WAND_CAPS` (copper: cinder+loam, tin: brook+gale, bronze: rune+rift) = nine `wand_<core>_<cap>` items (`WANDS`; `ROD_TIERS` = plain rods + wands, `RodTier.favour`). Made at the Rune Desk from the core rod and two ingots (gated with the bronze / iron rod research). The best tier carried sets pool capacity (ties: more draw, then a cap).
- A cap's favoured primals are drawn `ceil(units * 1.5)` and cost `floor(n * 0.75)` (min 1) in foci (`Magic.focusCost`).
- Plugging: Use a wand on an Arcane Workbench with a focus carried to plug it in (again to take it back; saved as `plugged`). A wand with a focus plugged casts it on Use when its vis and cooldown allow, else it draws vis as usual.

## Active scanning
- A held notebook's Use on a thing not yet noted fills a bar: `SCAN_S` (1.2 s of repeated Use; 0.8 s with the lens), emptied after `SCAN_GAP_S` (0.6 s) without Use or on aiming elsewhere. `Magic.scanLabel()` ("Scanning Copper Ore [####....] 50%") replaces the crosshair name (`Game.magicLabel`). A noted thing reads out at once; `NotebookApi.scanItem` (carried items) stays instant. e2e holds Use (`d.holdUse`).

## Glassware (src/content/itemsGlass.ts) - vials in the chemistry
- A Glass Vial works wherever an empty Glass Beaker is taken (sap tap, distillery); sugar has a vial row. 1 glass -> 2 of either.
- Water in a beaker or vial boils on its own on a furnace top (`ContainerSpec.boilScale`); sap cooks to resin there
  (`holds: 'sap'`, `returns`). Tests: `src/sim/glassware.test.ts`, `src/player/glassTap.test.ts`.

## Tests and checks
`src/magic/*.test.ts` (fingerprints, boards solvable with each age's aspects, state, runtime: rods, wellsprings, tubes, desk,
altar, foci, servants, siphon, still, study, save); `node scripts/e2e-magic.mjs [--no-build] [--device=desktop|phonePortrait]`
(scan, begin research from the map, research table hex board by taps, gated vial, rod, jar, boiling vial, desk screen, infusion, Light focus, wellspring, servant),
chained in `npm run e2e`; `node scripts/codex/preview.mjs <dir>` covers the Essentia tab.

## Known limits / next
- Tubes are glass blocks with their own small network, not the fluid-pipe machinery (21 aspects do not fit the FluidKey union).
- The rest of a partly used vial at the desk is lost; foci have no hand animation; wellspring crystals are unlit meshes.
- Not built: spark / soul / void as drawable aspects (only through overrides of late blocks), golems that walk, an aura HUD dial.
