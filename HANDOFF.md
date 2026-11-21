# Hearthwatt - handoff

Pick-up notes for whoever continues this build. Every module is built and wired together: the game boots,
plays and saves (`npm run build`, then open dist/index.html through any static server). What is left is the
playtest and review pass and delivery (items 10 and 11 below).

**Read first:** `docs/SPEC.md` (design, rules, architecture, a brief per module) and `docs/api/*.md` (what
each finished module exports). `README.md` describes the finished game, not the current state.

## What the player asked for

A voxel sandbox "more focused on technological advancement and generating power from resources. Your
furnace is your crafting table, there is a crafting table but the furnace is the main place in one's base
they should congregate to." Later instructions: use waiting time for other work; build game rules in tandem
with the world. The player is on a phone - touch controls and phone-sized UI are first-class.

It must be an original game in the genre, not a copy of an existing one: own name (Hearthwatt), own art,
no borrowed creatures/items/recipes, recipe lists instead of a shaped crafting grid.

## Where things stand

Check the real state before trusting this table (a background build may have moved on since it was written):

```
for d in core content audio save game world render ui player sim; do
  echo "$d: $(find src/$d -name '*.ts' 2>/dev/null | wc -l) files, $(find src/$d -name '*.test.ts' 2>/dev/null | wc -l) test files"; done
npx tsc --noEmit -p . | grep -oE "^src/[a-z]+" | sort | uniq -c     # type errors per module
npx vitest run                                                      # all unit tests
ls docs/api                                                         # a module with notes here was finished by its engineer
git log --oneline | head -20
```

| Module | State when this was written | Notes |
|---|---|---|
| `src/core` | done, tested | Contracts: voxel encoding, specs, registry, events, constants, `IView`. Treat as fixed. |
| `src/content` | done, tested | 68 blocks, 123 items, 94 recipes, 5 furnace tiers, 21 machines, 37 objectives. A solver test proves the tech tree is completable. |
| `src/audio` | done, tested | All sounds synthesised. Measured, never listened to. |
| `src/save` | done, tested | `SaveStore` only (versioned storage). The save document itself is integration work. |
| `src/ui/kit`, `src/ui/menus`, `src/ui/styles.css` | done, screenshotted | Checked at 390x844, 844x390, 1280x800 by the 7.4a engineer; small fixes. API in `docs/api/ui-kit.md`. styles.css section 13 holds the shared game-screen styles. |
| `src/game` | done, tested (71 tests) | inventory, transfer, crafting, mining, clock, playerState, survival, objectives, index. API and decisions in `docs/api/game.md`. Only run against a fake world and scripted events so far. |
| `src/world` | done, tested (66 tests) | worldgen, lighting, mesher (all shapes), `World` (streaming, sync re-mesh of edits, lighting ripple, entity pinning, save/load), chunk worker + pool with main-thread fallback; streamed in headless Chromium through real workers. API in `docs/api/world.md`. Appended event `chunk:hidden` (renderer: drop the mesh). main.ts must pass `new WorkerPool(workerSource)` from `virtual:worker`. |
| `src/render/textures` | done, tested (16 tests) | A dedicated painter for all 164 `TEXTURE_NAMES` (terrain, ores, wood, building, 5 furnace tiers lit/unlit, machine casing + every front idle/running, cables, 60 item icons). Reviewed on contact sheets, 4x4 tilings, the kit's real slots at 390x844 and a three.js harness by day and night. API, pixel conventions (alpha, torch/cable regions, full-bright lit fronts) and the textures I am least happy with in `docs/api/textures.md`. |
| `src/render` | done, tested (38 tests) | `Renderer` (implements `IView`; canvas `game-canvas` prepended to `#app`; throws a readable error without WebGL2; survives context loss), atlas, 3 chunk materials with per-vertex light/fog/sway/shimmer, chunk meshes (`chunk:meshed/hidden/unloaded`), sky (sun, moon, stars, clouds), target outline + 8 crack stages, pooled particles (debris, furnace smoke, bellows/forge sparks, steam, exhaust, explosion), furnace halos, held item, `createIconProvider()`. ~120 draw calls / ~200k triangles at 6 chunks on desktop, ~70 on a phone. Create it BEFORE the first `world.update()`. Screenshots of every brief scene at 1280x800 and 390x844 reviewed. API, measurements and gaps in `docs/api/render.md`. |
| `src/player/input` | done, tested | `InputManager` (keyboard, mouse with pointer lock and a drag-to-look fallback, wheel, multi-touch joystick / look / tap = use / hold = mine, Jump / Mine / Use / bag / pause buttons), pure gesture + key + drag logic with unit tests. Browser-checked at 1280x800, 390x844, 844x390 with CDP multi-touch. See `docs/api/player.md`. |
| `src/sim` | done, tested (64 tests) | Furnace, forging, upgrades, power networks, every machine, fission, ignition. A scripted playthrough walks clay furnace -> ignited Starhearth through the public API with survival and the objective tracker running (every objective completes, ~98 min game time). 300 entities tick in ~0.04 ms (node). Furnace/machine/network views for the UI, `grid()` and `homeFurnace()` for the HUD; `Simulation` satisfies `SimQuery` and the HUD's `UISimQuery`. API, every view field and decisions in `docs/api/sim.md`. |
| `src/player` (physics, raycast, interaction, controller) | done, tested (96 tests incl. input) | Swept-box physics (slab step, swimming, fall damage, unloaded columns are walls), DDA raycast, mining / placing / pail / screens per spec 3.6, `PlayerController` driving `IView` (bob, sprint FOV kick, held item, swing, pointer re-capture). Verified in headless Chromium with the real `World` on desktop and phone (walk, look, mine, place, use, jump). Not yet run with the real Renderer. Wiring and decisions in `docs/api/player.md` (note: centre the player on `world.spawnPoint()` with +0.5). |
| `src/ui/hud`, `src/ui/gameUI.ts`, `src/ui/screens/{slots,inventory,workbench,log,death,win}` (7.4a) | done, tested, browser-verified | GameUI (registerScreen contract), HUD, slot controller, inventory / workbench / log / death / win. Touch and mouse flows pass in headless Chromium. API in `docs/api/hud.md`. Furnace / machine screens are 7.4b. |
| `src/ui/screens/furnace`, `src/ui/screens/machines` (7.4b) | done, tested (18 tests), browser-verified | The furnace screen (header + upgrade sheet, always-visible firebox with thermometer, live flame, fuel, Light/Douse, PUMP, electric switch, status, Rest; tabs SMELT / FORGE / GRID (+ Starhearth ignition) / LOG; backpack as side column or drawer), every machine layout and the crate. Screenshotted in every brief state at 390x844, 844x390, 1280x800; tap / click flows (fuel, light, pump, smelt, collect, forge, upgrade, machines, crate) pass. **Integration: call `registerStationScreens(gameUI, sim)` once** (GameUI untouched). API in `docs/api/furnace-screens.md`. |
| `src/main.ts`, `src/app`, save document, `scripts/e2e.mjs` (7.5) | done, tested (32 tests), e2e passing | Boot flow (no-WebGL2 notice -> title -> New World / Continue -> loading with progress -> play; pause; settings persisted; save and quit), `GameState` (DOM-free session: create / restore / 20 Hz tick / toSave, node-tested round trip that continues identically), `Game` (wiring + frame loop), save document `{ settings, world }` on SaveStore (autosave every 30 s, on pause, on hide / pagehide), audio unlock + ambience feed, `window.__hw`. `npm run e2e` plays the opening on desktop, portrait and landscape phones with real input (mine 4 logs, craft, workbench, furnace, fuel, light, heat, smelt, collect, forge, death + respawn, objectives, save/quit/reload/Continue) plus a sandboxed-frame run and a no-WebGL2 run; screenshots in `test-results/e2e/`. Fixed in `src/player/input`: Chromium's bogus look movement when pointer lock starts. API in `docs/api/integration.md`. |
| Food, farming and animals - foundation (spec 12) | done, tested | Contracts in src/core (hoe, `ItemSpec.food`, role `crop`, `CreatureSpec` + `CREATURES`, events `player:ate` / `mob:*` / `crop:grew`, 8 sfx, hunger and animal constants), content (now 84 blocks, 142 items, 110 recipes, 22 machines incl. `crop`, 3 creatures with box models, 42 objectives; solver understands animals, wild plants and crops), 8 sound patches (measured in Chromium), 35 textures (farmland, crop stages, wild plants, food icons, hoes). **No behaviour yet**: hunger/eating/tilling (game rules), crop growth (sim), wild plants in worldgen, animals (src/mobs + render) are the next engineers'. API, every key and the traps they must know in `docs/api/food.md`. |

## What is left, in order

Each item has a full brief in `docs/SPEC.md`. Dependencies are in brackets. Items on the same line of the
dependency chain can be built at the same time (the spec's section 9 explains how they stay decoupled).

1. **Finish `src/game`** - spec 10.1 [core, content].
   Inventory must be able to wrap an existing plain slot array (the simulation stores machine inventories as
   plain arrays on block entities). Add survival (spec 3.4), objectives tracker (spec 2.7), index, and tests
   for everything including the files already written.
2. **Finish `src/world`** - spec 10.2 [core, content]. Deterministic worldgen with 4 biomes, caves, ore veins from
   `ORE_VEINS`, spawn guarantees; stateless 3x3-neighbourhood lighting; mesher producing the `MeshBatch`
   layout in `src/core/types.ts`; worker + pool with main-thread fallback; `World` implementing `IWorld` with
   streaming, edits, entity pinning, save/load. Review terrain with `node scripts/world-map.mjs`.
3. **Finish `src/render/textures`** - spec 10.3 [core, content]. A painter for each of the 164 `TEXTURE_NAMES`. Review
   with `node scripts/texture-sheet.mjs`. Art direction is in spec 7.2.
4. **`src/sim`** - spec 7.1 [game]. The heart of the game: furnace heat model, forging/smelting/upgrades,
   power networks, every machine, fission, Starhearth ignition. Must include the scripted playthrough test.
5. **`src/player`** - spec 7.3 [game, world]. Finish the input layer first, then physics, raycast,
   interaction, controller. Talks to the renderer only through `IView`.
6. **`src/render`** - spec 7.2 [world, textures]. Fix the failing sky test. Verify with screenshots.
7. **HUD and basic screens** - spec 7.4 / section 9 "7.4a" [game, ui kit]. Also do the kit's missing visual
   check at 390x844, 844x390 and 1280x800 and fix what is clipped or awkward.
8. **Furnace and machine screens** - spec 7.4 "7.4b" [sim, 7.4a, render icons]. The furnace screen is the
   most important screen in the game.
9. **Integration** - spec 7.5 [everything]. `src/main.ts`, game loop, save document, `window.__hw` debug
   handle, `scripts/e2e.mjs` on desktop and phone viewports.
10. **Playtest and review.** Drive the built game in headless Chromium like a player on desktop and phone;
    review the simulation against spec section 3; fix what is found. Check the first 30 minutes are
    learnable from the objective tracker alone.
11. **Deliver.** `npm run build`, then publish `dist/artifact.html` as the page with `dist/game.js` as a
    supporting file, so it can be played from a phone. Update `README.md` where the game differs.

## Things to know

- **First-wave briefs** (game, world, textures, UI kit, input) are in spec section 10; the half-written files in
  those directories were written against them.
- **Trying things in a browser:** spec section 6. `node scripts/build.mjs --dev --entry=<harness.ts>
  --out=<dir>` bundles any entry with the game's pipeline; `scripts/lib/browser.mjs` has Playwright helpers.
  Headless Chromium has WebGL2 (software, slow) and no pointer lock.
- **The published page runs in a sandboxed frame:** no alert/confirm/prompt, no downloads, localStorage may
  throw, pointer lock and fullscreen may be refused, audio only after a gesture. Details at the end of spec
  section 5.
- **Decisions already made:** drops go straight to the inventory; death keeps the inventory; no creatures;
  cable rating of a network = its weakest cable; machines push output into a touching crate; the furnace
  borrows ingredients from crates within 4 blocks; corium is hardness 120 / tier 5 (see
  `docs/api/content.md` for the content engineer's other calls, e.g. bore rig stops at tier-5 blocks).
- **Objective order:** `reach_800` now comes before `make_bronze` (bronze needs 800 C, so the old order
  completed it instantly).
- **Git:** the repository was empty, so `ccr-3c8b169f-e78nk2` is the only branch and there is no pull
  request (nothing to open one against). `.github/workflows/pages.yml` deploys on pushes to `main`, which
  does not exist yet. Several commits are checkpoints of half-written modules and do not build.
- **Checks:** `npm run typecheck`, `npm test` and `npm run build` pass for the whole repository; `npm run e2e`
  (about 6 minutes on software WebGL) drives the built game.
