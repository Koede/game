# Hearthwatt - complete handoff bundle

One file with everything needed to continue the game in a fresh session. Generated 2026-11-22T01:23Z from commit d71a41f on branch ccr-3c8b169f-e78nk2 of https://github.com/Koede/game.
Order: 0 session context (state, open decisions, follow-ups) - 1 how to start locally (setup, phases, first message) - 2 current status - 3 whole-game progression - 4 Ember plan - 5 Brewing plan - 6 Steam plan - 7 Bronze plan - 8 Distillery plan and the API notes of the newest features - 9 full design spec and build rules - 10 README.
The other per-module API notes live in the repository under docs/api/*.md and are NOT included here (read them as you reach each module).

## Contents
1. `docs/OVERHAUL_PROGRAM_STATE.md`
2. `docs/SESSION_CONTEXT.md`
3. `docs/WHATS_LEFT.md`
4. `docs/team.md`
5. `docs/CONGRUENCE.md`
6. `docs/lanes/README.md`
7. `docs/lanes/ROSTER.md`
8. `docs/advice/tech-spine.md`
9. `docs/advice/distillery-workshop.md`
10. `docs/advice/magic-and-food.md`
11. `docs/advice/world-progression-art.md`
12. `docs/advice/phone-ux.md`
13. `docs/advice/balance-economy.md`
14. `docs/advice/engineering-risk.md`
15. `docs/LOCAL_HANDOFF.md`
16. `HANDOFF.md`
17. `docs/PROGRESSION.md`
18. `docs/EMBER_PLAN.md`
19. `docs/BREWING_PLAN.md`
20. `docs/STEAM_PLAN.md`
21. `docs/BRONZE_PLAN.md`
22. `docs/DISTILLERY_PLAN.md`
23. `docs/api/sugar.md`
24. `docs/api/dev-mode.md`
25. `docs/api/distillery.md`
26. `docs/api/ground-items.md`
27. `docs/api/chainsaw.md`
28. `docs/api/handwork-front.md`
29. `docs/SPEC.md`
30. `README.md`


---

<!-- ======================= BEGIN docs/OVERHAUL_PROGRAM_STATE.md ======================= -->
# FILE: docs/OVERHAUL_PROGRAM_STATE.md

# Overhaul program - state at handoff (2026-11-21/22)

The owner asked to "overhaul each plan and step, add each feature in the plan, and make sure there is congruency amongst systems",
run as a team of advisors, architects and builders, "multilane builders with architects heading each lane", finished quickly.
This file says exactly how far that program got, so a fresh session can resume it in minutes.

## Done
| Item | Where | Notes |
|---|---|---|
| Six-age refactor (BRONZE_PLAN W0) | `4f2abb4`, `b062df1`, `5c37df5` | Ember, Bronze, Forge, Current, Atomic, Star; single-block Bronze Furnace is tier 2; hearths from tier 3; save migration v1->v2; old-save fixture `tests/fixtures/save-before-bronze.json`. 1994 tests green when verified. |
| Congruency audit | `docs/CONGRUENCE.md` | systems matrix, conventions sheet, contradiction list, streams A-G, cross-stream ideas, playtest checklist. |
| Seven advisor dossiers | `docs/advice/*.md` | tech-spine, distillery-workshop, magic-and-food, world-progression-art, phone-ux, balance-economy, engineering-risk (about 3,400 lines, builder-ready task lists with file ownership and acceptance checks). |
| Team file and lane protocol | `docs/team.md`, `docs/lanes/README.md`, `docs/lanes/ROSTER.md` | working agreement, gates, collision rules, roles. |
| Foundation step R10 | `1a74ab6` | `.gitattributes` eol=lf. |
| Foundation step R4 | `d71a41f` | `WorldSave.rev` migration chain (six-age folded in), alias table, rolling `.prev` backup, golden-save manifest. 2005 tests green. |

## Partial / not started
- **Foundation steps R1 (block-id lock + folder registration), R2 (content-test roster refactor), R3 (move Workshop/Magic/Vehicles persistence into
  `GameState`), R9 (lane tooling, e2e `--out`, pinned playwright, perf project)**: spec in `docs/advice/engineering-risk.md` sections 2-5. The foundation
  session was asked to stop at a green state and write `docs/lanes/FOUNDATION.md` with the exact remainder; read that file first if it exists.
- **Seven lane architects (A steam/Bronze, B distillery, C workshop, D magic, E food/brewing, F world/art, U phone UX) never started**: Claude Desktop refused to
  start worktree sessions until the owner clicks **Trust repository** for `E:\Projects\game`. Nothing was lost; their briefs are reproduced by the protocol
  (`docs/lanes/README.md`) plus the dossier named for each lane in that file. The lane branches `lane/a` .. `lane/u` do not exist yet.
- Builders, the integration lane (apply `balance-economy.md` numbers, playtest checklist), the fresh-eyes review and the final republish: not started.

## How to resume (fastest path)
1. Click Trust for the repo in Claude Desktop (or run lanes as ordinary sessions on the shared checkout using the `.gate-heavy` lock and disjoint files).
2. Finish the foundation first (R1, R2, R3, R9; see FOUNDATION.md), serially, one session, because every lane touches the block ids, registries and saves.
3. Start the six lanes + U in parallel from the dossiers: per lane an architect writes `docs/lanes/<x>.md` (contract, task cards, file ownership), then builders
   implement; the coordinator verifies each lane (tsc, full vitest, the lane's e2e with `HW_GPU=1 HW_DIAG=1`) before merging; whoever wrote code never certifies it.
4. Integration lane: balance numbers, full e2e chain, playtest checklist (`CONGRUENCE.md` section 7, `world-progression-art.md` section 7); then a fresh-eyes review;
   then rebuild, `bash scripts/make-handoff-bundle.sh`, and ask the owner before pushing / creating `main` (publishes the game page).

## Verified state when this was written
`npx tsc --noEmit` clean and the unit suite green at the last commit the coordinator verified (1994 passed after the refactor, 2005 after R4 per the foundation
session's report). The full e2e chain has NOT been run end to end since the six-age refactor: the main e2e had two flaky steps (mining with ground items,
sandbox restore), the rest was not run. Run `HW_GPU=1 HW_DIAG=1 npm run e2e` first.

<!-- ======================== END docs/OVERHAUL_PROGRAM_STATE.md ======================== -->


---

<!-- ======================= BEGIN docs/SESSION_CONTEXT.md ======================= -->
# FILE: docs/SESSION_CONTEXT.md

# Hearthwatt - session context (read this first)

A snapshot of where the cloud session stood when it was handed off, written for a fresh session on another machine.
Authoritative detail lives in `HANDOFF.md`, `docs/PROGRESSION.md` and the plan files; this file says what was in
flight, what is known to be broken, and every open decision. Generated from the repository; see `git log`.

## 1. The project in one paragraph
Hearthwatt is an original first-person voxel sandbox for the browser (TypeScript + three.js, esbuild, vitest),
played mostly on a PHONE. The furnace is the heart of the base: it smelts, forges, warms, respawns you, and
upgrades through tiers that open the next age. About 250 commits on branch `ccr-3c8b169f-e78nk2` (the only
branch; no base branch exists, so no PR). Released artifact v3 = commit 2c247eb; Codex reference page published
separately. Roughly 1,600 unit tests and four chained end-to-end scripts (`npm run e2e`).

## 2. What is built and released (commit 2c247eb and before)
Procedural world with six biomes incl. marsh, flowing water with source blocks and buckets, caves, ores, ruins
(Old Works) with loot, day/night with moon phases and weather, hunger and food, farming, animals, cooking in the
furnace, the five-tier furnace with multiblock hearths, power networks and every generator through fission and
the Starhearth ignition, item and fluid pipes with a wrench, a full HUD and every screen at phone sizes,
synthesised sound, saving, and the Emberbound hostile automatons' data, AI, combat rules and safe zones.

## 3. State at handoff (all cloud agents have landed; after 2c247eb)
Everything below is merged on the branch. Check `docs/api/<name>.md` and `git log --oneline -40`.
- Emberbound: data, AI, visuals, UI hooks, wiring done; `scripts/e2e-ember.mjs` passes 9/9 desktop and phone.
- Brewing (tea/coffee): data, sim, buffs, meshes/effects, UI/controls done. The boil ambience layer is silent until `src/app/ambience.ts` sets `state.boil`.
- Ember handwork: data layer, station sim, casting sim, front end done; `scripts/e2e-handwork.mjs` 8/8. Casting deviations: alloy pot is an ITEM in a crucible slot (the alloy_pot block is unused); Casting Bench and hand-taking molten metal NOT built.
- Codex generator: done. Steam plan rewrite for the Bronze Age: done (plans only).
Known red at handoff: `src/sim/playthrough.test.ts` (Star Age "banks charged", engines ~24 kW vs 27 kW load; needs steps for
mortar/clay table/loom/rack/trough); a few load-sensitive timing tests (mesher, persistence, hostileWorld, flow, perf);
full `npm run e2e` stops at e2e.mjs "crafts planks and a workbench in the inventory screen" (plank is now a station recipe),
so e2e-features (24/24 alone), e2e-tech (14 ok, 2 fail: clay furnace "lit through its screen" click; glowcap tint on hen)
and e2e-ember (9/9) are not reached by the && chain. First job: make `bash scripts/local-check.sh --e2e` green.

## 4. Decisions made by the owner (do not relitigate)
See docs/LOCAL_HANDOFF.md section 2 and the quotes in BRONZE_PLAN section 1 / STEAM_PLAN section 9. In short: six
ages; Ember = pure handwork, no steam/machines/electricity; Bronze begins steam (kettle, rotor, shafts, speed and
stress) then heat rods, the boiler MULTIBLOCK, pressure, air, vacuum-drawn Bronze Chute; Bronze Furnace is a
single block; Forge = iron, steel, heavy industry, dynamo at the END; modern steam turbine (Current) converts
steam straight to electricity; the furnace upgrade list is visible from minute one and opens each age; tea and
coffee = six varieties with their own boosts, regrowing bushes, boiling water from any container or the Kettle Pot;
water flows and buckets take source blocks only; workbench also offers every hand recipe.

## 5. Open decisions (owner has not answered)
1. Star hearth: 93 casings - keep or reduce?
2. Brewing: `six_cups` ("Taste them all") blocks the strictly sequential goal line - make it an optional side goal (needs a tracker change). Recommended: yes.
3. Cup and cone: RESOLVED in code - the forge recipes were deleted, the Clay Table route is the only one.
4. Alloy pot: item-in-crucible (built) vs the alloy_pot block touching a furnace (data only). Pick one and delete the other.

## 6. Known gaps and follow-ups (collected from every engineer's report)
- sim: berry_bush regrowth (role 'bush', regrowS 300) - fit into CropField as one-stage family; exclude from machineAt/machineView
- weather: rain hydration via isHydrated() in src/sim/cropRules.ts (ctx.raining && c.sky)
- rules: crop whose farmland is removed stays without growing - decide pop-off
- sim: steam engine draws heat when idle (draw by actual use)
- ui: food meter + Well-Fed indicator on HUD (player.food, player.hungry, player.wellFed, survival.hunger); "+N food" in tooltips/recipe rows; Kitchen chip in furnace recipe list
- wiring: animal under crosshair gets priority before Interaction.use (feed with liked item; potatoes/carrots otherwise eaten)
- wiring mobs (docs/api/mobs.md steps): GameState create+tick after sim; save doc; MobRenderer update before Renderer.render; Mine/Use on animal under crosshair (feed priority); HUD target name hook setTargetName; drops -> player.give; tool wear helper for hits (PlayerState lacks wear-without-block)
- render: texture layers ~252 of WebGL2-guaranteed 256 -> check MAX_ARRAY_TEXTURE_LAYERS / split atlas
- render: glowcap/crystal need cool emissive colour (only warm block light now)
- player: lava scooping/pouring with bronze bucket; using bucket on tanks
- render/audio: steam particles + hiss above steam vents; oil texture repeats visibly over big pools
- note: crates no longer pin chunks (world features engineer changed spec 5 rule)
- render part 2: items/fluids moving in pipes (sim render snapshot), pipe carrying tint, wrench-parted joints hidden by mesher (needs sim state -> voxel variant?), formed hearth molten pool + ghost preview + problem highlight
- render: steam engine flywheel always on +X flank (hidden against walls)
- render: held item/particle light probe ignores cool light colour
- content: 256-layer cap test can be raised now
- wiring (after wire:animals): player wrench -> sim.wrench(x,y,z,dir); bucket on tank/fluid endpoint -> sim.bucketUse before machine screen; empty-hand Use on pipe -> ui:open pipe; e2e for hearth formation + pipes
- balance: Star hearth 93 casings is heavy (~45 of 165 game min) - consider cheaper casings or smaller shell
- note: pump drains farthest first; pumps/bore rigs start in pull mode
- ui-10: UI size setting (Normal/Large) - Settings field + touch captions 10px + hotbar <44px
- ui-13: pump status wording when a pulling pipe is attached (src/sim/fluidMachines.ts)
- sim-7: Structure tab should show shift offsets / machines list / note
- sim-3: boiler/turbine hint texts 'wrench the boiler end to Pull' (content)
- ember wiring: combat.setDifficulty from settings; mob hooks damagePlayer->combat.takeHit + knock (never both paths); death screen killerLine; HUD burning indicator; useHostileHooks({safeZones: sim}); stunS in mob hit
- ui: Structure tab shift buttons (target.shiftLeft/Right), machines list, note
- steam plan: mech_pump recipe names item_pipe (Bronze Chute) - probably meant fluid_pipe; decide at content time
- names: brewing owns kettle_pot / machine 'kettle' / KETTLE_*; steam plan uses copper_kettle / COPPER_KETTLE_*
- W0 (six-age refactor) DONE 2026-11-21: six furnace tiers and ages, Bronze Furnace = tier 2 (single block), hearths from tier 3; see `docs/api/ages.md`
- brewing: six_cups gates strictly sequential tracker -> make optional side goal (src/game objectives tracker change)
- brewing vs handwork: clay_cup/drip_cone forge recipes vs Clay Table unfired cups - decide (recommend keep Clay Table only)
- brewing not done: crusher recipes for ground coffee; interaction.ts must call brewUse/placeContainer; UI target name from brewView().text
- handwork: playthrough stops at play.smelt('tin_ore'): molten copper blocks crucible -> playKit.smelt must pour/cool cast metals (casting engineer)
- handwork: STAND-INs for bronze/maul/pickaxe heads (casting replaces); mortar/clay table/loom/rack/trough lack playthrough steps; new objectives (place_chopping_block...) not in objectives.ts yet
- handwork: handwork-content.md says per-station machine kind/params; real code uses one kind 'hand' keyed by block key - doc mismatch
- handwork: rack under glass keeps running (glass = open sky) - confirm intent; rain via real weather object untested

## 7. Work order from here
1. Triage red tests (section 3); finish the unfinished agent pieces (brewing meshes/UI, handwork data/casting/front end, Emberbound UI + e2e-ember); fix the scripted playthrough (`src/sim/playthrough.test.ts` stops at `play.smelt('tin_ore')` because molten copper from casting blocks the crucible - `playKit.smelt` must pour or cool cast metal).
2. Add `scripts/e2e-brewing.mjs` and `scripts/e2e-handwork.mjs` (real input; `window.__hw` only for setup) and chain them in the `e2e` npm script. Full run green; rebuild; republish the game artifact.
3. Six-age refactor (BRONZE_PLAN W0): **done** (fixture `tests/fixtures/save-before-bronze.json`, save version 2 migration, `furnace_bronze`, renumbering; gate table in `docs/api/ages.md`).
4. Steam first half of Bronze (STEAM_PLAN), then Bronze second half (BRONZE_PLAN B1-B4).
5. Review pass as a phone player; republish game and Codex (`npm run codex`).

## 8. How the cloud session worked (so you can reuse what helped)
- One task per run with a plan section; disjoint directories when running agents in parallel; contract/API note
  committed first so dependents can build on it; every agent commits only its own paths and pulls with
  `--no-rebase` on a rejected push. The cloud environment's hook forces frequent "Checkpoint" commits.
- Browser checks: build to a scratch dir (`node scripts/build.mjs --out=<dir>`), drive with `scripts/lib/browser.mjs`
  and `window.__hw` (docs/api/integration.md); LOOK at screenshots.
- Usage: twelve parallel agents on four cores was fast but expensive and flaky; prefer 2-4 at a time and full gates
  between phases. Phone taps can read as holds under load - rerun a failing e2e step alone.
- Local setup: `bash scripts/local-setup.sh`; gate: `bash scripts/local-check.sh [--e2e]`.

## 7. Follow-ups from the last landings (handwork, brewing UI/render, casting, front end, Emberbound wiring)
## Handwork data layer landed (0871973)
- playthrough.test.ts fails in Star Age at "banks charged" (engines ~24 kW vs 27 kW load) - unproven whether handwork-related; check on unchanged tree.
- inventory.ts fullDurability must read mould.pours.
- item:made must be emitted when a hand-station output is taken (grind_flour etc.).
- Brewing coffee/tea grinding still at workbench; move to quern/rack (station keys ready).
- e2e scripts still assume hand-crafted planks and instant bronze tools - need updating.
- Bronze head textures read as gold blobs; six new sfx unlistened.
- Deviations documented in docs/api/handwork-content.md section 10.

## Brewing UI landed
- Full npm test: mesher perf, persistence perf (load flakes), content/food.test.ts potato crop stage ids (check).
- Boiling pail seconds-left lost when Inventory.add / spill (inventory.ts only keeps durability for tools) - fix in inventory.
- Target text shows "Loaded with  - ..." when cup drink unset (stand-in only, verify with real brew).
- No next-step hint from held item; Well-Fed chip not seen in real flow.

## Casting landed
- Suite: 1694 pass / 2 fail (playthrough "banks charged"; mobs/persistence timing). npm run e2e not run: breaks early on removed plank hand recipe.
- DEVIATION: alloy pot is an ITEM in a crucible slot (pour cold cu/tin ingots; 800C, 8s -> 4 molten bronze). alloy_pot block + bronze_ingot_alloy recipe remain in data but nothing runs them. Decide: block version or drop block.
- NOT BUILT: Casting Bench; hand-taking molten metal for anvil hot work (openHotWindow still fires on cast:poured).
- smelt_copper objective completes at the pour, not at smelt.
- playthrough needs steps for mortar, clay table, loom, rack, trough (handwork's); alloy-pot row not screenshotted.
- inventory.fullDurability now reads mould.pours (done).

## Hand front end landed
- Suite 4 fail/1692: hostileWorld, persistence, mesher (timing under load), playthrough. food.test.ts failed earlier (recheck).
- scripts/e2e-handwork.mjs added and chained into npm run e2e (8/8 phone+desktop); full npm run e2e NOT run.
- Gaps: casting bench/alloy pot no animation; flash is tinted plate (no glow channel); parts cull beyond 64 blocks; handwork.md says input/output but entity has slots[input,output]; anvil label doesn't name plate vs wire; first-run coach mark eats first taps in scripted portrait runs; collision/aim still whole cell.

## Brewing meshes/render landed
- src/app/ambience.ts must set state.boil ~ 1-clamp((dist-2)/14) for nearest boil_bucket boiling:true or active kettle; else 0 (layer silent until then).
- Not seen in browser: boiling-bucket steam/shimmer (sim never boiled test bucket), drips, done-cup steam. Liquid ring ~1/16 wide, few px on phone.
- Chromium OOM-killed under shared cgroup; e2e-tech only desktop.
- Recheck: stationShapes.test.ts 0.9375 vs 1 bounds; textures.test.ts (chopping_block_side painter, clay_cup flatness).

## Emberbound wiring landed
- e2e-ember 9/9 desktop+phone; e2e-features 24/24. Full npm run e2e FAILS: e2e.mjs "crafts planks and a workbench in the inventory screen" (plank now a station recipe) - && chain stops so features/tech/ember not reached.
- e2e-tech: 14 ok, 2 fail: clay furnace "lit through its screen" (bag slot click timeout), glowcap tint on hen aCool 0 (mob material changes in src/render/mobs).
- playthrough.test.ts only unit failure (Star Age "banks charged").
- Hearth Structure tab shift buttons / "In the way" list: no tests, not seen in browser.
- Chromium OOM-killed at load ~20+ (environment).

## 9. Local session on the owner's machine (2026-11-21): what happened since the cloud handoff

Where: the repo now lives at `E:\Projects\game` (a DiskOrganizer script moved it from `C:\Users\admin\game`; that path is
now a junction to E:). One branch only, `ccr-3c8b169f-e78nk2`; at the time of writing it is ~30 commits AHEAD of origin
and nothing is pushed. There is NO `main` branch; `.github/workflows/pages.yml` deploys on pushes to `main`, so creating
it publishes the game page: owner has not decided (ask first). All work was done by several Claude sessions sharing ONE
checkout (no worktrees): only one session should run `npm run build`/`npm run e2e` at a time (they share `dist/`).

Machine: Windows 11, Ryzen 5 5600X (12 threads), 16 GB RAM, RTX 3060 12 GB, Node 24, Python 3.11 (+torch CUDA, numba).
Run everything locally; the owner is usage-limited and wants output trimmed and no sub-agent fan-out.

### Tooling added
- `HW_GPU=1` (scripts/lib/browser.mjs) makes the e2e Chromium render on the real GPU (ANGLE/D3D11) instead of SwiftShader.
- `HW_DIAG=1` writes `test-results/diag/*.jsonl` (console, HTTP >= 400 with URL, step timings, state snapshots, screenshot
  per failed step, driver/mining/placement events); read it with `node scripts/lib/diag.mjs summary`.
- In the game: `?diag=1` (or `window.__HW_DIAG__ = true`, or `localStorage.hwDiag='1'`) turns on `window.__hwDiag`, a ring
  buffer of save/load/phase/frame events (`src/app/diag.ts`). Off by default, near-zero cost.
- Playing it: `node scripts/build.mjs --serve` serves http://localhost:5173 on all interfaces (phone: http://<LAN IP>:5173).
  Pointer lock works in a normal browser window; it is REFUSED (WrongDocumentError) inside automation-driven windows and
  the Claude desktop browser pane (the game falls back to drag-to-look). Test lock in the owner's real browser only.

### Features landed (each has docs/api/<name>.md and tests)
- Handwork front end (Use on a station calls `sim.stroke`; chopping block, quern, anvil, rack, trough, loom, clay table,
  mortar, alloy pot, casting) - upstream's `src/player/handTools.ts` is canonical; planks now come from the Chopping Block.
- Ground items (`docs/api/ground-items.md`): drops are world entities that rotate and are picked up by proximity; Q drops
  (Shift+Q the stack); Hand Vacuum Pump (Bronze-by-design item, pulls items from 9 blocks) built on a small
  `COLLECTORS` mechanism so the planned Electric-age electromagnet is one more definition.
- Leaf decay (leaves cut off from every log fall away after a random delay), Chainsaw (`docs/api/chainsaw.md`, fells a
  trunk, fuel tank in durability, Current Age), Tractor (`src/vehicles`, tiller and harvester attachments, F to work).
- Resin, sugar and sweet baking (`docs/api/sugar.md`): glass beakers; Use a beaker on a pine log taps sap; boil to
  resin, distil with water to sugar (furnace forge rows returning beaker/bucket); cookies, bun, cake. Eating sugar starts
  **Sugar Rush**: +12% speed while the Well-Fed timer burns 2.5x faster (hunger itself unchanged).
- Dev Mode (`docs/api/dev-mode.md`): Survival | Dev choice on the title screen; creative item menu, no damage/hunger/wear,
  mode stored in the save. Old saves load as survival.
- Glass distillery first slice (`docs/DISTILLERY_PLAN.md` section 15, `docs/api/distillery.md`): mixture model, modular
  chem blocks, rig scan, stills/columns, fermenting, liquid animation, gasoline/diesel fuel for chainsaw and tractor.

### State at the time of writing
- `npx tsc --noEmit` clean; `npx vitest run`: 1865 passed / 0 failed (158 files) - verified by the handing-off session.
- E2E (`HW_GPU=1 npm run e2e`): the e2e session reported desktop, phone, features, handwork (all stations), tech, ember,
  ground, vehicles, dev and distill passing; the full chain was NOT re-run end to end by the handing-off session after the
  last merges. Run it before trusting it. The sugar chain, tractor, chainsaw and distillery have not been played by hand.

### Known gaps / next steps (in order)
1. Re-run `HW_GPU=1 HW_DIAG=1 npm run e2e` and the browser smoke test; then decide on pushing / `main` (see above).
2. Distillery left-list: rig screen + ghost previews, ground burner, reflux head, lubricant and bitumen/asphalt, potions,
   tank support for the new fluids, shaft hooks (see DISTILLERY_PLAN section 15).
3. Casting Bench block is still inert (pouring happens at the furnace); sap-tap state is not saved and has no animation.
4. Roadmap: six-age refactor DONE; next Steam first half, Bronze second half (BRONZE_PLAN B1-B4), review pass, republish game and Codex.
5. Owner decisions still open: Star hearth 93 casings; make `six_cups` an optional side goal; delete the cup/cone forge
   recipes in favour of the Clay Table; push to GitHub / create `main`.

### Lessons from running several sessions in parallel
- Give each session disjoint files, tell it to re-read shared files before editing and to commit only its own paths;
  commit often so a merge is never under uncommitted edits. Pause every session before merging upstream (a merge with
  3 sessions editing was resolved by ONE session that knew both sides; upstream versions were canonical where they overlapped).
- E2E tests that hold items or build things drift whenever content changes: fix stale scripts, but a failing step can be a
  real game bug (the handwork front end was missing entirely and only the e2e showed it).

## 10. Overhaul session (2026-11-21): Essentia & Research, Bronze workshop

Plan: `docs/OVERHAUL_PLAN.md` (A = Create-style workshop parts for the Bronze era, B = original research magic). Owner steer
mid-session: "fill that whole era in with goodies and trinkets and fun modular things" and "implement all of them after".
Commits: fcc7260 (plan), 850c16e (aspects/fingerprints/research/content), 44c8bfe (magic runtime + notebook), 7ad0d55
(e2e-magic), a29366a (workshop), then e2e-workshop and docs. API notes: `docs/api/magic.md`, `docs/api/workshop.md`.

Built and checked (unit tests + `e2e-magic` / `e2e-workshop`, desktop and phone portrait, HW_GPU=1; full `npx vitest run`
green at 1898 tests; the full `npm run e2e` chain was NOT re-run):
- Every block and item has an aspect fingerprint (21 aspects, one data table). Field notebook scans blocks/carried items,
  teaches aspects and lore; a 5 x 5 kin board per research entry (7 entries); research gates the glass vial, gathering rod and
  essentia jar recipes; the rod fills vials from the land's aspects (chunk draw recovers); jars hold 32 units; a Vial of
  Cinder adds burn to a burning furnace after research.
- Bronze workshop: hand crank, drive shafts, conveyor belts (move ground items), mechanical saw / millstone / stamp mill /
  power loom (same recipes as the hand stations), speed and stress with overstress, Engineer's Goggles readout.

Important: the STEAM_PLAN shaft core does not exist in code; the workshop is its own small kinetic layer (crank-driven) with an
`extraRpm` hook for the shaft core later.

Left, in priority order (OVERHAUL_PLAN work lists A.11 and C):
1. Render: jar fill level, belt item motion looks right but belts do not animate their texture direction; crank handle turning.
2. Workshop A.4/A.5: funnels with filters, depots, chutes, basin + press + mixer, spout and item drain (distillery bottling).
3. Workshop A.2 transmission and trinkets once the shaft core lands: reverse/ratio/differential/clutch/sequence, shear pins,
   governor, lubricant can (distillery lubricant), wind vane, bell, tally board, metronome and the signal layer.
4. Workshop A.7 deployer and mechanical arm (reuse Interaction with a machine actor), reaper; A.8 rail skiff, bearing (stretch).
5. Magic B.3-B.6: wellsprings, essentia tubes on the fluid-pipe machinery, rune desk with aspect costs, infusion altar,
   vial-in-still trace (entry exists), aura reading, foci, clay servants, more entries for Bronze/Forge.
6. Cross-cutting: Codex aspect page and planned items, optional side objectives (scan_ten, first_research), sounds
   (scan_chime, essentia_pour, rod_hum), workbench/forge rows should show "needs research" instead of failing on craft.
7. W0 six-age refactor: done (`AGE_INDEX` edited; the magic Bronze pieces are `forge(2, ...)` at the Bronze Furnace).

## 11. Workshop session (2026-11-21): Create-style Bronze workshop, second slice
See `docs/OVERHAUL_PLAN.md` "Status update, workshop session" for what exists and what does not, and `docs/api/workshop.md` for the
rotation rules, the logistics pieces and the stable machine interface (`offer/take/crank/act`) the magic constructs use. Tests:
`src/workshop/{kinetics,logistics,workshop}.test.ts`; `scripts/e2e-workshop.mjs` (mixer+funnel+depot, drill+reverse+arm) is chained
in `npm run e2e`. Shared-file edits: `app/game.ts` (renderer, generatorWatts, actHook), `content/objectives.ts` + `specRoster.ts`
(six goals after salvage_automaton), `render/textures/painters.ts`. Stress numbers (arm 3, drill 6, deployer 6, mixer 6, press 8)
are in `workshop/kinetics.ts` BASE_STRESS; one crank carries 8 su, so a drill plus an arm wants two cranks.

## 12. Essentia & Research completed (Part B, 2026-11-21)
Commits f75507d, bee8a1a, d1d3956, bdd0493 (plus the earlier 850c16e, 44c8bfe, 45f7f88). API: `docs/api/magic.md`.
Built and checked (unit tests, `e2e-magic` desktop + phone with screenshots looked at, Codex preview clean):
- 24 research entries across Ember / Bronze / Forge with varied boards; lore from scans (x1.5 with the Scrying Lens) and from
  studying vials; hints; notebook tabs Research (grouped by age), Aspects, Notes, Goals (eight optional side goals).
- Rods with tiers (charge 16/32/64, draw 1/2/3), charging for foci; wellsprings (seeded, tappable, refill) with a crystal render;
  aura reading under the crosshair; compound drawing at Forge.
- Jars and void jars with visible fill, glass tubes joining jars to the desk, the altar, furnaces and servants.
- Rune Desk screen (7 arcane recipes with essentia costs), Infusion Altar with pedestals (4 infusions incl. alchemical steel).
- Foci: Kindling (lights a furnace), Light (floating light block), Warding (halves damage 30 s), Blinking (8-block step).
- Clay servants crank workshop hand cranks while fed Spring (through `Workshop.crank`); hearth siphon; Clarity takes water
  out of distillery flasks; Cinder vials stoke fires; vials double as beakers; glass boils on its own on a furnace top.
- Six new synthesised sounds; Codex Essentia tab; progression solver covers desk and altar rows; content tests green.
Left (small): spark/soul/void only via late blocks; tubes are not fluid pipes; desk loses the rest of a partly used vial; foci
have no hand animation; magic goals live in the notebook, not on the main objective track (the tracker is strictly sequential).

Update (same session, third slice): see docs/api/workshop.md "Third slice". New files: `workshop/{signals,contraption}.ts`, `ui/screens/workshop/`,
`workshop/{parts,signals,contraption}.test.ts`. `parts.test.ts` exports the `setup()` fixture the other workshop tests reuse. Game hooks set in
`app/game.ts`: generatorWatts, actHook, standingOn, tractors, fluidBlock, clockText; goggles on empty air open the guide.

<!-- ======================== END docs/SESSION_CONTEXT.md ======================== -->


---

<!-- ======================= BEGIN docs/WHATS_LEFT.md ======================= -->
# FILE: docs/WHATS_LEFT.md

# Hearthwatt - what is left to do (2026-11-21)

One place for everything still open, in priority order. Detail lives in the linked notes. State at the time of writing:
`npx tsc --noEmit` clean, `npx vitest run` 1988 passed / 0 failed (171 files), everything committed. The e2e scripts of the
new features (magic, workshop, distill, dev, ground, vehicles, handwork) were reported passing by their sessions, but the
WHOLE chain (`HW_GPU=1 HW_DIAG=1 npm run e2e`) was not re-run end to end after the last merges. Nothing in the newest
features (sugar chain, tractor, chainsaw, distillery, essentia magic, workshop) has been played by hand yet.

## 0. First (verification)
1. Run the whole e2e chain on the GPU (`HW_GPU=1 HW_DIAG=1 npm run e2e`, read `node scripts/lib/diag.mjs summary`) and fix what is red.
2. Play every new system on desktop AND phone (Dev Mode gives a creative item menu): notebook scan and research board,
   gathering rod and jars, hand crank + belts + gearboxes, mixer/press/basins, contraptions and the skiff, sap tapping and
   the sugar chain, tractor and chainsaw, distillery spirit and oil runs. Look for feel, readability and balance problems.
3. Owner decisions still open: Star hearth 93 casings (keep or reduce); make `six_cups` an optional side goal; delete the
   cup/cone forge recipes in favour of the Clay Table; whether to create `main` (pages.yml deploys the game on pushes to `main`).

## 1. Roadmap spine (unchanged)
1. ~~Six-age refactor (BRONZE_PLAN W0)~~ **DONE**: old-save fixture, renumbering, save version 2, the single-block Bronze Furnace; every gate is in
   `docs/api/ages.md`. What it leaves: the Blast hearth still needs no Blast Nozzle (BRONZE_PLAN B1), the `OVERHAUL_PLAN` age tables
   use the old numbers (names are fine), and nothing has been played by hand on a phone yet (Dev Mode lists `furnace_bronze`).
2. Steam first half of Bronze (STEAM_PLAN), then Bronze second half (BRONZE_PLAN B1-B4); several workshop pieces already stand in for it.
3. Review pass as a phone player, republish the game artifact and the Codex (`npm run codex`).
4. Electric age: the electromagnet is one more definition in `src/game/collectors.ts` (the vacuum pump's collector mechanism).

## 2. Workshop (Create-style) polish - `docs/api/workshop.md`, `docs/OVERHAUL_PLAN.md`
Smooth tween animation of moving structures; riding the skiff; tame animals on the treadwheel; a vacuum pump hookup;
continuous spouts from pipes (today spouts and drains work with buckets and canisters); punched gearshift cards (three
presets today); item vault multiblock growth; trinkets (wind vane, weather cock, spyglass, horn, padlock chest, lantern
chain); belts that cross structure borders automatically.

## 3. Magic (Essentia and Research) - `docs/api/magic.md`
spark / soul / void as drawable aspects (only via late-block overrides today); golems that walk (clay servants run workshop
cranks only); an aura HUD dial; tubes are their own network, not fluid pipes; the rune desk loses the rest of a partly used
vial; more research entries beyond the 24, deeper Forge-age tiers; balance and a music/sound pass.

## 4. Distillery - `docs/DISTILLERY_PLAN.md` section 15, `docs/api/distillery.md`
Rig screen and ghost previews; ground burner (charcoal or fuel ethanol without a furnace); reflux head and filter bed; lubricant
from residue (vacuum cap) and the chainsaw bar-oil consumer; bitumen and asphalt road blocks with a speed effect; potions
(essences, tinctures, elixirs tied to the brewing buffs), drinks and the antiseptic bandage; tank support for the new fluids and
pipes out of a receiver into tanks end to end; shaft hooks (stirrer, lubricant stress); catalyst bed, pressure cap, cracker and
the refinery tower multiblock; a `distill:step` event, own sounds, a Codex progression branch, a balance pass.

## 5. Handwork, brewing, food - `docs/api/handwork*.md`, `casting.md`, `sugar.md`
Casting Bench block is inert (pouring happens at the furnace); hand-taking molten metal for anvil hot work (the hot window
opens on `cast:poured`); sap-tap state is not saved and the tap has no animation or particles; a boiling pail's seconds-left
is lost when moved by `Inventory.add`/spill; more baked goods and a sugar-aware brewing/alcohol tie-in; the clay table/cup
decision above.

## 6. Smaller known gaps (collected from every session's report)
Rack under glass keeps running (confirm intent); crops whose farmland is removed stay without growing; steam engine draws heat
when idle; UI size setting (Normal/Large); Structure tab shift buttons and machines list; pump status wording; boiler/turbine
hint texts; the steam-plan item names (copper_kettle vs kettle_pot, mech_pump recipe item). See `docs/SESSION_CONTEXT.md` section 6.

## 7. Process notes for whoever continues
- Run everything locally; `HW_GPU=1` renders e2e on a real GPU, `HW_DIAG=1` and `?diag=1` give diagnostics (`docs/SESSION_CONTEXT.md` section 9).
- Several sessions shared one checkout: give each disjoint files, commit often, and use the `.run-lock` mutex folder before any
  `npm run build` or e2e (they rebuild `dist/`). Pause everything before merging upstream.
- Pointer lock is refused in automation-driven browser windows; test the real cursor in a normal browser.
- Regenerate the handoff bundle with `bash scripts/make-handoff-bundle.sh HEARTHWATT_COMPLETE_HANDOFF.md`.

## 8. Known e2e flakes seen after W0 (not furnace-related)
`node scripts/e2e.mjs` (GPU): "mines four logs by holding Mine" (phoneLandscape, pack held 2 logs) and, in the sandboxed-frame run,
"save and quit keeps the world in memory; Continue restores it: inventory not restored from memory" (a pickup lands between the two
state reads). Both are timing in the real-input mining steps; the Bronze upgrade step and the furnace/hearth steps passed on all devices.
The rest of the e2e chain (features, tech, ember, handwork, ground, vehicles, dev, distill, magic, workshop) was NOT run after W0.

<!-- ======================== END docs/WHATS_LEFT.md ======================== -->


---

<!-- ======================= BEGIN docs/team.md ======================= -->
# FILE: docs/team.md

# Hearthwatt - team and working agreement

Who does what on this project, how work is dispatched and accepted, and what each worker has actually proven. Maintained by
the coordinator (the owner's main Claude session). Machine: Saturn (Windows 11, 12 threads, 16 GB, RTX 3060). Workers are
Claude Code desktop sessions started by the coordinator; no other agent CLI (Codex, agy, kiro, opencode) is installed here.

## Working agreement (set by the owner, 2026-11-21)
- **Cadence: continue.** The owner said "just do it all": the coordinator keeps dispatching and accepting without asking
  between tasks. Ask the owner only for: pushing/creating `main` (publishes the game page), destructive actions, and
  decisions listed in `docs/WHATS_LEFT.md` section 0.
- **Execution: parallel streams, disjoint files.** Every stream has an owner and a file list (from `docs/CONGRUENCE.md`).
  The six-age refactor is the one exclusive phase: nobody else edits while it runs.
- **Usage: local and lean.** Everything runs on Saturn; workers read trimmed output; no sub-agent fan-out inside a worker.
- **Shared resources:** `dist/` and the e2e chain are guarded by the `.run-lock` folder (`mkdir` to take, `rmdir` to release).
- **Notification channel:** the desktop app notes the coordinator when a session ends a turn; nobody polls.

## Roles
| Role | Who | Notes |
|---|---|---|
| Coordinator | main session (this conversation) | splits work, dispatches, verifies, decides; never delegated |
| Plan/audit author | read-only audit session (docs only) | `docs/CONGRUENCE.md`; the coordinator reviews, does not rewrite |
| Executors | one session per stream (A Steam/Bronze, B distillery, C workshop, D magic, E food/brewing, F world/progression) | one stream's files per session |
| Integration + playtest | a separate session from the stream authors | stream G: final seams, playthrough checklist |
| Adversarial reviewer | a session that did NOT write the code under review | per phase, before the coordinator signs off |

**Rule: whoever writes the code does not certify it.** After every worker reports, the coordinator re-runs
`npx tsc --noEmit`, `npx vitest run`, and the relevant `HW_GPU=1 npm run e2e` steps itself and reads the diff/commit list,
never the worker's summary. A task is Done only after that. Reports are leads, not evidence.

## Acceptance gates (each stream, before the next dispatch that depends on it)
1. Typecheck clean and the full unit suite green (coordinator-run, pasted counts).
2. The stream's e2e script passes on desktop and phone portrait with `HW_GPU=1`; screenshots looked at.
3. Solver still completes the game from a fresh world; roster/Codex fixtures updated; docs/api note written.
4. Committed (only the stream's own files), nothing left uncommitted, no stray files in `C:\Users\admin\game`.
5. For risky areas (save migration, tier gating, shared sims): an independent review session before merge.

## Observed capability (with evidence)
| Worker kind | Did well | Failed / needed correction | Last used |
|---|---|---|---|
| Feature session (Opus, auto mode) | Distillery slice (5 commits, 1865 tests green, e2e-distill); Essentia magic (24 research entries) and the Create-style workshop built to a plan with tests and e2e; Dev Mode with creative menu | Reports of "done" overstated twice: handwork front end was missing until an e2e step exposed it; e2e green claims need re-running | 2026-11-21 |
| Merge-conflict session (hand-stations) | Resolved a 16-file, ~40-hunk merge against upstream cleanly with typecheck green | Needed an explicit rule set (upstream canonical where overlapping) | 2026-11-21 |
| Unit-test session | Took 13 failures to 0 without loosening assertions (`4460f87`) | none observed | 2026-11-21 |
| E2E session | Made the chain green on the GPU; diagnosed mining, placement, sandbox-restore issues from `HW_DIAG` logs | Believed uncommitted work was lost when the repo moved to E: (it was not); verify before panicking | 2026-11-21 |
| Any session | - | Wrote into `C:\Users\admin\game` after the DiskOrganizer move: always tell sessions the canonical path (`E:\Projects\game`) | 2026-11-21 |

## Undecided
- **Independent reviewer on a different model family:** none available locally. Until one is installed (the `~/.codex`
  folder exists but no `codex` binary), adversarial review is a fresh Claude session that has not seen the code's author.
- Whether to create `main` (owner decision).

<!-- ======================== END docs/team.md ======================== -->


---

<!-- ======================= BEGIN docs/CONGRUENCE.md ======================= -->
# FILE: docs/CONGRUENCE.md

# Hearthwatt - congruence audit, conventions and integration streams

Written 2026-11-21 by a read-only audit session (branch `ccr-3c8b169f-e78nk2`, taken while the six-age refactor was still running, so file
and line references can shift by a few lines; names of files and symbols are stable). Sources: every plan in `docs/`, `docs/api/*`, and a
sample of `src/content`, `src/sim`, `src/game`, `src/workshop`, `src/magic`, `src/vehicles`, `src/core`. Nothing was built or run.
Claims marked **(unverified)** came from a doc and were not re-checked in code.

Owner decisions that this document takes as fixed: six ages Ember / Bronze / Forge / Current / Atomic / Star; Ember is handwork (no steam,
no machines, no electricity); Bronze begins steam and shafts, then the boiler multiblock, pressure, pneumatics; Forge is iron, steel and
heavy industry with the dynamo at the end; Current is electricity and the modern steam turbine; the furnace is the heart of the base;
in-world interaction beats UI screens; original art and names.

---

## 0. The five findings that matter most

1. **There are two steam/shaft worlds and neither knows the other.** `STEAM_PLAN`/`BRONZE_PLAN` describe a `MechSpec` shaft core, a copper
   kettle, rotor, boiler vessel, heat/steam/air nets. `grep MechSpec src` finds nothing. What exists instead is `src/workshop/kinetics.ts` +
   `workshop.ts`: a complete hand-crank-driven rotation layer with solver, jams, lubricant, gearshifts, signals, contraptions. Its power
   sources for steam-ish things are the OLD watt-based `water_wheel`, `wind_turbine`, `steam_engine` (`workshop.ts` ~line 34: a table of
   `rpm` and `suPerW: 1/50`), which are Forge/Current electric generators in `src/content/blocks.ts` / `recipes.ts` (`forge(2,'water_wheel')`,
   `forge(3,'wind_turbine')`, `forge(2,'steam_engine')`). So a Bronze player never gets a shaft source other than the crank, treadwheel,
   clockwork motor and tractor power take-off. **Stream A must decide to extend the workshop solver, not build `mech.ts` as written in
   STEAM_PLAN** (see D1, section 3.1).
2. **Several docs are stale about the workshop.** `OVERHAUL_PLAN.md` section 0 says rotation is a plan; it is built (`docs/api/workshop.md`,
   `WHATS_LEFT.md` section 2). `SESSION_CONTEXT.md` sections 10 and 11 disagree about what "left" means. Treat `docs/api/*.md` and the code as truth;
   fix the plans in stream G (task G1).
3. **Age gating is a placeholder.** `src/magic/ageMap.ts` maps `bronze` to index 0 (Ember) until the refactor. Workshop recipes are written
   `age: 0` (`recipesWorkshop.ts` `bench()` / `forgeR()`), so today **all Bronze workshop machines are craftable in the Ember Age**. After the
   refactor every "BRONZE" constant must resolve to the new index 1 and the recipes must be re-gated (section 3.4).
4. **The distillery and the workshop already touch (lubricant, spouts, drain) but the loop is open.** `LUBE` in `workshop.ts` knows Heavy Residue
   (`residue` fluid) and `pine_resin`; the distillery makes `residue` and `crude_oil` but there is no residue->lubricant can path end to end, and
   essentia/aspects are absent from distillation (the plan's "Clarity in the still" is a status entry, not a mixture component).
5. **Names clash in three places**: `copper_kettle` (Bronze steam) vs `kettle_pot` (Ember brewing); old `steam_engine` (Forge, dynamo-driving)
   vs the planned Bronze "Steam Engine" (piston onto shafts) vs the workshop's `steam_engine` entry in the rpm table; `boiler` (Forge-era cased
   machine in `blocksTech.ts`, sits on a furnace) vs the planned boiler multiblock. Details in section 3.

---

## 1. Theme, material, colour and signature moments per age

One sentence each, written for art, sound and writing sessions. Aspect and fluid colours are already fixed in code (aspects: `src/magic/aspects.ts`;
fluids: `src/content/fluids*.ts`); the age colours below are the **direction for new art**, not existing constants (no age-palette table exists
yet - stream G adds `docs/ART_DIRECTION` notes or a `src/render/textures/agePalette.ts` if the owner wants one).

| Age | Theme sentence | Signature material | Signature colour | Signature sound |
|---|---|---|---|---|
| Ember | Everything is made by hand, stroke by stroke, and the fire is a living thing you feed. | Fired clay, charcoal, bone, copper | Ember orange `#e8622a` on clay brown `#8a6a3c` | crackle, stone-on-stone strokes, kettle hiss |
| Bronze | Heat learns to move: water, steam and turning shafts carry the fire's work across the yard. | Bronze, oak axles, leather belts, brass-warm glass | Verdigris green-gold `#b89a4a` / `#4f9a85` | rhythmic cog ticks, a chuffing piston, safety-valve whistle |
| Forge | The furnace gets a blast and iron becomes steel; machines get heavy. | Iron, steel, coke, refractory brick | Slate blue-grey `#5a6672` with white-hot highlights | trip-hammer thud, roaring blast, rolling mill grind |
| Current | Invisible power in copper veins; light and signal everywhere. | Copper cable, silicon, glass, aluminium | Cyan-white `#8fd8ff` and warm lamp `#ffd95a` | hum, relay clicks, turbine whine |
| Atomic | Quiet danger and control: cool water around a hot heart. | Superalloy, fused quartz, heavy water | Reactor green-blue `#5cf0c0` over graphite black | Geiger-soft ticks, coolant flow, low drone |
| Star | The base finally burns like a small sun. | Star core, plasma-white metal | Gold-white `#fff2b0` | rising harmonic chord, then calm |

Hold the **hearth ladder** as the visual spine: clay furnace (grey-brown) -> bronze furnace (green-gold plate) -> blast hearth (slate, bricks, nozzle
glow) -> arc hearth (cyan electrodes) -> plasma hearth (violet-white) -> starhearth. Each step re-uses the same silhouette so players recognise "the furnace".

**Signature moments (one per slice, scripted by objectives/sfx, never a cutscene):**
- Ember: *first pour* - molten bronze runs from the crucible into a mould and the mould glows then dims.
- Ember: *first cup* - a boiling pail, a cup, a drip cone; steam rises and a buff icon appears.
- Bronze: *the first shaft turns* - the wooden axle starts, cogs mesh, the goggles read "16 rpm, load 6/24 su".
- Bronze: *the safety valve sings* - pressure crosses its set point and the whistle blows instead of the boiler bursting.
- Bronze: *the first thing moves itself* - grain on a belt, into a mill, out of a chute into a basin.
- Forge: *the blast* - air through the nozzle, the hearth flares, iron runs for the first time.
- Current: *first lamp* - the dynamo/turbine feeds a cable; the base lights from within.
- Atomic: *the pile goes critical* with a calm rising hum, not alarms.
- Star: *ignition* - 300 kW for 90 s; the sky tints and the base is "forever warm".
- Magic (cross-age, mostly Bronze/Forge): *the first scan* - the notebook names the aspects of the thing in your hand.

---

## 2. Systems matrix

Legend: **C** consumes, **P** produces, **Age** = owning age after the six-age refactor (current code placement in brackets if different).
"Should talk to but does not" are the integration seeds that stream section 5 turns into designs.

| System | Consumes | Produces | Age | Should talk to, does not yet |
|---|---|---|---|---|
| **Furnace / heat** (`sim/furnace.ts`, `hearth*.ts`) | fuels (sticks 450, logs 650, peat 900, charcoal 1000 C; bellows), crucible items | heat (C, kW), smelting, bronze alloy, glass, warm zone against cold | Ember (1-block) .. Star (multiblocks) | boiler/steam (old boiler sits on it; planned one is remote via thermocouples); essentia (`hearth siphon` exists - one-way); weather (rain on open flue); distillery ground burner (planned) |
| **Handwork** (`sim/handWork.ts`, `handRules.ts`, `recipesHand.ts`) | stroke input at stations, hot-window after pours | tools, plates, flour, rope/cloth/leather, moulds | Ember | workshop twins use the same recipes (good, via `recipesHand`); casting bench is inert (pour happens at furnace); hot metal in hand for anvil window; tractor/chainsaw don't use it; aspects on mould outputs exist only by keyword rule |
| **Brewing** (`sim/brewing.ts`, `brewActions.ts`, `core/brewing.ts`) | water, leaves/grounds, heat under pail, cups/cones | tea/coffee drinks with 3-min buffs (`game/brewBuffs.ts`) | Ember | sugar (no sweetener step), spirit/ethanol (no tincture/elixir path), distillery beakers, essentia (Clarity vial exists in the still only), hunger value for drinks |
| **Food / Sugar Rush** (`game/hunger.ts`, `buffs.ts`, `itemsSugar.ts`) | food items | hunger, well-fed, `sugar_rush` (speed up, well-fed burns faster) | Ember/Bronze (sap tapping) | only 4 sugar foods; no sugar in brewing; no alcohol buff; no distillery syrup->sugar rule verified (syrup fluid exists); farming crops don't feed sugar beet-type source (sap only) |
| **Farming** (`sim/crops*.ts`, `game/farming.ts`) | tilled soil, seeds, water, weather | crops, wild plants, bushes (tea/coffee regrow) | Ember | tractor harvester (exists, `tractorWork.ts`) vs planned `reaper` (Bronze) - one of them is redundant; sprinkler/fluid pipe irrigation; weather affects growth (verify), aspects `spring` linked to growth speed (no) |
| **Ground items** (`game/groundItems.ts`, `collectors.ts`, `render/groundItems.ts`) | drops from blocks, mobs, spills, belts | entities that fly to player; vacuum collector, hand vacuum | Ember core, vacuum Bronze | belts spawn items through `host.ground.spawn(..., delayS:0.5)` (works); no sort/filter on belts beyond funnels; magnet/electromagnet (Current) planned as one definition in `collectors.ts`; no fluids on belts |
| **Leaf decay / chainsaw / tractor** (`game/felling.ts`, `leafDrops.ts`, `vehicles/*`) | fuel (ethanol/gasoline/diesel through canisters), logs | felled trees, harvested rows, towing | Current (gated by tier today; notes say move to age on W0) | distillery fuels are wired (ethanol weak, others stronger - verify numbers); bar oil consumer unbuilt; tractor PTO into shafts built (24 rpm, cap 30); weather/mud; sap tapping needs tree state |
| **Fluids and pipes** (`sim/fluidNet.ts`, `pipeNet.ts`, `tanks.ts`) | pumps, tanks, buckets/canisters | water, lava, steam, crude_oil, fuel, + 11 distillery fluids | Forge (pipes, today tier 1-2) | `FluidKey` is a closed union in `core/types.ts` (every new fluid edits core); essentia tubes are a separate net (see magic); steam as a fluid is the old forge-era definition, the Bronze steam net is a separate design; tank support for distillery fluids unfinished |
| **Distillery** (`sim/distill*.ts`, `core/chem.ts`, `core/distill.ts`) | beakers/canisters of wash, sap, syrup, crude oil; heat; water | spirit, fuel ethanol, gasoline, kerosene, diesel, residue, slop | Bronze/Forge per `DISTILL_AGE` | essentia/aspects; shafts (stirrer hook, vacuum cap pump); lubricant (residue exists, can does not); potions/tinctures; fuel ethanol into furnace? ground burner; brewing (tea->tincture) |
| **Kinetic workshop** (`workshop/*`) | rpm from crank, treadwheel, clockwork motor, tractor PTO, old generator blocks; stress; lubricant | rotation, belts, press/mixer/deployer/arm/drill/saw/loom/hammer/quern effects, signals | Bronze (age index 0 today) | steam/boiler (no steam source on shafts in Bronze), wind/water as wooden primitives, lubricant can end to end, essentia servants (cranks only), belts into crates, signals into magic, weather |
| **Steam** (old: `boiler`, `steam_engine`, `steam_turbine`; planned: STEAM_PLAN, BRONZE_PLAN) | furnace heat + piped water (old); planned copper kettle/boiler vessel | steam fluid; watts via dynamo (old); rotation (planned) | old: Forge/Current; planned: Bronze | whole planned stack unbuilt; shafts must be sourced here (stream A) |
| **Power networks** (`sim/power.ts`, `nodes.ts`, `fission.ts`) | generators (solar, wind, combustion, geothermal, turbine, fission), batteries | watts to lamps, arc hearth, machines | Forge end .. Atomic | Dynamo (planned Forge end) between shafts and watts; weather already affects solar/wind in power (verify), but not workshop wind; essentia `spark` aspect is not drawable; signals (workshop) vs cables are separate and should stay so but a "relay" bridge is nice |
| **Essentia magic** (`magic/*`, `render/magic`) | land aspects via gathering rod, vials, jars, hearth heat | notebook scans, research tree (24), wellsprings, tubes, rune desk, infusion altar, pedestals, foci, clay servants, hearth siphon | Bronze..Forge (ageMap) | tubes aren't fluid pipes; aspect fingerprints are keyword-derived not authored per new item; servants only crank; spark/soul/void undrawable; no aura HUD; no interaction with weather or time of day; distillery (Clarity) one-off |
| **Dev Mode** (`app/devMode*`, `docs/api/dev-mode.md`) | creative item menu, flags | sandbox state | all | must enumerate new content automatically (check on every new stream); no objectives/Codex pollution flags |
| **Objectives** (`content/objectives*.ts`, `game/objectives.ts`) | events, `ObjectiveCondition` union | goals, rewards | per age | no condition for fluids, rpm/stress, aspects learned, research done (uses `flag`); ids spread across 4 files; age field is an index so refactor renumbers |
| **Codex** (`scripts/codex`, `Codex tab`) | content registries, progression tree, aspects | static site page, item map, research tree | all | planned items shown only as text; process cards (distillery) feed it; workshop recipe cards under goggles are in-game, not in Codex; regenerate with `npm run codex` after content changes |
| **HUD / UI** (`ui/hud`, `ui/screens`, `ui/kit`) | game state | target line, buffs, objective tracker, screens (furnace, machine, pipe, brewing, notebook, rune desk, workshop guide) | all | goggles readout vs HUD target line vs machine screen are three presentations of the same facts; the workshop guide is a screen (against the in-world preference) |

---

## 3. Contradiction and gap list

Severity: **B** blocks a stream, **M** confusing or exploitable, **S** small. File references are to the repo at audit time.

### 3.1 Duplicate or competing mechanics

| # | Sev | Finding | Where | Resolution (owner of fix) |
|---|---|---|---|---|
| D1 | B | Planned `MechSpec` shaft core vs built `workshop/kinetics.ts` + `workshop.ts` | `STEAM_PLAN` sections 1-3, `OVERHAUL_PLAN` A.9 `mechLite`, `src/workshop/*` | Keep the workshop solver. Add *sources* (steam rotor/engine, water wheel, windmill) as workshop part kinds with `{ rpm, capacity }` like `CLOCKWORK`/`pto` (A) |
| D2 | B | Old watt generators `water_wheel`, `wind_turbine`, `steam_engine` double as workshop shaft sources via a table | `workshop.ts` ~34, `blocks.ts` 197-200, `recipes.ts` 141-178 | Rename the Forge-era ones (e.g. `dynamo_wheel`) or create wooden Bronze twins (`wooden_water_wheel`, `windmill`) and drop the table (A) |
| D3 | M | Three "steam engines": Forge `steam_engine` (heat + water on furnace -> dynamo), planned Bronze piston engine, workshop rpm entry | `blocks.ts` 197, `STEAM_PLAN` section 2, `workshop.ts` | Old block becomes the **Steam Dynamo** (Forge end, electricity); the Bronze piston is `piston_engine` (A) |
| D4 | M | Two boilers: Forge cased `boiler` (on a furnace) and the planned boiler vessel multiblock | `blocksTech.ts` 55, `BRONZE_PLAN` section 6 | Keep the vessel as `boiler`; rename old to `furnace_boiler` and move it to Forge/Current as the steam turbine feeder, or delete it after tests (A) |
| D5 | M | Hand-station twins exist twice: workshop `mech_*` kinds and the planned `trip_hammer`/`millstone`/`saw_bench` items | `OVERHAUL_PLAN` A.4, `STEAM_PLAN` section 2, `itemsWorkshop.ts` (mech_saw, mech_millstone... are block keys in `BASE_STRESS`) | Use the workshop names; strike the STEAM_PLAN duplicates (A, C) |
| D6 | M | Collectors: tractor harvester vs `reaper` vs `mech_arm` + deployer with a hoe | `vehicles/tractorWork.ts`, `OVERHAUL_PLAN` A.7 | Tractor = Current-age mass harvest; reaper (Bronze) = 3x3 crop cutter on a shaft; keep both, make recipes distinct (C, E) |
| D7 | S | Vacuum: Bronze Chute + Vacuum Pump (BRONZE_PLAN 5.4), `vacuum_collector` (workshop), Hand Vacuum Pump (ground items) | `BRONZE_PLAN` 5.4, `itemsWorkshop.ts`, `game/collectors.ts`, `docs/api/ground-items.md` | One mechanism: `collectors.ts`. Chute network with a vacuum becomes a collector kind; do not build a second pull algorithm (A, C) |
| D8 | M | Two ways to make Bronze goods: cup/cone forge recipes vs Clay Table | `WHATS_LEFT` section 0 (owner decision pending) | Owner decides; recommended: delete cup/cone forge recipes (E) |
| D9 | S | Heat transport: planned thermocouples (BRONZE_PLAN) vs the existing `hearth siphon` (essentia) and furnace "warm zone" | `BRONZE_PLAN` 4.1, `magic.ts` | Not competing, but name them in a "heat" section of the Codex (G) |

### 3.2 Name clashes (decide once, record in the conventions sheet)

| Clash | Decision |
|---|---|
| `copper_kettle` (steam, Bronze) vs `kettle_pot` (boiling water, Ember) | Keep both; `kettle_pot` = Ember Kettle Pot (boils water only); steam item = `bronze_kettle` is NOT used; use `steam_kettle` with display name "Copper Steam Kettle". Never display "Kettle" alone. |
| `steam_engine` x3 | see D3: Forge `steam_dynamo`, Bronze `piston_engine` |
| `boiler` x2 | see D4 |
| `water_wheel`, `wind_turbine` | Bronze wooden: `water_wheel`, `windmill` (axle output); Current: `wind_turbine` (watts) stays; Forge-era `water_wheel` recipe becomes the Bronze wooden one |
| `mech_pump` (STEAM_PLAN recipe item) vs `pump` (fluid pump, `blocksTech.ts` 50) | `pump` stays the electric/fluid pump; shaft pump = `mech_pump` in workshop style |
| `conveyor_belt` (code) vs `belt`/`drive_belt` (plans) | keep `conveyor_belt` (items) and `belt_pulley` (shaft link); never call the shaft link a "belt" in UI |
| `drive_shaft` (code) vs "wooden axle" (plans) | code name wins; display "Wooden Axle" in Bronze, "Iron Shaft"/"Steel Shaft" later as variants of the same block key with material in `variant` or separate keys `iron_shaft`, `steel_shaft` (A decides; recommended separate keys for tool/tier rules) |
| `six_cups` goal, `spirit_beaker` vs `spirit` fluid | cosmetic; beakers are the item form, fluids the pipe form: `<fluid>_beaker`, `<fluid>_canister` |

### 3.3 Items with no use / no source / dead ends

I did not run an exhaustive graph (that is a test, task G2). Observed from docs and content lists:

- **No source or no way to obtain at their age:** `lubricant` as a fluid or can (workshop has `LUBE` keyed on `residue` and `pine_resin`; no `lubricant_can` item in `itemsWorkshop*.ts`
  list); `bar oil` (chainsaw consumer unbuilt); `spark`/`soul`/`void` aspects (no source); `bent_pin` return (plan only, verify).
- **Dead-end fluids:** `slop` (distillery waste: no use); `kerosene` (no consumer unless a lamp or jet fuel is added); `gasoline`/`diesel` have tractor/chainsaw use but
  no generator (combustion generator uses `fuel`? verify); `sugar_wash`, `low_wines` only feed the still; `syrup` should reach sugar (rule not verified);
  `crude_oil` and `fuel` (old refined fuel) are older than the 11 new fluids and the relation between `fuel` and `gasoline/diesel` is not documented - **one of them must absorb the other** (see section 4, B7).
- **Closed-union cost:** `FluidKey` is a literal union in `core/types.ts` - every new fluid (steam variants, lubricant, essence) touches core. Convention below: fluids append, never reorder.
- **Items that exist but have no recipe consumer:** unknown; expect some Atomic and glass beakers. Test G2 enumerates (item is craftable AND (used as input OR placeable OR consumable OR objective reward)).
- **Planned only (named in docs, absent in code):** thermocouples, hot plates, heat vents, boiler vessel, copper kettle, steam rotor, steam engine (piston), pressure gauge, safety valve, air compressor/tank/tubes, pneumatic press/drill/hammer, blast nozzle, dynamo, vacuum pump block, iron/steel shafts, rolling mill, drop forge, crusher.

### 3.4 Recipes that bypass the age gates

- **All workshop recipes are `age: 0`** (see finding 3). A Bronze Workshop in the Ember Age is craftable with workbench bronze/copper recipes. After W0 set `age: 1` through the single `BRONZE` constant (`itemsWorkshop.ts` imports it from `ageMap`) - but also check the *station*: Ember bench recipes should not use bronze ingots in quantity unless the age 1 gate holds.
- **Workbench recipes that craft machines from raw materials** (`bench()` rows in `recipesWorkshop.ts`) skip the "forge it" step; Bronze machines should need the bronze furnace tier (W0 adds `minTier 1`): `forgeR` already uses `minTier: 1` - that tier today is the **Clay furnace**, since tier 1 = Ember. W0 renumbering turns it into Bronze only if all `minTier: 1` literals are bumped. Search for the literal `minTier: 1` in all recipe files after W0 (task G2).
- **Vacuum pump, chainsaw, workshop parts and magic ages are gated by tier today** (WHATS_LEFT); notes in `docs/api/ground-items.md` and `docs/api/chainsaw.md` say where to move them.
- **Magic gates:** `src/magic/gates.ts` gates glass vial, rod and jar recipes by research; Bronze/Forge entries should depend on the same age names - verify `AGE_INDEX` use in `entries.ts` after W0.
- **Tractor/chainsaw as Current**, but the distillery makes their fuel in Bronze-Forge: fine, but the tractor's PTO into shafts means a Current vehicle drives Bronze machines. Acceptable (a reward), but it bypasses the crank/treadwheel/steam ladder in a sandbox. Either gate the PTO behind Forge or accept it as a late-game convenience (owner decision, default: accept).

### 3.5 Other contradictions found in docs

| # | Finding | Fix |
|---|---|---|
| X1 | `OVERHAUL_PLAN` section 0 says rotation is a plan; `api/workshop.md` and code say built | Update OVERHAUL_PLAN with a "status" box; keep the design text (G1) |
| X2 | `PROGRESSION.md` "Age 0 goals" list *Italic = planned* but some are built (clay table, casting, hand quern) | Re-mark after the refactor (G1) |
| X3 | `SESSION_CONTEXT.md` has duplicate section numbers (two "## 7"), sections 10-12 repeat | Renumber on the next pass; low priority (G1) |
| X4 | `PROGRESSION.md` says "Ember Kettle Pot is a different block from the Bronze Copper Kettle"; there is no mention of `steam_kettle` naming | Add to conventions (this document section 4) |
| X5 | `STEAM_PLAN` section 8 "state of the repo" is dated; the shaft core claims "nothing exists" and it is true for `MechSpec` only | Replace with a pointer to section 0 here (A) |
| X6 | `DISTILLERY_PLAN` section 11 puts the still in an age through `DISTILL_AGE`; `PROGRESSION` says the still is Current | Distillery plan wins for glass (Bronze, hand-fed), Current still is the older `techMachines.ts` still (a *different*, electric still). Name them `glass still` vs `electric still` in the Codex (B, G) |
| X7 | Star hearth: 93 casings, pending owner decision | Reduce or keep: **recommend keep 93 but allow a smaller "compact star shell" achievable with superalloy hatches** (F) |
| X8 | "Rack under glass keeps running", "crops without farmland stay without growing", "steam engine draws heat when idle" in `SESSION_CONTEXT` section 6 | Fix when touched (E, A) |
| X9 | `Saves`: `SAVE_VERSION = 1` in `src/save/document.ts`; W0 needs a migration and a **fixture of an old save** committed first | W0 session owns; every later stream appends save keys without bumping unless changing shape (see conventions) |

---

## 4. Conventions sheet

Everything here is either already true in code (cited) or a **decision** (marked D). Parallel streams must follow it; if a decision is wrong, change it here first.

### 4.1 Naming

- **Keys**: `lower_snake_case`, ASCII, stable forever (saves store keys). Never rename a key; add an alias in sanitize/migration instead (`src/sim/sanitize.ts`, `src/save/document.ts`).
- **Items vs blocks**: a placeable thing has a block key and an item key that are the same string. Do not suffix with `_block` or `_item`.
- **Material before shape**: `bronze_ingot`, `iron_plate`, `copper_coil`, `steel_shaft` (D). Tool kinds: `<material>_pickaxe`, ..., `<material>_maul`.
- **Containers of fluids**: item `<fluid>_beaker` (glass, 125 mL? **unverified amount; see `content/amounts.ts`**), `<fluid>_canister` (8 stack; large), bucket = 1000 mL with `FluidSpec.bucket`. The fluid key is the bare name: `spirit`, `residue`.
- **Display names**: Title Case, original names only (no Create/Thaumcraft/Minecraft names). Existing homages are tolerated internally (`item_vault`) but displayed names must be ours: use "Wooden Axle", "Gear Case", "Stamp Mill", "Field Notebook".
- **Ages**: the lower-case names `'ember' | 'bronze' | 'forge' | 'current' | 'atomic' | 'star'` (`AgeName` in `src/magic/ageMap.ts`). Code uses a numeric index (0-5 after W0); **new content must use `AgeName` via `ageIndexOf()` / its age constants, never a bare number** (D). Display: "Ember Age", etc.
- **Aspects** (all lower-case): primals `cinder loam brook gale rune rift`; compounds `glow spring vein frost ash wane drive craft mind ward steam clarity`; late `spark soul void` (`src/magic/aspects.ts`). New aspects require a tier, two parts, a colour and a research entry.
- **Events** (`src/core/gameEvents.ts`): `namespace:verb` (`cast:poured`, `mech:seized`). New events append to the union.
- **Machine roles** (`MachineRole` in `core/types.ts`): keep existing; new `role` values append.
- **Test fixtures**: roster file names `specRoster<Area>.ts`, one line merge in `specRoster.ts`, and a count line in `content.test.ts`.

### 4.2 Units

| Quantity | Unit | Where |
|---|---|---|
| Temperature | degrees C (integer display) | furnace, recipes `minTempC` |
| Heat flow | kW | thermocouples (planned 6 kW/line bronze, 20 kW iron) |
| Electrical power | W (display kW/MW) | `core/constants.ts`, `power.ts`; storage J |
| Rotation | rpm, signed (negative = reverse) | `workshop/kinetics.ts`; base rpm 16 (`STROKE_S` 0.5 s at 16 rpm; belt 1 block/s at 16 rpm) |
| Stress | su ("stress units"); capacity of sources vs load; `BASE_STRESS` table | `kinetics.ts` |
| Watts to stress | `suPerW = 1/50` for converted generators (`workshop.ts`) | until D2 is resolved |
| Fluid | litres (L) in code, called mL in some recipe docs: **use L for machines, beakers/vials in mL where a recipe shows 125/250 mL**; `FluidSpec` bucket = 1000 L | `content/amounts.ts` |
| Pressure | bar (Bronze steam), 8 bar bursts without valve (planned) | `BRONZE_PLAN` |
| Essentia | integer units; jars 32; max 8 per aspect in a fingerprint, max 4 aspects (`aspectTable.ts`) | `magic` |
| Time | game seconds in sim (`dt`), real-time in UI; day length in `game/clock.ts` | |
| Durability | integer uses | `ItemSpec` |

### 4.3 Recipes, stations and temperatures

- Stations (existing): `workbench`, `furnace` (with `kind: 'forge'` or smelt rows), hand stations (chopping block, quern, stone anvil, mortar, clay table, casting bench, drying rack, tanning trough, loom), brewing pail/cup/cone, glass still modules (cards), workshop `basin:<id>` rows, Rune Desk and infusion altar.
- **Rule 1 (D):** the more a recipe resembles a transformation of heat/force, the earlier it should be on a physical station; **workbench is for assembly of already-made parts only**. A workbench row whose inputs include an ore, raw dust or fluid is a smell.
- **Rule 2 (D):** furnace forge rows carry `minTier` (furnace tier = age index + 1 after W0? **tier numbering is decided by W0; read `FurnaceTierSpec`**) and `minTempC`: copper 700, bronze 800 (Ember), Bronze-age rows 700-1100, iron 1150, steel 1400, silicon 1700, tungsten 2000.
- **Rule 3 (D):** a recipe can raise at most one gate: age, research, or tier (two when the second is a safety check). Research gates are implemented through `magic/gates.ts` `setCraftGate`, never by editing the recipe function.
- Hand recipes live in `recipesHand.ts` and **machines read them** (twins keep the same rows; time = seconds / (rpm/16)).
- Distillery recipes are cards (`recipesDistill.ts` `card(...)`: id, vessel, inputs, outputs, temp, time, pressure/aux, glyph string). Process cards feed Codex, ghosts and tests: add a card, not an ad-hoc rule.

### 4.4 Tool and tier ladder

Mining tiers 1 (wood/stone/flint) .. 5 (endgame) per `BlockDef.minTier`. Ember: flint then bronze tools (bronze = tier 2 equivalent) - **bronze tools are made in the Ember Age by hand casting** (Ember plan), so the Bronze Age does not start with a tool upgrade but with machines. Forge: iron (3), steel (4); Current: tungsten/arc maul (4-5); Atomic: superalloy/power drill (5). Weapon/armour ladders follow the same names (iron/steel mauls, plated coat, steel cuirass, shield suit). New blocks choose `tool` and `minTier` from this ladder; machines made of metal need `pickaxe` tier of their age.

### 4.5 How a new system registers (checklist for every stream)

1. **Content**: block rows in `src/content/blocks<Area>.ts` appended LAST so voxel ids never move (id is 10 bits; facing 2, active 1, variant 3 - `docs/api/world.md`); items `items<Area>.ts`; machines `techMachines.ts`/`machines<Area>.ts`; fluids `fluids<Area>.ts` and `FluidKey` union in `core/types.ts`.
2. **Recipes** in `recipes<Area>.ts` and the `RECIPES` index; cooking/hand rows in `recipesHand.ts`.
3. **Fixture**: `specRoster<Area>.ts` + merge in `specRoster.ts` + counts in `content.test.ts` / `worldContent.test.ts` (the tests count items, blocks, recipes; they fail if you forget).
4. **Solver rules** for sim-driven things: workshop part kinds in `workshop/kinetics.ts` (`BASE_STRESS`, `passOn`) and `workshop.ts` (`CYCLES`, source table); chem rules in `core/chem.ts` + `REACTION_SPECS`/`PROCESS_SPECS`.
5. **Aspects**: every item and block gets a fingerprint automatically from `src/magic/aspectTable.ts` (`KEYWORD_RULES`, `CATEGORY_BASE`, `AGE_BONUS_PER_AGE`, `OVERRIDES`); **new content must add keyword rules or overrides so its fingerprint reads sensibly** (D), and `magic.test.ts`/`fingerprint.test.ts` check budget (max 4 aspects, max 8 each).
6. **Codex**: `scripts/codex` reads registries; add the item to a progression branch in `content/progression.ts` and regenerate (`npm run codex`). Planned items are listed with `[planned]` until they exist.
7. **Objectives**: add an id to the relevant `objectives*.ts`; `ObjectiveCondition` types in `core/types.ts` are limited (have, make, place, break, furnaceTemp, furnaceTier, generate, stored, flag, any); use `flag` events for anything else (D) and add typed conditions only when 3+ goals need them.
8. **Save keys**: sim state serialises through each system's `save`/`load` into the world save (`src/save/document.ts`, `isWorldSave`, `normalizeDocument`). Add a key to the document and a default in `normalizeDocument`; do not bump `SAVE_VERSION` unless shape breaks. Missing keys MUST load as empty.
9. **Sounds**: add a name to `SfxName` in `src/core/gameEvents.ts`, a recipe in `src/audio/sfx<Area>.ts`, list it in `sfx.test.ts`'s expected names; ambience layers in `src/audio/ambience*.ts`.
10. **Icons/textures**: painters in `src/render/textures/*` (five-step ramps in `palette.ts`), tile listing in `render/atlas`/`textures.test.ts`; item icons from `render/icons.ts`. Every item/block needs a texture or the tests fail.
11. **Render** for in-world animation lives in `src/render/<area>/`, instanced renderers for repeated parts.
12. **Docs**: one `docs/api/<area>.md`; add to `SESSION_CONTEXT.md` only the commit range and state.
13. **e2e**: a `scripts/e2e-<area>.mjs` and a line in `package.json` chain; run under the `.run-lock` mutex when others are building.

### 4.6 UI language and phone interaction

- **In-world first** (owner): prefer a block you press/hold/strike, a status sentence on the HUD target line, a ghost preview, or a goggles readout over a modal screen. A screen is justified only for inventories of many things (notebook, research board, Codex, rune desk) or a settings panel.
- Touch target >= 44 px (`--hw-tap` 44px in `ui/styles.css`, `IconButton` 44 px). Phone breakpoint `(max-width: 719.98px), (max-height: 519.98px)`; windows become full-screen sheets on phones; no page scroll; long-press (420 ms) = secondary action.
- Every machine has **one status sentence** (<= 70 characters, "Quern: grinding wheat, 14 rpm, load 4/24 su") shown on the target line and by goggles; planned exact strings exist in `BRONZE_PLAN` section 10. New machines add theirs; failures use verbs ("seized", "overheating", "out of fuel") and say what to do ("add a clutch").
- Copy: second person, plain, <= 2 sentences per description, no jargon without a Codex entry; numbers with units (`16 rpm`, `1100 C`, `8 bar`, `2 kW`).
- Buttons are verbs; toasts at most 3 s; never block movement with a modal during survival hazards.
- Fonts: IBM Plex Sans / Plex Mono (class `hw-num` for readings).

### 4.7 Colour and art direction

- Voxel world with painted tiles from code (`src/render/textures`), five-step ramps per material, a gentle S-curve and warm highlights (`textures.md`).
- Per age signature (section 1). Fluid colours in `FluidSpec.colour` (water `0x3a86b4`, lava `0xff7a1e`, steam `0xe6ecf0`, crude `0x1d1814`, fuel `0xe2bc3a`); **aspects keep their `AspectInfo.color` everywhere** (cinder `#e8622a`, loam `#8a6a3c`, brook `#3f8fd8`, gale `#cfe6ee`, rune `#a77fe0`, rift `#5a3a6e`, glow `#ffd95a`, spring `#5cc060`, vein `#c7a24a`, frost `#9fd6ff`).
- Machines read by *state*: heat = emissive glow by temperature (`glows.ts`), motion = turning parts (workshop renderer), fluid level = window, essentia = floating motes in the aspect colour. A machine that does something must **show it** (no silent processing).
- Glass always has the same blue-white transparency; metal parts carry a material colour (bronze `#b89a4a` verdigris edge, iron slate, steel bright).

### 4.8 Sound conventions

- All sfx are synthesised in `src/audio/sfx*.ts` with `SfxName` strings: `<area>_<what>` e.g. `essentia_pour`, `scan_chime`. One sound per player-visible action, plus one ambient layer per running machine class (`ambience*.ts`, with weather layers separate). A new loop must have a volume budget in the ambience test and respect distance attenuation.
- Pitch encodes state (machines whine up with rpm, down with load); never add speech.
- Phone: master volume and mute in Settings; no autoplay before first touch.

---

## 5. Prioritised integration work list (streams)

**Ordering.** The six-age refactor (W0) lands first and exclusively. After it, run **A first** (it unblocks C, D, E and part of F), with **B, E and F-content** in parallel as soon as W0 lands; **C** can start with the non-steam items; **D** after the Bronze sources exist; **G** is last. Each stream should be one session, one branch, rebase on W0 (never merge another stream's branch). Shared files all streams touch (`src/core/types.ts`, `content.test.ts`, `specRoster.ts`, `package.json` e2e chain, `src/app/game.ts`, `src/audio/sfx.ts`): append-only, small commits, **rebase before every commit**.

Every stream's end state: `npx tsc --noEmit` clean, `npx vitest run` green, its own e2e passes on desktop and phone portrait (`HW_GPU=1`), `docs/api/<area>.md` updated, Codex regenerated, no key renamed, no voxel id moved.

### Stream A - Steam and Bronze mechanics (STEAM_PLAN + BRONZE_PLAN, reconciled)

**Owns:** `src/sim/{heatNet,steamNet,airNet,netGraph,boilerVessel,structureScan}.ts` (new), `src/content/{blocksSteam,itemsSteam,recipesSteam,specRosterSteam}.ts` (new), `src/workshop/{kinetics,workshop}.ts` (add source part kinds only), `src/render/steam/` (new), `docs/STEAM_PLAN.md`, `docs/BRONZE_PLAN.md`, `docs/api/steam.md`. Shares append-only: `core/types.ts` (FluidKey `steam_low`? no: keep `steam` and add `air`), `core/gameEvents.ts`.
**Does not touch:** distillery, magic, handwork.

Designs (one concrete picture each):
1. **Wooden primitives first.** `windmill` (turns by `windAt`, height gives capacity) and `wooden_water_wheel` (two water sides) become workshop *source kinds* (`{rpm, capacity}` like `CLOCKWORK`), replacing the watt table (D2). Player sees: a windmill on a hill, the wooden axle trundling down to a quern. Goggles: "Windmill: 12 rpm, wind 0.8, load 6/18 su." Weather already provides wind; storm gusts raise stress capacity and a heavy gust shears a pin (hooks the shear pin).
2. **Copper steam kettle + rotor.** `copper_kettle` sits on the clay or bronze furnace (adjacent heat) and takes a water bucket; at the boil it makes steam that spins a `steam_rotor` placed on top. Player sees: a sealed copper pot, a puff, the rotor whirling, a shaft starting; running dry warps the kettle (rule from STEAM_PLAN). This is the "heat makes motion" moment.
3. **Thermocouples carry heat, not fuel.** A bronze strip running from the furnace to a plate: the plate glows by temperature and burns your hand; boiler heat ports take heat from it (BRONZE_PLAN 5.1). Reuse the **hearth siphon pattern** from magic (one-way heat taken by a neighbour).
4. **The boiler vessel multiblock** built from a ghost preview in the Structure planner; `scan` reuses `hearthScan`. Safety valve + pressure gauge; burst after a 5 s warning above 8 bar with no valve; the valve **whistle** is the signature sound. Pressure shows on the **goggles** (not a new screen).
5. **Piston engine** (`piston_engine`) turns 16 rpm/bar with 128 su/bar capacity: the first strong shaft source. Rename old `steam_engine` to `steam_dynamo` (Forge end, watts) per D3.
6. **Pneumatics**: compressor on a shaft -> air tubes -> tank (6 bar, leaks at open ends) -> pneumatic press/drill/air hammer; new `air` fluid (append to `FluidKey`); the tubes should look like the essentia tubes but copper (same render code if possible, different net).
7. **Vacuum chute = collector**: see D7. A chute network with a vacuum pump calls `collectors.ts` (no new pull algorithm); items rattle through glass-ended tubes.
8. **Blast nozzle gate** to the Forge: brick walls + nozzle fed at 2 bar -> blast hearth forms (Forge gate; edits `hearthScan` + progression gate only).
**Acceptance (golden tests + e2e):** (a) windmill + crank-free quern grinds wheat headless (unit); (b) kettle boils a bucket and the rotor reaches 16 rpm; dry kettle warps; (c) boiler with no valve bursts after 5 s above 8 bar; (d) air tank leaks when a tube end is open; (e) blast hearth forms only with nozzle at 2 bar; (f) old saves load (fixture); (g) `e2e-steam.mjs` builds kettle -> axle -> mill on desktop and phone. Also: D1-D4 resolved, old items renamed with aliases in `sanitize.ts`.

### Stream B - Distillery completion (DISTILLERY_PLAN section 15)

**Owns:** `src/sim/distill*.ts`, `src/core/{chem,distill}.ts`, `src/content/{blocksDistill,itemsDistill,recipesDistill,fluidsDistill,machinesDistill,specRosterDistill}.ts`, `src/render/distill/`, `docs/DISTILLERY_PLAN.md`, `docs/api/distillery.md`. Shares append-only: `core/types.ts` FluidKey, `fluids.ts`.
Designs:
1. **Lubricant, end to end.** Vacuum cap on a rig separates `residue` into `lubricant` (new fluid) and bitumen; a `lubricant_can` is filled at a tank spout (workshop `spout`), used on a shaft: the goggles show "oiled, 9 min left" and the stress capacity rises (workshop `LUBE`). The chainsaw bar-oil consumer drinks the same can. Player sees oil sheen on the axle and the shaft quietens (sound filter).
2. **Essentia in the still (aspect distillation).** A rig fed a jar's aspect or a herb produces an "essence" item (`<aspect>_essence`, appended `ItemSpec` per primal aspect) at low yield; the Clarity vial entry becomes a real reaction card. Essence makes tinctures and elixirs. Visuals: the column glows in the aspect colour. (Coordinates with D.)
3. **Tinctures, potions, drinks, antiseptic bandage:** brewing buffs (`game/brewBuffs.ts`) gain alcohol-extracted variants: Green Tea tincture (longer jump), Berry Tea elixir (heal over time), Spirit as a drink (warmth, slows aim - small cost), Fuel ethanol in the **ground burner** (charcoal-free fire). Drinks reuse `drink.ts`.
4. **Ground burner & reflux head & filter bed**: single-block hand-fed heat for the first rigs (no furnace needed); reflux head raises purity; filter bed (sand, charcoal) cleans slop into water.
5. **Rig screen and ghost previews** (in-world preferred: ghosts + goggles sentences; screen only for a recipe card).
6. **Tank/pipe end to end**: tanks accept all 11 fluids; receiver -> pipe -> tank; shaft stirrer hook in the workshop (a Bronze stirrer lowers batch time; B reads workshop `driveAt`-like API: coordinate with C).
7. **Refinery tower** (late, Forge): catalyst bed + pressure cap + cracker: crude -> gasoline/kerosene/diesel by cut height. `slop` and `kerosene` get consumers: kerosene lamp (light without power, Bronze-Forge), slop -> fertiliser.
8. **Merge `fuel` (old refined fuel, `fluids.ts`) into the new fuels** (B7): keep key `fuel` as an alias of `gasoline` in sanitize, or rename in the oil tech chain; the combustion generator consumes `diesel`/`gasoline`/`fuel_ethanol` with different efficiency.
**Acceptance:** rig golden tests for lubricant and essence; a `distill:step` event; each new fluid has a tank test; `e2e-distill.mjs` runs bottle -> spout -> can -> shaft oiled, desktop + phone; `content.test.ts` counts updated.

### Stream C - Workshop polish and Create-style gaps

**Owns:** `src/workshop/*` (except source kinds, which A adds), `src/render/workshop/`, `src/content/{itemsWorkshop,itemsWorkshopParts,recipesWorkshop,objectivesWorkshop,specRosterWorkshop,basinWorkshop}.ts`, `docs/api/workshop.md`.
Designs (from WHATS_LEFT section 2 plus new):
1. **Smooth tweening of moving structures** and **riding the skiff** (seat = player locked to the skiff, view bobs with rail grade). Test: skiff carrying a player down a rail doesn't desync collision.
2. **Treadwheel with tamed animals** (`mobs.md`): a goat or hound on the wheel gives 12 rpm; the horn calls it. Animals tire (stamina) and need food -> farming/hunger link.
3. **Belts cross structure borders** and **belts into crates**: a belt ending against a crate adds the item (via `accept` -> `acceptCrate` already exists), so a field -> belt -> crate loop works without a funnel. Visual: crate lid opens.
4. **Continuous spouts**: a spout connected to a pipe network fills any container on a depot every second (no bucket needed): distillery bottling line.
5. **Punched gearshift cards** as an item with a visible pattern; Use on the gearshift loads it; cards are craftable at the workbench with a punch tool. The three presets stay as defaults.
6. **Item vault multiblock growth** and a **sorting funnel** (filter slot, whitelist of items); belts show item sprites moving (done) and texture direction (belts animate).
7. **Trinkets**: wind vane (reads `windAt`, rotates), weather cock, spyglass (zoom, long-press on phone), brass horn, padlock chest, lantern chain. Ship each as a block with a status sentence; trinkets feed the Codex "decor" branch.
8. **Weather and machines**: rain makes belts slip (speed x0.8 outdoors unless under a roof, read `weather.ts` precipitation + sky exposure), frost thickens water wheel flow, storm wind may bend a windmill (stress spike). Tiny, readable, goggles show "wet belt".
9. **Vacuum/magnet collector**: `vacuum_collector` already exists; make it a kind in `collectors.ts` with the same API the magnet will use.
**Acceptance:** unit tests per part; goggles sentence per part; `e2e-workshop.mjs` extended: field -> belt -> mill -> chute -> crate; no regression in the six workshop goals; phone portrait e2e. **Fix first:** re-gate recipes to Bronze (C6); remove the generator table dependency once A lands.

### Stream D - Magic depth and tech/magic tie-ins

**Owns:** `src/magic/*`, `src/render/magic/`, `src/content/{itemsMagic,recipesMagic,specRosterMagic}.ts`, Codex Essentia tab, `docs/api/magic.md`.
Designs:
1. **Aspects on every new item** (task D0, runs after each stream): extend `aspectTable.ts` keywords: e.g. `kettle` -> cinder+brook+steam, `shaft/axle` -> drive+loam, `windmill` -> gale+drive, `piston` -> steam+drive, `lubricant` -> brook+glow, `spirit` -> cinder+clarity, `residue` -> loam+rift. A test lists items whose fingerprint is only `CATEGORY_BASE` (unmeaningful) and fails above a threshold.
2. **Servants on cranks, then on more**: a clay servant turning a crank (built) grows into a **golem socket**: a servant on a *deployer* or *treadwheel* seat. Spring + Mind feeds them. Player sees a clay figure patiently grinding; golems that walk stay off the list until after (keeps scope).
3. **Essentia tubes ARE a pipe net**: re-implement `essentiaNet.ts` on `pipeGraph.ts` with a fluid key `essentia` carrying (aspect, amount) pairs, so tubes share rendering, build tools and breakage with pipes. Existing saves migrate by adding tubes to the pipe snapshot (tests with a fixture).
4. **Steam aspect and the boiler**: a boiler fed a jar of `steam` essentia makes steam without fuel but the furnace's warm zone dims (Essentia replaces fire but not warmth) - magic costs a trade-off. Rod charge from furnace heat (hearth siphon exists) is the bridge back.
5. **Infusion altar upgrades items with aspects**: a lubricant can infused with `glow` never runs out; a hand crank infused with `drive` gives +50% capacity; a kettle with `cinder` boils with half the fuel. Each infusion is one small effect in a table (`INFUSIONS` in `magic/`), described in the notebook. Prevents power creep with a charge cost.
6. **Spark / soul / void drawable** in Current/Atomic: spark from lightning rods in storms (weather link) and from the dynamo's field, soul from mob drops (Emberbound), void from deep rift places (world feature). Each unlocks one late research chain (electric servants, wards, storage).
7. **Aura HUD dial**: a tiny dial on the compass that shows the local dominant aspect (colour) - not a screen, a HUD element.
8. **More research entries** (24 -> 36) for Bronze/Forge: one per new Bronze system (kettle, kinetic, still, belts, pressure), gated through `gates.ts`.
9. **Weather & time**: gathering rod draws more `gale` in storms and `cinder` at noon; wells recover by night.
**Acceptance:** `fingerprint.test.ts` coverage test; research board tests for new entries; the e2e-magic script covers tube-on-pipe-net and altar infusion; no regression in saves (fixtures).

### Stream E - Food, farming, brewing, sugar depth and cross-links

**Owns:** `src/sim/{brewing,brewActions,crops*,bushes}.ts`, `src/game/{farming,hunger,buffs,brewBuffs,drink}.ts`, `src/content/{itemsBrew,itemsSugar,recipesBrew,blocksBrew,machinesBrew,objectivesBrew,specRosterFood,specRosterBrew}.ts`, `docs/api/{brewing*,sugar,food*,crops}.md`.
Designs:
1. **Sugar in the cup**: sugar and syrup are sweeteners that change a drink's profile: Sweet Green Tea = Green Tea + sugar -> jump + Sugar Rush speed, with the well-fed burn penalty (the existing `SUGAR_*` constants). Player adds a sugar lump to the cup before the pour (no screen: Use with sugar on the cup).
2. **Alcohol path**: sugar wash -> low wines -> spirit (distillery) and a **fermenting jar** (Ember: clay jar + wash + days) that makes weak ale/cider you can drink raw. Drink buffs: Cider (warm + slow), Ale (hearty: hunger), Spirit (burn, heat resist). Alcohol should have a visible cost (aim sway) and a hangover-like "well-fed burn" so it is a choice.
3. **New foods from new machines**: mill flour -> basin + mixer dough -> belt oven; sweet bun/cookie/cake exist; add savoury pie (meat + flour), cheese (milk + salt + time), jerky (rack). Each food has: hunger, well-fed seconds, optional buff. All numbers in `core/constants.ts` neighbourhood; one table.
4. **Farming/irrigation/weather**: furrows next to water grow faster; rain waters; drought in the Current age storms? Tractor harvest and deployer-hoe both reach crop rules (`cropRules.ts`): reaper and tractor use the same ripeness check.
5. **Sap -> syrup -> sugar chain** completes: tapped pine sap boils on the furnace into syrup (distillery fluid), syrup crystallises on a rack/hot plate into sugar; tap state saved (known gap), animation and particles.
6. **Hunger from new drinks** with a single table `DRINK_HUNGER` so brewing, distillery and potions share it.
7. **Bushes regrow after farmland removal** (known gap) and **rack under glass** decision.
8. **Cup/cone vs clay table**: apply the owner's decision.
**Acceptance:** per-recipe tests; `brewing.test.ts` + `food.test.ts` counts updated; e2e for "tea with sugar" and "tap -> syrup -> sugar"; buffs UI icon for each buff (HUD buff row) at 44 px.

### Stream F - World and progression (biomes, objectives, Codex, balance)

**Owns:** `src/content/{objectives*,progression,loot,oreVeins,creatures,automatons,emberbound}.ts`, `src/world/*`, `src/mobs/*`, `scripts/codex/*`, `docs/PROGRESSION.md`, `docs/api/{world*,mobs,emberbound*}.md`.
Designs:
1. **Objectives per age renumbered** and a single `objectives.ts` index so goals are in one ordered list per age with `requires` links (so the HUD tracker never shows a goal whose prerequisite machine isn't built). New conditions: `rpm`, `fluid`, `aspect`, `research` (typed, since 3+ goals need them).
2. **Bronze goal chain** written to match STEAM/BRONZE plans: Bronze Furnace -> boil water -> shaft turns -> grind -> gear up -> saw planks -> heat moves -> build a boiler -> raise steam -> safety valve -> piston power -> compress air -> vacuum chute -> press plates -> blast nozzle (adds to the existing workshop goals, with `six_cups` optional).
3. **Codex progression tree** shows the single spine (heat -> steam -> motion -> air -> watts) with each system as a branch colour; planned items grey; research tree linked; distillery process cards as a branch.
4. **Biomes with purpose per age**: a `peat bog` (Ember: peat, wild tea), `mesa/clay flats` (Bronze: copper, tin, clay), `coal ridge` (Forge), `quartz dunes` (Current), `ruin deep` (Atomic). Spawn picks so the player finds every age's raw materials within a walk; resources are on **ore veins** (`oreVeins.ts`).
5. **Emberbound / ruin scaling**: each age's guardians drop that age's late material (e.g. Bellows Hounds drop leather for belts), and unlock a **sound cue** when you enter a ruin of the next age (teaser).
6. **Balance pass**: one spreadsheet-like test (`balance.test.ts`) prints time-to-gate for each age under an idealised player: target ~45 / 45 / 55 / 60 / 60 min (PROGRESSION). Tune fuel, furnace speeds and stress numbers.
7. **Star hearth decision** (X7).
**Acceptance:** `objectives.test.ts` proves every goal is reachable in order (existing playthrough test extended to Bronze); Codex builds without warnings; `balance.test.ts` thresholds; world map script shows resource distribution.

### Stream G - Final integration and playtest

**Owns:** `docs/*` (consistency), `src/content/content.test.ts` graph tests, `scripts/e2e*.mjs` chain, `package.json` chain, `docs/PLAYTEST.md` (new). Last, after A-F are merged by the owner.
Tasks:
- **G1 Docs reconcile**: fix X1-X5, delete duplicated plan text now built (replace with status boxes and pointers), regenerate the handoff bundle.
- **G2 Graph tests** (new `src/content/congruence.test.ts`): every item is obtainable (some recipe/drop/loot/reward/Dev), every non-trivial item is used (input, placeable, consumable, reward) or flagged `decor`; no recipe lower than its age gate (age >= max input age except natural materials); every fluid has a source and a sink; every `FluidKey` has a bucket or canister path or is flagged pipe-only; every block has an aspect fingerprint beyond `CATEGORY_BASE`; every objective chain reachable; every `SfxName` has a recipe; every status sentence <= 70 characters.
- **G3 Whole e2e chain** on GPU with diagnostics; fix red.
- **G4 Playtest checklist** below.
- **G5 Republish** the game artifact and Codex; save/load roundtrip with old-save fixture.

---

## 6. Cross-stream integration ideas (single concrete designs)

These live between streams; owners are noted so that nothing is built twice.

| Idea | What the player sees and does | Owner |
|---|---|---|
| **Lubricant raises shaft capacity** | Fill a can from the distillery spout (residue), press Use on a shaft: oil sheen runs along the axle, goggles say "oiled, 9 min", loads stress shows 80%; sloppy shafts squeal (filter) when un-oiled and near capacity | B + C |
| **Essentia in the still** | Hold a jar of `cinder` against the boiling flask rig; the glass glows orange; a "Cinder Essence" bottle results; essence added to a tea at the cup makes a long-lasting warm drink | B + D + E |
| **Oil and fuels** | Crude from a bog or oil shale pump -> still column cuts; kerosene lamp (Bronze light), gasoline/diesel/ethanol for chainsaw, tractor, combustion generator; each tank labelled with colour | B |
| **Ground items on belts** | Drop an item on a belt; it rides; funnels filter; a magnet collector at the end drops into a crate with the lid opening | C |
| **Sugar and alcohol in brewing** | Sugar at the cup raises speed; spirit in a tincture extends buff duration; cost: well-fed burns and aim sway | E |
| **Aspects on every new item** | Notebook scan of a new part reads like a sentence: "Windmill: Gale and Drive" with a research hint | D |
| **Belts into crates** | Belt end touches crate: items are taken at 1/s; crate fills; HUD shows count when goggles on | C |
| **Servants on cranks / treadwheels** | A clay servant grinds at a quern; spring jar feeds it; you see it tire and brighten | D + C |
| **Tractor power take-off** | Park the tractor by a shaft: engine note changes, 24 rpm to the shaft; fuel drains; chainsaw fuel is the same can | C + B |
| **Vacuum / magnet collectors** | Pump or magnet reaches 9 blocks; items stream to the collector with a pop; electromagnet in Current uses watts | A + C |
| **Weather affecting machines** | Wet belts, wind-driven mills, frost on wheels, lightning striking a metal vane makes `spark` | C + D + A |
| **Hunger and buffs from new foods and drinks** | One `DRINK_HUNGER` table; HUD buff row icons; alcohol buff has a cost | E |
| **Steam plan vs workshop vs distillery vs essentia tubes** | One shaft world (workshop), one fluid world (pipes) with air/steam as fluid keys, one tube world rebuilt on the pipe graph, one still with essences: no parallel systems | A + B + C + D |

---

## 7. Playtest checklist (desktop and phone portrait, Dev Mode off then on)

Run on a real GPU with `?diag=1`. Mark each with: pass, feel notes, bugs. A hand-playthrough **has not been done** for the newest systems (WHATS_LEFT).

**Ember (45 min):** spawn near trees/stone/clay/water; hunger and cold readable; furnace placed and lit; charcoal; copper then bronze cast by hand (first pour moment); hand quern -> flour -> dough -> bread; tea brew (boil pail, cup, cone); phone: every action reachable with thumb, targets >= 44 px; goals advance in order; gate list on the furnace screen is legible.
**Bronze:** bronze furnace upgrade; crank + axle + quern; belts + funnel + chute + basin + mixer (the grain-to-dough line); goggles on every part; windmill and kettle/rotor (after A); boiler, valve whistle; compressor, air tank, pneumatic press; vacuum chute; lubricant can; overstress and shear pin; clutch and gearshift card; signals (lever, plate, bell); skiff ride; tally board; clockface.
**Forge and later:** blast hearth, iron/steel, trip hammer, dynamo, first lamp; arc hearth; electric still; tractor and chainsaw with ethanol; PTO into a mill; magnet collector; fission pile; star ignition.
**Cross-system:** distillery run (wash -> spirit -> fuel -> chainsaw; residue -> lubricant); notebook scan, research board, rod and jar, altar infusion, servant on crank; Sugar Rush (tap -> syrup -> sugar -> bun) and its penalties; weather during machines; save/quit/continue with an old save and a new save.
**Quality gates:** no page scroll on phone; no text clipped; frame time stable at 20 view chunks; audio volume balanced across machine ambiences; no UI screen needed for any core loop (screens only: furnace, notebook, rune desk, Codex, settings); Codex shows each item with its recipe and aspects.

---

## 8. Open decisions for the owner (defaults in parentheses)

1. Star hearth casings: keep 93 or reduce (keep, add compact shell option).
2. `six_cups` optional (yes).
3. Delete cup/cone forge recipes in favour of Clay Table (yes).
4. Create `main` so pages.yml publishes (after G).
5. Tractor PTO available before Forge (yes, as a late convenience).
6. Display names for the Forge-era steam parts: `steam_dynamo`, `furnace_boiler` (see D3, D4).
7. Whether shaft materials (wooden, iron, steel) are separate block keys (separate keys).

<!-- ======================== END docs/CONGRUENCE.md ======================== -->


---

<!-- ======================= BEGIN docs/lanes/README.md ======================= -->
# FILE: docs/lanes/README.md

# Lane protocol (every lane architect and builder reads this first)

The overhaul runs as parallel **lanes**. Each lane has an **architect** (heads the lane: contract, task cards, review, never certifies
its own code) and **builders** (one task card each, disjoint files). The coordinator (the owner's main session) merges lanes after
verifying them. Rules of `docs/team.md` apply: whoever writes code does not certify it; the coordinator re-runs the gates itself.

Lanes: **A** Steam and Bronze mechanics, **B** distillery, **C** workshop (Create-style), **D** magic (Essentia and Research),
**E** food, farming, brewing, sugar, **F** world, progression, art and audio, **U** phone UX, HUD and onboarding.
Source of truth per lane (advisor dossiers, builder-ready, with task lists and file ownership): `docs/advice/`:
A `tech-spine.md`, B and C `distillery-workshop.md`, D and E `magic-and-food.md`, F `world-progression-art.md`, U `phone-ux.md`;
cross-cutting: `CONGRUENCE.md` (conventions, name clashes, streams), `balance-economy.md` (numbers; applied by the integration lane),
`engineering-risk.md` (perf, saves, tests, merge safety).

## Setup (once per lane)
1. Your worktree is your own checkout on branch `lane/<x>` cut from `ccr-3c8b169f-e78nk2`. Work ONLY inside it, never in `E:\Projects\game`
   (the main checkout) and never in `C:\Users\admin\game` (a junction to it).
2. No `npm install`: junction the shared modules: `New-Item -ItemType Junction -Path <worktree>\node_modules -Target E:\Projects\game\node_modules`
   (PowerShell). Playwright and Chromium live there; never run `npm install` in a lane.
3. Ports and dirs: use `HW_LANE=<x>` and pick your dev port as 5180 + the lane's index (A=0 ... U=6); build to `<worktree>\.cache\dist` with
   `node scripts/build.mjs --out=<worktree>\.cache\dist`, never into the main checkout's `dist/` (the owner serves that on 5173).
4. Foundation: a serial **foundation** session lands shared fixes on `ccr-3c8b169f-e78nk2` (line endings, save `rev` + migration chain, block-id
   lock file, folder registration, content-test refactor, hardened save modules, lane tooling). The coordinator messages you when it merged:
   then `git merge ccr-3c8b169f-e78nk2` into your lane branch (resolve in favour of the foundation for shared registries) BEFORE builders start coding.
   Until then, architects write only docs (`docs/lanes/<x>.md`) and spikes that do not touch shared registries.

## Gates (a task is Done only after all of these, run by someone other than its author)
- `npx tsc --noEmit` clean; `npx vitest run` green (use `vitest related` or a path filter inside a lane, the full run before reporting).
- The lane's own e2e script on desktop and phone portrait with `HW_GPU=1 HW_DIAG=1` (build to your own dir; e2e scripts take `--no-build`/`--out` where
  they exist; if one still hardcodes `dist/` or a shared tmp dir, fix the script first as the lane's first task).
- Solver still completes the game; roster/Codex fixtures updated; `docs/api/<system>.md` written; screenshots LOOKED at.
- Heavy jobs (full vitest, full e2e) take a machine-wide lock so only one runs at a time on this 12-thread/16 GB box: `mkdir E:\Projects\game\.gate-heavy`
  (wait 60 s and retry while it exists), `rmdir` when done, also on failure. Fast gates need no lock.

## Collision rules
- New systems go in NEW files/folders (`src/<system>/`, `content/*<Name>.ts`, `render/<system>/`, `scripts/e2e-<name>.mjs`); touch shared registries
  (`items.ts`, `recipes.ts`, `blocks.ts`, `progression.ts`, `objectives.ts`, `game.ts`, `types.ts`, `gameEvents.ts`, `painters.ts`, `package.json`) with the
  smallest possible one-line additions, APPEND-ONLY, re-reading the file right before editing. Block ids are positional and saved: only append blocks, never
  reorder or delete (the foundation's id lock file enforces it). Renaming or removing an item key needs an alias entry so old saves keep their items.
- Every persisted system needs: a save key, load that never throws and never overwrites good data with empty, a golden-save row, `diag()` points
  (`<sys>.load/.rebuild/.state`), a perf row, and an e2e step.
- Commit often to your lane branch with the attribution line `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`; commit only your own files; never
  revert others' edits; no push, no `main`.

## Roles and reporting
- **Architect:** reads the dossier and `CONGRUENCE.md`, writes `docs/lanes/<x>.md` (contract: data types, file ownership per task card, order, acceptance checks,
  what other lanes must provide or consume, and which of the dossier's open questions you answered), then runs the lane: starts or briefs builders
  (a builder is a session started with `use_worktree: false` INSIDE the lane worktree path via `cwd`, or by messaging the coordinator to start one), reviews every
  builder's diff and gate output (never their summary), and reports to the coordinator at each milestone and when the lane is done: commits, gate counts,
  what is left. If you cannot start sessions yourself, say so and implement the task cards yourself in order with an independent review pass from a builder
  the coordinator starts.
- **Builder:** one task card at a time, its files only, tests first where possible, stop and report when the card's acceptance checks pass.
- Messages between lanes go through the other architect (`SendMessage` to its session id, which the coordinator lists in `docs/lanes/ROSTER.md`).

<!-- ======================== END docs/lanes/README.md ======================== -->


---

<!-- ======================= BEGIN docs/lanes/ROSTER.md ======================= -->
# FILE: docs/lanes/ROSTER.md

# Lane roster (session ids, for SendMessage between architects)

| Lane | Role | Session id | Branch |
|---|---|---|---|
| Coordinator | main session | `local_4bdc7aa5-0ceb-445b-9336-843dec94f1d4` | `ccr-3c8b169f-e78nk2` (main checkout `E:\Projects\game`) |
| Foundation | saves, ids, registration, lane tooling | `local_2070b517-8040-477a-81e1-0881ff431bb4` | `ccr-3c8b169f-e78nk2` (main checkout) |
| A | Steam and Bronze | `local_d8955f5f-ea2a-4586-bf35-8305b0837bdc` | `lane/a` |
| B | distillery | `local_dd8e1fe6-f348-4d73-8035-2b4cf2387cb9` | `lane/b` |
| C | workshop (Create-style) | `local_e81aaffc-7e88-4bc5-8afd-87366c84b22f` | `lane/c` |
| D | magic (Essentia and Research) | `local_817cc7ef-47e1-42aa-849a-3e65845ea250` | `lane/d` |
| E | food, farming, brewing, sugar | `local_4fd50b8d-4321-4de8-b75f-35aff6a46962` | `lane/e` |
| F | world, progression, art, audio | `local_25aa37e8-7094-4a81-a831-ad423509015b` | `lane/f` |
| U | phone UX, HUD, onboarding | `local_e79fec77-0aa6-4462-84ad-64795f62278c` | `lane/u` |

Branch names above are the intent; the app may add a prefix or suffix to the actual worktree branch: use `git branch --show-current` in your worktree.
Interlocks (who talks to whom): A<->C shared kinetic model; B<->C lubricant/arms/spouts; B<->A heat, pressure, engines; D<->C golems and cranks;
D<->B essentia in stills; E<->B spirits, potions, sugar; E<->D aspects of plants and creatures; F<->all new content keys, ages and Codex; U<->all HUD slots.

<!-- ======================== END docs/lanes/ROSTER.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/tech-spine.md ======================= -->
# FILE: docs/advice/tech-spine.md

# Technology spine - design dossier for the builders (Steam, Bronze, distillery rest, workshop polish)

Advisor note, 2026-11-21, branch `ccr-3c8b169f-e78nk2`. READ-ONLY pass: nothing was built or run; the six-age refactor (W0) was still in
the checkout, so line numbers can drift (symbol and file names are stable). Sources read: `STEAM_PLAN`, `BRONZE_PLAN`, `DISTILLERY_PLAN` s.15,
`OVERHAUL_PLAN` A, `WHATS_LEFT`, `team.md`, `CONGRUENCE.md`, `docs/api/{workshop,distillery,sim,transport,tech-content}.md`, and code in
`src/workshop/{kinetics,workshop}.ts`, `src/sim/{pipeGraph,fluidNet,hearthScan,...}.ts`, `src/content/tech*.ts`.
Items marked **(verify)** are claims I could not confirm in code.

Fixed by the owner (not relitigated): six ages Ember/Bronze/Forge/Current/Atomic/Star; Ember = handwork only; Bronze = steam, shafts, then the
boiler multiblock; Forge = iron/steel + dynamo at the end; Current = electricity and the modern steam turbine; furnace is the heart of the base;
original names; in-world interaction first, phone first.

---

## 0. The decisions that shape everything (read this first)

| # | Decision | Why |
|---|---|---|
| K1 | **One shaft world: `src/workshop` (kinetics.ts + workshop.ts). `MechSpec`/`mech.ts`/`mechGraph.ts` of STEAM_PLAN are NOT built.** Steam, wind and water become *source providers*, dynamo/compressor/pump become *load providers*, of that solver. | Built, tested, saved; 3000 lines. Matches CONGRUENCE D1. |
| K2 | **One power convention: shaft power W = `su x |rpm| x 3.125`** (`W_PER_SU_RPM = 50/16`). It is the *existing* `suPerW = 1/50` at 16 rpm, so nothing built has to change, and it makes every conversion a one-line ledger entry. | The plans' engine numbers (6 kW heat -> 768 su at 96 rpm = 230 kW) violate conservation by ~100x. See section 1.5. |
| K3 | **Energy ledger: heat (W) -> steam (L/s at 167 J/L) -> shaft (W) -> {work, air, watts}. Every arrow has an efficiency < 1 that lives in ONE table (`src/core/energy.ts`) and ONE conservation test.** | Free-energy loops are the biggest balance trap (section 4). |
| K4 | **Gas (steam, air) is a pressure model on the existing pipe graph, not a second graph.** `GasNet extends PipeNet` (like `FluidNet`), `PipeSpec.family` gains `'steam' | 'air'`; flood fill, joints, anchors, saving and pipe meshing are reused. Only **heat** (thermocouples) needs a tiny new graph (`heatNet.ts`, same flood helper). BRONZE_PLAN's full `netGraph<T>` generalisation of `pipeGraph.ts` is **dropped**. | `pipeGraph.ts` (318 lines) also carries the Forge item/fluid nets; rewriting it is the riskiest edit in the plan and buys nothing. |
| K5 | **No key renames, no re-meaning of existing keys.** Old `boiler`, `steam_engine`, `steam_turbine`, `water_wheel`, `wind_turbine` stay exactly as blocks/machines (display names change, `age` changes, `legacy` flag). New Bronze things get NEW keys: `boiler_plate`, `boiler_gauge_glass`, `beam_engine` (not `piston_engine`: collides with workshop `piston`), `mill_wheel`, `windmill`, `steam_kettle` (CONGRUENCE), `steam_rotor`. | Voxels store ids by palette key; an alias that points an old saved boiler at a vessel controller would silently convert saves. CONGRUENCE D3/D4 proposed renames; this supersedes them (record in its conventions sheet). |
| K6 | **Retire the watt->shaft bridge `GENERATOR_SHAFT` in `workshop.ts` (and `generatorWatts`).** Legacy generators produce watts only. The only shaft->watts bridge is the Forge `dynamo`; there is no watts->shaft block until Current. | Removes the loop generator -> shaft -> dynamo (section 4, R3). |
| K7 | **Engines draw steam in proportion to the shaft's load**, not at full rate (`Workshop.loadFraction(x,y,z)`), with a 10% idle draw. | Fixes "steam engine draws heat when idle" (SESSION_CONTEXT s.6) and gives the pressure gauge meaning. |
| K8 | The Bronze steam `steam` gas is **not** the pipe-fluid `FluidKey 'steam'` (1 L = 20 J, Forge/Current). Gas L are "volume at 1 bar of this network". No `FluidKey` change; families never join. | Avoids editing the closed `FluidKey` union and the old boiler/turbine numbers. |

---

## 1. The unified kinetic / heat / fluid model

### 1.1 Units (all new code uses these; nothing else)

| Quantity | Unit | Notes |
|---|---|---|
| Temperature | degC (float in sim, integer display) | `AMBIENT_TEMP_C` 20 |
| Heat flow | W (display kW) | furnace `extractW` bus (existing) |
| Gas amount | litres at network bar; `bar = L / volumeL` | steam and air |
| Liquid | L in code. "mL" appears only on glassware/beaker labels (CONGRUENCE 4.2). The user's "mL" = beaker sizes; machines are L | |
| Shaft speed | rpm signed | base 16 |
| Stress | su; **capacity** of sources, **load** of machines | `BASE_STRESS x clamp(16/|rpm|, .25, 4)` (existing) |
| Power conversion | `W_PER_SU_RPM = 3.125` | K2 |
| Electric | W (Forge dynamo end, Current) | existing |
| Pressure | bar (display 1 decimal) | |

Hard consequence of K2 and the existing stress formula: a machine's *load power* is `base x 16 x 3.125 = base x 50 W` at any rpm in 4..64 (constant power),
and *conservatively higher* above 64 rpm (clamp .25 keeps base x 0.25 su while pure physics would drop further). So gearing up never creates energy. Table of
machine powers: crank-fed quern/saw 4 su = **200 W**; drill 6 su = 300 W; hammer/press 8 su = 400 W; belt 0.25 su = 12.5 W.

### 1.2 The ledger (`src/core/energy.ts`, new, constants + tiny pure functions; T0)

```ts
export const W_PER_SU_RPM = 3.125;
export const STEAM_J_PER_L = 167;           // 1 kW of heat = 6 L/s of steam (BRONZE_PLAN 5.2, kept)
export const WATER_PER_STEAM = 0.1;         // L water per L steam (kept)
export const AIR_J_PER_L = 6.25;            // shaft energy stored per L of compressed air
export const ETA = {                        // every arrow < 1; one place to tune
  rotor: 0.06,                              // Hero-style open rotor: weak on purpose
  beamEngine: (bar: number) => Math.min(0.18, 0.04 + 0.025 * bar),   // 2 bar .09 ... 5.6+ bar .18
  steamHammer: 0.12, compressor: 0.75,
  dynamo: 0.85,                             // Forge
  hotPlate: 0.9, thermocoupleLossPerBlock: 0.02,
} as const;
export const suFromW   = (w: number, rpm: number) => w / (Math.abs(rpm) * W_PER_SU_RPM);
export const wFromSu   = (su: number, rpm: number) => su * Math.abs(rpm) * W_PER_SU_RPM;
```

Test (`src/core/energy.test.ts`, T0): for every source provider at its max, `shaftW <= heatW_in x ETA`, and for every pair of converters that can chain
(`dynamo` then any watts->shaft block, `compressor` then pneumatic tool, `mech_pump` then wheel) the product of efficiencies is < 1.

### 1.3 Three layers, one pattern

```
HEAT  (W)         furnace fire  --draw--> {kettle, thermocouple net, boiler heat port, still base, brewing pail, hot plate}
  |  furnace.extractW is the single bus (exists). All draws go through heat.draw(); losses are paid by the fire.
GAS   (L, bar)    boiler / kettle --steam--> {beam engine, rotor, steam hammer, whistle, valve}        (family 'steam')
                  compressor --air--> {tank, pneumatic press/drill/hammer, vacuum pump, blast nozzle}  (family 'air')
SHAFT (rpm, su)   source providers  --solveNetwork()-->  load providers (machines, dynamo, compressor, mech_pump, stirrer)
```

Each layer is "a network of members + a pure tick function + entities saved on an anchor + a snapshot for render". No layer reaches into another except
through three narrow seams, all declared in T0 so builders do not edit each other's files:

| Seam | Contract (file) | Producer -> consumer |
|---|---|---|
| Heat draw | `sim/heat.ts`: `drawHeat(f: FurnaceEntity, wantW: number, minTempC: number): { gotW, tempC }` (`f.extractW += gotW`, capped by what the fire can give this tick; refuses under `minTempC`) | all heat users |
| Steam use | `GasNet.take(L)`, `GasNet.put(L)`, `net.bar`; engines call `take` | boiler/kettle put, engines take |
| Shaft | `workshop/sources.ts`: `SourceProvider`, `LoadProvider`, `Workshop.addSourceProvider/addLoadProvider`, `Workshop.loadFraction()` | gas users that turn shafts |

### 1.4 Data contracts (append-only; T0 lands all of them in one commit so builders start from a green tree)

```ts
// core/types.ts (append)
export interface HeatSpec { role: 'conductor' | 'user' | 'port'; capW?: number; demandW?: number; minTempC?: number }
export interface GasSpec  { family: 'steam' | 'air'; role: 'pipe' | 'tank' | 'user' | 'source' | 'valve' | 'gauge' | 'port' | 'station';
                            volumeL: number; ratedBar: number; minBar?: number }
// BlockSpec: heat?: HeatSpec; gas?: GasSpec; legacy?: boolean (hidden in Codex, still works)
// PipeSpec.family: 'item' | 'fluid' | 'heat' | 'steam' | 'air'   (BlockShape 'pipe' reused; families never join)
export interface StructureRules { key: string; controller: string; walls: string[]; interior: 'air';
  minInner: [number, number, number]; maxInner: [number, number, number];
  faceParts: string[]; roofParts: string[]; required: Record<string, number> }
// MachineRole gains 'vessel' (boiler controller) and 'gas' (steam/air devices that own no watts and no shaft)

// workshop/sources.ts (new)
export interface Env { windAt(x:number,z:number):number; flowAround(x:number,y:number,z:number):number; skyOpen(x:number,y:number,z:number):boolean; dt:number }
export interface SourceSample { rpm: number; powerW: number }            // capacity = suFromW(powerW, rpm)
export interface SourceProvider { kinds: readonly string[]; sample(c: Cell, env: Env): SourceSample | null }
export interface LoadProvider   { kinds: readonly string[]; minRpm: number; wantW(c: Cell, rpm: number): number; give(c: Cell, gotW: number, dt: number): void }
// Workshop: loadFraction(x,y,z): number  // 0..1 stress/capacity of the network that cell is on (1-tick old)

// core/gameEvents.ts (append)  'steam:vent' {x,y,z,rateL}  'steam:warning' {x,y,z,bar,rated,on}  'steam:burst' {x,y,z,radius}
//   'air:leak' {x,y,z}  'boiler:formed' | 'boiler:unformed' {x,y,z}  'boiler:dry' {x,y,z,seconds}  'heat:burn' {x,y,z}
//   'distill:step' {rig, from, to}   flags: first_motion heat_moved boiler_formed engine_turning air_2bar tube_delivery press_job geared_up shaft_bellows
// SfxName: valve_shriek boiler_burst boiler_formed boiler_rattle air_hiss beam_creak pneumatic_thump tube_whoosh steam_whistle scald kettle_rumble
// core/constants.ts: the BRONZE_PLAN list (THERMO_*, BURST_SECONDS 5, AIR_MAX_BAR 6, DRY_WARN_S 5, DRY_WARP_S 20, VALVE_MAX_VENT_L_S 400, ...) minus the ones in energy.ts
```

### 1.5 What the plans got wrong, numerically (so nobody copies them)

| Plan number | Implied shaft power | Heat in | Verdict |
|---|---|---|---|
| STEAM_PLAN rotor 32 rpm x 256 su, 20 L/s (3.3 kW) | 25.6 kW | 3.3 kW | 8x free. **Use 16 rpm x 4 su = 200 W (6%).** |
| BRONZE_PLAN engine 6 bar: 96 rpm x 768 su, one 6 kW port | 230 kW | 6 kW | 38x free. **Use ledger: 1.8 kW from a 10 kW port.** |
| STEAM_PLAN water wheel 64 su per flowing side, 16 rpm | 3.2 kW per side | free | dwarfs steam. **Mill wheel 6 su/side (300 W), max 3 sides.** |
| Old watt generators as shaft sources `W/50 su` | consistent with K2 | - | consistent, but breaks the loop rule (K6) |

Worked example that becomes `steam.test.ts` (smallest vessel: interior 1x1x2 = 2 cells, steam volume 2000 L, + 10 steam pipes 1000 L = 3000 L; one heat port, **10 kW**):
steam made `10 kW x 6 = 60 L/s`. One beam engine draws `10 L/s per bar` at full load -> equilibrium `bar = 6`, `eta = .18`, shaft `.18 x 60 x 167 = 1.8 kW`, rpm 96,
**capacity 6.0 su**. Two engines: 3 bar each, `eta = .115`, 576 W each, 48 rpm, 3.84 su each, total 1.15 kW (< 1.8 kW: the player learns that one hot engine beats two cool ones).
No user, no valve: 60 L/s into 3000 L = 0.02 bar/s: 7 bar in ~5.8 min, burst 5 s after crossing the rating. (Tune by `HEAT_PORT_W`, never by shrinking volume.)

### 1.6 Existing code: reuse / retire / rename

| Existing | Fate |
|---|---|
| `workshop/kinetics.ts` `solveNetwork`, `passOn`, `BASE_STRESS` | **Keep.** Extend: add dynamic loads (section 3.1), new part kinds (engine, rotor, windmill, mill_wheel, compressor, dynamo as kinds with `BASE_STRESS` 0 + provider). |
| `workshop.ts` `GENERATOR_SHAFT`, `generatorWatts`, `extraRpm` | **Retire** `GENERATOR_SHAFT`/`generatorWatts` (K6). `extraRpm` becomes `SourceProvider`s. Tests that touch generator shafts are rewritten (T1). |
| `workshop.ts` `LUBE` (residue 1.25 x 10 min, pine resin 1.1 x 5 min) | Keep; move the table to `content/lube.ts` (data) so the distillery adds `lubricant_can` without touching `workshop.ts` (T0). |
| `sim/pipeGraph.ts`, `pipeNet.ts`, `fluidNet.ts`, anchors, `transport.ts` | **Reuse** for gas: add `GasNet extends PipeNet`; `Transport.tick` also ticks gas nets after furnaces; family tables get two entries. No change to item/fluid behaviour (tests prove it). |
| `sim/itemNet.ts` (packets, destinations) | Reuse for the Bronze Chute with a `suction` flag (section 2.8). |
| `sim/hearthScan.ts` (441 lines) | Extract the box-scan core into `structureScan.ts` **inside T4** with hearth tests unchanged and green; the boiler is a second client (BRONZE_PLAN 14.5 stands). |
| `sim/fluidMachines.ts` boiler/turbine, `content/tech*.ts` boiler/steam_turbine/steam_engine | Untouched logic. Display names: `boiler` -> "Furnace Boiler", `steam_engine` -> "Steam Dynamo"; `age` -> Forge/Current; recipes unchanged; Codex shows them under their age. Add `legacy:true` only if W0 removes their recipes. |
| `game/collectors.ts` (vacuum/hand pump) | The ONE pull algorithm (CONGRUENCE D7). The chute's vacuum pump registers a collector kind. |
| `sim/brewing.ts` / `distill.ts` `furnace.extractW +=` | Route through `drawHeat()` in T2 (mechanical edit, behaviour identical) so the bus has one door. |

---

## 2. Feature designs

Each: **Player sees/does** - **Numbers** - **Art/anim/sound** - **Status sentence** (<= 70 chars) - **Owns** (task id, section 5).

### 2.1 Wooden power: windmill and mill wheel (first rotation without fire) - T1
- *Player:* a windmill on a hillside, wooden axle down to a quern; a mill wheel in a stream. Goggles: "Windmill: 12 rpm, load 2/4 su".
- *Numbers:* `windmill` rpm `8 + 16 x w` (w = `windAt` 0..1, + altitude bonus `min(0.3, (y-62)/100)`), `powerW = 100 + 300 x w`, needs `skyOpen` and no other windmill within 5 blocks (spam guard, R4). Storm gust (w>0.9 for 3 s): load spike x1.5 -> a fitted shear pin snaps first. `mill_wheel`: 16 rpm, 6 su (300 W) per flowing-water side (flowing = variant>0 or falling), max 3 sides; frozen water (frost) gives 0; counts only the wheel's two lateral faces.
- *Art:* four-sail frame that turns by rpm, sails furl in a storm (idle at w<0.1); wheel with paddles whose water-side blades darken. Sound: windmill creak layer by w; wheel splash loop (reuse water ambience, volume by rpm). Texture painters in `render/textures/steam.ts`.
- *Status:* "Windmill: 12 rpm, wind 0.6, load 2/4 su" / "Mill Wheel: needs flowing water on a side".

### 2.2 Steam kettle + rotor: "heat makes motion" - T2
- *Player:* place the Copper Steam Kettle (`steam_kettle`) on a Clay/Bronze furnace, pour a pail in, put a `steam_rotor` on top, an axle beside it; the rotor whirls and the quern behind it starts.
- *Numbers:* kettle holds 4000 L water; boils when furnace >= 120 C: steam rate `20 L/s x demand` where demand = 1 only while a rotor (or whistle) wants steam (open kettle: no pressure, no burst); heat `3.3 kW` (`drawHeat`); rotor `eta .06`: **16 rpm, 4 su (200 W)** (one quern); two rotors split the kettle (each half). Dry kettle: `dryS` 5 s rattle, 20 s the kettle warps (becomes `scrap_metal`, toast). Refill by pail, pipe, or touching a water source (50 L/s).
- *Art:* riveted copper drum with sight glass whose level is the water fraction; steam puffs from the spout in time with the rotor; rotor = a hub with two bent jets, blur disc above 32 rpm-equivalent. Sound: low rumble `kettle_rumble` by boil rate, a rising whistle at the moment the first rotor spins (`first_motion`).
- *Status:* "Steam Kettle: boiling, 2800 L water, rotor 16 rpm" / "Boiling dry - add water".
- Also: the kettle takes the two brewing Use rows (fill a cup/pail with boiling water) by reusing `brewUse` (STEAM_PLAN s.2); it must not change boil rules.

### 2.3 Thermocouples, heat rods, hot plate, vent - T2
- *Player:* a bronze rod laid from the furnace along the wall; it glows by temperature and burns your hand; a Hot Plate at the far end cooks (every smelt recipe at the delivered temperature); a Heat Vent warms a room.
- *Numbers:* thermocouple 2%/block loss (ETA), 6 kW cap per network (bronze), 20 kW iron (Forge upgrade `iron_thermocouple`), burn threshold 300 C (1 dmg/s, `heat:burn`); users: hot_plate 500 W cooking, heat_vent 400 W (warmth radius 6), `heat_port` up to 10 kW into a boiler. Network heat is **charged to the furnace** `gotW / 0.98^n` (the fire pays losses).
- *Algorithm (replaces BRONZE_PLAN 14.2 detail):* per rebuild BFS distances; per tick sort users by distance, `drawHeat` against the best `T x 0.98^n` source; store `Tblock` in a typed array for the renderer and `hotAt()` query (2 Hz survival scan).
- *Art:* rods use three emissive tile steps by `Tblock` (cheap, no per-vertex); at night the rod is a glowing line; the hot plate's top tile glows. Sound: faint tick as rods heat.
- *Status:* "Thermocouple: 640 C, 2.1 kW through" / "Hot Plate: cooking, 640 C".

### 2.4 Boiler multiblock (the age's big build) - T4
- *Player:* Structure planner ghost shows the shell; place plates around a furnace-fed volume, add heat port(s), water port, steam port, a Gauge Glass in a side face. On the last block the shell *flashes seams* and rings (`boiler_formed`); the gauge glass shows water; pressure on the goggles and as a needle on the glass.
- *Numbers (BRONZE_PLAN s.6 stands except where noted):* shell `boiler_plate` 8 bar; interior 1x1x2 .. 3x3x4; capacity water `2000 x cells` L, steam volume `1000 x cells` L; heat 10 kW (`HEAT_PORT_W`) per heat port; dry fire 5 s warn / 20 s warp; smallest vessel 34 blocks (30 plates + glass + 3 ports) - raise plate yield to 3 per 2 ingots if the solver says wall.
- *Rules:* formation scan on change, retry only when the player is within 16 blocks, sweep one cell per 4 ticks when formed; entity kind **`boiler_vessel`** (NOT `boiler`, which is a legacy machine kind), saved on the gauge-glass cell: `{kind:'boiler_vessel', waterL, dryS, formed:{x0,y0,z0,x1,y1,z1}}`.
- *Safety:* valve + burst (2.5). Burst scalds within 4 (6 dmg, cause 'burn'), destroys the weakest member, never chains.
- *Art/Sound:* formed twin textures (rivets align across cells); gauge glass level + needle in the parts layer; simmer ambience by pressure; `boiler_rattle` while dry; `boiler_burst`.
- *Status:* "Boiler: 5.4 of 8 bar, water 3200 L, 10 kW in" / "Boiler pressure high - 7.2 bar of 8".

### 2.5 Steam network, pressure, valve, burst - T3
- *Rules:* BRONZE_PLAN 5.2 with these changes: gas on the pipe graph (K4); `makeL = heatW/167 x dt` consuming `makeL x 0.1` water; sag 0.2%/s; valve vents `(bar-set) x volume` capped 400 L/s with `steam:vent` (1/s) and plume; rating = min `ratedBar` of members; `overS += dt` above rating, burst at 5 s, decays at 2x; warning from rating-1 (`steam:warning`, gauge shake). Players choose valve 2/4/6/8 by Use.
- *Signature moment:* the safety valve sings (`valve_shriek`, a rising-then-steady whistle with white plume) before anything bursts.
- *Pipe look:* bronze pipes with white collar near joints; warm to touch? no (only rods burn). `pressure_gauge` shows the needle for its network.
- *Status:* "Steam Pipe: 4.2 bar" and the gauge target name "Pressure Gauge - 5.4 bar".

### 2.6 Beam engine and steam hammer (the first strong source) - T3 (gas side) + T1 (shaft side)
- *Player:* a beam engine (a rocking beam over a cylinder and flywheel) next to the boiler; the beam rocks in time, the shaft turns, the goggles read "96 rpm, load 3/6 su".
- *Numbers:* min 2 bar; full-load draw `10 L/s per bar`; draw = `full x max(0.1, loadFraction)`; output per K2/ledger: `powerW = ETA.beamEngine(bar) x draw x 167`, `rpm = min(96, 16 x bar)`; 2 bar -> 32 rpm; 4 bar -> 64 rpm; 6 bar -> 96. Flywheel on the shaft evens the beat. `steam_hammer`: 4 bar, 30 L a blow, ingot -> plate in 1.5 s (bronze only; same recipe rows as the stone-anvil strokes via `recipesHand` twin rule).
- *Art:* beam pivots +-18 deg with phase = integral of rpm (never jumps on rpm change: STEAM_PLAN 14.4); piston rod, steam puff at each stroke from the cylinder; flywheel spokes. Sound `beam_creak` at stroke rate (pitch by rpm), `piston` ambience.
- *Status:* "Beam Engine: 3.4 bar, 54 rpm, load 3/4 su" / "Needs 2 bar - has 1.3".

### 2.7 Air and pneumatics - T6
- *Player:* a compressor on a shaft (needs >= 32 rpm) puffs air into copper tubes to a tank; a pneumatic press stamps plates; a Use of the air hammer on the tank refills it. Open tube ends hiss and leak.
- *Numbers:* compressor 1.5 L/s per rpm (so 48 L/s at 32 rpm) for a load of 8 su base x (16/32) = 4 su = 400 W at 32 rpm; stored energy `48 L/s x 6.25 J = 300 W`, i.e. eta .75 (`ETA.compressor`); max 6 bar; stalls; `air_tube` 50 L, leak 100 L/s per open end; `air_tank` 4000 L; press 3 bar min, 200 L per 2 s job; drill 3 bar, 100 L/block, tier 3; air hammer pickaxe tier 3, 60 charges; blast nozzle 2 bar, 20 L/s while the hearth burns (gate to Forge, 2.9).
- *Art:* copper tubes with glass windows (same mesh code as essentia tubes); packets visible as brass capsules for the tube post; tank with a dial; hiss puff particles at leaks. Sound `air_hiss` (by leak), `pneumatic_thump`, `tube_whoosh`.
- *Status:* "Air Tank: 4.8 of 6 bar" / "Compressor: needs 32 rpm - has 16".

### 2.8 Vacuum-drawn Bronze Chute - T6 (uses `collectors.ts`)
- *Player:* glass-ended bronze chutes carry items only toward a running Vacuum Pump; items rattle through at 8 blocks/s and land in the chest next to the pump.
- *Implementation (no second pull algorithm, CONGRUENCE D7):* `item_pipe` keeps its `ItemNet`; add `net.suction = pumpsOnNet.some(running)`. With suction, every port in `pull` mode and every dropped-item collector adjacent to the net seeds packets whose **destination is the nearest running pump** (BFS distance cached per rebuild); without suction packets do not move. The pump's own collector (radius 3) registers in `game/collectors.ts` as a `CollectorKind` (one definition, like the electromagnet later).
- *Numbers:* pump needs >= 2 bar air (its own `air_tube`), 30 L/s while items move, pulls 16 items per 0.5 s, buffer 9 slots or the touching inventory. The Ember Age has no item pipes (BRONZE_PLAN 5.4).
- *Pseudocode:* section 3.4.
- *Status:* "Vacuum Pump: 3.1 bar, moving 12 items/s" / "Vacuum Pump: needs 2 bar air".

### 2.9 Blast nozzle gate to the Forge - T6
`requiredParts: { blast_nozzle: 1 }` on the tier-3 structure (hearth data), nozzle satisfied when `airNet.bar >= 2`. Edits only the hearth table + a one-line check in `hearthScan` (shared with T4: T6 waits for T4 to land). Signature moment: hearth flares white when air arrives.

### 2.10 Shaft hooks for the distillery - T1 (API) + T8 (use)
- `Workshop.driveAt(x,y,z): { rpm, loadSu, capacitySu } | null` is the single read API for any non-workshop machine on a shaft (also the vacuum cap pump and the stirrer).
- **Stirrer** (`still_stirrer`, load provider, 2 su): on a still base's top it lowers batch time by `min(0.3, rpm/64 x 0.3)` and raises purity +2%; needs rpm >= 16.
- **Vacuum cap pump:** a `vacuum_cap` on a vessel is a `LoadProvider` (4 su at 32 rpm) that lowers boiling points (see 2.11).
- **Lubricant:** `LUBE` data (content/lube.ts) gets `lubricant` (x1.4, 15 min). Oiled shafts show an oil sheen tile overlay + quieter loop; goggles "oiled, 9 min".

### 2.11 Distillery remaining list - T8 (all inside `src/sim/distill*`, `core/chem|distill`, `content/*Distill`)
Priority order and designs (DISTILLERY_PLAN s.15):

| # | Item | Design | Numbers/rules |
|---|---|---|---|
| 1 | Ground burner | `still_burner` block: hand-fed charcoal (or fuel-ethanol beaker) under a still base; same `drawHeat` bus source (a pseudo-furnace entity `BurnerEntity {fuelS, tempC}`) | charcoal 4 min per item at 3 kW max 350 C; ethanol 0.25 L/min at 2 kW, 120 C cap; visible flame, sound crackle; Ember comfort |
| 2 | Reflux head | segment kind `reflux`: returns a fraction of condensate down the column: +1 effective tray | purity grade up one step if >=1 tray; lowers rate 25% |
| 3 | Filter bed | vessel module with sand + charcoal items; slop -> water, residue cleaned of ash | 1 item per 100 L, consumed |
| 4 | Lubricant | vacuum cap on `residue` -> `lubricant` fluid + `bitumen` residue; `lubricant_can` (`empty_canister` filled at a tank `spout`); chainsaw bar oil uses the same can (`felling.ts` consumer: 1 mL per second of cut... use 10 L-equivalent per can = 5 min) | process card `vacuum_residue` (350 C at 0.3 bar via cap pump) |
| 5 | Bitumen / asphalt | `bitumen_block` (slope-friendly road, +20% walk speed on it) and `asphalt` (Forge) | speed effect read in `player` via block `speedFactor` **(verify field exists)** |
| 6 | Potions / essences / tinctures | reaction cards: `distill_essence` (jar aspect `cinder/brook/gale/...` + spirit under vacuum cap -> `<aspect>_essence` vial, 1 per 4 L spirit), tincture (essence + spirit at the cup via `brewBuffs`), elixir (+heal over time); Spirit drink = Warmed (+cold resist) then Tipsy (aim sway) | one `DRINK_HUNGER` table (E owns); essence fingerprints via aspectTable overrides (D) |
| 7 | Tanks and receiver->tank pipes | add all 11 distillery fluids to `tank` `accepts`; a `chem_port` outlet joins a fluid pipe | tank tests per fluid; e2e receiver->pipe->tank |
| 8 | Catalyst bed, pressure cap, cracker, refinery tower | Forge multiblock via `StructureRules` (T4's scan): tower of N segments with side draws; `catalyst_bed` item consumed 1 per 500 L; pressure cap needs air net >= 3 bar (T6) | table of cuts by height (core/chem) |
| 9 | `distill:step` event, sounds, Codex branch | event on module state change (idle->working->done), sfx `still_bubble` loop, `still_drip`; Codex branch edit is the scripts session's | |
| 10 | Rig screen and ghosts | recipe-card ghost from `PROCESS_CARDS.rig`; problems already in crosshair line; **no new screen** unless the card picker needs one (one sheet, phone full-screen) | |

### 2.12 Workshop polish list (WHATS_LEFT s.2) - T7
| Item | Design (in-world) | Acceptance |
|---|---|---|
| Smooth tween of moving structures | contraption renderer interpolates pose between sim steps (position at render dt, never snap); player carried by skiff uses delta of the structure | skiff with player moves 20 blocks, collision never desyncs >0.05 |
| Riding the skiff | Use on skiff sits you (`riding` flag locks input except dismount: Jump); view bob by grade | headless: ride rail, dismount on end |
| Tame animals on treadwheel | `Workshop.standingOn` also asked of `mobs.tamedAt(x,y,z)`; goat 12 rpm/24 su, tires after 4 min (stamina), needs food; horn calls it | mob test |
| Vacuum-pump hookup | `vacuum_collector` becomes an optional consumer on a compressed air tube (2 bar) as well as a shaft; Bronze version unchanged | depends on T6 |
| Continuous spouts from pipes | `spout` on a fluid pipe network end fills any container on a depot/belt each second (pull from net, 250 L/s) | e2e: tank->pipe->spout fills 3 cans |
| Punched gearshift cards | `gear_card` item (3 presets + player-punched: 8 steps, set by Use cycling at a Punch Bench... reuse workbench with tool), Use on gearshift loads it | program persists in save (`s`) |
| Vault growth | vault multiblock adds 108 stacks per adjoining vault block, max 4 | logistics test |
| Trinkets | wind vane (reads `windAt`), weather cock, spyglass (long-press zoom), horn, padlock chest, lantern chain: one block each, status sentence | roster + textures |
| Belts cross structure borders | belt end hands items to a belt in a neighbouring contraption | contraption test |
| Weather on machines | rain x0.8 belt speed outdoors, frost thickens mill wheel flow | goggles "wet belt" |

---

## 3. Pseudocode for the hard parts

### 3.1 Solver: providers, dynamic loads, load fraction (T1; `kinetics.ts` stays pure)

```ts
// workshop.ts per network (replaces sourceFor + GENERATOR_SHAFT)
sources = new Map()
for key in members:
  p = parts[key]
  s = crank/clockwork/treadwheel/pto/flywheel (as today)
     ?? providerFor(p.kind)?.sample(cell, env)            // {rpm, powerW} -> {rpm, capacity: suFromW(powerW, rpm)}
  if s: sources.set(key, s)

solved = solveNetwork({ ..., sources })                    // static BASE_STRESS loads, as today
// pass 2: dynamic loads (dynamo, compressor, mech_pump, stirrer, vacuum cap)
dyn = 0
for key in members where loadProviderFor(kind) and solved.rpm.has(key):
  lp = provider; r = |solved.rpm[key]|
  if r < lp.minRpm: lp.give(cell, 0, dt); continue
  want = lp.wantW(cell, r)                                  // e.g. dynamo: electric demand W / ETA.dynamo
  wantSu = suFromW(want, r); dyn += wantSu; want[key] = want
spare = max(0, solved.capacity - solved.stress)
scale = dyn > 0 ? min(1, spare / dyn) : 1                   // loads share the spare; static loads win
for key: lp.give(cell, want[key] * scale, dt)
total = solved.stress + dyn * scale
overstressed = total > solved.capacity && !solved.jam       // only STATIC overload seizes; dynamic loads just slow down
loadFraction[net] = min(1, total / max(1e-6, solved.capacity))   // read next tick by engines (K7)
```
A dynamo that cannot get shaft power returns less electricity (brown-out), never seizes the line. Providers are called once per network per tick.

### 3.2 Gas net tick (`sim/gasNet.ts`; T3)

```ts
class GasNet extends PipeNet {            // family 'steam' | 'air'
  store = { fluid: family, litres: 0 }    // same anchor-entity persistence as FluidNet
  volumeL: number                          // sum of member volumeL (+ vessel interior for steam ports)
  get bar() { return this.store.litres / this.volumeL }
  tick(dt, env) {
    // 1 sources first: boiler/kettle put(), compressor put()
    for s of sources: this.store.litres += s.makeL(dt, this)          // boiler: min(heatGot/167, water*10) dt
    // 2 users: priority valve < whistle < engines/hammers
    for u of users sorted by priority: u.use(this, dt)                // engine: take(full * max(.1, load) * dt) if bar >= min
    // 3 sag and leaks
    this.store.litres *= 1 - STEAM_SAG_PER_S * dt                     // air: leaks = openEnds * 100 * dt
    // 4 over-rating: burst clock (5 s), decays 2x when below
    rated = min(members.ratedBar)
    if bar > rated: overS += dt else overS = max(0, overS - 2*dt)
    if overS >= BURST_SECONDS: burst(weakestNearestSource)            // scald 6 within 4, destroy block, litres = 0
    if bar > rated - 1 (and not warned): emit steam:warning on
    this.store.litres = clamp(this.store.litres, 0, volumeL * 12)
  }
}
```
Water used by the boiler is taken from the vessel entity (`waterL`), never from the gas net. Gas nets never mix: a joint of `steam` with `air` is refused with a joint reason (existing `JointReason`).

### 3.3 Heat draw (`sim/heat.ts`; T2)

```ts
export function drawHeat(f: FurnaceEntity, wantW: number, minTempC: number): { gotW: number; tempC: number } {
  const T = f.tempC;                                     // furnace chamber temperature
  if (T < minTempC || !f.lit) return { gotW: 0, tempC: T };
  const cap = Math.max(0, f.availW - f.extractW);        // what the fire can still give this tick (availW exists on the entity)
  const got = Math.min(wantW, cap);
  f.extractW += got;
  return { gotW: got, tempC: T };
}
```
All current direct `extractW +=` sites (brewing, distill, fluidMachines) call it in T2 as a pure refactor (tests unchanged).

### 3.4 Bronze Chute with suction (`itemNet.ts` change; T6)

```ts
rebuild(): for each pump p on net: dist = bfs(net, p.cell)            // cached; invalidated on place/remove
net.suction = pumps.some(p => p.running)                              // running = air >= 2 bar and not jammed
tick(dt):
  if !net.suction: return                                              // chutes do nothing by themselves
  budget = 16 items per 0.5 s per pump (shared)
  for port in net.ports where port.mode == 'pull': seed packets from the inventory/ground at that port
  for packet: advance toward lower dist at 8 blocks/s; at the pump: deliver into touching inventory or buffer(9)
  air.take(30 L/s while any packet moved)
```
Packets are the existing `ItemNet` packets (cap `PIPE_MAX_PACKETS`).

### 3.5 Structure scan reuse (`structureScan.ts`; T4) - BRONZE_PLAN 14.5 stands. Rule: boiler data in a `STRUCTURES` content table; scan returns `{formed, problems[], cells}`; hearth tests unchanged and must stay green before the boiler is wired.

### 3.6 Render: turning parts never jump
Keep an `angle` accumulator per part in the renderer; `angle += rpm x 6 x dt` (deg), never `angle = rpm x t`. Same for beam phase and sails.

---

## 4. Risks

| # | Risk | Mitigation / test |
|---|---|---|
| R1 | **Plans' numbers violate conservation (section 1.5).** Builders copy them. | T0 ledger test; this document wins over STEAM/BRONZE tables where they differ; `docs/api/steam.md` states the final numbers. |
| R2 | **Save migration.** New entities (`boiler_vessel`, gas anchors, heat none), new workshop part kinds, removal of `GENERATOR_SHAFT`, W0 renumbering. | Missing keys load empty; `sanitize.ts` drops unknown kinds; keys never renamed (K5); old-save fixture (committed in W0) loaded by every stream's test; old `water_wheel`/`wind_turbine`/`steam_engine` saves keep working as watt generators; `normalizeDocument` defaults; no `SAVE_VERSION` bump unless shape breaks. |
| R3 | **Free-energy loops.** generator -> shaft -> dynamo; compressor -> air -> pneumatic drill -> ore -> fuel; mech_pump -> wheel; flywheel; gearing up. | K6; ETA all < 1; windmill spacing; flywheel source capped 12 su for 4 s only after being charged (existing); clamp .25 conservative; energy test (T0) enumerates chains; mech_pump -> mill_wheel net negative (`pump 200 W lifts 50 L/s` returns <300 W only if drop >= 2 blocks: cap wheel flow by *source block*, not pumped water: water from a `mech_pump` counts 0 for the wheel's `flowAround`). |
| R4 | Performance. | Budgets: gas ticks < 0.1 ms/net with 100 pipes, whole steam/air/heat < 0.3 ms/tick for 10 vessels + 500 pipes (BRONZE_PLAN); workshop solve stays BFS capped 512 and runs per tick; providers are called once per network; renderers instanced (rods, pipes, sails) with one draw call per kind; tube packets capped 48; no per-block allocations in tick; scans only on change or player within 16 blocks. Add to `perf.test.ts`. |
| R5 | Burst/scald griefing and surprise death on phone. | Warning 5 s, HUD + sound; scald 6 not lethal; no burst in Peaceful (valve force-opens); burst never chains; never in unloaded chunks (nets in unloaded chunks hold). |
| R6 | Furnace overdraw: many users starve the fire (kettle + plate + still + brewing). | `drawHeat` cap by `availW`; status "furnace is the limit"; hearth heat capacity numbers read from `FURNACE_TIERS` **(verify the Bronze furnace's sustained kW supports one kettle + one vessel port: acceptance check below)**. |
| R7 | Shared-file conflicts (`types.ts`, `gameEvents.ts`, `specRoster.ts`, `package.json`). | T0 lands all contracts first; builders append one line only; rebase before every commit; `.run-lock` for `dist/`/e2e (`team.md`). |
| R8 | Voxel ids (10 bits) near the cap. | Count free ids in T0 (`grep -c` of palette); new blocks append LAST; reuse variant bits (steam pipes/air tubes/thermocouples are one block each with joins by neighbour) - ~40 new blocks: **(verify headroom)**, if short, kettle/rotor/engine share frames. |
| R9 | Name collisions: `boiler`, `steam_engine`, `piston`, `water_wheel`, `kettle_pot` vs `steam_kettle`. | K5; never display "Kettle" alone; Codex names listed in conventions. |
| R10 | Phone: gauge/needle readability, no screen. | Status sentence + goggles; boiler screen only as the generic Structure sheet (already exists for hearths). |
| R11 | Stale doc status (STEAM_PLAN s.8 says nothing exists). | T9 doc pass replaces s.8 with a pointer here; `docs/api/steam.md` is authoritative. |
| R12 | Age gating after W0: `minTier`/`age` literals. | Every new row uses `ageIndexOf('bronze')` and the tier constant from `FurnaceTierSpec`; G2 greps `minTier: 1`. |

---

## 5. Builder tasks (ordered, dependency-correct, disjoint files)

Convention: **a task is Done only after the coordinator re-runs** `npx tsc --noEmit`, `npx vitest run`, and the stream's e2e (`team.md`); builders never certify their own work. Every task's end state: roster/content counts updated, `docs/api/steam.md` (or the area note) section written, no key renamed, old-save fixture loads. Shared append-only files are touched **only** by T0 except one-line roster/package.json merges (rebase first).

### Phase 0 (after W0 lands; one builder, short)
**T0 - Contracts, ledger, seams.** Owns: `src/core/{types,constants,gameEvents,energy}.ts` (+ `energy.test.ts`), `src/content/lube.ts` (moves `LUBE`), `src/workshop/sources.ts` (types only), `src/sim/heat.ts` (`drawHeat`), `src/core/registry.ts` (validation of `HeatSpec/GasSpec/StructureRules`), `src/audio/sfx.ts` names with placeholder recipes, `docs/api/steam.md` skeleton. Also: count free voxel ids; run `drawHeat` refactor over brewing/distill/fluidMachines (`extractW` sites) with tests unchanged.
*Acceptance:* typecheck + full suite green; `energy.test.ts` (efficiency chain < 1, K2 constants); registry rejects a bad `GasSpec`; old-save fixture loads; **no behaviour change** (diff of snapshot tests empty).

### Phase 1 (parallel, 4 builders, disjoint files)

**T1 - Shaft layer and wooden sources (Builder 1).** Owns `src/workshop/{kinetics,workshop,sources}.ts` (+tests), `src/content/{blocksSource,itemsSource,recipesSource,specRosterSource}.ts` (windmill, mill_wheel), `src/render/steam/{windmill,wheel}.ts`, `src/render/textures/steam.ts` (first half), `docs/api/workshop.md` (kinetics section). Does: providers/dynamic loads/`loadFraction`/`driveAt`; retire `GENERATOR_SHAFT` and rewrite its tests; `windmill`, `mill_wheel`; `LUBE` reads `content/lube.ts`; Codex of units.
*Acceptance:* (a) windmill + quern grinds wheat headless (no crank); (b) mill wheel 0 on frozen/pumped water; (c) dynamic load test: loads share spare capacity, line never seizes from dynamic overload; (d) `kinetics.test.ts` and `workshop.test.ts` unchanged except removed generator cases; (e) windmill spacing guard; (f) `e2e-workshop.mjs` unchanged and green.

**T2 - Heat, kettle, rotor, hot plate (Builder 2, part 1).** Owns `src/sim/{heatNet,kettle}.ts`, `src/content/{blocksHeat,itemsHeat,recipesHeat,specRosterHeat}.ts`, `src/render/steam/{rods,kettle,rotor}.ts`, `src/render/textures/steam.ts` (second half, coordinate: separate file `steamHeat.ts`), objectives `bronze_furnace/boil_water/first_motion/grind`.
Depends: T0 (`drawHeat`), T1's `SourceProvider` interface only through T0's types (rotor registers via `Workshop.addSourceProvider` in `game.ts` wiring - one line).
*Acceptance:* kettle boils a pail and rotor reaches 16 rpm / 4 su; dry kettle warps at 20 s; heat conservation (furnace cools by delivered / efficiency); 2%/block; 6 kW cap; burn query; hot plate cooks at delivered temp; perf 500 rods < 0.2 ms; save/load of kettle water.

**T7 - Workshop polish (Builder 3, part 1).** Owns `src/workshop/{logistics,contraption,signals,inspector}.ts`, `src/render/workshop/*`, `src/content/{itemsWorkshopParts,recipesWorkshop,objectivesWorkshop,basinWorkshop}.ts`, `docs/api/workshop.md` (logistics/polish sections). **Does not touch `kinetics.ts`/`workshop.ts`** until T1 is merged; if it needs a hook, T1 adds it first (`Workshop` extension points via small `workshop/ext/*.ts` files).
*Acceptance:* per row of 2.12; `contraption.test.ts`/`logistics.test.ts` green; e2e-workshop extended (skiff ride, spout fills cans).

**T8 - Distillery (Builder 4).** Owns `src/sim/distill*.ts`, `src/core/{chem,distill}.ts`, `src/content/{blocksDistill,itemsDistill,recipesDistill,fluidsDistill,machinesDistill,specRosterDistill}.ts`, `src/render/distill/*`, `src/game/felling.ts` (bar-oil consumer only), `docs/api/distillery.md`, `docs/DISTILLERY_PLAN.md` s.15. Order: items 1,2,3,4 (lubricant can via `content/lube.ts`), 7, 9, 5, 6, then (after T1) stirrer hooks, (after T4/T6) item 8.
*Acceptance:* golden tests for each card (existing fuzz + new cards); `distill:step` event; tank test per fluid; `e2e-distill.mjs`: bottle -> spout -> can -> shaft "oiled 15 min"; Dev Mode lists new items.

### Phase 2 (after T2 and T1 land)

**T3 - Gas net, steam network, beam engine, whistle, valve (Builder 2, part 2).** Owns `src/sim/gasNet.ts`, `src/sim/transport.ts` (family hook, one function), `src/sim/pipeGraph.ts` (family table entries only), `src/content/{blocksSteam,itemsSteam,recipesSteam,specRosterSteam}.ts`, `src/render/steam/{beamEngine,gauge,valve,plume}.ts`.
*Acceptance:* worked example of 1.5 within 2%; two engines vs one (efficiency); valve holds its setting; burst only after 5 s over rating, never with a valve <= rating; pressure sags 0.2%/s; engine idle draw 10% (K7); steam/air never join; networks split/merge on pipe removal; unloaded chunks hold.

**T4 - Structure scan + boiler vessel (Builder 2, part 3, or Builder 1 if idle).** Owns `src/sim/{structureScan,boilerVessel}.ts`, `src/sim/hearthScan.ts` (extraction only), `src/content/{blocksBoiler,...}.ts`, `src/ui/screens/structure/*` (generic Structure tab move), `src/render/steam/boiler.ts`.
Depends on T3 (steam ports). *Acceptance:* hearth tests unchanged and green; vessel forms/unforms for every problem code and size 1x1x2..3x3x4; dry-fire timeline; capacities by size; ghost from planner; e2e: build smallest boiler from ghost -> 2 bar -> beam engine turns a millstone; no valve -> burst with the player 8 blocks away unhurt; with valve holds.

**T6 - Air, pneumatics, chute, vacuum, nozzle (Builder 3, part 2).** Owns `src/sim/{airNet}.ts` (a `GasNet` subclass config), `src/sim/itemNet.ts` (suction flag), `src/game/collectors.ts` (vacuum pump kind), `src/content/{blocksAir,...}.ts`, `src/render/steam/{compressor,tubes,tank}.ts`, Forge gate in the hearth data.
Depends on T3 (gas net) and T4 (hearth structure table). *Acceptance:* compressor stalls at 6 bar; open end leaks 100 L/s; tube send refused < 2 bar; chute moves nothing without a running pump, moves 16 items/0.5 s with one; blast hearth forms only with the nozzle at 2 bar; press/drill charge; save/load of air and packets; `e2e-steam.mjs` (kettle -> axle -> mill; boiler; compressor; chute) desktop + phone.

### Phase 3
**T5 - Forge dynamo + steam dynamo naming + objectives (Builder 1).** Owns dynamo block/recipe, display renames, the age/objective moves (Forge `first_power` after `blast_furnace`), `content/objectivesBronze.ts`. Depends on T1 (dynamic loads) and T3.
*Acceptance:* dynamo produces `ETA.dynamo x shaft W` and slows the line instead of seizing; brown-out; solver: no electricity item obtainable before the Blast hearth (test); Bronze completable with no power; Peaceful completable.

**T9 - Docs and Codex pass.** `docs/api/steam.md` final, STEAM_PLAN/BRONZE_PLAN status boxes pointing here, CONGRUENCE conventions updated (K5/K8), `npm run codex`. Coordinator-owned or a docs session.

### Dependency graph
```
W0 -> T0 -> {T1, T2, T7, T8}   (T7 waits for T1 only if it needs workshop.ts)
T1+T2 -> T3 -> T4 -> T6 ; T3 -> T6 ; T1+T3 -> T5 ; T4,T6 -> T8.item8 ; all -> T9
```
Parallelism: Phase 1 runs 4 builders (T1, T2, T7, T8). Phase 2: Builder 2 continues T3->T4; Builder 3 does T6 after T3 (starts early with the chute/collector half that needs no gas, using a stub air supplier); Builder 1 does T5 after T3; Builder 4 finishes T8.

### Per-task review gate (who certifies)
Independent adversarial review (a session that did not write it) before merge for: T0 (contracts), T3/T4 (safety and burst), anything touching `hearthScan`/`pipeGraph`/save keys. Reviewer checklist: free-energy chains, save of every new entity kind, no key renamed, no voxel id moved, no per-tick allocation, goggles sentence for each new block, `Peaceful` completability.

---

## 6. Owner decisions this dossier needs (defaults chosen)

1. Engine key/name `beam_engine` "Beam Engine" instead of `piston_engine` (default: yes).
2. Legacy Forge `boiler`/`steam_engine` keep their keys; displayed "Furnace Boiler"/"Steam Dynamo" (default: yes; supersedes CONGRUENCE D3/D4 renames).
3. Power scale is deliberately modest (rotor 200 W, engine ~1.8 kW per 10 kW port): steam is a tool, not a generator; the Forge dynamo makes lamps only a few at a time (default: yes; the ledger lets you retune by `ETA` and `HEAT_PORT_W` in one place).
4. Pressure gas model on the pipe graph, no new graph (K4).
5. Burst disabled in Peaceful (valve force-opens) (default: yes).

## 7. Quick map of "who edits which file" (collision table)

| File | Only this task edits it |
|---|---|
| `core/{types,constants,gameEvents,energy}.ts` | T0 (builders: one-line appends after rebase) |
| `workshop/{kinetics,workshop,sources}.ts` | T1 (T5 after T1) |
| `workshop/{logistics,contraption,signals}.ts`, `render/workshop/*` | T7 |
| `sim/{heatNet,kettle,heat}.ts` | T2 (heat.ts: T0 creates) |
| `sim/{gasNet,transport(hook),pipeGraph(family table)}.ts` | T3 |
| `sim/{structureScan,boilerVessel,hearthScan}.ts` | T4 |
| `sim/{airNet,itemNet}.ts`, `game/collectors.ts` | T6 |
| `sim/distill*.ts`, `core/{chem,distill}.ts`, `*Distill.ts`, `render/distill/*` | T8 |
| `content/lube.ts` | T0 creates, T8 appends rows |
| `src/app/game.ts` wiring | one-line additions only, rebase before commit |

<!-- ======================== END docs/advice/tech-spine.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/distillery-workshop.md ======================= -->
# FILE: docs/advice/distillery-workshop.md

# Advice dossier - lanes B (distillery) and C (Create-style workshop)

Advisor note, read-only pass, 2026-11-21. Written for the two architects and their four builders. It does not repeat
`docs/advice/tech-spine.md` (steam, shared kinetic/heat/fluid model); where this dossier needs something from that
spine it names the seam and a stand-in. Facts below were checked in the code on this branch; anything not checked is
marked **(verify)**. Names are original; every sentence a player reads is under 70 characters.

## 0. What the code already does (so nobody builds it twice)

| fact | where | consequence |
|---|---|---|
| Workshop oil exists: `LUBE = { residue: 1.25 / 600 s, pine_resin: 1.10 / 300 s }`; Use of `residue_canister` or `pine_resin` on any part oils the WHOLE network (`capacityFactor` into `solveNetwork`) | `workshop.ts:39,245-252,383-392` | Lubricant work is a re-key of this table, not a new system. `residue` as oil is a *placeholder* (it is the dirty residue, not lube) and must drop to 1.10 when real lubricant lands |
| `lube_base` (bp 370, viscosity 12) and `bitumen` (bp 520) are components; a crude run leaves `residue` = lube_base .34 + bitumen .66 | `chem.ts`, plan 5.1 | Vacuum residue run needs only the `pf = 0.7` pressure factor of plan 5.2 + a setpoint of 260-280 C |
| A flask's temperature comes from `Distillery.baseTemp(base)` = `min(setC, furnace below, 450)`; no furnace -> `null` -> flask "blocked" | `distill.ts:192,217-230` | Ground burner = one more branch in `baseTemp` |
| `Still` = `{ flask, base, segments[], draws[], head }`; the stack walker only knows `column_segment` | `distillScan.ts:36` | Reflux head and catalyst bed are two more stack members, same walker |
| `stepStill` uses `stagesOf(height)`, `trayTemps`, `vapourShares`, `leakShare`; BOIL_LPS 20 | `distill.ts:217-310` | Reflux = raise the stage count and cut `want` by (1-r) |
| Chem modules are entities, never machine nodes; rigs are derived on load, never saved | api/distillery.md | Everything new that persists lives on module entities (`ChemEntity`) |
| Contraption steps are instant: `commit()` clears old voxels, `relocate`s per-block state, writes new voxels in one `hold()`. A structure floods through ANY movable block, belts included, up to 48 | `contraption.ts:84-110,127-160` | Tween needs a two-phase move; belt borders need a pin rule (section C.8) |
| `standingOn(x,y,z)` is the only treadwheel input (the player only) | `game.ts:164`, `workshop.ts:349` | Animals plug in by widening this one hook |
| `GEARSHIFT_PROGRAMS` = 3 presets of `[seconds, factor][]`; `Part.s` is the program index | `kinetics.ts:20-45` | A card is a 4th kind of program, `Part.s >= 3` or a stored pattern |
| `ItemStack` is `{ item, count, durability? }` only | `core/types.ts:79` | Per-stack data (a punched card, sips left in a flask) needs either `durability` abuse or one append-only field `tag?: number`. **Recommended: add `tag?: number`** in one tiny shared commit (inventory save + stack-merge compare + sanitizer) |
| `DRINK_BUFFS`: spring, hearthkept, mending (tea); swift, vigor, lasting (coffee) | `core/brewing.ts:81` | Elixirs are these six, longer |
| Ghost pipeline: `GhostLayer` (one instanced geometry, `solid` and `xray` materials, `GHOST_CAP` 512), `GhostCell {x,y,z,role,want,has,state}` | `render/tech/ghosts.ts`, `sim/hearthView.ts` | Rig ghosts and moving blocks both reuse it |

Age table for both lanes (single table each, so the six-age refactor edits one place). The distillery docs use the old
five-age names; the owner's six ages (Ember = handwork only) move every glass rig out of Ember:

| age | distillery (`DISTILL_AGE`) | workshop (`WORKSHOP_AGE`) |
|---|---|---|
| Ember | nothing (no glass, no machines) | nothing |
| Bronze | still_base, flask, condenser, receiver, tube, vessel, airlock, **ground burner**; syrup, wash, low wines, spirit, tinctures; filter_bed | cranks, shafts, belts, stations, depot/funnel/chute, basin, spouts, arm, deployer, signals, **trinkets**, cards |
| Forge | column_segment, **reflux_head**, jacket, chem_port, canisters; crude run, fuel ethanol, **vacuum_cap** (powered by a Bronze shaft), lubricant, grease, bitumen, asphalt, elixirs | piston, bearing, skiff + rail, vault growth, treadwheel animals |
| Current | pressure_cap, catalyst_bed, steel shell (900 C), cracker | electric stirrer variant, magnet collector |
| Atomic | refinery tower multiblock | - |

The tower is "late Forge" in `CONGRUENCE` and "Atomic+" in the plan; this dossier recommends **Atomic** (a 16x throughput
box is a late reward; Forge already has a three-cut column) and flags it as an owner decision (section H).

---

# LANE B - DISTILLERY

## B.1 Ground burner (Bronze comfort: a still without a furnace)

**Player sees.** A Still Base set on bare ground (not on a furnace) shows an empty fire cup. Use with charcoal (up to 8) or a
Fuel Ethanol Beaker loads it; the cup glows amber, a tiny flame and heat shimmer rise through the flask, a quiet
fire crackle plays, the base block takes its `_on` look (existing active bit). It burns down on its own; the lamp goes dark
and a faint ember ticks when it dies. Empty hand on a burning base still cycles the setpoint, but a ground burner never
exceeds its fuel's temperature.

**Numbers (`BURN_FUELS` in `core/distill.ts`).**

| fuel | holds | temp cap | burn time per item | note |
|---|---|---|---|---|
| `charcoal` | 8 | 260 C | 150 s | enough for syrup, low wines, spirit, tinctures. Not crude (350) |
| `fuel_ethanol_beaker` | 1 (250 L) | 320 C | 240 s, beaker handed back empty | self-fuelling loop: spirit run makes its own fuel |
| `residue_canister` | 1 | 300 C | 400 s | smoky: spawns soot particles, no other cost |

Heat-up is the existing first-order lag towards `min(setC, cap)`. Draw on a furnace: none (a ground burner has no
`extractW` sink; the heat is free but small: the vapour latent heat is checked against a power budget `BURNER_W` 6000 W:
`V = min(heatW / BOIL_J_PER_L, ...)`, so a burner boils 15 L/s at most, 25 % slower than a furnace).

**Contract.** `ChemEntity` (base only) gains `fuel?: { item: string; n: number; leftS: number }` (saved). `Distillery.baseTemp`:

```
baseTemp(base):
  f = host.furnaceUnder(base)
  if f: return min(base.setC, f.tempC, GLASS_MAX_C)            # unchanged
  b = base.fuel
  if b and b.leftS > 0: return min(base.setC, BURN_FUELS[b.item].cap)
  return null                                                  # cold: flask "blocked"/idle as today
tickBase(base, dt):                                            # new, 4 Hz, only for bases with fuel
  if base.fuel.leftS > 0: base.fuel.leftS -= dt
  if leftS <= 0 and base.fuel.n > 1: n -= 1; leftS = burnS      # next piece
  if leftS <= 0 and n <= 1: base.fuel = undefined; show(idle)
```
Fuel only burns while a flask with a charge sits above (otherwise 10x slower: "banked"), so a burner is not wasted
while the player gathers. `chemUse` table gains: held fuel on a base -> load; wrench -> unload (refunds `n-1`).

**Phone.** Tap the base with fuel in hand (the big Use button); the crosshair line says "Burner - 4 charcoal, 210 C, 2 min".

**Extend.** `core/distill.ts`, `sim/distill.ts` (`baseTemp`, new `tickBase`), `sim/distillActions.ts` (`chemUse`), `distillFx.ts`
(flame instance on bases with `fuel`: reuse the bubble shader, `rate` = 1).

**Acceptance.** Unit: `buildRig('B F / ...')` on stone, load 2 charcoal, run: flask reaches 92 C, a `spirit` card yields
>= its `expect`; fuel burns out then flask goes `done`/idle; 2 charcoal = 300 s of heat (+/-1 step); save and load keeps
`fuel.leftS`. E2E (`e2e-distill.mjs`): place base on grass, give charcoal, Use, screenshot shows flame instance count > 0
(`window.__hw.distillStats()`), phone portrait too.

## B.2 Reflux head

**Player sees.** A tall glass finial block on top of a column. Wrench on it cycles 0 / 50 / 75 % return; its liquid
slab shows a falling drip loop proportional to the ratio; the crosshair line says "Reflux head - 75% back, purer, slower".
Visibly the output slows (a drip every ~2 s instead of a stream) and the spirit grade rises.

**Rules.** Stack member exactly like a segment (valid top of the column; the head condenser sits on its top or on its H side).
It adds no holdup (like a segment). `ratio` in `{0, .5, .75}` saved on its entity.

```
# distillScan.ts: stack walk accepts reflux_head as the LAST member; Still gains reflux: string | null
# distill.ts stepStill (replace stagesOf(height) and `want`):
  r        = reflux ? mod(reflux).ratio : 0
  stages   = stagesOf(height) * (1 + 2 * r)       # plan 5.2: n = 1 + plates*(1+2r)
  want     = BOIL_LPS * min(1,(ts-tb)/2) * dt * (1 - r)
  # liquid never returned in litres: the effect is purity (more stages) and throughput (less want)
  # => conservation untouched, no new buffer, the fuzz test stays valid
```
Worked numbers (check with the existing 38/74/93 hand figures): sugar_wash, 3 segments, r = .75 gives ethanol share >=
0.90 (`fuel_ethanol` grade) in one pass at 25 % rate; r = 0 gives about 0.65.

**Data.** `CHEM.reflux = 'reflux_head'`, `CHEM_CAPACITY_L.reflux_head = 0`, `ChemEntity.ratio?: 0|0.5|0.75`; new block + texture
tile (`chem_case` frame x lamp states, emblem painted by the existing function; no `_done` twin). Problem codes appended to
`RigProblemCode`: `reflux_not_top` ("The Reflux Head belongs at the top of the column"), `no_column` (reflux on a bare flask).

**Extend.** `core/distill.ts` (kind), `distillScan.ts`, `distill.ts` (stepStill, `chemUse` wrench branch), `blocksDistill.ts`,
`textures/distill.ts`, process card `rectify_spirit` gains a variant `reflux_ethanol` (rig string with `H`, legend letter added in
`distillKit.buildRig`). **Acceptance.** Unit: reflux 0 vs .75 with the same 3-segment rig: purity up, litres delivered per
second down, conservation fuzz extended to include the head. Card test `reflux_ethanol` yields `fuel_ethanol`.

## B.3 Filter bed

**Player sees.** A glass cylinder you pour through. Use with charcoal / clay / sand loads the medium (4 slots, shown as a dark
layer that visibly greys as it spends). Liquid from above drips through to below; a spent medium turns the lamp red
("blocked": needs a new one) and the layer is drawn black.

```
FILTERS (core/distill.ts):  medium -> { capacityL, removes: Component[], converts: [{from,to}] }
  charcoal : 150 L per piece, removes fusel + methanol + turpentine     (clean-up: raises the ethanol share)
  clay     : 200 L per piece, converts lube_base -> lubricant           (the lubricant polish, B.4)
  sand     : 400 L per piece, removes solids only (cloudy -> clear), converts nothing
stepFilter(f, dt):                       # runs in rig.order, before drain()
  m = medium slot; if none or spent: state = blocked; return (liquid waits above)
  pass = min(FLOW_LPS / sqrt(visc) * dt, f.mix litres, m.left)
  for c in components of pass:
      if rule.removes has c:  absorbed += x          # litres taken by the medium: m.left -= x; counted in rig.absorbed
      elif rule.converts has c: out[to] += x          # same litres, new component
      else out[c] += x
  m.left -= pass; if m.left <= 0: consume one item, next piece, or blocked
```
Conservation: `absorbed` is added to the fuzz test's litre ledger (total + absorbed constant). New components `lubricant`
(non-volatile, colour 0xc9a227, viscosity 8) and `clear` is not needed (purity grades read the share).

**Data.** `CHEM.filter = 'filter_bed'`, stateful (`_done` twin = medium spent), entity `slot?: { item, left }` saved. Items go in by
Use of the item or by a `chem_hopper` (B.10). **Extend.** `distill.ts` (`stepFilter` in `stepRig`), scan (liquid in U, out D),
`textures`, `distillFx` (layer slab colour = medium wear). **Acceptance.** Unit: spirit wash with fusel 3 % through charcoal
raises ethanol share; 151 L exhausts a 150 L charcoal piece mid-pass; `blocked` lamp; save/load keeps `left`.

## B.4 Lubricant and grease, end to end (B x C)

**Chain (Forge).** crude -> 3-segment column 350 C -> `residue` -> **vacuum still** 270 C (vacuum_cap on the stack, powered) ->
`lube_base` head + `bitumen` in the flask -> `filter_bed` with clay -> `lubricant` -> `lubricant_beaker` (250 L). Grease:
heated vessel 90 C, lubricant 3 : rosin 1 : tallow 1 (items) -> `grease` item (3 per 750 L batch).

**Vacuum cap.** `CHEM.vacuum = 'vacuum_cap'`; capability `vacuum` only while powered: a kinetic part (shaft, any) touching the
cap or the pump block below it turns >= 16 rpm. Draw 3 su on the workshop network (hook C.10 `registerLoad`). Unpowered =
red lamp and sentence "The Vacuum Cap needs a turning shaft". `pf = 0.7` is already in the stepStill spec; `STILL_SETPOINTS`
gains 60, 270 (new list: 60 78 92 97 130 200 260 270 350 420). Lube_base bp 370 x 0.7 = 259: at 270 C the run starts 219 C and
finishes when the flask holds only bitumen (the existing "nothing boils -> done"). A 1000 L residue run: 340 L lube_base,
660 L bitumen (the mix itself), about 90 s at BOIL_LPS (4 Hz steps).

**What lubricant does on a shaft (C-side contract, one table).**

| oil | item | factor | lasts | notes |
|---|---|---|---|---|
| pine resin | `pine_resin` | x1.10 | 5 min | stays |
| residue (old) | `residue_canister` | x1.10 | 5 min | was 1.25: lower it so lubricant matters |
| lubricant | `lubricant_beaker` | x1.25 | 10 min | glass back |
| grease | `grease` | x1.50 | 40 min | friction halved: also -50 % squeal threshold |

Change in `workshop.ts` (owner C): `LUBE` becomes `Record<item, { factor, s }>`; `use()` checks `LUBE[held.item]`; the
`lube` map keeps the strongest. The goggles sentence already shows oil: new text "oiled x1.25, 9 min left". **Player
sees**: a sheen strip (a one-box `bars` instance, colour amber, alpha pulsing) on every oiled shaft; an un-oiled network above
85 % load squeals (a pitched saw-tooth `pipe_clunk` loop at 0.4 volume, gone when oiled).

**Chainsaw bar oil.** Use `lubricant_beaker` on the held chainsaw: `Game.barOil = BAR_OIL_LOGS` (60 logs) and while > 0
`fuelPerLog x 0.8`; state saved `world.persist('barOil')` (not on the item, until `tag` exists). Shown in the saw line:
"Chainsaw - 14 fuel, oiled (41 cuts)". Files: `game/felling.ts` (B owns the constant only), `app/game.ts` (one hook).

**Acceptance.** Unit: vacuum run on residue gives lube_base within 5 % of .34 of input; filter turns it to `lubricant`;
`solveNetwork` capacity 1.25x; grease recipe. Golden e2e (`e2e-distill`): crude -> residue -> vacuum (shaft turning) -> filter ->
beaker -> Use on shaft: sheen visible, goggles "oiled", load % falls; desktop + phone.

## B.5 Bitumen, asphalt and tarred planks (road blocks)

**Bitumen out of the flask.** A flask of pure bitumen is a thick black pool. Empty `empty_canister` on the flask's lower half
(the drain cock): allowed only below 150 C ("Too hot to pour - let it cool"), gives `bitumen_canister`. New grade
`bitumen` 0.80, container entry in `CHEM_CONTAINERS`. Drips in the flask one per 2 s (viscosity 200: already in the shader rate).

**Asphalt** (heated vessel, `REACTION_SPECS`): `in: bitumen 1`, `items: gravel 4, sand 4` per 1000 L, needs `heated`, window 140-180 C,
`ruinC` 220, seconds 60, `gives: asphalt_block x8`, emits `distill:step done`. A `chem_hopper`/arm takes the blocks.
**Tarred planks**: a Workshop basin recipe (fluid input, C.9): `bitumen 125 L + 8 planks` mixer 16 rpm -> 8 `tarred_planks`.
No rot, no burning (`flammable: false`, block flag `rot: false` **(verify the existing key)**).

**Road effect (`speedMult`)**. Add an append-only optional `BlockDef.surface?: { walk: number; vehicle: number; mud: false }`
(core/types.ts: shared edit). `asphalt_block`: walk 1.25, vehicle 1.4, never churns to mud; `tarred_planks`: walk 1.1. Player
physics multiplies walk/sprint by the block under the feet (one `getBlock` per frame already read for friction **(verify
`src/player/physics`)**); `vehicles/tractor.ts` multiplies `topSpeed` and skips the churn rule on `surface.mud === false`.
Sound: footsteps use a new `step_asphalt` name only if the audio table accepts it; otherwise `step_stone`. Texture
`asphalt` (dark speckle, 16 px, drawn from the existing procedural gravel generator) + a faint lane line variant is out of
scope.

**Acceptance.** Unit: bitumen cannot be taken at 200 C; asphalt card yields 8; tractor `step()` on an asphalt strip reaches
1.4x top speed, on dirt-with-mud does not; player walk 1.25x. Content test: item reachable (process card as pseudo-recipe).

## B.6 Potions, spirits and tinctures

Pipeline (all vessels or stills, no new machine): **macerate -> filter -> concentrate -> blend -> bottle**.

| step | rig | recipe (`REACTION_SPECS` / card) | result |
|---|---|---|---|
| macerate | heated vessel 50 C | 3 herb items + 500 L `spirit`, 90 s | component `tincture_<buff>` in the spirit |
| clarify | filter_bed (charcoal) | pass | `clear_tincture` (named fluid, bottle-able) |
| concentrate | vacuum still 60 C | clear tincture in the flask; ethanol+water come off, extract stays | component `essence_<buff>` (non-volatile; **above 80 C it scorches to slop**, rule `HEAT_SENSITIVE`) |
| blend | vessel, sealed 20 C | essence 1 : syrup 1 : water 2 | `elixir_<buff>` fluid, 250 L per vial |
| bottle | receiver, vial | `vial` (glass) | `elixir_<buff>_vial` |

`<buff>` is each of the six `DRINK_BUFFS`; herbs: tea buffs use the existing tea leaf items, coffee buffs coffee beans, glowcap
for Glowcap Draught (a seventh buff `nightsight`, **(verify)** or a timed `lightActive` extension). Elixir = `DrinkSpec` with
`buffS` x3 of the cup, same `buffs.grant`; drinks reuse `game/drink.ts` (the vial returns `glass_vial`).
Generated tables (`ELIXIRS` in `itemsDistill.ts`): 6 x (tincture, essence component, elixir fluid, vial item) = 24 specs
generated, not written; fluids are `pipe-only` (not tanks) until needed.

**Spirits as drinks.** `spirit_beaker`: 5 sips (`durability` 5 or `tag`); each sip: Warmed (existing `well_warmed` 90 s) and
Tipsy 60 s: melee +10 %, aim sway +0.6 deg (a camera yaw noise from `Buffs.sway`, **(verify) where look input is read**); a
fourth sip in 120 s adds "Dizzy": sprint off 10 s. `Rough Spirit` (methanol > 2 % grade) = Tipsy plus "Blurred" 20 s (vignette).
Hunger: `DRINK_HUNGER` shared with lane E (spirit 1, elixir 0). Antiseptic bandage: basin recipe `fuel_ethanol 50 L + 2 cloth ->
2 antiseptic_bandage` (heal over time 12 s, `mending`-class regen without the buff). Kerosene lamp: block, no power, burns
`kerosene` from an adjacent canister slot 1 L/min, light 13; gated Forge.

**Acceptance.** Unit: every elixir chain is built by a card string and run (`distillProcess.test.ts`); essence scorch above 80 C;
drink grants 3x; content tests count 24 generated specs and each item reachable. E2E: build maceration + still rig, make
one vial, drink it, HUD chip appears.

## B.7 Rig screen, ghost previews and sentences (in-world first)

Owner rule: in-world over screens. So the "rig screen" is three small things plus one thin sheet.

1. **Goggles sentence** on any module: `"Pot still - 92 C, 2 cuts, 1 problem (tap)"`; Engineer's Goggles' `inspect()` (src/workshop/inspector.ts)
   gains a chem branch calling `sim.brewView` (exists) so the sentence needs no screen. Each tap on the module cycles the
   next problem text and **pulses the offending cells red** (`HEARTH_HIGHLIGHT_S`, `GhostLayer` set `rig:problem`, state `wrong`).
2. **Plan ghosts.** Wrench on a still base cycles the *plan*: nothing, then each process card whose blocks the player owns
   (`PROCESS_CARDS` filtered by inventory + unlocked ages). A chosen plan stores `plan?: string` on the base entity (saved) and
   draws only the **next missing piece** as a ghost with the sentence "Next: Column Segment on the flask" (one ghost at a time is
   readable on a phone; the full rig is on the long-press "show all"). Orientation: the four rotations of the card relative to
   the base; pick the one with the fewest conflicts (the `structureView` best-placement idea).
3. **Capability line** under the sentence: "This rig can: distil, 2 cuts, ferment" and, computed on demand, "One more Column
   Segment would add: Kerosene" (re-run the scan with one block added over the 17 kinds: 17 cheap scans, only when the tap happens).
4. **Rig sheet (the only screen).** Empty hand on a flask while sneaking, or goggles on a module: a bottom sheet (existing
   `furnaceScreen` shell, `ui-tech`), two tabs only: PROCESS (thermometer with each component's bp marked and contents bars)
   and PLAN (card list with a Preview button that sets `plan`). Nothing is editable that is not also doable in-world.

**Data.** `core/rigString.ts` (new, extracted from `distillKit.parse`): `parseRig(rows) -> RigBlock[]` and `rotateRig`.
`sim/distillPlan.ts` (new): `planGhosts(world, base, planKey): GhostCell[]` (next missing piece + whole-rig list),
`GhostLayer.set('rig:'+baseKey, cells)`. `ChemView` gains `problems`, `caps`, `plan`.
**Tests.** `distillPlan.test.ts`: for each card, building the pieces one by one in the ghost order empties the list and the
rig then runs; wrong block in a cell yields `wrong`; rotation choice minimises conflicts. E2E: select card, ghost visible in the
screenshot, place the pieces, run.

## B.8 Tank and pipe support for the new fluids

The tank spec `accepts` list is the five old fluids. Add one derived list `DISTILL_FLUIDS` (the 11 plus lubricant, bitumen, 6
elixirs excluded) in `fluids.ts` (append-only) and let `tank`, `pump`, `chem_port` use it; keep `FluidKey` widening in the
**contract commit** (section E.0). `fuel` (old refined fuel): alias to `gasoline` in the save sanitizer. E2E: receiver ->
`chem_port` (outlet) -> pipe -> tank -> spout -> canister (the golden bottling line, B x C).

## B.9 Catalyst bed, pressure cap, cracker (Current)

`catalyst_bed`: stack member (like a segment), holds 1 catalyst item with durability (zeolite chips `catalyst_zeolite`,
2000 L of throughput). `pressure_cap`: `pf = 1.3`, needs the steel shell (flask kind `steel_still` 900 C, 4000 L) and a pressure
gauge sentence; blows its pop-off (toast, sfx, loses its cap) above 6 bar-equivalents (sum of heat input without a vent):
never destroys glass (steel only) so the Current age is safe to play on a phone.
Cracker rule, in `stepStill` after cut routing: for vapour passing a `catalyst_bed` with `pressure` capability at >= 450 C, each
litre of `diesel` becomes 0.7 L `gasoline` + 0.3 L `kerosene` (litres constant) and the catalyst spends 1 L of life per litre.
`slop` gets a consumer: fertiliser basin recipe `slop 100 L + bone meal -> 4 fertiliser` (lane E consumes). Cards:
`crack_diesel`. Acceptance: conservation fuzz includes catalyst; catalyst spends; unpowered/unsteel rig reports `no_pressure`.

## B.10 Chem hopper and arms feeding stills (B x C)

`chem_hopper` (already in the plan list, not built): an **ItemEndpoint** with a facing. Contract with the workshop (hook C.10):

```
Workshop.itemSinks: { accept(x,y,z,item,n): number; peek(x,y,z): {item,count}|null; take(x,y,z,filter,max) }   # set by Game
Distillery implements it for: reaction_vessel (4 slots), filter_bed (medium), catalyst_bed, chem_hopper (proxy to the first
vessel it touches; output side = vessel's `gives` and spent media)
```
Result: a `mech_arm` can be set (wrench source then target) onto a vessel or a hopper; a belt ending at a hopper feeds it;
the hopper in front of a belt puts asphalt, sugar, elixir vials on the belt. Failure mode to avoid: the arm must never pull a
liquid; `peek` returns items only.

## B.11 Refinery tower multiblock (Atomic)

**Player sees.** A hearth-style hollow stack of `tower_casing` 3 x 3 footprint, height 6-12, with a `tower_feed` port at the
base (pipe in crude), `tower_heater` on the lowest layer (steel base on a Star-tier furnace, or electric element: watts via
the tech spine, **(verify the heat source seam)**), `tower_tap` blocks anywhere on the wall (each is a side draw at its height), and
a `tower_hatch` for catalyst and spent media (item sink, B.10). Rig sheet shows the stack's cut heights.

```
scanTower(world, controller): cuboid scan reusing hearthScan helpers (problem shape, highlight, MAX 8)
   layers n = height - 2  -> stages = n, draws = taps by height, head = top cap (needs a jacket or a `tower_cooler`)
stepTower(t, dt) == stepStill with: BOIL_LPS x16, MAX_SEGMENTS = 12, buffers 16x, no glass limit
```
It reuses `stepStill` entirely (a tower is a `Still` whose parts are cells of one cuboid), so there is no second physics. A
tower runs continuously: feed from a pipe, products leave by `chem_port`-like taps into pipes; the catalyst hatch is fed by belts.
Autonomy loop for the e2e: crude -> pump -> tower -> three tank taps -> canisters by spouts -> belt -> crate.
**Acceptance.** Unit: tower of 6 layers reproduces the 3-cut result of the column card at 16x rate; scan problems for gaps;
sleeping when idle. This is last; it must not block B.1-B.8.

## B.12 Polish list for B (same lane, last)

`distill:step` event `{x,y,z,state,process?}` (bus, plus the existing sfx/toast); objectives "Run your first spirit" in
`objectives*.ts` reading it (stream F owns the file: send them the event contract); sounds: `bubble_loop` (filtered noise, rate
by boil), `drip` (short tick, pitch by viscosity), `glass_chime` on done: three entries in `audio` tables, synthesized
(owner: audio lane, 1-line recipes); Codex progression branch (scripts session, `scripts/codex/progression.json`); balance pass
on `FUEL_GRADES` and yields after playing.

---

# LANE C - WORKSHOP (Create-style)

## C.1 Tweened moving structures

**Player sees.** A piston pushes its machine along over 0.7 s on a sine ease with a soft thump at the end; a bearing swings a
platform through its quarter turn smoothly and settles with a clunk; a skiff glides along a rail at 5 blocks/s with a slight
bob; belts and cogs on the moving structure keep turning and items keep riding.

**Design (two-phase move).** Today `commit()` writes voxels instantly. New flow:

```
beginMove(moves, kind, dur):                    # replaces the body of commit()
  validate targets (same as today)
  record pending = { id, kind, t0 = clock, dur, cells: [{from,to,turn,voxel}], items: [...] }
  hold(): clear the FROM voxels (air); relocate() per-block state to the TO keys (logical cell = destination)
  mark TO cells `reserved` (Contraptions.reserved: Set<string>) -> placement there refuses "A contraption is moving here"
  emit bus 'contraption:move' { id, cells, kind, dur }          # the renderer starts the tween
endMove(id):                                    # at t0 + dur
  hold(): setVoxel(to, voxel with facing turned, active); clear reserved; items snap to final positions
tick(dt): for each pending: if clock >= t0+dur endMove; ground items on moved blocks have their pos set by the SAME
          interpolation (lerp or rotate) every frame while pending (they are carried, not teleported)
actuators: do not start a new step while their structure is pending (piston/bearing timers wait; skiff chains steps with no
          gap: the next beginMove runs at endMove, so a rail trip is one continuous glide)
```
**Rules that keep the Workshop consistent.** `Workshop.verify()` ignores keys in `moving` (else it drops parts whose voxel is
temporarily air); machine ticking pauses for pending cells (they hold their work); belts of a pending structure carry items
only visually (the carried item list is locked until `endMove`); the signal/gate lookups use the logical (destination) key.
**Save.** `Contraptions.toJSON` adds `pending: [{ cells: [[fx,fy,fz,tx,ty,tz,turn]], kind }]`; `load()` completes them instantly
(`endMove` immediately) so a save mid-move never loses blocks. Close-game mid-move test is mandatory.

**Renderer.** New `src/render/workshop/movingLayer.ts` (C1): reuses `GhostLayer`'s geometry with the **solid** material and the
atlas layer of each voxel (`aTex`); per pending cell one instance; matrix = lerp(from,to,ease(t)) or, for bearings, rotation about
the pivot `a = ease(t) * turn * 90 deg`. 48 instances max per structure, 4 structures at once cap (`MOVING_CAP` 192).
Ease: `sineInOut` for pistons/bearings, linear for skiffs. Cog/bar overlays of the moving parts take the same offset: the
`WorkshopRenderer` reads `MovingLayer.offsetOf(key)` when drawing `view.spin` rows of a pending cell.
**Sound.** Piston: low wooden thump at the end (`pipe_clunk` 0.7 pitch, existing) plus a creak loop while moving (a new
`creak` synthesized name, 0.35 volume, pitch by speed). Bearing: ratchet ticks every 22.5 deg (4 per turn, `step` pitch 1.2). Skiff:
wheel tick per block crossed, soft hum at 1 block/s multiples.
**Acceptance.** Unit (fake clock): at t = 0.4 s the FROM cell is air, TO cell is `reserved`, the ground item on the moved belt sits
midway; at dur voxels and state are final; a block placed into a reserved cell is refused; verify() keeps the parts; save mid-move
loads completed. E2E: piston pushes a mill with a belt of wheat; screenshot mid-move shows the block offset; end state equals
today's end state (golden compare).

## C.2 Riding the skiff (and platforms)

**Player sees.** Use on a skiff (empty hand) sits you on it; the camera lowers 0.2 blocks and bobs 0.01 per block of speed; a
single "Hop off" pill appears above the hotbar on phone (jump key on desktop). While seated you look freely, cannot walk.
Standing on a piston platform or a skiff with no seat just carries you.

```
# player side (src/app/game.ts, one hook): Player.ride: { provider: () => { x,y,z } | null } | null
# each frame: if ride: pos = provider() + seatOffset; velocity = 0; skip collision; if provider returns null -> dismount
# platform carry (no seat): MovingLayer.surfaceDelta(feetX, feetY, feetZ): [dx,dy,dz] | null
#   if the feet are on the top face of a moving cell, add the per-frame delta of that cell (lerp derivative) to position;
#   bearing: rotate the offset about the pivot by the frame's angle delta (position carried, yaw untouched)
# dismount: nearest free cell around the skiff (check 8 neighbours + up), toast none
```
Collision desync guard: at `endMove` the passenger is set exactly on `to` top (tolerance 1e-3) **before** voxels are
written, so the written block can never overlap the player's AABB.
Riding is not saved (load dismounts and puts the player on the skiff's top).
**Files.** `render/workshop/movingLayer.ts` (carry maths), `workshop/contraption.ts` (`passengerOf(skiffKey)`), `app/game.ts`
(ride hook, HUD pill via `ui/hud`: the HUD owner approves the pill). **Acceptance.** Unit: skiff with a passenger along a 6-block
rail ends with passenger at the end cell +/- 1e-3, never inside a solid; dismount finds a free cell; piston lift carries a player
up 4 blocks without falling through. E2E: ride the skiff, screenshot (desktop + phone portrait with the pill visible).

## C.3 Treadwheel with tame animals

**Player sees.** A broad wooden wheel on a flat block. Lead a tamed goat onto it (a lead rope item) and it plods in place, the
wheel rolls, a shaft beside it turns at 12 rpm / 24 su. The animal tires: after 90 s it slows, sits and pants; the wheel
stops; it recovers in 45 s. It eats from a trough (a depot or crate holding wheat) beside the wheel: one wheat per 120 s of
work. Without food it works 60 s more then walks off (job cancelled, toast "The goat wandered off hungry").

```
TREAD_BEASTS (src/workshop/animals.ts):   species -> { rpm, su, workS, restS, food: item, mealS }
   goat 12 / 24 su, 90, 45, wheat, 120     hound 10 / 16, 120, 30, meat scrap, 150     ox (when it exists) 8 / 48 (verify species keys, mobs/species)
Workshop.walkers: (x,y,z) => null | { kind: 'player' } | { kind: 'mob', species, id }       # widens standingOn (keep standingOn as the player branch)
sourceFor(treadwheel): w = walkers(...); if !w -> null; if mob: if mob.tired or no food -> null; else { rpm: beast.rpm, capacity: beast.su }
```
**Mob side (stream F's folder, so a seam, not an edit).** New `src/mobs/jobs.ts`: `Job = { k: 'tread', x, y, z }`, stored on the
tame mob (`SavedMob.job?`, `stamina?`); `brain.ts` gets ONE line: `if (mob.job) return runJob(mob, ctx)`. `runJob` walks the
mob to the wheel's top, locks position (yaw tangent), plays the existing walk animation phase at the wheel's rpm, drains stamina,
sits at 0, and eats from an adjacent container via `Workshop.take`. Assigning the job: Use `lead_rope` on a tame mob (ties),
then Use on the wheel (job set); Use on the mob with an empty hand (releases). **Brass horn** (C.7) calls: every tame mob within
24 blocks drops its job and follows. Clay servants (lane D) already stand in via `walkers` kind `servant`: same interface.
**Save** `SavedMob.job`/`stamina` (optional fields, old saves load). **Acceptance.** Unit with a fake mob: stamina curve, feeding,
hunger cancel, job save/load, source rpm 12; no player needed. E2E: lead a goat, shaft turns, screenshot.

## C.4 Continuous spouts and drains from pipes

**Today.** `spout` under a *tank* fills an empty container on the depot/belt below via `bucketUse`. **Remaining.** A spout wired
straight to a pipe and a drain wired to a pipe, flowing continuously.

```
Spout (C Cell): if a pipe/fluid endpoint touches its TOP face and it is powered (3 su, 16 rpm) -> outlet at SPOUT_LPS = 250
   target below, in order: (1) an empty container item on the depot/belt cell below: progress cell.fill += litres; when fill >= capacity
      swap to the full container via CHEM_CONTAINERS.filledWith(empty, fluid) (beaker 250, canister/bucket 1000), pass it on along the belt
   (2) a `basin` below: litres go straight in (the basin holds 1000 L), no container
   fluid shown: a falling 0.12-wide bar in the fluid's colour (workshopRenderer `bars`), alpha scroll, + soft `pour` loop
Drain (item_drain): a pipe touching its side or top: while a full container sits on it, empties at DRAIN_LPS = 250 into the pipe
   (pushes into the net as the FluidEndpoint inlet), empty container passes on. Spout and drain never hold litres: partial `fill`
   is saved on the spout cell (saved JSON) so a reload does not lose or invent litres.
```
Conservation: `litres_removed_from_net == litres_in_containers + basin gains + cell.fill`. Needs tank/pipe acceptance of the new fluids (B.8)
and `FluidEndpoint` lookup through `Workshop.fluidBlock` (extend with `pull(x,y,z,face,fluid?,max): {fluid,L}|null` and
`push(x,y,z,face,fluid,L): number`). The bottling line: receiver -> chem_port -> pipe -> spout -> beaker on a belt -> crate.
**Acceptance.** Unit: a 4000 L tank, 4 canisters on a belt under a spout fill in 16 s +/- 1; basin below fills; litres
conserved to 1e-6; unpowered spout does nothing; save mid-fill. E2E: golden bottling line (shared with B.8).

## C.5 Punched gearshift cards

**Player sees.** A stiff paper card with 8 holes in a row. The **card punch** bench (a small block) opens a thin sheet with an
8-cell strip: tap a cell to cycle `still / forward / reverse` (3 states; hold = skip); a speed notch row of 4 (x0.5, 1, 2, 3) is
under it; the Punch button writes the pattern onto the card (cost: the card). Use a card on a `sequence_gearshift` loads it (the
gearshift shows 8 coloured pips on its front, running one lit at a time as it plays); Use with an empty hand ejects it. The
three presets stay as defaults when there is no card.

```
Card pattern (24 bits ... 8 steps x { state: 2 bits (0 stop, 1 fwd, 2 rev), notch: 2 bits }) = 32-bit int, stored in
   ItemStack.tag (recommended) or, until then, encoded in `durability` = 1 + pattern (never shows wear: item flag noWear).
Playback: step = 1.0 s (or 0.5 s with a metronome signal touching); factor = state fwd: +notch, rev: -notch, stop: 0
   cardFactor(t, pattern) = table lookup, loops; `GEARSHIFT_PROGRAMS` gets a 4th element type 'card' with the pattern on Part
Part.s holds program; Part.card?: number (saved in the workshop snapshot)
```
Files: `workshop/kinetics.ts` (`cardFactor`), `workshop/workshop.ts` (use: card/empty-hand eject, `Part.card` in snapshot),
`content/itemsWorkshop.ts` (`punch_card` blank, `card_punch` bench), `ui/screens/workshop/cardPunch.ts` (new thin sheet),
`render/workshop/workshopRenderer.ts` (pips), recipe at the workbench with a punch tool (iron nail). **Acceptance.** Unit: pattern
round-trips pack/unpack; a card `[F,F,S,R,R,S,F,S]` yields factors at the right seconds; goggles "Card: fwd, fwd, stop, ..." under
70 chars (abbreviate to arrows: `>> . << << . > .`); save/load keeps `Part.card`. E2E: punch, load, watch the loop.

## C.6 Item vault growth

**Today** one block holds 108 stacks (Use empty hand gives the biggest stack). **Rule.** Face-adjacent `item_vault` blocks that form a
**solid cuboid up to 3 x 3 x 3** share one inventory: capacity `108 + 54 x (n - 1)` stacks (max 1512). Anything else (ragged shape)
reports "The vault must be a solid block (up to 3x3x3)" and each cell works alone. Controller = the minimum (x,y,z) cell, which
owns the stacks; belts, funnels and arms may attach to any cell (the `logi.accept/take` lookup maps a vault cell to its controller).
**Break**: if the rest is still a cuboid it re-forms; stacks beyond the new capacity drop as ground items at the broken cell.
**Sound/animation**: the lid hinge opens (one bar) when something enters; the front face shows fill as 5 pips.
**Save** controller key re-keyed on place/break (like relocate). **Acceptance.** Unit: 2x1x1 vault has 162 stacks; shape rule;
break spills only the excess; a contraption (never carries a vault: vault is not in `movable`) refuses to pick it up (assert).

## C.7 Trinkets (all blocks except spyglass and horn item; all `decor` for the congruence test)

| trinket | form | behaviour (numbers) | status sentence | signal |
|---|---|---|---|---|
| wind vane | block | rotates to the wind direction from `windAt`/`weather.ts` (tween 1 s), fast flutter in storms | "Wind from the north-west, gentle" | lights an adjacent signal cell when wind speed >= storm level |
| weather cock | block | turns to the wind; crows once (sfx `rooster`, synthesized) at dawn | "Fair weather" / "Rain on the way" (from `weather.ts` next `kind`) | lit while raining and sky open (`openSkyAbove`) |
| spyglass | held item | Use toggles zoom: FOV x0.33; phone: second tap exits, drag looks; cannot sprint | - | - |
| brass horn | block + item | item Use: calls every tame mob within 24 blocks (they drop jobs, follow 30 s) + `horn` sfx (synthesized, 2 notes); block version pulses a signal 1 s | "Horn - tap to call" | pulse |
| padlock chest | block | a crate that refuses taking by belt/arm/funnel unless a `brass_key` item is held (Use with key opens the UI-less take of the biggest stack); inputs allowed | "Chest - locked (2 stacks)" | - |
| lantern chain | block | hangs from any solid above up to 8 blocks, light 12, sways with wind (render sin on one bar), breaks into the lantern item | "Lantern - swinging" | - |

Each is one entry in `src/workshop/trinkets.ts` (`TRINKETS` table: key, tick(dt, ctx), describe(), save) with `Workshop` calling
`trinkets.tick` once; renders through `workshopRenderer.bars` (no new draw call). Aspects: each needs a fingerprint beyond
`CATEGORY_BASE` (lane D's test): propose wind vane `gale`, weather cock `gale+brook`, spyglass `glow`, horn `drive`, chest
`loam`, lantern `glow`. **Acceptance.** Unit per trinket (vane yaw follows a fake wind, cock signal in rain, horn calls fake
mobs, chest refuses an arm without key).

## C.8 Belts that cross structure borders

**Actual bug to fix first.** `Contraptions.structure()` floods through *every* movable block including belts, so a fixed belt next
to a carried one is swallowed and dragged. Fix:

```
structure(start): propagate ONLY through contraption_frame, and from a frame/actuator to every neighbouring movable part
   (a part is carried only if it touches a frame or an actuator face directly; parts do not spread to other parts)
Pin: Wrench on any part toggles `pinned` (saved, goggles "pinned"): a pinned part is never carried and ends propagation
```
Then **hand-over across a border** (belts, funnels, arms) works under one rule: items pass between a belt on a structure and a
fixed belt/depot/crate only while that structure is idle (not pending) AND the two cells are face-aligned (the existing
end-to-start check, run against the logical cell). Skiff docks: the 2 s dwell at the rail end is the unloading window. **Belts into
crates** already works (`acceptCrate`); add the lid-open bar. **Acceptance.** Unit: a fixed belt beside a framed belt is NOT in
`structure()`; hand-over works idle, blocked while pending; skiff dwelling aligned with a belt unloads. E2E: field -> belt -> mill ->
chute -> crate loop (already planned), plus piston docking.

## C.9 Workshop hooks the distillery needs (the interlock seams)

All in `src/workshop/`, owner C, written as stubs in the contract commit (section E.0):

| hook | signature | used by |
|---|---|---|
| `registerLoad(key, su, when: () => boolean)` | adds a consumer to the network of the part that touches `key`; on over-capacity the usual jam | vacuum cap (3 su), stirrer (2 su), pump |
| `rpmAt(x,y,z): number` | max abs rpm of kinetic parts touching the cell (exists internally as `signedRpm`) | vacuum cap, stirred vessel |
| `itemSinks` | see B.10 | arms, belts, hoppers |
| `fluidBlock.pull/push` | see C.4 | spouts, drains |
| basin recipes with fluid inputs | `BasinRecipe.fluid?: { key; L }` (inputs list) | tarred planks, antiseptic bandage, fertiliser |
| lube table | `LUBE: Record<item,{factor,s}>` | lubricant, grease |

---

# D. HOW THE TWO LANES INTERLOCK (data flow, numbers, owners)

| link | flow | contract | test |
|---|---|---|---|
| lubricant -> stress | `lubricant_beaker` Use -> `LUBE` -> `capacityFactor` x1.25 / 10 min; grease x1.5 / 40 min | B ships items, C owns `LUBE` (table keyed by item, B appends rows) | `solveNetwork` capacity 1.25x; golden e2e |
| residue -> lubricant + bitumen | vacuum cap powered by shaft: `rpmAt >= 16` -> `capability vacuum` | C `rpmAt` + `registerLoad`; B scan reads `host.shaftRpm` | unit with a fake workshop host |
| fuels -> engines | `FUEL_GRADES` table: gasoline saw 1.3 / tractor 1.2; diesel tractor 1.5; ethanol 0.25/0.2; **add `engine` column** for the combustion generator (tech spine owns it) and `burner` column (B.1) | single table in `core/distill.ts`; consumers read it | existing `distillFuel.test.ts` + new columns |
| fuels -> chainsaw/tractor PTO | tractor drains the same canister while turning a shaft (24 rpm / 30 su, workshop PTO) | C's PTO reads `FUEL_GRADES[...].tractor` burn rate | PTO drains 1.2x slower on gasoline |
| spouts/drains <-> basins/stills | pipes -> spout -> container/basin; drain -> pipe -> tank -> `chem_port` -> flask | C.4 + B.8 | litre ledger across the whole line |
| arms feeding stills | `mech_arm` target = vessel/filter/catalyst/hopper via `itemSinks` | B.10 | arm loads yeast into a vessel, a hopper outputs asphalt |
| belts through the refinery | belts deliver catalyst and filter media to `tower_hatch`, spent media and asphalt leave on belts, canisters ride belts under spouts | `itemSinks` + spout fill | e2e golden "plant" |
| treadwheel animals <-> farming/food | goat eats wheat from a depot, hound meat; tired -> sits | C.3 `Workshop.take` | unit |
| contraptions <-> chem | chem modules are entities with liquid, so **never movable**; a piston never pushes one; `movable()` returns false for all `CHEM_KINDS` and `tower_*` | assert in `contraption.test.ts` | unit |
| skiff carrying liquids | a skiff carries one stack: canisters/beakers ride it to the vault; never a flask | stack rule | unit |
| bitumen -> roads -> tractor | `asphalt_block` surface 1.4 vehicle | `BlockDef.surface` | B.5 |
| vacuum + stirrer on the same shaft | both `registerLoad`: over capacity jams as usual; goggles shows "load 14.5/24 su" | C solver | unit |

Seam ownership: **types and tables are B's, hooks are C's, the glue lines in `app/game.ts` are made once in the contract commit.**

---

# E. BUILDER ORDERING - 2 builders per lane, conflict-free

## E.0 Contract commit (before any builder; by the lane architects, one commit each; run `tsc` + the transport tests)

- **B-0** (shared, append-only): `FluidKey` += `lubricant`, `bitumen` and one
  `elixir_<buff>` per buff (6); `fuel` alias in the sanitizer); `ItemStack.tag?: number` (+ save sanitizer, merge compare); `BlockDef.surface?`; empty
  stubs `core/rigString.ts`, `sim/distillPlan.ts`, `sim/distillBurner.ts` exporting typed signatures. **No logic.**
- **C-0**: `workshopHooks.ts` interface file (`registerLoad`, `rpmAt`, `itemSinks`, `walkers`, `fluidBlock.pull/push`) wired in
  `Game` with no-op defaults; `LUBE` converted to an item-keyed table (behaviour identical); `contraption.ts` split into
  `contraption.ts` (rules) and `contraptionMove.ts` (the new two-phase mover; initially calls the old instant commit).

## E.1 Lane B

| builder | owns (exclusive) | sequence |
|---|---|---|
| **B1 chemistry** | `core/chem.ts`, `core/distill.ts`, `sim/distill.ts`, `sim/distillScan.ts`, `content/{blocksDistill,machinesDistill,fluidsDistill}.ts`, `sim/distill*.test.ts` | W1 reflux head (B.2) -> W2 filter bed + lubricant component (B.3) -> W3 vacuum cap + residue run + bitumen grade (B.4/B.5) -> W4 asphalt/grease reactions, `HEAT_SENSITIVE`, essence (B.6) -> W5 catalyst/pressure/steel shell (B.9) -> W6 tower scan/step (B.11) |
| **B2 player and content** | `sim/distillPlan.ts`, `sim/distillBurner.ts`, `sim/distillActions.ts`, `core/rigString.ts`, `content/{itemsDistill,recipesDistill}.ts` (+ new `itemsPotion.ts`), `render/distill/*`, `ui/screens/distill/*`, `scripts/e2e-distill.mjs`, `docs/api/distillery.md` | W1 ground burner (B.1, 3-line `baseTemp` hook agreed in B-0) -> W2 plan ghosts + problem pulse + goggles sentence (B.7) -> W3 tank/pipe support + bottling e2e (B.8) -> W4 potions, drinks, elixirs, bandage, lamp (B.6) -> W5 rig sheet -> W6 hopper/itemSinks (B.10) -> polish (B.12) |

Conflict rules: only B1 edits `sim/distill.ts` and `distillScan.ts`; B2 gets what it needs through the stub `DistillHost` fields added in
B-0 (`burnerTemp`, `planAt`). If B2 needs a change in `distill.ts` it asks B1 (one line request in the shared notes). B2's W3 waits for B-0
fluid keys; B1's W3 waits for C-0's `rpmAt`.

## E.2 Lane C

| builder | owns (exclusive) | sequence |
|---|---|---|
| **C1 motion** | `workshop/contraption*.ts`, `render/workshop/movingLayer.ts`, `workshop/animals.ts`, `mobs/jobs.ts` (new), `app/game.ts` ride/walkers hook lines, contraption tests | W1 pin rule + `structure()` fix (C.8) -> W2 two-phase mover + tween + save-mid-move (C.1) -> W3 skiff glide, riding, platform carry (C.2) -> W4 treadwheel animals + horn calling (C.3) -> W5 belt docking and crate lid |
| **C2 logistics and things** | `workshop/logistics.ts`, `workshop/signals.ts`, `workshop/trinkets.ts` (new), `content/{itemsWorkshop*,recipesWorkshop,basinWorkshop,objectivesWorkshop}.ts`, `ui/screens/workshop/*`, `render/workshop/workshopRenderer.ts`, `scripts/e2e-workshop.mjs`, `docs/api/workshop.md` | W1 itemSinks + fluid `pull/push` + `basin` fluid recipes (C.9) -> W2 continuous spouts/drains (C.4) -> W3 punched cards + bench (C.5) -> W4 vault growth (C.6) -> W5 trinkets (C.7) |

`workshop/workshop.ts` is the hot file: C1 touches `relocate/verify/solve/tick moving`, C2 touches `use/describe/snapshot`. Rule: C1 lands
W1-W2 first (they only add a `moving` set and the pin flag); C2's `workshop.ts` edits start after C1-W2 merges; both keep edits inside
disjoint method bodies and rebase before commit.

## E.3 Cross-lane order (the four dependencies)

```
B-0, C-0  ->  [B1 W1-W2, B2 W1-W2, C1 W1-W2, C2 W1]  in parallel (no shared files)
          ->  C2 W2 (spouts) needs B2's tank fluids  ->  then B2 W3 bottling e2e
          ->  B1 W3 (vacuum) needs C-0 rpmAt/registerLoad (stub then real by C2 W1)
          ->  B1 W4 potions/essence, B2 W4 elixirs; C2 W3-W5, C1 W3-W5 in parallel
          ->  B1 W5-W6 (Current/Atomic) last, after the six-age refactor tiers are final
```
"Whoever writes the code does not certify it": each builder's wave is certified by the *other* lane's builder re-running
`tsc`, `vitest` and the lane e2e; the architect signs only after reading the diff.

---

# F. TEST AND E2E CHECKLIST (what "done" means per item)

| item | unit (file) | e2e step |
|---|---|---|
| ground burner | `distillBurner.test.ts` | place base on grass, charcoal, flame count > 0, spirit run completes (desktop + phone) |
| reflux head | `distill.test.ts` | card `reflux_ethanol` yields `fuel_ethanol` |
| filter bed | `distillFilter.test.ts` (conservation incl. absorbed) | wash -> filter -> cleaner spirit |
| lubricant | `distillProcess.test.ts` + `workshop.test.ts` (x1.25) | crude -> vacuum -> filter -> beaker -> oil shaft, goggles "oiled" |
| asphalt/roads | `asphalt.test.ts` (tractor/walk multipliers) | drive tractor on asphalt vs dirt, screenshot |
| potions | every elixir card built and run | vial drunk, HUD chip |
| rig plan/ghosts | `distillPlan.test.ts` | ghost screenshot, then the rig runs |
| tower | `distillTower.test.ts` | pipe-fed run, three cuts into three tanks |
| tween | `contraptionTween.test.ts` (fake clock) | mid-move screenshot offset block |
| riding | `ride.test.ts` | ride skiff, pill visible on phone |
| treadwheel animals | `animals.test.ts` | goat on wheel, shaft turns |
| continuous spout | `spoutFlow.test.ts` (litre ledger) | bottling line |
| punched cards | `card.test.ts` | punch + load + playback |
| vault growth | `vault.test.ts` | 2x2 vault, belt into any cell |
| trinkets | `trinkets.test.ts` | vane turns with wind |
| belt borders | `contraption.test.ts` pin cases | field -> belt -> mill -> chute -> crate |

Fixtures to add: an **old-save fixture** with a mid-move piston and with a belt next to a frame, and one with a flask holding
`residue` (so the new components load).

# G. RISKS WORTH A BUILDER'S ATTENTION

1. **Two-phase move vs `verify()`.** Forgetting the `moving` exemption silently deletes machines mid-move (the one data-loss path). Test first.
2. **Reserved cells.** World edits (player, chunk gen, other machines, the tractor) can all write a reserved cell; the guard must live in
   the shared "place" check and in `hold()` writers, not just the player.
3. **`structure()` pin rule** changes existing contraptions that relied on belts spreading. Old saves keep structure shapes; migrate by
   treating every pre-existing structure as "all parts glued" once (`Part.glued` default true, new parts default false).
4. **Vacuum cap loops back to the shaft solver**: a vessel's `registerLoad` makes the network over-capacity and jams a mill. Show it in
   the goggles ("load 14.5/24 su") and keep 3 su small.
5. **Conservation with the filter** (absorbed litres) must be added to the fuzz ledger the same commit as the filter, or the fuzz fails
   for unrelated reasons.
6. **`ItemStack.tag`** touches inventory merge: stacks with different tags must not merge (cards, sips). One test.
7. **Heat-sensitive essences** are the first place the still can *ruin* a batch: the toast and the red lamp must say why.
8. **Phone**: every new interaction here is one Use tap; the only added control is the "Hop off" pill. No drag-and-drop anywhere.

# H. WHAT I DID NOT DECIDE (needs the owner, defaults given)

1. Tower age: Atomic (recommended) vs Forge (CONGRUENCE).
2. Lubricant item: `lubricant_beaker` (250 L, glass back, recommended) vs a reusable oil can.
3. Nightsight buff for Glowcap Draught: a seventh `DrinkBuff` (recommended small) vs reusing `lightActive`.
4. Alcohol cost: aim sway and Dizzy (recommended) vs only a timer.
5. `ItemStack.tag` (recommended) vs encoding in `durability`.

# I. CHECK LIST FOR THE ARCHITECTS

Contract commits (E.0) before builders; the age table moves with the six-age refactor (one table per lane); the four
shared-file edits are `FluidKey`, `ItemStack.tag`, `BlockDef.surface`, and the `brain.ts` job line (stream F). Everything else is in
files one builder owns.

<!-- ======================== END docs/advice/distillery-workshop.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/magic-and-food.md ======================= -->
# FILE: docs/advice/magic-and-food.md

# Advice: magic depth and living systems (food, brewing, farming)

Written 2026-11-21 by the magic-and-food ADVISOR (read-only session; nothing built or run). Audience: the builder sessions that
start after the six-age refactor. Read with `docs/CONGRUENCE.md` (streams D and E), `docs/OVERHAUL_PLAN.md` part B,
`docs/api/{magic,sugar,brewing-buffs,food-rules,crops,weather}.md`, `docs/DISTILLERY_PLAN.md` sections 9 and 12.
Owner decisions are fixed (six ages, Ember = handwork, furnace is the heart, in-world beats screens, original names, magic is
"a little" and research based, essentia on every block). Code facts below were checked in the repo on this date; items marked
**(verify)** are guesses the builder must confirm in one grep before relying on them.

Facts checked that shape the design:
- `Buffs` has one slot per drink family (tea: spring/hearthkept/mending, coffee: swift/vigor/lasting) plus `wellFedS`, `wellWarmedS`,
  `sugarS`. Constants: Swift 1.2, Spring 1.35, Vigor 1.25, Hearthkept 0.5, Lasting 0.5, Mending x2, Sugar 1.12 speed and x2.5 Well-Fed
  burn, `DRINK_BUFF_S` 180, Well-Fed 360 s. Today the speed of Swift and Sugar Rush MULTIPLY (1.344).
- `LIGHTNING_MIN_DIST` is 60 blocks: real strikes are always far away, so a lightning rod cannot "catch" the existing flash (see M7).
- `DAY_LENGTH_S` is 900. `aspectTable.ts` has keywords for egg, milk, salt, meat but **no `egg`/`milk`/`cheese`/`salt` items exist**
  in `src/content` (verify): animal products are new content. Existing mobs: hen, goat, boar (`creatures.ts`) and the Emberbound
  automatons (`ember_core`, `scrap_metal` drops).
- Magic today: 24 research entries (Ember 7, Bronze 10, Forge 7), rods 16/32/64 charge, foci kindle/light/ward/blink, clay servants
  turn hand cranks only, tubes are a private network (`essentiaNet.ts`, 256 tube cap), spark/soul/void exist only as overrides.

---

## 0. The guardrails (every feature below must pass these)

**G1. The tech spine leads.** Magic never makes a raw material, an ingot, fuel units, or a tier. It makes conveniences, saves
trips, and gives a few small tricks. Every magic convenience has a tech equivalent that arrives later in the same age or the next
one and is better at scale (golem carry 1.3 items/s vs a belt; hearth siphon vs a bellows; infused kettle vs a boiler).
**G2. Magic costs a trade.** Each device draws essentia continuously; supply is bounded (wellsprings 1 in 10 chunks, rod draw
1-5 units/s, aura recovery 1 per minute per aspect per chunk). An infusion changes one number by at most x1.5 (x1.25 for
anything that touches electricity) and never adds an output.
**G3. Nothing on the winning path.** The solver never reads magic or the new food/brew content (`content.test.ts` keeps proving
completion). New foods, drinks and potions are optional comfort and are not in the required-item closure of `game:won`.
**G4. The furnace stays hands-on.** Golems and essentia never stoke, light or tend the furnace; only the existing hearth siphon
(one-way, near the end of a burn) and Vial of Cinder (+90 s) touch it, and both stay as they are.
**G5. Every new item and block gets a real fingerprint** (section 4.3 test) and every new aspect gets a tier, two parts, a colour
and an entry (CONGRUENCE 4.1).
**G6. In-world first, phone first.** One status sentence (<= 70 chars) per device on the target line; a screen only for the
notebook, the rune desk and the stewpot-free recipes below. Touch targets 44 px, long-press 420 ms is the secondary action.
**G7. Ages by NAME** via `ageIndexOf('forge')`; never a bare number. No recipe raises more than one gate (CONGRUENCE rule 3).

---

# Part 1. Magic depth

## 1.1 Research tree growth: 24 -> 40 entries

Conventions: entries live in `src/magic/entries.ts` with the helpers `pair/corners/triple/quad/wall/cellAt`; each gets a board the
existing "boards solvable with each age's aspects" test proves; recipes are gated through `gates.ts`; flags go in
`unlocks.flags` and are read with `hasFlag(state, flag)`. Lore for a late aspect is only awarded from its age on (rule L below).
New aspects used as anchors appear only in entries of their own age or later, so a board never asks for lore the player cannot own.

| # | key | title | age | requires | board anchors (+ blockers) | unlocks | what the player gets |
|---|---|---|---|---|---|---|---|
| 25 | `hedge_lore` | Hedge Lore | ember | `gathering_rod` | pair spring/ward | flag `green_thumb` | spring jar boosts nearby crops (F4) |
| 26 | `steam_sense` | The Sense of Steam | bronze | `infusion` | pair steam/drive | recipes `inf_kettle_cinder` | altar infusion: Kettle of Cinder; goggles-like aspect line on steam parts |
| 27 | `aura_dial` | The Aura Dial | bronze | `aura_reading` | corners gale/loam/brook | flag `aura_dial` | the HUD dial (M1) |
| 28 | `tincture_craft` | Tincture Craft | bronze | `still_trace`, `essence_jar` | triple clarity/spring/ward | flag `tincture_vial`, recipes `elixir_*` (gated in F3) | essence in the blend vessel; elixirs |
| 29 | `workshop_infusions` | Hands of Drive | bronze | `infusion`, `rune_desk` | quad rune/craft/drive/clarity | recipes `inf_driven_crank`, `inf_ever_oil` | two workshop infusions (M5) |
| 30 | `storm_draw` | Drawing the Storm | bronze | `aura_reading` | triple gale/frost/rift | flag `storm_draw`, recipe `storm_spire` | weather draws (M7) |
| 31 | `soul_draw` | The Quiet Draw | forge | `clay_servant` | pair spring/mind via `soul` anchor | flag `soul_draw` | rod draws soul from living things (M2) |
| 32 | `golem_walker` | The Clay Walker | forge | `clay_servant`, `soul_draw` | quad spring/mind/craft/drive | recipes `clay_walker`, `waypoint_seal` | walking golems (M6/G) |
| 33 | `golem_hands` | Willing Hands | forge | `golem_walker` | triple craft/drive/rune | flag `golem_tasks` | treadwheel seat, carry task (G2) |
| 34 | `tube_ports` | Ports and Valves | forge | `essentia_tubes`, `iron_rod` | corners clarity/steam/ward | flag `tube_ports`, recipe `essentia_valve` | tubes feed machines (M3) |
| 35 | `ash_stave` | The Ash Stave | forge | `iron_rod`, `focus_ward` | corners vein/gale/spring | recipes `ash_stave` | stave, two foci (M4) |
| 36 | `focus_mend` | Mending Focus | forge | `ash_stave`, `soul_draw` | quad spring/ward/mind/soul | recipes `focus_mend` | small heal focus |
| 37 | `spark_draw` | Gathering Sparks | current | `soul_draw` | corners spark/glow/drive | flag `spark_draw`, recipe `spark_jar` | spark from storm spire and dynamo leak |
| 38 | `spark_walker` | The Spark Walker | current | `golem_hands`, `spark_draw` | triple spark/soul/drive | recipe `spark_walker` (infusion) | fast golem |
| 39 | `focus_arc` | Arc Focus | current | `ash_stave`, `spark_draw` | pair spark/ward | recipe `focus_arc` | stun focus |
| 40 | `void_seed` | The Seed of Emptiness | current | `void_jar`, `spark_draw` | triple void/ward/wane | flag `void_draw` | void from deep dark; void cell (M5) |

Atomic and Star stay reserved: `warded_home` (atomic) and `star_light`, `void_mastery` (star) are listed in `entries.ts` as `planned`
comments only. If the sibling world/progression advisor puts something in those ages, add it then.

Rules for the table:
- **Rule L (late lore).** `LATE_ASPECT_AGE = { soul: 'forge', spark: 'current', void: 'current' }` in `aspectTable.ts`; `scanObject` skips
  lore for an aspect whose age is later than the player's best reached age (`state` already knows `known`, add the age as a
  parameter). Before then the aspect is simply not shown on that object's chips. Prevents the early scan of a hen teaching `soul`.
- Board difficulty: free cells 14-18 of 25, one blocker for Bronze, up to three for Current; every entry's `solveBoard` hint must
  succeed with the aspects of its own age (existing test pattern, extend the list).
- Notebook list grows to 41 rows; group by age (already) and collapse finished entries (phone scroll).
- Objectives (optional, flag based): `first_golem` (flag `golem_built`), `sweet_cup` (flag `sweet_drunk`), `first_potion` (flag
  `potion_drunk`), `green_thumb_set` (flag `green_thumb_on`). One line each in the objectives file of the owning stream.

## 1.2 Aspects: spark, soul, void as drawable

Draw rules live in `Magic.gather()` (a held rod, Use). They are all **site-bound** (you go somewhere) so they stay small.

| aspect | tier | age | where it comes from | rate | player sees |
|---|---|---|---|---|---|
| soul | 3 | forge | a living thing within 3 blocks of the rod: hen, goat, boar, tame or wild, automaton | 1 per 8 s per creature, creature "listless" 20 s, 120 s cooldown, max 4 per creature per day, never damage | rod glows violet, a thin violet thread lifts from the animal, it stops grazing and its head droops; animal never flees |
| spark | 3 | current | storm spire hit (M7), `dynamo_leak`: a running dynamo/generator within 2 blocks of a spark jar | spire 8 per hit; leak 1 per 20 s costing 0.5 % of that machine's output (a hook in the power sim, optional) | blue-white arc into the jar, jar fill crackles |
| void | 3 | current | the deep dark: aura level for void = `clamp((seaLevel - y - 30) / 2, 0, 32)` in unlit cells; rod draw 1 per 10 s | slow on purpose | rod hum drops an octave, vials look "empty" with a black core |

Pseudocode, gather extension (no change for the six primals and twelve compounds):

```ts
function lateDraw(aspect: 'soul'|'spark'|'void', ctx): number {            // units this second
  if (!ageReached(AGE_OF[aspect]) || !hasFlag(research, FLAG[aspect])) return 0; // 'soul_draw' | 'spark_draw' | 'void_draw'
  if (aspect === 'soul') { const m = livingNear(ctx.pos, 3).find(canDrawSoul); if (!m) return 0;
    m.soulCooldownS = 120; m.listlessS = 20; return 1 / 8; }
  if (aspect === 'void') return voidAura(ctx.pos) > 0 ? 0.1 : 0;
  return 0;                                    // spark is never drawn by rod: it arrives by spire / dynamo into a spark jar
}
```
State: creature cooldowns are session-only (a `Map<mobId, number>` in `magic.ts`, not saved), so no save change. Fingerprints for
creatures get a one-line `soul` weight through `aspectTableLife.ts` (4.3) and are shown only with rule L.
Why this stays modest: soul draw is ~7 units/min per animal; a clay walker eats 2 Spring per minute (not soul), only the infusion
that makes it (6 soul) and the focus_mend (cost 6 charge) use soul. Spark has one source per storm, void one place.

## 1.3 Aura HUD dial (M1)

A tiny ring on the compass, shown once `aura_dial` is done (or whenever the notebook or a rod is held). Not a screen.
- Ring colour = the dominant primal/compound aspect at the player's feet (`aura.sample(x, z, a)` for all 18 non-late aspects, take
  max), ring fill 0..1 = level / 64, a second small dot = the strongest OTHER aspect.
- A pulsing outer ring when a wellspring is within `NODE_REACH` 6 (uses `compass`); the ring points toward the nearest node as a
  tick on the circle when within 48 blocks (`nodesNear`), so the dial doubles as a compass to wellsprings.
- Tap or long-press on the dial: toast "Aura: gale 38, loam 21. Wellspring (brook) 41 m NE" (<= 70 chars). 44 px tap target.
- Update at 4 Hz, one `Aspects` reused object, zero allocation per frame. File: `src/ui/hud/auraDial.ts` (new) + a three-line
  mount in the HUD (`src/ui/hud/*` compass file) **owned by the magic builder**; if the six-age refactor moves the HUD, mount it
  where the compass is.
- Sound: none while idle; `scan_chime` pitched down one step when the dominant aspect changes (<= 1 per 10 s).
- Test: `auraDial.test.ts` (pure `auraDial(x,z,nodes)` returns `{aspect, level, other, nodeBearing}`): deterministic, level in 0..1,
  nearest node bearing correct for 3 seeded cases; DOM mount smoke test under `src/ui`.

## 1.4 Essentia tubes: unify or bridge? Recommendation: BRIDGE, not rewrite

CONGRUENCE D3 proposes re-implementing `essentiaNet.ts` on `pipeGraph.ts` with a fluid key. Recommendation: **do not** (risk
without gain): 21 aspects do not fit the `FluidKey` union, the pipe machinery carries one fluid per net with litres, and the
tube network already has a 256-tube cap, tests and a save. What the player wants from "unified" is: the same placing tool, the same
look and break behaviour, and tubes that connect to machines. Deliver those:

1. **Same tool and look (reuse).** `essentia_tube` is placed with the pipe tool/line placement and uses the pipe segment mesh with
   a glass tint and an aspect-coloured inner line (the jar's aspect, or neutral grey when empty). If the pipe placement tool is
   keyed by `FluidKey`, add a second small registry `PIPE_LIKE = ['essentia_tube']` instead of touching the union.
2. **Ports (new, `tube_ports` research, Forge).** A tube that touches a machine with an `ESSENTIA_PORTS` entry is a feed:
   | machine | accepts | effect |
   |---|---|---|
   | still / flask rig | any aspect (as today's vial trace), `clarity` purifies | continuous trace, 1 unit per 30 s of boil |
   | kettle / boiler (Bronze steam, when built) | `cinder` or `steam` | each unit = 20 s of heat-equivalent; `steam` makes steam with no fuel but the furnace's warm zone dims (CONGRUENCE D4: trade-off) |
   | hearth siphon (as now) | `cinder` | as now |
   | rune desk / altar | any (as now) | as now |
   | farmland sprinkler: none; green-thumb reads jars directly | | |
3. **Valve block `essentia_valve`** (Forge, vein + clarity + gale, cost 2 iron plate, 1 glass): a facing tube segment; it moves 1
   unit/s from the upstream jar to the downstream jar. Lets a wellspring jar feed a distant store; tubes alone only let consumers
   reach jars (today's behaviour). Throughput cap for any tube run = 4 units/s (OVERHAUL B.4): the net hands out at most 4 per second
   per consumer pull. Visual: one mote per unit travelling the run (instanced, <= 24 total).
4. **Save.** Nothing changes for existing tubes. A valve is a block with facing bits; fill is in the jars. Fixture test: a world
   with 20 tubes and 3 jars loads identically.

If a later builder still wants the pipe-graph rewrite, the clean migration is "tube = pipe segment with `fluid: 'essentia'` and a
sidecar `Record<segmentKey, {aspect, n}>`", with the existing tube blocks mapped on load; record that in `docs/api/magic.md`
Known limits instead of doing it now.

## 1.5 Rods, staves, foci: progression

Today: `vis_rod` 16 / draw 1 (Ember), `bronze_rod` 32 / 2 (Bronze), `iron_rod` 64 / 3 (Forge); foci kindle (cost 2), light (1), ward
(6), blink (4), each used from the hotbar and drawing on the best carried rod.

Add (all values in `RODS` / `FOCI` tables, no new code paths except the stave's slot):
| item | age | capacity | draw/s | slots | notes |
|---|---|---|---|---|---|
| `ash_stave` | forge | 96 | 4 | 2 foci | held in hand; **hold Use 420 ms to swap the active focus** (phone-friendly, a small glyph above the hotbar slot shows it); crafted at the Rune Desk: iron_rod + 4 plank + 1 iron plate, cost ward 12 + rune 8 |
| `spark_stave` | current | 128 | 5 | 3 foci | recharges 1 unit/s from an adjacent spark jar (`spark` units cost 1:4 charge, the 4 is the bridge cost) |

Foci (cost is charge, cooldown seconds):
| focus | age | cost | cd | effect |
|---|---|---|---|---|
| `focus_mend` | forge | 6 | 40 | heal 4 health over 6 s, stops if you take damage; sound `cast` + soft rising chime; less than a Mending tea |
| `focus_reach` | forge | 3 | 8 | pulls ground items within 6 blocks to your feet (uses the ground-items system, `docs/api/ground-items.md`); a vacuum-pump style whoosh; an Ember-age convenience that does NOT beat the pump/magnet at scale |
| `focus_arc` | current | 8 | 15 | an arc to the nearest hostile automaton within 10: 2 s stun and 3 damage; light flash; no griefing |
Rod upgrade rule: a rod's `draw` multiplies gather speed on that aspect's aura only up to the aura level / 8 per second, so a Star
rod would still not outpace aura recovery; recorded in `RODS`.
Art: stave = rod model with a longer shaft and two small glass beads that glow in the focus colours; foci stay icons. Animation:
a 0.3 s forward raise, a ring of aspect motes, no recoil.

## 1.6 Infusions tied to every age (altar rows)

`INFUSIONS` rows: `center`, `around` (pedestal items), `cost` (aspects), `seconds`. Each row changes ONE number, listed with the
tech piece it improves. Existing: `steel_infusion`, `clay_servant`, `vein_bronze`.

| age | id | center + around | cost | seconds | effect |
|---|---|---|---|---|---|
| bronze | `inf_ever_oil` | oil can with lubricant + 2 `glow` vial | glow 6, clarity 2 | 30 | oiled state lasts x3 (goggles: "oiled 27 min") |
| bronze | `inf_driven_crank` | hand_crank + 2 bronze_ingot | drive 8, craft 2 | 40 | crank stress capacity x1.5 (rpm unchanged) |
| bronze | `inf_kettle_cinder` | kettle + cinder vial | cinder 8 | 30 | kettle/boiler uses 0.5x heat; needs the kettle block to exist (Bronze stream A) |
| forge | `inf_warded_coat` | padded coat + 2 iron plate | ward 12, rune 4 | 60 | permanent damage x0.9 (focus_ward remains x0.5 for 30 s); one per coat |
| forge | `inf_clay_walker` | clay_servant block + 2 `soul` vial | soul 6, drive 4, mind 4 | 90 | becomes a walker (research `golem_walker`) |
| forge | `inf_quick_quern` | quern twin (workshop) + 2 `drive` vial | drive 8 | 45 | machine speed x1.25 for that machine (flag on the machine entity, not on rpm) |
| current | `inf_spark_walker` | clay_walker + 2 `spark` vial | spark 12, soul 4 | 120 | walker moves and works x2 |
| current | `inf_storm_lamp` | lamp + 2 `glow` vial | glow 6, spark 3 | 40 | a lamp that never needs power, light 12 (a convenience, not a generator) |
| current | `inf_void_cell` | battery + 2 `void` vial | void 8, ward 4 | 90 | battery capacity x1.25 |
Atomic (reserved): `inf_warded_vault` (item vault + ward) and Star: none. The rule G2 limit x1.5 (x1.25 for electric parts) is
asserted by a test over the table: `infusions.test.ts` loops the rows, `effect.mult <= 1.5` and `<= 1.25` for rows with `electric: true`.
Per-machine effects are one boolean/number field on the existing machine entity (`infused?: string`), read by the owning sim at its
single rule (`Workshop.crankCapacity`, lube duration, kettle heat). Builders add the field only where the table needs it.
Altar feel (existing): the pedestals' items lift and spin, jars drain; add a **settling chord** on completion and a coloured ring
that shrinks as `seconds` runs, so the player sees progress without a screen.

## 1.7 Magic stays modest: a one-line budget

`MAGIC_BUDGET` (docs, enforced by two tests): (a) total essentia a single wellspring can give = 1 per 15 s = 4 per minute; a
fully-tubed base with 4 wellsprings is ~16 per minute, i.e. one infusion per 2-3 minutes at most; (b) the sum over all INFUSIONS of
the multiplier excess is capped as above; (c) the progression solver does not read `ARCANE_RECIPES` or `INFUSIONS` for any output
the tech spine requires (`content.test.ts` exists and keeps proving this); (d) golems: <= 4 within 32 blocks (section 1.8).

## 1.8 Walking golems (the constructs of the workshop)

Evolution of the existing `clay_servant` block: (1) the block still turns a crank (Forge, built); (2) the **Clay Walker** (Forge,
`golem_walker`) is an entity that walks to jobs; (3) the **Spark Walker** (Current) does the same at x2.

The Walker, as the player sees and does it:
- Made at the altar (infusion row above). It stands up from the servant block with a puff of clay dust and a soft violet eye. It
  is not a mob in `src/mobs` (no combat, spawning or population rules): it is a small entity list in `src/magic/golem.ts`
  (`GolemHost`), rendered by `src/render/magic/golemRenderer.ts` with the same part-box format as `CreaturePart` (body, head, two
  arms, two legs; `anim` swing).
- Look: clay red-brown `#b0764a` with darker cracks (painted texture), a bronze belt, an eye in the colour of `soul` (`AspectInfo.color`).
  Size 0.6 x 1.1 blocks. Idle: slow blink every 4 s and a breathing 1 px body bob. Working: arm swing in time with the job (crank:
  circles, carry: lifting a small box on its back). Tired (no Spring): slumps, eye dims, 20 s later it sits down and stops.
- Sound: `golem_step` (a low soft thud, pitch by speed, max 2 per second), `golem_work` (a short wooden knock), `golem_wake` (a
  rising two-note chime). Volume budget: one step loop per visible walker, distance-attenuated; max 3 audible at once.
- Needs: 1 Spring unit per 30 s idle, per 15 s working, from any jar within 4 blocks of its HOME (the servant block cell) or tubed to
  it. It remembers the jar position, not the tube path. Without Spring it stops where it stands and the status line says why.
- **Interaction (phone first).** Use with an empty hand: toggles Work / Stay ("Clay Walker: stays here"). Use with a Spring vial:
  feeds 4 units. Use with the notebook: scans (it teaches `soul`, `craft`, `spring` once). **Waypoint Seal** (`waypoint_seal`, item,
  cloth + 2 rune at the desk): Use on a block stores point A (a violet marker block outline for 10 s and a toast "Pickup set"),
  Use on a second block stores point B; Use on the golem with a ready seal assigns the pair; a pair of the same seal can be
  reused. No screen; an inventory-free way to say "carry from A to B".
- Status sentence (target line and goggles): "Clay Walker: carrying wheat to crate, Spring 9" (<= 70 chars).

Tasks (research `golem_hands` unlocks the last two; `clay_servant` block already does the first):
| task | rule | numbers |
|---|---|---|
| crank | stands next to a hand crank and calls `Workshop.crank` | 1 stroke per second (as the servant today) |
| treadwheel seat | a `treadwheel` within 8 blocks: walks in place on the wheel | supplies 8 rpm, 4 su (a weak source, below a crank player + below a water wheel) |
| carry | picks up to 8 items from the pickup block's inventory/ground items at A, walks to B, drops into inventory/ground | one trip per ~6 s over <= 16 blocks: about 1.3 items per second, less than a plain belt run |
| NOT | stoke, light or fuel the furnace; harvest; fight; place or break blocks; open doors it is not walked through | (G4) |

Pathing (bounded and cheap): 3D grid A* with step-up 1 and drop <= 2, radius 16, node budget 400, replan at most 2 Hz per walker;
a failed path sets `blocked` with the status "Clay Walker: no path to B" and retries every 10 s. At most 6 walkers are ticked; one
that is more than 64 blocks from the player is **suspended**: its position is frozen (it shows as a still figure when the chunk
loads), and it resumes when you return, so no offline simulation and no chunk loads. Cap: 4 working walkers within 32 blocks of each
other (a new one refuses to wake: "Too many walkers nearby").
Save shape: `WorldSave.golems?: { id: number; kind: 'clay'|'spark'; x,y,z: number; yaw: number; home: [number,number,number];
spring: number; state: 'work'|'stay'|'tired'|'blocked'; task: { kind: 'crank'|'tread'|'carry'; a?: Vec3; b?: Vec3 } | null;
carry: { item: string; n: number } | null }[]`; missing = none; each damaged entry is dropped, not the whole list (as `magic.ts`
does for jars). `docs/api/magic.md` records it.

---

# Part 2. Food, brewing and farming, congruent with sugar, the still and essentia

## 2.1 Baseline and what changes

Keep: tea/coffee/sugar rules, Sugar Rush (speed 1.12, Well-Fed burn x2.5), `eat()` and `drink()`, hearth stew Well-Fed 360 s. The one
rule change is **stacking** (2.2), implemented once in `buffs.ts`; every old number still holds when only one buff is active, and a
regression test pins them.

## 2.2 Buff stacking rules (F2, the core of the congruence request)

Buffs act on **stats**. For each stat, active contributions are sorted strongest first and combined with diminishing returns, then
capped. This replaces today's plain multiplication.

```ts
// bonus b_i = mult_i - 1 for stats where bigger is better; r_i = 1 - mult_i for drain stats (smaller mult is better)
const STACK_WEIGHTS = [1, 0.5, 0.25, 0.25];                 // strongest, second, third, rest
function combine(stat: Stat, parts: number[]): number {      // parts = bonuses (or reductions) > 0
  parts.sort((a, b) => b - a);
  const total = parts.reduce((s, p, i) => s + p * (STACK_WEIGHTS[Math.min(i, 3)]), 0);
  return clamp(stat.higherIsBetter ? 1 + total : 1 - total, stat.min, stat.max);
}
const STATS = {
  speed:   { higherIsBetter: true,  max: 1.35 },   // Swift .20, Sugar .12, Merry .00, Gale elixir .10
  jump:    { higherIsBetter: true,  max: 1.5  },   // Spring .35
  mining:  { higherIsBetter: true,  max: 1.4  },   // Vigor .25, Rift elixir .15
  regen:   { higherIsBetter: true,  max: 2.0  },   // Mending +1.0 (x2), Hale tonic +.5   (a "x2" is bonus 1.0)
  foodDrain:   { higherIsBetter: false, min: 0.3 },// Well-Fed .5, Lasting .5, Hearty .2, Gale elixir (sprint only) .4
  warmthDrain: { higherIsBetter: false, min: 0.3 },// Hearthkept .5, Merry .3, Hardy tonic .3
};
// Costs add up, they are not diminished:
wellFedBurn = clamp(1 + sum(burns), 1, 4);               // Sugar Rush burn 1.5 (=> 2.5 alone, as today), Firewater .5
```
Results, with numbers: Swift (1.2) + Sugar Rush (1.12) = 1 + .20 + .06 = **1.26** (was 1.344). Spring is a separate stat so Sweet Green
Tea still jumps and runs. Well-Fed (.5) + Lasting (.5) + Hearty (.2) = 1 - (.5 + .25 + .05) = **0.2 -> clamped 0.3**. Hearthkept + Merry:
1 - (.5 + .15) = .35. Sugar Rush + Firewater burns Well-Fed x3.0.
**Visible**: the HUD buff pill row (existing) gets a small stack number "x1.26" in the speed pill's tooltip/long-press; no new HUD.
**Back-compat**: `speedMult`, `jumpMult`, `miningMult`, `foodDrainMult`, `warmthDrainMult`, `regenMult` stay the public getters;
only their bodies call `combine`. Tests: `buffStack.test.ts`: each existing buff alone equals today's constant; Swift+Sugar = 1.26;
cap holds; Well-Fed burn with Sugar alone = 2.5 and the existing `sugarRush.test.ts` stays green.

**Slots.** Existing drink slots: tea, coffee. New slots: `liquor` (one of merry/hearty/firewater), `tonic` (one of hale/hardy/gleam),
`elixir` (one primal elixir). Up to five drink effects at once (tea, coffee, liquor, tonic, elixir) is deliberately possible
and the diminishing returns make stacking all of them a sensible small gain, not a runaway. Same-slot rule is unchanged (a new
one replaces, a longer one is never shortened). Drink cooldown 1 s.
**Costs and caps keep it a choice:** liquors add sway (2.4); Sugar burns Well-Fed; elixirs consume a vial and an essence; tonics
need spirit (a distillery product). `DrinkBuff` union grows by 9 keys; HUD labels from `DRINK_BUFFS` (`src/core/brewing.ts`).

## 2.3 Sugar chemistry, distillery spirits and potions (the chain)

All distillery processes are already designed in `DISTILLERY_PLAN` (fermenter + airlock at tier 1, `sugar_wash`, `low_wines`, `spirit`,
`fuel_ethanol`, maceration tincture, filter bed, vessel blend into elixir "bottled in vials", 4 per 1000 L). This section designs
the **drink items and buffs** on top; it adds no new vessel or fluid, only items and `DrinkSpec` rows. Where the distillery
builder has not landed a process, the item exists but its recipe note says "needs the distillery (stream B)": F3 may ship the
item data and buffs first and the recipes as cards when B lands (order in 5).

Chain, with player-visible steps:
1. Sugar: resin chain as in `sugar.md`. Sweeten a cup directly (F1) or ferment: **syrup/sugar + water + berries (as yeast) in the
   fermenter 120 s -> `sugar_wash`** (cloudy, then clears; the fermenter shows bubbles, sound `boil_bubble` very quiet).
2. Drinkable ferments, no still: `berry_must` -> **Berry Wine**; `grain_wash` diluted -> **Ale**. Bottled by Use of a glass vial on
   the fermenter/receiver spout (one vial = 125 mL; the unit rule of `amounts.ts`).
3. Still: `sugar_wash` -> low wines -> **Spirit**. Spirit in a vial is **Firewater**.
4. Maceration: herb + spirit, 50 C heated vessel, then the charcoal filter bed -> **tincture** in a vial.
5. Essence: a vial of an aspect in the still (existing trace rule) makes **essence** `<aspect>`; blend essence + clear tincture +
   syrup in the vessel -> **elixir** vial.

Drink table (all `ItemSpec.drink`; new `DrinkSpec` fields: `slot`, `sway?`, `burn?`). Durations default `DRINK_BUFF_S` 180:

| item | slot | effect (stat group) | s | cost |
|---|---|---|---|---|
| `berry_wine` | liquor | **Merry**: warmthDrain -0.3; +5 warmth now | 240 | sway 0.4 deg |
| `ale` | liquor | **Hearty**: foodDrain -0.2; +2 hunger now | 240 | sway 0.4 deg |
| `firewater` (spirit vial) | liquor | **Firewater**: heat/lava/fire damage x0.5; +10 warmth | 90 | sway 1.2 deg, Well-Fed burn +0.5 |
| `tonic_hale` (tea leaves + spirit) | tonic | **Hale**: regen +0.5 | 300 | none (rare ingredients) |
| `tonic_hardy` (pine resin + spirit) | tonic | **Hardy**: warmthDrain -0.3 and hostile knockback x0.5 | 300 | none |
| `tonic_gleam` (glowcap + spirit) | tonic | **Gleam**: ambient light floor +3 for you (dark caves are readable) | 240 | none; render: one uniform `playerLightFloor` (verify the light pipeline allows it; else drop) |
| `elixir_cinder` | elixir | fire/lava damage x0.4 | 150 | |
| `elixir_loam` | elixir | fall damage -2 blocks and knockback x0.5 | 150 | |
| `elixir_brook` | elixir | breath x2 underwater if the player has breath (verify; else Swim speed +0.1) | 150 | |
| `elixir_gale` | elixir | sprint food drain x0.6 and speed +0.10 | 150 | |
| `elixir_rune` | elixir | tool wear x0.7 for 150 s | 150 | |
| `elixir_rift` | elixir | mining +0.15 | 150 | |
Each elixir costs: 1 vial of that aspect (drawn by rod) + 250 L spirit-based tincture + 250 L syrup per bottled vial (the plan's 4 per
1000 L). Expensive enough that coffee remains the everyday boost and elixirs are for a project day. Quantities are copied from
the distillery plan; the builder reads `DISTILLERY_PLAN` section 12 for the exact `card()` ids.
Drinking: reuse `drink()` (same shape as `eat()`), the vessel is returned as `glass_vial`. Toast: "Firewater: fire hurts half as
much. You sway." Sound `sip` plus `drink_gulp` (new, low pitch) for liquors.

## 2.4 Alcohol's visible cost: sway

While a liquor with `sway` runs: camera yaw/pitch noise `a * sin(2 pi 0.7 t) * (0.6 + 0.4 sin(2 pi 0.23 t))` degrees, `a` = the
buff's sway; mining/placing aim is unaffected (cosmetic + slightly harder precise aiming). Cleared by respawn; **drinking any tea ends the sway** with the toast "The tea
clears your head". File: `src/game/sway.ts` (pure `swayDeg(t, amp)`), consumed by the camera in `src/player` (one line).
Phones: motion sickness is real; Settings gets a "Reduce screen sway" toggle (default on for the phone profile) that sets
amplitude to 0. Required, not optional.

## 2.5 Tea, coffee and sugar together (F1, Sweet Cup)

**Use sugar on a finished cup** (a cup in stage `done`, block `cup_tea`/`cup_coffee`): sugar grains dissolve with a small swirl
particle ring (6 particles, 0.6 s), the drink tints one shade lighter. State = the cup's `ingredient`... a `sweet: true` flag on the
`BrewCup` entity; the pickup `tea`/`coffee` item gets `meta.sweet = 1` (stack `meta` exists for vials; **verify** the stack field
name; cups hold 1 drink each so no stack-merge issue; items with different `meta` must not merge: set `stack: 1`, they already
are).
On drinking a sweet drink: duration x1.2, plus Sugar Rush 45 s (the burn applies, because sweetness is the cost). Sweet Green Tea,
Sweet Coffee are shown as "Sweet Tea" in the name via `meta` (inventory name override line). Cost: 1 sugar per cup (sugar yields 3
per 2 resin + pail, so a sweet cup is cheap but not free).
Also: **a pinch of sugar on tea/coffee in the cone** is not supported (one way to do it keeps the UI quiet).

## 2.6 Crops and creatures tied to essentia (F4)

Rule: every plant and creature has a fingerprint "growth + one flavour". They already inherit from keywords; the table below
adds explicit rows through `src/magic/aspectTableLife.ts` (owned by the FOOD builder, imported by `aspectTable.ts` in a one-line
spread). Amounts <= 4 for foods, creatures 3-5 (a creature scanned alive is worth more than its meat).

| key | fingerprint | key | fingerprint |
|---|---|---|---|
| wheat / wheat_seeds | spring 2, gale 1 | hen (creature) | spring 3, gale 1, soul 1 |
| potato | spring 2, loam 2 | goat | spring 3, ward 1, soul 1 |
| carrot | spring 2, vein 1 | boar | spring 3, rift 1, soul 1 |
| tea_leaves / dried_tea | spring 2, steam 1 | ember_core (automaton) | cinder 2, mind 1, soul 2 |
| coffee_cherries / roasted_beans | spring 2, drive 1 / cinder 1 | hearth_stew | spring 3, cinder 1 |
| berries | spring 2, glow 1 | sugar | spring 2, glow 1 (as keywords) |
| glowcap | glow 3, spring 1 | spirit (vial) | cinder 2, clarity 2 |
| pine_sap / pine_resin | spring 2, brook 1 / spring 1, ward 1 | hide, wool, feather | existing keywords |
`soul` shows only from Forge (rule L). Tests: `fingerprintLife.test.ts`: every food key, plant key, creature key and drink key has
>= 2 aspects and none is only a `CATEGORY_BASE` fingerprint (reuse the "meaningless fingerprint" threshold test from CONGRUENCE D0).

**Green Thumb (research `hedge_lore`, Ember).** A spring jar (the existing `essentia_jar` holding spring) within 4 blocks of an
**unripe** crop: that crop's growth rate x1.25 (on top of hydrated 1.0 / dry 0.5). The jar spends 1 unit per 45 s while at least
one unripe crop is in range (cap: boost applies to at most 12 crops per jar; a second jar adds another 12). Empty jar = no boost.
In-world: green motes drift from the jar to the crops it helps (<= 12 particles total per jar, 0.5 Hz bursts), the HUD target line on
the jar says "Spring jar: helping 7 crops, 12 left". No screen. Code: `cropRules.rateFor(...)` gets one optional input
`boost: number` computed in `crops.ts` by a function injected from `Game` (`CropField.setBoost(fn)`) so `src/sim` never imports `src/magic`.
Balance: x1.25 is worth ~1 min per 5; a tractor or a field of belts matters far more.

**Creatures.** Soul draw (1.2) is the only mechanical tie, plus husbandry products below. Keep animal essentia off combat.

## 2.7 Farming machines and shared rules (F5)

One set of pure functions in `src/sim/cropRules.ts` (owned by the food builder) is called by the player, the deployer, the arm
and the tractor so none can drift:

```ts
isRipe(blockKey): boolean
harvestPlan(blockKey, rng): { drops: ItemAmount[]; replantTo: string | null }  // regrow bushes -> bare; crops -> first stage if a seed is in drops
tillTarget(blockKey): string | null; plantTarget(seedKey, below: string): string | null
```
- **Workshop Deployer** (Bronze, built): holding a hoe it tills the block in front; holding seeds it plants; holding nothing it
  harvests a RIPE crop in front. One action per cycle (2 s at 16 rpm, scales with rpm; the deployer's `CYCLES` table is the
  workshop stream's). Replant takes 1 seed from the drops automatically (so wheat farms close their own loop, with a net -0 seed
  because seed drops are 1-3).
- **Field Arm** (arms exist: stream C): sweeps a 5 x 5 block of farmland around its pivot, 1 action per 1.5 s; Bronze players can
  run a belt of wheat to a quern twin to a basin. This is the Bronze farming payoff.
- **Tractor tiller/harvester** (Current, built): switch to `harvestPlan`/`tillTarget` calls so a tractor's replant matches the
  deployer; the tractor harvests 3-wide.
- **Golem carry** (1.8) moves the harvest from a crate to a crate; it never harvests.
- Soil: a crop whose farmland is removed today holds still; decision for the owner (WHATS_LEFT 6) is "it pops as the item with a
  `crop:popped` event". Recommended: pop it (drops its seed) and make all of the above call the same `cropRules.farmlandLost`.

## 2.8 Seasons and weather (cheap, optional S-tier)

Seasons from the clock only (no new world gen): `season = floor(day / 8) % 4` (8 days = 2 real hours; year = 8 hours): spring, summer,
autumn, winter. Effects are one multiplier table in `cropRules.ts`:
| season | growth (outdoors, open sky) | extras |
|---|---|---|
| spring | x1.15 | rain more likely? (no: weather system is seeded, leave) |
| summer | x1.0 | none |
| autumn | x1.0 | harvest drop bonus: 25 % chance of +1 drop |
| winter | x0.5 | crops under glass, a roof lit by a lamp, or in a greenhouse (lit rule exists) ignore the penalty |
Hint text on the Hearth Log page ("Winter: crops grow slowly in the open; glass and lamps keep them going"). Tie to magic: the
rod draws `frost` x2 in snow or winter, `gale` x2 in storms (M7), `cinder` x1.25 at noon, wellspring refill +25 % at night
(CONGRUENCE D9). Do not tint the sky by season; a sky tint is a render task for the world advisor if they want it. If time is
short, ship F4/F1/F2 first; seasons are the cut line.
Rain waters crops: `hydrated` becomes true while it rains (verify whether `cropRules` already reads weather; `weather.md` says crops feel it).

## 2.9 Cooking depth (F7): Stewpot and variety

**Stewpot** (block `stew_pot`, Ember, clay table row: 4 clay, fired): sits on a furnace top like the boil bucket (same machine
role `brew` family, same 'furnaceBelow' lookup), holds up to 4 items by Use (one at a time, each drops in with a plop), simmers
while the furnace is >= 120 C, ready 40 s after the last item. Take with Use on a bowl/empty hand: **a Stew** (one portion, stack 1;
4 portions per pot). Player sees: the pot lid, bubbles, steam from the top (reuse boil bucket steam), sound `boil_bubble`.
Rules (one table, `stewRules.ts` in `src/game`, pure):
```ts
groupsOf(item): 'grain'|'veg'|'meat'|'sweet'|'herb'|'dairy'|null
function stew(items: string[]): { hunger: number; wellFedS: number; buff?: ... } {
  const g = new Set(items.map(groupsOf).filter(Boolean));          // 1..5 distinct groups
  return { hunger: 6 + 1.5 * g.size, wellFedS: 240 + 40 * g.size,   // 3 groups = 360 = today's hearth stew
           buff: g.has('herb') ? 'hearthkept' : undefined /* 90 s */ };
}
```
So `hearth_stew` (existing, 10 uses) stays as the 3-group case; a lone potato "stew" is poor (hunger 7.5, 280 s). Salt/pepper-like
seasoning is out of scope (no salt item yet). Failing recipe: fewer than 2 items = "Add something more."
**Variety:** `eat()` keeps the last three distinct food keys (`stats.recentFoods?: string[]` in `PlayerSnapshot`, optional, max 3).
Eating the same item as the last one gives hunger x0.8 and the toast "You are tired of X"; any food not in the last 3 gives full value.
Corner cases: buff foods and drinks are exempt. Cheap, readable, no UI.
**Animal products and baked goods** (the CONGRUENCE E.3 list), each as one row in `itemsFood*.ts` + a rack/furnace/basin recipe:
| item | made from | hunger | Well-Fed s | note |
|---|---|---|---|---|
| `meat_pie` | meat + flour at the furnace 200 C | 8 | 240 | groups grain + meat |
| `jerky` | raw meat on the Drying Rack 180 s | 4 | 120 | stack 16, never "spoils" (no spoilage system) |
| `cheese` | milk + wait 600 s in a crock on the rack | 5 | 180 | **needs milk** (below) |
Husbandry (optional, F8, Bronze): `trough` block holding feed (wheat): tame hen within 3 blocks lays an `egg` every 360 s, tame goat
gives `milk` (bucket on Use) every 480 s, each product costs 1 wheat from the trough; a `spring` jar adjacent adds +20 % speed
(the same boost function as Green Thumb). Only if `egg`/`milk` items do not exist yet add them (verify) and a drop-only mob
path would do if time runs out. The brewing plan's drinks never need milk.

---

# Part 3. Feature cards (summary, one per feature, for builder briefs)

| id | feature | player does | numbers | art / animation / sound |
|---|---|---|---|---|
| M1 | Aura Dial | looks at the compass ring | 4 Hz, level/64, node tick within 48 | thin ring, aspect colour, outer pulse near node; `scan_chime` down a step |
| M2 | Late draws | rod near a creature / spire / deep dark | soul 1 per 8 s, void 0.1/s, spark from spire | violet thread from animal, black-cored vials |
| M3 | Tube ports + valve | tube touches still/kettle; place valve | 1 unit/s valve, 4/s cap, 20 s heat per cinder unit | tinted pipe mesh, inner line colour, motes |
| M4 | Staves, foci | holds the stave, long-press swaps focus | 96/4, 128/5; mend 6, reach 3, arc 8 | raised-arm 0.3 s, aspect motes, `cast` |
| M5 | Infusions per age | rod on altar | x1.5 max (x1.25 electric) | settling chord, shrinking ring |
| M6 | Research 24 -> 40 | solves boards | 16 entries | tree groups by age, `research_solve` |
| M7 | Storm spire + weather draws | places a spire (iron + vein + rune) | strike chance 1 in 4 per flash cycle (6-22 s) while storming and spire is highest block within 8; 8 spark per hit into a jar within 2 | local flash + close thunder (`thunder` at distance 12), arc into jar; gale x2 in storms, frost x2 in snow |
| G1 | Clay Walker | wakes, seals, feeds | 0.6 x 1.1; 1 Spring/30 s idle | dust puff, violet eye, thud steps |
| G2 | Seals and tasks | seal A, seal B, Use on walker | 8 items / ~6 s; treadwheel 8 rpm 4 su | box on back, arm swing |
| G3 | Spark Walker | infuses | x2 speed | blue eye, small arcs |
| F1 | Sweet Cup | sugar on cup | +20 % time, Sugar Rush 45 s | swirl ring, lighter tint |
| F2 | Stacking | nothing (visible via pill tooltip) | table in 2.2 | none |
| F3 | Liquors, tonics, elixirs | bottles at the fermenter, still, blend vessel | table 2.3 | `drink_gulp`, sway |
| F4 | Green Thumb + crop aspects | spring jar by the field | x1.25, 1 per 45 s, 12 crops | green motes |
| F5 | Field machine rules | deployer / arm / tractor | one shared function set | none |
| F6 | Seasons | reads Hearth Log | table 2.8 | none |
| F7 | Stewpot + variety | puts 2-4 foods in a pot | 6+1.5g hunger, 240+40g s | steam, plop sound |
| F8 | Trough husbandry | tames, feeds | 360/480 s | egg pop |

M7 pseudocode (spire): `onTick(dt)`: `if weather==='storm' && exposed(spire, 8) { t -= dt; if (t<=0) { t = rand(6,22); if (rng()<0.25) strike(spire) } }`;
`strike`: flash, `thunder` sfx at distance 12 (so it is loud, short, and never confused with the 60+ block strikes), push 8 spark
into jars within 2 blocks if `spark_draw` done and Current reached; else the spark is lost with a hissing sound (a lesson, no harm).
A spire never damages the player or blocks and never starts fires.

---

# Part 4. Risks and checks

| risk | why | mitigation / test |
|---|---|---|
| **Balance: stacking runaway** | tea + coffee + sugar + liquor + tonic + elixir | `combine()` caps and diminishing weights (2.2); unit test with every buff on: speed <= 1.35, foodDrain >= 0.3; playtest note. |
| **Balance: Sweet tea + Sugar Rush loops** | sugar cheap, burns Well-Fed | burn is additive and capped at x4; sugar tonics need cups; stew gives Well-Fed 360-440 s only. |
| **Magic outruns the tech** | golems, infusions, spark | G1-G4, caps in 1.7, `infusions.test.ts`, a `golemCap` test, and the solver test. |
| **Aspect fingerprint coverage** | ~60 new items/blocks across three builders | one shared test: `fingerprint.test.ts` coverage + "no key whose aspects are only `CATEGORY_BASE`" with a threshold <= 5 % of registry; each builder adds keywords/overrides in ITS file (`aspectTableLife.ts` for food, `aspectTableMagic.ts`... see 4.3). |
| **Late-aspect lore and boards** | soul/spark/void anchors need lore | Rule L + existing "boards solvable with each age's aspects" test extended with `AgeName` per entry; entries 31/37/40 need an object whose scan teaches the aspect at that age (hen/goat/boar for soul, battery/cable for spark, deep ore or `star_core` override for void; add a deep-rock keyword `deep` -> void 1 in `aspectTableMagic.ts`). |
| **Save shape** | five new optional keys | see 4.1; every key optional, missing = fresh; sanitisers drop bad entries; fixture round-trips (old save with none loads). No `SAVE_VERSION` bump. |
| **Content count tests collide** | `content.test.ts`, `food.test.ts`, `specRoster*.ts` counts are shared | each builder bumps counts ONLY through its own roster file (`specRosterMagic/Food/Golem...`); merge order M -> F -> G; on a conflict take both and re-add, never loosen a count. |
| **Age index drift after the refactor** | `ageMap.ts` had `bronze: 0` | all new gating via `ageIndexOf(name)`; builders start only after W0 and re-read `ageMap.ts` and `FurnaceTierSpec`. |
| **Golem pathing perf** | A* per walker | 400-node budget, 2 Hz, 6 ticked max, suspend beyond 64 blocks; `golem.perf.test.ts` ticks 6 walkers for 1000 frames under a time budget. |
| **Potion items need distillery recipes not landed** | stream B ordering | ship items and buffs first; recipes as cards only once B's vessels exist; solver ignores them. |
| **Sway on phones** | motion sickness | setting "Reduce screen sway" default ON for phone profile (2.4). |
| **Pointer-lock caveat** | automation cannot test real mouse | e2e uses tap/`Use` calls, as the existing magic e2e. |
| **Three sessions and `magic.ts` (1087 lines)** | conflicts | split into `magic.ts` (M track only) and `golem*.ts`, `magicFood.ts` seams (5.0). |
| **Tube bridge not a rewrite** | owner might expect one network | recorded in `docs/api/magic.md`; the pipe-net rewrite remains a documented option. |

### 4.1 Save shape (all optional)
- `PlayerSnapshot.buffs.drinks`: add the nine new `DrinkBuff` keys (record of seconds; already a `Partial<Record<..>>`).
- `PlayerSnapshot.stats.recentFoods?: string[]` (<= 3). `BuffsSnapshot.sugarS` unchanged.
- `WorldSave.golems?: [...]` (1.8). `WorldSave.magic` gains nothing; creature soul cooldowns not saved.
- `BrewCup` entity: `sweet?: boolean`. `ItemStack.meta.sweet?: 1` (check the stack meta field name).
- Seasons derive from the clock: nothing saved.
### 4.2 Sounds (SfxName additions, one seam commit): `golem_step`, `golem_work`, `golem_wake`, `drink_gulp`, `spire_strike`, `valve_click`. List them in `sfx.test.ts`.
### 4.3 Fingerprint files: `src/magic/aspectTable.ts` stays owned by the magic builder; the food builder owns `src/magic/aspectTableLife.ts` (plain object `LIFE_KEYWORDS`, `LIFE_OVERRIDES`) merged by a one-line spread in the seam commit; a golem/magic keyword set lives in `aspectTable.ts`.

---

# Part 5. Ordered task list for three parallel builder sessions

All start after the six-age refactor has landed (they need `ageMap.ts`, tier numbers, the HUD location, the `.run-lock`
convention). Each builder: reads this note, `docs/CONGRUENCE.md` 4.5 (registration checklist), commits only its own files, runs
`npx tsc --noEmit` and the narrow vitest set, then `HW_GPU=1 node scripts/e2e-<x>.mjs --no-build` under `.run-lock`.
No sub-agents (usage), trimmed output.

### 5.0 S0: the seam (MAGIC builder, first, small, ~half a session; the others wait for its commit)
Files: `src/core/gameEvents.ts` (SfxNames above, events `golem:woke`, `drink:sweet`), `src/core/types.ts` (`DrinkSpec` gains `slot?`,
`sway?`, `burn?`; `DrinkBuff` union +9), `src/save/document.ts` (the optional keys in 4.1 with defaults), `src/magic/aspectTable.ts`
(`import { LIFE_KEYWORDS, LIFE_OVERRIDES } from './aspectTableLife'`, empty file created), `src/magic/aspects.ts`/`research.ts`
(`LATE_ASPECT_AGE`, rule L), `magic.ts` (`golems: GolemHost` interface + `NullGolemHost`), `src/audio/sfx.test.ts`.
Accept: tsc clean, full vitest green, old-save fixture loads, no behaviour change.

### Track M (magic builder; files: `src/magic/*` except `golem*.ts` and `aspectTableLife.ts`, `src/render/magic/magicRenderer.ts`, `src/content/{itemsMagic,recipesMagic,specRosterMagic}.ts`, `src/ui/hud/auraDial.ts`, Codex Essentia tab, `docs/api/magic.md`, `scripts/e2e-magic.mjs`)
| id | task | depends | acceptance |
|---|---|---|---|
| M-1 | Aura dial (1.3) | S0 | `auraDial.test.ts` (3 seeds), DOM smoke test; e2e: the dial appears with the notebook held and tapping toasts |
| M-2 | Research 24 -> 40 (1.1) with gates, boards, flags, objectives lines | S0 | `research.test.ts` + `gates.test.ts` extended: 40 entries, every board `solveBoard`-solvable with its age's aspects, every gated recipe's own ingredients obtainable, game completes (`content.test.ts`) |
| M-3 | Late draws: soul, void; spark jar block | M-2 flags | `magicRuntime.test.ts`: soul draw cooldowns, void only below the depth line, spark only into a jar; rule L tested |
| M-4 | Tube ports, valve, 4/s cap, pipe-like placement | M-2 | `essentiaNet.test.ts`: valve moves 1/s, still pulls, cap holds, 20 tubes + 3 jars round-trip; e2e `tube-on-still` |
| M-5 | Staves + foci (mend, reach, arc) | M-2, M-3 (soul/spark) | table-driven test over `RODS`/`FOCI`; stave swap by long-press covered in `interaction` test; e2e: focus_mend heals 4 over 6 s |
| M-6 | Infusion table (1.6) + per-machine `infused` field hooks in workshop/lube/kettle | M-2, Bronze stream's parts | `infusions.test.ts` multiplier caps; each infusion's single hook test; e2e: altar infusion of a crank |
| M-7 | Storm spire and weather draws (2.8, M7) | M-3 | deterministic test with a seeded rng: 1000 s of storm gives a bounded number of strikes; `thunder` at 12 m |
| M-8 | Codex: Aspects page + research tree 40, `fingerprint.test.ts` coverage threshold, `docs/api/magic.md` | all above | `npm run codex` preview script passes |

### Track G (golem builder; files: `src/magic/golem*.ts`, `src/render/magic/golemRenderer.ts`, `src/content/{itemsGolem,specRosterGolem}.ts`, `scripts/e2e-golem.mjs`, `docs/api/golem.md`)
| id | task | depends | acceptance |
|---|---|---|---|
| G-1 | `GolemHost`: entity list, save/load, Spring feed, status sentence, cap and suspend | S0 (interface), M-2 entries (recipe only; gate can be tested with a synthetic state) | `golem.test.ts`: feed/tired/cap/suspend, save round-trip with damaged entry dropped |
| G-2 | Walker model, animation, sounds, wake/puff, altar wake | G-1 | texture test, renderer stats; screenshot of idle / working / tired (looked at) |
| G-3 | Tasks: crank (reuse servant path), treadwheel seat, carry between seals, A* | G-1 | `golemPath.test.ts` (obstacles, step-up, budget), `golemTasks.test.ts` (carry 8 per trip, treadwheel supplies 8 rpm / 4 su in the workshop solver, never touches a furnace); `golem.perf.test.ts` |
| G-4 | Waypoint Seal item + interaction (Use A, Use B, Use on walker) | G-1 | `interaction` test with a fake world; e2e on phone portrait: set seals by taps, walker carries wheat from crate to crate |
| G-5 | Spark Walker (infusion + x2 speed) | M-3 spark | test: x2 speed, needs 2 Spring/30 s, cap still holds |
G files avoid `magic.ts`; the hook in `Game` is the one line added in S0.

### Track F (food/brewing/farming builder; files: stream E's list in CONGRUENCE plus `src/magic/aspectTableLife.ts`, `src/game/{stewRules,sway}.ts`, `src/content/{itemsFood2,itemsBrew,itemsSugar,recipesBrew,specRosterFood,specRosterBrew}.ts`, `scripts/e2e-food.mjs`, `docs/api/{food-rules,brewing-buffs,sugar,crops}.md`)
| id | task | depends | acceptance |
|---|---|---|---|
| F-1 | Buff stat groups + slots (`combine`, 2.2), keep public getters | S0 | `buffStack.test.ts` as in 2.2; `sugarRush.test.ts` unchanged and green |
| F-2 | Crop and creature fingerprints (`aspectTableLife.ts`), `fingerprintLife.test.ts` | S0 | coverage test; boards still solvable (M-2's list may need soul anchors only from Forge) |
| F-3 | Sweet Cup (1 sugar on a cup), `BrewCup.sweet`, drink handling | F-1 | `brewing.test.ts` rows: sweet cup, Sugar Rush 45 s, +20 % time; e2e "tea with sugar" |
| F-4 | Liquor, tonic, elixir items + `DrinkSpec`s + HUD labels + sway + setting | F-1 | `food.test.ts` counts; `sway.test.ts` (amp 0 with the setting); drink() tests per slot; recipes as cards only if stream B vessels exist |
| F-5 | Shared `cropRules` functions; deployer/arm/tractor call them; replant | none | `crops.test.ts`: same harvest result from player, deployer, tractor; farmland-lost decision applied |
| F-6 | Green Thumb (`CropField.setBoost`, spring jar), needs `hedge_lore` flag | M-2 (flag only; test with synthetic state) | `crops.test.ts`: x1.25, 12-crop cap, jar drains 1 per 45 s, empty = none; e2e: jar next to wheat grows faster |
| F-7 | Stewpot + variety (`stewRules.ts`, `recentFoods`) | F-1 | rule tests (3 groups = 360 s), variety x0.8 toast, old save loads |
| F-8 | Seasons table | F-5 | `season.test.ts` (day -> season, glass exempt), Hearth Log line (cut line: drop first) |
| F-9 | Husbandry (trough, egg, milk, cheese, pie, jerky) | F-5 | items + recipes + tests; skip if time-boxed |

Ordering across tracks: S0 -> {M-1, M-2, F-1, F-2, F-5, G-1} in parallel -> {M-3, M-4, F-3, F-4, F-6, G-2, G-3} -> {M-5, M-6, M-7, F-7, F-8, G-4, G-5} -> {M-8, F-9} -> an independent review session
(per `docs/team.md`: save migration and shared sims need one) and then the stream-G playtest.
Merge order when two tracks touch counts: M, then F, then G (rebase, bump counts, re-run `npx vitest run`).
Shared-file watchlist (assign one writer at a time): `src/core/types.ts`, `src/core/gameEvents.ts`, `src/save/document.ts`,
`src/content/content.test.ts`, `src/audio/sfx.ts`: only S0 touches the first three; anyone needing more waits for S0 or appends a
line and rebases.

Owner decisions this dossier leaves open (defaults chosen, change here first): (1) tube network stays separate, bridged by ports;
(2) a crop whose farmland is removed pops; (3) seasons are in (optional, cut line); (4) Sugar+Swift now stack to 1.26 instead of
1.344 (an intended small nerf); (5) liquor sway ships with a phone-default reduce toggle.

<!-- ======================== END docs/advice/magic-and-food.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/world-progression-art.md ======================= -->
# FILE: docs/advice/world-progression-art.md

# Hearthwatt - advisor dossier: world, progression and presentation

Written 2026-11-21 by the world/progression/art ADVISOR (read-only session, branch `ccr-3c8b169f-e78nk2`, taken while the six-age refactor was running).
Builders implement this AFTER the refactor lands. It extends `docs/CONGRUENCE.md` (section 1 themes, 4.6-4.8 conventions, Stream F) and does not replace it.
Sources read: `PROGRESSION.md`, `SPEC.md` 2.6/2.7/7.2/14/15/19, `WHATS_LEFT.md`, `team.md`, `CONGRUENCE.md`, `docs/api/{world,world-features,textures,hud,audio,weather,magic,sugar,emberbound-content}.md`,
`src/content/{objectives*,loot,oreVeins,progression,automatons}.ts`, `src/render/textures/palette.ts`, `src/world/*` file list, `src/audio/*` file list.
**Not done:** the game was not run or screenshotted; nothing was built. Statements about code are from docs and file reads; anything marked **(verify)** must be checked by the builder first.

Owner decisions taken as fixed: six ages Ember / Bronze / Forge / Current / Atomic / Star ("start with a clay furnace, end with a star"); Ember is handwork only; the furnace is the heart of the base;
phone first; original names and art; in-world interaction over screens. Ages below are by name; indices are whatever the refactor's `AGE_INDEX` says (Ember 0 ... Star 5).

---

## 0. Summary for the coordinator (read this if nothing else)

1. **The world is already rich; the gaps are age-shaped.** Five biomes, Old Works ruins, wellsprings (1 in 10 chunks), oil seeps, geodes and lava falls exist. What is missing is that nothing in the world says
   *which age you are standing in*: every ruin is the same Old Works, every ore band is age-blind, loot is capped at "Forge". Fix: **one ruin family per age**, **three ore "provinces"** (not new biomes), **one new biome (mesa)**,
   and **prospect rules** (the next age's raw materials are visible at the surface within a set walk).
2. **Do not add biomes casually.** `BIOME_KEYS` order, `BIOME_PRECIPITATION`, mob habitats and ore multipliers all key on it, and any worldgen change alters unedited chunks of existing saves.
   Add exactly one biome (`mesa`, appended at index 5) and add everything else as **overlays** (provinces, structures, tree kinds). Add `genVersion` to the world snapshot (section 6, W0) so old saves keep their old terrain.
3. **One presentation law:** *the hearth ladder is the palette.* Each age owns one 5-step ramp (section 4.1), one motif voice (section 4.5) and one UI accent; everything of that age is painted from its ramp, with the shared violet shadow / warm highlight shift already in `palette.ts`.
4. **Teach without text walls:** every objective is <= 2 sentences, has a *world cue* (a pulse, a sound, a ghost) and a *hint ladder* (nothing for 5 min -> tracker nudge -> compass arrow at 10 min). Codex is a vertical tree, one age per sticky section.
5. **Pacing:** idealised 45/45/55/60/60 min (PROGRESSION) is a floor for an expert. A first-time phone player is budgeted at **x1.8** (Ember ~80 min). Sessions are 10-15 min; every age must have a *natural stopping point* ("save point" moment) at minute ~12 and ~25.
6. **Three builder lanes, disjoint files** (section 6): `W` worldgen, `O` objectives/Codex, `U` textures/audio/UI. `U0` and `W0` are the only contract steps that must land first; everything else is parallel.

---

## 1. The six ages as a lived arc

Convention for every row: **T** theme, **M** signature material, **P** palette ramp (name in section 4.1), **L** light mood, **S** sound mood.
Existing numbers (furnace temperature, minutes) come from `PROGRESSION.md`; new numbers are starting values to tune with `balance.test.ts` (task O5).

### 1.1 Ember - "the fire is a living thing you feed" (Clay Furnace, to 800 C, idealised 45 min, phone ~80)

| | |
|---|---|
| T | Everything is made by hand, stroke by stroke. You are small, the night is cold, the furnace is the only warm place. |
| M | fired clay, charcoal, copper, flint, leather, cloth |
| P | `EMBER_AGE`: fired clay `#753f2d -> #d59b75` (existing `FIRED_CLAY`), soot `#0e0c10`, flame `EMBER` ramp |
| L | Low sun-gold days; blue-violet nights lit only by the furnace and torches. Block light tint warm `#ffb060`. Furnace glow is the brightest thing for 100 blocks. |
| S | crackle, wind in leaves, crickets, stone-on-stone strokes, clay slap, kettle hiss; sparse: silence is allowed |

**World features.** Woodland spawn with wild wheat within 44, an Old Works within 30-78 (exists). Marsh (peat, wild tea, clay; never within 150 of spawn) is the Ember side-quest biome. Resource placement:

| Resource | Where | Existing rule | Prospect rule (new) |
|---|---|---|---|
| logs, flint, rubble, clay, gravel, water | spawn radius 48 | `SPAWN_RESOURCE_RADIUS` | keep |
| copper ore | y 16-60, outcrops on cliffs, dunes x2 | `oreVeins.ts` | an outcrop within **120 blocks** of spawn (test) |
| tin ore | y 30-66, 2.5 x 5 | `oreVeins.ts` | an outcrop within **160 blocks**; tin is the "go on a walk" moment of Ember |
| coal / peat / charcoal | peat in marsh; charcoal from logs | exists | charcoal needs no walk; peat is a bonus |
| tea bushes / coffee shrubs | woodland edge (tea), dunes edge (coffee) | planned (BREWING_PLAN) | tea within 200, coffee within 300 |

**Dangers.** Cold nights (warmth drain; the furnace warm zone and torches are safe). Cinder Mites in the dark (light level <= 7, 24-40 blocks away). Forge Wardens and Kiln Sentries guard Old Works ruins (1-2 wardens, `RUIN_WARDENS`).
Rule kept: **every Ember hazard has a hand-made answer** (torch, furnace zone, flint maul).

**Signature moments (scripted by sfx + objective, never a cutscene):**
1. *First fire* - the clay furnace lights at dusk; a warm light disc pushes the dark back, the Cinder Mites stop at its rim, a low "hearth" chord plays once (motif note 1, section 4.5).
2. *First pour* - the crucible tilts, molten copper runs into the fired mould, the mould glows `EMBER[4]` then dims over 6 s; the pour sound is the only loud thing on the map.
3. *First cup* - a boiling pail, cup and cone; steam curls up; a green/brown buff pill slides into the HUD with its glyph (section 4.3).

**Objective chain** (existing ids kept; `E` = existing, `N` = new): gather_logs (E) -> place_chopping_block (E) -> make_planks (E) -> place_workbench (E) -> find_flint (E) -> flint_pickaxe (E) -> rubble 12 / clay 6 (E) -> place_furnace_clay (E) ->
furnace_lit (E) -> charcoal (E) -> well_warmed (E) -> cook a meal (E) -> clay table, fire a mould (E) -> smelt copper, **first pour** (E) -> hand quern, grind flour (E) -> till, plant wheat (E) -> stone anvil, hammer plate (E) ->
reach 800 C (E) -> alloy bronze, cast a pickaxe head (E) -> bronze pickaxe (E) -> forge a maul (E) -> salvage an automaton (E) -> bake bread (E) -> boil a bucket, brew a cup (E) -> **N: `visit_old_works`** (flag `ruin_entered_old_works`, see lore, section 2.5) ->
**N: `fill_upgrade_list`** (furnace upgrade list: 8 bronze ingots, 4 firebricks, 1 bellows, 2 bronze plates, 1 leather at 700 C -> condition `furnaceTier 1`). `six_cups` stays optional (side goal in the Field Journal, WHATS_LEFT 0.3).
World cue per goal: the next resource gets a faint motes column visible to 24 blocks *only after the 10-minute hint rung* (section 3.3).

### 1.2 Bronze - "heat learns to move" (Bronze Furnace to 1100 C, idealised 45 min, phone ~80)

| | |
|---|---|
| T | The fire's work travels: water, steam and turning shafts carry it across the yard. The first machines are wooden, noisy and a little alive. |
| M | bronze, oak axles, leather belts, brass-warm glass, pine resin |
| P | `BRONZE_AGE`: bronze `#4a3418 #7a5a22 #a8802f #cfa84a #eed582`, verdigris `#1f4a43 #2f6f62 #4f9a85 #7bbfa5 #b4e0c8` |
| L | Amber-green: block light `#ffc870` near steam (steam scatters a faint pale `#e6ecf0` haze at 2-3 blocks); mornings fog slightly; the boiler's gauge glass is a small warm window at night. |
| S | cog ticks (pitch follows rpm), chuff, belt hum, valve whistle, water wheel splash, a **bell** when something seizes |

**World features.**
- **New biome `mesa` (clay flats):** dry, banded strata (red-ochre `#a8603c`, buff `#cba960`, grey), flat-topped buttes 6-14 high, sparse scrub, clay seams at the surface, copper x1.5 and tin x1.5, **no** marsh water. Rain falls normally. Hostile spawn places: `surface`, `cave`. Placement: dry land between woodland and dunes (appended noise field; never within 220 blocks of spawn; ~12% of temperate land).
- **Pitch pine stands:** `PITCH_PINE` tree kind (`PINE_TALL` shape, amber-streaked bark `pitch_pine_log`, leaves unchanged) in groves of 5-9 at cold/high woodland edges and frostfell margins. Tapping gives `pine_sap` at x2 and sap flows 1.5x in sun (sugar chain, `docs/api/sugar.md`).
  Prospect rule: a stand within **140 blocks** of spawn. Resin is *the* Bronze glue: belts, valve seals, kettle gaskets use `pine_resin` (proposal, coordinate with Stream A).
- **Streams for water wheels:** worldgen guarantees one flowing-water cell (a stream of source blocks dropping >= 2 blocks) within 180 blocks of spawn (rivers/cliffs exist; add a rule + test, not new terrain).
- **Gearhouse ruin** (Bronze ruin family, section 2.2).
- **Seep Mounds** (section 2.3) in dunes and the marsh fringe: crude oil for the distillery/lubricant (belts and gearboxes jam without it; `lubricant` exists in the workshop).

**Dangers.** Scald and burst (visible, telegraphed: the boiler's gauge needle and a 5 s warning), Bellows Hounds at night (dash attack; they drop leather for belts, CONGRUENCE F5), seized shafts (bell rings, nothing explodes).

**Signature moments:**
1. *The first shaft turns* - goggles read "16 rpm, load 6/24 su"; cog tick starts; every wooden part visibly rotates; the cogs' pitch rises with rpm.
2. *The valve sings* - pressure crosses the set point, the whistle blows, a white steam plume rises 3 blocks; the boiler does not burst. The player *hears* the rescue.
3. *The chute inhales* - the first Vacuum Pump pulls a stack of items along a Bronze Chute in one visible whoosh (items drawn as a stream of dots), lands in a crate with a "tock".

**Objective chain** (`N` unless stated; ids final): place_bronze_furnace -> boil_water (kettle) -> place_hand_crank (E, workshop) -> shaft_turns (flag from sim: `rpm >= 16`, see 6.O1 flags table) -> place_mech_millstone (E) -> make_bronze_cog (E) -> place_ratio_dial (E) -> saw_planks (saw bench) ->
shaft_bellows -> move_heat (thermocouple heats a hot plate) -> build_boiler (ghost-planner multiblock) -> raise_steam (>= 1 bar) -> fit_safety_valve -> piston_power (steam engine 16 rpm / bar) -> compress_air (>= 2 bar in tank) -> pneumatic_post (vacuum chute delivers) -> press_plates -> forge_blast_nozzle -> **gate:** Blast hearth forms.
Existing workshop goals (mixer, arm, saw arm, vault, lever, bell, piston) become *optional side goals* (Field Journal) except `place_bell`, which is a required step after `fit_safety_valve` (teaches the seize alert). `six_cups` and distill/sugar goals are side goals.

### 1.3 Forge - "the furnace gets a blast and iron becomes steel" (Blast hearth to 1500 C, idealised 55 min, phone ~100)

| | |
|---|---|
| T | Machines get heavy. You build around a roaring hearth and the ground starts to look like a place that was industrial once. |
| M | iron, steel, coke, refractory brick, slag |
| P | `FORGE_AGE`: slate `#2a3038 #3f4852 #5a6672 #7a8794 #a9b6c2`, white-hot highlight `EMBER[4]` |
| L | Hard, high-contrast: black shadows, white-orange blast light `#ffd0a0`; the hearth lights its own courtyard like a stage. Dust haze (render-only) on windy days. |
| S | trip-hammer thud (on the beat of the shaft), blast roar (rises with air bar), rolling-mill grind, anvil ring, deep tank hum |

**World features.**
- **Coal Ridge province** (section 2.1): hills with exposed coal seams, iron outcrops on the cliff faces, limestone terraces; carries x2 coal/iron/limestone, not a biome. Prospect rule: coal AND iron outcrops within **220 blocks** of spawn.
- **Blast Row ruin** (section 2.2): collapsed hearth stacks, slag heaps, a rusted rolling mill. Guards: Forge Wardens (2) + a Kiln Sentry on the chimney.
- **Lava with the bronze bucket** (exists), **oil shale** (exists).

**Dangers.** Heat burns when touched (thermocouples glow by temperature), lava, wardens at Blast Row, 16-bar steel boilers if over-pressured. Emberbound ruins here are the toughest non-boss encounters before Atomic.

**Signature moments:**
1. *The blast* - air through the nozzle, the hearth mouth flares white, a flare of sparks, first iron runs; screen-edge warm vignette for 1 s.
2. *First steel bar* - a glowing bar goes through the rolling mill with a rising grind, comes out flat; the sound lands on the shaft's beat.
3. *The dynamo's first spark* (end of the age) - a copper cable lights a lamp *at dusk*; the lamp is the only electric light for 100 blocks, and the hearth "hands the night to it".

**Objective chain:** place_blast_nozzle (gate step from Bronze) -> blast_hearth_formed -> smelt_iron -> make_steel_ingot -> place_rolling_mill -> iron_axle -> forge_iron_thermocouple -> place_dynamo -> generate 100 W -> place_lamp ->
place_crusher -> machine_job -> generate 2 kW -> store 1 MJ -> **gate:** Arc Electrode in the roof, grid can feed 8 kW. (Existing `thermopile` goal moves from Forge to **Bronze** side goals: the thermopile is a heat -> watts device and ruin loot; decide with Stream A.)

### 1.4 Current - "invisible power in copper veins" (Arc hearth to 2100 C, idealised 60 min, phone ~110)

| | |
|---|---|
| T | Light and signal everywhere. The base stops being a place you light and becomes a place that is lit. |
| M | copper cable, silicon, glass, aluminium, quartz |
| P | `CURRENT_AGE`: `ARC_GLOW` + `ARC_STEEL` (existing), lamp warm `#ffd95a`, cyan accent `#8fd8ff` |
| L | Clean cyan-white by day-night contrast: lamps are `#ffd95a`, arcs `#a9d8ff`; wet surfaces glossy in rain; storms flash (<= 3 flashes/s). Night bases look like constellations. |
| S | mains hum (pitch = load), relay clicks, turbine whine, arc crackle, solar "tink" at dawn, thunder |

**World features.** **Quartz Flats province** (dunes/mesa margins; quartz, bauxite, spodumene x2, glass-glinting crystal geodes at the surface); wolframite deep in frostfell (exists x2). **Relay Hall ruin** (section 2.2). Storms boost wind and bring Arc Drones (exists): storms are the age's weather identity - **forecast line** ("A storm is coming") becomes a goal hint ("Turbines love storms").
Prospect rule: quartz outcrop within **320 blocks**; bauxite within 400; wolframite is a deliberate *expedition* (frostfell, y 3-20, **not** required to be on the surface).

**Dangers.** Arc Drones in storms/new moon (zap x wetMult in water: "stay out of the pond"), brown-outs (power strip warning), electric shock at damaged cables is NOT added (keep survival simple). Fire safety: none new.

**Signature moments:**
1. *The arc strikes* - electrodes in the hearth roof light, cyan flash, the hearth turns from orange to blue-white; the colour change on the furnace mouth is the age change.
2. *Lights out, lights on* - at dusk the player throws one switch and a line of lamps ripples on at 0.1 s spacing along the cable (ripple travels the actual graph, deterministic).
3. *Storm harvest* - first storm with turbines: blades spin up, power strip peaks, the thunder is *good news*.

**Objective chain:** place_arc_electrode -> arc_hearth_formed -> pump_water -> reach_1900C -> make_circuit x2 -> generate 10 kW -> ward_beacon -> make_tungsten_rod x4 -> **gate:** plasma casing shell, two power ports, 40 kW.

### 1.5 Atomic - "quiet danger and control" (Plasma hearth to 3200 C, idealised 60 min, phone ~110)

| | |
|---|---|
| T | Cool water around a hot heart. The game gets calmer and more careful, not louder. |
| M | superalloy, fused quartz, heavy water, graphite |
| P | `ATOMIC_AGE`: reactor `#0d2a2a #14524a #2a8f7c #5cf0c0 #c8fff0` over graphite `#16151a`; `STAR_ALLOY` for casings |
| L | Cold: block light shifts to the cool share (exists: `LIGHT_COOL_SHIFT`) - green-blue `#5cf0c0` from fission things, violet from plasma. Fog 8% cooler near the pile. Nights are darker (no warm emitters). |
| S | Geiger-soft ticks (rate = pile output), coolant flow, low drone (A1), a single calm rising chord at criticality. No alarms unless a cell is truly lost. |

**World features.** **Deepworks province** (below sea - 8; deep ruin tier, pitchblende x3 in the scar already): ruined concrete vaults and flooded galleries reached by caves; 6-10 blocks of lit corridors (glowcap + dim reactor-teal). **Pile Vault ruin** (section 2.2). **Slag Colossus** in the deep (exists, `maxLoaded: 1`).
Prospect rule: none above ground; a **marked cave mouth** (steam vent + basalt columns, `scar`) within 500 blocks guides down; the Field Journal reveals "Pile Vault" when the player holds a pitchblende chunk (compass arrow).

**Dangers.** Slag Colossus (boss, slam), flooded galleries (air meter), heat at the pile (shield suit). Calm failure language: "Coolant low" with the water-level window, not siren spam.

**Signature moments:**
1. *The pile goes critical* - a calm rising hum, faint blue glow in the water, Geiger ticks accelerate to a steady tick, and **nothing else happens**. The restraint is the point.
2. *Heavy water* - the first electrolyzer bubbles deuterium; a cell glows `#5cf0c0` in the hand.
3. *Down the Deepworks* - crossing the threshold into a vault: sound dims to a drone, then the colossus's step is heard 20 s before it is seen.

**Objective chain:** plasma_hearth_formed -> superalloy x8 -> place_fission_pile -> generate 60 kW -> make_deuterium_cell x8 -> make_star_core -> **gate:** star casing shell (93 casings or fewer: X7), four power ports, star core, 8 cells.
Owner decision pending (WHATS_LEFT 0.3): **recommend reducing to 61 casings** (a 5x5x5 shell minus corners and bevels) - 93 blocks of superalloy on a phone is a chore, not a climax; if kept, add a *ghost planner with counts* (already planned).

### 1.6 Star - "the base finally burns like a small sun" (Starhearth, idealised 5-10 min of holding plus build)

| | |
|---|---|
| T | A deliberate finale, not an age of new systems: assemble, hold 300 kW for 90 s, and then everything is warm and quiet. |
| M | star core, plasma-white metal |
| P | `STAR_AGE`: `STARFIRE` + `GOLD` (existing), white `#fff2b0` |
| L | Gold-white. During the hold the sky above the base tints 8% gold and the horizon glows; after ignition the base is "forever warm" (permanent faint gold ambient inside 48 blocks, no gameplay change beyond recipes at any heat and 1 MW). |
| S | one rising harmonic chord built from all five previous motif voices (section 4.5), then **calm** (wind and crickets return, no music) |

**World features.** A **Starhearth Ring** ruin (section 2.2) 400-700 blocks from spawn that the player may visit *before* building: the ring is dark, a plaque slate says what it needs ("Hold 300 kW for 90 s"). Seeing it early makes the ending visible all game (a distant faint gold glint at night beyond 200 blocks, render-only).
**Signature moments:** (1) the ring plaque at first visit; (2) the 90-second hold - a countdown ring around the hearth, power strip pinned, if power dips the chime softens and the ring cools, no fail state; (3) ignition - sky tint, chord, `ignited` flag, afterglow.
**Objectives:** star_casing_shell -> place_star_core -> star_hearth_fed (300 kW line) -> hold_90s -> `ignited`. After ignition: the Field Journal shows completion %, the world continues.

---

## 2. World depth

### 2.1 Provinces (overlays, not biomes) and the one new biome

A **province** is a low-frequency noise (appended field in `Terrain`, own seed salt, scale ~192 blocks, threshold chosen so each province covers ~15% of land) that multiplies ore weights and re-skins surface rock. It never changes `BiomeKey`.

| Name | Age | Where | Surface | Ore multipliers (on top of biome) | Extra |
|---|---|---|---|---|---|
| Coal Ridge | Forge | any land biome except marsh/frostfell summit | coal seams in cliff faces (every 8th terrace cell), limestone terraces | coal x2, iron x1.5, limestone x1.5, sulfur x1.2 | 1 ruin `blast_row` per 11x11 chunks inside |
| Quartz Flats | Current | dunes, mesa, plains | glinting `quartz` crystals; `crystal_cluster` outcrops 1 in 24 surface cells | quartz x2, bauxite x1.5, spodumene x1.3 | glassy wind sound layer (high, thin) |
| Deepworks | Atomic | below y 10 anywhere with caves | vault corridors (section 2.2) | pitchblende x2 below y 14 | `RUIN_DEEP_BELOW_SEA` unchanged |
| Mesa (BIOME) | Bronze | dry temperate | banded strata, buttes, clay seams | copper x1.5, tin x1.5, clay surface | precipitation rain; weather identical to woodland |

New block keys these need (all mapped to texture names in 2.9): `ochre_rock`, `ochre_sand`, `mesa_clay`.
Spawn rule remains: *the world always starts in woodland*; provinces and mesa never within 150 blocks of spawn (mesa 220).

### 2.2 Ruin families (one per age, same generator skeleton)

Reuse `squareRuin` / `drawRuin` / `ruinLootTier`; each family is a `RuinStyle` with a footprint, wall materials, a "centrepiece" and a loot table whose **max age = its age** (the existing content test "never anything past the Forge Age" becomes "never past the ruin's own age + 0").

| Family (age) | Footprint | Centrepiece | Walls | Guards | Loot table (key items; counts) | Frequency |
|---|---|---|---|---|---|---|
| Old Works (Ember, exists) | 5x5-7x7 | collapsed furnace | stone brick, cracked, mossy | 1-2 Forge Wardens or Kiln Sentry | `near`/`deep` unchanged | 1 per 7x7 chunks, ~65% (exists) |
| Gearhouse (Bronze) | 9x7, by water if possible | dry wheel frame + 3 `rusted_gearbox` + a broken shaft run | oak frame + brick | 2 Bellows Hounds (night) + 1 Warden | `gear`: bronze_cog 2-5, bronze_plate 1-3, leather 2-4, pine_resin 2-4, copper_ingot 2-4, kettle 1 (weight 2), goggles 1 (weight 2) | 1 per 9x9 chunks, guaranteed one within 220 |
| Blast Row (Forge) | 15x9 on Coal Ridge | 3 collapsed hearth stacks + slag heaps + rusted rolling mill | slate brick, `slag_brick` | 2 Wardens + Kiln Sentry on chimney | `row`: iron_ingot 3-6, coal 6-12, steel_ingot 1-3 (weight 3), firebrick 4-8, iron_axle 1-2, dynamo_coil 1 (weight 2) | 1 per 11x11 chunks inside the province |
| Relay Hall (Current) | 11x11 | glass dome, 4 pylons, dead lamps on an intact cable | pale concrete | 2 Arc Drones only in storm/new moon, else none | `relay`: copper_cable 6-12, lamp 2-4, circuit 1-2 (weight 3), glass 6-10, silicon 2-4 | 1 per 13x13 chunks in Quartz Flats |
| Pile Vault (Atomic) | 17x11, sunk 6 | cold pile shell, coolant hall, flooded lower level | concrete + `graphite_block` | Slag Colossus nearby (maxLoaded 1) | `vault`: superalloy_ingot 1-3, fused_quartz 2-4, heavy_water 1-2 (weight 2), graphite 4-8 | 1 per 15x15 chunks below y 10 |
| Starhearth Ring (Star) | 25 diameter | dark ring, plaque slate | `star_alloy` ribbed | none (silence) | **no loot**; slate only | exactly one per world within 400-700 of spawn |

All tables obey: no item of a later age than the ruin; no machine that skips its age's gate (e.g. `relay` gives circuits but never a fission part). Deep variant (distance > 400 or below sea - 8): +50% rolls, one extra weight-3 entry of the same age. Crates, guard placement and persistence use existing mechanics (`ruinCrates.ts`, `ruinGuards.ts`).

### 2.3 Systems-fed world structures

| Structure | Feeds | Numbers | Where | How the player reads it from afar |
|---|---|---|---|---|
| **Pitch Pine Stand** | sugar chain, belts/seals (resin) | 5-9 trees, 1 per ~14x14 cells at cold edges, ~2% of pine cells convert | woodland high ground, frostfell margin | amber-tinted canopy streaks, amber particle drips at dawn |
| **Seep Mound** | distillery crude oil, lubricant, bitumen (verify `bitumen` key in `itemsDistill.ts`) | 3x3 oil pool + 2-block crusted mound (`bitumen_crust` drops 1-2 bitumen); refill 1 bucket / 3 min | dunes, scar (exist as oil bowls), marsh fringe | black-gloss pool, heat-shimmer, faint tar smell = low rumble layer |
| **Spring Stones (aura sites)** | essentia / magic (`aura_reading`, `node_tap`) | a ring of 5-7 `standing_stone` (3-4 high) around ~40% of wellsprings, radius 5; wellsprings already 1 in 10 chunks | woodland, frostfell, marsh | slow violet motes (`#a77fe0`) rising 6 blocks, visible from 48; rod reading "bright" inside; land-aura regen x2 in the ring |
| **Waymarks (ley-like lines)** | exploration; leads to far ruins | cairns every 12 blocks, 3-9 per line, between an Old Works and a later-age ruin; point to the *next* ruin family | between ruins | a stacked-stone cairn with a lit slit; compass-style notch toward the target ruin |
| **Slate Cairns (lore)** | notebook `lore` (ResearchState already has it) | 12 lore slates in total (2.5) | inside ruins and at waymark ends | a single standing slab with etched lines |
| **Barter Cairn (trade)** | exploration reward, no UI | drop 4 of any one food (or 1 ingot) on the cairn top; 10 s later a counter-gift appears on the far side | at waymark crossings (rare, ~1 per 6 lines) | a cairn topped with a flat stone and a hollow bowl |
| **Workshop ruin pieces** | workshop/steam | rusted shaft lines (decor `rusted_shaft`) that *line up with real shaft rules* so a player can restore one: replacing missing cogs wakes it (an optional "restore the mill" mini-objective: gives a free working water wheel) | Gearhouse | cogs visible as silhouettes; a missing piece is an obvious gap |

### 2.4 Exploration reward ladder (distance from spawn, never skipping the gate)

| Ring | Distance | Reward class | Example |
|---|---|---|---|
| 0 | 0-96 | bootstrap | Old Works, wheat, first ore outcrops |
| 1 | 96-220 | age material, one-off | Gearhouse loot, pitch stand, stream, mesa clay |
| 2 | 220-400 | age *convenience* | goggles, a Barter Cairn gift (seed packs, a cup, a blueprint slate), Coal Ridge |
| 3 | 400-700 | relic (cosmetic or comfort, never a skip) | Starhearth Ring plaque, a "Hearthkeeper's lantern" (lamp that needs no fuel but is dim), a clay figure |
| Deep | y <= sea - 8 | next-age *sample* (1 piece, not enough to build) | one superalloy ingot in a Pile Vault |

**Field Journal** (Codex page `Places`, in-game notebook tab): 10 discoveries (Old Works, Gearhouse, Blast Row, Relay Hall, Pile Vault, Starhearth Ring, Pitch Stand, Seep Mound, Spring Stones, Barter Cairn). Each entry is a 2-line text + a small painted glyph; completing 5 unlocks "Wayfinder's compass" (compass can point at the nearest *known type*). No XP, no points.

### 2.5 Lore (12 slates, <= 140 characters each, original)

Story: the Hearthkeepers lit each hearth in turn and taught their automatons to guard the fire; the Starhearth was lit once, held, then they went quiet and the guards kept watch.
Ember (3): "We banked the first fire in clay. It did not go out for nine winters." / "The guards were built to keep the cold from the fire. They are still keeping it." / "Copper first, then tin. Bronze remembers what each forgets."
Bronze (3): "Water turns the wheel; the wheel turns the stone. Do not ask it to do more." / "Bell on every shaft. A silent machine is a dying machine." / "The valve sings so you need not."
Forge (2): "Iron wants air. Give it a blast and it will give you a blade." / "Heavy things need a patient hand."
Current (2): "Copper veins under the floor, light in every window." / "Storms are a gift. Hold the sky by the wire."
Atomic (1): "Cool water around a hot heart. That is all the secret there is."
Star (1): "Three hundred for ninety. Then rest."

Rule: a slate adds a `lore` entry to the notebook (existing `ResearchState.lore`), plays `slate_read` (soft chime) and shows one toast with the line. Nobody is made to read it.

### 2.6 Balance curve (time-to-next-age)

| Age | Idealised (PROGRESSION) | First-time phone (x1.8) | Objectives (required) | Main time sinks (idealised) | Walk budget to resources | Natural stops |
|---|---|---|---|---|---|---|
| Ember | 45 min | ~80 | 31 (+ visit ruin, fill upgrade list) | wood 6, clay/furnace 6, copper+tin 10, casting 8, farm/food 8, bronze 7 | <= 160 blocks one way | after first fire (~min 12); after bronze pickaxe (~min 55) |
| Bronze | 45 | ~80 | ~18 | boiler build 10, steam/pressure tuning 8, air + pump 8, workshop 12 | <= 220 (pitch stand, stream) | after shaft turns (~min 12); after safety valve (~min 30) |
| Forge | 55 | ~100 | ~14 | iron + coal mining 15, blast hearth 8, rolling/steel 10, dynamo 8 | <= 260 (Coal Ridge) | after the blast (~min 15) |
| Current | 60 | ~110 | ~12 | cable runs 12, arc hearth 10, circuits 10, storm wait 8 | <= 340 | after arc strike (~min 15) |
| Atomic | 60 | ~110 | ~9 | superalloy 15, pile build 12, deep trip 10 | <= 520 | after criticality (~min 25) |
| Star | 10-15 | ~20 | 4 | casings, hold | ring visit | ignition |

Tuning knobs: furnace speed multiplier, ore vein frequency (prospect rules in tests), stress capacity numbers (Stream A), crate loot rolls. **Acceptance for balance:** `balance.test.ts` (O5) prints idealised time-to-gate per age under a cost model (gather seconds per item from tool tier, craft time from recipe, build time from block count x 2.5 s, walk at 4.3 blocks/s with the prospect distances above) and asserts each age within **+-15%** of table; a failing age fails CI.

---

## 3. Teaching without text walls

### 3.1 Rules for objectives
- Title <= 4 words, text <= 2 sentences, units on every number. No objective introduces more than **one** new verb.
- Each has a **world cue** (table 3.2) and an `opt` flag for side goals. Tracker shows the first incomplete *required* goal whose `requires` are met (prevents "place a boiler" before a kettle).
- Conditions beyond today's types (`rpm`, `fluid`, `aspect`, `research`, `pressure`) are produced by owning systems as **flags** (builders of O must not edit sim). Flag names (owners in brackets): `shaft_turns` [A], `steam_raised` [A], `valve_set` [A], `air_tank_2bar` [A], `vacuum_delivered` [A], `ruin_entered_old_works/gearhouse/blast_row/relay_hall/pile_vault/ring` [W], `lore_read_n` [D/W], `scanned_first` [D], `essentia_drawn` [D].

### 3.2 World cues (one per required goal; none is text)

| Goal type | Cue | Rule |
|---|---|---|
| "place X" | a faint ghost silhouette of X at the target cell *only while X is in hand and the goal is active* (placement preview exists) | disappears when placed |
| "reach temperature" | furnace glow ramps; thermometer segment pulses at the target | once per 30 s |
| "find resource" | after hint rung 2: faint motes column over the nearest unmined outcrop within 120 blocks, 24-block draw distance | cap 1 column |
| "visit ruin" | waymark cairn nearest the player glows; distant ruin chimney smoke | |
| "machine runs" | goggles auto-open the status sentence for 6 s when the player stands within 3 blocks of the target machine | |

### 3.3 Hint ladder (`coach.ts`, owner O)

| Rung | Time on goal | What happens |
|---|---|---|
| 0 | 0-5 min | nothing (the goal text is enough) |
| 1 | 5 min | tracker pulses once; one-line nudge in the existing hint style: "Try the marsh for peat." (from a per-goal table, <= 60 chars) |
| 2 | 10 min | compass arrow switches target to the needed resource (`Compass` already shows bearing + distance); motes column appears |
| 3 | 20 min | the Codex entry for the goal's item opens as a bottom sheet with "Show me" (pins the compass) |
All rungs reset on goal completion; any rung is suppressed on Peaceful play for goals completed by `FLAG_PEACEFUL`.

### 3.4 Codex tree (phone-first)
- **Layout:** a vertical scroll. One sticky age header per section (age name, hearth silhouette in the age ramp, "min 0:00-0:45" optional). Nodes are **48 px** icon chips on a 3-column grid; the spine is a vertical line in the heat colour with branch lines in system colours.
- **Node states:** done (filled, age ramp), available (outlined, soft pulse 2 s), locked (grey + lock glyph, tap shows "needs X"), planned (dotted).
- **Branch colours** (always with a glyph so colour is never the only signal): heat `#e8622a` flame, motion `#b89a4a` cog, fluid `#3a86b4` drop, power `#8fd8ff` bolt, magic `#a77fe0` rune, food `#5cc060` leaf, distill `#e2bc3a` flask.
- **Tap a node:** bottom sheet, 2 sentences + the status sentence example + "Pin" (sets the compass/goal). **Long-press:** the item's recipe tree.
- **Mockup (portrait, 390 px):**
```
 EMBER  ●━━━━━━━━━━━━●        <- sticky age bar (hearth glyph, accent underline)
  ┃  [flame][clay][pick]      <- spine nodes row 1
  ┃     ╲      ┃
  ┣━ [cup]━[tea]━[dry]         <- food branch (green) hangs off spine
  ┃
 BRONZE ●━━━━━━━━━━━━●
  ┃  [kettle][shaft][quern]
  ┣━ [boiler][valve][chute]
  ┗━ [lubricant]... (planned: dotted)
```
- Build: `scripts/codex/*` (owner O) reads the same `OBJECTIVES` index and `progression.ts`; Codex build must print zero warnings and every *required* objective appears exactly once.

---

## 4. Presentation congruence (one art direction)

### 4.1 Palette ramps per age (extends `palette.ts`; add `src/render/textures/agePalette.ts`)
Each ramp runs shadow -> highlight (5 steps), obeys the existing hue shift (shadows toward `#1c1630`, highlights toward `#fff4d8`).

| Age | Ramp name | Steps (dark -> light) | Where it appears (rule) | Accent |
|---|---|---|---|---|
| Ember | `FIRED_CLAY` (exists), `EMBER` (exists) | `#753f2d #915238 #ab6846 #c0805a #d59b75` | clay furnace, mould, cups, pots, leather, hand-station wood | ember orange `#e8622a` |
| Bronze | `BRONZE` (new) | `#4a3418 #7a5a22 #a8802f #cfa84a #eed582` | bronze plate, cogs, pipes, kettle, gauges | verdigris `#4f9a85` edges and wear |
| Bronze | `VERDIGRIS` (new) | `#1f4a43 #2f6f62 #4f9a85 #7bbfa5 #b4e0c8` | patina on old bronze, brass-warm glass trim, ruin metal | |
| Forge | `BLAST_SLATE` (new) | `#2a3038 #3f4852 #5a6672 #7a8794 #a9b6c2` | iron, steel (lighter), hearth shell, rolling mill | white-hot `#ffe27e` |
| Current | `ARC_STEEL` + `ARC_GLOW` (exist) | `#1b202c ... #66778c`; `#1c3f9e ... #fff` | machine casings, cables, lamps, glass | lamp `#ffd95a`, cyan `#8fd8ff` pip |
| Atomic | `REACTOR` (new) | `#0d2a2a #14524a #2a8f7c #5cf0c0 #c8fff0` | pile, coolant, shield suit trim | graphite `#16151a` |
| Star | `STARFIRE` + `GOLD` (exist) | `#7a4a10 ... #fff` | Starhearth, ring, afterglow | white `#fff2b0` |

**Rule of three:** any one texture uses at most 3 ramps (base material + one age accent + one state colour). Natural materials (stone, wood, leaves, sand) never use age ramps. **Aspect colours are untouched** (`AspectInfo.color`).

### 4.2 Texture and icon rules
- 16x16, nearest-neighbour, five-step ramps, 1 px darker outline on every item icon, light from top-left, deterministic painters (existing test regime).
- **Silhouette per category** (existing: ingots trapezoid, plates lozenge, crushed pile, powder mound, rod diagonal): add **gear** (circle + 6 teeth, always 12 px wide), **pipe segment** (two flanges), **jar** (round belly + cork), **slate** (rounded rectangle with 3 lines), **cell** (capsule). New categories added only here.
- **Age notch:** machine *casings* have a 2x2 px corner rivet in the age's accent (clay-orange, bronze, white-hot, cyan, reactor-teal, gold), so a machine's era reads at a glance without a legend. (Existing power pip stays bottom-right.)
- **Wear:** ruin versions of blocks are the same texture with `VERDIGRIS` or rust streaks + 2 missing pixels per row (never a new silhouette).
- **Readability test** (extend `readability.test.ts`): every interactive block face has luminance contrast >= 1.6:1 (L* difference >= 18) against the *three* most common neighbour terrains' average colours; failures listed with names. Ores: fleck colour distinct from the host by >= 22 L* or hue distance >= 40 degrees.
- **Glass** keeps the shared blue-white transparency; fluids keep `FluidSpec.colour`.

### 4.3 UI chrome and HUD for buffs, essentia, stress

**Chrome.** The existing UI kit stays; add an **age accent token** `--hw-age` (set on `:root` from the player's current age) used for: window title underline, Codex age header, goal tracker bar, furnace screen's hearth ladder strip. Surfaces never change colour; only accents.
**Furnace screen:** the **hearth ladder strip** on top: six small furnace silhouettes in the age ramps, the current one lit, the next one outlined; below it the upgrade list with progress bars. (The list must fit 390 px without scrolling for Ember's 5 items.)

**Status pills row** (HUD, under vitals; max 4 visible, then a `+N` chip that opens a bottom sheet):

| Pill | Size | Colour | Glyph | Text |
|---|---|---|---|---|
| Warmth (Well-Warmed) | 28 px high | amber `#e8a23a` | flame | m:ss |
| Tea buff | 28 | green `#5cc060` | leaf + drink icon | m:ss |
| Coffee buff | 28 | brown `#8a6a3c` | bean | m:ss |
| Essentia (aspect in jar/hand) | 28 | aspect colour | aspect sigil | amount (only while a jar is in reach or rod/jar held) |
| Well-Fed | 28 | umber | bread | m:ss |
Pill = rounded 14 px, 1.5 px border in the colour, dark fill, glyph + number in `hw-num`; blinks once at 10 s left and once at 0; never more than 1 s animation.
- **Stress/speed** is **not** a permanent HUD item. Three readouts only: (a) **target line** when aiming at a machine: "Quern: grinding wheat, 14 rpm, load 4/24 su" (<= 70 chars); (b) **goggles overlay**: a ring dial around the crosshair, 3 segments (idle / ok / near limit), colour + a shape (circle / half / exclamation); (c) **in-world**: shaft textures tint toward red at > 80% load and tick faster; the bell rings at seizure.
- **Aura dial** (WHATS_LEFT 3, "not built"): a small arc under the compass, visible only while a gathering rod or `aura_reading` research is active: arc fill = local aura strength, violet; 3 pips for aspects present.
- **Power strip** (existing) is unchanged; Current-age additions: brown-out pill and "Storm - turbines up" micro-toast.
- **Mockup (phone portrait HUD, 390 x 844):**
```
┌──────────────────────────────┐
│ [Goal: Boil a bucket  3/3 ▮▮▮] [bag][pause]   <- goal bar, age accent underline
│ ♥ 18/20  ❄ warm ↗  🍞 food   [◉ compass 42m] [☀ 14:20 rain-soon]
│ (flame 2:41) (leaf 1:12) (+1)                  <- pills
│                                                │
│            ·  crosshair ring  ·                │
│     Quern: grinding wheat, 14 rpm, load 4/24   │ <- target line
│                                                │
│ [1][2][3][4][5][6][7][8][9]                    │ <- hotbar
│ (stick)                              (use) (jump) │
└──────────────────────────────┘
```

### 4.4 Light and weather mood (render-side, small)
No global age grading (the world is shared by all ages). Mood comes from **emitters**: block light tint per emitter via the existing hue flags (`LIGHT_HUE`): torch/furnace warm `#ffb060`; steam gauge glass `#ffc870`; blast `#ffd0a0`; lamp `#ffd95a`; arc `#a9d8ff` (cool share); fission `#5cf0c0`; star `#fff2b0`. Weather (exists) supplies the rest; add *dust haze* (Forge) and *glossy wet* (Current) as parameters of existing wet/haze systems, not new passes. Phone budget: no new full-screen passes; particle cap per age-new emitter 24.

### 4.5 Sound palette

All synthesised in `src/audio/sfx*.ts` (names `<area>_<what>`; no speech; pitch = state). **The hearth motif:** a 5-note phrase (A3 C4 E4 D4 A3; pentatonic) played on one *voice per age*, each age adding a voice to the same phrase, so the soundtrack is the arc itself:

| Age | Voice added | Timbre (synth) | When it plays |
|---|---|---|---|
| Ember | `hearth_flute` | triangle + breath noise, slow attack | age start, first fire, first cup |
| Bronze | `bronze_bell` | 2-op FM bell, short decay | shaft turns, valve sings, age advance |
| Forge | `forge_low` | saw + low-pass, 80-110 Hz | the blast, steel, age advance |
| Current | `current_pluck` | square arpeggio, fast decay | arc strike, lamps ripple, age advance |
| Atomic | `pile_drone` | sub sine + slow tremolo | criticality, vault entry |
| Star | `star_chord` | stacked all five voices | ignition only |

Rules: music-like stingers play only at moments (>= 90 s apart), never in loops; muted by default on **Reduce sound** setting; ambience has no melody.

New sfx and ambience (builders name them exactly; all go in `src/audio/*`; each needs an entry in the sfx tests):

| System / age | One-shots (`SfxName`) | Ambient layer (loop, budget 0.12 of master) |
|---|---|---|
| Ember handwork | `chop_stroke`, `quern_grind`, `anvil_ring`, `clay_slap`, `pour_metal`, `slate_read` | furnace crackle (exists), night crickets, leaf rustle |
| Brewing | `kettle_boil` (exists-ish), `cup_pour`, `drink_sip` | boil simmer (exists `ambienceBoil`) |
| Bronze steam | `cog_tick` (pitch = rpm), `valve_whistle`, `steam_chuff`, `bell_seize`, `belt_hum`, `chute_whoosh`, `wheel_splash` | shaft hum (pitch/loudness by rpm and load), steam hiss |
| Forge | `hammer_thud`, `blast_roar`, `mill_grind`, `slag_hiss` | blast bed (rises with air bar) |
| Current | `relay_click`, `arc_strike`, `lamp_ripple`, `turbine_whine`, `thunder` (exists) | mains hum (pitch by load) |
| Atomic | `geiger_tick`, `coolant_flow`, `pile_critical` | drone A1, coolant trickle |
| Star | `star_charge` (rises 90 s), `star_ignite` | none (silence after) |
| Magic | `essentia_pour` (exists), `scan_chime` (exists), `aspect_attune`, `node_hum` | spring-stone hum (very quiet, 20-block radius) |
| World | `ruin_enter_cue` (per family: a 1.2 s phrase of that age's motif voice, played at 12 blocks inside the ruin footprint, a **teaser** for later ruins), `seep_bubble`, `cairn_tick` | wind through ruins |
| Emberbound | `automaton_*` (exist) | none |

Budgets: simultaneous one-shot voices <= 8 (phone), looped layers <= 5 active, each layer attenuated by distance (existing `furnaceDistance` model); a new loop must be added to the ambience volume-budget test.

### 4.6 Accessibility and phone readability

| Area | Rule | Check |
|---|---|---|
| Contrast | text >= 4.5:1 on surfaces; pills' border colour >= 3:1 against HUD background | automated in `layout.test.ts` helpers (add `contrast()` helper in `src/ui/kit/format.ts`, U) |
| Colour-only | every colour-coded thing has a glyph or shape; Codex branches, pills, power strip, goggles ring | review checklist |
| Text size | HUD body 14 px min, readings 16 px (`hw-num`), tap targets >= 44 px (exists); **UI size** setting Normal / Large (+20%) (known gap in WHATS_LEFT 6) | e2e at 390x844 and 844x390 |
| Motion | `Reduce motion` setting: no camera shake, no screen flash, pulses become static outlines, particles halved | e2e checks flag respected |
| Flash | lightning, arcs, ignition: <= 3 flashes per second, <= 25% screen luminance change | unit test on the flash scheduler (U) |
| Sound | **Captions for sound** toggle: a small toast-column line for important cues with direction arrow ("<- Bellows Hound growl", "valve whistling", "bell"); haptics opt-in (`navigator.vibrate` 20 ms on pour/strike, 60 ms on seize) | settings test |
| Phone one-hand | goal tracker and hotbar reachable by the right thumb; Codex sheets are bottom sheets; long-press 420 ms (exists) | e2e |
| Performance | no per-frame allocation in new render code; new particle emitters pooled; textures all painted at load (< 1.5 s total painting, existing test cap) - re-measure after adding ~60 tiles | `textures.test.ts` cap kept |

---

## 5. New content keys the dossier needs (so the lanes agree on names)

Block / structure keys (owner W in `blocksWorld.ts` + `specRosterWorld.ts`): `ochre_rock`, `ochre_sand`, `mesa_clay`, `pitch_pine_log`, `bitumen_crust`, `standing_stone`, `waymark_cairn`, `barter_cairn`, `slate_cairn`, `rusted_gearbox`, `rusted_shaft`, `slag_brick`, `slag_heap`, `relay_pylon`, `pale_concrete`, `graphite_block`, `star_ring_rib`.
Texture names (owner U, painter file `src/render/textures/worldAges.ts` + `iconsAges.ts`): the same keys plus `item_slate`, `item_pitch_pine_sap` if distinct, `icon_age_*` (6 small hearth glyphs used by the Codex and furnace ladder), `glyph_*` for the status pills (flame, leaf, bean, bread, cog, drop, bolt, rune).
Sfx names: section 4.5 table. Flags: section 3.1.

---

## 6. Ordered, dependency-correct task list for three parallel builder sessions

**Gate T0 (not ours):** six-age refactor merged; `AGE_INDEX` updated; tests green. Nothing below starts before T0. After T0, the three lanes run **in parallel** on disjoint files with these *two* ordering contracts (U0, W0) that must be done first inside their lanes:
- `U0` must land before `W1` commits (painters exist before block specs name them).
- `W0` must land before anything in W that changes generated terrain.
Everything else has no cross-lane dependency. Lane O depends on W only for the *ruin flags* and slate keys (O6), which can be written after W1.

### Lane U - textures / audio / UI (owner of: `src/render/textures/**`, `src/audio/**`, `src/ui/**` except `src/ui/hud/goal.ts` and `coach.ts`, `src/core/gameEvents.ts` SfxName union only, settings additions in `src/core/types.ts` Settings only)

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| U0 | Contract stubs: add `SfxName`s from 4.5 (append, one commit) with **silent-or-simple** placeholder synths; add painters (recolours) for every key in section 5 so `hasPainter` is true; add `agePalette.ts` with the 7 ramps | T0 | `npx tsc --noEmit` clean; `npx vitest run src/render/textures src/audio` green (extra painters for not-yet-registered names do not fail; if they do, register names in the same commit). Commit message lists the names so W1 copies them. |
| U1 | Real painters for world/age blocks (mesa, pitch pine, seep, standing/waymark/barter/slate cairns, rusted pieces, slag, relay, concrete, graphite, ring) from the ramps; age rivet on every machine casing; ruin wear variants | U0 | `node scripts/texture-sheet.mjs --out=<dir> --scale=6` reviewed; `readability.test.ts` extended (L* contrast rules in 4.2) passes; no duplicate tiles; paint-all < 1.5 s |
| U2 | Item icon categories (gear, pipe, jar, slate, cell) and pill/age glyph sets | U0 | icon tests: transparent bg, 1 px outline; glyphs 16x16 legible at 28 px |
| U3 | Sound: real synths for 4.5 one-shots and layers; hearth motif voices; `ruin_enter_cue` per family | U0 | `sfx.test.ts`, `ambience.test.ts` budget (<= 5 layers, <= 8 voices); each `SfxName` has a recipe (G2 rule) |
| U4 | HUD: pills row + `+N` sheet, target line status sentence cap (<= 70 chars asserted), goggles ring dial, aura dial, `--hw-age` token, furnace screen hearth-ladder strip | U2 | `hudMath.test.ts` additions; e2e screenshots at 390x844 and 844x390: no overlap with touch controls (existing check) |
| U5 | Accessibility: UI size, Reduce motion, flash limiter, sound captions, optional haptics; settings screen entries | U3 U4 | unit tests for flash limiter and caption queue; e2e with each setting on |
| U6 | Phone/GPU review: `HW_GPU=1` screenshots of every age's signature block set (a "wall of every block" harness exists) | U1-U5 | reviewed images in `docs/advice/screens/` (optional) and a short list of fixes |

### Lane W - worldgen and ruins (owner of: `src/world/**` except tests of other lanes, `src/content/{blocksWorld,specRosterWorld,loot,oreVeins,emberbound,automatons,creatures,itemsGround?}.ts` (read before editing), `src/mobs/**`, `scripts/world-map.mjs`, `docs/api/{world,world-features,world-content,emberbound-content}.md`)

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| W0 | `genVersion`: add optional `genVersion` to `WorldSnapshot` (absent = 1); `generateChunk(seed, cx, cz, genVersion = CURRENT)`; new features gated by `genVersion >= 2`; fresh worlds get 2; loading an old save keeps 1 | T0 | `world.test.ts`: old snapshot (fixture) loads and regenerates byte-identical chunks vs a recorded hash; new world has `genVersion 2` |
| W1 | Content keys of section 5: blocks, ruin loot tiers (`gear/row/relay/vault`) with age caps; roster fixture updates; mapping to U0 texture names | U0, W0 | `npx vitest run src/content` green incl. loot age-cap test (no item past its ruin's age); roster fixture updated |
| W2 | Provinces (noise field, ore multipliers, surface re-skin) + `mesa` biome (append `BIOME_KEYS`, `BIOME_PRECIPITATION`, mob habitat, ore mults); spawn never inside | W1 | `world-map.mjs --prospect` prints distances to each prospect rule (1.1-1.5); a test asserts them over **12 seeds** (copper <= 120, tin <= 160, pitch stand <= 140, stream <= 180, coal+iron <= 220, quartz <= 320, ruin gearhouse <= 220) |
| W3 | Ruin families (Gearhouse, Blast Row, Relay Hall, Pile Vault, Starhearth Ring) with `RuinStyle`, guards via `ruinGuards.ts`, loot via `ruinCrates.ts`, and entry **flags** (`ruin_entered_*`) + `ruin_enter_cue` sfx | W2, U0 | `features.test.ts` extended: each family places for seeds 1-10; crates exist; chunk-order independence kept; node timing test (<4 ms best of five 12-chunk batches) still passes |
| W4 | Pitch pine stands, seep mounds, spring stones, waymarks, slate cairns, barter cairn | W3 | determinism tests; `world-map.mjs` legend shows all; a barter cairn e2e (drop 4 bread, receive a gift) |
| W5 | Guardian scaling and teasers: re-age data for Emberbound per age (Bellows Hound -> Bronze, Wardens at Blast Row), ruin guard counts by family; drops per CONGRUENCE F5 | W3 | `emberbound.test.ts` green; spawn tests per place; first-night Mite spawn still guaranteed near spawn |
| W6 | Prospect and exploration tests, docs/api notes, handoff: `docs/api/world-features.md` updated | W2-W5 | all W tests green; world map screenshot saved; `npx vitest run src/world src/content` pasted counts |

### Lane O - objectives / Codex / balance (owner of: `src/content/{objectives,objectivesHand,objectivesBrew,objectivesWorkshop,progression}.ts`, new `objectivesBronze.ts`, `objectivesForge.ts`, `objectivesLate.ts`, `lore.ts`, `src/ui/hud/goal.ts`, `src/ui/hud/coach.ts`, `scripts/codex/**`, `src/content/balance.test.ts` (new), `docs/PROGRESSION.md`, `docs/api/hud.md` (goal/coach parts))

| ID | Task | Depends | Acceptance |
|---|---|---|---|
| O0 | Single ordered `OBJECTIVES` index per age with `requires`, `opt`, and `hint` fields; renumber `age` to the six ages; keep ids stable; `ageIndexOf` everywhere | T0 | `content.test.ts` objective-chain tests green; every id unique; old-save progress (completed ids) still resolves |
| O1 | Bronze chain (1.2) with flags; workshop goals moved to `opt`; `place_bell` required | O0 | solver in `progression.ts` proves reachability to Blast hearth; `objectives.test.ts` playthrough extended through Bronze |
| O2 | Forge/Current/Atomic/Star chains (1.3-1.6); the Star hold objective; casing-count decision applied | O1 | playthrough test to `ignited` with flags stubbed; no goal's reward from a later age |
| O3 | Hint ladder: per-goal nudge table (<= 60 chars), rungs 1-3 (3.3), world-cue requests (motes column event `goal:hint`) emitted for renderer (U) | O0 | `coach.test.ts`: rung timing with fake clock; suppressed on Peaceful flag; no text > 60 chars |
| O4 | Codex tree (3.4) in `scripts/codex`; Field Journal page (places + lore + side goals) | O1 O2 | `npm run codex` zero warnings; every required objective once; mobile layout screenshot at 390 px |
| O5 | `balance.test.ts`: cost model and +-15% bands (2.6); prints table | O1 O2 | prints table to test output; failing when out of band |
| O6 | Lore slates (2.5) in `lore.ts` + `lore_read_n` flag glue; Field Journal discoveries | W1 (keys), O4 | content test: every slate <= 140 chars; Field Journal lists 10 discoveries |

### Cross-lane sequence (who waits for whom)
```
T0 (six-age refactor, exclusive)
 ├─ U0 ──────────────► U1, U2, U3 ─► U4 ─► U5 ─► U6
 │     └──────────────► W1 (needs painters) ─► W2 ─► W3 ─► W4 ─► W5 ─► W6
 ├─ W0 ──► W1 ...
 └─ O0 ─► O1 ─► O2 ─► O3 (parallel to O4) ─► O4 ─► O5 ─► O6 (needs W1)
Final: stream G (integration) runs the playtest below after all three lanes merge.
```
File-ownership collisions to watch: `src/core/gameEvents.ts` (U0 appends SfxNames; nobody else edits it in this window), `src/core/types.ts` (Settings only for U5; objective fields only for O0 - sequence O0 before U5 or rebase), `src/content/blocksWorld.ts` / `specRosterWorld.ts` (W only), `src/ui/hud/*` (U owns all but goal.ts/coach.ts), `docs/api/*` each lane updates its own notes.
**Commit rule:** each task one commit on its own files; run `npx tsc --noEmit` and the lane's vitest subset; leave `dist/` and e2e to the `.run-lock` mutex (team.md).

---

## 7. Final playtest checklist (stream G; phone portrait 390x844 first, then 844x390, then desktop; Dev Mode off, fresh world; then once with an old-save fixture)

Global passes (every age): no text wall (any panel > 2 sentences fails), every machine shows a status sentence <= 70 chars, tap targets reachable by thumb, Reduce motion and captions work, sound muted/unmuted correctly, frame time stays smooth (target 30 fps mid-range phone), save/load round-trip mid-goal, `genVersion` old-save unaffected.

**Ember (first 30 minutes of the age)**

| Minute | A phone player should... | Pass if |
|---|---|---|
| 0-3 | break wood, split planks at a chopping block | first goal done without asking; hint rung 0 only |
| 3-10 | flint pickaxe, rubble, clay, place the furnace | spawn resources found within 48 blocks; dark/cold felt (vignette) but not lethal |
| 10-15 | **first fire** at dusk, charcoal, warmth | moment 1 plays: light disc, Mites stop at the rim, motif note 1; natural stop |
| 15-25 | clay table, fire a mould, smelt copper, **first pour** | pour moment readable; first tin trip < 160 blocks and found without compass |
| 25-30 | hammer a plate, grind flour, farm a row | every hand station gives feedback per stroke; hunger bar behaves |
| (later) | bronze, boil a bucket, **first cup**, visit Old Works, upgrade list | buff pill appears; ruin cue plays; list fits on screen |

**Bronze**
| 0-5 | place the Bronze Furnace, boil water, see steam | kettle pot vs copper kettle never confused (names + glyph) |
| 5-12 | hand crank, **first shaft turns**, millstone grinds | goggles readout appears at 3 blocks; cog tick pitch follows rpm |
| 12-20 | gears, ratio dial, saw bench, heat via thermocouple | status sentences obey the 70-char rule; seize -> bell, never an explosion |
| 20-30 | boiler multiblock via ghost, raise steam | gauge needle readable; **valve sings** moment plays; 5 s burst warning visible |
| later | piston power, air tank, vacuum chute, blast nozzle | chute moment; Gearhouse visited by minute ~35 (loot fits the gate) |

**Forge**
| 0-8 | build the blast hearth around the nozzle | structure ghost lists missing blocks; **the blast** moment |
| 8-20 | iron smelted, coal/limestone from Coal Ridge, heavy axles | Coal Ridge reachable <= 260 blocks; Blast Row guards beatable with bronze/iron maul |
| 20-30 | steel, rolling mill, thermocouple upgrades | bar moves visibly; hammer thuds on the shaft beat |
| later | dynamo, first lamp at dusk, crusher | lamp moment at dusk; 2 kW/1 MJ goals reachable |

**Current**
| 0-10 | cable run, arc electrode, hearth turns blue | colour change on the mouth is unmistakable; power strip appears at first watt |
| 10-20 | pump water, circuits, 1900 C | brown-out warning clear; lamp ripple moment |
| 20-30 | storm with turbines; ward beacon | forecast line mentions storms; flashes <= 3 Hz; Arc Drones only in storm/new moon |

**Atomic**
| 0-10 | plasma hearth shell, superalloy | shell planner counts; superalloy time matches table |
| 10-25 | fission pile, 60 kW, coolant | **criticality** is calm; Geiger ticks track output |
| 25-30 | deuterium, star core; Deepworks trip | colossus heard before seen; flooded gallery air meter works; one superalloy sample in Pile Vault |

**Star**
| 0-5 | assemble the star shell, place the core | casing count text matches the final decision |
| 5-15 | feed 300 kW, hold 90 s | countdown ring visible; dips soften, never fail; **ignition** chord uses all voices; afterglow persists |
| after | continue playing | `ignited` flag set; Field Journal shows %; 1 MW state works |

---

## 8. Decisions for the owner (defaults in parentheses)

1. Star hearth casings: **61** (default recommendation) vs 93.
2. `mesa` as a real biome (default **yes**) vs province only.
3. Cosmetic Field Journal rewards (default **yes**: compass, lantern) vs none.
4. Barter Cairn / lore slates / Waymarks (default **yes, small**; they are the lightest-weight exploration rewards and the first things to cut if usage is tight).
5. Moving the `thermopile` goal to Bronze (default **yes**).
6. Reduce-sound default off, captions default off, haptics default off (all opt-in).

## 9. Risks and what I did not verify
- `genVersion` is the one thing that can corrupt a save if skipped; keep W0 first and test with a recorded old-save fixture.
- Adding ~17 block keys and ~60 tiles raises the atlas layer count: check the layer limit and memory on phone (`DataArrayTexture` max layers >= 256 on WebGL2 baseline; current 164 + ~60 is fine; verify).
- `bitumen` and some `itemsDistill` keys, the `ageMap` after refactor, the location of `TEXTURE_NAMES`, and the final `RuinSite` extension points were **not** inspected in code; builders must read them first.
- Numbers in 2.6 and the ring tables are starting values; the cost model in `balance.test.ts` is the arbiter.
- Not played: nothing here was judged on-screen. U6 and the playtest exist to correct the art and pacing calls.

<!-- ======================== END docs/advice/world-progression-art.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/phone-ux.md ======================= -->
# FILE: docs/advice/phone-ux.md

# Phone UX, HUD and onboarding - advisor report

Author: UX/HUD/onboarding advisor (read-only pass, 2026-11-21). Scope: `docs/CONGRUENCE.md` 4.6 and the owner decisions
(in-world over screens, original names/art, phone first, 44 px targets). Method: read `docs/api/{hud,ui-kit,player,food-ui,
integration}.md`, `src/player/input/*`, `src/ui/hud/*`, `src/ui/vehicleHud.ts`, `src/app/game.ts` (key bindings, crosshair
labels), `src/ui/menus/howto.ts`, plus the live game at 390x844 (Dev world, creative menu, goggles). **Limits of the live
audit:** the browser pane showed the page clipped to a 800x600 frame, so the hotbar and anything below y~600 was not
visible; pointer lock is unavailable; I did not drive machines. Everything marked *(code)* comes from reading source, not
from a screenshot. Nothing in src/ was touched.

---

## 1. Live audit

### 1.1 What I saw (screenshots, 390x844 emulation)

| # | Screen | What it showed | Verdict |
|---|---|---|---|
| S1 | Title | Wordmark, five age bars, NEW WORLD, seed, Survival/Dev, difficulty, Settings, How to Play. All fills the screen with no scroll. | Good. "Five ages" strip is stale after the six-age refactor (Ember/Forge/Current/Atomic/Star; Steam and Bronze missing) - rewrite from `AGES`. Seed field + difficulty hint text (11 px) is the smallest text on the screen. |
| S2 | HUD on spawn | Goal tracker top-left (kicker "GOAL 1 OF 75", title, 0/4, chevron), bag + pause top-right (44 px), vitals plate under the goal, clock card under the bag, orange coach bubble "Drag here to look around", DEV Items chip on the left edge, joystick bottom-left, Place/Use/Mine/Jump cluster bottom-right. | Dense but readable. Problems below. |
| S3 | Creative menu | Full-screen sheet: search, tabs ALL 371 / BLOCKS 38 / MATERIALS 138 / TOOLS... (cut off), 6-column icon grid, item detail line, backpack grid under it. | Works, but five defects (1.2). |
| S4 | Creative search "goggles" | 3 hits (two crates match on description text), 70% of the sheet empty, detail line still shows the previous hover ("Wolframite..."). | Cosmetic: stale detail, matches on description produce noise. |
| S5 | HUD after closing | Hotbar not visible in the pane (clipped). Confirmed from `hud.css`: `--hw-hud-reserve: 116px` right padding when touch, hotbar bottom-centre. | Cannot judge hotbar tap size live; see 1.3. |

### 1.2 Findings per screen / HUD element

Format: **problem** -> fix (file owner in section 6).

**Creative menu (Dev Mode)**
1. Tab strip overflows: "TOOLS" is clipped to "T" and nothing signals it scrolls. -> make the tab strip a horizontally
   scrolling row with an edge fade and snap, or a 2-row wrap; show a count only on ALL.
2. A hover tooltip (the "Wolframite" card) stays up after a tap on touch and covers 3 grid rows. Touch has no hover.
   -> on touch, never show the floating tooltip; show the detail only in the fixed detail line (already exists).
3. Detail line is stale after a search/filter. -> clear it when the filtered list changes, or show the first hit.
4. Tap = take what? Nothing says whether a tap gives 1, a stack, or sends to the backpack. -> caption under the grid:
   "Tap: take 1. Hold: take a stack." and flash the receiving slot.
5. Backpack grid is below the fold in portrait (only 2 of 4 rows visible at 800x600). -> in portrait put the search and
   tabs in a collapsed header (tap to expand) so the grid + backpack both fit; or make the backpack a 9-slot hotbar-only strip.
6. The DEV "Items" chip floats at screen-left mid-height, right where a right thumb on the look area rests in landscape.
   -> dock it into the bag screen as a tab (Dev only) or at top-right next to bag/pause as one more 44 px button.

**Goal tracker + Hearth Log** *(code + S2)*
7. Kicker "GOAL 1 OF 75" is a spoiler of scale that dwarfs a new player ("75!"). -> show "Age 1 - goal 1 of 9" (per age).
8. Tracker is a wide 200 px bar; with a long goal title it ellipsises. -> allow two lines on phone, and put the progress
   as a thin bar under the title instead of "0 / 4" text.
9. The coach "Tap the goal for details" is the only pointer to the Log/Codex. -> see onboarding, section 3.

**Coach bubble** *(S2)*
10. "Drag here to look around" is drawn over the middle of the scene, with its tail pointing at nothing, and persists
    until 0.4 rad of look. On a phone with a fresh game that is fine, but it sits where the player's thumb must drag.
    -> anchor it to the right half (the look zone), add a faint animated finger glyph, and auto-dismiss after 8 s.

**Touch control cluster** *(code: `touchStyles.ts`)*
11. Jump 76 px, Mine 72 px, Use ~72 px, Place ~44 px (small, placed up-left of Use). All >= 44, but **Place is a
    *toggle* that arms the next Use** - a mode switch hidden as a tiny button. Players will tap it, forget it is armed,
    and "Use" will place instead of open. -> replace with the context button (section 2.4).
12. Four captioned buttons for the right thumb plus the look gesture also on the right: the Mine button sits at
    (right 110 px, bottom 72 px), well off the thumb's arc; one-handed play needs the thumb to travel to three
    places. -> thumb-arc layout (2.5).
13. The vehicle HUD rewrites button captions in place (Mine -> Work, Use -> Exit, Jump -> Swap). Re-using a button for
    "Exit" is dangerous: a player who habitually taps Use to interact taps Exit mid-field. -> keep Use as Use; give the
    vehicle its own explicit "Get off" button in the bag/pause cluster plus long-press on Use (hold 600 ms, ring fills).

**Vehicle HUD (tractor/skiff)** *(code: `vehicleHud.ts`)*
14. Panel sits at `bottom: 86px`, centre, exactly above the hotbar; hint text 11 px, `#cdbfae` on `rgba(24,18,14,.78)`
    (contrast ~9:1, fine) but the **hint line is a sentence of 9 words** read once. -> show the hint for the first
    20 s of a ride and on the first ride only; afterwards just fuel + tool.
15. Desktop keys F (work) / R (swap) are registered in `game.ts` with `window` listeners that **bypass the input
    manager**: they are not in How to Play and not remappable, and F is also the natural "interact" key players expect.
    -> conflict table 2.3.
16. No skiff controls are described anywhere in the HUD (the HUD is tractor-only). -> reuse the panel: "Skiff - Use: get off".

**Notebook / Rune desk / Workshop Guide screens** *(code)*
17. Notebook opens by **Use aimed at the sky** (and Use on a block *scans* it). On touch, "aim at the sky and tap Use"
    is undiscoverable and fights with Use-in-air = nothing. With goggles held, Use-at-sky opens the Workshop Guide
    instead. -> the held item decides: notebook = "Scan / open" context button (2.4); Guide = a Guide chip that appears
    on the goal tracker while goggles are in the pack.
18. Every research entry unlocks silently; there is no HUD feedback that a scan *discovered* something. -> a "New note"
    toast with a book glyph and the aspect colour swatch; the notebook button on the bag gets a dot badge until opened.
19. Notebook, desk, Workshop Guide are three separate full-screen sheets that each re-explain a similar list. They are
    justified screens (many entries), but the number of taps from "I scanned copper ore" to "what does Vein do?"
    should be <= 2: scan -> toast -> tap toast opens that note.

**Essentia readouts / goggles / distillery lines** *(code)*
20. All in-world readouts share **one** channel: the crosshair name line (`ui.setTargetName(label)`), replaced when the
    label changes. Priority in `game.ts showStationName`: hand-station > magic label > rod reading > goggles inspect >
    kinetic name. Consequences: (a) the line is one row of ~28 characters of 12 px text centred under the crosshair, so
    "Quern: grinding wheat, 14 rpm, load 4/24 su" (the 70-char sentences CONGRUENCE 4.6 mandates) will wrap or clip on a
    390 px screen; (b) a player with goggles in the pack who looks at a block always gets the goggles reading and
    never the plain name; (c) there is no colour, no icon and no pause between "name" and "state".
    -> the **target card** (2.6): two lines (name + status), status in 13 px, aspect/state colour dot, 3 s grace so it
    does not flicker while the hand moves; long statuses wrap to two lines and a tap on the card opens the full reading.
21. Essentia is only visible on jars/altars via text; no HUD gauge and the owner prefers in-world: use floating motes
    (already planned in 4.7) and the **same target card** for "Jar: 12 cinder / 16". No new HUD widget.
22. Stress/speed (workshop) shows only through goggles (rpm, load su/su). A shaft network that stops from overstress gives
    no feedback unless you look at a part with goggles. -> a world-space "stalled" smoke puff + a one-line toast at
    most once per 20 s ("Shaft network stalled: 28 of 24 su. Add a crank or remove a part.") and a red mote on the
    overloaded part.

**Buff pills** *(code: `hud.ts`, `BuffPill`s: burn, warm, fed, sugar, six drinks)*
23. Up to 10 pills in `.hw-buffs`. Drinks use glyphs `up, home, heart, bolt, pick, hourglass`; **Sugar Rush uses the
    same `hourglass` glyph as Lasting** - two different buffs, one shape. -> give Sugar its own glyph (cube/crystal) and
    a distinct tint; text title for screen readers stays.
24. No cap or stacking rule; 10 pills would wrap into the vitals region (see 4).

**Pause/Settings/How to Play** *(code)*
25. How to Play lists Place + Use as one control line, Drop (Q) is missing on desktop and on touch (hotbar long-press
    throws the whole stack - a *destructive* gesture on a 44 px hotbar slot where players also tap to select).
    -> see conflict table; confirm only for stacks > 1 of valuable items, or move drop to the bag.
26. UI size Normal/Large exists (`uiScale`, `hw-touch--large`); `docs/WHATS_LEFT.md` section 6 still lists it as a gap -
    stale; there is no reduced-motion or contrast setting beyond the OS `prefers-reduced-motion` media queries, and no
    one-handed (left/right swap) setting.

---

## 2. Interaction grammar (one set of rules for the whole game)

### 2.1 Verbs

The game has **five verbs**, each with one meaning everywhere:

| Verb | Meaning | Desktop | Phone | Feedback |
|---|---|---|---|---|
| **Mine** | break / hit / dig; also strike a hand station? **no** (see Work) | hold left mouse | hold Mine button, or press-hold the world | ring fills; dig sfx; haptic tick every 4th hit; break = `Haptic.thump` |
| **Use** | open, operate, eat, scan, light, crank-once | right mouse / `F` (proposed) | tap world, or **Use** button | `ui_click` + swing; haptic light |
| **Place** | put the held block | `Shift`+Use, or right mouse with a block held | tap world with a block held (context button reads "Place") | ghost preview, `place` sfx, haptic light |
| **Hold-Use** (Work/Repeat) | repeat the Use while held: crank, hand-station strokes, stirring, tractor work | hold right mouse / hold `F` | hold Use button | the target card shows a progress ring; sfx loop per machine; haptic pulse at 2 Hz |
| **Drop** | throw the held item/stack | `Q` (stack: `Shift+Q`) | in the Bag: long-press slot -> "Drop" chip; hotbar long-press shows a small "Drop?" chip for 2 s instead of dropping at once | `drop` sfx |

Rule 1: **Use never changes meaning by hidden mode.** The only modal state is "held item", and the button caption shows it.
Rule 2: **Aim decides the target, held item decides the verb.** The caption on the context button is `verb + noun`
("Open Furnace", "Place Plank", "Scan Copper Ore", "Eat Stew", "Crank", "Wrench Pipe").
Rule 3: **Hold = repeat or confirm, tap = once.** Tap-vs-hold threshold stays 280 ms (existing).
Rule 4: **A modifier never exists on phone.** Every Shift/Ctrl chord has a visible button or a context-button caption.
Rule 5: **Destructive = two steps** (drop a stack, break a placed machine with contents, empty a tank).

### 2.2 Prompts and the crosshair line

- One *target card* under the crosshair (section 2.6): **line 1 = name (bold)**, **line 2 = status or prompt**.
- The prompt names the verb the **context button** will do: "Use: open", "Use: scan (new!)", "Hold Use: crank".
  On desktop the same line says the key: "F: crank (hold)". Same string table; the key glyph differs by platform.
- Status words are verbs/states: "grinding", "seized", "out of fuel", "stalled: 28/24 su". Failures say the next action.
- Colour: neutral text white; warn amber; fail red; magic aspect colour only for the dot, never the text (contrast).

### 2.3 Conflict table: buttons now overloaded

| Input | Meanings today | Conflict | Resolution |
|---|---|---|---|
| **Use / right mouse** | open screen; place block; eat; till/plant; pail; **scan with notebook**; **open notebook at the sky**; **Workshop Guide at the sky with goggles**; wrench on pipe; crank once; **exit tractor** while driving | one button, 10 outcomes, 3 of them keyed on "aim at nothing" | Context button + caption (2.4). Sky-Use stops opening screens: notebook scan is Use on a block; opening the notebook is the **Notebook chip in the Bag** (and the held-notebook context caption "Open notebook" only when nothing is aimed). Guide: chip in the Bag, not Use-at-sky. Vehicle exit: its own button. |
| **Mine** | dig; hit mob; **Work** while driving | recaptioned live | Keep Mine = dig/hit only. Work uses Hold-Use (same gesture as crank/hand stations): one grammar "hold Use to work". |
| **Jump** | jump / swim; **Swap tool** while driving | recaptioned live | Vehicle gets a 44 px "Tool" chip beside its panel; Jump stays Jump (no jumping a tractor, so it may stay hidden). |
| **Place toggle** | arms next Use to place | hidden mode, forgettable | Remove the toggle on phone. When a block is held and the aimed block has a screen on that face, the caption reads "Place Plank" and the *tap on the world* places; a second smaller chip **"Open"** appears beside it (so both outcomes are one tap, no mode). Desktop keeps Shift+Use. |
| **Q (drop)** | drop held; drop stack on Shift? not bound | no touch equivalent except hotbar long-press | Phone: Bag slot chip, hotbar long-press = a confirm chip. Desktop: Q one, Shift+Q stack. |
| **F** | tractor Work (hold); nothing else | F is also the universal "interact" key; undocumented | Make **F = Use alias** on desktop (same as right-click: one-handed keyboard play), and the tractor Work becomes **hold F / hold Use** (same key, no conflict because Use on a driven tractor means Work). Exit moves to **E-long / Esc menu "Get off"** or `X`. R swap stays but is shown in the panel. |
| **R** | tractor swap tool | free key otherwise; unconfirmed in How to Play | Keep; list in the panel and How to Play. |
| **E / bag** | inventory; closes any screen | fine | Unchanged. |
| **L / goal tap** | Hearth Log | fine | Unchanged, plus Codex pointer inside the Log. |
| **Crank (Use on a hand crank)** | one Use = turn for 3 s (`CRANK_S`), hold repeats | on phone "hold Use" is the same as hold on a block = **mine**! | Aim decides: a crank/lever/hand-station aim switches the hold ring to "Work" mode (the Mine hold-to-dig on a placed machine is a footgun: it destroys the crank). Mining a placed machine needs the wrench/hammer-held rule or a deliberate "hold Mine". Desktop already separates left/right; on touch, **hold on world = mine only when aimed at a block that is not a station/crank/lever**, otherwise it is Work. |
| **Wrench** | Use on pipe turns the side aimed | cooldown 0.35 s; on touch no hold-to-repeat | Keep; caption "Turn side (N)". |
| **Goggles** | carried = replaces crosshair name with inspect reading; held + Use-at-sky = Guide | silent override of block names | Goggles show their reading *as line 2*, name stays line 1. Guide = Bag chip. |
| **Notebook scan** | Use on block scans; lens 1.5x | no feedback of "already scanned" | Caption: "Scan (new)" / "Scan (known)"; sfx `scan_chime` pitch differs; a known block does nothing but toast "Known". |

### 2.4 The context-sensitive action button (design)

Replace the Place toggle + Use with **one Action button** (the Use button, 72 px) plus **at most one secondary chip** (44 px).

State resolver (pure function, DOM-free, `src/player/actionHint.ts`, unit-tested): input = held item, aimed
block + face (`RayHit`), aimed creature, vehicle state, sim query (`handView`, `magic.useHint`). Output =
`{ primary: { verb, noun, icon, repeat: boolean } | null; secondary: { verb, noun } | null }`. Priority (highest first):

1. Driving: primary = "Work" (repeat) if an attachment, secondary = "Tool" (swap); Get off is a separate chip.
2. Creature in reach + edible/tame item: "Feed Goat"; else null (Mine hits it).
3. Hand station / crank / lever aimed: "Crank" / "Chop" / "Grind" (repeat = true).
4. Pipe aimed + wrench held: "Turn side". Bucket on fluid port: "Fill"/"Pour".
5. Notebook held: aimed block -> "Scan <Name> (new)"; nothing aimed -> "Open notebook".
6. Block with a screen aimed: "Open <Name>" (secondary = "Place <held>" when a block is held).
7. Block held (nothing special aimed): "Place <held>" (secondary = "Open <Name>" if a screen block is aimed).
8. Food held, hungry: "Eat <Name>". Hoe/seed aimed at soil: "Till"/"Plant".
9. Nothing: the button greys to the Bag icon "Bag" (tap = inventory) so it is never dead.

Presentation: the caption lives **inside** the 72 px button (two lines, 11 px, verb on top); the noun also appears on
the target card. The button pulses once when the primary changes (no pulse when reduced motion). Secondary chip appears
above-left of Use, auto-hides after 2.5 s without aim. Haptic: light tick on caption change *only* when a repeat/Work
verb becomes available (so crank/hand stations are discoverable by feel).

### 2.5 Reach zones (one-handed, 390x844)

- **Easy thumb arc (bottom 35 %, both lower corners):** joystick left, Action + Mine + Jump right. Keep everything the
  player taps *repeatedly* here.
- **Reach with stretch (middle):** look-drag area (whole screen right of the joystick), target card.
- **Hard (top 25 %):** goal tracker, bag, pause. These are *glance + occasional tap* only; fine.
- **Setting "Hand: Right / Left" (default Right):** mirrors the cluster and joystick. Cost: one CSS class + gesture
  region swap in `gestures.ts`.
- Hotbar stays bottom-centre; **swipe along the hotbar to scroll slots** is not needed (9 slots x 44 px = 396 px > 390!)
  -> on 390 px the 9-slot hotbar touches the edges; `--hw-hud-reserve` already pads. Verify slot size is >= 40 px with
  a 2 px gap on 360 px-wide phones (acceptance A4).

### 2.6 Target card (replaces the one-line crosshair name)

```
 ┌───────────────────────────┐
 │ ● Quern                   │   line 1: name (14 px, 600)
 │ grinding wheat, 14 rpm    │   line 2: status (13 px), wraps to 2 lines, max 70 chars
 └───────────────────────────┘
```
Width <= 280 px, centred 56 px below the crosshair (not on it); dot = aspect/state colour; the card fades in 80 ms,
holds 3 s after the aim leaves; reduced motion = no fade. Tap on the card = full goggles reading as a bottom sheet
(only if the block has a longer reading). Data source stays the existing `ui.setTargetName(label)`; extend the
signature to `(name, status?, tone?)`. Existing `parseTargetName` for creatures is kept.

### 2.7 Haptics and sound cues

Phone: `navigator.vibrate` (Android only; iOS Safari ignores it - treat as best-effort). Respect a Settings toggle
"Vibration". Patterns: tick 8 ms (selection change, caption change), tap 15 ms (use/place), thump 30 ms (break/land),
double 15-40-15 ms (error/refused), long 60 ms (goal done, discovery). Sound: existing `SfxName` set; add
`ui_select_verb` (soft tick), `scan_known` (flat) vs `scan_chime` (bright), `stall` (descending whine) for
overstress. Never haptics on every dig tick (battery, buzz) - every 4th only.

---

## 3. Onboarding: the first 30 minutes on a phone

### 3.1 Intended path and where it breaks

| Min | Player does | What the game says now | Gap |
|---|---|---|---|
| 0-1 | Title -> New World | "Drag here to look around" | Fine. Add "Joystick: walk" to the same bubble family. |
| 1-4 | Mine tree, collect | goal "Gather wood 0/4"; coach "hold MINE" | Good. No hint that items auto-pickup / drop on the ground now (ground items). |
| 4-8 | Workbench, tools, furnace | goal chain 1-8 | The Hearth Log is mentioned once (coach); **no mention of Codex, the notebook, hand stations**. |
| 8-15 | Fire, first smelt | Furnace screen has tabs LOG/GRID/STRUCTURE | Furnace screen is the densest on the phone; first visit needs a 3-step peek ("Fuel here, ore here, wait for the glow"). |
| 15-25 | Hunger, night, farming | HUD vitals + hunger vignette | Hunger/night are explained only in How to Play (never opened). Night 9 m: the game **starts at "Night 9 m"**? (S2 clock) - first minutes at dusk is hostile; start at morning. |
| 25-30 | Bronze/steam/belts/research appear | goals | Research/notebook, belts, distillery have **no introduction event**. |

### 3.2 Hint system (event-driven, not text walls)

`src/ui/hud/hints.ts` (new, extends `coach.ts`): a `HintEngine` fed from the bus. Each hint = `{ id, when(event), text,
anchor, max: 1, cooldownS }`; stored in `localStorage hearthwatt.hints` (best effort); shown as a **hint card**: icon + <=
12 words + optional "Show me" (opens the right Codex page) + dismiss. At most **one visible**, queue depth 2, none while a
screen is open, none within 60 s of the previous one, never during hazard (health < 30 %, in lava, mob nearby).

| Trigger (bus event / state) | Hint (<= 12 words) | Anchor |
|---|---|---|
| first item on the ground (`ground:spawn`) | "Walk over items to pick them up." | item |
| first `block:placed` of a machine block | "Use opens a machine. Wrench turns pipes." | target card |
| first fuel burn in a furnace | "Pump the bellows to get hotter." | furnace |
| first `inventory:changed` with `field_notebook` | "Use on a block scans it. Notes are in the Bag." | action button |
| first scan success (`research:*`) | "New note! Tap to read." | notebook chip |
| first crank/hand station aimed | "Hold Use to keep turning." | action button |
| first overstress stall | "Too heavy. Add a crank or remove parts." | part |
| first belt/shaft placed | "Shafts pass spin along. Goggles show rpm." | target card |
| health low + night | "Stand next to a lit furnace: it is safe ground." | vitals |
| first distillery part placed | "Boil spirit, collect at the receiver." | target card |
| first goal complete (existing) | "Tap the goal to see what's next." | goal |
| 12 min with no furnace | "Goal: build a furnace. Open the Bag, tab 'Hand'." | goal |
| first vehicle mount | the vehicle hint (shown once, 20 s) | vehicle panel |

### 3.3 Goal tracker wording

- Kicker: "Age 1 - Ember" + step "3/9" instead of "GOAL 1 OF 75".
- Title: the verb phrase of the next action ("Gather wood", "Build a furnace"), **second line: what/where** ("4 logs: any tree").
- Tap = Log; **long-press = "Show me"** (points an arrow on the compass to the nearest needed block when known).
- Done toast: "Goal done: Gather wood. Next: Build a workbench." (<= 3 s).
- Reward line in the Log only.

### 3.4 How to Play and Codex pointers

- How to Play (`howto.ts`): keep the loop; replace the two big control tables with a **Controls card that matches the
  actual platform** and adds the new verbs (Hold Use, Notebook scan, drop, vehicle, one-handed). Add "Where do I
  read about X?" -> Codex and Hearth Log buttons.
- Pause menu: **How to Play** and **Codex** as two buttons (44 px). Hearth Log gets a "Codex" button on its header.
- Research discoverability: the Bag gets a **Notebook chip** (book glyph, dot badge when unread), opening the research board;
  the notebook item's own tooltip says "Use on a block to scan".
- Belts/distillery: the *goal chain* gets one goal each that places the first part (the hint fires on placing).

### 3.5 Accessibility

| Topic | Today | Change |
|---|---|---|
| Text size | `uiScale` normal/large exists | Make **Large** scale HUD plate, target card, hints and menus; min 14 px body (many HUD texts are 11-12 px). Check the vehicle hint (11 px) and difficulty hints (11 px). |
| Contrast | warm dark panels; light text ~9:1 | Audit amber-on-amber hint bubbles (orange coach bubble with dark text: ok); aspects colours never carry text; buff pills need a text label at Large. Add a **High contrast** option: solid `#000` plates, 2 px outlines. |
| Reduced motion | CSS `prefers-reduced-motion` in 4 sheets + `prefersReducedMotion()` in kit | Add an in-game **Reduced motion** setting (OR'd with the OS flag): no screen shake/FOV kick, no throb animations, no button pulse, static hint cards. FOV kick (`SPRINT_FOV_KICK`) too. |
| Colour-blind | state colours (red hunger / green) | Every colour state must also have a glyph or word (buff pills do; power bars: add "!" for overload). |
| One-handed | right-hand cluster; stretch to Mine | "Hand: Right/Left" + optional **Auto-mine** (hold anywhere on the world with Use-aim, since Mine = hold-on-world already exists). |
| Screen reader | `aria-label`s on goal, buttons | Add `aria-live=polite` to the target card; hints `role=status`. |
| Haptics | none | Settings: Vibration On/Off. |

---

## 4. HUD budget

### 4.1 Zones (portrait 390x844)

```
┌──────────────────────────┐
│ Z1  goal tracker   bag ‖ │  top 8-52  : persistent, 44 px
│ Z2  vitals     clock     │  52-112    : persistent, small
│ Z3  alerts + toasts      │  112-170   : transient, 1 at a time
│            ·             │
│       target card  Z4    │  centre-below crosshair: transient
│            ·             │
│ Z5 buffs (a row)         │  above hotbar, left-aligned, max 4
│ Z6 vehicle / hint panel  │  above buffs, centre, one only
│ stick   hotbar  action   │  bottom: controls + hotbar
└──────────────────────────┘
```
Landscape 844x390: Z1 left, Z2 below it (compact one row), clock top-centre, buffs top-right under bag/pause, vehicle
panel left of the cluster. Total persistent HUD <= 18 % of screen area.

### 4.2 What shows when (priority 1 = never hidden)

| Element | Shown | Priority | Rule |
|---|---|---|---|
| Crosshair, controls, hotbar | always | 1 | never obscured by cards |
| Vitals plate | always; **collapses** to a single heart+flame+bowl when all > 70 % and no change for 10 s; expands on change | 2 | saves 40 px |
| Goal tracker | always (collapses to one line in landscape) | 2 | |
| Clock | tap-to-expand; shows only the phase icon + time | 3 | |
| Alerts (cold, hunger, power overload, night, low fuel) | transient 3 s, one at a time, queue 2 | 2 | alert > hint > toast |
| Target card | when aimed at something with status | 2 | |
| Buff pills | one **compact row max 4**: sorted by remaining time ascending; the rest collapse into "+3"; tap the row = full list sheet; pills show only the glyph, with timer on the pill that expires < 30 s | 3 | Sugar Rush always in the row while active (it has a downside) |
| Essentia | **not on HUD**; jar/altar via target card; world motes | 4 | |
| Stress / rpm | **not on HUD**; goggles via target card; stall = toast + smoke | 4 | |
| Fuel (vehicle) | vehicle panel while driving; low-fuel alert at 12 % | 2 | |
| Vehicle panel | while driving only; hint line only first 20 s of first ride | 3 | |
| Hint card | event-driven, one at a time, none if alert is up | 4 | |
| DEV Items chip | Dev mode only; in the Bag/top row, not left edge | 5 | |
| Coach bubbles | first 90 s only | 4 | |

### 4.3 Stacking order and collisions

1. Alerts own Z3. If an alert is active, the hint card is queued and the toast waits.
2. Target card and hint card never coexist: hint anchors to the card slot; when aimed at a status target the hint waits.
3. Vehicle panel replaces the buff row's vertical slot (buff row slides up 40 px) - not both overlapping the hotbar.
4. Bag-open and any screen hide the HUD with `[data-screen]` (existing). Keep.

---

## 5. Settings to add (all in `settings.ts`, defaults in `core/context.ts`)

`reducedMotion: 'system' | 'on' | 'off'`, `contrast: 'normal' | 'high'`, `hand: 'right' | 'left'`,
`vibration: boolean`, `hints: boolean` (turn the hint system off for veterans), `uiScale` extended (normal/large; keep).

---

## 6. Builder task list (two builders, disjoint files)

### Builder UX-1: input grammar, action button, haptics (owns `src/player/**`, `src/ui/vehicleHud.ts`, `src/app/game.ts` key block)

| # | Task | Files | Acceptance |
|---|---|---|---|
| U1 | `actionHint.ts` resolver (pure) with priority table 2.4; unit tests for every row | `src/player/actionHint.ts` (+test) | vitest: 14+ cases, e.g. notebook + ore -> "Scan Copper Ore"; goggles + sky -> null (no screen); crank aimed -> repeat |
| U2 | Remove sky-Use screens: notebook open and Workshop Guide open move to Bag chips/events; `magic.use(null)` returns not-handled | `src/app/game.ts`, `src/magic/magic.ts` (read-only edit of one branch), `src/player/interaction.ts` | unit: Use with nothing aimed never emits `ui:open`; notebook scan on a block still works |
| U3 | Context action button: caption from U1; Place toggle removed on touch; secondary chip; hold ring "Work" on station/crank aim; hold-on-world mines only for non-stations | `src/player/input/touchOverlay.ts`, `touchStyles.ts`, `core.ts`, `gestures.ts` | e2e phone: aim at a crank, hold Use 1 s -> crank rotates and the block is not mined; aim at plank with plank held -> caption "Place" and tap places |
| U4 | Vehicle: Get off as its own 44 px button; F becomes Use alias + hold = Work; R swap kept; panel hint shown 20 s on first ride; remove caption rewrite of Use | `src/ui/vehicleHud.ts`, `src/app/game.ts` key handlers, `src/player/input/keys.ts` | e2e: mount tractor on phone, Use does not dismount; "Get off" does; Esc menu also |
| U5 | Hotbar long-press = "Drop?" chip (2 s) not instant drop; Bag slot menu Drop; desktop Shift+Q stack | `src/ui/hud/hotbar.ts`, `src/player/input/keys.ts`, `intent.ts` | unit: single long-press does not drop; confirm does; vitest `drop.test.ts` updated |
| U6 | Haptics module + settings toggle; patterns in 2.7; sfx names `scan_known`, `ui_select_verb`, `stall` | `src/player/input/haptics.ts`, `src/audio/sfx*.ts`, settings | unit with fake `navigator.vibrate`; muted when setting off |
| U7 | Hand setting (mirror cluster/joystick) | `touchOverlay.ts`, `touchStyles.ts`, `gestures.ts` | e2e: hand=left mirrors; all buttons still >= 44 px |

### Builder UX-2: HUD, hints, onboarding, a11y (owns `src/ui/hud/**`, `src/ui/menus/**`, `src/ui/screens/creative/**`, `src/ui/screens/notebook/**` chips, `src/ui/styles.css`, `core/context.ts` settings, `howto.ts`, `title.ts`)

| # | Task | Files | Acceptance |
|---|---|---|---|
| H1 | Target card (two lines, 3 s grace, wrapping 70 chars), `setTargetName(name, status?, tone?)`; goggles/hand-station/jar/altar labels send name+status separately | `crosshair.ts`, `hud.ts`, `hud.css`, `game.ts showStationName` (minimal edit coordinated with UX-1) | e2e phone 390x844: aim at a hand station and a quern with goggles: card visible, no clipping, <= 2 status lines, width <= 280 px |
| H2 | Buff row cap 4 + "+N", own Sugar glyph, tap opens full list; vitals collapse | `hud.ts`, `drinkBuffs.ts`, `vitals.ts`, `hud.css`, kit icons | unit `drinkBuffs`: sort by time; with 7 buffs DOM has <= 5 pills; Sugar glyph != Lasting glyph |
| H3 | HintEngine + 13 hints (3.2), storage, quiet rules | `src/ui/hud/hints.ts` (+test), `coach.ts` (shared storage) | unit: each trigger fires once, none within 60 s of another, none while a screen is open; e2e: first fuel burn shows the bellows hint |
| H4 | Goal tracker wording per age, long-press "Show me", progress bar | `goal.ts`, `objectives.ts` (text only) | e2e: kicker reads "Age 1 ..." not "of 75"; text does not overflow at 360 px wide |
| H5 | Creative menu: tab scroll, no touch tooltip, detail refresh, tap/hold caption, Dev chip into the top row | `src/ui/screens/creative/*`, `hud.ts` dev chip | e2e: tabs scrollable, tooltip absent on touch, search clears detail |
| H6 | Notebook chip in Bag + dot badge + "New note" toast tap-through; Guide chip while goggles carried | `src/ui/screens/inventory/*`, `notebook/*`, `workshopScreen.ts` entry | e2e: scan -> toast -> tap -> note open in <= 2 taps |
| H7 | Settings: reducedMotion, contrast, hand, vibration, hints; apply classes on root; FOV-kick/shake off under reduced motion | `settings.ts`, `settingsText.ts`, `core/context.ts`, `uiScale.ts`, css | unit: defaults; e2e: toggling Large changes `.hw-hud` scale; reduced motion disables `hw-hud-throb` |
| H8 | How to Play/Pause: Codex + How to Play buttons, platform-correct controls (Hold Use, Scan, Drop, vehicle) ; title age strip from `AGES`; game starts in morning | `howto.ts`, `pause.ts`, `title.ts`, spawn clock in the game start code (owner confirmation) | e2e: How to Play shows touch list on phone and includes Hold Use; title lists six ages |

### Phone e2e assertions to add (script `scripts/e2e-phone-ux.mjs`, run `HW_GPU=1`, 390x844, 844x390, 360x740)

1. No element of `.hw-touch-btn`, `.hw-hotbar .hw-slot`, bag, pause, chips smaller than 44x44 CSS px (360 px wide: hotbar slot >= 40).
2. No horizontal page scroll; no HUD element crosses the viewport edge; no two interactive HUD rects intersect (target card vs
   buff row vs vehicle panel).
3. Text min: `getComputedStyle` font-size of every HUD text node >= 12 px at Normal, >= 14 px at Large.
4. Goal tracker, target card, hint card contrast >= 4.5:1 against the plate (sampled with a canvas readback).
5. Hold Use on a crank does not mine it; tap with a block held places; notebook scan toast appears; vehicle Use does not dismount.
6. With 7 buffs active the HUD shows <= 5 pills.
7. Landscape: vitals + goal + buffs do not overlap the joystick or cluster rects.

---

## 7. Suggested order and sequencing note

The six-age refactor holds `src/` exclusively; start builders only after it lands. UX-1 and UX-2 touch disjoint trees
except `src/app/game.ts` (UX-1 owns the key block and `showStationName` caller; UX-2 only the `setTargetName`
signature) - land H1's signature first (a one-line interface change), then UX-1. Order: **U1 -> U2/U3 (the biggest
phone win) -> H1 -> H2/H3 -> U4/U5 -> H4-H8 -> U6/U7 -> e2e script**. Estimated 2 builder sessions of one working day each.

## 8. Open questions for the owner

1. Is the first minute at "Night 9 m" intended? (HUD clock showed Night at world start; suggest morning start.)
2. OK to drop Place-as-toggle on phone in favour of the caption-driven context button?
3. OK that sky-Use no longer opens the notebook/Guide (Bag chips instead)?
4. Haptics on by default (Android only)?

<!-- ======================== END docs/advice/phone-ux.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/balance-economy.md ======================= -->
# FILE: docs/advice/balance-economy.md

# Hearthwatt - balance and economy advice

Advisor: balance and economy (read-only pass, 2026-11-21). Numbers are expressed per **age name** and **recipe id**, never per tier index, because the
six-age refactor is renumbering tiers under this document.

**Method and its limits (read first).** All content numbers were read from the committed tree at `9e3b862` (five furnace tiers, old `age:` fields),
dumped through the real registry (`ITEMS`, `RECIPES`, `BLOCKS`, `ORE_VEINS`, `MACHINE_SPECS`) with `vite-node`. The Bronze Age parts are NOT in code yet, so
their costs come from the tables in `docs/BRONZE_PLAN.md` / `docs/STEAM_PLAN.md` (marked *planned*). Nothing was built, run in a browser or played: every
"minute" below is a **model estimate**, not a measurement. The script is `balance-model.ts` in the shared notes folder
(`C:\Users\admin\AppData\Roaming\Claude\side-session-notes\local_4bdc7aa5-0ceb-445b-9336-843dec94f1d4\`); it must live in a `src/content/timeModel.ts` +
test before anyone trusts it (section 5).

---

## 1. Resource-flow model

### 1.1 Formulas (all parameters are assumptions, flagged `A`)

| Quantity | Formula | Source |
|---|---|---|
| Mining time of a block | `hardness / toolSpeed` (x3 and no drop below `minTier`; x1/1.25 when Well-Warmed; x1.25 Vigor) | `game/mining.ts` |
| Tool wear | exactly 1 durability per matching block | `mining.ts:wear` |
| Gather cost of one raw item | `(mineTime + vein overhead) / (expected drop count x chance)`; vein overhead = `30 s / (veinSize x 0.8)` per ore block `A`, trees 6 s per 4 logs `A` | `oreVeins.ts` |
| Craft cost (attended) | hand/workbench = 2 s of taps `A`; strokes stations `strokes / strokesPerS` (quern 3/s, anvil 2.5/s x2 with hammer, mortar 2/s, loom 2/s) | `blocksHand.ts` |
| Smelt | crucible-seconds = `timeS`; wall time = `crucible-s / (crucibles x furnace.speed)`; runs parallel to gathering (counted at 25% attended) `A` | `recipes.ts`, `tech.ts` |
| Fire-seconds for a job | `crucible-s / (crucibles x speed x 0.7 utilisation)` `A` | |
| Fuel items | `fire-s / burnS` (charcoal 80 s, coal 100 s, coke 120 s, peat 50 s, log 50 s). Fuel burns at a fixed `energyJ/burnS` while lit whether or not the temperature is capped, so draft shortens the burn by `1+draft` | `sim/furnace.ts:170` |
| Heat-up | `heatCapacityJ x dT / qFuel` = 150 J/C x 780 C / 5 kW = **23 s** for a Clay Furnace on charcoal | `sim/furnace.ts` |
| Raw cost of an item | cheapest-route fixed-point over every recipe (cost in expert seconds); containers (pail, beaker, vial, moulds) are reusable and cost 0 | `balance-model.ts` |
| Expert minutes -> player minutes | `x 2.0` `A` (phone controls, exploring, building the shell, nights, learning). **Unverified: calibrate from the first real playthrough log.** | |

"Expert" = never lost, never dies, optimal tool at each step, one trip per ore. It is a *lower bound*; a first-time phone player lands at ~2x.

### 1.2 Gather costs per raw item (expert seconds per unit, vein overhead included)

| Raw | flint tools | bronze tools | iron tools | steel tools | notes |
|---|---|---|---|---|---|
| oak/pine log | 2.5 | 1.6 | | | 4 logs a tree |
| clay | 2.0 | 1.5 | | | shovel |
| rubble | 2.5 | | | | stone h4 |
| flint | 8.0 | | | | gravel drops flint 25% |
| copper ore | 9.0 | 6.9 | | | h5.5, vein 6 blocks, 4 veins/chunk |
| tin ore | 10.3 | 7.7 | | | h5.5, vein 5, 2.5 veins/chunk (scarce) |
| coal | 4.8 | 3.9 | 3.9 | | h5, drops 1-2 |
| iron ore | - | 11 | 7.8 | | h7, needs a bronze pick (tier 2) |
| wolframite / spodumene | | | | 9.5 / 9.3 | h12/h11, tier 4, 0.7 / 0.6 veins/chunk |
| bauxite / quartz | | | | 7.6 / 8.8 | h8, tier 3 |
| pitchblende | | | | needs `power_drill` | h14 tier 5 |

### 1.3 What it takes to leave each age (expert seconds, raw bill, smelt load)

Bundles are the furnace upgrade list plus the age's own kit, so "to reach the next furnace tier" includes the machines the age exists to teach.

| Age (bundle) | Raw bill | Gather+craft (expert) | Crucible-s | Fire fuel |
|---|---|---|---|---|
| **Ember** kit: workbench, flint tool trio, `furnace_clay`, 10 charcoal | 12 rubble, 12 oak_log, 9 fiber, 6 clay, 5 flint | 2.9 min | 80 | 1 charcoal/80 s |
| **Ember** metal: 15 `bronze_ingot` (13 for cast heads + 2 `bronze_hammer`), 45 clay for 9 moulds/pot/cup/cone, 8 `stone_brick`, cord | 9 copper_ore, 3 tin_ore, 45 clay, 18 fiber, 8 rubble | 5.4 min | 86 | |
| **Ember -> Bronze gate** (planned: 8 `bronze_ingot`, 4 `firebrick`, 1 `bellows`, 2 `bronze_plate`, 1 `leather` at 700 C) | 7 copper_ore, 3 tin_ore, 12 fiber, 2 clay, 1 hide, 1 log | 3.1 min | 81 | |
| **Ember total** (plus food, farm, brew, ~3 min not modelled) | ~30 Cu+Sn ore, ~60 clay | **~12-15 min** | ~250 | ~5 charcoal |
| **Bronze** *planned*: `boiler_plate` x30, gauge glass, heat/water/steam port, `safety_valve`, 2 gauges, 12 `steam_pipe`, `steam_engine_b`, `air_compressor`, `air_tank`, `blast_nozzle`, 8 thermocouples, 24 `brick` | 85 copper_ore, 28 tin_ore, 49 clay, 5 sand | 32 min (+ ~6 min first-half steam kit: saw, millstone, trip hammer, stamp mill, press, wheel, clockwork = ~350 s) = **~38 min** | 1,197 | ~8 charcoal/coal |
| **Forge** kit: iron/steel pick+axe, `plated_coat`, `steel_cuirass`, `crusher`, `boiler`, `steam_engine`, 2 `tank`, `pump` | 56 iron_ore, 44 fiber, 15 sand, 9 coal, 9 limestone, 7 copper_ore | 19 min | 1,193 | ~7 coal |
| **Forge -> Current gate** (HEAD): 2 `copper_coil`, 2 `steel_plate`, 24 `refractory_brick`, 1 `electrode` | 48 clay, 19 coal, 7 iron_ore, 4 limestone | 7.8 min (+ dynamo, not in code) | 638 | |
| **Forge total** | | **~27 min** | ~1,800 | |
| **Current** kit: `steam_turbine`, `still`, 2 `wind_turbine`, `chainsaw`, `bore_rig`, 2 `battery`, 6 `heavy_cable`, 4 `circuit` (not `ward_beacon`: needs 2 `ember_core`, a drop) | 36 iron_ore, 16 copper_ore, 16 coal, 12 silica, 9 bauxite, 6 sulfur | 18.3 min | 1,126 | |
| **Current -> Atomic gate** (HEAD): 53 `plasma_casing`, 2 `circuit`, 2 `tungsten_rod`, 2 `power_port` | 57 iron_ore, 55 coal, 53 limestone, 29 wolframite, 27 bauxite | **36 min** | 2,390 | ~8 coke |
| **Atomic** kit: `fission_pile`, `centrifuge`, `electrolyzer`, `power_drill`, `shield_suit`, `lithium_bank`, 6 `super_cable` | 34 silica, 29 iron_ore, 20 coal, 18 fiber, 13 wolframite, 13 bauxite | 21 min | 1,313 | |
| **Atomic -> Star gate** (HEAD): 93 `star_casing`, `star_core`, 8 `deuterium_cell`, 4 `power_port` | 216 iron_ore, 148 copper_ore, 113 silica, 107 coal, 107 bauxite, 103 limestone, 103 wolframite, 53 spodumene | **168 min**, 9.7 MJ of machine energy | 10,070 | ~15 coke |

Per-item unit costs that drive the late bills (expert s each): `steel_plate` 24, `tungsten_rod` 15, `aluminum_ingot` 12, `circuit` 20, `superalloy` 25, `fused_quartz` 6,
`plasma_casing` 38, `magnet_ring` **130**, `star_casing` **94** (the ring is 70% of it).

### 1.4 Findings from the bills

1. **Fuel is never a constraint.** Every gate needs 5-15 fuel items against 80-120 s burn per item; heat-up is 23 s. The real fuel sink is *keeping the furnace lit as the base's heart*:
   a lit furnace burns `1/burnS` items per second: charcoal 11.3 per 15-minute day, coal 9, coke 7.5, log 18, peat 18; draft doubles it. At 2.5-7 s of labour per fuel item that is **~8% of the day**. Keep it: it is the
   only thing that makes "the furnace is the heart" a cost. Do not add per-recipe fuel costs.
2. **Ore bills are mostly multiplicative-yield decisions.** Hand `mortar` gives 1.35 crushed ore per ore (bonus 35%), the Forge `crusher` gives 2.0 (`crushed_*` x2). That is 1.35x and 2x the ingots per ore.
   The Bronze bill above already uses the mortar; without it the bill is 114 copper + 37 tin. Do not give any Bronze machine a bonus above the mortar's.
3. **The Star bill is out of band by 4-5x** and Atomic/Current by ~1.4x (section 2). `magnet_ring` (130 s each) dominates because `star_casing` and `star_core` both consume it.
4. **Ember is cheap as raw work** (12-15 expert minutes). The 30 player-minute target is carried by exploring, learning the stations, farming and brewing waits, not by the resource bill. Do not raise Ember ore counts; add *goals*, not ore.
5. **Tin is the Bronze choke point**: 2.5 veins/chunk of 5 blocks gives 12.5 ore/chunk vs copper 24. Bronze needs a 3:1 Cu:Sn ratio so this is balanced *on average*, but a spawn without tin within ~30 blocks stalls the player.
   Add one guaranteed small tin vein (5 blocks) within 48 blocks of spawn (world gen, test: `tinWithin(spawn, 48)` on 20 seeds) - cheaper than raising `veinsPerChunk`.

---

## 2. Time-to-next-age curve

Target is **player minutes per age** (expert x 2.0). The owner's frame: first 30 minutes, then 45-90 per age on a phone.

| Age | Target player min | Target expert min | Model today (expert) | Deviation | Fix (numeric) |
|---|---|---|---|---|---|
| Ember | 30 | 12-15 | 12-15 | OK | none; add the new goals (clay table, mould firing, pour, quern, brew) but no ore |
| Bronze | 70 | 30-38 | 38 | OK (high end) | keep 30 `boiler_plate`, but offer the smaller `3x3x3` vessel (interior 1x1x1, 26 blocks) as legal: saves 8 plates = 16 ingots = ~2.5 expert min; do not let 85 Cu ore grow |
| Forge | 55 | 24-30 | 27 | OK | the *gate* is only 7.8 min; the age's weight is in its kit (iron/steel tools, crusher, boiler, engine). Keep the Forge gate cheap but make `dynamo` + `crusher` goals required |
| Current | 55 | 25-30 | 18 kit + 36 gate = **54** | +80% | `plasma_casing` 53 -> **24** (3x3x3 hollow shell, 26 blocks - 2 ports): gate 36 -> 18 min; Current total ~36. Keep `plasma_casing` recipe |
| Atomic | 60 | 28-32 | 21 kit + 168 gate = **189** | **+500%** | `star_casing` 93 -> **30**; remove `magnet_ring` from `star_casing` (keep only in `star_core`, 6 -> 3 rings); `deuterium_cell` 8 -> 4. Expert: kit 15 (move `shield_suit`, `lithium_bank` to optional goals) + gate ~27 = **~42** (player 84, the top of the range; the Star Age is a finale) |
| Star | endgame | - | ignition | - | 300 kW for 90 s: see section 3.4 for what that demands |

Gate arithmetic used (so builders can re-derive): `plasma_casing` costs 0.63 expert-minutes each (linear); `star_casing` 1.56 each *with* the ring and 0.47 without; `star_core` + 8 `deuterium_cell` + 4 `power_port` = 22.7 min
(6 rings = 13 min of it).

Whole game: today ~12 + 38 + 27 + 54 + 189 = **~320 expert min = 10.7 player hours**; target total ~ 12 + 35 + 27 + 30 + 42 = **~146 expert min ~ 4.9 player hours**. Within-age ratio rule: consecutive ages should grow by x0.7-2.5, never x5.

**Waiting time that the model does not see** (add to design, not to bills): wheat 100 s per stage x stages (7 min to ripen, `crop.stageS=100`), sap taps 120 s per log, tea/coffee bushes regrow 360 s, tanning 60 s + drying 120 s, distillery runs 60-260 s.
Rule: **no age gate may be blocked on a wait longer than 8 minutes** unless the wait has a hand-work alternative.

---

## 3. Energy and stress budgets

### 3.1 One exchange-rate table (decide once, the builders put it in `core/constants.ts`)

| Symbol | Value | Meaning / current source |
|---|---|---|
| `W_PER_SU` | **50 W** | 1 stress unit = 50 W of shaft power at the 16-rpm reference. Already implied by `GENERATOR_SHAFT.suPerW = 1/50` in `workshop/workshop.ts:33` |
| `ETA_STEAM_SHAFT` | **0.25** | heat -> shaft by a piston engine. The Forge electric `steam_engine` already is 1/3 (`heatPerWatt: 3`) |
| `ETA_DYNAMO` | 0.9 | shaft -> electricity (Forge dynamo, to be built) |
| `ETA_TURBINE` | 0.5 | heat -> electricity, `steam_turbine` (800 L/s x 20 J/L = 16 kW heat for 8 kW) |
| `ETA_BURNER` | 0.3 | `burner_generator.efficiency` |
| `ETA_COMBUSTION` | 0.4 | `combustion_engine.efficiency` |
| `ETA_ELECTRIC_HEAT` | 1.0 | `electricHeatW`: electricity -> furnace heat |
| `ETA_BATTERY` | 0.9 round trip max | `BATTERY_EFFICIENCY` |
| Steam | `STEAM_L_PER_KW_S = 6` (plan) | 6 L/s of steam per kW of heat |
| Shaft SU from boiler | `SU = heatKW x ETA_STEAM_SHAFT x 1000 / W_PER_SU = 5 x heatKW` | = **5 SU per bar** at 6 L/s per bar-kW |

**Invariant:** the product of efficiencies around any closed conversion cycle must be < 1 (target <= 0.6, so a loop is visibly lossy).

### 3.2 Free-energy loops found (confirmed in code unless marked *plan*) and how to close each

| # | Loop | Evidence | Gain | Close it by |
|---|---|---|---|---|
| L1 | **Gearing makes work out of nothing.** Machine throughput is `dt x rpm/16`, but part stress is `base x clamp(16/rpm, 0.25, 4)`, i.e. it FALLS as rpm rises. A crank (16 rpm, 8 SU) into two `ratio_dial` x3 = 144 rpm: stress floor 0.25, throughput x9: work per SU is **x36** | `workshop/kinetics.ts:165-168`; `workshop.ts:592`; `logistics.ts:462` | **up to x36** | Stress must follow power: `stress = base x |rpm|/16` (constant torque per unit of work; power = torque x rpm). Delete the clamp. Then dials, differentials and governors conserve power. Test T3 below |
| L2 | **Steam engine capacity is 25x the heat that feeds it** *(plan)*. 6 kW heat -> 6 bar -> `capacity = 128 x bar` = 768 SU = 38 kW at 50 W/SU | `BRONZE_PLAN.md` section 5.2 ("96 rpm, capacity 768") | **x6.4 energy** (kW), x25 in SU terms | `capacity = 5 SU per bar` (30 SU at 6 bar = 1.5 kW from 6 kW heat); keep `rpm = min(96, 16 x bar)`. A boiler with two heat ports (12 kW) then runs ~7 saws or ~3 presses at 16 rpm, which is the intended Bronze factory |
| L3 | **Generators double-dip**: a water wheel / wind turbine / steam engine delivers its full electric watts AND a shaft at `watts/50` SU | `workshop.ts:344-347` | up to x2 | The shaft share is taken out of the electric output: `electricW = ratedW - 50 x SU_used`, or a unit is either shaft-mode or cable-mode (the Create answer). Test T4 |
| L4 | **Treadwheel is passive power**: 24 SU (= 3 cranks) for standing still on it | `workshop.ts:349` | AFK x3 crank | 12 SU (1.5 cranks), and it must stop if the player does not move/attack for 30 s (anti-AFK). Animals: 12 SU each |
| L5 | **Clockwork motor** gives 48 SU for 120 s for four taps | `CLOCKWORK` | x6 crank per tap | 24 SU, `windS` 30, `maxS` 120 (keeps one tap per 30 s of 24 SU, i.e. 3 cranks; a flywheel on top should *not* extend it) |
| L6 | **Fuel conversions create energy**: log 200 kJ -> `charcoal` 400 kJ (x2); `coal` 800 -> `coke` 1,200 (x1.5). Not a cycle (the input is a raw resource) but the "energy out > energy in" invariant fails | `items.ts` fuel table, `recipes.ts` `charcoal`, `coke` | x2 / x1.5 | Accept charcoal x2 (the Ember bootstrap needs it) and **list both as the only allowed exceptions**; set `coke` 1,200 -> 1,000 kJ and keep `flameTempC` 1,550. Test T6 whitelists them |
| L7 | **Essentia Cinder is free fuel**: one vial (4 units) adds 90 s of fire (= ~1.1 charcoal, 450 kJ at 5 kW). The land recovers 1 unit per 30 s per chunk per aspect, so ~0.5 charcoal/min/chunk forever, automatable with jars + a siphon | `magic.ts:43,49,609` | free fuel | `CINDER_BURN_S` 90 -> **45**, siphon adds `CINDER_BURN_S / VIAL_UNITS` only when below 15 s (already). Since fuel is not a constraint (1.4) this is cosmetic, but keep the cap so magic can never be the *cheapest* heat |
| L8 | **Oil shale -> `fuel_canister` is a 150:1 energy mine**: 2 `oil_shale` + 40 kJ (still) -> 6 MJ chemical -> 2.4 MJ electric in the `combustion_engine` | `recipes.ts` `fuel_canister`; `combustion_engine.fuelEnergyJ` | x60 vs input energy | Intended (a rock is energy dense) but note labour: 1 canister costs ~16 s of labour against 30 charcoal (~210 s) for the same energy: the still makes fuel 13x cheaper per joule than wood. Keep, but do **not** let the still output also be furnace fuel (it is not today: no `fuel` on canisters; add a test that no distillery item has `fuel`) |
| L9 | **Wind and solar scale without limit**: `water_wheel` has `shareRadius 3`, wind/solar have none; one `wind_turbine` is 94 expert-s for 1.5 kW | `tech.ts` `wind_turbine`, `solar_panel` | linear | Add `shareRadius` 12 to wind (output / number of turbines in range) and 6 to solar panels; cheap, same code as the wheel |
| L10 | **Fission and Starhearth are intended gains** (72 MJ rod from 640 kJ of centrifuge; 1 MW ignited from a 27 MJ ignition) | `fission_pile`, `ignitedTempC` | x100 | Intended: they are the endgame. Make sure *cable rating and ignition* are the gate, not free tickling (see 3.4) |

No loop was found in: thermopile (cools the furnace by 4x its output), `blower` (burn and heat both scale with `1+draft`), `space_heater`, arc/plasma heating (a steam-turbine -> arc heater -> boiler loop is 0.5 x 1.0 = 0.5), boiler (`heatPerSteamL 20`).

### 3.3 Power-budget table (so no age is starved or flooded)

Stress is in SU at 16 rpm reference (after fix L1). Electric in W.

| Age | Sources (rated) | Typical peak load | Headroom rule |
|---|---|---|---|
| Ember | hand crank 8 SU (attended, `CRANK_S 2.5`), treadwheel 12 SU | none (hand stations only) | **Ember has no stress network** (owner decision). Cranks appear in Bronze |
| Bronze | crank 8, wheel 8 (400 W), wind 8, clockwork 24, boiler engine **5 SU/bar, <= 30 SU at 6 bar**, 2 heat ports -> 60 | 4-7 machines: saw 4, millstone 4, mortar 4, press 8, hammer 8, mixer 6, drill 6 | one engine (30 SU) runs a 5-machine line; a second port or engine is the first *expansion goal*. Stalled at over-stress, never destroyed |
| Forge | `steam_engine` 2 kW, `burner_generator` 3 kW (charcoal 400 kJ -> 120 kJ, 33 s per item), water wheel 0.4 kW, thermopile 0.3 kW, dynamo <= 2 kW | `crusher` 1 kW, `blower` 150 W, lamps 10 W | one engine = one crusher; **crusher must be worth it**: 1 kW x 4 s = 4 kJ per ore, 2 ingots per ore |
| Current | `steam_turbine` 8 kW, `wind_turbine` 1.5 kW, `solar_panel` 0.3 kW, `combustion_engine` 12 kW, `geothermal_tap` 6 kW | `still` 2 kW, `bore_rig` 4 kW, arc heating 8 kW, `ward_beacon` 0.5 kW | ~15 kW peak: turbine + 2 wind + battery. Grid goal "generate 10 kW" fits |
| Atomic | `fission_pile` 60 kW | `centrifuge` 8, `electrolyzer` 20, plasma 40 | ~68 kW peak: one pile + battery bank **is short by design**; second pile or `lithium_bank` is the goal |
| Star | ignited Starhearth 1 MW | 300 kW x 90 s ignition = 27 MJ | see 3.4 |

Price of power (expert-seconds to build per kW, from the cost model): thermopile 136, water wheel 183, solar 121, `steam_engine` 84, wind 63, `burner_generator` 37, geothermal 37, `steam_turbine` 29, `combustion_engine` 20 - monotonically falling by age (good), with the water wheel the worst by design (free forever, 400 W).

### 3.4 Starhearth ignition

`IGNITION_POWER_W = 300 kW`, 90 s, needs 95% satisfaction, 2 s grace. One `fission_pile` is 60 kW: **five piles or a charged `lithium_bank`** are required. The rule "hold 300 kW on a line that can carry it" is the real gate; keep it.
Check before building: the bank's discharge W must not exceed its `capacityJ` / 90 s with 0.9 efficiency (27 MJ / 0.9 = 30 MJ capacity). Test T2c.

### 3.5 Machines vs hand work (stations are 2-5 s per operation; machines must pay back, hand must stay viable)

Hand rates: chopping block 4 strokes/s (axe doubles), quern 3/s, anvil 2.5/s (bronze hammer doubles), mortar 2/s, loom 2/s. Machine rate: `STROKE_S = 0.5` per stroke at 16 rpm, i.e. **2 strokes/s, slower than a hand**: machines win only by running unattended and in parallel (and by rpm, once L1 is fixed). Payback ops = build cost / (hand seconds + 2 s of taps).

| Machine | Build cost (expert s) | Hand s/op | Machine s/op @16 rpm | Payback ops | Verdict | Target |
|---|---|---|---|---|---|---|
| `mech_loom` | 16 | 5.0 | 5.0 | 2 | too cheap | 60 s (+2 `bronze_plate`, +1 `bronze_cog`) -> ~9 ops |
| `mech_millstone` | **10** | 2.0 | 3.0 | 3 | too cheap | 60 s (+2 `bronze_plate`) -> ~15 ops |
| `mech_mortar` | 29 | 4.0 | 4.0 | 5 | cheap | 60 s |
| `mech_hammer` | 40 | 1.6 | 4.0 | 11 | ok | keep |
| `mech_saw` | 54 | 0.75 | 1.5 | 20 | ok | keep |
| `hand_crank` | 8 | - | - | - | fine | keep |

Rule: **machine build cost = 15-40 x the hand attended seconds of one op**, rising with age; before the first crank the player has already done every op by hand 30+ times, so hand work stays viable and the machine is relief, not a requirement.
Hand throughput must stay >= machine throughput at 16 rpm (true today) so a machine never makes hand work obsolete; machine value is parallelism (buffer 16 items), idle time and rpm.
Forge `crusher`: 2 crushed ore per ore (vs mortar 1.35) at 4 kJ - worth it because it doubles ingots, not because it is fast. `still` (2 kW): see 3.6. `bore_rig` 4 kW x 2 s/block (`secondsPerBlock 2`, tier 4): 6x faster than a steel pick on h12, correct.

### 3.6 Distillery, sugar, brewing, essentia (price/yield audit)

**Sap chain (HEAD recipes): `distil_syrup` 4 sap -> 1 syrup; `ferment_wash` 1 syrup -> 5 wash; `distil_low_wines` 16 wash -> 1; `distil_spirit` 8 low wines -> 1; `rectify_spirit` 4 spirit -> 1 `fuel_ethanol_beaker`.**
Back-multiplying: 1 ethanol beaker = 4 spirit = 32 low wines = 512 wash = 102 syrup = **410 pine sap**, and ~12,300 + 11,300 + 2,240 + 240 + 60 = **~26,000 vessel-seconds** (7 hours on one flask). At one tap per log per 120 s that is 49,000 log-seconds (a 20-log grove for 41 minutes).
Its worth: `FUEL_GRADES.fuel_ethanol_beaker` saw 0.25 x 420 = 105 units = 15 logs; the tractor 0.2 x 150 s = 30 s. A `fuel_canister` (2 oil shale, ~16 s of labour) gives 420 saw units / 150 tractor-s. **Ethanol is ~100x too expensive for its use.**

| Knob | Now | Proposed | Result (sap per ethanol / vessel-s) |
|---|---|---|---|
| `distil_low_wines` ratio | 16 wash : 1 | **8 : 1** | |
| `distil_spirit` ratio | 8 : 1 | **4 : 1** | |
| `rectify_spirit` ratio | 4 : 1 | **2 : 1** | **51 sap / ~3,700 vessel-s** (4 vessels ~15 min) |
| `FUEL_GRADES` ethanol saw / tractor | 0.25 / 0.2 | 0.5 / 0.4 | 1 ethanol = 30 logs; still 3x dearer than oil, which is right: it exists for the Ember/Bronze niche (spirit lamp, antiseptic, potions), not for the saw |
| Fermenting from sugar | not possible | add `ferment_wash_sugar`: 3 `sugar` + 1 water -> 3 wash (sugar = 0.67 sap) | makes the sugar chain a real input to brewing, the planned tie-in |

**Crude oil:** `refine_crude` 8 crude -> 2 diesel + 1 gasoline + 1 kerosene + 2 residue + 2 empty (260 s); `refine_crude_short` 4 -> 1 diesel + 1 slop + 1 residue (130 s). Residue feeds `LUBE.residue` x1.25 stress capacity for 600 s (vs pine resin x1.1, 300 s).
Keep the lube bonus at x1.25: with L1 closed it is the only stress *multiplier*, so test it (T3). Oil pools: confirm they are finite or slow to refill (not read; add to playtest list).

**Sugar chain:** `sap` -> `pine_resin` (boil 180 C) -> 2 resin + 1 water + 1 beaker -> 3 `sugar`. **0.67 sap per sugar**, one tap per 120 s per log: 6 logs = 4.5 sugar/min.

**Brewing (per cup, expert):** attended ~19 s (2 cherries or leaves 4 s + taps), passive roast 8 s, boil 12 s, steep 20 s; buff = 180 s (`DRINK_BUFF_S`).
Break-even test = seconds saved by the buff vs attended seconds spent: Swift (x1.2 walk, ~50% of time walking) saves 15 s; Vigor (x1.25 mining, ~40% mining) 14 s; Lasting (hunger x0.5) ~5 s; Spring/Hearthkept/Mending are situational. **Cups are break-even to slightly negative.** Fix: `DRINK_BUFF_S` 180 -> **300** (saves 25 s; cost unchanged) or brew 2 cups per boil. Do not raise the multipliers: stacking is already high (3.7).

**Essentia gathering:** vis rod 1 unit per use (capacity 16), bronze rod 2/use (32), iron rod 3/use (64), `ROD_INTERVAL_S 0.2`; land recovery 1 unit per 30 s per chunk per aspect, cap `DRAW_CAP 24`. A research-gated Rune Desk recipe costs 12-18 units, an infusion 16-24: **~5-9 minutes of recovery for a chunk's aspect, but the cap of 24 means a 4-unit aspect can be gathered immediately from a chunk with 24 banked**.
Price check: `steel_infusion` (1 `iron_ingot` + 2 `coal` + 12 essentia -> 1 steel) is *worse* than the forge route (2 iron + coke + limestone -> 2 steel), so magic is a flavour path, not a shortcut: keep.
Rule for any new arcane/infusion recipe: essentia cost (units) x 30 s of recovery <= 0.7 x the expert seconds of the physical route; test T9b.

### 3.7 Chainsaw, tractor, vacuum

| Item | Rule today | Cost per use | Verdict / numbers |
|---|---|---|---|
| `chainsaw` | tank 840 units = 120 logs; `fuelPerLog 7`; canister refills 420 (60 logs); gasoline x1.3 (78 logs), ethanol x0.25 (15 logs), diesel 0 | 0.05-0.07 oil shale per log (a canister = 2 shale ~16 s) | Fuel is nearly free; the saw saves ~0.4 s of axe time per log but removes the tree-by-tree overhead (6 s per 4-log tree -> one cut). Fine. Keep the 48-log cap per cut (a sane felling radius). Do not lower `fuelPerLog` |
| `tractor` | 600 s tank at burn 1; canister 150 s; idle 0.2, drive 0.8, work 0.6 per s; max 5.5 b/s (a sprinting player is 5.8) | ~0.024 canister per 100 tilled blocks | The tractor *tills a 4-wide swath at 5.5 b/s* (~22 blocks/s vs a hoe's ~2/s). Fuel is trivial; the real cost is the build (2 `chassis`, 4 `steel_plate`, 3 `copper_coil`, circuit, 4 `iron_plate`). Fine. Sprint > tractor is good: it is a work vehicle |
| Vacuum (`vacuum_collector`, Hand Vacuum Pump) | no fuel; workshop collector radius 4, hand pump 9 blocks; planned air 30 L/s | stress 3 | No new cost needed. The Hand Vacuum Pump recipe (4 `bronze_plate`, 2 leather, bellows, 2 `copper_plate`) ~ 140 expert-s: **fine for Bronze** |
| Tool wear (1 per block) | flint 64, bronze 192, iron 384, steel 768, `power_drill` 3000 | replace cost / block: flint 0.30 s (11% of mine time), bronze 0.25 (13%), iron 0.06 (5%), steel 0.05 (5%) | Healthy. Bronze Bronze->Forge needs ~500 blocks = 2.6 pickaxes (~8 ingots, 5% of the bill). Hammer 120/400, mould pours limited: keep |

### 3.8 Hunger and buffs

Constants: day 900 s; food 20 max; base drain 1/60 per s; sprint x2.5; per block mined 0.03; per jump 0.03; regen needs >= 12 food at 0.25 per hit point; Well-Fed 360 s (x2 regen, x0.5 drain).
Need per player-hour (baseline + 800 blocks/age mined + 30% sprint): **~90 hunger/h**: 7.5 `hearth_stew` or 15 `bread`.

| Food | Hunger | Raw labour (expert s) | Hunger per attended s | Note |
|---|---|---|---|---|
| `bread` (2 flour = 2 wheat) | 6 | ~7 | ~0.9 | baseline |
| `cooked_mutton` / `cooked_chop` | 7 / 8 | ~13 | ~0.6 | + Well-Fed none |
| `hearth_stew` | **12 + Well-Fed 360 s** | ~19 | 0.6 + buff | exactly additive (8+1+3): no free hunger, buff is the reward |
| `sugar_cookie` x4 (1 flour + 1 sugar) | **12 (3 each)** | ~4.5 | **~2.7** | **3x the best staple, plus Sugar Rush** - the dominant food |
| `sweet_bun` / `sugar_cake` | 6 / 9 | | | fine |

**Cookie fix:** yield 4 -> 3 and `sugar_cookie` hunger 3 -> 2 (6 per batch = 1.3/s, 1.5x bread), or keep 4 cookies of hunger 2 (8 per batch).

**Buff stacking (verified in `game/buffs.ts` and `core/constants.ts`):**

| Effect | Sources | Max stack | Number |
|---|---|---|---|
| Walk/sprint speed | Swift 1.20 x Sugar Rush 1.12 | x1.344 | sprint 5.8 -> 7.8 b/s |
| Mining speed | Vigor 1.25 x Well-Warmed 1.25 | x1.56 | multiplies the tool speed |
| Food drain | Well-Fed 0.5 x Lasting 0.5 | **x0.25** | one stew = 48 minutes idle; Lasting + Stew **removes hunger as a pressure** |
| Regen | Well-Fed 2 x Mending 2 | x4 | |
| Warmth drain | Hearthkept 0.5 | x0.5 | |
| Jump | Spring 1.35 | | |

Sugar Rush: 1.12 speed, `SUGAR_WELL_FED_BURN_MULT 2.5` (a 360 s stew lasts 144 s), buff time max-merges (not additive), 45/90/150/240 s for sugar/cookie/bun/cake.
Trade-off is real only when the player holds Well-Fed: +12% speed vs 60% of the stew wasted. Players without a stew pay nothing, so **sugar rush is free speed for the sugar chain**.
Rules: (1) cap the *product* of drain multipliers at 0.4 (raise Lasting to 0.7 or Well-Fed to 0.6); (2) Sugar Rush also raises hunger drain x1.25 while active (so the cost applies when not Well-Fed), (3) keep one tea and one coffee at a time (already), (4) `speedMult` <= 1.4 total, `miningMult` <= 1.6 incl. Well-Warmed, asserted by tests T8.

---

## 4. Concrete value changes (summary of every number proposed)

| Id | Change | From -> To |
|---|---|---|
| plasma_casing shell | casings in the Current -> Atomic gate | 53 -> 24 |
| star_casing recipe | drop `magnet_ring` input; keep `2 superalloy, 1 fused_quartz -> 2` | 1 ring per 2 casings -> 0 |
| Star gate | casings; `star_core` rings; deuterium | 93 -> 30; 6 -> 3; 8 -> 4 |
| steam engine (plan) | shaft capacity per bar | 128 SU -> **5 SU** (cap 30 at 6 bar) |
| kinetics `solveNetwork` | part stress vs rpm | `base x clamp(16/rpm,.25,4)` -> `base x \|rpm\|/16` |
| GENERATOR_SHAFT | electric output when shaft used | full -> `rated - 50 x SU` |
| treadwheel | SU | 24 -> 12 (+ AFK stop) |
| clockwork motor | SU | 48 -> 24 |
| coke | energy | 1,200 -> 1,000 kJ |
| CINDER_BURN_S | fire s per vial | 90 -> 45 |
| wind / solar | share radius | none -> 12 / 6 |
| low wines / spirit / rectify | wash:1, low:1, spirit:1 | 16/8/4 -> 8/4/2 |
| ethanol grades | saw / tractor | 0.25/0.2 -> 0.5/0.4 |
| DRINK_BUFF_S | | 180 -> 300 |
| sugar_cookie | yield x hunger | 4 x 3 -> 3 x 2 |
| mech_millstone, mech_loom | add bronze plates | 10 s / 16 s -> ~60 s |
| food-drain product | Well-Fed x Lasting | 0.25 -> >= 0.4 |
| tin | one guaranteed 5-block vein within 48 blocks of spawn | new |

---

## 5. Balance test plan (automated, to be added by the builders)

Put the model in `src/content/timeModel.ts` (pure, imports `RECIPES`, `ORE_VEINS`, `BLOCKS`, `FURNACE_TIERS`, `MACHINES`; parameters in one exported `TIME_PARAMS`), so tests do not depend on a snapshot. Every threshold below is a **band, not a point**, so content tweaks do not churn tests.

| Id | Test | Implementation | Acceptance threshold |
|---|---|---|---|
| T1 | **Time-to-next-age** per age bundle | `expertMinutes(bundle)` via the cost fixed point; bundles are `FURNACE_TIERS[i].upgradeCost` + `hearthMaterials(i)` + a named kit list in content | Ember 8-18; Bronze 28-42; Forge 20-32; Current 24-36; Atomic 28-48 (bundle = kit + gate); each age <= 2.5x the previous and >= 0.6x; total <= 190 expert min |
| T1b | **Ore bill sanity** | sum raw ore of each bundle | no age needs > 120 ore blocks of one kind; tin >= 25% of copper count in Ember/Bronze |
| T1c | **Gate has no wait > 8 min** | sum of crop/tap/tanning/dry waits on the critical path | <= 480 s without a hand alternative |
| T2a | **Energy conversion cycles are lossy** | table `CONVERSIONS: [from, to, efficiency][]` in `core/constants.ts`; find cycles with DFS | product of any cycle <= 0.6 (fails today only if L2/L3 stay) |
| T2b | **No recipe returns more energy than it costs** | for every recipe, `energy(outputs)` (fuel items' `energyJ`) vs `energy(inputs)` + `energyJ` of the machine | ratio <= 1.0 with whitelist `{charcoal: 2.0, coke: 1.5}`; distillery items must have no `fuel` |
| T2c | **Ignition feasible** | storage capacity / max discharge of `lithium_bank` | >= 27 MJ / 0.9 and discharge >= 300 kW |
| T3 | **Gearing conserves work** | for rpm in {4, 8, 16, 32, 64, 96, 144}: `throughput = rpm/16`, `stress(part)` from `solveNetwork` | `stress / throughput` constant within 1%; i.e. `workPerSU(144 rpm) <= 1.01 x workPerSU(16 rpm)` |
| T4 | **Generators do not double-dip** | water wheel at 2 water blocks with and without a shaft load | `electricW + 50 x shaftSU <= ratedW` |
| T5 | **Boiler energy** (when built) | sim a 6 kW heat port into the engine | `shaftSU x 50 W <= 0.30 x heatW`, within 5% of `5 SU/bar` |
| T6 | **Crafting value invariants** | `cost(output) >= 0.5 x sum(cost(inputs)/outCount)` and `<= 3x` | no `output` cheaper than half its inputs; flagged list (crusher x2, mortar x1.35, `sugar` 3 from 2) is an explicit whitelist |
| T7 | **Food economy** | hunger per attended second from the cost model | no food > 2.0x `bread`; `sugar_cookie` <= 1.6x; starvation sim: a bot eating `bread` only keeps food >= 6 for 60 min with <= 25% of attended time spent on food |
| T8 | **Buff stacking bounds** | instantiate `PlayerBuffs` with every buff active | `speedMult <= 1.4`, `miningMult x wellWarmed <= 1.6`, `foodDrain x wellFed >= 0.4`, `regenMult <= 4` |
| T9 | **Distillery yields** | compute sap and vessel-s per `fuel_ethanol_beaker` from `recipesDistill.ts` | sap <= 60, vessel-s <= 5,000; ethanol worth: `sapCost x tap time` <= 40 x oil route |
| T9b | **Arcane cost vs physical route** | `sum(units) x DRAW_RECOVER_S` vs `expertSeconds(route)` | <= 0.7 |
| T10 | **Machine payback** | `buildCost / (handSecondsPerOp + 2)` for every `MECH_TWINS` | 8-60 ops; `machineSecondsPerOp(16 rpm) >= handSecondsPerOp` |
| T11 | **Tool wear economics** | `replaceCost / (durability x mineTime)` per tool set | <= 0.15 |
| T12 | **Power budget per age** | `sum(sourceRatedW)` of that age's goal kit vs `sum(consumerDrawW)` of its machines | headroom 1.0-3.0x (Forge ~1.3, Current ~1.5, Atomic **< 1.2 by design**) |
| T13 | **Furnace upkeep** | lit-day fuel items x gather seconds / 900 | <= 10% |
| T14 | **Spawn fairness** | for 20 seeds, distance to nearest tin, copper, coal, clay, water, pine | tin <= 48 blocks, coal <= 64, clay <= 32, pine log <= 40 |
| T15 | **Solver-time regression** | extend `playthrough.test.ts` to log the cost-model minutes at each objective | assert monotone, no objective > 12 minutes after its predecessor |

Process: add T1-T4 and T8 first (cheap, pure, cover the two loops that matter most: L1, L3); the rest follow the code they test (T5 after the boiler exists, T9 after the distillery rebalance).
**After the first real playthrough, replace the `x2.0` expert-to-player factor with the measured ratio** and rerun T1; that one number decides every band.

---

## 6. Open items and honest caveats

- Not measured: nothing ran. The model has no mob fights, nights, deaths, inventory trips, crafting UI time beyond a flat 2 s, or learning curve (factor 2.0 is a guess).
- The Bronze bundle uses the plan's own numbers, including "30 plates + ports"; some recipe ids (`bronze_gearbox`, `flywheel`, `steam_engine_b`) are assumptions where the plan says only "gearbox".
- Hearth shell material counts were taken from the committed `hearthMaterials()`; the six-age refactor may change them. T1 reads them live so it self-corrects.
- Oil pool regeneration, battery capacity/discharge limits and crop yield per plot were not read; T2c and T14 cover them.
- The Forge -> Current dynamo (shaft -> electricity) does not exist yet: price it with `ETA_DYNAMO 0.9` and `W_PER_SU 50` (a 2 kW dynamo needs 44 SU: one steam engine, i.e. two boiler ports).

<!-- ======================== END docs/advice/balance-economy.md ======================== -->


---

<!-- ======================= BEGIN docs/advice/engineering-risk.md ======================= -->
# FILE: docs/advice/engineering-risk.md

# Engineering-risk dossier - performance, saves, tests, merge safety, architecture debt

Author: engineering-risk advisor (read-only analysis, 2026-11-21). Evidence: `git log --stat`, reading `src/save`, `src/app`, `src/sim`,
`src/workshop`, `src/magic`, `src/game/groundItems.ts`, `scripts/`, `docs/{SPEC,CONGRUENCE,LOCAL_HANDOFF,team}.md`. Nothing was built or run.
Numbers marked **(measured)** come from a test or file in the repo; **(estimate)** are my reading of the code and must be confirmed by the
probes in section 1.5 before they are treated as fact.

## 0. The ten findings that matter most

1. **Voxel ids are positional and persisted** (`BLOCK_SPECS` order = id; edits store raw uint16 voxels, 10-bit id, 220 of 1024 used **(measured)**).
   Today "append only, last" is a convention. Seven parallel lanes each appending to `blocks.ts` will produce different ids per branch and a
   silent world scramble for any save made on one branch and opened on another. Fix: an id lock file (section 4, R1).
2. **Unknown item keys are silently deleted on load** (`sim/sanitize.ts cleanSlot` returns `null` for an item the registry does not know).
   The six-age refactor and every later rename or removal erases items from crates, furnaces and (probably) inventories without a message.
   Fix: alias table + a fixture test that every key found in any golden save resolves (section 2.4).
3. **Workshop, Magic and Vehicles persist only when the browser `Game` class exists** (`app/game.ts` lines 128-186: `world.persist(...)` is
   registered in `Game`, not `GameState`). Headless `GameState.restore` (the playthrough solver, `oldSave.test.ts`) never exercises them; they pass
   through as raw `extras`. A module whose `load()` throws or loads empty is then **overwritten by its empty state on the next autosave**
   (`world.toJSON` spreads `loadedExtras`, then savers override). Fix: wrap + keep a `.bad` copy + move the modules into `GameState` (R3).
4. **`SAVE_VERSION = 1` and `migrateSave()` returns `null`.** Any envelope with another version is "unusable, held, backed up". The refactor is
   id-stable, but it renumbers stored integers (furnace `tier`, `objectives.age`, `peaks.tier`, hearth tier). Do not bump the envelope; add an
   additive `WorldSave.rev` and a migration chain keyed on it (section 2.3). Must land **before** any lane builder starts.
5. **Workshop `solve()` re-runs a full flood-fill, `Map`/`Set` allocation and string-key generation for every part, every tick**
   (`workshop.ts:277-345`, keys are `"x,y,z"` strings, `neighbours()` builds 6+ strings per part). At 200 parts that is ~1,500 short strings per
   tick, 30k/s **(estimate)**: a GC-stutter generator on a phone. Same family: `logistics.intakeGround` allocates a key per ground item per tick,
   `contraption.tick` copies `[...acts.values()]` per tick, `jarsFor` scans (2r+1)^3 cells per consumer per second.
6. **Timing assertions live inside the unit suite** (`perf.test`, `hearthPerf`, `transportPerf`, `hostileWorld`, `persistence`, `fingerprint`,
   `textures`: `< 1 ms`, `< 1.5 ms`, `< 3 ms`, `< 200 ms`, `< 1500 ms`). Their own comments say "wider under the parallel suite". With 5-7 lanes
   each running `vitest` on 12 threads they will flake. Move them to a serial perf project; keep deterministic call-count budgets in the main one.
7. **e2e "mutex" is a folder lock for one shared checkout.** With git worktrees most of it is already unnecessary (scripts resolve `root` from
   their own path, `serve(0)` takes an ephemeral port). What still collides across worktrees: fixed `os.tmpdir()` build dirs
   (`hearthwatt-e2e-magic`, `-dev`, `-workshop`), `npm run dev` on 5173, the machine's 12 threads / 16 GB, and Playwright living only as an
   untracked `--no-save` install in `node_modules` (a junction + `npm install` in a lane would delete it).
8. **Shared registries and index files are the merge-conflict surface** (list in section 3.5). In the last 150 commits: `HANDOFF.md` 19,
   `app/game.ts` 14, `content/{progression,items,specRoster,recipes,content.test,objectives}.ts` 10-11 each, `core/{types,gameEvents}.ts` 10 each,
   `render/textures/painters.ts` 11, `package.json` 9, `sim/simulation.ts` 7. Folder-registration plus generated (not committed) indexes removes
   most of them (R1, R2).
9. **Line endings are not pinned**: `core.autocrlf=true`, no `.gitattributes`, and git prints "LF will be replaced by CRLF" on the refactor's
   working copy. Different lanes will round-trip files differently and produce whole-file diffs. Add `.gitattributes` (`* text=auto eol=lf`)
   in the integration merge of the refactor, once, with a renormalise commit.
10. **Content tests are a second typed copy of the content** (`specRoster*.ts`, 12 files, 1,148 lines, "a deliberate balance change has to be made
    here as well"). Every addition touches both. Replace by derived invariants plus one reviewed golden file (R2).

---------------------------------------------------------------------------------------------------------

## 1. Performance budget

### 1.1 Frame model and what the game already enforces

- Fixed 20 Hz simulation (`DT = 0.05`), at most 5 catch-up ticks per frame (`app/loop.ts MAX_CATCH_UP_TICKS`), frame `dt` clamped to 0.1 s.
  Order per tick (`app/game.ts tickOnce`): `state.tick` (sim, survival, objectives, mobs, ground items, clock) -> `magic.tick` -> `workshop.tick`
  (+ `verify()` every 200 ticks) -> `world.leaves.tick`. Then `world.update(..., STREAM_BUDGET_MS = 4)` then render.
- Phone defaults: render distance 4 chunks (`PHONE_RENDER_DISTANCE`, 81 chunks, voxels = 16x16x96 uint16 = 48 KB per chunk, ~4 MB), desktop 6
  (169 chunks, ~8 MB); the slider allows 12 (625 chunks, ~30 MB voxels alone) - the settings range is a perf risk on phones, cap it by device.
- The app already draws rarely when paused or when a window covers the view (`shouldDraw`, `STILL_REDRAW_MS`), and the autosave waits for a calm
  moment (`AUTOSAVE_INTERVAL_S 30`, grace 10).
- Existing measured budgets (desktop, node): 300 power-grid entities tick `< 1 ms` mean, block edit beside a machine `< 1 ms`, cable rebuild
  `< 5 ms` (`sim/perf.test.ts`); formed 5x5x5 hearth `< 0.05 ms` per tick, full 7x7x7 scan `< 1 ms` (`hearthPerf.test.ts`); 20 item networks x 200
  pipes x 48 packets `< 1.5 ms` (loosened from 0.5) and a 1000-pipe rebuild `< 15 ms` (loosened from 5) (`transportPerf.test.ts`); fingerprint of every
  item `< 200 ms`, texture generation `< 1.5 s` (cold start cost).

### 1.2 Budget table

"Phone factor": a mid phone (Snapdragon 7-class / A13-class) runs this single-threaded JS about **3-4x slower** than the owner's desktop node.
Budgets below are **desktop-node ms** per tick unless stated; the phone sim budget is therefore 20 ms/tick x (1/3.5) of ~50 ms period would be
overkill - the real target is: **total simulation <= 1.5 ms desktop per tick (~5 ms phone, 10% of a 50 ms tick)** at the "reference base" below,
and render CPU <= 6 ms phone per frame. Anything that scales with world size rather than with the player's base is forbidden (SPEC line 348).

Reference base (what a mid-game player has loaded): 6 hearths/furnaces, 40 machines, 300 power entities, 400 pipes with 100 packets, 10 distill
modules, 150 workshop parts (60 belts), 40 logistics cells, 20 essentia jars + 3 tubes nets, 2 tractors, 60 ground items, 30 animals, 120 signal cells.

| System | Existing cost / measured | Likely cost of the new work | Where it blows up | Budget (desktop ms/tick, reference base) |
|---|---|---|---|---|
| Power grid + machines + furnaces (`sim/nodes.ts`, `power.ts`) | 300 entities `< 1 ms` (measured) | steam boilers, bronze furnace, boiler/turbine pairs add machines and heat coupling | adding a per-tick `getBlock` neighbour scan to every machine (`prepare()` hooks), `everySecond` work moved into per-tick | 0.6 total; no machine may do world reads per tick unless its surroundings version changed |
| Hearth multiblock (`hearthScan`, `hearth.ts`) | scan 7x7x7 `< 1 ms`, formed `< 0.05 ms/tick` (measured) | six tiers: larger/more variants, Bronze "stands alone" | re-scanning on every block change anywhere (must stay shell-local: `shellChanged(min,max)`) | 0.05 per formed hearth, scan only on shell change |
| Transport pipes (`transport.ts`, `itemNet`, `fluidNet`) | 20 nets x 200 pipes x 48 packets `< 1.5 ms` (measured, 3x the original 0.5 goal) | steam and distillery liquids add a **fluid** layer on the same pipe graph; belts are a separate system (below) | rebuilding on every `setVoxel` of a non-pipe neighbour; per-packet allocation; steam condensation spawning fluids every tick | 0.5; rebuild <= 5 ms per 1000 pipes; packet objects pooled |
| Distillery (`sim/distill.ts` 460 lines, `distillScan.ts`) | no probe exists | module graph up to `MAX_MODULES 64`, `MAX_SEGMENTS 8`; liquids with mixes (`mix` objects) | `distill.touched()` re-solving the whole rig each tick; reaction table lookups creating objects; scan on every adjacent block edit | 0.3 with 10 rigs; solve only on `touched`; mix math allocation-free |
| Brewing / crops / hand stations | `crops.tick` per entity; hand stations timed | more crops (sugar), stations with timers | O(world) crop scans for rain/sun each tick (`wetAt`, `rainAt` called per entity) | 0.1 each; weather queries cached per chunk per second |
| **Workshop kinetics** (`workshop.ts solve/showActive/moveBelts/work`) | no probe; string keys; full `solve()` each tick (`MAX_NET 512` members per net) | contraptions, belts (`moveBelts`), clutches, flywheel coast re-solve (`run()` twice), signals | per part: `neighbours()` = 6 string builds + chain-range scan up to `LINK_RANGE`; 150 parts => ~1,500 allocs/tick; `solveNetwork` closures per net per tick | 0.3 at 150 parts, **<= 0.05 idle**; solve only when topology/source/lube/clutch state changed (dirty flag), numeric keys |
| **Logistics cells** (`logistics.ts`: funnel, chute, mixer, press, arm, deployer, drill, spout, saw, vacuum, tally) | no probe | belts-with-items, deployers calling `host.actHook`, vacuum collectors scanning radius | `intakeGround` loops **all** ground items every tick and builds a string key each (`k3`); `mover` does `take/accept` with `getBlock` per cell per `MOVE_S`; vacuum radius scans | 0.3 at 40 cells; intake only when a cell with `TAKES_GROUND` exists, spatial hash of items |
| **Contraptions** (`contraption.ts`: piston, bearing, skiff, rail) | no probe | structure flood-fill (cap 48 blocks) each step; `commit()` does clear + `setVoxel` for every block (`'sim'` source) | each `setVoxel` triggers re-light, re-mesh of its chunk and sim hooks: a 48-block piston step = up to 96 edits in one tick; `[...this.acts.values()]` copy per tick; moving entities relocate | one step <= 2 ms and <= 2 chunk remeshes; batch edits through one `world.batch()`; cap 3 acting contraptions per tick (stagger) |
| Signals (`signals.ts`) | `tick(clock)` each tick | wires, plates, metronome, lamps, bell, tally | wire propagation recomputed every tick; per-plate player-position checks | 0.05; propagate on change only |
| **Essentia / aura** (`magic/`) | `tick` trivial; 1 Hz `tickServants` + `tickSiphon`; `draws` map per chunk; `essentiaNet` capped at `MAX_TUBES 256` | aura drawn by machines and rods, wellsprings, infusion, jars as consumers | `jarsFor(blockAt, x,y,z, radius)` scans (2r+1)^3 `getBlock` per consumer per call: r = 6 => 2,197 reads x N consumers per second; `nodesAround` sorting per frame for rendering | 0.2 per **second-tick**; cache jar sets per consumer, invalidate by block-change events inside the region |
| **Ground items** (`game/groundItems.ts`) | `MAX_GROUND_ITEMS 256`, despawn 300 s, merge every 0.5 s; each item `physics()` per tick: `isLoaded`, `getBlock`, `solidAt` (up to 8 more) | belts and logistics drop/pick items continuously; vehicles/tractors harvest; vacuum | 256 items x ~3-12 `getBlock` per tick = 800-3,000 reads per tick **(estimate)**; item renderer instance updates per frame | 0.25 at 60 items, 0.6 at 256; **resting items sleep** until a block change in their column/neighbours |
| Vehicles (`vehicles/manager.ts`, `tractor.ts`) | sub-steps `MAX_STEP_S 0.025` (2/tick) with `collide.ts` box sweeps | tractors with PTO, skiffs on rails, riding | collision sweeps against many chunk reads; PTO scan `findPto()` in `workshop.tick` **every tick** over tractors | 0.3 per occupied vehicle, 0.02 per parked one (sleep when still) |
| Mobs / Emberbound (`mobs/manager.ts`) | caps `MOB_STORED_CAP`, `HOSTILE_CAP`; `hostileWorld` probe `< 3 ms` | larger ruins, more automatons | spawn planning per chunk load; pathing | 0.4 |
| Weather, survival, clock, objectives | small | objectives get many more conditions | objective checks scanning inventories each tick | 0.1 total; evaluate on events, not per tick |
| World streaming | `STREAM_BUDGET_MS 4` per frame (main) + worker meshing | six ages add taller/odd shapes (pipes, cups, stations: `meshPipe/meshCup/meshStation/meshQuads`) | mesher cost per chunk with many special shapes (each shape = quads); light updates from `setVoxel` | 4 ms/frame stream budget stays hard; mesh job <= 8 ms desktop per chunk |
| Autosave (`app.ts`) | `JSON.stringify` of the whole world on the main thread every 30 s | + workshop cells with item maps, pipes with packets, 256 ground items, signals | stringify of a 1-3 MB document = 30-120 ms phone hitch | <= 40 ms desktop / 150 ms phone, only when `calm`; see 2.6 |

### 1.3 Render and memory budgets (phone)

Renderer already exposes `stats` (`drawCalls`, `triangles`, `chunks`, `chunkTriangles`, `particles`, `effectSources`, `cpuMs`, `weatherMs`,
`machines`, `machinesMs`). No numeric budget is asserted anywhere. Proposed (confirm the baseline by probe first, then freeze with 25% headroom):

| Metric | Phone portrait (render distance 4) | Desktop (distance 6) |
|---|---|---|
| Draw calls | <= 350 | <= 700 |
| Triangles drawn | <= 350k | <= 1.2M |
| Render CPU (`stats.cpuMs`) | <= 6 ms | <= 3 ms |
| Particles + effect sources | <= 600 / 24 | <= 1500 / 48 |
| Workshop instances (`workshopRenderer MAX = 768`) | hard cap stays; overflow culls farthest | same |
| Cell light cells (`render/tech/cellLight.ts MAX_CELLS 6000`) | keep | keep |
| Atlas | `MAX_ATLAS_PAGES 2` (16x16 tiles) - new content must fit; textures cap `SPEC.maxTextures` | same |
| JS heap | <= 250 MB steady, no growth over 30 min idle | <= 600 MB |
| Per-tick garbage | **zero allocations in idle ticks** of Workshop, Logistics, Signals, Contraptions, Magic, ground items (probe 1.5-D) | same |
| Entity/part caps | block entities 1,500; workshop parts 400; logistics cells 150; pipes 1,500; ground items 256 (exists); mobs per existing caps; essentia tubes 256 (exists) | x2 |

Policy when a cap is hit: refuse the placement with a toast (never silently drop and never throw), and `diag('<sys>.cap', {...})`.

### 1.4 Where scans and per-tick loops will blow up (ordered by expected damage)

1. `workshop.solve()` (every tick, all parts, string keys, closures) - make it dirty-driven. Mark dirty on: part added/removed (`noteBlock`/`verify`),
   lube/crank/wound state change, source output change (`generatorWatts` is polled; sample it at 4 Hz and compare), clutch flip from signals,
   flywheel coast transitions. Otherwise reuse `speed/netOf`.
2. Item-handling loops that walk all ground items per cell type (`intakeGround`, vacuum, deployer). Replace with: build once per tick a
   `Map<number,GroundItem[]>` only if any intake cell exists; or let the cell query `ground.near(x,y,z,r)` backed by a 2 m spatial hash that
   `groundItems` maintains incrementally.
3. `setVoxel` fan-out from contraptions and bearings (re-mesh and re-light per block). Add a `world.batch(fn)` that defers light/mesh/hook work
   to once per affected chunk; if one already exists (`host.hold()` is used by `contraption.commit`), put a counter in it and a test.
4. Essentia `jarsFor`: radius cube scan. Precompute per consumer, cache by `(x,y,z,radius)` with a version stamp from `world.blockVersion(chunk)`
   or the existing `block:changed` events; invalidate on events inside the cube only.
5. `groundItems.physics` for resting items. Items with `onGround && vx=vy=vz=0` should skip everything until a `block:changed` event touches their
   cell column (subscribe once, keep a Set of sleeping ids) - 256 items then cost almost nothing.
6. Anything that iterates `world` entity map to answer "is there a X near me" (`Survival` heat sources iterates block entities; `SafeZones` is
   already version-cached - copy that pattern).
7. Per-frame work in renderers that re-derive views: `magic.nodesAround(...)` (sorts) and `workshop.view(pp.x,pp.z)` are called every drawn frame
   from `game.ts frame()`; give them a `version` and rebuild only when it changes or the player moved a block.
8. `Simulation.tick` calling `allNetworks()` for HUD stats: it is cached by `statsTick`, keep it that way for any new aggregate (aura totals,
   rpm totals, steam totals).

### 1.5 Probes and tests the builders add

**A. Subsystem profiler (always-on, ~free).** `src/app/prof.ts`: `prof.run('workshop.solve', () => ...)` records an EMA and a max per name with two
`performance.now()` calls; `Simulation.tick` and `Game.tickOnce` wrap each subsystem. Exposed as `window.__hw.prof()` -> `{name: {emaMs, maxMs, calls}}`.
Cost: ~0.01 ms per tick for 15 subsystems. Off in the node tests (injectable clock) so tests stay deterministic.

**B. `scripts/perf-budget.json`** - the one source of numbers: `{ "sim.total": 1.5, "workshop.solve": 0.3, ... , "render.drawCalls.phone": 350 }`. Read by the
perf test project and by the e2e perf step. A lane that needs more edits this file in its own PR with a reason.

**C. Deterministic budgets in the normal suite (no wall clock).** A `CountingWorld` wrapper (`src/sim/testKit.ts`) counts `getBlock/getVoxel/isLoaded/setVoxel`
and a `makeAllocProbe()` counts `Map.set`/`Set.add`/string keys via a tiny instrumented `k3`. Tests assert e.g. "150-part workshop idle tick: <= 0
setVoxel, <= 200 getBlock, 0 solve() runs after the first", "256 resting ground items: <= 10 getBlock per tick", "jar scan: <= 1 scan per consumer
per block change". These cannot flake.

**D. Serial perf project (wall clock, run under the cpu lock).** Files named `*.perf.test.ts`, excluded from the default `vitest.config.ts`, run by
`npm run test:perf` with `fileParallelism: false`, median of 5 batches, budget = `perf-budget.json` x 3 headroom in `--ci` and x 1 for the owner's
"is it fast" run; results written to `test-results/perf.json` so trends are visible. Move `perf.test.ts`, `hearthPerf.test.ts`, `transportPerf.test.ts`,
`hostileWorld` (timing case), `persistence` (timing case), `fingerprint` and `textures` timing assertions there. New perf files required:
`workshopPerf` (150 parts, 60 belts, 40 cells), `contraptionPerf` (one 48-block piston cycle: ms + number of chunk remeshes), `groundItemsPerf` (256 items awake
and asleep), `essentiaPerf` (20 jars, 10 consumers, radius 6, 1 Hz), `distillPerf` (10 rigs), `signalsPerf`, `savePerf` (2.6), `referenceBasePerf` (the whole
reference base through `Simulation` + `Workshop` + `Magic` + `GroundItems`, asserting the `sim.total` row).

**E. Browser probe (one e2e step, desktop and phonePortrait, `HW_GPU=1`).** Load a fixture world (the reference base saved as a golden save, 2.5), stand in
it for 600 ticks, read `__hw.prof()` and `renderer.stats`, assert against `perf-budget.json`, print the table, fail on > budget. Phone portrait runs
with CPU throttling 4x (`CDP Emulation.setCPUThrottlingRate`) so the "mid phone" number is real. Also a 30-minute idle heap growth check is too slow
for CI; run 3 minutes with `performance.memory` sampled (Chromium only) and assert < 5 MB growth.

**F. Per-system `diag('<sys>.budget')`** when a tick exceeds its budget (rate limited to once per 5 s per system; section 3.4).

---------------------------------------------------------------------------------------------------------

## 2. Save and migration safety

### 2.1 What exists (all measured by reading `src/save`, `src/world/world.ts`, `src/app`)

| Key / field | Where | Version | Notes |
|---|---|---|---|
| `localStorage["hearthwatt.save"]` | `SaveSlot.store` | envelope `{"v":1,"t":ms,"d":SaveDocument}`, `SAVE_VERSION = 1` | one slot; `migrateSave` returns `null` (no old formats yet) |
| `"hearthwatt.save.bak"` | `BACKUP_KEY` | raw copy | written when the stored save is corrupt / newer / invalid; dropped first on quota |
| `"hearthwatt.settings"` | `SETTINGS_KEY` | `v:1` | written while a damaged world is "held" so settings are not lost |
| `SaveDocument` | `{settings, world: WorldSave \| null}` | - | `normalizeDocument`: settings always repaired, a world that fails `isWorldSave` is dropped to a backup, never the settings |
| `WorldSave` | seed, seedText, `world: WorldSnapshot`, player, clock, survival, objectives, playTimeS, optional `weather`, `mobs`, `mode` | no own version | optional keys = forward-compatible by absence |
| `WorldSnapshot` | `version: WORLD_SNAPSHOT_VERSION = 1`, seed, `edits` (per chunk base64 uint16 pairs), `entities[]` (live block entities), `water`, `leaves`, `extras` | 1 (a newer one throws, caught -> held) | `extras` = free-form module data, unknown keys are preserved on re-save (good) |
| `extras.vehicles` / `extras.magic` / `extras.workshop` | `Game` (browser class) via `world.persist(key, fn)` / `world.extra(key)` | none | workshop snapshot nests `logi`, `sig`, `pist`, parts array; magic has research, notebook, jars, servants |
| Player: `inventory`, `buffs`, `stats`, `combat`, `ground` (ground items), `home`, `spawn` | `PlayerSnapshot` | none | `validPlayer` checks the shape; ground items load tolerant |
| Block entities in `world.entities` | furnace, machines, crates, crops, hand stations, brew, distill modules, pipes with packets | none; repaired by `sim/sanitize.ts sanitizeEntity` | per-field coercion, `dropped` for unknown kinds |
| Edits | block voxel values (10-bit id, facing 2, active 1, variant 3) | by position in `BLOCK_SPECS` | **append-only convention** |

Strengths worth keeping: SaveStore never throws, memory fallback, quota hook that frees the backup, "held" mode never overwrites an unreadable save until the
player starts a new world on purpose, structural validation (`isWorldSave`), sanitising of entities, unknown `extras` preserved, `oldSave.test.ts` with a real fixture.

### 2.2 Risks by system for the overhaul

| System | Persisted shape | Risk when streams land |
|---|---|---|
| Six-age refactor | furnace `tier` in entities and hearth `{tier, inner}`, `objectives.age/peaks.tier`, objective ids, `ageMap` | integers renumber (5 tiers -> 6); entity tier is re-derived from the block (`sanitizeEntity(e, blockTier)`) but `objectives.age` and `peaks.tier` are not; completed-objective ids that disappear re-award `pendingRewards` or leave the tracker pointing at nothing |
| Workshop (parts, logi cells, signals, contraptions) | arrays of tuples `[x,y,z,kind,s]`, cell tuples `[x,y,z,kind,{items},fluid,filter,src,...]`, `pist` | **positional tuples**: adding a field in the middle shifts every later field silently; `verify()` drops entries whose block no longer matches (`logi` line 770, `workshop` line 782) - correct, but a renamed block kind erases the machine state |
| Essentia / aura | research (scanned, lore), notebook, jar contents, servants, draws | aspect keys come from `aspectTable.ts`; renaming an aspect or an item's fingerprint changes what a jar means; unknown aspect in a jar must be dropped to `void`, not crash |
| Distillery liquids | `mix` maps `{fluidKey: litres}` per module, `FluidKey` union in `core/types.ts` | a removed or renamed fluid key: `fluidOrNull` handles it in sanitize? Must be checked per new fluid (test) |
| Ground items | `player.ground` list (item, count, xyz, age) | unknown item -> should be dropped with a count in `diag`, currently the same silent deletion |
| Vehicles | tractors snapshot | vehicle kinds added; skiff and rails belong to contraptions - keep separate keys |
| Signals | wire/plate/lamp state in `sig` | signal state is derivable; **never trust a persisted level** - rebuild on load (clutches that start jammed) |
| Objectives | completed ids + flags + `peaks` | new objectives must default to "not done"; flags are strings, never remove one |

### 2.3 Migration strategy

**Rule set (write into `docs/api/integration.md` and enforce by test):**
1. **Never bump `SAVE_VERSION` for additive change.** Missing keys load as empty/default (already the convention).
2. **Block ids: append-only, enforced by the id lock** (R1). Item, fluid, aspect, objective, flag, research and recipe **keys are never renamed or deleted**; a
   rename adds an alias `OLD_KEYS: Record<string,string>` (one file, `src/content/aliases.ts`) consulted by `cleanSlot`, ground items, jars, objectives and edits
   decoding. A deletion maps to a replacement item or to `scrap_metal` plus a one-time toast ("N items from an old version were converted").
3. **Add `WorldSave.rev: number`** (optional, absent = 1). `rev` is the *content/format revision* of the world, independent of the envelope `v`. `GameState.restore`
   runs `MIGRATIONS[rev] ... MIGRATIONS[CURRENT-1]` in order on the parsed `WorldSave` before validation; each migration is a pure function
   `(save) => save` with a test and a golden pair (input fixture, expected output). `rev` is written on every save.
   - `rev 1 -> 2` (six-age refactor): map `objectives.age` (old index -> new index: Ember 0, Bronze 1, Forge 2, Current 3, Atomic 4, Star 5; old 1..4 become 2..5),
     `peaks.tier` (+1 for tiers >= 2), hearth/furnace `tier` (re-derived from block id; assert agreement), keep completed ids, and recompute
     `pendingRewards` so no reward is granted twice. If the refactor already made the tracker tolerant of old data, the migration may be a no-op beyond setting `rev`; the
     point is the hook and the test exist.
4. **Per-extra versions**: every `extras.<key>` object carries `{v: n, ...}`; each module's `load(raw)` reads `v` (absent = 1) and upgrades itself. Replace positional
   tuples with objects in any **new** write path (`{x,y,z,kind,s}`) or append fields only at the end with a length check; document the tuple layout in a `// layout v2` comment
   next to `toJSON`.
5. **Loading is fail-soft per module.** `Game`/`GameState` use one helper `loadExtra(key, fn)`: try, on failure `diag('save.extra_bad', {key, err})`, keep the raw value
   in a side table and write it back unchanged under `extras["<key>.bad"]` (and **skip overwriting `<key>` with empty state** until the player acts) - fixes finding 3.
6. **Fail loud only for the envelope**: unreadable -> held + backup (already so). Add: a save with a *newer* `rev` than the build opens read-only held with the existing message.
7. **Round-trip idempotence**: `toSave(restore(x))` re-serialised twice must be byte-identical (catches Maps iterated in insertion order vs sorted, floats, NaN).

### 2.4 Fixtures to keep (all under `tests/fixtures/saves/`, one manifest)

- `save-before-bronze.json` (exists; v1, formed Blast hearth, Ember done). **Immutable forever.**
- `save-sixage-rev2.json` generated right after the refactor merges (formed Bronze and Blast furnaces, objectives mid-Bronze).
- One golden save per stream wave, added by the stream that introduced persisted state: `workshop-contraptions`, `distillery-liquids`, `magic-essentia`, `ground-and-vehicles`,
  `signals`, `reference-base` (the perf fixture). Each is produced by `scripts/make-fixture-save.mjs <name>` (drives `GameState` + modules headless, so it is reproducible)
  and committed with its expected summary JSON (counts of items, entities, parts, cells, research).
- `saves.test.ts` (single, parametrised over the manifest): loads without `lastProblem`, 200 ticks without throw, round-trip idempotent, every item/block key in the
  file resolves through `aliases`, summary equals the golden summary. Adding a stream adds a manifest row, not a test file.
- `corruption.test.ts` (fuzz, seeded): truncate the JSON at 20 random points; flip a type in each `extras` key and in 30 random leaf fields; unknown kind in `entities`;
  NaN/Infinity; a 5 MB blob; a newer `rev`; storage that throws on `setItem`; quota error with and without a backup present. Expect: never throws, settings survive,
  `lastProblem` set where the world is lost, the original text is still retrievable from `.bak`.
- `blockIds.test.ts` (R1): the committed id lock is a prefix of the current block table.

### 2.5 Corruption handling gaps to close

- Silent item loss (finding 2): sanitize reports `dropped/repaired` but the player is told nothing for slots; count and `toast` once, `diag('save.repaired', {...})`.
- `loadedExtras` overwrite after failed load (finding 3).
- `world.extra()` JSON-clones on each call (fine) but `Game` calls `load` without a try/catch around the three module loads; one throwing `load` aborts the Game constructor
  and the player returns to the title with the save untouched (safe but unplayable). Use `loadExtra`.
- Atomicity: `localStorage.setItem` is atomic per key, so a crash mid-write is not a risk; but the **old text is lost on every successful write** - there is exactly one
  generation. Keep a rolling `hearthwatt.save.prev` (previous autosave, written only when the new one parsed and is >= 10 minutes newer), dropped first on quota. This
  turns every future migration bug into a recoverable one.
- Multi-tab: two tabs overwrite each other's world. Add a `storage` event listener: if the save key changes while a game is running, pause and show "this world was changed
  in another tab" instead of overwriting (cheap; localStorage events fire only in the other tab).

### 2.6 Autosave and size budget

Current: whole world re-stringified on the main thread every 30 s (+ up to 10 s grace for a calm moment, saved on `visibilitychange` hidden and `pagehide`), one key, ~4 KB for the
fixture, unknown for a late game. localStorage quota is ~5 MB of UTF-16 text on Chromium/Safari (varies), shared with `.bak`.

| Quantity | Soft budget | Hard budget | Action at hard budget |
|---|---|---|---|
| Serialised world text | 1.5 MB | 3 MB | toast "save is large"; stop writing `.prev`; offer IndexedDB path (below) |
| Stringify + write time (desktop / phone) | 40 ms / 150 ms | 100 ms / 400 ms | `diag('save.slow')`; autosave interval 30 -> 60 s |
| `edits` | <= 600 KB | 1.5 MB | existing base64 pairs are 5.3 chars per edit; cap not needed before 100k edits |
| Entities | <= 400 KB | 1 MB | compact `JSON` of pipes (packets are saved: consider dropping packet positions, they re-spawn) |
| Workshop + logistics + signals + contraption | <= 150 KB | 400 KB | belts' in-transit items re-derive; do not persist per-tick scratch |
| Ground items | <= 40 KB (256 max) | 80 KB | already capped |

Plan: `savePerf.test.ts` builds the reference base plus a "heavy" base (10x edits, 500 entities, 400 workshop parts, 1,500 pipes with packets), asserts chars and
stringify ms against the table, and prints the breakdown per top-level key (so a lane that bloats a key is named). `app.ts` already emits `chars` in its diag line; add the per-key
breakdown behind `HW_DIAG`. If the hard budget is ever hit the fallback is moving the world to IndexedDB with the same envelope (the `SaveStore` interface is already
storage-agnostic via `StorageLike`; IndexedDB needs an async adapter, hence do it only if the budget is exceeded).

---------------------------------------------------------------------------------------------------------

## 3. Test strategy

### 3.1 Inventory and judgement (173 test files, ~1,950 tests at the last note, 318 commits)

| Group | Verdict |
|---|---|
| `content/*.test.ts` + `specRoster*.ts` (typed second copy of content) | **Redundant and noisy.** Replace by derived invariants + one reviewed golden (R2). Keep invariants: every item has a texture and an icon, every recipe reachable (the solver), ages consistent, fuel ladders monotonic, station recipes share ratios (`furnaceRecipes/RECIPES > 0.6`). |
| `sim/playthrough.test.ts` (877 lines, solver completes the game) | **Keep, the most valuable integration test.** Make it area-pluggable (each stream contributes a "milestone" function) and run it headless including Workshop/Magic/Vehicles after R3. |
| Timing tests (see finding 6) | Move to serial perf project; keep deterministic counters in the main suite (1.5-C). |
| `audio/*.test.ts` (engine 410 lines, buffers) | Valuable but synthesised-audio statistics (`rms < 0.3`, roughness) are brittle to any tuning; keep structural checks, drop numeric tuning checks to the golden. |
| `render/textures/textures.test.ts` (alpha/edge/row-step assertions per texture) | Good guard, but `edge/inner` tuning checks fail on art changes; make the art rules a table of allowed exceptions in one file instead of per-test asserts. |
| `mobs/*` (behaviour/herd/hostile) | Many thresholds on gameplay constants (`gap < 2.2`, `windup < 0.5`); derive from the constants they test instead of literals. |
| `app/*.test.ts`, `save/*.test.ts` | Keep; add fixtures (2.4). |
| Tests using `Date.now`/`setTimeout`/`performance.now` (13 files) | Audit once: inject clocks; timing only in the perf project. |

Make the default `npm test` finish fast: `vitest run --changed <base>` (`related`) for builders, full run at the lane gate. Record each file's duration once (`vitest --reporter=json`)
and keep the slowest 10 visible; I could not run it here, so the total time is unmeasured - **builder task 0 for the test lane: measure and write the number in this doc.**

### 3.2 Stable e2e architecture

What exists and is good: `scripts/lib/*` (browser launcher with `HW_GPU`, `HW_DIAG`, `Driver`, `Reporter`, sandbox checks), `serve(0)` ephemeral ports, `--no-build`,
`--dist`, `--shots`, step skipping after a failure with a recent-events trail, JSONL diagnostics, `__hw` for setup only (real input for the thing under test).
What is wrong: 11 scripts each re-implement arg parsing, build-or-reuse, dist choice (`join(root,'dist')` in six of them, `tmpdir()/hearthwatt-e2e-*` fixed names in four),
screenshot dir wiping, device loops; `package.json` chains them with `&&` (stops at the first failure, no summary, no parallelism); 69 fixed waits
(`timeout`/`waitForTimeout`) in the libs; Playwright is an untracked `--no-save` install.

Target design (one builder, ~1 day):

1. `scripts/lib/runner.mjs`: `defineE2E({ name, devices, setup, steps })`. It owns args (`--no-build --dist= --shots= --device= --only=<step substring> --jobs=`), per-lane
   dir resolution, lock acquisition (3.3), build-once logic, screenshot dir, reporter, diag and exit code, and writes `test-results/<name>/result.json` (`{steps:[{name,ok,ms,error}]}`).
   Existing scripts shrink to their `steps`. Migrate one script per PR; no flag day.
2. **Per-lane dirs, derived from the worktree root, never fixed names**: `const cache = join(root, '.cache')`; build dir `.cache/dist-<name>` (or one shared `.cache/dist-e2e` built once per
   lane per commit hash); screenshots `test-results/` (already per worktree). Delete the `tmpdir()` names. `.gitignore`: `.cache`, `.locks`, `node_modules` (no slash, 3.7).
3. `scripts/e2e-all.mjs` replaces the `&&` chain: builds once to `.cache/dist-e2e`, runs the scripts as child processes with `--no-build --dist=.cache/dist-e2e`, **`--jobs=2`** at most (ephemeral
   ports, one Chromium each), runs all of them even after a failure, prints a table, exits 1 if any failed, supports `--only=workshop,distill` and `--affected` (maps changed paths to scripts:
   `src/workshop/** -> workshop`, `src/magic/** -> magic`, `src/sim/distill* -> distill`, anything under `src/core|app|render` -> full).
4. **Determinism**: all e2e start worlds from fixed seeds (`SEED` constants exist), set the clock and weather through `__hw` (`__hw.setTime`, `__hw.setWeather` - add if missing), advance
   with `__hw.runTicks(n)` instead of `waitForTimeout`; `waitFor(page, cond, label, {timeout})` for UI. Rule: a fixed wait is allowed only for CSS transitions and must be < 300 ms and commented.
   Every step that opens a screen asserts no `console.error` (the reporter already collects `errors`).
5. **Perf and golden-save steps** (1.5-E, 2.4) are normal steps in the same runner.
6. Playwright: add to `devDependencies` pinned (the SPEC says "no other dependencies" - treat dev tooling as exempt; owner decision) **or** keep `--no-save` but make the lane setup
   script verify `require.resolve('playwright')` and fail with the exact install command. Chromium binaries live in the user cache (`%LOCALAPPDATA%\ms-playwright`) and are shared by all worktrees.

### 3.3 Parallel lanes on one machine (12 threads, 16 GB RAM, RTX 3060): cheapest safe setup

Costs per process (estimates): `vitest` full run 4-8 workers x 300-500 MB; `tsc --noEmit` 0.7-1 GB; esbuild build ~0.3 GB for 2-4 s; headless Chromium with GPU ~0.7-1 GB each; `node_modules` is 110 MB
(`npm install` per worktree = wasted minutes, disk and network).

1. **Git worktrees under one parent** (`E:\Projects\hw-lanes\<lane>`), created by `scripts/lane-new.ps1 <lane>`: `git worktree add -b lane/<lane> ..\hw-lanes\<lane> integration`, then
   `New-Item -ItemType Junction -Path <wt>\node_modules -Target E:\Projects\game\node_modules`. **No `npm install` in lanes.** Dependencies change only on the main checkout, by the coordinator.
   - Safe teardown: `cmd /c rmdir <wt>\node_modules` (removes only the link) **before** `git worktree remove`; never `Remove-Item -Recurse` a worktree with a live junction.
   - `.gitignore` must read `node_modules` (no trailing slash), otherwise a junction/symlink is not ignored and `git status` shows it as a new file.
   - tsc/esbuild/vitest resolve `three` and `esbuild` through the junction to the shared tree: fine; they must not write into it (they do not; `tsc --incremental` goes to `.cache`).
2. **Ports**: lanes get `HW_LANE=<n>` (0-6). `serve(0)` stays ephemeral for e2e; `npm run dev` uses `5173 + HW_LANE` (patch `build.mjs` `serve(Number(process.env.HW_PORT ?? 5173 + lane))`).
3. **A counting semaphore replaces `.run-lock`** (`scripts/lib/lock.mjs`, no dependencies): `withSlot('e2e', 2, fn)`, `withSlot('cpu', 1, fn)`; each slot is a directory under
   `%TEMP%\hearthwatt-locks\<name>\<i>` created with `mkdir`, containing `owner.json {pid, worktree, since}`; a waiter polls every 2 s, treats a slot as stale when the pid is dead or since > 30 min,
   prints who holds it. Recommended slots: **cpu = 1** (full vitest, tsc full, perf project; these use all threads), **e2e = 2** (two Chromium + one build is ~3 GB), **build = 4** (cheap).
   Builders get "fast gate" without any lock: `vitest related`/`--changed`, `tsc --incremental`, targeted e2e (`--only`) under the e2e slot.
4. **Budgeted parallelism**: `vitest` runs with `--maxWorkers=${HW_VITEST_WORKERS:-4}`; at most 2 lanes in the cpu-heavy gate at once is already impossible with cpu=1, so lanes naturally
   interleave: the architect lane runs the full gate for a merge while builders run fast gates. The user's usage limit is the tighter constraint: **builders must not run the full e2e chain**; they
   run their own script (`npm run e2e:<area>`), the integration lane runs the whole chain once per merge.
5. **Disk**: `test-results/` was 55 MB in the main checkout; set screenshots to be written only for failed steps plus a tiny set of named "look at" shots (`--shots=all` opts in) and prune
   `test-results` older than 7 days in `lane-new`.
6. **One shared Chromium cache**, one `HW_GPU=1` GPU: two simultaneous headless GPU contexts are fine on a 3060; four are not (VRAM contention and slow frames make timing steps flake). Hence e2e = 2.

### 3.4 Diagnostics conventions

Existing: `src/app/diag.ts` ring buffer of 4,000 entries, enabled by `?diag=1`, `window.__HW_DIAG__`, `localStorage.hwDiag` (the harness sets it when `HW_DIAG=1`), payloads built lazily;
20 call sites, **only** in `app`, `state`, `save`, `frame`, `game`. `scripts/lib/diag.mjs` drains it to `test-results/diag/<run>.jsonl` with `node scripts/lib/diag.mjs summary`.
No simulation system emits anything, which is why e2e failures needed `HW_DIAG` archaeology.

Convention (add to `docs/api/integration.md`): tags are `<system>.<event>` in lower snake case, payload plain JSON, built lazily `diag('workshop.solve', () => ({...}))`; **never in a hot path
unless guarded by a rate limiter** (`diagEvery(tag, ms, fn)` in `diag.ts`). Required points every system emits:

| Tag | When | Payload |
|---|---|---|
| `<sys>.load` | module loaded from a save | `{ms, counts:{...}, repaired, dropped, v}` |
| `<sys>.save` | module serialised (only when diag on) | `{bytes, counts}` |
| `<sys>.rebuild` | a graph/solve was rebuilt (pipes, kinetics, distill rig, power net, essentia net) | `{reason, nodes, ms}` (reason = `block|source|clutch|load`) |
| `<sys>.cap` | a cap was hit and an action refused | `{cap, value}` |
| `<sys>.budget` | tick/rebuild exceeded `perf-budget.json`, rate limited 1 per 5 s | `{ms, budget, counts}` |
| `<sys>.refuse` | a player action was rejected with a toast | `{action, reason}` (the same string as the toast) |
| `<sys>.state` | on a **state change** (jam, brownout, overstress, boil, siphon, aura depleted), never per tick | the new state and the id/pos |
| `<sys>.error` | caught exception | `{where, message}`; also `console.error` so e2e's error collector sees it |

Systems: `power`, `hearth`, `transport`, `distill`, `brew`, `crops`, `hand`, `workshop`, `logi`, `contra`, `signals`, `magic`, `essentia`, `ground`, `vehicles`, `mobs`, `weather`, `save`,
`world` (chunk jobs), `render` (1 per 5 s: `stats` + `prof`). `__hw.prof()` and `__hw.state()` are the read side. e2e failure output already prints "recent events"; extend it to print the last
10 `diag` entries of the failing system's prefix.

### 3.5 Merging lanes in separate worktrees without conflicts

**Files every stream touches** (from the 150-commit churn and `CONGRUENCE.md` 4.5). Merge-conflict score = how often changed x how many lanes will add lines to the same hunk:

| File | Why it collides | Fix |
|---|---|---|
| `src/content/blocks.ts` (array spread list at the end), `items.ts` (`ITEM_SPECS = [...]` one long line), `recipes.ts` (`RECIPES` index), `progression.ts`, `objectives.ts` | every area adds an import and a spread; a single long line conflicts on any change | R1: per-area folder + generated index |
| `src/content/specRoster.ts` + `specRoster<Area>.ts`, `content.test.ts`, `worldContent.test.ts`, `food.test.ts` (counts) | double-entry fixtures and literal counts | R2 |
| `src/core/types.ts` (1,039 lines: `FluidKey`, `BlockSpec`, `MachineRole`, `ScreenRequest`), `core/gameEvents.ts` (`SfxName`, event map, `ScreenRequest`) | closed unions every system extends | R6: open string brands validated by registry tests; events typed per module |
| `src/core/registry.ts` (validators list, ~line 556-558) | each area adds a `validateX(...)` call | registry iterates `VALIDATORS` collected from the area folders |
| `src/app/game.ts` (14 commits/150), `src/app/state.ts`, `src/sim/simulation.ts` (7) | the wiring and tick order | R3 `SystemModule` registry + R5 subsystem list |
| `src/render/textures/painters.ts` (11), `textures.test.ts` (9), icons files | one painter table | painter registration by folder (`render/textures/areas/<area>.ts`), texture list derived |
| `src/audio/sfx.ts`, `sfx.test.ts` (expected names list) | closed list of names | names derived from `SFX` table; test checks table consistency instead of a literal |
| `src/magic/aspectTable.ts` (keyword rules / overrides) | every new item needs a rule | per-area `aspects.ts` merged; fallback by category already exists |
| `src/ui/screens/*` registration (`registerStationScreens`), `package.json` (e2e chain, 9 commits) | list edits | screens register by folder; `e2e-all.mjs` globs `scripts/e2e-*.mjs`, `package.json` gets one `e2e` script that never changes |
| `HANDOFF.md` (19 commits!), `docs/SESSION_CONTEXT.md`, `docs/SPEC.md`, `docs/WHATS_LEFT.md` | everybody appends status | lanes write `docs/lanes/<lane>.md` only; the coordinator merges summaries; `.gitattributes`: `HANDOFF.md merge=union` as a stopgap |
| `src/save/document.ts` | new top-level keys | none needed if modules use `extras` (rule 2.3-5); forbid new `WorldSave` fields without architect sign-off |
| `src/player/interaction.ts` (10), `src/game/playerState.ts`, `game/crafting.ts` | cross-cutting hooks (`beforeUse`) | a `useHandlers: UseHandler[]` chain registered by systems |

**Merge protocol**:
1. Branches: `integration` (trunk of the overhaul), `lane/<name>` per lane worktree. The coordinator/architect merges lanes into `integration` **one at a time** (queue by finishing order), `--no-ff`,
   after the lane rebased on the current `integration` and passed its gate; then re-runs the full gate on `integration` under the cpu lock. Nobody else touches `integration`.
2. Rebase small and often (daily at least): `git fetch`-free since worktrees share objects - `git rebase integration` inside the lane. A lane that has not rebased in a day gets merged by its architect only.
3. **Generated files are not merged**: `src/content/_generated/*.ts`, `src/render/textures/_generated.ts`, `scripts/e2e-all` manifest are produced by `scripts/gen-indexes.mjs` (R1) in `prebuild`,
   `pretest`, `pretypecheck`, gitignored. They cannot conflict.
4. **`.gitattributes`** (once, at the refactor merge): `* text=auto eol=lf`, `*.json -diff` for fixtures, `docs/lanes/*.md merge=union`, `tests/fixtures/saves/manifest.json merge=union`. Then `git add --renormalize .` in its own commit so no lane carries CRLF noise.
5. **Ownership by folder**: each lane owns `src/<area>/**`, `src/content/areas/<area>/**`, `src/render/<area>/**`, its docs and its e2e script. A change outside the owned folders goes through a **seam
   request** in `docs/lanes/<lane>.md` (not an edit) unless the file is in the "everybody" list and the edit is purely additive in a generated-index world (then nothing to edit at all).
6. **A pre-merge conflict probe**: `scripts/merge-probe.sh lane/a lane/b` runs `git merge-tree --write-tree` and lists conflicting paths; the architect runs it for all pairs of ready lanes before choosing
   the merge order. It costs seconds and no checkout.
7. Block ids across lanes: lock file rules (R1); at merge the lock is the only file that can legitimately conflict (`merge=union` and a regenerate step `npm run ids:sync` that re-sorts and fails if two lanes claimed the same id for different keys).

### 3.6 `scripts/local-check.sh` plan

Current: sequential typecheck, tests, build, optional `npm run e2e`, logs to `/tmp/hw-check-<name>.log`, prints one `ok`/`FAIL` per step plus the last 3 lines of the test log, no lock, no timing, no summary
file. Replace with (one builder, ~2 hours; keep the file name, add `scripts/lib/check.mjs` for Windows-safe logic since the user runs PowerShell and git-bash):

```
bash scripts/local-check.sh --fast              # tsc --incremental + vitest related (changed vs integration) + gen-indexes check        (no lock; seconds)
bash scripts/local-check.sh                     # tsc + full vitest + build + saves/corruption + layer check                              (cpu slot)
bash scripts/local-check.sh --perf              # + serial perf project                                                                    (cpu slot, alone)
bash scripts/local-check.sh --e2e[=a,b|affected]# + e2e-all with --jobs=2                                                                  (e2e slots)
bash scripts/local-check.sh --ci                # everything above, JSON to test-results/check.json, exit code, never prompts
```
Each step prints `ok|FAIL <name> <seconds>s`, the failing step prints its log path and the first failing test name; the end prints counts (`files`, `tests`, `skipped`), the lane name, the commit
hash, and writes `test-results/check.json`. `--ci` is what the coordinator runs and pastes (the team agreement already says "reports are leads, not evidence": the JSON is the evidence). Steps:
`gen-indexes --check` (generated indexes up to date), `typecheck`, `vitest` (default config, excludes `*.perf.test.ts`), `layers` (R8), `build` to `.cache/dist-check`, `saves` (part of vitest), `perf` (optional), `e2e` (optional).
Exit non-zero on any failure; on a lock wait, print the holder and keep waiting up to 15 minutes.

---------------------------------------------------------------------------------------------------------

## 4. Architecture debts, ordered by value (each sized for one builder)

Ordering logic: (value = conflicts prevented + bugs prevented) / effort. R1-R4 should land **before the lanes start** (they are what makes parallel work safe); R5-R9 can run inside lanes.

### R1. Area folders, generated indexes and a block-id lock (highest value)
- Files: new `scripts/gen-indexes.mjs`, `src/content/areas/<area>/{blocks,items,recipes,machines,fluids,objectives,roster,aspects}.ts` (move existing `blocksBrew.ts`, `itemsBrew.ts`, `recipesBrew.ts`, `machinesBrew.ts`... one
  area at a time, git mv), generated gitignored `src/content/_generated/{blocks,items,recipes,machines,fluids,objectives}.ts`, `src/content/blockIds.lock.json` (`{"air":0,"corestone":1,...}`), `blocks.ts`, `items.ts`, `recipes.ts`,
  `core/registry.ts`, `package.json` (`prebuild`, `pretest`, `pretypecheck`, `ids:sync`), `.gitignore`, `.gitattributes`.
- Mechanism: the generator globs each area folder (alphabetical, order irrelevant) and emits `export const BLOCKS_BY_AREA = {brew: BREW_BLOCKS, ...}` etc. Registry builds `BLOCK_SPECS` by **sorting by lock id**;
  keys missing from the lock get the next free ids in alphabetical key order **and** `gen-indexes --check` (CI) fails so the lane must run `ids:sync` (which appends them to the lock). Lock lines are one `"key": id` per line,
  `merge=union`; `ids:sync` fails on duplicate ids or a key changed id.
- Acceptance: (a) adding a new area folder with a block, an item, a recipe, a machine and an objective edits **zero** existing files and `npm run typecheck && npm test` pass; (b) `git merge-tree` of two lanes that
  each added an area reports no conflicts except `blockIds.lock.json`, which `ids:sync` resolves; (c) `blockIds.test.ts` fails if an existing key's id changes or a key disappears; (d) all current tests still green and the
  `save-before-bronze` fixture still loads with identical voxel decoding (assert a few known ids).
- Effort: 1 builder, ~1 day. Risk: moving files breaks blame; do it in one pure-move commit.

### R2. Replace the double-entry roster with invariants + a golden snapshot
- Files: `src/content/specRoster*.ts` (12 files, 1,148 lines), `content.test.ts`, `worldContent.test.ts`, `food.test.ts`, `techContent.test.ts`, `brewing.test.ts`, `emberbound.test.ts`; new `tests/golden/content.json` (key -> `{kind, age, tool, minTier, hardness, stack, power, ...}` for blocks/items/recipes/machines), `scripts/golden-update.mjs`, `npm run golden:update`.
- Mechanism: the golden is generated from the registry and reviewed in the diff like a lockfile; it **only fails when an existing entry changes or disappears** (additions are reported as "new: N" and
  pass, listed in the test output so the author sees them). Numbers the SPEC pins (the 68 original blocks, fuel ladder, tier table) stay as a tiny hand-written fixture (<150 lines).
- Acceptance: adding an item/block/recipe in an area folder needs **no test edit**; changing a balance number fails with a readable diff and passes after `golden:update`; deleting a key fails; test count literals
  (`toBe(60)`-style) gone (`rg "toHaveLength\([0-9]{2,}\)" src/content` empty).
- Effort: 1 builder, ~0.5-1 day (delete is the easy half).

### R3. `SystemModule` registry: one lifecycle and one persistence path for every system
- Files: `src/app/systems/system.ts` (interface `{ id, rev, create(ctx), tick?(dt), persist?(): unknown, load?(raw): void, dispose?(), views?() }`), `src/app/systems/{magic,workshop,vehicles}.ts` (moved out of
  `game.ts` lines 100-190), `src/app/state.ts` (hosts the **headless** parts of those systems), `app/game.ts` (renderers and UI only), `world/world.ts persist/extra` wrapper (`loadExtra`), `docs/api/integration.md`.
- Mechanism: `GameState` creates systems from `SYSTEMS` (generated list from folders `src/app/systems/*.ts`), ticks them in a declared order (`after: ['power']`), persists through
  `loadExtra`/`world.persist` (2.3 rules 4-5), and the browser `Game` only adds the render/UI halves via the same ids. Hooks that currently live in `game.ts` closures (`stokeFurnace`, `purifyFlask`, `crank`, `generatorWatts`, `standingOn`) become typed
  `SystemContext` queries to `sim` so they can be faked in node.
- Acceptance: `GameState.restore(save)` + 200 ticks with a workshop/magic/vehicles fixture works in node (new test `systemsHeadless.test.ts`); `game.ts` < 300 lines (from 525); damaged `extras.workshop` loads empty, the
  raw data is retained under `workshop.bad`, a toast is emitted once, and the next autosave does not delete it; playthrough solver gains a "build a belt and a piston" milestone.
- Effort: 1 builder, ~1-1.5 days. This unblocks 2.3 and persistence fixtures.

### R4. Save migration scaffolding and alias tables (small, urgent)
- Files: `src/save/document.ts` (`rev`, `MIGRATIONS`, keep envelope v1), new `src/save/migrations.ts`, `src/content/aliases.ts`, `src/sim/sanitize.ts` (`cleanSlot` -> alias + count lost), `game/groundItems.ts load`, `magic` jar load,
  `app/state.ts restore`, `tests/fixtures/saves/*`, `src/save/{saves,corruption,migrations}.test.ts`, `scripts/make-fixture-save.mjs`.
- Acceptance: all of 2.4 passes; renaming an item via `aliases` keeps it in crate, inventory, ground list and jar of `save-before-bronze`; the `rev 1 -> 2` migration test uses the real fixture and asserts `objectives.age`
  maps and no reward duplication; a removed item yields a toast and a `scrap` replacement, not silence.
- Effort: 1 builder, ~0.5 day for scaffolding, then each stream adds a row.
- **Sequencing**: the six-age session is running right now; ask it to add `rev` + the objectives mapping, or run R4 immediately after its merge and before any lane starts.

### R5. `Simulation` subsystem list with declared order and per-subsystem profiling
- Files: `src/sim/simulation.ts` (825 lines, 40 imports, a 60-line `tick`), new `src/sim/subsystems.ts`, `src/app/prof.ts`.
- Mechanism: `interface Subsystem { name; tick(dt, ctx); everySecond?(ctx) }`; `tick` becomes `for (const s of this.order) prof.run(s.name, () => s.tick(dt, ctx))`. Existing order stays byte-identical (hearths -> nodes.fresh -> prepare -> furnaces -> networks ->
  apply -> brewing -> distill -> applyFurnace -> transport -> crops -> hand). Workshop/Magic/Vehicles register here via R3.
- Acceptance: playthrough solver and all sim tests unchanged; `__hw.prof()` lists >= 12 subsystems; `perf.test` numbers within 10% of before; adding a subsystem needs no edit to `simulation.ts` beyond the list.
- Effort: 1 builder, ~0.5 day.

### R6. Split `core/types.ts` and open the closed unions
- Files: `src/core/types.ts` (1,039 lines, 85 exports) -> `types/{voxel,block,item,world,entity,fluid,screen}.ts` + barrel `types.ts` (re-exports, so no import churn); `core/gameEvents.ts` (event map and `SfxName`,
  `ScreenRequest`), `FluidKey`, `MachineRole`.
- Mechanism: unions that streams extend become `type FluidKey = string & {readonly __fluid: true}` branded strings validated by registry tests (as `fluidOrNull` already does), `SfxName` derived from the `SFX` table,
  `ScreenRequest` as `{type: string, ...}` with per-screen payload registered next to the screen. TS exhaustiveness is replaced by a registry test ("every screen type has a factory").
- Acceptance: a new fluid, sound and screen can be added in an area folder without editing `core/`; `tsc` clean; no behaviour change (the whole suite green); git blame preserved with `git mv`-style split in one commit.
- Effort: 1 builder, ~1 day (mechanical; avoid mixing with R3).

### R7. Workshop/logistics/ground-item performance refactor (the actual hot spots)
- Files: `src/workshop/{workshop,logistics,contraption,signals,kinetics}.ts`, `src/game/groundItems.ts`, `src/magic/{essentiaNet,magic}.ts`, shared `src/core/posKey.ts`.
- Mechanism: numeric packed keys (`((x+2^20)*2^21 + (z+2^20))*256 + y` as a double, `Map<number,...>`); dirty-flag `solve()`; ground-item spatial hash + sleeping; jar-scan cache; contraption `batch`; PTO scan at 4 Hz;
  `[...acts.values()]` -> index loop. Keep `k3` string keys **only** at the save boundary.
- Acceptance: the section 1.5-C counters (idle workshop tick: 0 solves, 0 allocations measured by the alloc probe; 256 resting items: <= 10 `getBlock`/tick; jar scan 1 per change) and 1.5-D wall-clock rows green; saves of the old fixture
  and `workshop-contraptions` golden still load byte-compatible (tuples unchanged); idle 3-minute heap growth < 5 MB in the browser probe.
- Effort: 1 builder per area (workshop solve + keys; ground items + logistics; essentia) = 3 small tasks, ~0.5 day each. Do after R1-R4, inside the workshop/ground/magic lanes.

### R8. Layer and cycle check as a test
- Files: new `scripts/check-layers.mjs` (esbuild `metafile` of `src/main.ts` and of each of `core`, `content`, `world`, `game`, `sim` entry barrels), `local-check.sh`, `docs/SPEC.md` layering text.
- Rules: `core, content, world(except workerPool), game, sim` import no DOM modules and nothing from `app, ui, render, player, audio`; `core` imports nothing from `content` except `registry.ts`; no import cycles
  among `src/**` (Tarjan on the metafile graph). Today the grep shows no violation of the DOM-free layering; `content/index.ts` and `content/progression.ts` import `core/registry`, which in turn imports the content - a cycle in waiting
  if `registry` ever imports `progression`. `workshop`, `magic`, `vehicles` are not in the SPEC layer list: assign them to "sim-side, DOM-free" (they already are; R3 needs it).
- Acceptance: the script runs in < 2 s, fails on a planted violation (test), and `local-check` prints the cycle path.
- Effort: 1 builder, ~2-3 hours.

### R9. e2e runner, lock and lane scripts (section 3.2-3.3)
- Files: `scripts/lib/{runner,lock}.mjs`, `scripts/e2e-all.mjs`, `scripts/lane-new.ps1`, `scripts/lane-rm.ps1`, `build.mjs` (port), `package.json`, `.gitignore`, `docs/team.md` (replace the `.run-lock` line), `docs/LOCAL_HANDOFF.md`.
- Acceptance: two worktrees run `e2e-all --only=workshop` simultaneously without touching each other's `dist`/tmp (assert distinct dirs and ports); a killed run's slot is reclaimed within 30 min or immediately if the pid is dead;
  `node scripts/e2e.mjs --no-build --dist=<dir>` works for all 11 scripts; `lane-new` creates a lane in < 10 s with no `npm install` and `npm run typecheck` passes there.
- Effort: 1 builder, ~1 day (migrate scripts incrementally).

### R10. Line endings and repository hygiene (30 minutes, but only the integrator may do it)
- Files: `.gitattributes`, `.gitignore` (`node_modules`, `dist`, `dist-codex`, `.cache`, `.locks`, `test-results`), one `git add --renormalize .` commit.
- Acceptance: `git status` clean after a fresh checkout on Windows; no "LF will be replaced" warnings; `git diff` of a one-line edit is one line.

### Other debts (not scheduled; watch list)
- `magic/magic.ts` 1,087 lines (research, scan, jars, servants, infusion, siphon, rods, nodes in one class) - split by sub-feature after R3.
- `workshop/workshop.ts` 793 + `logistics.ts` 773 - split `Workshop` into kinetics, belts, actuators once R7 stabilises the keys.
- `sim/playthrough.test.ts` 877 lines - area milestones as separate modules.
- `mobs/manager.ts` 499 and `vehicles/manager.ts` 480 - fine for now; revisit if the vehicle lane grows skiffs and PTO coupling.
- `game/survival.ts` heat-source scan iterating entities - cache per second with the `SafeZones` pattern.
- Tests that import the whole registry (most of them) pay content-load time per test file (~220 blocks, 372 items, 276 recipes, 49 machines today); if the suite gets slow use vitest `isolate: false` for pure files or a shared setup.
- Docs: `docs/api/*.md` is 48 files / 12k lines; the lanes' rule "one api doc per area" is right, but `integration.md` (376 lines) is a hotspot - give each area its own integration note.

---------------------------------------------------------------------------------------------------------

## 5. Recommended order of work (what the architect should schedule)

0. **Now (read-only, no conflict with the six-age session)**: nothing here needs `src/` until it finishes. Prepare R4's `rev`/alias/migration design and the `blockIds.lock.json` (can be generated from the **post-refactor** order in one command).
1. **Immediately after the six-age merge, before any lane starts** (one architect, serial, ~2-3 days total): R10 -> R4 -> R1 -> R2 -> R3 (R9's `lane-new` + junction can be written in parallel because it touches only `scripts/`).
2. **Lane start**: each lane worktree from `integration`, junction `node_modules`, `HW_LANE=n`, fast gate only; lane docs in `docs/lanes/<lane>.md`.
3. **Inside lanes**: R7 per area, R5, R6, R8, perf probes (1.5) as each lane adds its first persisted/ticking system - a lane's definition of done includes: perf row in `perf-budget.json`, golden save row, `<sys>.load/.rebuild/.state` diag
   points, one `*.perf.test.ts` or counter test, one e2e step.
4. **Integration lane**: merge queue, full `local-check --ci --perf --e2e`, solver green from a fresh world, adversarial review of anything touching `src/save`, `world.persist`, the id lock or `sim/simulation.ts` (the team agreement already requires it).

### Cheapest safe setup in one paragraph
One main checkout owns `node_modules` (110 MB, Playwright included) and the Chromium cache; every lane is `git worktree add` + a `node_modules` junction (no installs); each lane runs only its fast gate
(`tsc --incremental`, `vitest related`, `--only=<area>` e2e) with `HW_LANE`-based dev ports and per-worktree `.cache` build dirs; the heavy steps (full vitest, perf project, full e2e) go through a two-line
semaphore (cpu = 1, e2e = 2) so at most one full-thread job and two Chromium instances run at once (~4-5 GB peak of the 16 GB); the integration lane runs the full chain once per merge. This avoids per-lane
`npm install`, avoids the `dist/` and tmpdir collisions, and keeps timing tests meaningful.

## 6. Open questions for the owner / coordinator

1. Add `playwright` to `devDependencies` (pinned)? Today an `npm install` silently removes it. (Recommended yes.)
2. Cap the render-distance slider on phones (4-6) in `Settings`? The current max 12 is 625 chunks.
3. Accept `rev` + migration chain (vs. bumping `SAVE_VERSION` and writing `migrateSave`)? Recommended: `rev`, because an envelope bump makes every old save "unusable, held".
4. Is a rolling `hearthwatt.save.prev` acceptable (doubles stored size, but every migration bug becomes recoverable)? Recommended yes while the overhaul is in flight.
5. Approve `eol=lf` renormalisation commit on `integration` (touches every file once; must be done while no lane is open).

<!-- ======================== END docs/advice/engineering-risk.md ======================== -->


---

<!-- ======================= BEGIN docs/LOCAL_HANDOFF.md ======================= -->
# FILE: docs/LOCAL_HANDOFF.md

# Local handoff - continue Hearthwatt on your own machine

This file is for a Claude Code session running LOCALLY (on the owner's machine, attached to a checkout of this
repository). The cloud session that built the game up to here stopped at the point described in section 1.
Everything below can be done locally; the browser tests run on your own GPU, which is faster and does not
depend on the cloud VM.

## 0. Setup (once)

```
git clone https://github.com/Koede/game && cd game
bash scripts/local-setup.sh        # checks Node 22+, switches to the branch, installs, runs typecheck/tests/build
```
Branch: `ccr-3c8b169f-e78nk2` (the only branch; the repository had no base branch, so there is no PR).
Gate for every phase: `bash scripts/local-check.sh` (typecheck + unit tests + build) and, where noted,
`bash scripts/local-check.sh --e2e` (adds `npm run e2e`, which drives headless Chromium on desktop, phone
portrait, phone landscape, a sandboxed frame and the feature scripts; 5-15 minutes).

## 1. State when the cloud session stopped

See `HANDOFF.md` (status table + "Release state") for the authoritative state; the table below is the shape.

| Area | State |
|---|---|
| Game as released | v3 artifact = commit 2c247eb: five ages, flowing water, buckets, workbench shows hand recipes, 54 review fixes. Published at the artifact link the owner has. |
| Emberbound (hostile automatons) | Data, AI, combat rules, ward beacon, safe zones merged. Visuals, HUD hooks and `scripts/e2e-ember.mjs` were in progress in the cloud: check `docs/api/emberbound-render.md` and `git log --oneline -30`. |
| Brewing (tea and coffee, Ember Age) | Plan: `docs/BREWING_PLAN.md`. Cloud agents were building data, simulation, buffs, meshes/effects, UI/controls. Check `docs/api/brewing*.md`. |
| Ember handwork (hand stations, casting, leather, cloth) | Plan: `docs/EMBER_PLAN.md`. Cloud agents were building data, station simulation, casting, front end. Check `docs/api/handwork*.md`, `casting.md`. |
| Six ages + Bronze Age + steam | PLANS ONLY: `docs/BRONZE_PLAN.md`, `docs/STEAM_PLAN.md`, `docs/PROGRESSION.md`, SPEC sections 20-21. Nothing built; the repo still has FIVE furnace tiers. |
| Codex page generator | In the repo: `npm run codex`; preview with `node scripts/codex/preview.mjs <outDir>`. |

First thing to do locally: `git log --oneline -40`, read `HANDOFF.md`, run `bash scripts/local-check.sh --e2e`,
and fix whatever the cloud agents left red (they were told failures from other engineers' unfinished work
were theirs - expect a few). Unfinished agent pieces are identifiable from `docs/api/*.md` notes that list
"remaining" items and from commits titled "Checkpoint".

## 2. The owner's decisions (do not relitigate)

- The furnace is the heart of the base; workbench is minor but offers every hand recipe.
- Six ages: Ember (handwork, no steam/machines/electricity), Bronze (steam begins: kettle, rotor, shafts with
  speed and stress, then thermocouples, the boiler MULTIBLOCK, pressure, pneumatics, vacuum-drawn Bronze Chute),
  Forge (iron, steel, heavy industry, the dynamo at the END), Current, Atomic, Star.
- Bronze Furnace is one block; the steam boiler is the FIRST multiblock; the Blast hearth is the second.
- The furnace upgrade list is shown from the first minute of each age and opens the next age.
- Modern steam turbine (Current) converts steam straight to electricity; Ember/Bronze steam devices drive shafts.
- Tea/coffee: six drinks each its own boost, regrowing bushes, boiling water from any container and the Kettle Pot.
- Water flows; buckets take source blocks only. Enemies are the Emberbound automatons. Phone first, original art.
- Open: Star hearth casings (93 - keep or reduce).

## 3. Work order (one phase at a time; each ends with local-check.sh green, and e2e where noted)

1. **Land the cloud work.** Triage red tests/typecheck; finish any agent piece marked remaining; make sure each of
   Emberbound, brewing, handwork has its e2e script (`scripts/e2e-ember.mjs`, plus brewing and handwork steps -
   add `scripts/e2e-brewing.mjs` / `e2e-handwork.mjs` if missing and chain them in `package.json`'s `e2e`
   script). Real input only; `window.__hw` just for setup (docs/api/integration.md). Gate: `--e2e`.
2. **Full test run with fixes**, then rebuild and republish the game artifact (below).
3. **Six-age refactor** - `docs/BRONZE_PLAN.md` section 2 and work item W0. HIGH RISK, touches every module:
   commit the OLD-SAVE FIXTURE first (`tests/fixtures/save-before-bronze.json`, produced by the current build),
   renumber tiers/ages everywhere (`rg -n "minTier|furnaceTier|MAX_FURNACE_TIER|tier:|age:" src scripts docs/api`),
   save migration with a version bump, update solver/roster/objectives/UI text/e2e scripts, add the new tier 2
   Bronze Furnace (single block). A test must load the fixture and keep a formed Blast hearth formed. Gate: `--e2e`.
4. **Ember mechanics move**: nothing to do except confirm no steam/shaft/electric item is craftable before the
   Bronze Furnace (solver test "no electricity before tier 3").
5. **Steam, first half of Bronze** - `docs/STEAM_PLAN.md` (waves in its section 11-12; pseudocode in 14).
6. **Bronze second half** - `docs/BRONZE_PLAN.md` B1-B4 (netGraph refactor first, then heat+boiler / steam / air in
   parallel only if you have budget; the pseudocode is in its section 14).
7. **Review pass, republish**: test the game as a phone player, fix, run the full suite, republish.

## 4. Working rules that paid off

- One task per run with its plan section named; do not edit the same files from two agents at once. If you use
  sub-agents, give each a directory scope and tell them to re-read shared files before editing.
- Commit often (the cloud environment auto-committed checkpoints; locally commit when a step is green).
  Attribution line used so far: `Co-Authored-By: Claude <model> <noreply@anthropic.com>`.
- Verify visually: build to a scratch dir (`node scripts/build.mjs --out=/tmp/hw`), drive with
  `scripts/lib/browser.mjs` + `window.__hw`, and look at screenshots - screens and shaders cannot be judged from code.
- Test counts: about 1350+ unit tests; keep them green. Re-run a flaky phone e2e step alone before believing it.
- `scripts/codex/` regenerates the Codex reference page (recipes, blocks, progression tree, item map).

## 5. Publishing the playable artifact (if your session has the Artifact tool)

```
npm run build
# publish dist/artifact.html as the page with dist/game.js as a supporting file
# existing artifact (keep the URL): https://claude.ai/artifact/7pNzaEZk3XDtL2XCqtB2bj
# Codex page: https://claude.ai/artifact/9e1iDAs328yXKQSbkqxVVx  (npm run codex -> dist-codex/codex.html + codex-data.json)
```
`dist/index.html` also works from any static server (`npx serve dist`), which is the simplest way to play locally.

## 6. First message to paste into the new local session

```
You are continuing the game "Hearthwatt" in this repository (a voxel sandbox about heat, power and the furnace at
the heart of the base; the owner plays on a phone). Read docs/LOCAL_HANDOFF.md first, then HANDOFF.md, then
docs/PROGRESSION.md and the plan file for each phase as you reach it. Start with the setup/status check in
sections 0-1 (bash scripts/local-check.sh --e2e), tell me what is red, fix it, and then work through section 3
one phase at a time. Do not start the next phase until the current one passes the gate. Ask me before spending
large amounts of usage (parallel sub-agents, long e2e loops) - I am usage-limited. Commit as you go.
```

<!-- ======================== END docs/LOCAL_HANDOFF.md ======================== -->


---

<!-- ======================= BEGIN HANDOFF.md ======================= -->
# FILE: HANDOFF.md

# Hearthwatt - handoff

Pick-up notes for whoever continues this build. Every module is built and wired together: the game boots,
plays and saves (`npm run build`, then open dist/index.html through any static server). The playtest and
review pass (item 10) is done; see "Release state" below. What is left is delivery (item 11) and the known
issues listed there. Spec section 19 (the Emberbound hostile automatons): data, contracts, models, art and sounds are
laid down (row below); no behaviour yet.

**Next big feature (planned, not built):** steam and mechanics - `docs/STEAM_PLAN.md` is the full
implementation plan (contracts, numbers, files, tests, briefs); `docs/PROGRESSION.md` is the whole-game
progression it fits into.

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
| Integration and polish pass 2: animals wired, buckets, polish, feature e2e (`src/app`, `src/player`, `src/ui`, `src/save`, `src/render`, `scripts/e2e*`) | done, tested, e2e passing on desktop + phone portrait | **Animals**: `MobManager` in `GameState` (ticked after the sim, saved as `WorldSave.mobs`, older or damaged saves start a fresh herd), `MobRenderer` updated with interpolation before every render; the crosshair hits the animal before any block: Mine hits it (spec damage table, tool wear 1, knockback via the manager, drops via `player.give`), Use with a liked item feeds it before eating/planting (else Use acts on the block behind), HUD names it ("Boar - 10/10") through the new `GameUI.setTargetName`; touch tap/hold the same. **Buckets**: bronze bucket scoops lava (block removed, sfx scoop_lava) into a lava bucket that pours back and returns the bronze bucket; wooden refuses lava, bronze refuses water, none take oil (`src/player/buckets.ts`). Fruiting berry bushes are picked by Use or breaking and stay bare; bushes open no screen. **Polish**: steam vents puff and hiss (positioned, rate-limited, `src/render/vents.ts`), oil pools shuffled per block and every liquid varied over a pool (liquid shader), steam engine flywheel on the open side, hand and particles lit by the cool glowcap/crystal colour. `__hw` gained mobs, targetAnimal, food, spawnMob, setFood, clearInventory. **`scripts/e2e-features.mjs`** (run by `npm run e2e` after the opening check): animal hit until it drops meat, meat cooked in the crucible, eaten, hoe tills, seeds planted, dough at the workbench (flour + water bucket) baked into bread, lava scooped and poured, rain via `__hw.setWeather` - real input, screenshots in `test-results/e2e-features/`, reviewed. API in `docs/api/integration.md` (pass 2). |
| Integration pass 3: wrench, buckets on tanks, pipe screen, hearth and pipe e2e (`src/player`, `src/app`, `scripts/e2e*`; small: `src/render/{coolLight.ts,mobs,machines}`) | done, tested (12 new player tests, 2 render tests), full `npm run e2e` passing (108 steps) | **Player** (`pipeTools.ts`, `pipeAim.ts`; Game passes `transport: sim`, src/player still never imports src/sim): Use with the wrench on a pipe calls `sim.wrench` with the side aimed at (the arm under the crosshair, or the core face turned to the player - joins a parted pipe), toast + `pipe_clunk` from the sim, refusals toasted, one turn per 0.35 s; a bucket (empty, water, bronze, lava) on a tank or any fluid endpoint goes through `sim.bucketUse` before any machine screen and swaps the held bucket; anything that is not the wrench, a bucket or a placeable block opens the pipe screen (no long-press: hold is mining on touch). **Cool glow**: animals and machine parts take the cyan/violet light of glowcaps and crystals (`aCool` per instance). **"Hurt boar stays in flee"**: not a bug - 5 s of game time at 2-3 fps (5 ticks per frame cap) is > 10 s real; e2e-features now measures it in ticks. **`scripts/e2e-tech.mjs`** (run by `npm run e2e` last): desktop + phone portrait, real input: a Blast hearth built brick by brick around a lit clay furnace forms (toast, glowing shell), STRUCTURE tab says Formed, crate -> 3 bronze chutes -> item hatch, the wrench sets the crate end to Pull, the ore is drawn moving and reaches the crucible, a water bucket into a tank and back, empty hand opens the pipe screen and a port is switched off, glowcap-lit hen and pump at night; screenshots in `test-results/e2e-tech/`, reviewed. Notes in `docs/api/integration.md` (pass 3) and `docs/api/player.md`. |
| Food, farming and animals - foundation (spec 12) | done, tested | Contracts in src/core (hoe, `ItemSpec.food`, role `crop`, `CreatureSpec` + `CREATURES`, events `player:ate` / `mob:*` / `crop:grew`, 8 sfx, hunger and animal constants), content (now 84 blocks, 142 items, 110 recipes, 22 machines incl. `crop`, 3 creatures with box models, 42 objectives; solver understands animals, wild plants and crops), 8 sound patches (measured in Chromium), 35 textures (farmland, crop stages, wild plants, food icons, hoes). **No behaviour yet**: hunger/eating/tilling (game rules), crop growth (sim), wild plants in worldgen, animals (src/mobs + render) are the next engineers'. API, every key and the traps they must know in `docs/api/food.md`. |
| Food rules: hunger, eating, tilling, planting (spec 12.1, 12.4, 12.6) | done, tested, browser-verified | `src/game/hunger.ts` (drain, Hungry, starvation, regen gate and cost, Well-Fed, `eat()` with cooldown and refusals, jump/mining costs; ticked by `Survival.hunger`, food saved on `PlayerState`), `src/game/farming.ts` (`canTill`, `till`, `plantCell`, `plant`, `cropStage`, popping unsupported plants). `src/player`: Use eats food (unless it would plant on farmland or a screen opens), tills with a hoe, plants seeds/potato/carrot; crops open no screen and rustle when dug, ripe ones `harvest`; no sprint while Hungry. Playthrough stand-ins replaced; the script eats. Real game checked in Chromium on desktop and both phone orientations. No wiring needed. HUD meter and Use-on-animals are other engineers' (notes in `docs/api/food-rules.md`). |
| Crop growth (spec 12.4, `src/sim/crops.ts`, `cropRules.ts`) | done, tested (14 tests), browser-verified | Crops grow by daylight under open sky or a lit lamp within 5 (night, underground), twice as fast with water within 4 at y / y-1, only on farmland; stage blocks swap in place keeping the entity, `crop:grew`; ripe/unlit crops sleep (no per-tick cost) until a relevant block change, lamp, chunk load or sunrise. Not machines: no networks, views, sounds, toasts or machine events; breaking one gives nothing back. `sim.cropView()` for status text. 500 growing crops tick in ~0.01 ms (node, real World). Rain hydration hook for weather: `isHydrated()` in cropRules.ts. API in `docs/api/crops.md`. |
| World content - data for spec 13-15 (buckets, a richer world, weather) | done, tested | Contracts in src/core (`BiomeKey` 'marsh' + `ALL_BIOMES`, `FuelSpec.fuelReturns`, `BlockSpec.harvestLeaves`, role `bush`, `LootTableSpec` + `rollLoot`, `WeatherState`, weather/moon/lightning/ruin constants, `src/core/weather.ts` lookups, events `weather:changed` / `weather:lightning`, sfx thunder / steam_hiss / scoop_lava). Content: pail/water_pail shown as Bucket / Water Bucket, bronze_bucket (forge 700 C) and lava_bucket (fuel 1300 C, returns the bucket), 20 world blocks (flowers, fern, reeds, berry bushes, glowcap, cactus, ice spires, basalt columns, steam vent, peat, Old Works ruin blocks, crystal clusters, oil), wildberries, machine `berry_bush`, marsh ores and animals, ruin loot tables; solver proves the game can be finished from any one biome. 3 sound patches + rain/storm ambience layers, 25 textures (224 of 256 layers used). **No behaviour yet**: scooping lava, berry regrowth, fuelReturns in the furnace, marsh/ruins/flora worldgen, weather system and visuals are the next engineers' - each one's to-do is in section 6 of `docs/api/world-content.md`. |
| World features (spec 14, 12.4 wild plants, 13 lava, 16.5 oil): `src/world` worldgen | done, tested (86 world tests), browser-verified | The **marsh** (flat wetland at sea level, shallow pools, peat over clay, reeds, willows, blended into its neighbours, never within 150 blocks of the origin), surface life per biome (wild wheat/potato/carrot patches, berry bushes, poppy/skybell meadows, ferns and glowcaps under dense forest, reeds on every shore, cacti, frost spires and lilies, basalt organ pipes and steam vents), oaks in three sizes incl. a broad 2x2-trunk old oak, tall and short pines, willows, dead snags; crystal geodes, cavern lakes, lava falls, glowcaps on cave floors; ore outcrops in cliff faces; **oil seeps** (dunes y 34, scar y 38, in sandy pans); **Old Works ruins** (~65% of 7x7-chunk squares, one always 30-78 blocks from spawn) whose loot crate the `World` places through `setEntity` + `setVoxel(..., 'load')` on first chunk load (the simulation adopts it like a saved crate; never placed twice). Spawn also guarantees wild wheat within 48. generateChunk ~1 ms. **Crates no longer pin chunks.** Seen in the built game in headless Chromium (marsh, meadow, ruin by day and night, geode, lava fall, lake, dunes, oil, spires, scar, vents, outcrops). API, numbers and gaps in `docs/api/world-features.md`. |
| Animals (spec 12.5): `src/mobs`, `src/render/mobs` | done, tested (66 tests), browser-verified; **wired in** (integration pass 2, row below) | `MobManager` (DOM-free): 20 Hz AI (idle / graze / wander / flee / follow / breed / swim / dying), edge-guarded AABB physics (hops, floats, never into liquid or drops > 2, unloaded columns are walls), lava hurts, deterministic first-load chunk rolls by biome, spawn guarantee, daytime keep-alive out of sight, caps, positioned calls, breeding and babies; `raycast` / `hit` / `feed` / `describe` / `onDeath` drops for the player module; `views(alpha)` for rendering; `toJSON` / `load`. 40 animals tick in ~0.16 ms (node). `MobRenderer`: one instanced draw call per species + blob shadows, leg swing, grazing, hurt flash, tip-over and fade, babies with big heads and horn nubs, terrain lighting via `LightProbe` and the world uniforms (`Renderer.uniforms` made public - the only edit outside these dirs). Screenshotted by day, dusk, night at 1280x800 and 390x844. Integration steps in `docs/api/mobs.md` - all done by the integration pass 2. |
| Food UI (spec 12.8): HUD and screens, `src/ui` | done, tested (13 new tests), browser-verified | Food meter (steaming-bowl glyph) beside health and warmth, Hungry (bar breathes, "!", umber corner vignette) and starving states, Well-Fed pill next to Well-Warmed (glyph + time side by side on phones when both are on), "+N food" / "Well-Fed 6 min" on item cards, the touch carry bar, the hotbar name flash and recipe rows, "Returns the bucket" on recipes with byproducts, Kitchen chips first after All in the furnace SMELT (new chips: Kitchen / Materials / Fuel) and FORGE lists, one Hearth Stew row instead of three, death-screen hunger wording plus a starving line. Screenshotted at 390x844, 844x390, 1280x800 with real PlayerState / Survival / Simulation and the touch overlay; no overlaps with the goal tracker, compass or touch buttons. No wiring needed. API in `docs/api/food-ui.md` (changes summarised in `docs/api/hud.md`). |
| Tech content - data for spec 16-17 (item and fluid transport, multiblock hearths) | done, tested | Contracts in src/core (BlockShape `pipe` + `BlockSpec.pipe`, `FluidKey`/`FluidSpec` + registry `FLUIDS`, `MachineSpec.fluids`, `FurnaceTierSpec.structure`, `BlockTextures.bottomActive`, roles `tank`/`hearth_part`, events `hearth:formed`/`hearth:unformed`, sfx hearth_formed / pipe_clunk, PIPE_* / HEARTH_* constants, pure `src/core/hearth.ts`, registry `pipeJoins`/`pipeCarries`/`isItemEndpoint`/`isFluidEndpoint`/`hearthWallTier`/bucket-fluid lookups, validation). Content: 4 pipes, pump, tank, boiler, steam turbine, refractory brick, plasma and star casing, electrode, item/fluid hatch, power port, wrench; 5 fluids; 16 recipes; 7 machines and fluid ports on 6 more; the 17.2 upgrade costs; objectives `pipe_ore`, `pump_water`. Solver: each upgrade needs its smallest shell's materials at the tier before (game still completable). 28 textures (252 of 256 layers), 2 sounds. Playthrough given a pipe and a pump. **No behaviour yet**: pipe meshing (a cable-like stand-in in `src/world/blockTables.ts`), networks, pumps, boilers, hearth formation, formed glow at night, pipe screen, STRUCTURE tab - each one's to-do is in section 6 of `docs/api/tech-content.md`. |
| Multiblock hearths - behaviour (spec 17.1, 17.3; `src/sim/hearth*.ts`, `endpoints.ts`) | done, tested (131 sim tests), browser-verified | Cuboid scan exactly as 17.3 (controller in a face, inside behind it, frame/face/floor/ceiling/interior, up to 8 problems with codes, positions and plain words; structural tier = the weakest wall decides), scheduled per 17.3 (next tick after a change in the shell box + 1; unformed retry 1 s only near the player or with the screen open; formed sweep 1 cell / 4 ticks; waits for unloaded chunks). Effective tier min(tier, structural) (tier 1 standing alone) drives max temp, crucibles (extras lock, contents kept), capacity/loss (windows double), heater and fire sized to the shell, speed + running tuyeres. Upgrade/view need the next hearth ("Build a Blast hearth: brick walls around the furnace"); ignition needs a formed Starhearth. Power ports link to the controller; shell blocks stand for the furnace (heat engines, blowers); active bits on the shell; `hearth:formed/unformed` + sfx + toasts; saved and re-validated after load. `sim.structureView()` (status, checklist, problems, materials, exact ghost cells) for the STRUCTURE tab. **Endpoint interface for the transport engineer:** `sim.itemEndpoint/fluidEndpoint(x, y, z, face)` (furnace smart sides, crates, machines, hatches as proxies, fluid buffers). Also: furnace hands back `fuelReturns`, berry bushes regrow (CropField, never a machine), heat engines draw heat for power USED. Stats measured against each tier's smallest shell (deviation, keeps the power budget). Playthrough builds all four hearths from the ghost cells and still wins (165 min). Scan 0.2 ms, formed 5x5x5 hearth 0.01 ms/tick (real World). **To do elsewhere:** STRUCTURE tab + highlight + ghost rendering (UI/render), machine fluid behaviour (transport). API in `docs/api/hearth.md`. |
| Feature visuals part 1: machines alive, real pipes, cool glows, atlas capacity (spec 14, 16.1) | done, tested (17 new tests), browser-verified | `src/world`: shape `pipe` meshed for real (`meshPipe.ts`: core, arms to every same-family neighbour exactly as `pipeJoins`, wider collars at endpoints; item pipes see-through in the blended batch), the mesher's quad code split into `meshQuads.ts`; lighting carries a light colour so glowcaps light caves cyan and crystal clusters violet (flags byte bits 3-7, `computeLight(chunks, hueOut)`, `MeshInput.hue`). `src/render`: `machines/` - wind turbine rotors, water wheels, steam engine flywheel + piston rod, steam turbine rotor, bore rig derrick + drill string down its shaft, pump piston; one instanced draw call per kind in view, speeds follow `availW` / work, ~0.1 ms median with 50 machines; atlas splits over two array textures past `MAX_ARRAY_TEXTURE_LAYERS` (verified with a faked 128-layer limit); glazed item-pipe tiles; pipe target box. Screenshots of every brief scene at 1280x800 and 390x844 reviewed. No wiring needed. API, measurements and gaps in `docs/api/render-machines.md` (the content test's 256-layer cap can now be raised). |
| Feature visuals part 2: transport and hearths in the world (spec 16, 17.4; `src/render/tech/`) | done, tested (16 tests), browser-verified | Items in pipes (a tiny cube or icon per packet, slid along its path between ticks, <= 150 drawn, culled; drawn after the bronze chute's glass), fluid in the pipes' sight glasses (fluid pipe tiles got real windows; colour, level = fill or a running stream when it flows through, streaks while moving, lava full-bright; the carrying bit as a faint wash), formed hearths (molten pool on the heat ramp, chamber glow seen through open tops and windows, halos, smoke and shimmer from open tops, the light sweep on `hearth:formed`), the ghost preview (`ghost:show/clear`: blue missing with a faint block image, red wrong; a faint second pass for ghosts behind leaves only) and the problem highlight (`highlight:block`: pulsing red outline through walls, an edge-of-screen DOM arrow kept clear of the HUD, left/right for a block behind). One wiring line in `src/app/game.ts`: `renderer.setTransport(simTransportFeed(sim))`. `techMs` median 0.2 ms in a busy scene (software GL). Screenshots at 1280x800 and 390x844 reviewed. API, numbers and gaps in `docs/api/render-tech.md`. |
| Day, night and weather (spec 15): `src/game/weather*.ts`, `src/sim/weather.ts`, `src/render/{precipitation,rainMask,weatherFx}.ts`, sky, HUD dial, Hearth Log | done, tested (45 new tests), browser-verified | Seeded weather timetable (clear/cloudy/rain/storm, 4-12 min, eased 30-60 s changes, saved), per-biome rain/snow/dust at the player, moon phases (clock night light 0.04-0.12), storms with lightning and distance-delayed thunder. Gameplay: solar x0.5/x0.2, turbines x1.5 in storms, rain-chilled furnaces under open sky (+50% loss, status line says so), rain waters exposed crops (glass roofs keep it off), 0.3/s rain/snow chill without a roof. Render: overcast/darkened sky and ground, pixel moon in phase, turning stars, cloud deck, roof-aware instanced rain/snow/dust (one draw call, CPU < 0.05 ms), wet ground, lightning flash + bolt. Audio fed (rain, gusts, sheltered). HUD dial weather glyph + tonight's moon; Hearth Log forecast card. `__hw.setWeather(kind)`, `__hw.setDay(d)`. Screenshotted at 1280x800 and 390x844 in every brief scene. API, measurements and gaps in `docs/api/weather.md`. |
| Item and fluid transport - behaviour (spec 16.2-16.5; `src/sim/pipe*.ts`, `itemNet.ts`, `fluidNet.ts`, `transport*.ts`, `tanks.ts`, `fluid*.ts`) | done, tested (51 new tests), browser-verified (sim only) | Networks rebuilt only where a pipe or endpoint changes (flood fill, caps 1024 pipes / 64 ports with "Network too long", joints refused for different fluids or a hot fluid in a cold pipe, wrench-parted joints). Ports `{ mode push/pull/off, nearest/round, filter <= 5 allow/deny, priority -2..2 }` saved on pipe entities only where changed; give-only blocks (pump, bore rig) default to pull. Item packets: destination chosen on leaving (priority, nearest or in turn, never back into its own block), reservations, re-route, home, "Blocked" with retry, 48-packet cap; furnace smart sides and hatches. Fluid networks: one fluid and an amount (250 L/pipe), pull to the pipe's rate, push by priority with equal split, "Too hot for this pipe". Pumps (endless water from >= 2 blocks; lava/oil used up, farthest of 32 first), stacked tanks (one level), boiler (steam from furnace heat, stops when its steam is unused), steam turbine, piped water for steam engine/electrolyzer/fission pile, fuel for the combustion engine, still crude oil -> fuel, geothermal piped lava. Content saved on one anchor pipe entity per network (packets delivered on load, amounts kept). Active bit on carrying pipes. `sim.wrench/wrenchPort/wrenchJoint/setPort/bucketUse` (ok/reason), `sim.pipeView` (per-port status words), `sim.transportView()` (packets with path + along/speed, fluid fills), `MachineView.fluids`. 0.02 ms/tick for 20 x 200 pipes at the packet cap, ~2.5 ms per 1000-pipe rebuild (real World). Playthrough pipes iron and copper through hearth hatches and runs a pump, steam engine, boiler and turbine (179 min). **To do elsewhere:** draw packets and fluid fills (render), the pipe screen + a pipe `ScreenRequest` (UI/core), wrench and bucket Use in the player module. API in `docs/api/transport.md`. |
| Tech UI (spec 16.3, 17.4): furnace STRUCTURE tab, ghost / highlight requests, PIPE screen, fluid tanks on machine screens (`src/ui/screens/{furnace/structure*,furnace/hearthGhost.ts,pipe,machines/fluid*,stepper.ts}`) | done, tested (17 new tests), browser-verified (harness + real game) | STRUCTURE tab between Forge and Grid: status chip, what the hearth means for the furnace, tier-1 "What is a hearth?" card, checklist with ticks and counts, problems in plain words (same words folded, "×6"; a tap emits `highlight:block` for its block, cycling, and says "Shown in the world"), plan picker (tier, Across / Deep / High steppers, rules, materials with have/need) and **Show in world**: `HearthGhost` emits `ghost:show` with the non-ok structure cells, follows block changes while shown, and clears on forming at the target tier / all in place / furnace gone / switch off - it outlives the screen. `!` badge while the furnace needs its hearth; the upgrade sheet's "Plan the hearth" opens the tab on the next tier. On portrait phones the tab folds the firebox to its status line. PIPE screen (`'pipe'`, registered by `registerStationScreens`; the player opens it on Use with an empty hand): line summary, fluid bar in the fluid's colour, warnings, nearest 8 ends then "Show N more", each with icon / name / distance (tap: highlight), toned status, Push / Pull / Off, settings fold (Nearest / Round, 5 filter slots picked from the pack or the five fluids, Allow / Deny, priority -2..+2), ~4 Hz refresh. Machine screens: fluid buffers as coloured bars (tank stacks as one), layouts `tank` / `boiler` / `part`, no pack / network / switch where they mean nothing. Verified at 390x844, 844x390, 1280x800 (screens, touch and mouse flows) and in the built game (ghost cubes and the highlight drawn by `src/render/tech`). No wiring needed. API in `docs/api/ui-tech.md`. |
| Flowing water and source blocks (spec 18): `src/world/{water,flow,meshLiquid}.ts`, mesher, chunk shader, buckets / ray / currents in `src/player`, currents in `src/mobs/physics.ts`, pumps in `src/sim/fluidMachines.ts`, texts in `src/content`, one tick line in `src/app/state.ts` | done, tested (15 world, 6 player/mobs, 3 sim, 1 state tests new), browser-verified | Water flows like the player asked: a scheduled cellular update in `World.water` (woken by `setVoxel`, never by `'load'` edits; 0.25 s per step, 256 cells a tick, waits at unloaded chunks), down first, sideways towards the nearest drop within 4, levels 1-7, draining ring by ring, a hole with two sources beside it refills as a source, washable plants washed away, crops/torches/machines block it; ticked after the sim, its queue saved with the world (older saves load; a world saved mid-flow continues identically). Generated water is all sources and perfectly still (0 updates over 12 seeds). Sloped surfaces by level, waterfalls with streaming sides, the texture runs along the flow (flags bits 2+4, rotated uvs, no new attributes). Buckets take a SOURCE through flowing water (toast when there is none) and pour a source into air, a washable plant or flowing water; pumps draw sources (endless only where the refill rule holds); every water-nearby rule counts flowing water; currents carry players and animals. 7-level flood ~0.1 ms per busy tick in the browser. e2e-features gained a pour/flow/take-back step. API, deviations and gaps in `docs/api/water.md`. |
| The Emberbound - data for spec 19 (hostile automatons): `src/core` (appended), `src/content`, `src/render/textures/ember.ts`, `src/audio/sfxEmber.ts` | done, tested (25 new tests), models previewed in Chromium | Contracts: `CreatureSpec.hostile` (`HostileSpec`: attack melee/dash/bolt/zap/slam, damage, windupS, cooldownS = period, range, senseRange, flying, stationary, shieldFront, knockback, burn, wetMult, projectile/dash speed, `habitat` with spawn-place weights, sky, ruin role, maxLoaded), `CreaturePart.emissive`, anims legML/legMR/armL/armR, `ItemSpec.weapon` + tool kind `maul`, `ItemSpec.armour`, causes automaton/ember, events `hostile:woke/dormant/windup/attack`, `player:attacked`, `projectile:fired/hit`, `automaton:salvaged`, 8 sfx, HOSTILE_* / WARD_BEACON_RADIUS / RUIN_* / EMBER_BOLT_* constants, `Settings.difficulty` + `uiScale` (old settings load as normal), registry `AUTOMATONS` + validation, pure lookups in `src/core/hostile.ts`. Content: six automatons with original box models (mite, warden, sentry, hound, drone, colossus) and lore, scrap_metal, ember_core (fuel 1700 C), four mauls, plated coat, steel cuirass, ward beacon (500 W, radius 32), 9 recipes, objectives forge_maul / salvage_automaton / ward_base (flags `automaton_salvaged` or `peaceful`). Solver: automaton drops from the first night on Normal, relics never counted, **Peaceful proven finishable**. 12 textures, 8 sounds (measured; the wind-up is the loudest cue in the phone band). Small edits elsewhere to stay green: hitDamage reads weapons (src/mobs), coat warmth from data (src/game), PART_GROUP (src/render/mobs), two death-screen lines (src/ui), sanitizeSettings (src/save), playthrough stand-ins (src/sim). **No behaviour yet**: AI/combat (src/mobs), ruin guards (src/world), armour/difficulty/burning (src/game), ward beacon (src/sim), shader/effects (src/render), HUD/settings/death screen (src/ui), wiring - each one's to-do is section 7 of `docs/api/emberbound-content.md`. |
| Emberbound in the simulation + sim leftovers (spec 19.4; ui-13, sim-3, sim-7): `src/sim/safeZones.ts`, `simulation.ts`, `machines.ts`, `gridViews.ts`, `fluidMachines.ts`, `transportViews.ts`, `hearthView.ts`, one hint line in `src/content/techMachines.ts` | done, tested (12 new sim tests), beacon screen screenshotted | **Ward beacon**: a 500 W consumer like the lamp, active (lit, warding) while powered; status "Warding 32 blocks all round - automatons keep away" / "No power - automatons can come near". **Safe zones for the mob manager**: `sim.isSafe(x, y, z)`, `sim.safeZoneAt(...)`, `sim.safeZones()` (`{ kind: 'furnace' or 'beacon', x, y, z, radius }`), `sim.safeZonesVersion` - every furnace at >= FURNACE_HOT_C over its block's warmth radius (clay 6 ... star 24) and every powered beacon over its `radius` param (32); cached, rebuilt only when a furnace crosses 200 C, changes tier, or a furnace/beacon changes power, is placed, broken or reloaded (tested: 200 steady ticks, 0 rebuilds). `Simulation` satisfies `SafeZones` of `src/mobs/hostileTypes.ts`: wire `useHostileHooks({ safeZones: sim })`. **ui-13**: a full pump says "Full - the line has nowhere to put it" / "Full - nothing pulls from it" / "Full - connect a pipe that pulls". **sim-3**: boiler and turbine hints say to set the boiler end to Pull with the wrench. **sim-7**: `StructureView.target.shiftLeft/shiftRight` (offsets for the shift buttons, as seen in front of the furnace), `machines` and `note` documented for the UI in `docs/api/hearth.md` (plus a "Checking the blocks around the furnace..." note before the first scan). API in `docs/api/sim.md` (Safe zones), `transport.md`, `hearth.md`. |
| Emberbound - the player's side of combat (spec 19.4): `src/game/combat.ts` (+ PlayerState, Survival, ObjectiveTracker), `src/player/animals.ts` + one line in `controller.ts` | done, tested (29 game + 6 player tests) | `player.damagePlayer(rawAmount, cause, sourceX, sourceZ, species, sourceY?)` (x difficulty - Hard 1.25, Peaceful nothing - then `player:attacked`, armour, knockback away from the source, burning for a bolt) and the hook-shaped halves `player.combat.takeHit(...)` / `knock(vx, vy, vz)` matching src/mobs' `DamagePlayer` / `KnockPlayer` hooks (use one path, never both). Armour: best `ArmourSpec` anywhere in the inventory, only 'automaton'. Burning: 'ember' 1/s for 2 s, refreshed not stacked, x difficulty, put out by water (steam hiss), refused on Peaceful. `player.killedBy` + `killerLine()` ("Felled by a Forge Warden"). Swing timer: 0.5 s after a maul, 0.4 s otherwise; arc maul stun passed as `hit(..., stunS)`; maul wear 1 per hit. `setDifficulty('peaceful')` raises FLAG_PEACEFUL, the tracker also raises it on Peaceful and records FLAG_AUTOMATON_SALVAGED from `automaton:salvaged`. Saved (optional fields). **Wiring left for src/app**: `player.combat.setDifficulty(settings.difficulty)` at start and on change, the mob hooks; death screen line and burning indicator for src/ui. API in `docs/api/game.md` (combat.ts). |
| Emberbound - AI, spawning and combat (spec 19.2-19.3): `src/mobs/{hostiles,hostileBrain,hostileMove,hostileHurt,hostileSpawner,hostileRecords,hostileTypes,hostileCtx,attacks,projectiles,sight,guards}.ts` (+ manager, views, types), `src/world/ruinGuards.ts` | done, tested (36 new tests, 113 in src/mobs), browser-checked (scratch harness) | Automatons in the MobManager's own list (same ids, raycast, `hit(..., stunS)`, describe, views, save): senses (DDA line of sight 16 / blind 6, forget 10 s), telegraphed melee / slam / zap (x2 wet) / dash / ember bolt judged at the release, `hostile:windup` -> `hostile:attack` -> `player:attacked` -> injected `damagePlayer` (after difficulty, before armour) + `knockPlayer`, shield front x0.5, arc maul stun, steering with the animals' edge guard, give-up after 4 s, drones hovering 2-4 up, sentries that only turn, ember bolts (arc, first block or the player, events, `projectiles(alpha)`), daylight wind-down to dormant and waking, despawn 64 / dormant 48, never into an injected `SafeZones` (sim fits) and no attacks on a player inside one, night spawning per 19.3 (24-40, dark, out of view, caps per difficulty, place weights, groups), ruin guards created once per ruin when it has loaded and saved (`guarded`), Peaceful = none simulated, salvage (`automaton:salvaged`, flag, drops through onDeath). 40 animals + 12 automatons + 8 bolts: 0.42-0.65 ms/tick (node, real terrain). **Integration: 3 calls in src/app** (hooks, difficulty) - `docs/api/emberbound-ai.md`. |
| Emberbound - visuals (spec 19.5): `src/render/mobs/{automatonFx,poses,anchors,bolts,burst,debris,halos,cubes,sparks,material}.ts` + `mobRenderer.ts`, ONE line in `src/app/game.ts` (`mobRenderer.setBolts(state.mobs.projectiles(alpha))`) | done, tested (35 render/mobs tests), screenshotted at 1280x800 and 390x844 | Emissive parts full-bright, flaring through wind-ups, dark when dormant; warden hammer / colossus fists / hound crouch / drone hover and crackle / sentry kiln turning, all driven by the MobView alone (no bus: release = wind-up ending, hit = flash jump, death = `tip`); halos, smoke and spark emitters, ember bolts with trails, hit sparks, break-apart debris in model colours, drone zap arc. 12 automatons + 8 bolts cost 0.05-0.12 ms/frame of JS. `docs/api/emberbound-render.md`. |

| Brewing - buffs, drinking, physics (`src/game/{buffs,drink}.ts`, `src/player/physics.ts`; `docs/BREWING_PLAN.md` 5, 8, 11.1) | done, tested (`brewBuffs.test.ts`, `physicsBuffs.test.ts`) | `player.buffs` is a `Buffs` (Well-Warmed and Well-Fed fields kept, six drink buffs in a tea slot and a coffee slot; a same-family drink replaces with a toast; saved with `drinks`, old saves load). `drink(player)` (cooldown, clay cup back in the same slot, `player:drank`, sfx `sip`, six_cups flag). Each buff at its one hook: physics speed and jump (Spring adds (mult^2-1) x jump height to the safe fall), Survival warmth drain, Hunger regen and food drain, `miningTime(..., speedMult)`. `coolCarried` ticks the boiling pail back to water through `durability`. API in `docs/api/brewing-buffs.md`. |
| Brewing - simulation (`src/sim/brewing.ts`, `brewActions.ts`; `docs/BREWING_PLAN.md` 4, 8-9, 11) | done, tested (`brewing.test.ts`, 21 tests) | `BoilBucket`, `BrewCup`, `Kettle` entities (JSON, never machine nodes), boil tick (150 C: 16 s, 400 C: 6 s; cools below 80 C; boils dry at 180 s and returns the container; furnace/roof broken returns it), heat draw into `extractW`, brew tick (4 s), formed-hearth roof via `shellOwner`, kettle pot. `sim.brewUse(x,y,z,heldKey)`, `placeContainer`, `isFurnaceTop`, `brewView`. `src/player/brewTools.ts` calls them and the HUD target name reads `brewView().text` (done, see the next row). API in `docs/api/brewing.md`. |
| Brewing - player, HUD and wiring (`src/player/brewTools.ts`, `interaction.ts`, `controller.ts`, `blockRules.ts`, `src/ui/hud/{drinkBuffs,vitals,hud,query}.ts`, `src/ui/screens/food.ts`, `src/ui/menus/howto.ts`, `src/app/game.ts`; `docs/BREWING_PLAN.md` 5, 7, 11) | done, tested (12 `brewTools` tests, 1 animal-priority test, 5 chip tests, 4 drink-text tests), screenshotted at 390x844, 844x390, 1280x800 | Use priority: animal with liked item, brewing blocks (`sim.brewUse`, also the kettle with an empty container), a water container on a furnace top (`sim.isFurnaceTop` -> `sim.placeContainer`, never a poured source), pipes and screens, a held drink (`drink(player)`), then food/plant/place; brewing blocks have no screen; `BrewResult` applied (consume, give into the same slot, `giveDurability` written on the stack); Vigor now reaches `miningTime`. HUD: six drink chips (tea green, coffee amber, own glyph each, compact from two chips, tight from four), target names from `brewView().text`, drink and ingredient rows in tooltips / recipe rows / carry bar ("Swift 3 min", "Brews Light Roast"), the tea and coffee chain under the Kitchen chip, a "Tea and coffee" How to Play card. `src/app/game.ts` passes `brew: sim`. API in `docs/api/brewing-ui.md`. |
| Brewing - data layer (`src/core/{brewing,brewValidation}.ts`, `src/content/*Brew.ts`, `src/render/textures/{brew,iconsBrew}.ts`, `src/audio/sfxBrew.ts`, bushes in `src/world/plants.ts`; `docs/BREWING_PLAN.md` 2, 3, 11) | done, tested (`brewing.test.ts` 15, `world/brewPlants.test.ts` 4) | Contracts (`DrinkSpec` with six buffs, `ItemSpec.drink/brews/container/cools`, shapes `cup` / `bucket` (render stand-in: crossed quads), role `brew`, 4 events, 3 flags, 4 sfx, ~17 constants), the single cup stage <-> block table `CUP_BLOCK`, `CONTAINER_BLOCKS`, `DRINK_BUFFS` labels, registry lookups and validation. Content: tea and coffee bushes (4 blocks, regrowS 360, cuttings), cup in 5 states, bucket on furnace (2), Kettle Pot, 20 items (six drinks), 11 recipes, goals `boil_bucket` / `first_brew` / `six_cups` after `bake_bread`, solver rules (`boiling_pail`, drinks, the three flags), roster fixture `specRosterBrew.ts`. 13 block sprites + 20 icons, 4 sounds (measured, peaks -9 to -14 dB like the farm sounds). Worldgen: tea in woodland + marsh grass, coffee in woodland where the dunes blend in (deterministic, chunk-order independent, tested). **To do elsewhere:** real `cup` / `bucket` meshes and target boxes (render), brewing steam and drip emitters, the HUD chips and target names (UI). API in `docs/api/brewing-content.md`. |
| Brewing - world and render (`src/world/meshCup.ts`, `src/render/{brewFx,brewLiquid,target}.ts`, `src/audio/ambienceBoil.ts`; `docs/BREWING_PLAN.md` 6, 7) | done, tested (`meshCup.test.ts`, `brewFx.test.ts`, target and ambience cases) | Real `cup` (6x5/16 body, stepped drip cone to 10/16) and `bucket` (rim, water top that shimmers when boiling; closed kettle pot) meshes in the cutout batch; target outlines padded to >= 8/16; steam over boiling buckets, active kettles and finished cups (`steamS`), drips while brewing, a tinted liquid quad per brewing/finished cup from `drink.colour`; ambience field `boil` + layer. **Open: `src/app/ambience.ts` must set `state.boil` (distance-faded) near a boiling bucket or kettle.** API in `docs/api/brewing-render.md`. |
| Ember handwork - simulation (`src/sim/handWork.ts`, `handTypes.ts`, `handRules.ts`, `handViews.ts`; `docs/EMBER_PLAN.md` 2, 5) | done, tested (20 tests, real content + fake rules) | One saved entity per station block (`kind: 'hand'`, `slots [input, output]`, `progress`, `recipe`, `hotS`), never a machine node. `sim.stroke(x,y,z,heldKey)` -> `{ok, did, done?, reason?}`: insert, plan refusals ("Take the X first", "Needs n X", "Nothing to work"), strokes x2 with the station's tool OR inside the hot window (never both), 0.01 food, `sfx` + `hand:stroke`/`hand:done`/`hand:taken`, empty-hand take (+ `item:made`), `toolOutput` and `bonus` rolls. Recipes that share an input item (anvil: 1 ingot wire, 2 ingots plate) load one item per Use and the count picks the job. Timed Drying Rack (open sky + daylight, rain zeroes it) and Tanning Trough (any place), batch of 8, only running stations are ticked. `handView` label ("Hand Quern - wheat 3/6 strokes"), `handReturn`, `openHotWindow` (also opened by every `cast:poured` within 6 blocks). Playthrough: planks, sticks and flour at the stations. **Open:** the scripted playthrough still fails at the tin smelt because molten copper blocks the crucible (casting: `play.smelt` must pour or cool metals; bronze, heads and pickaxe are `STAND-IN (casting replaces)`), and it has no steps yet for the mortar, clay table, loom, rack or trough. API in `docs/api/handwork.md`. |
| Ember handwork - front end (`src/player/handTools.ts`, `src/world/{stationShapes,meshStation}.ts`, `src/render/handwork/`, hud target line, How to Play, `scripts/e2e-handwork.mjs`; `docs/EMBER_PLAN.md` 2, 5) | done, tested (12 player, 5 world, 11 render tests), browser-verified on phone portrait and desktop with real taps | Use priority right after brewing: a hand station takes the tap (`sim.stroke`; ingredient or station tool passed as the held key, other items are a bare hand, a non-ingredient block is placed beside it; Shift / Place + empty hand = `handReturn`); a fired mould held at a furnace with molten metal pours in the world (`pourCrucible`). Holding Use repeats at the station's `strokesPerS` (`IntentSource.setUseRepeat`). Stations are cube / slab blocks in the content and small boxes in the mesh (`STATION_BOXES`, target outline hugs them). Event-driven part animations through the machine-parts layer (quern 30 degrees a stroke, hammer + flash + sparks, axe + opening log, loom shuttle + cloth, pestle, clay lump + stick, swaying rack bundles, trough water): `Motion.Pulse` added to the machine shader. Crosshair line = the sim's `handView.label` refreshed on each stroke, the ring fills with the work; How to Play 'Working by hand'. **Open:** no casting-bench or alloy-pot visuals (casting engineer's entities), no emissive flash (tinted plate), parts beyond 64 blocks not drawn. API in `docs/api/handwork-front.md`. |
| Ember handwork - data layer (`src/content/{blocksHand,itemsHand,recipesHand,mouldsHand,objectivesHand,specRosterHand}.ts`, `src/core/handValidation.ts`, `src/render/textures/{hand,iconsHand}.ts`, `src/audio/sfxHand.ts`; `docs/api/handwork-content.md`) | done, tested (handwork.test.ts, roster, solver) | Contracts (`ToolKind` hammer, `BlockSpec.handStation`, recipe `strokes`/`toolOutput`/`bonus`, role `hand`, `ItemSpec.mould`, `MOULDS`/`CAST_METALS`/`castOf`, `isHandStation`, constants, events, 6 sfx). Ten stations, 30 items, ~50 recipes (planks, sticks, flour, wire, bronze, bronze tools, padded coat MOVED onto stations; shared inputs are picked by the loaded count), moulds and casting table, 12 goals, 21 block + 30 icon textures, solver rules (molten gating, blooms, cast items). See section 10 of the doc for what differs from the plan. The scripted playthrough has `STAND-IN (handwork sim replaces)` shortcuts and currently stops in the Star Age at `banks charged` (power, not handwork; see report). |
| Ember casting - furnace side (`src/sim/casting.ts`, small edits in `furnace.ts`, `furnaceActions.ts`, `views.ts`, `entities.ts`, `hearth.ts`, `sanitize.ts`, `slots.ts`, `game/inventory.ts` (moulds have pours as durability), `sim/playKit.ts`; furnace screen `castText.ts`, `smeltTab.ts`, `furnaceTabs.css`) | done, tested (`casting.test.ts` 24 sim tests, `castText.test.ts` 5), browser-checked (scratch harness, desktop + phone portrait) | Every smelt of a cast metal (copper, tin, bronze) is MOLTEN in the crucible for 20 s (`crucibleMelt`, `crucibleMoltenS`, `crucibleMix` on the furnace entity, saved and repaired by sanitize), never an ingot in the output slot; `sim.pourCrucible(x,y,z,slot,heldKey)` pours it into a fired mould in the pack (`MOULDS` table, every cast the pool covers, wears the mould, breaks at 0 with `tool:broke`, `cast:poured`, `first_pour`), or pours cold copper/tin ingots into an alloy pot set in the crucible (3 copper + 1 tin at 800 C -> 4 molten bronze). Unpoured metal cools into blooms (smelt them again). Iron and up are unchanged. Furnace screen: the crucible row glows, counts 20 s down, one 'Pour into <mould>' button per fitting mould, 'Add copper/tin' for a pot, tab badge 'n molten'. **Deviations/gaps:** the alloy pot is an ITEM in a crucible slot (the clay furnace has one crucible; the `alloy_pot` BLOCK and `bronze_ingot_alloy` recipe in the data are unused); Casting Bench and hand-taking molten metal for hot work are not built (`openHotWindow` still opens on `cast:poured`). `PlayKit.smelt` pours into stand-in ingot moulds. API: `docs/api/casting.md`. |
| Playtest and review pass (item 10): six review groups, then a release check | done, tested, full `npm run e2e` passing | See "Release state" below for what was reviewed, fixed and is still open. |

## Release state

Checked on 2026-11-21 by the release engineer on branch `ccr-3c8b169f-e78nk2`, after the six review groups had
committed their fixes. Results on the final tree: `npm run typecheck` clean, `npm test` 113 files / 1300 tests
passing, `npm run build` clean, full `npm run e2e` passing: 110 steps, 0 failed (e2e.mjs 60: desktop,
phone portrait and phone landscape 18 each, sandboxed frame 5, no WebGL2 1; e2e-features 24: desktop and phone
portrait 12 each; e2e-tech 26: desktop and phone portrait 13 each; e2e-ember 18: 9 each), about 12 minutes on a quiet machine. The
first full run failed one e2e-features step on phone portrait (fixed below, then the whole suite was rerun).

**Reviewed and fixed** (each group's details, tests and screenshots are in its commit and in `docs/api/*.md`):

- **Sim** (`0ea4099`, sim-1..12): breaking a full machine never loses items (a spill crate takes what the pack
  cannot); `targetTemp` matches where the furnace settles; boiler lines default the boiler end to Pull and say
  how to fix them; the floor under the furnace counts as frame; ignition reports need, supply, storage and cable
  rating and refuses a cable that cannot carry it; a lone furnace reports no problem; hearth plans pick the
  offset with the fewest changes; piped ore fills the emptiest crucible; brown-out alerts only below 90% for 3 s;
  hatch texts; an empty bucket is not fuel; damaged machines and pipes in a save are repaired on load.
- **UI** (`100dc73`, ui-1..8, 11, 12, 14, 16, parts of 10 and 13): compact furnace firebox on phones, tab and
  chip rows that fit at 390 px, fuel and batch buttons that pick sensibly and say what they use, the Structure
  tab after forming, banners that wait for closed screens, honest upgrade sheet texts, refusal toasts, pipe
  screen Pull advice, crop labels, touch coach marks, the day dial.
- **Player, app, save** (`bd9dd36` and part of `e001006`, pa-1..9): Shift + Use and the touch Place toggle
  place against screen blocks (building blocks go on any side but the front); Use reaches a furnace behind a
  cable; full or unreadable storage never deletes a save; taps survive frame stalls; repeated frame errors and
  lost WebGL stop the world with a notice; no redraws behind pause; autosave serialises once.
- **Render** (`1b4aa97`, r-1..3): the light probe reads chunk arrays (7x faster, no garbage); phones default to
  render distance 4; the problem highlight fades when the hearth forms.
- **World and animals** (`066cbb9` and part of `64b5dfa`, wm-1..7): breeding works at a full herd and fed
  animals stay tame; far animals are culled so the world keeps spawning as you explore; animals keep a block
  from lava and cacti and heal; small-integer chunk keys; picked bushes do not pin chunks; drops of an animal
  killed just before a save survive; animals push apart and followers keep 2 blocks away.
- **Game, content, docs** (`3eddfb3` and part of `e001006`, gc-1..5, 7..10): a dry first night with a warmth
  floor; cold warnings and a HUD line that name the cause, and a matching death screen; How to Play and README
  rewritten; bread after the lamp; the bellows goal completes on the first pump; new tools land on the hotbar;
  respawn food 14; breeding foods described.
- **Release check** (this commit): `scripts/lib/e2eFeatures.mjs` `goToOpenGround` now mows every non-solid plant
  around the player, not only `replaceable` ones. Flowers are not replaceable, so on phone portrait an Ember
  Poppy next to the player stayed in the crosshair's way and the lava-bucket step found "no spot in plain sight"
  (deterministic for that seed, not timing; what the step checks is unchanged). How to Play lists Shift + Right
  click / Place + Use. README controls and feature sections brought up to date (feeding, flowing water and
  buckets, boilers and hatches, spill crates, the HUD hint line, kept saves, the three e2e scripts).

**Known issues still open:**

- No 'UI size: Large' setting in the UI yet (the contract `Settings.uiScale` now exists); the touch Mine/Use/Jump captions are 10 px and nine hotbar slots cannot reach 44 px at
  390 px wide (ui-10, needs src/core settings + src/player touch styles).
- The Structure tab does not yet offer the sim's shift buttons (`target.shiftLeft/shiftRight`), the `machines` list
  or `StructureView.note` (sim-7: the sim side is done and documented in `docs/api/hearth.md`; UI work left).
- `FurnaceTierSpec.crucibles` in `src/content/tech.ts` still holds the old per-tier counts; the upgrade sheet uses
  the hearth rule instead (ui-6).
- Use on a formed hearth's wall, hatch or power port does not open the controller's furnace screen (needs a sim
  lookup). On a tap that a late frame already turned into a hold, an instant-break plant can still be broken.
- A spill crate appears from nothing: breaking it again gives a crate item, and with a full pack that crate item
  is lost (never its contents). A clay furnace's single fuel slot stays blocked by an empty bucket until removed.
- Animals still take occasional cactus hurts in dense dunes (2 hurts, no deaths in 30 min with 12 hens).
- `IWorld` in `src/core/types.ts` has no `chunkVoxels`; the light probe (like `src/render/vents.ts`) reaches it
  through an optional cast.
- Over the 350-line aim: `src/sim/hearthScan.ts` (~440), `src/mobs/manager.ts` (~440), `src/game/survival.ts`
  (~470).
- Not done (optional in the briefs): a cheap campfire, a "raise a chick" objective, a vertical tab rail in
  landscape. Save time on a throttled phone was not re-measured after pa-9.
- Spec section 19 (Emberbound hostile automatons): data, AI/spawning/combat (src/mobs), player combat (src/game) and the
  ward beacon (src/sim) are built, and the app/UI wiring is done and checked by `scripts/e2e-ember.mjs` (see
  `docs/api/integration.md`); the renderer's bolt hook is wired too.
- The world flow timing test (`src/world/flow.test.ts`, "under 0.5 ms a tick") has failed once under parallel
  load; it passed in every full run of this release check.
- On phones the first coach mark ("Aim at a tree and hold MINE") sits over the small Place toggle above Mine
  until the player first breaks a block (seen in the e2e-features phone screenshots, where nothing is mined).
- Headless Chromium is slow on software WebGL: tap-to-open steps occasionally need retries (the driver retries).

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
10. **Playtest and review.** (Done - see "Release state".) Drive the built game in headless Chromium like a player on desktop and phone;
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
- **Decisions already made:** drops go straight to the inventory; death keeps the inventory; animals are passive (no hostile creatures until spec 19 is built);
  cable rating of a network = its weakest cable; machines push output into a touching crate; the furnace
  borrows ingredients from crates within 4 blocks; corium is hardness 120 / tier 5 (see
  `docs/api/content.md` for the content engineer's other calls, e.g. bore rig stops at tier-5 blocks).
- **Objective order:** `reach_800` now comes before `make_bronze` (bronze needs 800 C, so the old order
  completed it instantly).
- **Git:** the repository was empty, so `ccr-3c8b169f-e78nk2` is the only branch and there is no pull
  request (nothing to open one against). `.github/workflows/pages.yml` deploys on pushes to `main`, which
  does not exist yet. Several commits are checkpoints of half-written modules and do not build.
- **Checks:** `npm run typecheck`, `npm test` and `npm run build` pass for the whole repository; `npm run e2e`
  (about 15 minutes on software WebGL; run it on a quiet machine) drives the built game through `e2e.mjs`,
  `e2e-features.mjs` and `e2e-tech.mjs`.

<!-- ======================== END HANDOFF.md ======================== -->


---

<!-- ======================= BEGIN docs/PROGRESSION.md ======================= -->
# FILE: docs/PROGRESSION.md

# Hearthwatt - the progression plan

The complete path from bare hands to the Starhearth, in six ages. **[built]** = in the game today;
**[planned]** = designed, not built; **[change]** = alters something built. Numbers for planned parts are
starting values. Detailed plans: `docs/EMBER_PLAN.md` (the handwork age), `docs/STEAM_PLAN.md` (first half of the
Bronze Age: shafts, speed and stress), `docs/BREWING_PLAN.md` (tea and coffee), `docs/BRONZE_PLAN.md` (second half of the Bronze Age), `docs/SPEC.md` (rules of everything built). The Codex page
shows this progression as a tree.

Note on numbering: **BRONZE_PLAN work item W0 is done** - the game has six ages and six furnace tiers (Ember 0 / Clay 1,
Bronze 1 / Bronze Furnace 2, Forge 2 / Blast hearth 3, Current 3 / Arc 4, Atomic 4 / Plasma 5, Star 5 / Starhearth 6).
The gate table, the migration and the constants are in `docs/api/ages.md`.

## 1. The spine: one furnace, six energy forms

| Step | Energy form | Made from | Age | Carried by | Measured in |
|---|---|---|---|---|---|
| 1 | Heat | fuel in the furnace | Ember | the furnace; from Bronze on, thermocouples | degrees C, kW |
| 2 | Open steam and rotation | heat + water in a copper kettle, flowing water, wind | Bronze (first half) | wooden axles, cogs | rpm and stress |
| 3 | Pressure steam | heat into a sealed boiler | Bronze | steam pipes | bar |
| 4 | Compressed air | rotation into a compressor | Bronze | air tubes | bar |
| 5 | Electricity | rotation into a dynamo, later direct | Forge (end) | cables | watts |
| 6 | Fission, then fusion | electricity-built machines | Atomic, Star | cables | kW to MW |

Player's rule of thumb: **heat makes steam, steam makes motion, motion makes air and - much later - watts.**
Every conversion is a block in the world you can watch working.

## 2. The six ages at a glance

| # | Age | Furnace | Max C | What it is about | Electricity |
|---|---|---|---|---|---|
| 0 | Ember | Clay Furnace (1 block) | 800 | HANDWORK: fire, copper, tin, casting, hand stations, food, brewing - no steam, no machines | none |
| 1 | Bronze | Bronze Furnace (1 block) | 1100 | steam begins: kettle and rotor, shafts with speed and stress, then heat rods, the boiler, pressure, pneumatics | none |
| 2 | Forge | Blast hearth (multiblock, needs a blast nozzle) | 1500 | iron, steel, heavy factory machines; the dynamo at the end | first watts |
| 3 | Current | Arc hearth | 2100 | electric heating, grid, electronics, turbines | kW |
| 4 | Atomic | Plasma hearth | 3200 | superalloy, fission, heavy water | tens of kW |
| 5 | Star | Starhearth | - | ignition: 300 kW for 90 s | 1 MW |

## 3. Age by age

### Age 0 - Ember (Clay Furnace, to 800 C) - about 45 minutes

- **Arrive with:** nothing. Spawn always has trees, stone, clay, gravel, water, wild wheat and an Old Works
  ruin within reach. **[built]**
- **Find:** logs, flint, rubble, clay, copper and tin ore, peat, wild wheat/potato/carrot, berries, animals
  **[built]**; wild tea bushes and coffee shrubs **[planned]**.
- **Tools:** flint, then bronze (pickaxe, axe, shovel, hoe, maul, bucket). **[built]**
- **Furnace:** single block from the workbench. Sticks 450, logs 650, peat 900, charcoal 1000; hand bellows add
  up to 250. Copper 700, bronze 800. **[built]**
- **Food:** hunting, cooking in crucibles, hoe farming, flour, dough with a water bucket, bread, hearth stew.
  **[built]**
- **Brewing [planned, BREWING_PLAN]:** grow and harvest tea and coffee; dry or roast in a crucible; a water
  bucket set on top of the furnace boils; cup + drip cone + leaves or grounds; pour the boiling water; drink
  - six drinks, each its own 3-minute boost: Green Tea (jump), Black Tea (warmth), Berry Tea (healing), Light
  Roast (speed), Dark Roast (mining), Trail Blend (hunger). One tea and one coffee boost at a time. The kettle
  also gives boiling water (the Ember Kettle Pot, not the Bronze Copper Kettle); any future container works too.
- **Handwork [planned, EMBER_PLAN] - the age is manual (owner: "ember era should feel very manual and like
  you're making a bunch of different stuff"):** no steam, no shafts, no machines. Hand stations worked stroke by
  stroke: Chopping Block, Hand Quern, Stone Anvil, Mortar, Clay Table, Casting Bench with moulds, Drying Rack,
  Tanning Trough, Loom, the Kettle Pot (boils water only). Metal is POURED from the crucible into moulds; bronze
  is alloyed in a pot. Leather and cloth.
- **Logistics:** carry it; crates. **No item pipes in this age** - the Bronze Chute moved to the Bronze Age.
  **[change]**
- **Threats:** cold nights, hunger, Cinder Mites in the dark, Forge Wardens and Kiln Sentries at ruins. A hot
  furnace's warm zone and torchlight are safe. **[rules built; visuals and wiring in progress]**
- **Goals, in order:** gather wood - planks - workbench - flint - flint pickaxe - rubble - clay - place
  furnace - light it - charcoal - get warm - cook a meal - eat - *clay table* - *fire a mould* - smelt copper - *first pour* - *hand quern* - till soil - plant wheat - *stone
  anvil* - reach 800 C - *alloy bronze* - *cast a bronze pickaxe head* - forge a maul - salvage an automaton - bake bread - *boil a
  bucket* - *brew a cup*. (Italics = planned goals.)
- **Gate:** the furnace screen shows its upgrade list from the start; fill it to enter the Bronze Age: 8 bronze
  ingots, 4 firebricks, 1 bellows, 2 bronze plates, 1 leather at 700 C. From here on every age is opened by the
  furnace's upgrade list. **[planned]**

### Age 1 - Bronze (Bronze Furnace, to 1100 C) - about 45 minutes  [Furnace, workshop and Essentia pieces built; the rest planned, BRONZE_PLAN]

- **Furnace [built, W0]:** still one block; 1100 C, two crucibles; the Clay Furnace upgrades in place (8 bronze ingots, 4 firebrick, a bellows, fire at 700 C), no hearth.
- **Built here already:** the Bronze workshop (cranks, shafts, belts, machines, contraptions), the Hand Vacuum Pump, and the Rune Desk, Essentia Tube and Arcane Pedestal with the bronze gathering rod and its foci - all forged at the Bronze Furnace.
- **Steam begins (first half of the age, STEAM_PLAN):** Copper Kettle (not the Ember Kettle Pot, which only boils
  water) + Steam Rotor, Water Wheel, Windmill, wooden axles and cogs; SPEED and STRESS; Millstone, Saw Bench,
  Trip Hammer, Shaft Bellows, Mechanical Pump and Drill; the Millstone, Saw Bench and Trip Hammer automate the
  Ember hand stations (Hand Quern, Chopping Block, Stone Anvil). Clutch, Flywheel, gauges.
- **Heat moves:** Thermocouples carry furnace (or lava) heat to Hot Plates, Heat Vents and boiler Heat Ports:
  2% lost per block, 6 kW per line; they glow by temperature and burn to the touch. The furnace stays the only
  origin of heat.
- **The boiler - first multiblock:** a sealed box of Boiler Plate standing apart from the furnace, with a Gauge
  Glass, Heat Port, Water Port and Steam Port, built from a ghost preview in the Structure planner.
- **Pressure:** steam in bronze pipes, measured in bar; Pressure Gauges; Safety Valves; above 8 bar with no
  valve the weakest part bursts after a 5-second warning. Boiling dry warps the vessel.
- **Piston power:** the Steam Engine gives 16 rpm and 128 stress capacity per bar onto the shaft lines of the
  first half of this age. Steam Hammer, Steam Whistle.
- **Pneumatics:** Air Compressor on a shaft, Air Tubes, Air Tank (to 6 bar; open ends leak). Pneumatic Press,
  Pneumatic Drill, the Air Hammer hand tool, the Blast Nozzle.
- **Items move:** the Bronze Chute does nothing alone; a Vacuum Pump on the chute network (fed with air) draws
  items from every chute end toward itself and delivers them where it stands.
- **Threats:** scalding and bursts; Bellows Hounds at night.
- **Goals, in order:** Bronze Furnace - boil water - set it turning - grind - gear up - saw planks - shaft bellows
  (STEAM_PLAN) - move the heat - build a steam boiler - raise steam - fit a safety
  valve - piston power - compress air - pneumatic post (vacuum chute) - press plates - forge a blast nozzle.
- **Gate:** brick walls around the furnace with a Blast Nozzle in one wall, fed by air at 2 bar: the Blast
  hearth forms.

### Age 2 - Forge (Blast hearth, to 1500 C) - about 55 minutes

- **Find:** coal, iron, limestone, sulfur, oil shale; lava with the bronze bucket. **[built]**
- **Hearth:** brick multiblock 1x1x1 to 3x3x3 inside, more crucibles and speed with size, hatches **[built]**;
  requires a Blast Nozzle **[planned]**. Coal 1250, coke 1550, lava bucket 1300, ember core 1700. Iron 1150,
  steel 1400.
- **Heavy industry [planned]:** iron axles (128 rpm), then steel (256); Rolling Mill, Drop Forge, shaft- or
  steam-driven Crusher; iron thermocouples (20 kW); steel boilers and pipes (16 bar).
- **Fluids:** iron and steel pipes, pump, tanks. **[built]**
- **First electricity, at the END of the age [planned / change]:** the Dynamo turns shaft rotation into up to
  2 kW; the Thermopile moves here; copper cable, lamps, the Acid Battery. **[cable, lamp, battery built]**
- **Defence:** iron and steel mauls, plated coat, steel cuirass. **[data and rules built]**
- **Goals, in order:** Blast hearth - smelt iron - heavy machines (rolling mill) - steel - make electricity
  (dynamo) - place a lamp - crusher - a machine finishes a job - generate 2 kW - store 1 MJ.
- **Gate:** refractory brick shell with an Arc Electrode in the roof, and a grid that can feed 8 kW.
  **[built]**

### Age 3 - Current (Arc hearth, to 2100 C) - about 60 minutes

- **Find:** quartz, bauxite, wolframite, spodumene, oil pools. **[built]**
- **Hearth:** electric heating; silicon 1700, tungsten 2000. **[built]**
- **Power:** the modern Steam Turbine turns steam straight into electricity **[built]** (decided: only the
  Bronze steam devices drive shafts; no alternator); wind, solar, combustion, geothermal with built-in generators
  **[built]**. Storms boost wind and bring Arc Drones; cloud and rain cut
  solar. **[built]**
- **Machines:** still, bore rig, fast item pipes, heavy cable, circuits, Ward Beacon, arc maul. **[built]**
- **Goals:** Arc hearth - pump water - reach 1900 C - circuits - generate 10 kW - ward your base - tungsten.
- **Gate:** plasma casing shell with two power ports, 40 kW available. **[built]**

### Age 4 - Atomic (Plasma hearth, to 3200 C) - about 60 minutes  [built]

Superalloy, fused quartz, power drill, shield suit, centrifuge, fuel rods, Fission Pile (60 kW, water-cooled),
electrolyzer and deuterium, Lithium Bank, superconducting lines; the Slag Colossus in the deep.
**Goals:** Plasma hearth - superalloy - fission pile - 60 kW - deuterium - star core.
**Gate:** star casing shell with four power ports (93 casings - under review), a star core, 8 deuterium cells.

### Age 5 - Star (Starhearth)  [built]

Hold 300 kW for 90 seconds on a line that can carry it. Then 1 MW forever, every recipe at any heat.

## 4. Requirements and complexity

The Codex "Item map" places every built item by crafting steps and furnace tier with its raw cost (181 items
today; the planned ages add roughly 14 early-Bronze mechanics items, 12 brewing items and 25 Bronze items, nearly all
at steps 1-3 of the first two ages).

## 5. Build order across the plans

1. Finish the Emberbound (visuals, screens, wiring, e2e) - in progress.
2. BREWING_PLAN - independent, small; can go first.
3. BRONZE_PLAN W0 - six tiers and ages (pure refactor, with a save migration) **[done]**.
3b. EMBER_PLAN - hand stations, casting, leather and cloth; move instant recipes onto stations.
4. STEAM_PLAN waves - open steam and shafts (first half of the Bronze Age; after W0).
5. BRONZE_PLAN B1-B4 - heat, boiler, pressure, air, vacuum chute.
6. Forge heavy industry and the dynamo (to be planned in the same detail once Bronze is in).
Each step ends with the full test suite, a review pass, and a republished game and Codex.

## 6. Decisions

Made by the owner: the Ember Age is manual handwork with no steam (steam, shafts, speed and stress begin in the
Bronze Age); from Bronze on each age is opened by the furnace's upgrade list; a separate Bronze Age
with pressure, pneumatics and thermocouples; the Bronze Furnace is one block and the steam boiler is the first
multiblock; the Bronze Chute lives in the Bronze Age and needs a Vacuum Pump; brewing is Ember; hand recipes
are also at the workbench; buckets take source blocks and water flows; enemies are the Emberbound.

Also decided: every tea and coffee variety gives its own boost; tea and coffee are regrowing bushes; the
kettle and any future container give boiling water; steam drives shafts in the Bronze Age (rotor, then piston engine) and the
modern Steam Turbine (Current Age) converts straight to electricity; the Ember Kettle Pot (brewing) is a different
block from the Bronze Copper Kettle (steam).

Still open:
1. Star hearth: keep 93 casings or reduce?

Note on items in the world: broken blocks, animals and spills drop as ground items that fly to the player in reach; the Bronze Age
Hand Vacuum Pump pulls them from nine blocks, and the Current Age Electromagnet is planned to do the same electrically
(`docs/api/ground-items.md`).

<!-- ======================== END docs/PROGRESSION.md ======================== -->


---

<!-- ======================= BEGIN docs/EMBER_PLAN.md ======================= -->
# FILE: docs/EMBER_PLAN.md

# The Ember Age - hands and fire (plan)

Nothing here is built unless marked. Companion plans: `docs/BREWING_PLAN.md` (part of this age),
`docs/BRONZE_PLAN.md` (where steam, shafts and automation begin), `docs/PROGRESSION.md`.

## 1. The owner's words

- "again, steam is a bronze age thing"
- "ember era should feel very manual and like you're making a bunch of different stuff, in bronze era the
  upgrades start becoming clear the forge is to be upgraded as the eras ask it to with the item costs"

What follows:
1. **No steam, no shafts, no pipes, no electricity in the Ember Age.** Everything in STEAM_PLAN (kettle-driven
   rotor, axles, cogs, speed and stress, shaft machines, water wheel, windmill) moves to the BRONZE AGE.
2. **Ember is handwork.** Many small stations, each worked by the player's own strokes, each making a
   different kind of thing. Breadth, not automation. The reward for reaching Bronze is that machines start
   doing these same jobs for you.
3. **The furnace upgrade ladder is introduced at the END of Ember and is the spine from Bronze on:** each age
   asks for a clear list of items to upgrade the furnace, shown on the furnace screen from the first minute
   ("Next: Bronze Furnace - 8 bronze, 4 firebrick, 1 bellows"), and the list is the age's shopping list.

## 2. Manual work - one mechanic for every hand station

A hand station holds an input and shows a work bar. Each USE on it (click / tap; holding Use repeats at the
station's stroke rate) is one STROKE: a sound, a small animation on the block, and progress. After N strokes
the output appears in the station (take it with Use on an empty hand, or it pops into the pack if the station
has no slot). The right tool in hand makes strokes count double. Strokes cost a little food (0.01 each).

| Station | Made | Tool that doubles | Jobs (strokes) |
|---|---|---|---|
| Hand Quern | workbench: 2 stone_brick, 1 stick | - | wheat -> flour 1:1 (6); roasted beans -> ground coffee (6); dried tea + berries -> berry blend (4) |
| Chopping Block | hand: 1 log | axe | log -> 4 planks (3) [with axe 6 planks]; plank -> 4 sticks (2) |
| Stone Anvil | workbench: 3 stone_brick | hammer (new: flint_hammer, bronze_hammer) | copper/bronze ingot x2 -> plate (8); copper ingot -> 3 wire (6); HOT work: items straight from a crucible count as hot for 20 s and need half the strokes |
| Mortar | forge 400 C: 1 clay | - | copper/tin ore -> 1 crushed + 35% second (8) - slow ore stretching; charcoal -> pigment-free: skip |
| Drying Rack | hand: 3 stick, 1 cord | - | no strokes: time + open sky by day: tea leaves -> dried tea (60 s), hide -> leather (120 s), tall grass -> fiber x2 (30 s); rain resets |
| Tanning Trough | workbench: 4 plank + water bucket | - | hide -> soaked hide (wait 60 s) then Drying Rack -> leather |
| Loom | workbench: 4 plank, 2 stick, 2 cord | - | 4 fiber -> cloth (10) ; padded coat now needs cloth |
| Clay Table | workbench: 2 plank, 1 clay | - | shape clay by strokes into UNFIRED cup, cone, pot, crucible, brick mould, tool moulds (4 each); fire them in the furnace |
| Casting Bench | forge 400 C: 2 fired mould... (1 clay) | - | pour: a crucible's molten metal into a mould = tool head / ingot / nozzle; knock out with Use |
| Bellows (on the furnace screen) | built | - | pump by hand, as today |
| Kettle Pot | forge 600 C: 3 copper_ingot | - | sits on the furnace: boils water for brewing and stew (NO steam power in this age) |

Keep the existing instant recipes that these replace as slower fallbacks? No: move them (planks at the block,
flour at the quern, plates at the anvil) so the stations matter; hand/workbench keep cord, tools, torches,
the stations themselves and the furnace.

### Casting (makes metal tools feel made)
- Crucible output is MOLTEN for 20 s after a smelt completes (the crucible slot glows). Taking it with a fired
  MOULD in hand pours that shape: ingot mould -> ingot; pickaxe/axe/shovel/hoe/maul head moulds -> tool head;
  no mould -> it cools into a rough "bloom" that must be re-smelted. Moulds are reusable (40 pours).
- Tool = head + 2 sticks + cord at the workbench (hand recipe). Bronze alloy: pour 3 copper + 1 tin into the
  ALLOY POT (a fired pot set in a crucible slot) - replaces the instant bronze forge recipe.
- The furnace stays the centre: every chain passes through it (fire clay, smelt, pour), the hand stations
  stand around it.

## 3. What is in the age (complete list)

Built today and staying: gathering, flint and bronze tools, the Clay Furnace with fuels and hand bellows,
charcoal, firebrick, glass, cooking, farming, flour and dough and bread, stew, buckets and flowing water,
animals, warmth, hunger, the Emberbound basics (mites, ruin guards), mauls, torches, crates, the Hearth Log.
Planned for the age: the hand stations of section 2, casting and moulds, leather and cloth, brewing
(BREWING_PLAN: six drinks; the Kettle Pot or a bucket on the furnace boils water).
Removed from the age: Bronze Chute and wrench (Bronze), thermopile and lamp (Forge), any generator.

## 4. Goals of the age (in order)

gather wood - chopping block - planks - workbench - flint - flint pickaxe - rubble - clay - place furnace -
light it - charcoal - get warm - cook a meal - eat - clay table - fire a mould - smelt copper - first pour
(cast an ingot) - hand quern - till soil - plant wheat - grind flour - bake bread - stone anvil - hammer a
plate - reach 800 C - alloy bronze - cast a bronze pickaxe head - forge a maul (cast) - salvage an automaton -
drying rack - boil water - brew a cup - loom - "The furnace wants bronze" (hold the Bronze Furnace upgrade
list: 8 bronze_ingot, 4 firebrick, 1 bellows, 2 bronze_plate, 1 leather) -> upgrade = Bronze Age.

## 5. Implementation notes

- Contract: `BlockSpec.handStation?: { strokesPerS: number; tool?: ToolKind }`; recipes with
  `station: '<station key>'` and `strokes: number`; MachineRole 'hand' (no power; has slots; opens no screen -
  the world interaction IS the interface; aiming shows "Hand Quern - wheat 3/6 strokes" as the target name).
- Sim (`src/sim/handWork.ts`): entity { input: Slot, output: Slot, progress: number, recipe: string | null };
  action `stroke(x,y,z, heldKey) -> { ok, reason?, done? }`:
  ```
  stroke(st, held):
    if st.output and not empty-hand-take: refuse "Take the " + name first
    if held is a valid input and (st.input empty or same item): move 1..stack into st.input; return ok
    r = recipeFor(st.kind, st.input.item); if !r: refuse "Nothing to work"
    if st.input.count < r.inputs[0].count: refuse "Needs " + n + " " + name
    st.progress += (held is st.tool or hotBonus(st) ? 2 : 1)
    player.food -= 0.01; sfx(st.strokeSound, pitch jitter); emit 'hand:stroke' (render: bounce the block part)
    if st.progress >= r.strokes: consume inputs; st.output = r.output; st.progress = 0; flagOnce(...)
  ```
  Holding Use repeats through the player's existing use-repeat (0.25 s) - set per station via strokesPerS.
- Drying rack / trough: timers on the entity, sky and rain checks like crops (`cropRules` open-sky cache).
- Casting: FurnaceEntity crucible gets `moltenS` (20 s countdown after each completed smelt); taking output
  with a mould in hand picks the cast item via `MOULDS[mouldKey][metal]`; mould durability on the stack.
- Player: Use priority adds "hand station" right after brewing blocks; touch = tap for a stroke, hold repeats.
- Render: each station has a small animated part (quern stone turns 30 degrees per stroke, hammer mark flash,
  loom shuttle) through the machine-parts layer with an event-driven impulse instead of a speed.
- Tests: stroke counts with and without tools, hot-work bonus window, refusals, rack timing with rain, casting
  matrix, bloom fallback, solver: age completable with zero machines; e2e: quern flour and a cast pickaxe head
  on a phone.

<!-- ======================== END docs/EMBER_PLAN.md ======================== -->


---

<!-- ======================= BEGIN docs/BREWING_PLAN.md ======================= -->
# FILE: docs/BREWING_PLAN.md

# Tea and coffee - brewing plan (Ember Age)

Design and implementation spec for brewing. Nothing here is built. It belongs to the EMBER AGE (owner: "the
brewing can be done at ember era") and needs only the Clay Furnace. Companion plans: `docs/STEAM_PLAN.md`,
`docs/BRONZE_PLAN.md`, `docs/PROGRESSION.md`. Function names inside files must be checked against the code
before use; file and module names are as they are in the repository today.

## 0. The owner's words

- "there should be a way to make tea and coffee by boiling water collected in a bucket placed upon a furnace
  then a drip coffee item must be placed and then with coffee or tea in hand placed on a cup with tea drip
  coffee item on top and one must grab the boiling water and use it on the setup to brew coffee. gives speed
  boost and jump boost"
- "after of course harvesting the grown crop of such type"
- "the brewing can be done at ember era"

DECIDED by the owner (these override anything below that disagrees - see section 11 for the details):
1. "different types of tea and coffee give different types" of boost: varieties, each with its own effect.
2. Tea and coffee are regrowing bushes.
3. The kettle also gives boiling water - "and if we ever add bowls or other containers, those too": boiling
   water is a property of CONTAINERS, not of the bucket alone.

## 1. Player-facing rules

1. Pick wild tea bushes and coffee shrubs, plant them, harvest them when ripe. They regrow like the berry bush.
2. Dry leaves or roast cherries in a furnace crucible. Grind roasted beans at the workbench (or the millstone).
3. Place a Water Bucket on top of a hot furnace. It becomes boiling water.
4. Place a Clay Cup on a surface and a Drip Cone on the cup. Use tea leaves or ground coffee on the cone.
5. Pick up the boiling bucket and use it on the setup. It drips for 4 seconds. You get the empty bucket back.
6. Take the cup and drink. Coffee gives speed, tea gives jump. The cup and cone are reusable.

The growing chain in full: find it wild (tea in marsh and woodland edges, coffee in warmer woodland near the
dunes) -> picking gives leaves or cherries plus sometimes a cutting -> plant the cutting -> it grows in stages
in daylight or under a powered lamp, faster near water or in rain -> harvest -> process -> brew.

## 2. Contracts (src/core, append only)

```ts
// types.ts
export interface DrinkSpec { buff: 'swift' | 'spring'; buffS: number; warmth?: number; hunger?: number }
// ItemSpec gains: drink?: DrinkSpec
// MachineRole gains: 'brew'   (cup setup and the bucket on a furnace; no power, no machine screen)
// BlockShape gains: 'cup', 'bucket'

// gameEvents.ts
// BuffName gains 'swift' | 'spring'
// events: 'brew:started' {x,y,z,drink}, 'brew:done' {x,y,z,drink}, 'water:boiling' {x,y,z}, 'player:drank' {item}
// flags:  FLAG_BOILED_WATER, FLAG_BREWED
// SfxName: 'boil_bubble', 'pour', 'drip', 'sip'

// constants.ts
BOIL_TEMP_C = 100          BOIL_SECONDS = 12        BOIL_DRY_SECONDS = 180
BREW_SECONDS = 4           BOILING_KEEPS_S = 90     // a carried boiling bucket cools back to water
SWIFT_SPEED_MULT = 1.2     SPRING_JUMP_MULT = 1.35  DRINK_BUFF_S = 180
DRINK_COOLDOWN_S = 1
```
Exhaustive tables that need a new entry in the same change: machine role labels in
`src/ui/screens/machines/machineScreen.ts`, the sound table in `src/audio/sfx.ts`, buff labels in the HUD,
block shapes in `src/world/blockTables.ts`.

## 3. Content (src/content)

**Blocks**

| Key | Shape | Notes |
|---|---|---|
| tea_bush, tea_bush_bare | cross | role bush, `regrowS: 360`, `harvestLeaves: 'tea_bush_bare'`. Drops 2-3 tea_leaves, 25% tea_cutting. |
| coffee_shrub, coffee_shrub_bare | cross | same pattern. Drops 2-3 coffee_cherries, 25% coffee_cutting. |
| clay_cup | cup | not solid, 6/16 wide, 5/16 tall, `placeOn` any solid top. Machine kind `brew_cup`. |
| cup_cone, cup_cone_tea, cup_cone_coffee, cup_tea, cup_coffee | cup | states of the same cell; `item: false`; each drops what the state holds. |
| furnace_bucket, furnace_bucket_boiling | bucket | only on top of a furnace or a hearth roof. Machine kind `boil_bucket`. `item: false`. The boiling one steams. |

**Items**: clay_cup (block item), drip_cone, tea_cutting, coffee_cutting (place the bare bush on farmland or
grass), tea_leaves, dried_tea, coffee_cherries, roasted_beans, ground_coffee, boiling_pail (stack 1, like
water_pail), tea and coffee (stack 1; `drink: { buff: 'spring' ... }` / `{ buff: 'swift' ... }`; drinking
returns clay_cup).

**Recipes**
- Furnace FORGE, tier 1 (clay already smelts to firebrick and smelt inputs must be unique, so these are forge
  recipes): clay_cup x2 <- 1 clay at 400 C; drip_cone <- 1 clay + 1 fiber at 400 C.
- Furnace SMELT, tier 1: dried_tea <- tea_leaves, 150 C, 5 s; roasted_beans <- coffee_cherries, 220 C, 8 s.
- Workbench: ground_coffee <- 2 roasted_beans. Millstone (Bronze Age, STEAM_PLAN): ground_coffee <- 1
  roasted_beans.

**Other content work**
- Worldgen: tea bushes in marsh and woodland edges, coffee shrubs in woodland near dunes, small patches,
  placed by the same deterministic flora pass as berry bushes (`src/world/flora.ts` / `plants.ts`).
- Goals, after `bake_bread`: `boil_bucket` ("Boil a bucket", flag FLAG_BOILED_WATER) and `first_brew` ("Brew a
  cup", flag FLAG_BREWED).
- Solver and roster: both drinks reachable at tier 1. Regrowth already works for role bush in CropField.
- Textures: bushes (4), cup states, cone, bucket on furnace (2), icons for every item.

## 4. Simulation (src/sim, new file brewing.ts)

Entities (plain JSON, created from 'block:changed' like every machine):
```ts
BoilBucket { kind: 'boil_bucket', x, y, z, heatS: number, boiling: boolean, dryS: number }
BrewCup    { kind: 'brew_cup',   x, y, z, stage: 'cup' | 'cone' | 'loaded' | 'brewing' | 'done',
             drink: 'tea' | 'coffee' | null, brewS: number }
```
The block id is the source of truth for the look; the entity holds timers. Both kinds are excluded from the
machine node set, as crops are, so they never appear in grids or open a machine screen.

**Boil tick** (once per tick per bucket)
```
furnace = furnaceBelow(x, y-1, z)          // same lookup the boiler and steam engine use,
                                           // including a formed hearth's roof cell via shellOwner
T = furnace ? furnace.tempC : AMBIENT
if !boiling:
    heatS = T >= BOIL_TEMP_C ? heatS + dt * clamp((T-100)/200 + 0.5, 0.5, 2) : max(0, heatS - dt)
    if heatS >= BOIL_SECONDS:
        boiling = true; swapBlock('furnace_bucket_boiling'); emit water:boiling; flagOnce(FLAG_BOILED_WATER)
else:
    if T < BOIL_TEMP_C - 20: boiling = false; heatS = BOIL_SECONDS * 0.5; swapBlock('furnace_bucket')
    else dryS += dt
    if dryS >= BOIL_DRY_SECONDS: removeBlock(); giveOrLeave('pail'); toast "The bucket boiled dry"
furnace.extractW += boiling ? 300 : 600 * (T >= 100)     // small heat draw, shown on the firebox panel
```

**Brew tick**
```
if stage == 'brewing':
    brewS += dt
    every 0.5 s: sfx 'drip' at position
    if brewS >= BREW_SECONDS:
        stage = 'done'; swapBlock(drink == 'tea' ? 'cup_tea' : 'cup_coffee')
        emit brew:done; flagOnce(FLAG_BREWED); sfx 'smelt_done' pitched up
```

**Player action** on Simulation, returning `{ ok }` or `{ ok: false, reason }`:
```
brewUse(x, y, z, heldKey) -> { ok, held?: string | null, give?: string, reason?: string }

switch (blockAt(x,y,z), heldKey):
  clay_cup        + drip_cone         -> block = cup_cone; consume 1
  cup_cone        + dried_tea         -> block = cup_cone_tea; drink = 'tea'; consume 1
  cup_cone        + ground_coffee     -> block = cup_cone_coffee; drink = 'coffee'; consume 1
  cup_cone_*      + boiling_pail      -> stage = 'brewing'; held = 'pail'; sfx 'pour'; emit brew:started
  cup_cone_*      + water_pail        -> refuse "The water must be boiling - heat the bucket on the furnace"
  cup_cone_*      + anything else     -> refuse "Pour boiling water over it"
  cup_tea|coffee  + empty hand or any -> block = cup_cone (cone stays); give 'tea' | 'coffee'
  brewing         + any               -> refuse "Still dripping"
  furnace_bucket_boiling + empty/any  -> remove block; give 'boiling_pail'
  furnace_bucket  + any               -> remove block; give 'water_pail'
```
The furnace top is the one case decided in src/player: holding water_pail and aiming at the TOP face of a
furnace or hearth roof places `furnace_bucket` instead of pouring a water source.

Cooling in the pack: boiling_pail reverts to water_pail after BOILING_KEEPS_S. Store the seconds remaining in
the stack's `durability` field (shown as a heat bar); tick it down in Survival.

## 5. Player (src/player)

Use priority in `Interaction.use` (new entries marked NEW):
1. Animal under the crosshair with a liked item.
2. NEW Brewing blocks (cup*, furnace_bucket*): call the injected `brew.use(...)` callback.
3. NEW Water bucket aimed at a furnace top: place `furnace_bucket`.
4. Wrench and bucket on pipes or tanks.
5. Stations and machines open their screens.
6. NEW Held item with `drink`: drink it.
7. Food, planting, placing.

Drinking: a `drinkCooldown` timer like the swing timer; `Buffs.grant('swift', 180)` like Hunger's Well-Fed.
Emits player:drank, plays sip, returns the cup to the same slot.

Buffs in physics: `physics.ts` multiplies walk, sprint and swim speed by 1.2 while Swift, and JUMP_VELOCITY by
1.35 while Spring. Fall damage must not get worse: add (mult^2 - 1) x normal jump height to SAFE_FALL while
Spring is active.

## 6. World and render

- Mesher: shapes `cup` and `bucket` are small boxes like the torch; the cone is a second inverted box on top;
  tea and coffee states show a dark liquid quad at the rim; the boiling bucket's top quad uses the liquid
  shimmer flag.
- Emitters: steam wisps over `furnace_bucket_boiling` and over a cup for 20 s after brew:done; drips are
  1-pixel particles from cone to cup while brewing.
- Target boxes: real small bounds in `src/render/target.ts`, padded to at least 8/16 so they are tappable on a
  phone.

## 7. UI and audio

- HUD: buff chips "Swift 2:41" and "Spring 2:41" beside Well-Warmed and Well-Fed; compact glyph-and-time form
  on phones when more than two are active.
- Target name shows the state: "Cup with drip cone - add tea or ground coffee", "Brewing 3 s", "Coffee - take
  it", "Water Bucket - 8 s to the boil".
- Tooltips and recipe rows: "Swift 3 min" / "Spring 3 min", like "+N food".
- How to Play: one card with the steps.
- Audio: the four sounds; the bubbling is an ambience field `boil: 0..1`, not repeated one-shots.

## 8. The hardest parts

- **Multi-step interaction on a tiny stacked block, touch first.** The whole flow is taps on one cell, the
  held item decides the step. The risk is a tap doing the wrong thing (pouring a source next to the cup,
  eating, placing a block on top). The priority list in 5 and the single `brewUse` table handle it; every
  refused combination returns a sentence that says what to do next.
- **A bucket as a placed, heated block.** Buckets are items today. Furnace-top placement must work on a single
  furnace and on a formed hearth's roof, survive the furnace upgrading in place, and return the bucket if the
  furnace is broken. Hook `boil_bucket` into the same "machine above a furnace" refresh the steam engine and
  boiler use, and into removeMachine's return-contents path.
- **Boiling water that cools in the inventory.** A timer on a stack is new. Reusing `durability` avoids a save
  change but the inventory UI must draw it as a heat bar and stacking must stay off.
- **Jump boost without breaking movement.** Add tests: jump apex with and without Spring; no fall damage from
  a boosted jump on flat ground; sprint with Swift while Hungry stays refused.
- **Six blocks for one cup.** State is in block ids so the mesher and saves need nothing special; the cost is
  more textures and one exhaustive stage <-> block key table, kept in `src/core` so sim, player and UI agree.

## 9. Tests and acceptance

- **Sim:** boil timing at 150 C and 400 C; cooling below 80 C; boil-dry returns the bucket; every row of the
  `brewUse` table incl. refusals; brew timer and events fire once; save/load mid-brew and mid-boil; furnace
  broken under a boiling bucket.
- **Game:** buffs grant, refresh, expire, save; the pail cools.
- **Player:** priority order (animal beats cup, cup beats placing); water bucket on a furnace top places the
  bucket, not a water source; physics tests above.
- **Content:** solver reaches both drinks at tier 1; bushes regrow.
- **End to end** (desktop and phone portrait, real input): harvest a ripe tea bush; dry leaves in the
  crucible; bucket on a lit furnace boils; cup, cone, leaves, pour; wait 4 s, take, drink; the HUD shows
  Spring and a measured jump is higher; the same for coffee measuring walking speed. Look at the screenshots.

## 10. Order of work

One engineer can do it all in this order, each step green: contracts + content + textures + sounds ->
`brewing.ts` + tests -> player priority + physics buffs + tests -> mesher shapes, emitters, target boxes ->
HUD chips, target names, How to Play -> worldgen bushes -> e2e step in `scripts/e2e-features.mjs`.
It does not depend on the steam or Bronze plans; do it before or after them. If the six-tier refactor
(BRONZE_PLAN W0) has landed, "tier 1" is still the Clay Furnace.

## 11. Owner decisions in detail (override sections 1-9 where they differ)

### 11.1 Varieties - each drink its own boost
Six drinks from the two bushes. Processing decides the variety; all brew the same way (cup, cone, pour).
Smelt inputs stay unique (each item has one crucible recipe).

| Drink | Made from | How the ingredient is made | Buff (3 min) | Effect |
|---|---|---|---|---|
| Green Tea | dried_tea | tea_leaves in a crucible, 150 C, 5 s | Spring | jump x1.35 |
| Black Tea | black_tea | dried_tea in a crucible, 250 C, 6 s | Hearthkept | warmth drain x0.5, +10 warmth on drinking |
| Berry Tea | berry_tea_blend | workbench: 1 dried_tea + 2 wildberries | Mending | health regeneration x2 |
| Light Roast | ground_coffee | coffee_cherries -> roasted_beans 220 C 8 s; ground | Swift | walk, sprint, swim x1.2 |
| Dark Roast | ground_dark_coffee | roasted_beans -> dark_beans 400 C 8 s; ground | Vigor | mining speed x1.25 |
| Trail Blend | trail_blend | workbench: 1 ground_coffee + 1 ground_dark_coffee -> 2 | Lasting | food drain x0.5 |

- Contract change: `DrinkSpec.buff` becomes `'spring' | 'hearthkept' | 'mending' | 'swift' | 'vigor' | 'lasting'`
  (BuffName gains the same six). Buff numbers live in constants (`SPRING_JUMP_MULT`, `HEARTHKEPT_DRAIN_MULT`,
  `MENDING_REGEN_MULT`, `SWIFT_SPEED_MULT`, `VIGOR_MINING_MULT`, `LASTING_DRAIN_MULT`), each used at the one
  place the base rule already lives (physics, survival warmth, survival regen, mining.ts, hunger.ts).
- Stacking rule: at most ONE tea buff and ONE coffee buff at a time; drinking another of the same family
  replaces it (toast "Spring replaces Mending"). Buffs from Well-Warmed and Well-Fed multiply with these.
- Blocks: the cup states become data-driven instead of six hard-coded blocks: `cup_cone_loaded` and `cup_full`
  with the drink key on the entity (`drink: string`), and the liquid colour taken from the drink item's
  `drinkColour` field (the parts layer or a tinted quad draws it). Items: one per drink (`green_tea`,
  `black_tea_cup`, `berry_tea`, `light_roast`, `dark_roast`, `trail_blend_cup`), all returning the clay cup.
- `brewUse` table rows "cup_cone + dried_tea / ground_coffee" generalise to "cup_cone + any item with
  `brews: <drink key>`" (new ItemSpec field on the six ingredients).
- Goals: `first_brew` unchanged; add an optional later goal `six_cups` ("Taste them all": all six drunk,
  tracked in PlayerState stats) with a small reward.
- Tests: each buff's effect at its hook; family replacement; six ingredients brew six drinks; solver reaches
  all at tier 1 (dark roast needs 400 C: charcoal or bellows).

### 11.2 Regrowing bushes
As written in section 3 (role bush, regrowS 360, cuttings to plant). No change.

### 11.3 Boiling water from any container, and from the kettle
- New ItemSpec field `container?: { holds: 'water'; boilsTo: string; emptyTo: string }` on `water_pail`
  (boilsTo `boiling_pail`, emptyTo `pail`). Future bowls or flasks only need this field and a furnace-top block.
  The sim's `brewUse` pour row accepts any held item that is the `boilsTo` of some container.
- Furnace top: any water-holding container can be set on a hot furnace top (the block shows that container's
  model: `furnace_bucket` today; a future `furnace_bowl` plugs in through a `CONTAINER_BLOCKS` table in content).
- Kettle Pot (EMBER_PLAN; the Ember kettle - NOT the Bronze Copper Kettle of STEAM_PLAN, which may optionally accept the same rows): Use on a kettle that is boiling (furnace >= 120 C and water in it) with an EMPTY
  container fills it with boiling water directly (takes 1000 L per bucket; "The kettle is not boiling yet"
  otherwise). Using a water container on a kettle still pours water in. Add both rows to the kettle's use table
  and a test for each.
- Later (Bronze): a container on a Hot Plate boils the same way (the Hot Plate reports delivered temperature).

<!-- ======================== END docs/BREWING_PLAN.md ======================== -->


---

<!-- ======================= BEGIN docs/STEAM_PLAN.md ======================= -->
# FILE: docs/STEAM_PLAN.md

# Steam and mechanics - implementation plan (first half of the Bronze Age)

For the engineer (or model) who builds this. This is the HOW for the first half of the Bronze Age (age 1,
furnace tier 2, the Bronze Furnace): the kettle-driven steam rotor, axles, cogs, speed and stress, the machines
that run on a shaft, the water wheel and the windmill. Design intent: `docs/SPEC.md` 20 and 20.5 (20.5 wins where
they differ), `docs/PROGRESSION.md`, and for ages and tiers `docs/SPEC.md` 21 and 21.8. Where SPEC 20 / 20.5 still
say "Ember Age" or "tier 1", the later text wins: read it as Bronze (early) and tier 2. This file gives
contracts, files, algorithms, numbers, tests, order, and the traps already met in this codebase. Nothing here is
built yet (section 8 says exactly what exists).

Player's words: "a basic steam power mechanic that happens in world and allows blocks like a turbine to get
rotation (animated texture) and then any axle block connected to it can move that rotation, and if connected
to another machine that needs rotation it will provide that power ... early game mechanisms through steam
power -> mechanical energy ... at some point the steam power will be able to be harnessed for Wattage but that
will be a later step". Then the owner moved it: "again, steam is a bronze age thing" and "ember era should feel
very manual and like you're making a bunch of different stuff". There is no electricity before the Forge Age's
dynamo.

## How this plan relates to the others

The game has SIX ages and SIX furnace tiers (SPEC 21; the code still has five until BRONZE_PLAN W0 lands, see
section 8): 0 Ember (tier 1 Clay Furnace) - 1 Bronze (tier 2 Bronze Furnace) - 2 Forge (tier 3 Blast hearth) -
3 Current (tier 4 Arc hearth) - 4 Atomic - 5 Star. This plan is the FIRST HALF OF AGE 1.

- **Ember (`docs/EMBER_PLAN.md`) has none of this.** It is handwork: no steam, no shafts, no machines. The player
  works hand stations stroke by stroke: the Hand Quern (wheat to flour), the Chopping Block (logs to planks), the
  Stone Anvil (ingots to plates and wire), plus Mortar, Drying Rack, Tanning Trough, Loom, Clay Table, Casting
  Bench and the Kettle Pot. The reward for reaching Bronze is that machines start doing those same jobs for you.
- **This plan automates the hand stations on a rotating shaft:**

  | Ember hand station (EMBER_PLAN) | Bronze machine (this plan) |
  |---|---|
  | Hand Quern: wheat to flour by strokes | Millstone: wheat to flour; ore to 2 crushed (the Mortar only stretches ore, 1 + 35%) |
  | Chopping Block: log to planks by strokes | Saw Bench: log to 6 planks |
  | Stone Anvil: ingots to plates by strokes | Trip Hammer: 2 ingots to 1 plate |
  | Bellows pumped by hand on the furnace screen | Shaft Bellows |

  The hand stations stay in the game and keep working; the machines are faster, need no strokes and cost stress.
  The Mech Pump, Mech Drill and Draft Fan have no hand twin.
- **`docs/BRONZE_PLAN.md` is the second half of the same age:** thermocouples that move heat, the sealed boiler
  multiblock, steam under pressure (bar, safety valves, bursts), the piston Steam Engine, compressed air and
  pneumatics, the Bronze Chute drawn by a Vacuum Pump, and the Blast Nozzle that opens the Forge Age. It builds
  on the shaft network defined here (the engine and the air compressor are shaft devices).
- **Order of work:** BRONZE_PLAN **W0 (the six-tier refactor and save migration) FIRST**, before any wave of this
  file; then EMBER_PLAN (hand stations); then the waves of this file (sections 6 and 11); then BRONZE_PLAN
  B1-B4; then Forge heavy industry and the dynamo. Brewing (BREWING_PLAN) is independent of all of it.
- **Goal order:** the Bronze chain starts with `bronze_furnace` (BRONZE_PLAN section 9). The six goals of this
  plan (`boil_water`, `first_motion`, `grind`, `gear_up`, `saw_planks`, `auto_bellows`) come right after it and
  BEFORE BRONZE_PLAN's `move_heat`, `build_boiler` and the rest (section 2, "Objectives").
- **Two kettles - do not confuse them.** The **Kettle Pot** (EMBER_PLAN and BREWING_PLAN; Ember, tier 1; block
  `kettle_pot`, machine kind `kettle`, already in `src/core/brewing.ts`) boils water for brewing and stew and makes
  NO steam power. The **Copper Kettle** of this plan (Bronze, tier 2; block and machine kind `copper_kettle`) is
  the steam kettle: it makes steam for touching Steam Rotors. A Bronze player has both; neither replaces the other.

## 0. Ground rules and what exists today (verified against the repo)

- Layering: core <- content <- world, game <- sim <- render, audio <- player, ui <- app. `src/player` and
  `src/ui` never import `src/sim` values (ui uses a structural `ScreenSim` in
  `src/ui/screens/furnace/simApi.ts`; player gets callbacks from `src/app/game.ts`).
- All numbers live in `src/content` (MachineSpec fields/params, documented above each spec) or
  `src/core/constants.ts`. No magic numbers in sim code.
- Block entities are plain JSON on the world (`world.setEntity`); all state in plain fields at all times.
- The sim creates/removes entities from `'block:changed'`; machines set the voxel ACTIVE bit to mirror "running".
- Voxel bits: id 10, facing 2, active 1, variant 3. `water` uses variant = level and active = falling. Pipes do
  not use variant. Free for axles: facing + variant.
- `src/content/specRoster*.ts` re-types the spec as a second copy; `src/content/progression.ts` is the solver that
  proves the game completes. Every content change must update both, and `src/sim/playthrough.test.ts` (the
  scripted full game, driven by `src/sim/playKit.ts`) must still reach `game:won`.
- Exhaustive `Record<...>` tables exist for MachineRole (`src/ui/screens/machines/machineScreen.ts`), SfxName
  (`src/audio/sfx.ts`), DamageCause (death screen), BlockShape (`src/world/blockTables.ts`). Adding a member
  breaks the typecheck until each table gets an entry - fix them in the same change.
- Checks: `npm run typecheck`, `npm test` (vitest), `npm run build`, `npm run e2e` (long; four scripts chained with
  `&&`: e2e.mjs, e2e-features.mjs, e2e-tech.mjs, e2e-ember.mjs). Under CPU load phone taps can read as holds;
  rerun alone before believing a failure.
- Visual work is verified in the built game in headless Chromium: build to a scratch `--out` dir, drive with
  `scripts/lib/browser.mjs` and `window.__hw` (see `docs/api/integration.md`), LOOK at the screenshots.
- Docs: each module has `docs/api/<name>.md` (today: audio, content, crops, emberbound-ai, emberbound-content,
  food, food-rules, food-ui, furnace-screens, game, hearth, hud, integration, mobs, player, render, render-machines,
  render-tech, sim, tech-content, textures, transport, ui-kit, ui-tech, water, weather, world, world-content,
  world-features). This plan adds `docs/api/mechanics.md` (sim views, render snapshot, callbacks, written FIRST by
  the sim engineer) and `docs/api/mechanics-content.md`; update the HANDOFF table.
- The Codex generator is in `scripts/codex` (`npm run codex`, writes `dist-codex/`; see `scripts/codex/README.md`).
  It reads items, recipes, blocks, furnace tiers and ages from `src/core/registry`, so new content shows up on its
  own; list planned items in `scripts/codex/progression.json` (plain names render as "planned" tags, registry
  keys become icon chips).
- Other engineers edit `src/` at the same time (Emberbound, brewing and handwork data are in progress): re-read a
  shared file before editing it, commit only your own paths, and treat failures outside your directory as not
  yours. Brewing already owns the names `kettle_pot`, machine kind `kettle`, `KETTLE_BLOCK`, `KETTLE_MACHINE`
  (`src/core/brewing.ts`) and the constant `KETTLE_BOIL_C` (`src/core/constants.ts`); this plan's Copper Kettle uses
  `copper_kettle` and the `COPPER_KETTLE_*` constants so nothing collides.

## 1. Contracts (src/core, append only)

```ts
// types.ts
export type MechRole = 'axle' | 'junction' | 'source' | 'consumer' | 'gauge' | 'clutch' | 'flywheel' | 'cog';
export interface MechSpec {
  role: MechRole;
  /** Sources: rpm at full drive, and stress capacity added. */
  rpm?: number; capacity?: number;
  /** Consumers: slowest speed it works at, and stress load at 16 rpm. */
  minRpm?: number; stress?: number;
  /** Speed cap of the part's material (wood 64, iron 128, steel 256). Networks clamp to the lowest cap. */
  maxRpm?: number;
  /** Cogs: teeth class. A large cog meshed with a small one is a 2:1 gear pair. */
  cog?: 'small' | 'large';
}
// BlockSpec gains:  mech?: MechSpec;   BlockDef gains: mech: MechSpec | null;
// MachineRole gains 'mech' (machines whose power is rotation; they are NOT on electrical networks unless
//   they also have power: 'device' - the dynamo and alternator have both).
// BlockShape gains 'axle' (thin bar along one axis; drawn by the render parts layer so it can spin - the
//   mesher emits nothing but the collision/target box is a 4/16 bar) and 'cog' (flat wheel on an axle).
```
- Axle AXIS in the voxel: facing North/South = z axis, East/West = x axis, variant bit 0 set = y axis. Placing an
  axle takes the axis from the face the player aimed at (helper `axleVoxel(id, face)` in core/types).
  Cogs sit ON an axle cell (they are their own block with the same axis encoding).
- Events: `'mech:seized' { x, y, z }`, `'mech:freed' { x, y, z }` (on change only), flags `first_motion`,
  `geared_up`, `shaft_bellows`. SfxName: `shaft_creak`, `shaft_seize`, `millstone`, `saw`, `trip_hammer`,
  `kettle_boil` (the Copper Kettle's boil; brewing already has `boil_bubble` for pots and buckets; ambience would be
  better than one-shots for the boil: add `steam: 0..1` to AmbienceState).
- constants.ts: `MECH_BASE_RPM = 16`, `MECH_MAX_RPM = 256`, `FLYWHEEL_COAST_S = 10`, `COPPER_KETTLE_HEAT_W = 3000`,
  `COPPER_KETTLE_BOIL_L_PER_S = 20`, `COPPER_KETTLE_MIN_TEMP_C = 120` (named for the Copper Kettle because the Kettle
  Pot's `KETTLE_BOIL_C = 120` already exists; the pseudocode below writes them as KETTLE_* for short).
- registry: `mechOf(def)`, validation (sources have rpm+capacity; consumers minRpm+stress; cogs have cog).

## 2. Content (numbers to start from)

Age "Bronze (early)" = age 1, made at the Bronze Furnace (furnace tier 2; "forge T2 600" = the furnace recipe
station at tier 2, 600 C). "Forge" = age 2, tier 3 Blast hearth. "Current" = age 3, tier 4 Arc hearth. Workbench
recipes need no furnace tier but the items they use (bronze, copper) come from the Ember Age.

| key | role | numbers | recipe | age |
|---|---|---|---|---|
| copper_kettle (Copper Kettle) | machine role 'boiler'-like, on a furnace | 4000 L water, boils 20 L/s at >= 120 C, draws 3 kW heat pro rata | forge T2 600: 3 copper_ingot, 1 pail | Bronze (early) |
| steam_rotor | source | 32 rpm, capacity 256, needs 20 L/s steam from a touching kettle (pro rata on both) | forge T2 650: 2 copper_ingot, 2 tin_ingot, 1 plank | Bronze (early) |
| water_wheel [change] | source | 16 rpm, capacity 64 per FLOWING water neighbour (variant > 0 or falling), max 192; no electricity | workbench: 12 plank, 2 copper_ingot | Bronze (early) |
| windmill | source | 8-24 rpm and capacity 32-128 by `windAt` and altitude, open sky | workbench: 8 plank, 4 cord, 1 wooden_axle | Bronze (early) |
| wooden_axle | axle | maxRpm 64 | workbench: 3 plank -> 4 | Bronze (early) |
| small_cog / large_cog | cog | maxRpm 64 | workbench: 2 plank, 1 stick -> 2 / 4 plank, 1 wooden_axle | Bronze (early) |
| bronze_gearbox | junction (6 sides) | maxRpm 128 | forge T2 700: 2 bronze_ingot, 1 wooden_axle | Bronze (early) |
| clutch | clutch | Use toggles engaged | workbench: 1 wooden_axle, 1 stick, 1 cord | Bronze (early) |
| flywheel | flywheel | coast 10 s | forge T2 700: 4 bronze_ingot, 1 wooden_axle | Bronze (early) |
| speed_gauge / stress_gauge | gauge | needle | forge T2 600: 1 copper_ingot, 1 glass, 1 small_cog | Bronze (early) |
| millstone | consumer | minRpm 16, stress 4; recipes: wheat->flour 1:1 2 s; copper_ore/tin_ore -> 2 crushed 4 s | workbench: 4 stone_brick, 1 wooden_axle | Bronze (early) |
| saw_bench | consumer | minRpm 32, stress 4; oak_log/pine_log -> 6 plank 2 s | forge T2 600: 2 bronze_ingot, 4 plank | Bronze (early) |
| mech_bellows | consumer | minRpm 8, stress 2; draft = lerp(0.5, 1.0, (rpm-8)/56) on touching furnaces | workbench: 1 bellows, 1 wooden_axle, 2 plank | Bronze (early) |
| trip_hammer | consumer | minRpm 16, stress 8; 2 ingots -> 1 plate (bronze_plate NEW item, iron, steel) 3 s | forge T2 800: 4 bronze_ingot, 1 large_cog, 2 stone_brick | Bronze (early) |
| mech_pump | consumer + fluid source | minRpm 16, stress 4; 50 L/s per 16 rpm; same source-block rules as `pump` | forge T2 700: 2 bronze_ingot, 1 item_pipe, 1 small_cog | Bronze (early) |
| mech_drill | consumer | minRpm 32, stress 8; mines the column below, 4 s/block at 32 rpm, toolTier 2, 9-slot buffer | forge T2 800: 4 bronze_ingot, 2 flint, 1 large_cog | Bronze (early) |
| draft_fan | consumer, hearth wall part | minRpm 32, stress 2; counts as a tuyere (+25% smelting) | workbench: 4 plank, 1 small_cog | Bronze (early) |
| iron_axle | axle | maxRpm 128 | forge T3 1000: 1 iron_ingot -> 2 | Forge |
| steam_engine [change, superseded] | source | this file's first draft: 64 rpm, capacity 1024, on top of a furnace/hearth, water by pipe/pump; recipe loses the copper coils (1 chassis, 4 iron_plate, 2 glass). VOID: the piston engine of BRONZE_PLAN 4.3 replaces it (16 rpm and 128 capacity per bar, min 2 bar, steam by pipe, forge T2 1000). Kept from here: the existing block loses `role: 'generator'` / `power: 'device'` and becomes a shaft source; no electricity | see BRONZE_PLAN 4.3 | Bronze (second half) |
| dynamo | consumer + electrical generator | minRpm 64, stress 16; W = min(2000, 30 x rpm) x satisfaction; power 'device' | forge T3 1000: 2 copper_coil, 1 iron_axle, 2 iron_plate | Forge |
| crusher [change] | electrical consumer OR mech consumer | adds mech minRpm 32, stress 16; runs on whichever is present | unchanged | Forge |
| thermopile [change] | moves to forge T3 (minTier 3, the Blast hearth); loot table 'deep' only | | | Forge |
| steel_axle | axle | maxRpm 256 | forge T3 1300: 1 steel_ingot -> 2 | Forge |
| steam_turbine [DECIDED, section 15] | direct generator, NOT a shaft source | stays exactly as built today: steam in, watts out, no shaft. The idea of a shaft turbine (128 rpm, capacity 4096 at 800 L/s steam) is dropped | unchanged | Current (tier 4) |

Removed by owner decision (section 15), kept here so the numbers are not lost: `alternator` (consumer + generator, minRpm 128,
stress 64, 80 W per rpm up to 20 kW, forge T3 1500: 4 copper_coil, 1 steel_axle, 2 steel_plate, 1 circuit) and the
steam turbine as a shaft source. The dynamo (Forge) is the only shaft-to-watts bridge.

Open detail for W1: the `mech_pump` recipe above names `item_pipe`, which is now the Bronze Chute (plates, BRONZE_PLAN
4.4); the existing electric `pump` is built from `fluid_pipe`, which is probably what was meant. Pick one, say which
in the report.

A Bronze (early) player has already met the Ember hand twins of the millstone, saw bench and trip hammer (section
"How this plan relates"); the machines are the upgrade, not a new recipe chain. The Copper Kettle ALSO accepts the
two brewing use rows of BREWING_PLAN 11.3 (Use with an empty container on a boiling kettle fills it with boiling
water; a water container pours water in) by reusing the same `brewUse` helper - it is a small extra, not the
Kettle Pot's job, and it must not change the boil or steam rules below.

Objectives (ids, in order, Bronze chain): `bronze_furnace` (BRONZE_PLAN 9, furnace tier 2) comes first because
every recipe here needs the Bronze Furnace. Then, BEFORE BRONZE_PLAN's `move_heat`: `boil_water` (place a copper
kettle), `first_motion` (flag first_motion: any source turning), `grind` (machine_job of millstone - use flag
`millstone_job`), `gear_up` (flag geared_up: a network above 32 rpm with a working machine), `saw_planks` (make
plank at saw - flag), `auto_bellows` (flag shaft_bellows). They no longer wait for bronze (Ember made it). Then
BRONZE_PLAN's chain continues (`move_heat`, `build_boiler`, ...). Forge: move `first_power` and `place_lamp`
to after `blast_furnace`; text names the Dynamo. Rewards: boil_water 4 wooden_axle; first_motion 2 small_cog.
The Ember Age's own goals (EMBER_PLAN 4) end with the Bronze Furnace upgrade list; none of them is a shaft goal.

Solver changes (`progression.ts`): neither Ember nor Bronze may rely on any electricity; Ember has no shaft block
or recipe at all (test: nothing with `mech` is obtainable at furnace tier 1); the Bronze (early) objectives need
the copper kettle, rotor, axle and millstone obtainable at tier 2; first electricity requires a dynamo (needs
the Bronze steam engine of BRONZE_PLAN 4.3 or enough rotor speed through gears: 32 rpm x 2 = 64) or a thermopile
at tier 3. The crusher is reachable by shaft at tier 3. Add a test: "no item with `power` or a generator role is
obtainable before furnace tier 3" (the Blast hearth).

Textures: every new block face and icon, plus bronze_plate. Art direction as before (docs/api/textures.md):
wood-and-bronze machinery for Bronze, iron for Forge. Copper Kettle: copper drum with a riveted lid and a sight glass.

## 3. Simulation (src/sim)

New files: `mechGraph.ts` (network build), `mech.ts` (solve + machines), `mechViews.ts`, `copperKettle.ts`, tests.
In this section "kettle" means the Copper Kettle (machine kind `copper_kettle`), never the brewing Kettle Pot.
Keep each under about 350 lines; `simulation.ts` is already 681 lines - add only wiring there.

**Graph.** Nodes = every block with `mech`. Edges:
- axle/cog: the two cells along its axis.
- junction, source, consumer, flywheel, gauge: all six neighbours, but an AXLE neighbour connects only if its
  axis points at this block.
- clutch: like an axle, but no edge when disengaged.
- gear mesh: a small cog and a large cog on PARALLEL axles in ADJACENT cells (perpendicular to the axis)
  connect with ratio 2 (small side spins twice as fast). Same-size cogs mesh at ratio 1 (reverses only).
Build by flood fill from a dirty set, exactly like `pipeGraph.ts` / `power.ts buildNetworks` (rebuild only the
networks touching a changed mech block; reuse `chunkKey`, `NodeSet` patterns). Each node gets a signed integer
`ratioLog2` relative to the network's reference shaft (fill order assigns it; a loop that closes with a
different ratio JAMS the network: status "Gears fight each other", speed 0 - test this).

**Solve, per network per tick** (dt 0.05):
```
for each source: drive = 0..1 (steam, flow, wind) ; rpmSrc = spec.rpm * drive * 2^ratio(source->ref)... 
refRpm = max over sources of (their rpm expressed at the reference shaft)          // fastest source sets speed
refRpm = min(refRpm, material caps expressed at the reference shaft)
capacity = sum(source.capacity * drive)
for each consumer that is on and has work: nodeRpm = refRpm * 2^ratioLog2 ; if nodeRpm >= minRpm:
    load += stress * nodeRpm / 16
seized = load > capacity
if (!anySourceDriving) coast: flywheel keeps previous refRpm for FLYWHEEL_COAST_S, then 0
speed for each node = seized ? 0 : nodeRpm ; machines advance by dt * nodeRpm / minRpm (cap x4)
```
Emit `mech:seized` / `mech:freed` and a toast on CHANGE only. A seized network re-evaluates every tick (it
frees itself when load drops), so a player can fix it by switching a machine off or opening a clutch.
Store on each mech entity: `rpm`, `seized`, and for the network (cached on nodes, not saved): capacity, load.

**Kettle** (`copperKettle.ts`, a `Behaviour` like the boiler in `fluidMachines.ts` - read it first; reuse `fluidIn`
for water and `rateL`): on top of a furnace or a formed hearth's roof (use the same "furnace below" lookup as
steam_engine/boiler in `surroundings.ts`, including hearth shell proxies). Fills from a touching water block
(endless only if that source has two source neighbours - same rule as pumps), buckets (`bucketUse` already
handles fluid endpoints if the spec has `fluids.accepts: ['water']`) or pipes. Boils `KETTLE_BOIL_L_PER_S x
demandFraction` while furnace temp >= `KETTLE_MIN_TEMP_C`, where demandFraction = steam the touching rotors can
use; heat drawn = `KETTLE_HEAT_W x demandFraction` added to the furnace's `extractW` (heat engines already draw
by power USED - follow that path in `furnace.ts` / `machines.ts`). No steam is stored: rotor drive = boil rate
available to it / 20, shared equally between touching rotors. (BRONZE_PLAN 5.1 also lists the kettle as a heat
user of the thermocouple network - second half of the age; the on-top-of-the-furnace case above is the base.)

**Machines.** Processors reuse `machineRecipes` (station = machine kind; ONE input type) and the slot layout
`slots: 2` (0 in, 1 out), crate push and item-pipe endpoints for free. Their `apply` advances `progress` by
`dt * rpm / minRpm` instead of `dt * f`. The crusher keeps its electrical behaviour and gains: if it is on a
turning shaft at >= minRpm, it does not demand watts.
Mech bellows: sets `draft = max(draft, value)` on touching furnaces (same hook as the blower's draftFloor).
Draft fan: a hearth wall part; `hearthScan.ts` counts tuyeres from `blower` today - add `draft_fan` when its
network speed >= minRpm (note: hearth parts are classified in `src/core` registry helpers `hearthPartOf`).
Mech pump / drill: copy `fluidMachines.ts` pump and `machines.ts` bore rig, swapping watts for rpm.
Dynamo / alternator: in the mech solve they are consumers; in the electrical `prepare` they set
`availW = min(cap, wPerRpm * rpm)`. Order in `Simulation.tick`: mech solve BEFORE electrical networks.

**Changes to existing machines.** `water_wheel` and `steam_engine` lose `role: 'generator'` / `power: 'device'` and become mech
sources (the `steam_turbine` is NOT changed: section 15). Old saves: on `resync()` (after
`world.load`), any such machine with a cable neighbour gets a toast once per session: "Steam engines now turn
shafts - add a Dynamo"; do not auto-place blocks. `water_wheel` drive counts FLOWING neighbours via
`voxelVariant(v) > 0 || voxelActive(v)` on water voxels (see `src/world/water.ts`).

**Views** (`mechViews.ts`, exposed on Simulation and added to `ScreenSim`): `mechView(x,y,z)` -> { rpm, maxRpm,
capacity, load, seized, reason, members: [{kind, name, x,y,z, rpm, stressLoad, status}] }, and per machine the
usual MachineView with status text: "Turning at 32 rpm", "Too slow - needs 32 rpm, has 16: gear it up",
"Line seized - 300 of 256 stress: switch something off or add a source", "No steam - fill the kettle",
"Gears fight each other". `grid()` (HUD) gains `shaft: { rpm, load, capacity, seized } | null` for the network
nearest the player (within 8 blocks).

**Render snapshot**: `sim.mechRender()` -> flat arrays of { x, y, z, kind, axis, rpm } for loaded mech blocks,
versioned; rebuilt on topology change, rpm updated in place.

**Tests** (vitest, fake world via `src/sim/testKit.ts`): graph edges for every block type and axis; cog ratios
incl. chains and a fighting loop; fastest source sets speed; capacity sums; load scales with speed; seize and
free events once; flywheel coast; material rpm caps; kettle heat draw lowers furnace temperature by the
spec'd amount (fire on logs: with rotor running the furnace settles lower - assert numbers); each machine's
recipe rate at 1x and 2x speed; mech bellows draft; dynamo watts and that the Bronze Age has zero watts; water wheel
on still vs flowing water; save/load mid-run identical; perf (200 mech blocks, 10 networks < 0.2 ms/tick).
Extend the playthrough: in early Bronze the scripted player builds kettle + rotor + axle + millstone and grinds
flour and crushed ore; in the Forge Age makes first electricity with the Bronze steam engine + cogs + dynamo.

## 4. World and rendering

- `src/world/blockTables.ts` + mesher: shapes 'axle' and 'cog' emit NO chunk geometry (the parts layer draws
  them); collision: non-solid; target box: bar / disc (see how `src/render/target.ts` handles pipes).
  Machines with a mech role are ordinary cubes with active textures.
- `src/render/machines` (instanced parts, one draw call per kind, angle advanced in the vertex shader from a
  per-instance speed - see `machineParts.ts`, `models.ts`): add models axle (bar), small/large cog (toothed
  disc), gearbox inner gears visible through a window, steam rotor (paddle wheel in a housing), water wheel
  [exists - now speed from rpm], windmill (four sails), millstone (runner stone turning), saw blade, trip hammer
  (arm rising and falling: use the existing piston-style `length` channel), flywheel, gauge needles (angle =
  value, not spin), kettle lid rattle + steam puffs (`src/render/emitters.ts`).
  Angle per instance must stay continuous when rpm changes: integrate angle on the CPU per network
  (`angle += rpm * 6 deg * dt`) and upload it, do not compute `time * speed` in the shader. Meshed cogs must
  LOOK meshed: offset the driven cog's angle by half a tooth and negate direction per mesh hop (the sim gives
  ratioLog2 and a direction bit per node - add `dir` to the render snapshot).
- Seized networks: parts stop with a short shudder; a red-tinted puff at the fullest machine.
- Phones: budget < 1 ms for 200 parts; no per-frame allocation; cull by chunk.
- Screenshots to review: a kettle and rotor on a lit Bronze Furnace driving a millstone through a corner
  (gearbox); a 2:1 cog pair; a water wheel on a dug channel with flowing water; a seized line; night.

## 5. Player, UI, audio, app

- Player (`src/player`): placing axles/cogs sets the axis from the aimed face; Use on a clutch toggles it
  (callback into the sim, like `transport.wrench`); Use on other mech machines opens the machine screen;
  gauges show their value as the HUD target name ("Speed Gauge - 32 rpm").
- UI: machine screens get a SHAFT panel (speed, stress bar load/capacity with the seize threshold marked,
  members list) built like the GRID tab pieces (`src/ui/screens/furnace` + `machines`); HUD power strip shows
  "32 rpm - stress 120/256" when `grid().shaft` is set and there is no electrical grid yet; How to Play gets a
  "Steam and shafts" card; furnace firebox "Heat to machines" line already exists - it must include the kettle.
- Audio: one-shots listed in section 1; ambience `steam` and a low wooden rumble scaled by nearby rpm.
- App (`src/app/state.ts`, `game.ts`): nothing new to tick (the sim owns it); pass the clutch callback and the
  mech render snapshot (`renderer.setMech(...)`, same pattern as `setTransport`); ambience fields.
- Codex page: `npm run codex` (`scripts/codex`) regenerates it from the registry, so new items appear by themselves;
  add this plan's names to `scripts/codex/progression.json` under the Bronze age (as "planned" until built).

## 6. Order of work (each step leaves `npm test` green)

0. Prerequisite: BRONZE_PLAN W0 (six tiers and ages, save migration) is merged. Without it "tier 2" and "age 1"
   mean something else in the code. EMBER_PLAN's hand stations come before or alongside step 1.
1. Core contracts + content + solver + roster + textures + sounds (one engineer; the thermopile and wheel/
   engine moves break `playthrough.test.ts` - give the scripted player stand-ins and mark them, as was done
   for food and hearths).
2. In parallel: (a) sim mechanics + playthrough for real; (b) world shapes + render parts; (c) UI panel + HUD
   + How to Play. They meet only through `docs/api/mechanics.md` written FIRST by (a) (views, render snapshot,
   callbacks) - commit that note within the first minutes.
3. Wiring (player callbacks, app, audio ambience) + `scripts/e2e-steam.mjs` on desktop and phonePortrait:
   place a copper kettle on a lit Bronze Furnace, fill with a bucket, place rotor, axle, millstone; flour comes out; add a
   second millstone and a cog pair until the line seizes, open a clutch, it frees; screenshots.
4. Review pass (the `hearthwatt-review-and-polish` workflow script from this session is saved under
   `/root/.claude/projects/.../workflows/scripts/` but that directory is not in the repo; its shape: 6
   reviewers by angle -> triage into file-disjoint groups -> skeptic per group -> fixer per group -> release
   engineer runs everything). Then rebuild and republish the game artifact (`dist/artifact.html` + `game.js`)
   and the Codex.

## 7. Traps met before - do not repeat

- Parallel engineers editing the same file: assign directories, have the first one publish the API note
  early, tell everyone to re-read shared files before editing and to commit only their own paths.
- A stop hook in this environment demands commits whenever the tree is dirty: checkpoint commits of
  half-written work are normal on this branch; never treat a "Checkpoint" commit as a finished state.
- `scripts/build.mjs --out=<dir>` for any browser check while others work; never rebuild `dist/` under a
  running e2e.
- Texture layers: the atlas splits past the device limit now, but `src/content` tests still cap the count -
  raise the cap when adding about 60 textures.
- Balance traps found by review: a break must never delete contents (full machines leave a crate); statuses
  must say WHY something is idle and what to do; anything the player must wrench/configure needs a hint text.
- Hold-to-mine on touch means long-press cannot open screens; use tap with an empty hand.
- Decided (section 15): the steam turbine stays a direct generator, no alternator. Still open (PROGRESSION 6): the
  Star hearth casing count only.

## 8. State of the repo (checked 2026-11-21; re-check before you trust it)

- Branch `ccr-3c8b169f-e78nk2` (only branch; no PR possible until a base branch exists).
- Still five furnace tiers and five ages in the code (`FURNACE_TIERS` in `src/content/tech.ts`: Clay, Blast, Arc,
  Plasma, Star; `content.test.ts` expects ages `[0, 1, 2, 3, 4]`). BRONZE_PLAN W0 has NOT run, so everything this
  file calls tier 2 / age 1 / tier 3 Blast hearth does not exist yet.
- Nothing of this plan is built: no `src/sim/mech*`, no `mech` field in `src/core/types.ts`, no
  `docs/api/mechanics*.md`, no `copper_kettle`, rotor, axle, cog or millstone. The Ember hand stations (EMBER_PLAN)
  are being written right now by other engineers: `src/core/handValidation.ts`, `src/sim/handRules.ts`,
  `src/sim/handTypes.ts`, `src/content/itemsHand.ts`, `src/content/mouldsHand.ts` and `src/world/stationShapes.ts`
  are in the working tree (some uncommitted); read `git log` and any `docs/api` note for what is finished before
  relying on a station.
- Existing blocks this plan changes: `water_wheel`, `steam_engine`, `thermopile`, `crusher`, `boiler` (old one-block
  boiler, legacy in BRONZE_PLAN 4.5) are electrical or fluid blocks today; `steam_turbine` (a `power: 'device'`
  generator) stays as it is.
- Brewing data is landing: `src/core/brewing.ts` holds the Kettle Pot (`KETTLE_BLOCK = 'kettle_pot'`, machine kind
  `kettle`), `src/core/brewValidation.ts` validates it, `KETTLE_BOIL_C = 120` is in `src/core/constants.ts`. Do not
  reuse those names (section 0).
- Emberbound (the hostile automatons): data, AI, combat rules, ward beacon and safe zones are merged; see
  `docs/api/emberbound-ai.md`, `docs/api/emberbound-content.md`, `docs/api/hud.md` and HANDOFF.md for what has
  landed in render, UI, wiring and `scripts/e2e-ember.mjs`. Check `git log` and HANDOFF.md before starting, and
  run the full e2e on a quiet machine before republishing the game artifact.
- Leftovers list: Structure tab shift buttons (sim exposes `target.shiftLeft/Right`, `machines`, `note`),
  directional damage indicator and death-screen killer line (if the UI run did not finish), Star hearth size.

---------------------------------------------------------------------------------------------------------

## 9. The owner's choices, verbatim - the test for every decision

When a detail is unclear, re-read these and pick what serves them. They outrank this plan.

1. "more focused on technological advancement and generating power from resources. Your furnace is your crafting
   table, there is a crafting table but the furnace is the main place in ones base they should congregate to"
2. "All things craftable by hand should be craftable in the workbench still"
3. "Add animals and food mechanism and cooking in the furnace as well as farming and crops and crafting to make
   dough that can be cooked in the furnace to make bread"; "collect water in a bucket and make it so it's needed
   for the dough recipe"
4. "Make more of the world the game is in beyond the furnace screens"
5. "Add pipes and item/fluid transport ala ftb mods"; "Add multi block furnaces (lookup how ftb mods do that to
   replicate fully)" - mechanics borrowed, names/art/recipes original.
6. "Make a whole dynamic day/night cycle"; "Make the game perfect and playable artifact" (phone first).
7. "Let water flow ... when you pick up water and place it with a bucket have it only work on source blocks and
   then you take that source block"
8. "enemy mobs ... war forged sort of ember-fueled automatons of various types as if once ago in this world, the
   late game items and mechanisms were more prevalent than they are now"
9. "a basic steam power mechanic that happens in world and allows blocks like a turbine to get rotation (animated
   texture) and then any axle block connected to it can move that rotation, and if connected to another machine
   that needs rotation it will provide that power. this will be tied into the furnace progression and allows for
   early game mechanisms through steam power -> mechanical energy. at some point the steam power will be able to be
   harnessed for Wattage but that will be a later step in the game progression."
10. "nope ember age is dominated by steam power and mechanical energy and stress and rotation speed and all that"
    - SUPERSEDED by 11 and 12: the speed-and-stress layer itself stands, but it is the Bronze Age's, not Ember's.
11. "again, steam is a bronze age thing"
12. "ember era should feel very manual and like you're making a bunch of different stuff, in bronze era the upgrades
    start becoming clear the forge is to be upgraded as the eras ask it to with the item costs"

What follows from them (design law for the steam layer):
- IN THE WORLD: every conversion is a block you can see working. No hidden menus doing the work. If a number
  matters (rpm, stress, steam) there is a way to read it by looking at a block, not only on a screen.
- THE FURNACE IS THE BOILER'S HEART: steam always starts from furnace (or lava) heat. No standalone coal boiler,
  ever. (The kettle sits on the furnace; BRONZE_PLAN's boiler stands apart and takes heat through thermocouples.)
  More machines = more steam = a hungrier fire = more reasons to stand at the furnace.
- EARLY, NOT LATE: a player should have something turning within about 10 minutes of lighting the Bronze Furnace
  (starting value; it was 15 minutes from the first fire when this was an Ember feature).
- WATTS ARE EARNED: electricity appears in the Forge Age, made FROM rotation. The dynamo is a celebration.
- THE OLD WORLD HAD ALL THIS (ruins may show Bronze relics even though the Ember player cannot build them): ruins should show it - broken axles, a seized rusted gearbox, a dead dynamo.
  Add to ruin generation: decor blocks `rusted_axle`, `rusted_cog` (drop 1 scrap_metal with a pickaxe), and a
  rare ruin variant "mill ruin" by water with a broken wheel. Forge Wardens' hammer arm IS a trip hammer.

## 10. The first half of the Bronze Age as it is played (the experience to build toward)

Minute by minute, a first-time player on a phone, following only the goal tracker. Minute 0 is the moment the
Ember Age's last goal is done: the player owns a Clay Furnace, hand stations (EMBER_PLAN), bronze, and holds the
Bronze Furnace upgrade list (8 bronze_ingot, 4 firebrick, 1 bellows at 700 C). Times are starting values.
- 0-3: upgrade the Clay Furnace in place (goal `bronze_furnace`). 1100 C, two crucibles.
- 3-8: forge the COPPER KETTLE (3 copper, a pail). Tap it onto the furnace top. Fill it with the bucket (the lake
  refills; a lone puddle would not). The lid starts to rattle, steam puffs, a soft boil sound. The furnace
  thermometer shows a new notch: "Kettle 3 kW". Goal: "Set it turning". (The Kettle Pot from Ember is a different,
  quieter block: it boils water for tea.)
- 8-12: forge the STEAM ROTOR, place it against the kettle: it spins up over about 2 s, paddles visible. Toast:
  "32 rpm". Workbench: wooden axles, a millstone. Lay 3 axles from the rotor, set the millstone on the end: the
  axles turn, the runner stone turns, wheat goes in, flour comes out with no strokes - the Hand Quern's job done
  by the fire. Goal "Grind" done.
- 12-20: more machines. The saw bench wants 32 rpm (fine). The trip hammer takes over the Stone Anvil's plate
  work. But the shaft bellows + millstone + saw + trip hammer together ask more stress than one rotor has: the
  line SEIZES - everything stops with a wooden groan, the stress gauge needle is in the red, the HUD says "Line
  seized - 280 of 256 stress". The player learns: open a clutch, or add a second rotor (the kettle has four
  sides), or dig a channel so flowing water turns a wheel. Gears: a large cog driving a small one doubles the
  saw's speed and its stress cost.
- 20+: the second half of the age takes over (BRONZE_PLAN): thermocouples carry heat away from the furnace, the
  first multiblock (the sealed boiler) makes steam under pressure, the piston engine joins the shaft line, air,
  the Vacuum Pump, and finally the Blast Nozzle and brick walls: the Blast hearth forms (Forge Age).
What must be true for this to feel right (acceptance for the whole feature):
1. Copper kettle + rotor + 3 axles + millstone works with only materials from Ember and the Bronze Furnace
   (copper, tin, bronze, wood, stone brick, glass), on a phone, guided by goal texts.
2. The first seize is understandable without reading docs: sound, stopped parts, a gauge, a status sentence
   that names the numbers and two ways out.
3. Standing at the furnace you can SEE your machines turning from it.
4. The fire visibly matters: let it die and the rotor slows, the flywheel carries the line 10 s, then it stops
   (not a seize - status "No steam - the fire is low").
5. Nothing electrical is craftable or lootable before the Blast hearth (test in the solver).
6. The Ember Age contains none of it: no shaft block, recipe or goal at furnace tier 1 (test in the solver).

## 11. Exact work items with acceptance checks

Numbering = order. "AC" = acceptance check that must be automated unless marked (look).

Prerequisite for every item: BRONZE_PLAN W0 (six tiers and ages) is merged; "tier 2" below is the Bronze Furnace.

**W1 - contracts, content, art, sound (one engineer, nobody else in the repo)**
1. `src/core/types.ts`: MechSpec, MechRole, BlockSpec.mech / BlockDef.mech, MachineRole 'mech', BlockShape 'axle'
   and 'cog', `axleVoxel(id, face)`, `axleAxis(voxel): 'x'|'y'|'z'`. AC: unit tests for axis round trip.
2. `src/core/constants.ts`, `gameEvents.ts` (events, flags as constants `FLAG_FIRST_MOTION` etc., SfxNames,
   AmbienceState.steam is in `src/audio` not core), `registry.ts` (`mechOf`, validation in a new
   `src/core/mechValidation.ts` like `hostileValidation.ts`). AC: validateContent() [] and mutation tests
   (a source without capacity fails).
3. `src/content`: new file `blocksMech.ts`, `itemsMech.ts` (bronze_plate), recipes in `recipesMech.ts`, machine
   specs in `techMech.ts`, objectives inserted, loot tables (thermopile only in 'deep'; add small_cog, wooden_axle
   to 'near'), ruin decor `rusted_axle`, `rusted_cog`. Move thermopile recipe to tier 3; water_wheel recipe to the
   workbench; remove `power`/generator role from wheel and engine (the engine's new recipe and numbers are
   BRONZE_PLAN 4.3 / B1, not here); the copper kettle's key is `copper_kettle`, not `kettle`.
   AC: content tests green; new solver test "no electricity before tier 3"; objectives satisfiable in order.
4. `specRoster*.ts` second copy + `progression.ts` (mech sources/consumers; millstone crushed ore counts as an
   ore-doubling route at tier 2). AC: "game completable" and "completable on Peaceful" still pass.
5. `src/sim/playthrough.test.ts` / `playKit.ts`: stand-ins so it still reaches game:won (emit the three flags,
   place a kettle), each marked `// STAND-IN (steam W2 replaces)`.
6. Textures (`src/render/textures/mech.ts`, icons in `iconsMech.ts`): about 45 names. Review on the contact
   sheet at 6x, 3x3 tilings for casings (look). Sounds in `src/audio/sfxMech.ts` + ambience `steam` and
   `shaftRumble` fields; measure loudness against existing ones as earlier engineers did (table in the report).
7. Fix every exhaustive table; `docs/api/mechanics-content.md`. AC: typecheck, all tests, build.

**W2a - simulation (src/sim only)**  write `docs/api/mechanics.md` FIRST (signatures of mechView, mechRender,
clutch action, grid().shaft, ScreenSim additions), commit, then implement section 3. AC: the test list in
section 3 + the playthrough using real mechanics (remove stand-ins) + perf numbers in the report.
Edge cases that must have tests: axle placed across a chunk border with one chunk unloaded (network waits);
breaking the middle axle splits one network into two with correct speeds; two sources of different rpm joined;
a consumer exactly at minRpm; clutch toggled while seized; kettle boiling dry (rotor stops, status "Kettle is
empty"); kettle on a hearth roof (formed shell proxy); rain on an unroofed furnace lowering steam; save taken
mid-seize loads seized.

**W2b - world + render**  shapes, target boxes, parts (section 4). AC: mesher tests (axle emits no chunk quads,
target box per axis), parts tests (angle continuity when rpm changes; meshed cogs counter-rotate; instance
counts), frame cost measured; screenshots listed in section 4 at 1280x800 and 390x844 (look, iterate).

**W2c - UI**  shaft panel, HUD strip, gauges as target names, How to Play card, goal texts fit on a phone,
status sentences exactly as in section 3. AC: harness screenshots at the three sizes (look); DOM-free tests
for formatting (`formatRpm`, stress bar thresholds); no text overflow (the automated overflow check earlier UI
engineers wrote lives in their scratch harness - rewrite it as a test helper in `src/ui/testKit` if cheap).

**W3 - wiring + e2e-steam + ruins**  section 5 app/player items; `scripts/e2e-steam.mjs` chained into
`npm run e2e`; ruin decor placed by `src/world/ruins.ts` (deterministic, like the crate). AC: full e2e green on
a quiet machine, reported honestly with step counts.

**W4 - review and release**  six-angle review, verify, fix, full suite, rebuild, republish game + Codex (`npm run codex`),
update README (controls: clutch; features: steam and shafts), HANDOFF release state, PROGRESSION "built" tags.

## 12. Ready-to-paste briefs

Each engineer gets: the common preamble (read HANDOFF.md, docs/SPEC.md incl. its working rules, src/core, every
docs/api note; scratch dir; quality bar; write your docs/api note; commit only your paths; attribution line;
the tier and age scheme of "How this plan relates")
plus ONE of these. The chain workflow used all session takes `{ model, effort, tasks: [{ label, brief }] }`.

- `steam:content` - "FEATURE DATA: steam and mechanics (first half of the Bronze Age, furnace tier 2; BRONZE_PLAN W0 is merged). Read docs/STEAM_PLAN.md completely - sections 1, 2, 9,
  10 and work item W1 are your brief; follow them exactly, including file names and acceptance checks. Nobody
  else is in the repository. Keep the whole repository green. Report every number you changed from the plan
  and why."
- `steam:sim` - "FEATURE BEHAVIOUR: shaft networks, kettle, mechanical machines, dynamo. docs/STEAM_PLAN.md
  section 3 and work item W2a are your brief. Write docs/api/mechanics.md first and commit it within your first
  ten minutes: two other engineers (render, UI) build against it right now. Scope: src/sim only."
- `steam:render` - "FEATURE VISUALS: turning shafts and machines. docs/STEAM_PLAN.md section 4 and W2b. Read
  docs/api/mechanics.md as soon as it appears for the render snapshot. Scope: src/world/blockTables.ts,
  mesher/target files, src/render."
- `steam:ui` - "FEATURE UI: shaft panel, HUD strip, gauges, help. docs/STEAM_PLAN.md section 5 (UI) and W2c;
  section 10 lists the sentences the player must see. Scope: src/ui."
- `steam:wiring` - "INTEGRATION: docs/STEAM_PLAN.md section 5 (player, app, audio) and W3. Run the FULL npm run
  e2e at the end."

---------------------------------------------------------------------------------------------------------

## 13. Where this plan ends and BRONZE_PLAN begins

Both plans are one age (Bronze, tier 2). The split, so that nothing is built twice or dropped:

- **This file (first half):** copper kettle, steam rotor, water wheel, windmill, wooden axles and cogs, gearbox,
  clutch, flywheel, gauges, millstone, saw bench, shaft bellows, mech pump, mech drill, draft fan, bronze trip
  hammer, and the shaft network, speed and stress rules everything else plugs into.
- **`docs/BRONZE_PLAN.md` (second half):** thermocouples and the heat network, the boiler multiblock, steam under
  pressure, the piston Steam Engine (its definition replaces the one in section 2), compressed air, the air
  compressor, pneumatic machines, the Bronze Chute with its Vacuum Pump, the Blast Nozzle.
- **Forge (later):** iron and steel axles, the crusher's shaft drive, the thermopile and the DYNAMO move to the
  Forge Age (tier 3); they are built as written in sections 2 and 3, just later in the tier order.
- **Build order:** BRONZE_PLAN W0 (the six-tier refactor) BEFORE any wave of this file; then this file's waves
  (section 11); then BRONZE_PLAN B1-B4.


## 14. Pseudocode for the hard parts (early Bronze mechanics)

### 14.1 Shaft graph with gear ratios (`mechGraph.ts`)
```
edges(cell):
  b = block(cell)
  axle/cog/clutch(engaged): the two cells along its axis, if that neighbour accepts a shaft from this side
  junction/source/consumer/flywheel/gauge: 6 neighbours; an axle neighbour only if its axis points here
  cog additionally: MESH edges to cogs on a parallel axis in the 4 cells perpendicular to the axis
      ratio = this.small and that.large ? -1 (that turns half as fast) : this.large and that.small ? +1 : 0
      every mesh edge also flips direction
accepts(neighbour, fromDir) = neighbour is mech and (not axis-bound or its axis is along fromDir)

build(seed):
  queue = [seed]; node[seed] = { ratioLog2: 0, dir: +1 }
  while queue: c = pop
    for (n, ratioStep, flips) in edges(c):
      want = { ratioLog2: node[c].ratioLog2 + ratioStep, dir: node[c].dir * (flips ? -1 : 1) }
      if n not visited: node[n] = want; push n
      else if node[n] != want: net.jammed = true        // gears fight each other
  net.maxRpmRef = min over members of  member.maxRpm / 2^ratioLog2        // material caps at the reference shaft
```

### 14.2 Speed and stress solve (`mech.ts`)
```
tick(net, dt):
  if net.jammed: stop(net, 'Gears fight each other'); return
  ref = 0; cap = 0
  for s in sources: d = s.drive()                      // rotor: steam share; wheel: flowing faces; engine: bar
     if d <= 0: continue
     ref = max(ref, s.rpm * d / 2^ratio(s))            // its speed expressed at the reference shaft
     cap += s.capacity * d
  ref = min(ref, net.maxRpmRef, MECH_MAX_RPM)
  if ref == 0:                                         // nothing drives it
     if net.flywheels > 0 and net.coastS < FLYWHEEL_COAST_S: net.coastS += dt; ref = net.lastRef * (1 - net.coastS / FLYWHEEL_COAST_S)
     else: setSpeed(net, 0, 'No steam'); return
  else net.coastS = 0; net.lastRef = ref
  load = 0
  for m in consumers: rpm = ref * 2^ratio(m)
     m.willRun = m.on and m.hasWork() and rpm >= m.minRpm
     if m.willRun: load += m.stress * rpm / MECH_BASE_RPM
  seized = load > cap
  if seized != net.seized: net.seized = seized; emit(seized ? 'mech:seized' : 'mech:freed'); toast once
  for every member: member.rpm = seized ? 0 : ref * 2^ratio(member) * member.dir
  for m in consumers: if m.willRun and !seized: m.advance(dt * |m.rpm| / m.minRpm capped at 4x)
                      else m.status = seized ? seizedText(load, cap) : tooSlowText(m.minRpm, |m.rpm|)
  net.capacity = cap; net.load = load
```

### 14.3 Copper kettle and rotor coupling (`copperKettle.ts`)
```
kettle.tick(dt):
  f = furnaceBelow(); T = f ? f.tempC : AMBIENT
  rotors = touching steam_rotors that are on and whose shaft is not seized
  demand = rotors.length > 0 ? 1 : 0                    // open kettle: steam is only made when something uses it
  canBoil = T >= KETTLE_MIN_TEMP_C and waterL > 0
  rate = canBoil ? KETTLE_BOIL_L_PER_S * demand * clamp((T - 120) / 200 + 0.5, 0.5, 1) : 0
  waterL -= rate * WATER_PER_STEAM * dt
  f.extractW += KETTLE_HEAT_W * rate / KETTLE_BOIL_L_PER_S          // the fire pays
  share = rotors.length ? rate / rotors.length : 0
  for r in rotors: r.driveValue = share / KETTLE_BOIL_L_PER_S       // 0..1 -> rotor.drive()
  refill: touching water source with >= 2 source neighbours -> waterL += 50 * dt (endless);
          a lone source is consumed for 1000 L; buckets/pipes through the fluid endpoint
```

### 14.4 Turning parts that never jump (render)
```
per network, on the CPU each frame:  net.angle = (net.angle + net.refRpm * 6 * frameDt) mod 360*64   // degrees
per instance upload:  angle = net.angle * 2^ratioLog2 * dir + phase
  phase for a cog = (meshParity ? 180 / teeth : 0) so meshed teeth interleave
shader: rotate the part's vertices about its axis by `angle` (no time uniform), so a speed change never snaps
seized: refRpm = 0 and a 0.3 s decaying shake offset = sin(t * 60) * 0.02 * e^(-t / 0.1)
```


## 15. Owner decisions made after this plan was first written (all applied inline above)

- **Steam is a Bronze Age thing; Ember is manual** ("again, steam is a bronze age thing"; "ember era should feel
  very manual"): everything in this file is age 1 / tier 2; Ember has the hand stations of EMBER_PLAN.
- **Steam turbine:** "shaft source in ember era and bronze era, a modern steam turbine can be made in a later
  era that can convert direct to electricity". With the age move: every steam device of the Bronze Age (steam
  rotor, piston steam engine) is a SHAFT source. The existing `steam_turbine` block stays a Current-age (tier 4)
  DIRECT generator exactly as it is built today (steam in, watts out, no shaft). There is NO `alternator` and no
  "steam turbine as shaft source" row in section 2 or in PROGRESSION; the dynamo (Forge) remains the only
  shaft-to-watts bridge.
- **Kettle gives boiling water** for brewing (BREWING_PLAN 11.3): Use with an empty container on a boiling kettle
  fills it. That is the Ember Kettle Pot's job. The Copper Kettle of this plan is a different block (Bronze, steam
  for rotors); it also accepts the same two use rows as a small extra (section 2). Only the Copper Kettle makes
  steam power.

> **Ground items (built):** drops, the drop key and the Hand Vacuum Pump (a Bronze Age handheld) are in `docs/api/ground-items.md`;
> the pump has no shaft or steam input (it wears like a tool). A steam-fed variant could use a `PowerSource` of kind `'steam'`.

<!-- ======================== END docs/STEAM_PLAN.md ======================== -->


---

<!-- ======================= BEGIN docs/BRONZE_PLAN.md ======================= -->
# FILE: docs/BRONZE_PLAN.md

# The Bronze Age - complete plan

Standalone plan for the second age of Hearthwatt: pressure, pneumatics, and heat you can move. Design AND
implementation, written so an engineer who was not in the design conversation can build it exactly. Nothing in
this file is built yet. Companion files: `docs/STEAM_PLAN.md` (the first half of this age: shaft mechanics, speed and stress, built first; sections cited below keep their numbers),
`docs/EMBER_PLAN.md` (the handwork age before this one),
`docs/PROGRESSION.md` (whole game), `docs/SPEC.md` 21 and 21.8 (short form of this design; THIS file wins on detail).

> **Scope update:** the owner moved ALL steam and shaft mechanics into this age ("steam is a bronze age
> thing"). The Bronze Age therefore has two halves: (a) open steam and turning - the kettle, steam rotor,
> water wheel, windmill, axles, cogs, speed and stress, shaft machines - exactly as specified in
> `docs/STEAM_PLAN.md` (rewritten for the Bronze Furnace, tier 2; its Copper Kettle is `copper_kettle`, not the Ember
> Kettle Pot); then (b) everything in this file: thermocouples, the
> boiler multiblock, pressure, piston engines, air, the vacuum chute. The machines of (a) automate the hand
> stations of the Ember Age (`docs/EMBER_PLAN.md`): millstone = hand quern, saw bench = chopping block, trip
> hammer = stone anvil. The furnace upgrade list is shown from the first minute of each age.

## 1. The owner's words (the test for every choice)

- "we should have a fully separate bronze age with pneumatics and pressure mechanics and steam boilers and steam
  engines etc."
- "forge era will be more advanced smelting, heavy factory stuff/machines still."
- "there should be thermocouple blocks in the bronze era that can move heat when connected to a heated source"
- "bronze furnace will be what it is and the steam boiler will be the first separate multiblock"
- Earlier, still binding: the furnace is the heart of the base; things happen IN THE WORLD with animated
  blocks; "ember age is dominated by steam power and mechanical energy and stress and rotation speed"; watts are
  "a later step in the game progression"; phone first; original names and art.

Design law for this age:
1. **Heat has one origin: the furnace (or lava).** Thermocouples move it; nothing else creates it.
2. **Pressure is the new quantity** (bar), read on gauges in the world, dangerous when ignored.
3. **Air is steam's clean cousin**: made by a compressor, stored in tanks, spent by tools and tubes.
4. **No electricity.** Not one watt before the Forge Age's dynamo.
5. **The boiler is a building**, the player's first multiblock, and it stands apart from the furnace.
6. **Every failure is announced** at least 5 seconds ahead, by sound, by a needle, and by a sentence.

## 2. Where it sits

Ages: 0 Ember, **1 Bronze**, 2 Forge, 3 Current, 4 Atomic, 5 Star.
Furnace tiers: 1 Clay Furnace 800 C, **2 Bronze Furnace 1100 C**, 3 Blast hearth 1500, 4 Arc 2100, 5 Plasma
3200, 6 Starhearth.

| | Ember (before) | Bronze (this plan) | Forge (after) |
|---|---|---|---|
| Furnace | clay, single block | bronze, single block, 1100 C | blast hearth, multiblock, needs a blast nozzle |
| Heat | stays in the furnace | thermocouples carry it up to ~12 blocks | iron thermocouples, 20 kW |
| Steam | none (the Kettle Pot only boils tea water) | first half: open Copper Kettle, no pressure; second half: sealed multiblock boiler, 0-8 bar, pipes, valves | steel vessels and pipes, 16 bar |
| Motion | none: hand stations (Quern, Chopping Block, Stone Anvil) | first half: rotor 32 rpm, wheel, windmill, shafts; second half: piston engine, 16 rpm and 128 stress per bar | iron and steel shafts, heavy machines |
| Items | none (carry it, crates) | Bronze Chute pulled by a Vacuum Pump | steel conveyor pipe |
| Tools | bronze | air hammer | iron, steel |
| Electricity | none | none | dynamo at the end of the age |
| Signature danger | cold, hunger, mites | scalding, burst vessels | hounds, heavy industry accidents |

Enter the age: upgrade the Clay Furnace in place (8 bronze_ingot, 4 firebrick, 1 bellows, at 700 C).
Leave the age: a Blast hearth needs at least one `blast_nozzle` in its wall fed by an air network at >= 2 bar.

## 3. The age as it is played (about 45 minutes)

1. **Bronze Furnace.** Hotter fire (1100 C), two crucibles. Goal: "Move the heat".
2. **Thermocouples.** Forge bronze rods, lay four from the furnace's side to a Hot Plate: the rods glow dull
   red nearest the furnace, fading along the line. Cook on the hot plate while the crucibles smelt. Touch a rod:
   it burns. The furnace screen shows "Heat to machines: 1.2 kW".
3. **The boiler.** Goal "Build a steam boiler" opens the Structure planner (same one the hearth uses later):
   a ghost of the smallest vessel - a 3x3x4 box of Boiler Plate with a Gauge Glass, a Heat Port, a Water Port, a
   Steam Port. Build it block by block; when the last plate goes in the seams flash and it rings like a bell.
4. **Feed it.** Thermocouples from the furnace to the Heat Port; buckets (or a mech pump on a shaft) into the
   Water Port; the gauge glass shows water rising. Then steam: a bronze Steam Pipe from the Steam Port, a
   Pressure Gauge on it. The needle climbs.
5. **Piston power.** A Steam Engine on the pipe: beam rocking, flywheel turning, 16 rpm per bar. At 6 bar it
   does three times what the steam rotor of the first half of the age did (STEAM_PLAN). Hook it to your existing shaft line through a clutch.
6. **The lesson.** With the engine clutched out, pressure keeps climbing: 7 bar - hiss, shaking needle, HUD
   "Boiler pressure high - fit a Safety Valve or use the steam". Fit a valve (set 6): shriek, plume, safe.
   A player who ignores it for the full count loses the vessel.
7. **Air.** Compressor on the shaft, an Air Tank, Air Tubes. Goal "Pneumatic post": a crate at the mine, a crate
   at the furnace, a tube between them, and ore arrives with a thump. Pneumatic Press: plates and wire without
   the forge chill. Air Hammer: charge it at the tank, mine like iron.
8. **The gate.** Forge a Blast Nozzle. Brick walls around the furnace with the nozzle in one wall and an air
   tube to it: the Blast hearth forms. Forge Age.

Acceptance for the whole age (all must hold):
- A1. Playable start to gate on a phone using only goal texts, status sentences and the Structure planner.
- A2. The first boiler can be built from the ghost preview without counting blocks.
- A3. Every quantity (heat in a rod, water level, bar, air bar, rpm) can be read by aiming at a block.
- A4. No electrical block is obtainable in this age (solver test).
- A5. A burst never happens without 5 s of sound + needle + HUD sentence first, and never when a working valve
  set at or below the rating is fitted.
- A6. With the fire out, everything winds down in the right order: rods cool, pressure falls, engine slows,
  flywheel coasts, line stops - no seize, statuses say "No heat" / "No steam".

## 4. Blocks and items (all numbers are starting values; keep them in src/content)

Made at the Bronze Furnace (forge, tier 2) unless noted. "plate" = `bronze_plate` (hammered by hand on the Ember Stone Anvil, or by the
STEAM_PLAN Trip Hammer: 2 bronze_ingot -> 1; also the pneumatic press here).

### 4.1 Heat
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| thermocouple | Thermocouple | heat conductor (pipe-like shape, arms to heat neighbours) | loss 2% per block, network cap 6 kW, burns above 300 C (1 dmg/s), glows by temperature | 800 C: 1 bronze_ingot, 1 copper_ingot -> 4 |
| hot_plate | Hot Plate | heat user, 1 slot in + 1 out | cooks every Kitchen smelt recipe at delivered temperature, same times; draws 500 W while cooking | 700 C: 2 plate, 1 firebrick |
| heat_vent | Heat Vent | heat user | warmth radius 6 and safe-zone-like comfort; draws 400 W | 700 C: 2 plate, 1 stone_brick |
| heat_port | Heat Port | boiler wall part, heat user | passes up to 6 kW into its boiler | 800 C: 2 plate, 2 thermocouple |

### 4.2 The boiler (multiblock, see section 6)
| key | name | role | recipe |
|---|---|---|---|
| boiler_plate | Boiler Plate | shell block (rated 8 bar) | 800 C: 2 plate -> 2 |
| boiler_gauge_glass | Gauge Glass | controller, in a wall face; shows water level | 800 C: 2 plate, 2 glass |
| water_port | Water Port | wall part, fluid endpoint (accepts water) | 800 C: 2 plate, 1 pail |
| steam_port | Steam Port | wall part, joins a steam network | 800 C: 2 plate, 1 steam_pipe |
| safety_valve | Safety Valve | roof part or on any steam pipe; setting 2/4/6/8 bar | 900 C: 2 bronze_ingot, 1 cord, 1 small_cog |

### 4.3 Steam
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| steam_pipe | Bronze Steam Pipe | steam network pipe | volume 100 L, rated 8 bar | 800 C: 2 plate -> 6 |
| steam_tank | Steam Receiver | storage | volume 8000 L, rated 8 bar | 900 C: 6 plate, 1 steam_pipe |
| pressure_gauge | Pressure Gauge | reads its network (steam or air) | needle 0-12 | 700 C: 1 copper_ingot, 1 glass, 1 small_cog |
| steam_engine | Steam Engine | steam user + shaft source | min 2 bar; uses 6 L/s per bar; 16 rpm per bar (cap 96); capacity 128 per bar | 1000 C: 6 plate, 2 bronze_gearbox, 1 flywheel, 2 steam_pipe |
| steam_hammer | Steam Hammer | steam user, processor | min 4 bar, 30 L per blow; ingots -> plates 1.5 s; bronze only until Forge | 1000 C: 6 plate, 4 bronze_ingot, 2 stone_brick |
| steam_whistle | Steam Whistle | Use: sounds; also an alarm at a set pressure | 20 L per blast | 700 C: 1 bronze_ingot, 1 steam_pipe |

### 4.4 Air
| key | name | role | numbers | recipe |
|---|---|---|---|---|
| air_compressor | Air Compressor | shaft consumer -> air | min 32 rpm, stress 8; makes 2 L/s per rpm; stalls at 6 bar | 900 C: 4 plate, 1 bronze_gearbox, 2 air_tube |
| air_tube | Air Tube | air network pipe AND pneumatic item tube | volume 50 L; open ends leak 100 L/s each | 800 C: 1 plate, 1 glass -> 6 |
| air_tank | Air Tank | storage | 4000 L | 900 C: 6 plate, 1 air_tube |
| item_pipe | Bronze Chute (MOVED here from Ember) | item pipe; does nothing by itself | items travel at 8 blocks/s toward the nearest running Vacuum Pump on the chute network | 800 C: 2 plate, 1 glass -> 8 |
| vacuum_pump | Vacuum Pump | air user on a CHUTE network; the place items are drawn TO | needs >= 2 bar air (its own air_tube connection), uses 30 L/s while items move; pulls up to 16 items per 0.5 s; delivers into the inventory it touches, else its own 9-slot buffer | 900 C: 4 plate, 1 air_tube, 1 item_pipe, 1 small_cog |
| pneumatic_press | Pneumatic Press | air user, processor | min 3 bar, 200 L per job, 2 s; plates (2 ingot -> 1), copper_wire x3 (1 ingot) with no forge chill | 1000 C: 6 plate, 1 air_tube, 2 stone_brick |
| pneumatic_drill | Pneumatic Drill | air user | min 3 bar, 100 L per block, 2 s per block, tool tier 3 (mines iron) | 1000 C: 6 plate, 2 flint, 2 air_tube |
| air_hammer | Air Hammer | hand tool | pickaxe tier 3, speed 4.5, 60 charges; Use on an air tank or tube refills (300 L for full) | 1000 C: 4 plate, 1 air_tube, 2 stick |
| blast_nozzle | Blast Nozzle | hearth wall part (Forge gate) | needs >= 2 bar air, uses 20 L/s while the hearth burns; counts as 2 tuyeres | 1100 C: 4 plate, 1 air_tube, 2 firebrick |

### 4.5 Changes to existing content
- `boiler` (current one-block Forge boiler) is REMOVED from recipes; saves that contain one keep it as a legacy
  block that still works (do not delete the block id) - mark `legacy: true`, hidden from the Codex.
- `steam_engine` gets the 4.3 definition (the first-draft variant in STEAM_PLAN section 2 is void).
- `hot_fluid_pipe` (steel) stays the Forge upgrade for steam (16 bar) and lava.
- `item_pipe` (Bronze Chute) MOVES to the Bronze Age (owner decision, section 5.4): its recipe needs bronze
  plate and the Bronze Furnace, and it moves nothing without a Vacuum Pump. The Ember Age has no item pipes.
  The `pipe_ore` goal moves into the Bronze chain as `pneumatic_post`. `fast_item_pipe` (Forge/Current) keeps the
  push/pull port model and needs no vacuum.
- `blower` (electric) stays Current-era; the Blast hearth's tuyere requirement is met by `blast_nozzle`.
- Furnace tier 3 structure gains `requiredParts: { blast_nozzle: 1 }`.

## 5. The three networks - exact rules

All three reuse the pipe-graph pattern in `src/sim/pipeGraph.ts` (flood fill on place/remove only, caps
1024 blocks, per-network cached arrays) and the "one anchor entity per network stores the amount" trick of
`src/sim/fluidNet.ts` for saving. First step of the work is to generalise that file into
`netGraph.ts<T>(family predicate, join predicate)` so power-free networks do not multiply code.

### 5.1 Heat (`src/sim/heatNet.ts`)
- Members: thermocouples; SOURCES = furnace or formed hearth shell blocks (temperature = furnace temp, only if
  >= 200 C), lava blocks (1300 C, max 2 kW per touching face); USERS = hot_plate, heat_vent, heat_port, copper_kettle (STEAM_PLAN; the brewing Kettle Pot is not a heat user).
  A source or user touching any thermocouple of the network is in it. A user touching a furnace directly needs
  no thermocouple (distance 0).
- On rebuild: for each user, BFS distance `n` (thermocouple blocks) to each source.
- Per tick: users sorted by distance ask `demandW`. For each user pick the source with the highest
  `Tsrc x 0.98^n`. deliveredTemp = that value. deliveredW = min(demandW, remaining network cap 6000 W,
  source availability) where a furnace source's availability is unlimited (it just cools) and lava's is its
  face limit. The furnace is charged `deliveredW / 0.98^n` (losses are paid by the fire) through the existing
  heat-extraction path (`extractW`).
- A user works only if deliveredTemp >= its own minimum (hot plate: the recipe's minTempC; heat_vent 150 C;
  heat_port 150 C).
- Per-block temperature for rendering and burns: `Tblock = Tsrc x 0.98^(distance from source)` when the network
  delivered anything this tick, else decays toward ambient at 5%/s. Store one number per block in a typed
  array on the network (not saved).
- Burn: player AABB touching a block with Tblock > 300 -> `player.damage(1/s, 'burn')` via the survival
  contact-damage path (block contactDamage is static today: add a sim query `hotAt(x,y,z)` that survival's
  local scan consults; keep the scan at 2 Hz).

### 5.2 Steam (`src/sim/steamNet.ts`)
- Members: steam_pipe, steam_tank, steam_port (-> its boiler), safety_valve, pressure_gauge, users.
- State (saved on the anchor): `steamL`. volumeL = sum of member volumes (formed boiler: 1000 L per interior
  cell). **bar = steamL / volumeL** (so "1 bar" = the network's own volume of steam), clamped 0..12.
- Boiler production (section 6): `makeL = heatW x 0.006 x dt` litres of steam (6 L/s per kW), consuming
  `makeL / 10` litres of water. No water -> no steam (dry timer runs).
- Users each tick, in priority order valve < whistle < engines/hammers (so valves act on the pressure the
  users see): engine takes `6 x bar x drive x dt` where drive = 1 if its shaft network has work or is not
  seized, else 0.1 (idling); hammer takes 30 L per blow; whistle 20 L.
- Engine output: rpm = min(96, 16 x bar), capacity = 128 x bar, only if bar >= 2; else 0 with status
  "Needs 2 bar - has 1.3".
- Natural loss: 0.2% of steamL per second (pipes are not perfect) so idle networks sag slowly.
- Safety valve: if bar > setting, vent `(bar - setting) x volumeL` down to the setting, capped 400 L/s; emit
  `steam:vent` (rate-limited 1/s) for sound and plume.
- Rating = lowest `ratedBar` of members. If bar > rating: `overS += dt`; at overS >= 5 -> BURST the weakest
  member nearest the boiler (tie: first found): `explode(pos, radius 2 for pipes / 3 for a vessel)`, scald
  6 damage within radius 4 (cause 'burn'), steamL = 0, event `steam:burst`. If bar <= rating, overS decays at
  2x. Warning state from 7 bar (or rating - 1): event `steam:warning` on change, HUD sentence, gauge shake.
- Worked example (must become a test): smallest boiler (interior 1x1x2: 2 cells -> water 4000 L, steam volume
  2000 L) + 10 pipes (1000 L) = 3000 L volume; one heat port at 6 kW -> 36 L/s; one engine at equilibrium:
  36 = 6 x bar -> **6 bar, 96 rpm, capacity 768**; two engines: 3 bar each -> 48 rpm, capacity 384 each. With no
  user and no valve: 36 L/s into 3000 L = 0.012 bar/s -> 7 bar after ~9.7 min, burst ~1.4 min + 5 s later.
  (If playtests find that too slow to teach the lesson, raise the per-port heat to 10 kW - do not shrink volume.)

### 5.3 Air (`src/sim/airNet.ts`)
- Members: air_tube, air_tank, air_compressor (source), pressure_gauge, tube_station, press, drill,
  blast_nozzle. State `airL`; **bar = airL / volumeL**, max 6 (compressor makes nothing at 6).
- Compressor: `2 x rpm x dt` litres while its shaft turns at >= 32 rpm.
- Leaks: each tube arm that ends in a non-member, non-solid cell leaks `100 x bar / 6` L/s (hiss event,
  rate-limited). The mesher's join table says which arms exist; expose it to the sim through a registry helper
  so both agree.
- Users: per the table in 4.4; below their minimum they idle with "Needs 3 bar - has 1.8".
- Item transport is NOT in air tubes: see 5.4 (the Bronze Chute and the Vacuum Pump).
- Air hammer: sim action `chargeTool(x, y, z, heldStack)` -> takes up to 300 L, sets charges 60; the held
  stack's `durability` field carries charges (it never breaks at 0, it just stops: "Out of air").

### 5.4 Bronze Chute + Vacuum Pump (owner decision)
Owner: "bronze chute will be in bronze age and will require a pneumatic vacuum to make the items pump towards
the placement on the network where the vacuum is, and then items flow that direction in the pipe".
- A chute network (the existing `item_pipe` graph) with NO running vacuum pump is inert: status on every end
  "No suction - add a Vacuum Pump".
- A Vacuum Pump is a member of the chute network AND of an air network (it has an air_tube connection). It
  runs while its air network holds >= 2 bar and it has room to deliver. While items are moving toward it, it
  uses 30 L/s of air.
- Every chute end touching an inventory is an INLET by default (the wrench sets an end to Off; there is no
  Push/Pull choice on bronze chutes - the vacuum decides direction). Items leave inlets and travel along the
  shortest chute path TOWARD the nearest running vacuum pump, at 8 blocks/s, and are delivered into the
  inventory the pump touches (a crate, a furnace: smart sides apply) or, if it touches none, its 9-slot buffer.
- The inventory the pump itself delivers into is never an inlet for that pump (no loops).
- Two pumps on one network: each inlet feeds its nearest pump (ties: lowest position key). Filters: the pump
  screen has 5 filter slots (allow/deny) - what it will draw in.
- Packets, reservation and "Destination full" reuse `src/sim/itemNet.ts`; what changes is how destinations
  are chosen (always a vacuum pump) and the air cost. In the world the items visibly stream toward the pump and
  the chute glass shows a faint drift in that direction.
- Saves made before this change: existing bronze chutes with Pull/Push ports keep their ports and keep
  working as legacy networks (flag on the network anchor `legacyPorts: true`) until the player edits them.

## 6. The boiler vessel - first multiblock

- Rules (data in a `STRUCTURES` content table, shared scan with the hearth): hollow cuboid, all six sides
  closed; wall/floor/roof = `boiler_plate` (later `iron_boiler_plate` 16 bar); interior air only, 1x1x2 to
  3x3x4 (x, z, y); exactly one `boiler_gauge_glass` in a side face (not an edge); side faces may hold
  heat_port, water_port, steam_port; the roof may hold steam_port and safety_valve; required: >= 1 of each
  port. No glass, no other blocks. Another gauge glass in the shell fails ("Only one Gauge Glass").
- Smallest vessel: interior 1x1x2 -> shell 3x3x4 = 36 cells - 2 interior = 34 blocks: 30 plates + glass +
  three ports. Raw cost about 60 bronze plates' worth: this is the age's big build (tune if the solver or
  playtest says it is a wall: e.g. plate recipe -> 4).
- Formation is automatic (scan next tick after a change in the shell box + 1; retry while unformed only when
  the player is within 16 blocks or its screen is open; one-cell sweep every 4 ticks when formed).
- Grants by interior cells `c`: water capacity 2000 x c L; steam volume 1000 x c L; heat intake 6 kW per heat
  port (max ports = side faces available).
- Water level and steam live on the gauge-glass entity: `{ kind: 'boiler', waterL, dryS, formed: {...} }`;
  steam belongs to the steam network it joins through its steam_ports (if none connected, the vessel is its
  own network of volume 1000 x c).
- Dry fire: heatW > 0 and waterL = 0 -> dryS += dt; from 5 s: rattle sound + status "Boiling dry - add water";
  at 20 s: the vessel warps: unform, one random plate becomes 1 scrap_metal drop, toast. Reset when watered.
- Unforming for any reason never deletes water or parts; steam is lost.
- Screen (opened from the gauge glass or any port): pressure dial (bar, rating marked red), water bar, heat in
  (kW of max), steam out (L/s), valve setting if fitted, STRUCTURE tab (the same component the hearth uses:
  checklist, problems with tap-to-highlight, size steppers, materials have/need, Show in world ghost).

## 7. Contracts (src/core - append only)

```ts
// types.ts
export interface HeatSpec { role: 'conductor' | 'user' | 'port'; capW?: number; lossPerBlock?: number; demandW?: number; minTempC?: number }
export interface GasSpec  { family: 'steam' | 'air'; role: 'pipe' | 'tank' | 'user' | 'source' | 'valve' | 'gauge' | 'port' | 'station';
                            volumeL?: number; ratedBar?: number; minBar?: number; useLPerS?: number; useLPerJob?: number }
// BlockSpec gains: heat?: HeatSpec; gas?: GasSpec; legacy?: boolean
// BlockShape: thermocouples, steam pipes and air tubes reuse 'pipe' (PipeSpec.family gains 'heat' | 'steam' | 'air'
//   so the mesher's join tables and collars work unchanged; families never join each other).
export interface StructureRules { key: string; controller: string; walls: string[]; interior: 'air';
  ceiling: 'required' | 'optional'; minInner: [number, number, number]; maxInner: [number, number, number];
  faceParts: string[]; roofParts: string[]; required: Record<string, number>; edgeParts?: string[] }
// MachineRole gains 'vessel' (boiler controller), 'gas' (steam/air devices without watts or shafts).
```
- gameEvents: `'steam:vent' {x,y,z,rateL}`, `'steam:warning' {x,y,z,bar,rated,on:boolean}`,
  `'steam:burst' {x,y,z,radius}`, `'air:leak' {x,y,z}`, `'boiler:formed' / 'boiler:unformed' {x,y,z}`,
  `'boiler:dry' {x,y,z,seconds}`; flags `heat_moved`, `boiler_formed`, `engine_turning`, `air_2bar`,
  `tube_delivery`, `press_job`; SfxName `valve_shriek`, `boiler_burst`, `boiler_formed`, `boiler_rattle`,
  `air_hiss`, `piston`, `pneumatic_thump`, `tube_whoosh`, `steam_whistle`, `scald`.
- constants: `STEAM_L_PER_KW_S = 6`, `WATER_PER_STEAM = 0.1`, `STEAM_SAG_PER_S = 0.002`, `BURST_SECONDS = 5`,
  `BURST_WARN_MARGIN_BAR = 1`, `VALVE_MAX_VENT_L_S = 400`, `THERMO_LOSS = 0.02`, `THERMO_CAP_W = 6000`,
  `THERMO_BURN_C = 300`, `AIR_MAX_BAR = 6`, `AIR_LEAK_L_S = 100`, `DRY_WARN_S = 5`, `DRY_WARP_S = 20`.
- registry: `STRUCTURES`, `structureOf(controllerKey)`, validation for heat/gas specs and structure rules;
  `smallestShell(rules)` material count for the solver.

## 8. Work items, in order, with acceptance checks

**W0 - six tiers and ages (alone in the repo; before anything else, also before STEAM_PLAN's waves) - DONE (see `docs/api/ages.md`)**

Status: built and tested; the fixture, `migrateSixAges` (save version 2), the Bronze Furnace block (appended last, textures `furnace_bronze_*`),
the renumbering and the moves of the Bronze-age items onto the Bronze Furnace are in. Differences from the text below: the fixture is
`tests/fixtures/save-before-bronze.json`; block ids needed no palette (the new block is appended); `hearth` structure rules are keyed by the
new tier numbers 3-6 and the validator says tiers below `FIRST_HEARTH_TIER` have none; `bronze_furnace` is a new Ember-ending goal and the Blast
hearth goal opens the Forge Age. Still to do from this plan: `requiredParts: { blast_nozzle: 1 }` (B1) and the Blast hearth's air requirement.
1. Insert age 'bronze' at index 1 and furnace tier 2 `furnace_bronze` (block + 4 textures + numbers: 1100 C,
   heat capacity 220, loss 2.2, crucibles 2, fuel slots 2, speed 1.1, warmth 7; upgrade 8 bronze_ingot,
   4 firebrick, 1 bellows at 700 C). Renumber tiers 2-5 -> 3-6 and ages 1-4 -> 2-5 everywhere:
   `rg -n "minTier|furnaceTier|MAX_FURNACE_TIER|tier:|age:|tier \\d of" src scripts docs/api`.
2. Save migration in `src/save/document.ts` (version +1): furnace entities `tier >= 2` -> `+1`; settings and
   objectives untouched (ids). Confirm block ids are saved by key palette (see docs/api/world.md); if raw ids
   are stored, add a palette in this migration.
3. Commit a real save from the CURRENT release build as `tests/fixtures/save-v-before-bronze.json` BEFORE the
   change (make one with the e2e save step), then a test that it loads, its Blast hearth is still formed and
   the objective position is unchanged.
4. AC: typecheck, all unit tests, full `npm run e2e` (scripts must upgrade Clay -> Bronze -> Blast).

**B1 - contracts, content, art, sound (alone in the repo)**
Sections 4, 7; objectives of section 9; textures (bronze plate with rivets and seams + formed twin, glass
gauge with water, ports with coloured rings: heat = amber, water = blue, steam = white; rods; tubes with
glass; machines); sounds (measure like earlier engineers). Solver: Bronze needs no electricity; smallest
boiler materials obtainable at tier 2; tier 3 needs blast_nozzle + compressor + a shaft source. Playthrough
stand-ins marked. AC: content tests incl. "no electricity before tier 3", completable, Peaceful completable.

**B2 - simulation (three engineers can split: heat+boiler / steam / air+tubes, after `netGraph.ts` lands)**
0. FIRST, one engineer: `netGraph.ts` generalisation + `Subsystem` registration in `simulation.ts`
   ({ blockChanged, chunkChanged, tick, clear, resync }) + generalised structure scan (`structureScan.ts` from
   `hearthScan.ts`, hearth tests unchanged and green). Commit. Then the three in parallel.
1. Heat + boiler vessel (5.1, 6). 2. Steam (5.2) incl. engine as shaft source. 3. Air + pneumatic tubes +
   tools (5.3).
AC (tests): heat conservation (furnace cools by delivered / efficiency); 2%/block; 6 kW cap; user minimum
temperature; burn query; vessel forms/unforms with every problem code and size; capacities by size; dry-fire
timeline (5 s warn, 20 s warp); steam worked example numbers within 2%; valve holds its setting; burst only
after 5 s over rating and never with a valve <= rating; engine rpm/capacity by bar; sag; air production,
leak, stall at 6; tube sends refused under 2 bar; press/drill/hammer charge; save/load of water, steam, air,
packets; networks split/merge on pipe removal; unloaded chunks; perf: 10 vessels + 500 pipes < 0.3 ms/tick.
Playthrough extended: the scripted player builds the smallest boiler from `structureView` ghost cells, runs
an engine at 6 bar, compresses air, sends ore by tube, forges a blast nozzle, forms the Blast hearth.

**B3 - world/render, UI, player, audio (three engineers in parallel, API notes from B2 first)**
- Render: rods glow by temperature (3 active-texture steps or per-vertex tint from a sim snapshot - choose by
  cost, state which); gauge needles and gauge-glass water level in the parts layer (angle/height = value);
  engine beam + flywheel; valve plume; hiss puffs at leaks; packets in tubes; burst flash, debris, steam cloud;
  formed-shell seam flash. Screenshots at 1280x800 and 390x844: furnace -> rods -> hot plate at night; the
  boiler unformed with ghost, formed, venting, bursting; engine driving the mill; tube post between crates.
- UI: boiler screen (section 6), steam/air network panel on member screens, generic Structure tab moved to
  `src/ui/screens/structure/`, HUD lines: "Boiler pressure high - 7.2 bar of 8", "Boiling dry", gauges as
  target names ("Pressure Gauge - 5.4 bar"), How to Play card "Pressure and air", goal texts (section 9).
- Player: Use on valve cycles 2/4/6/8 (toast "Valve set to 6 bar"), Use with air hammer on tank/tube charges,
  Use on whistle; placing a port/valve into a formed shell replaces a plate only by breaking it first (no
  special case); burn from rods through the survival scan.
- Audio: one-shots of section 7 + ambience fields `boiler` (simmer by pressure), `piston` (by rpm), `air` (hiss
  by leak).
**B4 - wiring, e2e-bronze, review, release**
`scripts/e2e-bronze.mjs` (desktop + phonePortrait, real input, `__hw` only to give materials/tick): upgrade to
the Bronze Furnace; rods to a hot plate, cook; build the smallest boiler from the ghost; heat + water; gauge
reaches 2 bar; engine turns a millstone; with no valve and no user pressure passes the warning (HUD line
seen) and the vessel bursts while the player stands 8 blocks away unhurt; rebuild with a valve: it holds;
compressor to 2 bar; items drawn through a chute by a Vacuum Pump; blast nozzle; Blast hearth forms. Then the six-angle review workflow,
fixes, full suite, republish game + Codex (six ages), README, HANDOFF, PROGRESSION "built" tags.

## 9. Goals of the age (ids, titles, texts, conditions, rewards)

| id | title | completes when | text shown | reward |
|---|---|---|---|---|
| bronze_furnace | Band the furnace in bronze | furnaceTier 2 | "Eight bronze ingots, four firebricks and your bellows turn the Clay Furnace into a Bronze Furnace: 1100 C and two crucibles." | 4 thermocouple |
| move_heat | Move the heat | flag heat_moved (a heat user ran through >= 1 thermocouple) | "Thermocouples carry heat from the furnace. Lay a line to a Hot Plate and cook on it. Mind your hands." | - |
| build_boiler | Build a steam boiler | flag boiler_formed | "A boiler is a sealed box of Boiler Plate with a Gauge Glass and three ports. Open the Structure planner on the Gauge Glass and follow the ghost." | 6 steam_pipe |
| raise_steam | Raise steam | a steam network at >= 2 bar | "Heat to the Heat Port, water to the Water Port. Watch the glass." | 1 pressure_gauge |
| fit_valve | Fit a safety valve | place safety_valve | "Bronze holds 8 bar. Past that it bursts. A Safety Valve lets go first - Use it to choose the pressure." | - |
| piston_power | Piston power | flag engine_turning | "A Steam Engine turns faster with every bar. Run a pipe from the Steam Port." | 2 bronze_gearbox |
| compress_air | Compress air | flag air_2bar | "Put an Air Compressor on a shaft. Air Tubes carry it; an Air Tank stores it. Cap the ends or it leaks." | 8 air_tube |
| pneumatic_post | Pneumatic post | flag tube_delivery | "Lay Bronze Chute from a crate to a Vacuum Pump on your air line. The pump draws everything toward itself." | - |
| press_plates | Press plates | flag press_job | "The Pneumatic Press shapes metal cold: no trip to the forge." | - |
| make_nozzle | Forge a blast nozzle | make blast_nozzle | "A fire fed with forced air burns hot enough for iron. Set this in a brick hearth wall and feed it air." | - |
Next (Forge): blast_furnace now reads "Build brick walls around the furnace with a Blast Nozzle in one wall,
fed by air."

## 10. Status sentences (exact strings the player must see)

Heat: "Carrying 1.2 kW at 640 C" / "No heat - the furnace is below 200 C" / "Line is full - 6 kW" /
"Too cool here - 410 C of 700 C needed: shorten the line".
Boiler: "Formed - 3x3x4, holds 4000 L" / "Not formed" / "5.2 bar - rated 8" / "Pressure high - 7.4 bar of 8:
use the steam or fit a Safety Valve" / "Boiling dry - add water" / "No heat at the Heat Port" / "Warped - a
plate cracked. Replace it."
Engine: "Turning at 80 rpm on 5 bar" / "Needs 2 bar - has 1.3" / "Idling - nothing to turn".
Valve: "Set to 6 bar" / "Venting".
Air: "4.1 bar" / "Leaking - an open tube end at (x, y, z)" (tap highlights it, like hearth problems) /
"Needs 3 bar - has 1.8" / "No air pressure".
Air hammer: "Out of air - Use it on an Air Tank".

## 11. Old world tie-in (the Emberbound and ruins)

- Ruins gain Bronze-age relics: a burst boiler shell (cracked plates, drop scrap), dead gauges, a length of
  tube with a crate still holding a few items. "Deep" loot may hold 2-4 `boiler_plate` or a `pressure_gauge`.
- Bellows Hounds ARE pneumatic: their wind-up is the `air_hiss` family. Forge Wardens' hammer = a steam hammer.
  A new minor automaton fits this age if wanted later: the "Steam Lurcher" that vents scalding steam (not in
  scope; listed so the idea is not lost).

## 12. Risks and how to keep out of them

- Network sprawl (power, shafts, items, fluids, heat, steam, air): B2 step 0 exists to prevent seven
  near-copies. Do not skip it.
- The smallest boiler may be too expensive for the pace of the age: the solver prints the raw budget per tier -
  keep the Bronze total under about 1.5x the Ember total; tune the plate recipe yield first.
- Pressure maths drift: keep ONE definition (bar = stored / volume) for steam and air; every user's rate is
  linear in bar; write the worked example as a test before tuning anything.
- Phones: needles are small - aiming at a gauge must show the number as target text; warnings are text + sound,
  never colour alone.
- Fairness: bursts are opt-in by neglect. A6 and A5 are tests, not hopes.
- Old saves: the legacy one-block boiler and the old steam engine keep working as they did (legacy blocks);
  new ones cannot be crafted.

## 13. Ready-to-paste briefs (chain workflow: `{ model, effort, tasks: [{ label, brief }] }`)

Common preamble as in STEAM_PLAN section 12. Then:
- `bronze:w0` - "REFACTOR: six furnace tiers and six ages. docs/BRONZE_PLAN.md section 2 and work item W0 are
  your whole brief. Nobody else is in the repository. Commit the old-save fixture FIRST. Finish with the full
  npm run e2e."
- `bronze:content` - "FEATURE DATA: the Bronze Age. docs/BRONZE_PLAN.md sections 1, 4, 7, 9, 11 and work item
  B1. Follow names and numbers exactly; report any you change and why."
- `bronze:netgraph` - "REFACTOR: shared network graph, Subsystem registration, generic structure scan.
  docs/BRONZE_PLAN.md B2 step 0. All existing sim tests must stay green and unchanged."
- `bronze:heat+boiler`, `bronze:steam`, `bronze:air` - "FEATURE BEHAVIOUR: docs/BRONZE_PLAN.md sections 5.1 +
  6 / 5.2 / 5.3 and the B2 acceptance list. Write your docs/api note first. Scope: src/sim."
- `bronze:render`, `bronze:ui`, `bronze:player+audio` - "docs/BRONZE_PLAN.md B3 (your bullet), sections 3, 6,
  10. Screenshots at both sizes; look at every one."
- `bronze:wiring` - "docs/BRONZE_PLAN.md B4. Full npm run e2e at the end, reported honestly."


## 14. Pseudocode for the hard parts

Written to be turned into TypeScript nearly line for line. `dt` = 0.05 s. All numbers come from content or
constants; literals here are for reading only.

### 14.1 One graph builder for every network (`src/sim/netGraph.ts`)
```
type Family = { name; isMember(def, voxel) -> bool; joins(aDef, aVoxel, bDef, bVoxel, dir) -> bool }
class NetGraph<N>:
  nets: Map<id, Net<N>>           // Net = { id, cells: Int32Array (packed xyz), anchorKey, data: N, dirty }
  cellNet: Map<posKey, id>
  dirty: Set<posKey>

  blockChanged(x,y,z, fromDef, toDef):
    if family.isMember(fromDef) or family.isMember(toDef) or touchesMember(x,y,z):
      dirty.add(key(x,y,z)); for each of 6 neighbours: dirty.add(neighbour)

  rebuild(world, makeData, splitData, mergeData):        // called at the start of a tick if dirty not empty
    affected = { cellNet[k] for k in dirty if present }
    seeds    = cells of affected nets + dirty cells that are members now
    oldData  = affected nets' data (with their cell lists)       // for conservation
    delete affected nets
    for seed in seeds, not yet visited:
      cells = floodFill(seed)          // BFS, cap 1024; a chunk not loaded -> mark net.waiting = true and stop there
      net = new Net(cells); net.data = makeData(net)
      // conservation: every old net hands its amount to the new nets that contain its old cells,
      // split in proportion to the number of old cells each new net received
      for o in oldData: share = count(cells in o.cells) / o.cells.length
                        if share > 0: mergeData(net.data, splitData(o.data, share))
    dirty.clear()
  anchor(net) = lowest posKey cell; its block entity stores net.data for saving
```
Tests: place/remove in the middle splits and conserves; joining two nets merges; unloaded chunk waits; 1024 cap.

### 14.2 Heat network tick (`heatNet.ts`)
```
onRebuild(net):
  net.sources = members touching a furnace/hearth shell (>= 200 C) or lava
  net.users   = hot_plate, heat_vent, heat_port, copper_kettle touching a member
  for u in users: for s in sources: dist[u][s] = bfsBlocks(u.touchCell -> s.touchCell)   // thermocouple count
  for cell in net.cells: distToAnySource[cell] = multi-source BFS

tick(net, dt):
  capLeft = THERMO_CAP_W
  net.delivering = false
  for u in users sorted by nearest source distance:
    want = u.demandW()                     // 0 if idle (no job, boiler full of steam, room warm...)
    if want <= 0: u.deliveredW = 0; continue
    best = argmax over s of  T(s) * 0.98 ^ dist[u][s]
    Tdel = T(best) * 0.98 ^ dist[u][best]
    if Tdel < u.minTempC: u.deliveredW = 0; u.status = tooCool(Tdel, u.minTempC); continue
    w = min(want, capLeft, sourceLimit(best))
    capLeft -= w
    u.deliveredW = w; u.deliveredTempC = Tdel
    charge(best, w / 0.98 ^ dist[u][best])       // furnace: extractW += ...; lava: per-face budget
    net.delivering = net.delivering or w > 0
  // per-block temperature for glow and burns
  for cell: target = net.delivering ? Thottest * 0.98 ^ distToAnySource[cell] : AMBIENT
            temp[cell] += (target - temp[cell]) * min(1, 0.5 * dt * (target > temp[cell] ? 4 : 1))
hotAt(x,y,z) = temp[cell] if member else 0       // survival's 2 Hz contact scan asks this
```

### 14.3 Steam network tick, with valve and burst (`steamNet.ts`)
```
tick(net, dt):
  vol = net.volumeL                                     // cached on rebuild (pipes, tanks, formed vessels)
  // 1. make
  for b in net.boilers:                                 // formed vessels joined through steam ports
    heatW = sum(port.deliveredW for port in b.heatPorts)
    if b.waterL > 0 and heatW > 0:
      make = heatW / 1000 * STEAM_L_PER_KW_S * dt
      water = min(b.waterL, make * WATER_PER_STEAM)
      b.waterL -= water; net.steamL += water / WATER_PER_STEAM; b.dryS = 0
    else if heatW > 0: b.dryS += dt; dryFire(b)         // 14.6
  bar = net.steamL / vol
  // 2. valves first: they define the pressure users see
  for v in net.valves:
    if bar > v.setting:
      vent = min((bar - v.setting) * vol, VALVE_MAX_VENT_L_S * dt)
      net.steamL -= vent; bar = net.steamL / vol; emitRateLimited('steam:vent', v, vent / dt)
  // 3. users, pro rata if steam is short
  want = sum(u.wantL(bar, dt))                          // engine: 6 * bar * drive * dt ; hammer: per blow
  k = want > 0 ? min(1, net.steamL / want) : 0
  for u in users: got = u.wantL * k; net.steamL -= got; u.apply(bar, got / max(u.wantL, eps))
  // 4. sag
  net.steamL *= 1 - STEAM_SAG_PER_S * dt
  bar = clamp(net.steamL / vol, 0, 12); net.bar = bar
  // 5. danger
  rated = net.ratedBar                                  // min over members
  warn = bar >= rated - BURST_WARN_MARGIN_BAR
  if warn != net.warn: net.warn = warn; emit('steam:warning', { bar, rated, on: warn })
  if bar > rated: net.overS += dt else net.overS = max(0, net.overS - 2 * dt)
  if net.overS >= BURST_SECONDS: burst(net)

burst(net):
  m = weakest member (lowest ratedBar; tie -> nearest to a boiler; tie -> lowest posKey)
  radius = m is vessel shell ? 3 : 2
  net.steamL = 0; net.overS = 0
  scheduleExplosion(m.pos, radius, { scaldDamage: 6, scaldRadius: 4, cause: 'burn', dropHalfOf: vessel plates })
  emit('steam:burst', ...)                              // explosion code already exists for meltdowns

engine.apply(bar, satisfied):
  if bar < 2: rpm = 0; status = needsBar(2, bar); return
  rpm = min(96, 16 * bar) * satisfied; capacity = 128 * bar * satisfied
  -> feeds the shaft solver as a source (STEAM_PLAN section 3)
engine.drive = its shaft network has load and is not seized ? 1 : 0.1
```
Test to write first: the worked example in 5.2 (6 kW, one engine -> 6 bar within 2%; two engines -> 3 bar).

### 14.4 Air network and the vacuum-drawn chute (`airNet.ts`, changes in `itemNet.ts`)
```
air.tick(net, dt):
  for c in compressors: if c.rpm >= 32 and net.bar < AIR_MAX_BAR: net.airL += 2 * c.rpm * dt
  for end in net.openEnds: net.airL -= AIR_LEAK_L_S * (net.bar / AIR_MAX_BAR) * dt; emitRateLimited('air:leak', end)
  users take per job / per second as in 4.4, refused below their minBar
  net.bar = clamp(net.airL / net.volumeL, 0, AIR_MAX_BAR)

// chute network = existing item pipe graph. New: destinations are vacuum pumps only.
chute.onRebuild(net):
  net.pumps  = vacuum_pump members
  net.inlets = chute ends touching an inventory, mode != off, excluding each pump's own delivery inventory
  for p in pumps: distFrom[p] = BFS over chute cells from p          // field: steps to pump
  for inlet: inlet.pump = argmin over running-capable pumps of distFrom[p][inlet.cell]
             inlet.path = walk from inlet.cell always stepping to a neighbour with smaller distFrom[pump]

chute.tick(net, dt):
  for p in pumps: p.running = p.on and airNetOf(p).bar >= 2 and p.hasRoom()
  moving = false
  for inlet in net.inlets (round robin start index):
    p = inlet.pump; if !p or !p.running: inlet.status = p ? 'No air pressure' : 'No suction - add a Vacuum Pump'; continue
    if inlet.cooldown > 0: inlet.cooldown -= dt; continue
    stack = first extractable stack passing p.filter
    if !stack: inlet.status = 'Nothing to draw'; continue
    n = min(16, stack.count, p.reserveRoom(stack.item))               // reservation exactly as itemNet does today
    if n == 0: inlet.status = 'Destination full'; continue
    extract(n); packets.push({ item, n, path: inlet.path, to: p, t: 0, dur: path.length / 8 })
    inlet.cooldown = 0.5
  for pk in packets: pk.t += dt; moving = true
     if pk.t >= pk.dur: p.deliver(pk) or (p.buffer.add) or returnToSource(pk)   // never drop items
  for p in pumps: if moving toward p: airNetOf(p).airL -= 30 * dt
```
Render reads the same packet list the renderer already consumes (`sim.transportView()`).

### 14.5 One structure scan for hearths and boilers (`structureScan.ts`)
```
scan(world, controllerPos, facing, rules: StructureRules) -> { ok, inner, cells[], problems[] (max 8), parts{} }:
  start = controllerPos + behind(facing)                 // first interior cell
  if !isAir(start): return fail('interior', start, 'Interior must be empty')
  // 1. size of the interior box on the controller's layer
  for dir in [left, right, back]: walk air from start until a non-air cell, max rules.maxInner + 1
      if ran out: return fail('too_large' or 'gap', lastCell)     // 'gap' if a previous formed box exists there
  x0..x1, z0..z1 from the walks
  // 2. extend down then up while every interior cell of the layer is air
  y0 = lowest layer still all air;  y1 = highest layer still all air (cap rules.maxInner.y)
  if size < rules.minInner: fail('too_small')
  // 3. classify every shell cell of the box (inner box grown by 1)
  for cell in shell:
    role = on 2 or 3 faces at once ? 'edge' : y == y0-1 ? 'floor' : y == y1+1 ? 'roof' : 'face'
    b = block at cell
    if cell == controllerPos: require role == 'face'
    else if b in rules.walls: count wall tier
    else if role == 'face' and b in rules.faceParts: parts[b]++
    else if role == 'roof' and b in rules.roofParts: parts[b]++
    else if role == 'roof' and rules.ceiling == 'optional' and isAir(b): openTop = true
    else problems.push({ code: role == 'edge' ? 'edge_block' : 'wrong_block', pos: cell, need: rules.walls[0] })
    if b is another controller of the same rules: problems.push('other_controller')
  for (part, n) in rules.required: if parts[part] < n: problems.push({ code: 'missing_part', part, need: n - parts[part] })
  ok = problems.length == 0
```
The hearth passes its tier rules (and picks the highest tier whose rules pass); the boiler passes 6. The
existing hearth tests must pass unchanged against the generalised function before the boiler is written.

### 14.6 Boiler vessel runtime (`boilerVessel.ts`)
```
track(controller): entry = { e, formed: null, dirty: true, retryS: 0, sweep: 0 }
tick(dt):
  for v in vessels (chunk loaded):
    if v.dirty or (!v.formed and playerNear(v, 16) and (v.retryS += dt) >= 1):
      r = scan(world, v.pos, facing, STRUCTURES.boiler); v.dirty = false; v.retryS = 0
      if r.ok and !v.formed: form(v, r)        // set active bits on shell, capacities, join steam nets, event + sfx
      if !r.ok and v.formed: unform(v, r)      // clear bits, keep water, drop steam, toast with first problem
      v.lastResult = r
    else if v.formed and tick % 4 == 0: check one shell cell (v.sweep++); mismatch -> v.dirty = true
    if v.formed: fill water from water ports (fluid endpoint), clamp to capacity
dryFire(b):
  if b.dryS >= DRY_WARN_S and !b.warned: b.warned = true; emit('boiler:dry'); sfx 'boiler_rattle' every 2 s
  if b.dryS >= DRY_WARP_S: replace one random shell plate with air + give/leave 1 scrap_metal; unform; toast
blockChanged(x,y,z): for v whose box grown by 1 contains (x,y,z): v.dirty = true
```

> **Ground items (built):** dropped items are world entities (`docs/api/ground-items.md`). The Bronze Age also gets a handheld
> **Hand Vacuum Pump** (`hand_vacuum`, wear-powered, radius 9) that pulls ground items to the player. It is not the chute machine
> `vacuum_pump` below. (Done in W0: `hand_vacuum` is `forge(2, ...)`, age 1.)
> The Current Age Electromagnet is the same mechanism with an electric power source (`COLLECTORS` in `src/game/collectors.ts`).

<!-- ======================== END docs/BRONZE_PLAN.md ======================== -->


---

<!-- ======================= BEGIN docs/DISTILLERY_PLAN.md ======================= -->
# FILE: docs/DISTILLERY_PLAN.md

# Distillery plan - modular glass chemistry (design, crafting tree, pseudocode, work list)

Status: **plan only, no code yet** (written 2026-11-21). Owner's brief: a modular multiblock of interchangeable glass
chemistry blocks that runs liquid crafting jobs, with liquids visibly dripping, boiling and changing colour, and a
deep product tree: potions, alcohols, syrups, lubricants, and crude oil refined to gasoline, kerosene, diesel,
bitumen and asphalt. Blocks and textures must change in the world when a step completes.

Names marked (verify) were not checked against the code and must be confirmed before use.

## 0. The five ideas that make this tractable

1. **Mixtures, not recipes, for separation.** Every liquid inside a rig is a vector of components
   (`{ ethanol: 120, water: 850, fusel: 30 }` litres). Each component has a boiling point. Distilling is then one
   piece of physics for everything: wash to spirit, sap to syrup, crude to fractions, residue to lubricant are the
   same 40 lines of code with different inputs. Conservation of volume is true by construction (section 5).
2. **Geometry is the wiring.** Vapour goes up, liquid goes down or sideways, never up. The player never configures
   a port: where a block sits says what it does. This removes the N x N interaction table (section 3).
3. **Capabilities, not layouts.** Modules contribute capabilities to the vessel they touch (heated, sealed,
   cooled, stirred, vacuum, catalyst). A reaction asks for capabilities and a temperature window; it never names a
   layout. 12 block kinds give dozens of distinct rigs with no per-rig code (section 4).
4. **Round-down naming at the boundary.** Pipes, tanks and containers carry one named fluid. A mixture leaving a rig
   is named by its largest component and its purity grade, rounded down; a named fluid entering a rig expands to
   that grade's minimum composition. Volume is exact, purity can only be lost at a boundary, never invented. This
   is what makes re-input chains (distil twice) meaningful and safe (section 5.4).
5. **Executable process cards.** Each Codex process carries a rig blueprint string. The same string draws the Codex
   diagram, feeds the ghost preview, is built and run by a unit test, and gives the progression solver its cost.
   The documentation cannot drift from the simulation (section 7).

## 1. Scanner choice: a module graph, reusing the hearth plumbing

The hearth scan (`src/sim/hearthScan.ts`) validates a hollow cuboid. A still is a free-form tree of touching
blocks, so it gets its own **flood-fill module graph** (`src/sim/distillScan.ts`). Reused as is, not copied:

| reused | from | for |
|---|---|---|
| problem shape `{ code, text, cells }`, cap of 8, tap-to-pulse highlight | `hearthScan.ts`, `HEARTH_MAX_PROBLEMS`, `HEARTH_HIGHLIGHT_S` | STRUCTURE tab of the rig |
| when to rescan (dirty on `block:changed` in range, 1 s while near or screen open) | `hearth.ts`, `HEARTH_RESCAN_S/RANGE` | `DistillSet` |
| `structureView` + ghost preview pipeline | `hearthView.ts`, `src/render/tech/ghosts.ts` | blueprint ghosts |
| proxy map "this block stands for that controller" | `shellOwner` in `hearth.ts` | chem ports reaching module buffers |
| `FluidEndpoint` / `ItemEndpoint` | `src/sim/endpoints.ts` | chem ports on pipes |
| heat draw via `furnace.extractW`, `furnaceBelow` | `brewing.ts` `BrewHost` | the still base on a furnace top |
| entities as plain JSON, never machine nodes | `brewing.ts` | every chem module |
| instanced boxes | `src/render/tech/boxBatch.ts` | glassware and liquids |

## 2. Blocks (all in `src/content/blocksDistill.ts`, appended last so voxel ids never move)

Look: each module is a translucent cube, a brass-framed glass case (existing translucent batch, no mesher change).
The glassware inside, the liquid, bubbles and drips are drawn by `src/render/distill/` (section 8).

| key | role | buffer | notes |
|---|---|---|---|
| `still_base` | heat adapter | - | on a furnace top (`FURNACE_TOPS`) it takes the furnace temperature; on the ground it burns a fuel item itself (charcoal 250 C, ethanol beaker 300 C) |
| `boiling_flask` | boiler vessel | 4000 L | must stand on a `still_base`. Borosilicate limit 450 C |
| `reaction_vessel` | reactor | 4000 L + 4 item slots | reactions happen here; heated only if on a `still_base` |
| `column_segment` | vapour riser | 200 L holdup | stacks on a flask, up to 8. Each is one theoretical plate |
| `reflux_head` | top of a column | - | wrench cycles return 0 / 50 / 75 %: more purity, less flow |
| `condenser_coil` | vapour to liquid | 100 L | beside a column segment = side draw (a cut); on top of the stack = head |
| `cooling_jacket` | modifier | 1000 L water | touching a condenser: head 30 C instead of 60 C, x3 rate. Touching a vessel: capability `cooled` |
| `receiver` | collection vessel | 2000 L | where liquid ends up; beakers, canisters and ports take from it |
| `glass_tube` | liquid line | 50 L | carries liquid sideways and down, never up; shows the stream's colour |
| `filter_bed` | inline filter | 500 L + 1 slot | liquid in from above, out below; uses up a medium (charcoal, sand, clay) |
| `catalyst_bed` | modifier in the vapour path | 1 slot | sits in the column stack like a segment; holds a catalyst with durability |
| `airlock_cap` | cap | - | on a vessel: capability `sealed` (fermenting) |
| `vacuum_cap` | cap | - | on a stack or vessel: pressure 0.1 bar, boiling points x0.7. Needs power or shaft rpm |
| `pressure_cap` | cap | - | pressure 5 bar, boiling points x1.3, capability `pressure` |
| `chem_port` | fluid endpoint | proxy | touching a flask or vessel it is an inlet, touching a receiver an outlet. One block, direction from position |
| `chem_hopper` | item endpoint | proxy | item pipes into a vessel's or bed's slots |

### 2.1 Step-completion states in the world (owner's requirement)

Every module shows its state on the block itself, readable from across the room with no screen open. The voxel has
one free state bit (ACTIVE), so each stateful module is **two block variants x the active bit = four states**,
exactly the cup-stage pattern of brewing (`CUP_BLOCK`, block swaps done by the sim):

| state | block | active bit | frame lamp on the tile | glass |
|---|---|---|---|---|
| idle / empty | `X` | 0 | dark | clear |
| working | `X` | 1 | amber, flickers (`_on` twin) | fogged at the top, lit by `lightActive` |
| step complete | `X_done` | 0 | green | clear, liquid settled |
| blocked | `X_done` | 1 | red | - |

- Stateful modules: `boiling_flask`, `reaction_vessel`, `receiver`, `filter_bed`, `catalyst_bed`, `still_base`
  (base: cold / firing only). The `_done` variants are `item: false` and drop the plain block.
- What "complete" means per module: flask - the charge is spent (nothing left that boils at this temperature);
  vessel - the reaction ran to its end; receiver - full, or its source finished; filter and catalyst beds -
  medium spent (shown red: blocked, needs a new one).
- **Extra visible changes that cost no textures**: the fermenter's liquid goes cloudy then clears; a spent filter
  medium is drawn dark; a column draws one colour band per cut actually flowing; a `still_base` with the whole rig
  finished gets a small green flag drawn by the renderer; each change of state emits `distill:step`
  `{ x, y, z, state, process? }` with a `sfx` (glass chime on complete, dull clunk on blocked) and one toast per
  finished run ("Spirit run finished - 1.4 buckets in the receiver").
- Texture budget: 2 shared frame tiles (`chem_case`, `chem_case_top`) x 4 lamp states = 8 tiles, plus one emblem
  tile per module kind composited into the frame at paint time (16 kinds x at most 4 states, painted from one
  function, so no hand-drawn duplicates). The atlas already splits past 256 layers; raise the content-test cap.
- Objectives hook on `distill:step` with `state: 'done'` and the process key ("Run your first spirit").

## 3. How blocks connect: the adjacency rules (the whole interaction table)

Each kind declares what it does through each face class. `U` up, `D` down, `H` any horizontal face.

| kind | vapour in | vapour out | liquid in | liquid out | attaches as modifier to |
|---|---|---|---|---|---|
| still_base | - | - | - | - | vessel on its U (gives heat) |
| boiling_flask | - | U | U, H (ports, tubes) | D-side drain cock (H tube at the base) | - |
| reaction_vessel | - | U (only if heated) | U, H | H, D | - |
| column_segment | D | U, H (to a condenser) | U (reflux falling back) | D | - |
| catalyst_bed | D | U | - | - | the stack it is in |
| reflux_head | D | U, H | - | D | the stack below |
| condenser_coil | D or H | - | - | D, H | - |
| receiver | - | - | U, H | H, D | - |
| glass_tube | - | - | U, H | H, D | - |
| filter_bed | - | - | U | D | - |
| caps | - | - | - | - | the block on their D |
| cooling_jacket | - | - | - | - | every condenser or vessel on its H, U, D |
| chem_port / chem_hopper | - | - | - | - | the first vessel-like block they touch |

Edges are derived, never stored:

```
vapourEdge(a -> b)  iff  a.vapourOut has the face towards b  and  b.vapourIn has the face towards a
liquidEdge(a -> b)  iff  a.liquidOut has the face towards b  and  b.liquidIn has the face towards a
                         and b is not above a
```

Because liquid never goes up, **the liquid graph has no cycles inside one rig except through a vapour edge**
(boil up, drip back: that is reflux, and it is legal). Lifting liquid needs a `chem_port`, a normal fluid pipe and
a pump, so every long re-input loop passes through the named-fluid boundary of idea 4. A cascade down a hillside
needs no pump at all: receiver, tube, next flask one block lower.

Tie-breaks that keep it deterministic: several liquid targets split evenly (fixed order: D first, then N, E, S, W);
a condenser touching two columns serves the lower-indexed one and reports a problem.

## 4. Capabilities and the rigs they make

```
caps(vessel) = { heated      if on a still_base that is firing
                 sealed      if airlock_cap on top
                 vacuum      if vacuum_cap on top of it or of its stack (and powered)
                 pressure    if pressure_cap likewise
                 cooled      if a cooling_jacket with water touches it
                 stirred     if a mech shaft >= 16 rpm touches it (STEAM_PLAN mech graph; later)
                 catalyst:k  if a catalyst_bed holding k is in its stack
                 plates:n    column segments above it x reflux factor }
```

| rig (smallest form) | blocks | capabilities | what it does |
|---|---|---|---|
| Pot still | base, flask, condenser on top, receiver beside | heated | one-pass distilling, evaporating |
| Fractionating column | base, flask, n segments, side condensers, head condenser, receivers | heated, plates:n | n+1 cuts in one pass |
| Reflux still | pot still + segments + reflux_head | heated, plates x(1+2r) | high purity (fuel ethanol) |
| Fermenter | vessel + airlock_cap | sealed | wash, wine, must (no heat) |
| Heated reactor | base, vessel | heated | infusions, asphalt mix, soap, blending |
| Crystalliser | vessel + cooling_jacket | cooled | syrup to sugar + molasses |
| Vacuum still | any still + vacuum_cap | heated, vacuum | gentle concentration (potions), residue to lube base |
| Cracker | column with catalyst_bed + pressure_cap | heated, pressure, catalyst | heavy oil to gasoline |
| Polishing line | receiver, filter_bed, receiver | - | lube base to lubricant, cloudy to clear |

Everything composes: a fermenter draining through a filter into a flask with a 3-segment column is one rig that
turns berries into brandy unattended. No code knows that rig exists.

## 5. The mixture model (`src/core/chem.ts`, pure, DOM-free)

### 5.1 Components

| component | bp C | colour | viscosity | notes |
|---|---|---|---|---|
| methanol ("heads") | 65 | 0xdfe8ee | 0.6 | comes first; makes Rough Spirit if kept |
| ethanol | 78 | 0xf1efe2 | 1.0 | |
| gasoline | 90 | 0xf2d24a | 0.5 | |
| water | 100 | 0x3a86b4 | 1.0 | |
| fusel ("tails") | 130 | 0xb9a36a | 2.0 | |
| turpentine | 160 | 0xcfe0a6 | 1.2 | from pine sap |
| kerosene | 190 | 0x9fc4e8 | 1.5 | |
| diesel | 280 | 0xc98f2e | 3.0 | |
| lube_base | 370 | 0x7a5a1e | 12 | |
| bitumen | 520 | 0x15120f | 200 | never boils in glass |
| sugars, rosin, essence_*, solids | none | per key | 30 | non-volatile: stay in the flask |

Feed compositions (`FluidSpec.mix`, fractions sum to 1, checked by validation):

```
crude_oil   gasoline .22  kerosene .13  diesel .30  lube_base .12  bitumen .23
pine_sap    water .60  sugars .20  turpentine .10  rosin .10
sugar_wash  water .84  ethanol .12  methanol .01  fusel .03
grain_wash  water .86  ethanol .10  methanol .01  fusel .03
berry_must  water .85  ethanol .11  methanol .01  fusel .02  essence_berry .01
residue     lube_base .34  bitumen .66            (what an atmospheric crude run leaves)
```

### 5.2 One step of a still (runs at 4 Hz, not every tick)

```
stepStill(rig, flask, dt):
  T  = flask.tempC                      # first-order lag towards the base's temperature
  pf = vacuum ? 0.7 : pressure ? 1.3 : 1
  n  = 1 + rig.plates * (1 + 2 * rig.refluxRatio)        # enrichment exponent
  for each component i in flask.mix:
      bp   = bpOf(i) * pf
      gate = clamp((T - bp + 40) / 40, 0, 1)             # starts 40 C under its boiling point
      w[i] = flask.mix[i] * gate * 2 ** ((100 - bp) / 10 * n)      # relative volatility ^ n
  if sum(w) == 0: flask.state = DONE; return             # spent charge -> block swaps to flask_done
  V = min(heatW / LATENT_J_PER_L,                        # heat limited
          sum(condenser rates) * (1 - rig.refluxRatio),  # condenser limited
          flask.litres / dt)
  for each component i:
      dL   = min(flask.mix[i], V * dt * w[i] / sum(w))
      draw = drawFor(rig, bp_i, T)                       # section 5.3
      took = draw.receiverChain.accept(i, dL)            # may be less: receiver full
      flask.mix[i] -= took                               # ONLY ever moves what was accepted
  furnace.extractW += V * LATENT_J_PER_L + lossW
```

The single `took` line is the conservation proof: litres leave the flask only as litres entering exactly one
buffer. Unit test: total litres over all modules is constant to 1e-6 across 10 000 steps of random rigs.

Tuning check done by hand: `sugar_wash` in a pot still (n = 1) gives 38 % ethanol (Low Wines); that run again gives
74 % (Spirit); three plates in one pass give 93 % (Fuel Ethanol). Plates and second passes are both real choices.

### 5.3 Where each component leaves a column

```
trayT(h) = T_flask - (T_flask - T_head) * h / H        # H = stack height, T_head 60 C (air) or 30 C (jacket)
drawFor(rig, bp, T):
  for draw in rig.sideDraws ordered bottom to top:     # a condenser beside segment h
      if bp >= trayT(draw.h): return draw              # it condenses here: this is its cut
  return rig.head                                      # light ends reach the top
  # bp > T + 40 never left the flask: it is the residue, drained from the flask's cock
smear: a share 1 / (2 + segments between this draw and the next) of each cut goes to the neighbouring draw
```

Worked example the slice must reproduce: crude at 350 C, 3 segments, 2 side draws, jacketed head:
trays at 243 / 137 / 30 C. Diesel (280) condenses at draw 1, kerosene (190) at draw 2, gasoline (90) at the head,
and `residue` (lube base + bitumen) stays. A 2-segment column merges diesel and kerosene into one worse cut: the
player sees why height matters. Stack height = number of cuts.

### 5.4 The boundary: naming a mixture and expanding a name

```
nameOf(mix):                                   # leaving a rig: receiver -> beaker, port, pipe
  major = component with the largest share s
  return highest grade g of major with g.minPurity <= s, else 'slop'
expand(fluid, L):                              # entering a rig
  g = gradeOf(fluid);  return { g.major: L * g.minPurity, ...g.rest scaled to L * (1 - g.minPurity) }
```

Grades: ethanol - `low_wines` 0.30, `spirit` 0.65, `fuel_ethanol` 0.90. Diesel - `diesel` 0.80. Gasoline -
`gasoline` 0.80. Kerosene - `kerosene` 0.75. Lube - `lube_base` 0.70. Sugars - `syrup` 0.55. Anything else is
`slop`, which can be poured back into a flask (it expands to a stored fixed mix: cheap, lossy, never a dead end).
Because expansion uses the minimum purity, storing a liquid can only lose quality: no exploit by round-tripping.

## 6. Reactions (`src/content/recipesDistill.ts`: `REACTION_SPECS`)

```ts
interface ReactionSpec {
  key: string; name: string;
  in: Partial<Record<Component, number>>;      // parts by volume
  items?: ItemAmount[];                        // consumed from the vessel's slots per batchL
  out: Partial<Record<Component, number>>;     // parts; sum(out) == sum(in) unless `gasLoss` is declared
  gives?: ItemAmount[];                        // solids handed out when done (sugar, rosin, asphalt)
  needs: Capability[];                         // sealed, heated, cooled, vacuum, pressure, stirred, catalyst:k
  tempC: [number, number];                     // window; outside it the reaction pauses, above `ruinC` it spoils
  ruinC?: number;  batchL: number;  seconds: number;  age: AgeKey;
}
stepVessel(v, dt):
  r = first reaction whose inputs, items, caps and window all hold      # fixed order, so deterministic
  if !r: v.state = (v.lastDone ? DONE : IDLE); return
  frac = min(dt / r.seconds, limiting reagent share)
  move frac * batchL from the `in` components to the `out` components     # same litres out as in
  when a whole batch completes: consume items, push `gives`, emit distill:step done, swap block to vessel_done
```

## 7. Process cards (`PROCESS_SPECS`) - Codex, ghosts, tests and solver from one string

```ts
{ key: 'spirit', name: 'Spirit', age: 'ember', feeds: [{ fluid: 'sugar_wash', L: 4000 }], heatC: 92,
  expect: [{ fluid: 'low_wines', minL: 900 }],
  rig: ['C R',      // layer y+2: Condenser, Receiver     legend: B base, F flask, V vessel, | segment, C condenser,
        'F .',      // layer y+1: Flask                            R receiver, T tube, X filter, K catalyst, A airlock,
        'B .'] }    // layer y  : Base                             U vacuum cap, P pressure cap, J jacket, i port
```

- **Codex**: draws the rig from the string and lists feeds, temperature and outputs.
- **Ghost preview**: choosing a card in the still's STRUCTURE tab shows the missing blocks as ghosts.
- **Test**: `distillProcess.test.ts` builds every card's rig in a fake world, pours the feeds, runs the sim and
  asserts `expect`. A card that lies fails the build.
- **Solver**: a card is a pseudo-recipe (inputs = feeds, outputs = expect, station = the rig's blocks, minTempC).

Structure tab extra: "This rig can: distil, 2 cuts, ferment" and "One more Column Segment would add: Kerosene" -
computed by re-running the capability match with one block added, over the 16 kinds (16 cheap scans, on demand).

## 8. The crafting tree

```
SUGAR AND RESIN (Ember)
 pine log --tap--> pine_sap --pot still 115 C--> water (vented) + SYRUP (residue grade)
 syrup --crystalliser (vessel + jacket)--> sugar x3 + molasses
 pine_sap --pot still 175 C--> TURPENTINE (head) + rosin (solid residue)
 existing furnace recipes for resin and sugar stay as the slow hand route

ALCOHOL (Ember -> Forge)
 syrup or molasses + water + yeast --fermenter 120 s--> sugar_wash     (yeast: first from berries, then skimmed
 flour + boiling water --heated vessel 65 C--> mash --fermenter--> grain_wash      back from every ferment)
 berries + water --fermenter--> berry_must (drinkable as Wine)
 wash --pot still 92 C--> LOW WINES --again--> SPIRIT        or  --3-plate column--> FUEL ETHANOL in one pass
   keep the first 5 % (heads): Rough Spirit (drink: Tipsy but Blurred).  Discard heads: clean Spirit
 spirit + barrel + time --> Aged Spirit (later; better buff)
 uses: drink (Warmed: cold resistance, ties to cold.ts and well_warmed; Tipsy: +10 % melee, slight sway),
       burner fuel for a still_base off the furnace, antiseptic (fuel_ethanol + cloth -> bandage: heal over time),
       solvent for every tincture, engine fuel (weak), lamp fuel

POTIONS (Ember base, Forge for the strong ones) - concentrates of the brewing buffs
 brewed drink x4 (tea, coffee: docs/api/brewing-buffs.md) --vacuum still 60 C, ruin above 80 C--> essence_*
 herb / glowcap / berries + spirit --heated vessel 50 C (maceration)--> tincture --filter_bed (charcoal)--> clear tincture
 essence + clear tincture + syrup --vessel (blend)--> ELIXIR, bottled in vials (4 per 1000 L)
   Elixir of the drink = the same buff, 3x the time, +1 strength.  Glowcap Draught = night sight.
   Berry Tonic = regeneration.  Miner's Draught (coffee essence + syrup) = mining speed.  Ember Salts = warmth.
 3 to 5 steps each, each step a different rig: the advanced recipes are longer graphs, as asked

OIL (Forge: needs the pump and a 350 C base)
 crude_oil --3-segment column 350 C--> GASOLINE (head) + KEROSENE (draw 2) + DIESEL (draw 1) + residue (flask)
 residue --vacuum still 330 C--> LUBE BASE (head) + BITUMEN (hot residue; cools to bitumen blocks)
 lube_base --filter_bed (clay)--> LUBRICANT        lubricant + rosin + tallow --heated vessel--> GREASE
 bitumen + gravel + sand --heated vessel 150 C--> ASPHALT x8      bitumen + planks --> tarred planks
 diesel or residue --cracker (catalyst_bed zeolite, pressure_cap, 480 C steel still)--> gasoline + slop (Current age)
 gasoline + diesel 1:1 --vessel (blend)--> fuel (the existing Refined Fuel; the old `still` machine stays as the
   lossy one-box route: 80 % yield, no fractions)
```

### 8.1 What each product is for

| product | use | hook |
|---|---|---|
| gasoline | chainsaw (best: x1.3 per canister), tractor fast | `felling.ts` `SAW_FUEL_ITEM`, `tractor.ts` `FUEL_ITEM` become a `FUEL_GRADES` table lookup |
| diesel | tractor and combustion engine (x1.5 burn time), bore rig | `combustion_engine` `fluids.accepts` |
| kerosene | kerosene lantern (bright, long), heater (cold system) | new lamp block; `cold.ts` |
| fuel_ethanol | weak engine fuel (x0.7), burner, antiseptic | as above |
| lubricant | oiler on a shaft network: stress capacity x1.25, friction halved; chainsaw bar oil: wear halved | STEAM_PLAN mech solve: `capacity *= net.lube`; slice consumer = chainsaw |
| grease | stress capacity x1.5, lasts 4x longer | same hook |
| bitumen / asphalt | road block: walking x1.25, tractor x1.4, never churns to mud; tarred planks do not burn or rot | block field `speedMult` (verify the tractor's surface table) |
| turpentine | thinner (lubricant recipe alternative), varnish, lamp fuel | recipes |
| rosin | flux for solder (circuit recipes), grip, sealing wax for caps | recipes |

`FUEL_GRADES: Record<fluid, { canister: itemKey, energy: number, saw: number, tractor: number, engine: number }>`
lives in `itemsDistill.ts`; consumers read multipliers from it, and the existing `fuel_canister` keeps energy 1.

### 8.2 Containers

`FluidSpec.bucket` gains an optional `litres` (default 1000). Items are **generated from a table**, not hand
written: every drinkable or chemical fluid gets `beaker_<fluid>` (250 L, empty `glass_beaker`), every fuel gets
`<fluid>_canister` (1000 L, empty canister (verify key)), elixirs get `vial_<key>` (250 L). `fluidInBucket` and
`bucketFilledWith` then work for all of them with no new code path.

## 9. Scan and tick pseudocode (`distillScan.ts`, `distill.ts`)

```
scanRig(world, start):                               # start: any chem block; cap 64 modules
  cells = floodFill(start, isChemBlock, 6-neighbour, limit 64)
  for c in cells: m = module(c.kind); derive vapourEdges, liquidEdges (section 3)
  stacks = for each flask or heated vessel: walk U while column_segment | catalyst_bed | reflux_head; note the cap
  for each stack: sideDraws = condensers on H of a segment (with h); head = condenser on U of the top, or H of reflux_head
  receiverChain(condenser) = BFS over liquidEdges until a block with a buffer (tubes pass through)
  attach modifiers (caps, jackets, base) -> caps(vessel)
  problems (first 8):
     NO_BASE "The flask needs a Still Base under it"         NO_HEAT "The base is cold: set it on a furnace or fuel it"
     NO_CONDENSER "Vapour has nowhere to go"                 DRIPS_NOWHERE "This condenser drips onto nothing"
     UPHILL "Liquid cannot climb: lower the receiver"        TOO_TALL "A column holds 8 segments"
     TWO_CAPS  TOO_HOT_FOR_GLASS  SHARED_CONDENSER  TOO_MANY (64)  CAP_UNPOWERED  MEDIUM_SPENT
  return { modules, stacks, problems, capabilities, order: liquid edges in topological order (vapour edges cut) }

DistillSet.tick(dt):
  acc += dt; if acc < 0.25: return                    # 4 Hz
  for rig in awake rigs:
      for v in rig.order:                             # upstream first, so a drop moves at most one module per step
          stepHeat(v); if v is a still: stepStill; if v is a vessel: stepVessel; if v is a filter: stepFilter
          drain(v)                                    # liquid edges: move min(rate, space) to the next buffer
      updateStates(rig)                               # block swaps and active bits of section 2.1, events, sfx
      if nothing moved for 8 steps: rig sleeps until a block change, a pour, or its heat source changes
```

Save and load: each module is its own entity `{ kind: 'chem', mix, tempC, slots, cfg, state }`. The rig is derived
by a rescan on load and never saved (like a hearth's formed state). Breaking a module loses only its own contents
(spilled as `slop` particles; solids drop as items).

Fuzz test (the guard for "many possible combinatorics"): 500 random assemblies of up to 12 random modules in a
3x4x3 box, random feeds and temperatures, 2000 steps each: the scan never throws, every litre is accounted for, no
NaN, no negative amount, state blocks always match state, save then load then step equals step.

## 10. Rendering (`src/render/distill/`), three draw calls

- **Glass and liquid**: one `InstancedMesh` of unit boxes (boxBatch). Per module 3 to 6 boxes: glassware outline
  (translucent), liquid body scaled to the fill level, a darker meniscus slab. Liquid colour = volume-weighted mean
  of its components' colours, so wash visibly pales as the ethanol leaves and crude turns from brown to black.
- **Bubbles, drips, streams**: one more instanced mesh of tiny boxes, **animated entirely in the vertex shader**:
  `y = base + fract(uTime * rate + phase(instanceId)) * travel`. The CPU writes an instance only when a module's
  rate or colour changes (4 Hz at most); between changes the frame cost is zero CPU. Bubble size and drip period
  scale with viscosity (bitumen drips once every 2 s, gasoline runs).
- **Column bands**: each segment's liquid slab takes the colour of the component condensing at its tray
  temperature: gold over blue over amber over black for crude. Bands appear bottom-up as the column warms.
- **Tubes**: a thin core box in the stream colour with the same shader offset scrolling along the tube's axis;
  this is the sight-glass look of `pipeOverlay.ts`, reused for fluid pipes leaving a `chem_port`.
- Data: `sim.distillViews(camX, camZ, range)` fills a reused Float32Array (kind, fill, r, g, b, rate, viscosity,
  state). Range 32 blocks, cap 128 modules, light from `LightProbe`.

## 11. Ages (one table, `DISTILL_AGE` in `itemsDistill.ts`, so the six-age refactor edits one place)

| age key today | furnace | parts unlocked | rigs |
|---|---|---|---|
| ember | T1 clay | beaker, tube, flask, condenser, receiver, vessel, airlock, still_base, filter_bed | pot still, fermenter, tinctures, syrup |
| forge | T2 | column_segment, reflux_head, cooling_jacket, chem_port, chem_hopper | 3-cut crude column, fuel ethanol, lubricant |
| current | T3 | vacuum_cap, pressure_cap, catalyst_bed, steel still shell (900 C) | vacuum residue run, cracker, strong elixirs |
| atomic+ | T4 | refinery tower: a hearth-style cuboid running the same `stepStill` at x16 throughput | continuous refining |

Recipes use `minTier` of the forge and the block `age` field only. **Nothing existing depends on any distillery
item**, so the progression solver still completes the game; `content.test.ts` gains "every distillery item is
reachable in its age" using the process cards as pseudo-recipes.

## 12. Player and UI

- Pour: a filled beaker, bucket or canister on a flask or vessel pours in (`expand`). An empty one on a receiver
  takes out (`nameOf`); on a flask's lower half it opens the drain cock for the residue.
- Items (yeast, herbs, filter medium, catalyst): use on the vessel or bed. Wrench on a `reflux_head` cycles its ratio.
- Empty hand: the rig screen with tabs PROCESS (thermometer with each component's boiling point marked, contents
  bars per module, live outputs), STRUCTURE (problems, capabilities, process picker with ghosts), CODEX link.
- Target name line without a screen: "Boiling Flask - 2.1 buckets, 92 C, distilling Low Wines".

## 13. Ordered work list (each step leaves `npm test` green)

First slice (W1 to W9):
1. W1 `src/core/chem.ts` + tests: components, mixtures, `nameOf`, `expand`, `stepStill` maths, conservation.
2. W2 content: `blocksDistill.ts` (kinds of section 2 needed for the slice: base, flask, vessel, segment, condenser,
   jacket, receiver, tube, airlock, port; with `_done` variants), `itemsDistill.ts` (generated containers,
   `FUEL_GRADES`), fluids appended to `fluids.ts`, `FluidKey` widened, validation `distillValidation.ts`.
3. W3 `distillScan.ts` + tests (every problem code, every row of section 3, the fuzz scan).
4. W4 `distill.ts`, `distillActions.ts`, wiring in `simulation.ts` (the five one-line touchpoints brewing uses),
   state swaps of section 2.1, save and load tests.
5. W5 processes: sugar_wash ferment, low wines and spirit, syrup, crude 3-cut; `distillProcess.test.ts`.
6. W6 textures (frame x lamp states, emblems) and `src/render/distill/` (liquid, bubbles, drips, bands).
7. W7 player: pour and take, rig screen, Codex page from the process cards.
8. W8 fuel integration: `FUEL_GRADES` in chainsaw and tractor; gasoline and diesel canisters.
9. W9 `scripts/e2e-distill.mjs` (build to a scratch dir, phone and desktop screenshots of a running crude column),
   chained into `package.json` `e2e`; `docs/api/distillery.md`.

After the slice, by value:
10. Reflux head, filter bed, lubricant and the chainsaw bar-oil consumer.
11. Vacuum cap, residue run, bitumen and asphalt road blocks (speed effect).
12. Potions: essences, tinctures, elixirs and their buffs; vials.
13. Drinks: Warmed, Tipsy, heads and Rough Spirit; antiseptic bandage; kerosene lantern.
14. Chem hopper and full pipe automation; structure-tab "one more block would add".
15. Shaft hooks: stirrer capability, oiler on the mech graph (after STEAM_PLAN lands shafts).
16. Catalyst bed, pressure cap, cracker; steel still shell.
17. Refinery tower multiblock.

## 14. Risks

- `FluidKey` is a closed union read by tanks, pipes and UI: widening it is a shared-file edit; do it in one small
  commit and run the transport tests.
- Glass cases are translucent cubes: liquid boxes inside must draw before the translucent chunk pass (render
  order), as `BrewLiquid` already does with polygon offset. Check on a phone GPU.
- Litres are small in this game (a bucket is 1000 L): all numbers above use that scale.
- Balance of fuel multipliers and elixir strength is a first guess; the process cards make retuning one-line edits.

## 15. Status (2026-11-21) and what is left, by priority

Built and tested (commits df0ad72, 40b32ec, be9a02c, 48c3936; API: `docs/api/distillery.md`): W1-W6 and W8-W9 of
section 13 - mixture model, 10 module kinds with done/blocked looks, rig scan, stills and columns, fermenting, liquid
flow, chemistry port, pour/take by hand, crosshair lines, 7 process cards in the Codex and the solver, gasoline and diesel
in the chainsaw and the tractor, liquids/bubbles/drips/bands, unit tests (scan, stepping, conservation fuzz, save/load,
every card), and `scripts/e2e-distill.mjs` (desktop + phone portrait, passing). Deviations from the plan: the module
graph keeps only receivers, condensers, tubes, flasks, vessels and jackets as buffers (segments hold no liquid); there is
no `distill:step` event yet (sfx + toast + flags instead); the reflux head was not built.

Left, in order:
1. **Rig screen**: a STRUCTURE-style panel on Use-with-wrench (problems list with tap-to-highlight, capabilities, the
   process picker) and **ghost previews** from a card's rig string (`render/tech/ghosts.ts`). Today problems show only
   in the crosshair line.
2. **Burner on the ground**: a still base burning charcoal or a fuel-ethanol beaker without a furnace (Ember comfort).
3. **Reflux head** (plan 2) and **filter bed**; then **lubricant** from residue (vacuum cap) and the chainsaw bar-oil
   consumer; **bitumen and asphalt** road blocks with their speed effect.
4. **Potions**: essences under vacuum, tinctures, elixirs tied to the brewing buffs; vials; drinks of spirit (Warmed,
   Tipsy) and the antiseptic bandage.
5. **Tank support for the new fluids** (the tank's `accepts` list is still the five old fluids) and pipes out of a
   receiver into tanks end to end in the e2e.
6. **Shaft hooks** once STEAM_PLAN lands: stirrer capability, lubricant raising stress capacity.
7. **Catalyst bed, pressure cap, cracker**; steel still shell; the refinery tower multiblock.
8. Polish: a `distill:step` game event for objectives ("Run your first spirit"), sounds of their own (bubbling loop,
   drip), a Codex progression branch in `scripts/codex/progression.json` (owned by the scripts session), balance pass on
   fuel multipliers and yields (the cards are one-line edits).

<!-- ======================== END docs/DISTILLERY_PLAN.md ======================== -->


---

<!-- ======================= BEGIN docs/api/sugar.md ======================= -->
# FILE: docs/api/sugar.md

# Resin, sugar and sweet baking (Sugar Rush)

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


Owner's brief: spruce resin can be taken and refined into sugar, then baked into baked goods with wheat in the
furnace; eating anything with sugar gives a small speed boost, but while it lasts the Well-Fed buff runs out faster
(hunger itself drains as usual). Everything is done in game with glass beakers and rudimentary chemistry. The only
conifer in the world is the **pine**, so pine logs weep the sap ("spruce" in the owner's words).

## The chain (all at the Clay Furnace, tier 1, and by hand)

| Step | Recipe / action |
|---|---|
| Glass | `smelt` sand 700 C -> glass (existing) |
| Chemistry supplies | forge `2 glass_beaker` from `1 glass`, 650 C |
| Tap | **Use** a Glass Beaker on a pine log: the beaker becomes `pine_sap`; that log weeps again after 120 s (`TAP_COOLDOWN_S`, not saved) |
| Boil | forge `pine_resin` from `1 pine_sap`, 180 C, beaker returned |
| Distil | forge `3 sugar` from `2 pine_resin + 1 water_pail + 1 glass_beaker`, 260 C, bucket and beaker returned |
| Bake | forge `4 sugar_cookie` (flour + sugar, 190 C); `sweet_bun` (dough + sugar, 220 C); `sugar_cake` (2 flour + 2 sugar + water bucket, 200 C, bucket returned) |

Flour comes from wheat at the Hand Quern; dough is the existing flour + water bucket recipe.

## Sugar Rush (`src/game/buffs.ts`)

- Foods carry `food.buff = 'sugar_rush'` and `buffS`: sugar 45 s (1 food), cookie 90 s (3), bun 150 s (6), cake 240 s (9).
- `Buffs.sugarS` counts down; `speedMult` = Swift x `SUGAR_SPEED_MULT` (1.12) so it applies to walking, sprinting and swimming
  in `PlayerPhysics` with no further wiring.
- While `sugarS > 0` the **Well-Fed timer burns `SUGAR_WELL_FED_BURN_MULT` (2.5) times faster** (`Buffs.tick`). Hunger drain,
  regeneration and every other buff are untouched.
- A longer Sugar Rush is never shortened by a shorter one (same rule as Well-Fed). Cleared on respawn. Saved as
  `BuffsSnapshot.sugarS` (optional; older saves load with none). `buff:gained` is emitted with `buff: 'sugar_rush'`.
- HUD: a "Sugar Rush" pill (`src/ui/hud/vitals.ts`); the food card reads "Sugar Rush 1.5 min" (`src/ui/screens/food.ts`).

## Code map

- Items: `src/content/itemsSugar.ts`; recipes: `src/content/recipes.ts` (search `itemsSugar.ts`); icons: `src/render/textures/iconsSugar.ts`.
- Tapping: `src/player/sapTools.ts`, called from `Interaction.use` before placing and screens (Shift places the beaker instead).
- Solver: `src/content/progression.ts` knows sap comes from tapping (a beaker and a pine log); roster tables in `specRosterFood.ts`.
- Tests: `src/game/sugarRush.test.ts`, `src/player/sapTools.test.ts`, `src/content/food.test.ts`.

## Gaps

- The tap has no animation or particles yet, only the `sip` sound, a toast and the arm swing.
- Tapping state is not saved. The six-age refactor (BRONZE_PLAN W0) should keep these recipes at the Clay Furnace (Ember age).

<!-- ======================== END docs/api/sugar.md ======================== -->


---

<!-- ======================= BEGIN docs/api/dev-mode.md ======================= -->
# FILE: docs/api/dev-mode.md

# Dev Mode - src/core/gameMode.ts, src/ui/screens/creative, plus small hooks in state, player, title and HUD

A second way to play a world: the Creative menu with every item, no damage, no hunger, no wear, free placing and
flight. It is chosen once, on the title screen, when the world is created, and it lives in the save. Survival saves
and survival play are untouched. Tests: `npx vitest run src/app/devMode.test.ts src/ui/screens/creative`. Browser:
`node scripts/e2e-dev.mjs` (desktop, phone portrait, phone landscape; `HW_GPU=1` for the real GPU), also the last
step of `npm run e2e`.

## The mode flag
```ts
type GameMode = 'survival' | 'dev'                 // src/core/gameMode.ts
parseGameMode(raw: unknown): GameMode              // anything but 'dev' is survival
modeLabel(mode): 'Survival' | 'Dev Mode'
WorldSave.mode?: GameMode                          // src/save/document.ts, optional
GameState.create(seed, seedText, { mode?: GameMode, ... })   // a new world; only the title's choice passes 'dev'
GameState.restore(save)                            // takes save.mode (missing = survival)
GameState.mode: GameMode                           // readonly; sets player.dev
```
- Survival worlds never write `mode` (the save stays byte-identical to before); dev worlds write `mode: 'dev'`.
- `normalizeDocument` drops any `mode` other than `'dev'`, so a damaged value reads as survival.
- Nothing converts a world between modes: there is no switch in the pause menu or the settings.
- `window.__hw.newWorld(seed, mode)` and `__hw.state().gameMode` exist for tests.

## Title screen
A `Mode` row (`Segmented`: Survival | Dev, `.hw-title__mode`) between the seed field and Difficulty, with a one-line
hint. It resets to Survival every time the title is built, so a dev world can only come from an explicit choice.
`TitleScreen`'s `onNewWorld(seed, mode)` gets the mode; `TitleScreenOptions.savedMode` / `setHasSave(has, savedMode)`
put "Dev Mode world" / "Survival world" under the Continue label. The pause menu's subtitle says the same
("Dev Mode world"). Seed entry is unchanged and works with both modes. Checked at 390x844, 844x390 and 1280x800.

## Dev rules (what `player.dev` changes)
| Rule | Where |
| --- | --- |
| No damage of any kind (falls, lava, cold, drowning, hunger, automatons, burning) | `PlayerState.damage` returns early |
| No starving, freezing or drowning: health, food, warmth and air are held full each tick; the dead are revived | `GameState.devUpkeep` (after survival and objectives) |
| Tools never wear | `PlayerState.wearHeldTool` returns false |
| Placing a block does not use it up (menu switch "Free placing", default on, `player.devFreePlace`) | `Interaction.use` |
| Flight (`player.flying`): double-tap Jump (within 0.35 s) or the menu switch "Flight". No gravity; Jump rises, sprint (Shift) descends; horizontal speed x1.8 | `PlayerController.devFlight`, `PlayerPhysics.step` |
Objectives and achievements keep running as in survival. Free placing and flight are session settings (not saved).
Only blocks placed by `Interaction.use` are free; other things that consume the held item (buckets, seeds, vehicles)
behave as in survival.

## Creative menu
`{ type: 'creative' }` is a `ScreenRequest` (src/core/gameEvents.ts); GameUI registers `createCreativeScreen`
(src/ui/screens/creative/creativeScreen.ts), which returns null outside dev mode. Open it with:
- `E` / the inventory key, and the touch backpack button: in a dev world the controller opens `creative` instead of
  `inventory` (the hand-crafting screen is not needed there);
- the always-visible `DEV Items` HUD button (`.hw-devchip`, 44 px; hidden while a screen is open). With a mouse the
  pointer is locked during play, so on desktop use `E`; the button is for touch.

Contents: search box (name, key and description, every word must match), tabs with counts, the grid of every item,
an info line (name and description, for touch where there is no tooltip; hover cards on desktop), the player's own
pack and hotbar (the normal `InventoryPanel` and slot controller: pick, move, half, quick move all work), and:
- tap / click: one item into the pack; Shift-click, right-click, long-press, or the `Full stacks` switch: a full stack;
- drag an item onto a pack or hotbar slot (desktop): puts it there, replacing what was in it;
- `Trash`: removes the picked pack stack; `Clear pack` (hold): empties the whole pack;
- `Free placing` and `Flight` switches.
Phones: portrait shows the item list first (fixed height) and the pack and switches below (the screen scrolls);
landscape keeps the pack on the left and the list on the right.

### Catalogue (src/ui/screens/creative/catalogue.ts, DOM-free, unit-tested)
```ts
CREATIVE_TABS: { id: 'all'|'block'|'material'|'tool'|'food'|'machine'|'fuel'|'misc'; label; categories: ItemCategory[] }[]
buildCatalogue(items = ITEMS): CatalogueEntry[]      // every registry item once, in registry order
tabOfCategory(category): tab id                      // block; resource+material+component -> Materials; tool; food; machine; fuel; misc
filterCatalogue(entries, tab, query): CatalogueEntry[]
tabCounts(entries, query): Record<tab, number>
grantItem(inventory, key, full): number              // returns what did not fit; tools arrive with full durability
clearSlot(inventory, index): boolean
```
A new item added to the registry appears in the menu without any change here.

## Known gaps
- Free placing is not saved, and flight resets on every start.
- No creative items tab ordering beyond registry order; no favourites.
- The HUD button cannot be clicked while the desktop pointer is locked (use `E`).

<!-- ======================== END docs/api/dev-mode.md ======================== -->


---

<!-- ======================= BEGIN docs/api/distillery.md ======================= -->
# FILE: docs/api/distillery.md

# Glass distillery - API (first playable slice)

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


Design and the full plan: `docs/DISTILLERY_PLAN.md`. This note is what exists in code and how to use it.
Tests: `npx vitest run src/core/chem.test.ts src/sim/distill src/render/distill src/game/distillFuel.test.ts`
(35 tests). Browser: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-distill.mjs --out=<dir>` (desktop and
phone portrait; chained last in `npm run e2e`).

## Files

| file | what |
|---|---|
| `src/core/chem.ts` | the mixture model: components, bubble point, vapour enrichment, grades (`nameOf` / `expand`), column trays and cuts |
| `src/core/distill.ts` | module kinds (`CHEM`), the four states and their look, setpoints, rates, `CHEM_CONTAINERS`, `FUEL_GRADES` |
| `src/content/{blocks,items,machines,fluids,recipes}Distill.ts` | 13 blocks (10 kinds + 3 `_done` twins), 12 items, 10 machine specs (role `chem`), 11 fluids, forge recipes and process cards |
| `src/sim/distillScan.ts` | `scanRig(world, x, y, z)`: modules, stills, liquid edges, seals, jackets, problems |
| `src/sim/distill.ts` | `Distillery`: entities, rigs, the 4 Hz step, block states |
| `src/sim/distillActions.ts` | `chemUse`, `chemView`, `chemPortEndpoint` |
| `src/render/distill/distillFx.ts` | liquids, bubbles, drips, tube streams and column bands (2 draw calls) |
| `src/render/textures/distill.ts` | module tiles (frame, emblem, state lamp and rim) and container icons |
| `src/sim/distillKit.ts` | test fixture: `buildRig(rigString)`, `feed(card, flask)`, `runUntil` |
| `scripts/e2e-distill.mjs` | the browser check |

## Contracts

- **Mixtures** (`Mix`): litres per `Component`. Every move goes through `pour` / `take` / `add`; litres leave a buffer
  only as litres another buffer took. Fuzz-tested (60 random rigs, 2000 steps).
- **Grades**: `nameOf(mix)` is the first grade in `GRADES` the mixture meets (best first), else `'slop'`;
  `expand(fluid, L)` is the grade's own composition, which meets it. Round trips never gain purity.
- **Fluids**: `FluidKey` gained `sap syrup sugar_wash low_wines spirit fuel_ethanol gasoline kerosene diesel residue slop`.
  `crude_oil`, `gasoline`, `kerosene`, `diesel` and `residue` have `bucket: { full: '<x>_canister', empty: 'empty_canister' }`,
  so tanks, pumps and `bucketUse` handle canisters like buckets (1000 L).
- **MachineRole** gained `'chem'`. Chem blocks are never machine nodes: `Simulation.onBlockChanged` routes them to
  `Distillery.place/remove` (before brewing), `resync` tracks entities whose kind is a chem kind.
- **Entity** (saved as JSON): `{ kind: <module kind>, x, y, z, mix, state, setC? (base), ran?, recvS?, flow?, band?, tempC? }`.
  Rigs are derived and never saved.
- **State on the block** (plan 2.1): `idle` plain/off, `working` plain/active, `done` `_done`/off, `blocked` `_done`/active
  (flask, vessel, receiver). Base, segments, condensers, tubes and jackets use the active bit for working. Tiles: dark /
  amber / green / red lamp and rim.
- **Events**: `sfx machine_done` (pitch 1.4) and a `toast` "Distilling run finished" or "Fermenting done: ..." when a flask
  or vessel goes working -> done; `sfx pipe_clunk` on becoming blocked; flags `distilled`, `fermented` (`flagOnce`).
- **Heat**: a still base holds its flask at `min(setC, furnace below, 450)`; boiling draws `400 J/L` into the furnace's
  `extractW` (20 L/s -> 8 kW).

## Simulation calls

```ts
sim.distill: Distillery                       // entities: entityAt, all(), litres(), rigAt(x,y,z), step(dt), baseTemp(base)
sim.chemUse(x, y, z, heldKey): ChemResult | null   // null = not a chemistry action (the tap carries on)
sim.brewView(x, y, z)                         // now BrewView | ChemView | null; ChemView.text is the crosshair line
sim.fluidEndpoint(x, y, z, face)              // a chem_port: touching a flask/vessel = inlet, a receiver = outlet
```

`chemUse` table: empty hand on a base cycles `STILL_SETPOINTS` (78 92 97 130 200 260 350 420); empty hand elsewhere
toasts the view line; a full container (`CHEM_CONTAINERS`) pours into a flask, vessel, receiver or (water only) jacket if
the whole container fits; an empty container takes the named contents of a flask, vessel, receiver or condenser when
there is a full container's worth and that container can hold that fluid (beakers: 250 L alcohols and syrups; canisters:
1000 L oils and slop; pails: water). Every refusal is a sentence. The player module reaches it through `BrewTools`
(role `chem` -> `BrewHands.chemUse`).

## Rig rules (what the scan derives)

Still = flask on a still base; column = segments straight up; head = condenser on top; side draw = condenser beside a
segment (height h). Liquid pours down and sideways, never up; a flask or vessel takes from the side only through a
glass tube; edges both ends can pour along share levels. Airlock cap on a vessel = sealed; a cooling jacket with water
touching a condenser = x3 condensing and a 30 C head. Problems: `no_base no_condenser drips_nowhere too_tall
loose_segment shared_condenser too_many` (shown in the crosshair line of the module they name).

## Process cards (Codex)

`PROCESS_CARDS` in `recipesDistill.ts` are RecipeSpecs at a module station (role `chem`, energy 0) with a `rig` string,
so the Codex lists them through `RECIPES` with no script change. The solver (`progression.ts chemReady`) runs one when
every block of its rig is owned and, with a base, a furnace reaches its setting. `distillProcess.test.ts` builds each rig
and checks it makes at least the card's outputs. Cards: distil_syrup (130 C), ferment_wash, distil_low_wines (97 C),
distil_spirit (92 C), refine_crude (350 C, 3 segments), rectify_spirit (2 segments), refine_crude_short (2 segments:
gasoline and kerosene come over as slop).

## Engines

`FUEL_GRADES`: `fuel_canister` 1/1, `gasoline_canister` saw 1.3 / tractor 1.2, `diesel_canister` tractor 1.5 (a chainsaw
refuses it), `fuel_ethanol_beaker` 0.25 / 0.2. `felling.ts isSawFuel / refuelChainsaw` and `vehicles/manager.ts refuel`
read it and hand the empty container back.

## Ages

Ember (furnace tier 1): base, flask, condenser, receiver, tube, vessel, airlock; syrup, wash, low wines, spirit.
Forge (tier 2): column segment, jacket, port, canisters; crude refining, fuel ethanol. Gated by the recipes' `minTier`
and items' `age` only, so the six-age refactor moves them by editing those fields.

<!-- ======================== END docs/api/distillery.md ======================== -->


---

<!-- ======================= BEGIN docs/api/ground-items.md ======================= -->
# FILE: docs/api/ground-items.md

# Ground items, the drop key and collectors

Items are real entities in the world. Anything that gives items spawns `GroundItem`s instead of filling the pack:
broken blocks, picked bushes, dead animals, a broken machine's contents, a returned bucket the pack had no room for,
and the player's own drop key. DOM-free and node-testable (`npx vitest run src/game/groundItems src/game/collectors`).

## src/game/groundItems.ts
- `class GroundItems` - owned by PlayerState as `player.ground`; ticked by `Survival.tick` (so it runs on the 20 Hz tick, also
  while dead); saved in `PlayerSnapshot.ground` (optional: older saves load with none).
  - `items: GroundItem[]` `{ id, item, count, durability?, x, y, z, vx, vy, vz, age, delayS, onGround, homing, pulled, phase }`; `version` bumps on any add/merge/removal.
  - `spawn(item, count, x, y, z, opts?)` - splits above one stack into several entities; `opts`: `durability`, `vx/vy/vz`, `delayS` (default `DROP_DELAY_S` 0.5), `scatter` (default true: small random offset and hop). `spawnSlot`, `near`, `count(item)`, `drain(player)` (give everything that fits, wherever it lies: tests/debug), `clear`.
  - `tick(dt, world, player, collectors = [])`: falling (gravity 22, terminal 24, slab and liquid aware, frozen over unloaded chunks, lifted out of a block placed on it), resting, merging (same item, no wear, within `MERGE_RADIUS` 0.9, both at rest, every 0.5 s), despawn at `DESPAWN_S` 300, pickup.
  - Pickup: a ready item (`delayS` 0) within `PICKUP_RADIUS` 1.4 of the BODY (a vertical segment feet..head, so an item one block down still counts) while the pack has room flies to the player at `HOMING_SPEED` 9 and is taken inside `TAKE_RADIUS` 0.5 via `player.give` (emits `item:gained`, sfx `pickup`). What does not fit stays; a full pack leaves everything lying. Nothing is picked up while dead.
  - Cap `MAX_GROUND_ITEMS` 256: past it the oldest entity is merged into the nearest same-kind stack with room, else removed.
  - `toJSON()/load()` - unknown items, bad numbers and anything past the cap are dropped on load.
- `PlayerState`: `drop(item, count, durability?, at?)`, `dropAll(stacks, at?)` (the spawn calls for "something gave items"), `dropSlot(slot, count)` and `dropHeld(all)` (thrown forward from the eye with `THROWN_DELAY_S` 2 so it is not instantly re-collected).
- Wiring done: `Interaction.breakBlock/pick/popUnsupported` (`player.dropAll` at the block), `GameState.mobs.onDeath` (animal drops), `Spills.add/release` in src/sim (a broken machine's contents, and what the pack could not take: they drop as ground items; only what the capped list has no room for still goes into a crate, toast "Pack and ground are full - the rest is left in a crate"). The chainsaw's felled logs: call `player.dropAll(...)` / `player.ground.spawn(...)` instead of `player.give`.
- Things that are not "drops" still use `player.give` (crafting results, rewards, a bucket swapped in the hand, hand-station returns).

## Drop key
- Intent gained `drop` (edge, one frame) and `dropAll`. `Q` drops one of the held item; `Shift+Q`, or holding Q past `DROP_HOLD_S` 0.5, the rest of the stack once. The controller calls `player.dropHeld(intent.dropAll)`.
- Inventory screens (`SlotController`, src/ui/screens/slots.ts): `Q` while the pointer is over a slot of the player's pack drops one of it (Shift+Q or key repeat: all). `slots.dropper` is set by GameUI for the player's pack only (crates cannot be dropped from).
- Touch: picking a stack in the inventory shows the carry bar with `Drop` (one, or the whole stack when it is 1) and `Drop all`; a long-press (right-click on a mouse) on a hotbar slot drops that slot's whole stack. Hints in the workbench/inventory footer mention both.

## src/game/collectors.ts - the shared pull mechanism
`CollectorDef { item, radius, pull, burstS, power: PowerSource, sound?, soundEveryS? }` in `COLLECTORS` (by item key). `PowerSource` is
`{ kind: 'wear', perS }` (durability of the held stack), `{ kind: 'free' }` or `{ kind: 'electric', watts, supply(joules): boolean }`.
`player.collectors` (class `Collectors`): `trigger()` (Use with a collector in hand; arms it for `burstS`, holding Use keeps it armed; false when the
hand holds none so Use falls through), `tick(dt)` (draws power, returns the `ActiveCollector[]` for `GroundItems.tick`), `running`, `stop()`.
The controller calls `trigger()` before any other use of the Use intent.

**Electromagnet (Current Age, future - not built):** add one `COLLECTORS` entry, e.g. `{ item: 'electromagnet', radius: 12, pull: 14, burstS: 3, power: { kind: 'electric', watts: 400, supply } }`
with `supply` drawing from the player's battery/grid (a `drawJoules` hook in src/sim), plus its item, recipe and icon. If it should only pull metal, add an optional
`accepts(item)` filter to `CollectorDef` and `ActiveCollector` and test it in `GroundItems.tick`. Nothing else changes.

## Hand Vacuum Pump (`hand_vacuum`)
- Item in `src/content/itemsGround.ts` (`GROUND_ITEMS`), icon `item_hand_vacuum` (`src/render/textures/iconsGround.ts`), stack 1, `wear` 480 (new `ItemSpec.wear`: uses of a non-tool item; `fullDurability` reads it, so slots show a wear bar and the card shows "Suction left").
- Collector: radius 9, pull 11 blocks/s, one Use runs 2.5 s, 1 wear per second of suction, sound `steam_hiss` every 0.55 s plus `machine_on` on start.
- Recipe: Bronze Furnace forge (`forge(2, 'hand_vacuum', ...)`, tier 2) at 800 C: 4 bronze plate, 2 leather, 1 bellows, 2 copper plate; `age: 1` in `itemsGround.ts` (moved by BRONZE_PLAN W0, see `docs/api/ages.md`). No objective yet (a "Gather from afar" goal fits after the Bronze Furnace goals).
- It is NOT the machine `vacuum_pump` of BRONZE_PLAN 5.4 (the air user on a chute network); the key is `hand_vacuum` so both can exist.

## src/render/groundItems.ts
`GroundItemRenderer(renderer, world)`; `update(dt, items, pulling)` each frame. One `InstancedMesh` (one draw call) per item kind: a small cube for block items, an extruded pixel sprite for the rest (shared with the held item), spinning and gently bobbing, stacks of 2+ / 16+ show 2 / 3 copies, lit like the terrain (light probed a few items per frame, eased), distance-fogged and skipped beyond the fog. Pulled items glow; while a collector runs, three cyan rings close in on the view centre. `drawn`, `instances` for stats. Created and drawn by `Game` (src/app/game.ts).

## Tests and checks
`src/game/groundItems.test.ts`, `collectors.test.ts`, `src/player/input/drop.test.ts`, `src/render/groundItems.test.ts`; the existing tests of drops were updated (`player.ground.drain(player)` where they read the pack after a break). Browser check: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-ground.mjs --out=<dir> --device=desktop|phonePortrait --shots=<dir>` (items resting, pick-up, Q / long-press / Drop button, pump pulling; `HW_GPU=1` for the real GPU).

<!-- ======================== END docs/api/ground-items.md ======================== -->


---

<!-- ======================= BEGIN docs/api/chainsaw.md ======================= -->
# FILE: docs/api/chainsaw.md

# The chainsaw (Current Age)

A handheld tool that fells a whole tree. **Mine** on a log with it in hand removes that log and the connected trunk
above it in one cut; the logs drop as ground items (docs/api/ground-items.md), the saw burns fuel and wears nothing else. Code: `src/game/felling.ts`
(rules), `src/content/itemsVehicle.ts` (item and numbers), `src/player/interaction.ts` (two hooks), `src/audio/sfxVehicle.ts`,
`src/render/textures/iconsVehicle.ts`. Tests: `src/game/felling.test.ts`, `src/content/vehicleContent.test.ts`.

## Which age, and why

**Current Age** (PROGRESSION "Age 3 - Current"; `age: 3` and forged at furnace tier 4 since the six-age renumbering, BRONZE_PLAN W0:
see `docs/api/ages.md`), objective `fell_tree` age 3.

- It needs an *engine*. The only engine in the game that runs on a liquid fuel is the Combustion Engine, forged at the
  Arc Furnace, and the only liquid fuel is the **Fuel Canister** from the Still (Current). A chainsaw is that engine on
  a handle, so it belongs where the engine and its fuel do.
- Not Ember: the age is manual handwork with no machines (owner decision, docs/LOCAL_HANDOFF.md section 2); the Chopping
  Block and the axe are the Ember answer to trees.
- Not Bronze/Forge: steam devices drive shafts and are not portable, there is no fuel to carry before the Still, and
  Forge is about iron and heavy factory machines. (A pneumatic saw on an air tank would suit Bronze if the owner wants
  one earlier; it would be a second item, not a change to this one.)

Recipe (Arc Furnace, 1300 C): `1 chassis, 2 steel_plate, 1 copper_coil, 1 circuit`. Objective `fell_tree` ("Fell a
tree", flag `felled_tree`, age 3) sits right after Ward your base.

## Rules

- `tool: { kind: 'axe', tier: 5, speed: 9, durability: 841, fell: { maxLogs: 48, fuelPerLog: 7, canisterFuel: 420 } }`.
  `ToolSpec.fell` (src/core/types.ts) marks a chainsaw. **The stack's `durability` is its fuel tank**: 841 = a full
  tank of 840 units + the 1 that means empty (durability never reaches 0, so the saw is never destroyed).
- Felling (`fellTree(world, player, x, y, z, rng)`): the log under the crosshair plus every log of the same kind joined
  to it face-, edge- or corner-wise (boughs count), **from that height up**, nearest first, at most
  `min(maxLogs, floor(fuel / fuelPerLog))` = 48 logs. Logs below the cut (the stump) stay. Other woods touching it and
  detached logs stay. Each log is a `'player'` edit with `'block:broken'` (the "gather logs" objectives count them) and
  the drops spawn as ground items where each log stood. A full tank is 120 logs (a canister 60): about two broad oaks or twenty ordinary trees.
- Leaves of the felled tree decay by themselves afterwards (docs/api/leaf-decay.md): the saw wakes them like any log
  removal.
- Fuel: `refuelChainsaw(player)`: **hold a Fuel Canister and press Use** (anywhere, no target needed); it fills the
  emptiest saw in the pack by `canisterFuel` (420, never past full) and uses one canister only when it adds something.
  The saw's durability bar in the hotbar and inventory is its fuel gauge.
- Out of fuel (durability 1): `toolMatches` says no, so it mines like bare hands, and a toast says how to refill.
- Wear: none beyond the fuel (the brief's "fuel/wear" is one number).
- Sound: `saw_cut` (the chain) with `tree_fall` for trunks of 2+ logs, both in `src/audio/sfxVehicle.ts`.
- Flag `felled_tree` (FLAG_FELLED_TREE) for a tree of >= 3 logs.
- Held model: the first-person hand extrudes the `item_chainsaw` icon like every tool (src/render/heldItem.ts); the icon is
  in the existing pixel style (orange housing, rear handle, steel bar with teeth).

## API (src/game/felling.ts)

```ts
SAW_FUEL_ITEM = 'fuel_canister';  LOG_BLOCKS = ['oak_log', 'pine_log'];  TREE_MIN_LOGS = 3
isChainsaw(stack), sawOf(stack): ToolSpec | null, sawFuel(stack), sawCapacity(stack), canFell(stack), isLog(def)
trunkAbove(world, x, y, z, cap): LogCell[]
fellTree(world, player, x, y, z, rng): FellResult | null   // { logs, drops, fuel, more }
refuelChainsaw(player): 'refuelled' | 'full' | 'no-saw' | 'no-fuel'
```
`Interaction.breakBlock` calls `fellTree` first (null = break normally); `Interaction.use` calls `refuelChainsaw` when a
Fuel Canister is held (`UseOutcome` gains `'fuelled'`).

Note: the tier is 5 and the numbers are scaled up (tank 840, 7 per log) only so that the axe table stays strictly increasing in speed and durability (content.test.ts); the felling ratios are unchanged: 120 logs a tank, 60 a canister. Tier 5 is irrelevant in play because the saw only matters on logs.

<!-- ======================== END docs/api/chainsaw.md ======================== -->


---

<!-- ======================= BEGIN docs/api/handwork-front.md ======================= -->
# FILE: docs/api/handwork-front.md

# Handwork front end (EMBER_PLAN 2 and 5) - player, world shapes, render, UI

What the player SEES and DOES at the Ember hand stations. Data: `docs/api/handwork-content.md`; strokes: `docs/api/handwork.md`;
casting: `docs/api/casting.md`. Nothing here moves power. Tests: `npx vitest run src/player src/world/stationShapes.test.ts
src/render/handwork`; browser check: `node scripts/e2e-handwork.mjs` (desktop and phone portrait; also last in `npm run e2e`).

## Use priority (src/player/handTools.ts, interaction.ts)

`Interaction.use` order: held building block placed (Shift / Place toggle, or against a screen block) -> brewing
(`brewTools.ts`) -> **hand work (`handTools.ts`)** -> pipes -> screens -> bushes, drink, eat, buckets, hoe, plant, place.

```ts
interface HandHands {                       // src/sim's Simulation fits it structurally; passed as PlayerControllerOptions.hands
  stroke(x, y, z, heldKey: string | null): HandResult;          // handwork.md: insert / stroke / take / done
  handReturn(x, y, z): HandResult;                              // empty hand: the loaded input back to the pack
  pourCrucible(x, y, z, slot, heldKey: string | null): PourResult;   // casting.md
  furnaceView(x, y, z): { crucibles: readonly { index: number; moltenS: number }[] } | null;
}
class HandTools { constructor(host: HandToolsHost, hands: HandHands | null); use(hit: RayHit, forceReturn: boolean): 'worked' | 'poured' | 'refused' | null }
useRepeatFor(def: BlockDef | null): number    // seconds between repeats of a held Use aimed at def
```
- A block with `handStation` takes the tap. One Use = one `sim.stroke`; the hand swings; a refusal is toasted with the sim's
  sentence (`advise`, once per 8 s per sentence) and ends the tap. The sim decides insert / take / stroke.
- What goes to the sim as the held key: an ingredient of a recipe at that station, or the station's tool (matched on
  `ItemSpec.tool.kind === handStation.tool`). **Any other non-block item is a bare hand** (heldKey null), so a pickaxe in hand
  strokes with bare hands instead of being refused. **A block that is not an ingredient is not handled** (null): it is placed
  beside the station as usual (a log IS an ingredient of the chopping block, so it loads).
- Shift + Use (or Place, then Use on a phone) with an **empty hand** -> `handReturn` (take back what you loaded).
- A fired mould (`ItemSpec.mould`) in hand aimed at a furnace where some crucible has `moltenS > 0` pours the first molten
  crucible (`pourCrucible`, the cast goes to the pack, sim events as casting.md) without opening the screen. With nothing
  molten the furnace screen opens as before.
- `screenFor` returns null for role `hand` machines (no screen for stations).
- **Hold-to-repeat**: `IntentSource.setUseRepeat?(seconds)` (new, optional; `InputManager` and `InputCore.useRepeatS`
  implement it). The controller sets `useRepeatFor(aimed block)` before every `input.frame`, so a held Use strikes at
  `1 / handStation.strokesPerS` (chopping 0.25 s, quern 0.33, anvil 0.4, loom 0.5) and at `USE_REPEAT_S` (0.25) elsewhere.
  A tap always fires at once; only the repeats follow the rate. A completed job followed by a held Use takes the output
  and goes on with the next load.
- Mining a station (hold Mine) breaks it and the sim hands the contents to the pack.

## World shapes (src/world/stationShapes.ts, meshStation.ts, blockTables.ts)

The content declares the stations as `cube` (chopping block, anvil, clay table, loom, drying rack, casting bench) and `slab`
(quern, mortar, trough, alloy pot) blocks. `STATION_BOXES` (keyed by block key, boxes in sixteenths in the north-facing frame)
makes the mesher draw them as several small boxes instead: stump, bedstone, anvil (block, waist, face, horn), mortar bowl,
table, loom frame with warp sheet, rack posts and poles, trough, bench, alloy pot. East / South / West facings turn the boxes
(`turnBox`); each face keeps the texture of the face it lands on, so the loom's front texture follows its facing.
- `blockTables.STATION[id]` = 1 + index in the table (0 for every other block). Station blocks get `OPAQUE`/`MERGES` 0 and
  `LIGHT_CLASS` clear: they hide no neighbour's face and cast no shadow. Collision, the raycast and Use still treat the whole
  cell (cube: full height, slab: half), which is easier to hit with a thumb.
- `stationBounds(key)` (used by `render/target.ts` `shapeBounds`) hugs the outline to the boxes; the quern and mortar reach up
  to their moving part (`PART_TOP`).
- To add a station shape: one entry in `STATION_BOXES`; to animate it, one `HandAnim` in `render/handwork/handModels.ts`.
  The casting bench and alloy pot have shapes but no animation (their entities are the casting engineer's).

## Render (src/render/handwork/)

`HandParts(world, uniforms, bus, particles)` (created and updated by the Renderer, group in its scene) draws the moving
parts through the machine-parts layer: the same `ModelBuilder`, shader (`machines/material.ts`, new motion code
`Motion.Pulse` = move along local Y by the instance's `extent` x stroke), light probe and instancing. **Nothing runs at a
speed; every pose is a function of what just happened**:
- `hand:stroke` (record made on the spot) bumps the record's `strokes`, resets `since`, sets `frac = progress / needed`;
  `hand:done` clears `frac` and puffs. Twice a second it rescans `world.entities()` of kind `hand` within 64 blocks for what
  is loaded and the work fraction (`slots[0]` input, `slots[1]` output, `recipe`, `progress`), and forgets stations whose
  block is gone.
- Parts per station: **quern** runner stone + peg turns 30 degrees per stroke (`HandAnim.turn`, eased at 14/s);
  **anvil** hammer lifts and strikes (visible 0.55 s after a stroke) + an impact flash plate; **chopping block** axe swing +
  the log lying on the stump as two halves that open with the work (`frac`) and twitch on each stroke (hidden when the input
  is empty); **loom** shuttle crosses once per stroke (`turn` = pi) + cloth rising out of the floor with `frac`; **mortar**
  pestle lifts and drops; **clay table** clay lump (when loaded) + smoothing stick; **drying rack** bundles hung from the pole
  (green leaves / hide / dried goods by what is on the rack) swaying; **trough** water and the hide in it.
- Particles on strokes (`HandFx`): sparks off the anvil (more when the stroke counted double), wood chips at the chopping
  block, flour / ore dust at quern and mortar; a soft puff on `hand:done`.
- `HAND_DRAW_CAPACITY` 64 instances per part, `HAND_RANGE` 64 blocks; one draw call per part in view, nothing allocated per
  frame. `PartDef.visible/pose` and `HandAnim` are the extension points (`HAND_ANIMS`).
- The molten glow of a crucible is drawn by the furnace screen (casting engineer, `castText.ts`, `furnaceTabs.css`); the world
  furnace block is unchanged.

## UI (src/ui/hud, src/ui/menus/howto.ts, src/app)

- `UISimQuery.handView(x, y, z): { label: string; fraction: number } | null` (Simulation's `handView` fits). The crosshair
  name under a hand station is the sim's `label` ("Hand Quern - wheat 3/6 strokes", "Drying Rack - waiting for sun"), refreshed
  at once on `hand:stroke` / `hand:done` / `hand:taken` for the aimed station (not only on the 0.125 s slow tick). The
  crosshair's **ring fills with the work** (`fraction`) while a station is aimed and nothing is being mined.
- How to Play: a "Working by hand" card (`HANDWORK`) between "Building big" and "Tea and coffee"; the Use lines of both control
  lists mention strokes, and the Shift / Place line says an empty hand takes back what you loaded.
- `src/app/game.ts`: `hands: sim` passed to `PlayerController` (one word).

## Notes, deviations, known gaps

- Handwork entities keep `[input, output]` in `slots` (not `input` / `output` as handwork.md's text says); the render reads
  `slots` first and falls back to the named fields.
- The aiming line says "copper ingot 0/6 strokes" for the anvil's wire recipe and the sim picks plate vs wire by how many
  ingots were loaded (each Use loads one); the label does not name the recipe. A sim / label question, not a front-end one.
- Parts are drawn only within 64 blocks and 64 instances per part; beyond that the quern shows its bedstone without the runner.
- A tool stroke that counted double plays the same animation (sparks only grow). The anvil flash is a tinted plate, not
  emissive: the machine shader has no glow.
- The Casting Bench pouring into set moulds and hot work from molten metal taken by hand are not built (casting.md); no mould
  is drawn on the bench.
- First-run coach marks ("Drag here to look around") can sit on the portrait tap point and eat the first taps in a scripted run.

<!-- ======================== END docs/api/handwork-front.md ======================== -->


---

<!-- ======================= BEGIN docs/SPEC.md ======================= -->
# FILE: docs/SPEC.md

# HEARTHWATT - build spec

Hearthwatt is an ORIGINAL first-person voxel sandbox for the browser. The player asked for a block-building
game "more focused on technological advancement and generating power from resources. Your furnace is your
crafting table, there is a crafting table but the furnace is the main place in one's base they should
congregate to."

It must not recreate any existing game: no borrowed names, creatures, items, textures, UI layouts or
recipes. No shaped 3x3 crafting grid - crafting is always a recipe LIST (pick a row, see have/need, tap to make).
All art is procedural 16x16 pixel textures with our own palette; all sound is synthesised.

THE PLAYER IS VERY LIKELY ON A PHONE. Touch controls and phone-sized UI (portrait ~400px wide AND landscape)
are first-class, not an afterthought. Desktop (keyboard + mouse, pointer lock) must be equally good.

Repo root: /home/user/game. Stack: TypeScript (strict), three.js 0.170 (bundled), esbuild, vitest. No other
dependencies may be added. `npm run build` -> dist/game.js + dist/index.html (+ dist/artifact.html).

---------------------------------------------------------------------------------------------------------

## 1. The game in one page

Pillars
1. THE FURNACE IS THE HEART. One furnace block, upgraded in place through five tiers, is fire, forge, first
   generator, grid console, warm shelter, respawn anchor and finally the win condition. ~75% of all recipes
   are made at it. The workbench exists (it builds the first furnace and a handful of cold wooden things) but
   is deliberately minor.
2. HEAT FIRST, THEN WATTS. Early game you manage a real fire (fuel, temperature, bellows). Mid game the
   furnace's heat becomes your first electricity. Late game the furnace is the largest consumer on a power
   grid you built from wind, sun, water, oil, lava and uranium. The finale turns it into a star.
3. TECHNOLOGY IS A PLACE, NOT A MENU. The furnace's recipe list IS the tech tree: locked rows say what
   temperature / tier they need. No research points.
4. NO CREATURES, NO COMBAT. Danger is environmental: cold nights, falls, drowning, lava, radiation, meltdown.

Loop: explore and mine by day -> come home to the warm furnace at night -> smelt, forge, upgrade -> build
power -> upgrade the furnace -> repeat, until the Starhearth is ignited.

Ages (index -> name -> furnace tier that begins it)
0 Ember Age (Clay Furnace) - 1 Forge Age (Blast Furnace) - 2 Current Age (Arc Furnace) -
3 Atomic Age (Plasma Furnace) - 4 Star Age (Starhearth)

---------------------------------------------------------------------------------------------------------

## 2. Content roster (authoritative keys - src/content implements exactly these; it may add detail, not rename)

### 2.1 Blocks (68)
Natural: air, corestone (unbreakable floor at y=0), stone (drops rubble), rubble, dirt, grass (drops dirt),
sand, gravel (drops gravel + 25% flint), clay, snow, ice, basalt, limestone, water (liquid), lava (liquid,
light 15, contactDamage 4, warmth 4), oak_log, oak_leaves (drops: 30% fiber, 15% stick), pine_log,
pine_leaves (same drops), tall_grass (cross, drops 50% fiber), dry_shrub (cross, drops 1-2 stick).
Ores: coal_ore (drops 1-2 coal), copper_ore, tin_ore, iron_ore, sulfur_ore (drops 1-2 sulfur), quartz_ore,
bauxite, wolframite, spodumene, pitchblende (radiation 2), oil_shale. Ores other than coal/sulfur drop themselves.
Built: plank, stone_brick, brick, glass (translucent), concrete, torch (shape torch, light 13, warmth 2),
workbench (station), crate (machine 'crate'), lamp (machine, lightActive 15).
Furnaces (machine 'furnace', oriented, power 'device'): furnace_clay, furnace_blast, furnace_arc,
furnace_plasma, furnace_star. Active flag = furnace is hot (>= 200 C): frontActive texture, lightActive
11/12/13/14/15, warmthActive 6/8/10/12/24.
Generators (power 'device'): thermopile, steam_engine, burner_generator, water_wheel, wind_turbine,
solar_panel (shape slab), combustion_engine, geothermal_tap, fission_pile.
Grid: copper_cable, heavy_cable, super_cable (shape cable, power 'cable'), battery, lithium_bank.
Consumers (power 'device'): lamp, blower, space_heater (warmthActive 6), crusher, still, bore_rig,
centrifuge, electrolyzer.
Hazard: corium (radiation 8, light 9, hardness -1... breakable only with tier 5; drops none).

Tool tiers (minTier): hands 0 - flint 1 - bronze 2 - iron 3 - steel 4 - power drill 5.
 pickaxe blocks: stone 1, rubble 0, coal/copper/tin/limestone 1, iron/sulfur/basalt/oil_shale 2,
 quartz/bauxite 3, wolframite/spodumene 4, pitchblende 5, corium 5. Machines: pickaxe, minTier 0, hardness ~2
 (always drop themselves so nothing is ever lost). axe: logs, plank, workbench, crate. shovel: dirt, grass,
 sand, gravel, clay, snow. Hardness guide (seconds by hand): leaves 0.3, dirt/sand 0.8, logs 2, stone 4,
 ores 5-8, deep ores 10-14.

### 2.2 Items (non-block, ~60)
Raw: stick, fiber, cord, flint, coal, charcoal, coke, sulfur.
Tools (kind, tier, speed, durability): flint_pickaxe/axe/shovel (1, 2.0, 64); bronze_* (2, 3.0, 192);
iron_* (3, 4.5, 384); steel_* (4, 6.0, 768); power_drill (pickaxe, 5, 10, 3000, universal).
Metals: copper_ingot, tin_ingot, bronze_ingot, iron_ingot, steel_ingot, aluminum_ingot,
crushed_copper, crushed_tin, crushed_iron.
Parts: firebrick, ceramic_insulator, bellows, iron_plate, steel_plate, copper_wire, copper_coil, chassis,
graphite_electrode, silica, silicon_wafer, circuit, alumina, tungsten_powder, tungsten_rod, lithium_salt,
yellowcake, enriched_pellet, fuel_rod, empty_cell, deuterium_cell, superalloy, fused_quartz, magnet_ring,
star_core, fuel_canister.
Gear: pail, water_pail (use on water: pail -> water_pail; use water_pail on a block face: places a water
block and returns the pail), padded_coat (in inventory: warmth drain x0.5), shield_suit (in inventory:
radiation x0.1).

Fuels (FuelSpec: energyJ, burnS, flameTempC): stick 30k/12/450 - plank 60k/20/550 - oak_log & pine_log
200k/50/650 - charcoal 400k/80/1000 - coal 800k/100/1250 - coke 1200k/120/1550.

### 2.3 Recipes
HAND: plank x4 <- 1 oak_log (and a pine_log variant) | stick x4 <- 2 plank | cord <- 3 fiber |
flint_pickaxe <- 2 flint, 2 stick, 1 cord | flint_axe <- same | flint_shovel <- 1 flint, 2 stick, 1 cord |
workbench <- 6 plank | torch x4 <- 1 stick + 1 charcoal (and a coal variant).
WORKBENCH (the complete list, forever): furnace_clay <- 12 rubble, 6 clay | crate <- 8 plank |
stone_brick x4 <- 4 rubble | pail <- 3 plank, 1 cord | padded_coat <- 6 cord, 6 fiber | bellows <- 4 plank, 4 cord.

FURNACE - kind 'smelt' (exactly ONE input item type; loaded into a crucible, timed; minTempC / timeS / minTier):
 charcoal <- oak_log (pine variant) 300/8 | tin_ingot <- tin_ore 250/8 | firebrick x2 <- clay 400/6 |
 copper_ingot <- copper_ore 700/10 | glass <- sand 700/8 | crushed_tin -> tin_ingot 250/5 |
 crushed_copper -> copper_ingot 700/6 | coke <- coal 1000/12/T2 | iron_ingot <- iron_ore 1150/12/T2 |
 crushed_iron -> iron_ingot 1150/8/T2 | aluminum_ingot <- 2 alumina 1500/12/T3 |
 tungsten_rod <- 2 tungsten_powder 2000/16/T3 | fused_quartz <- 2 silica 2400/12/T4.
FURNACE - kind 'forge' (several inputs, made instantly if the furnace is at >= minTempC; minTempC[/minTier]):
 T1: bronze_ingot x4 <- 3 copper_ingot, 1 tin_ingot 800 | bronze_pickaxe <- 3 bronze_ingot, 2 stick 600 |
  bronze_axe <- same | bronze_shovel <- 1 bronze_ingot, 2 stick 600 | brick <- 4 firebrick 400 |
  ceramic_insulator x2 <- 1 clay, 1 sand 600 | copper_wire x3 <- 1 copper_ingot 500 |
  copper_cable x6 <- 3 copper_wire, 2 ceramic_insulator 500 | thermopile <- 4 copper_ingot, 2 tin_ingot, 2 firebrick 700 |
  lamp <- 1 glass, 2 copper_wire 500.
 T2: iron_pickaxe/axe/shovel <- 3/3/1 iron_ingot, 2 stick 1000 | iron_plate <- 2 iron_ingot 900 |
  copper_coil <- 4 copper_wire, 1 iron_ingot 700 | chassis <- 4 iron_plate, 2 bronze_ingot 1000 |
  steam_engine <- 1 chassis, 2 copper_coil, 4 iron_plate, 2 glass 1000 |
  burner_generator <- 1 chassis, 2 copper_coil, 4 firebrick 1000 | water_wheel <- 12 plank, 2 iron_plate, 2 copper_coil 700 |
  blower <- 2 iron_plate, 1 copper_coil, 1 bellows 900 | space_heater <- 2 iron_plate, 1 copper_coil 900 |
  crusher <- 1 chassis, 2 iron_plate, 1 copper_coil, 4 flint 1000 | battery <- 2 iron_plate, 2 copper_ingot, 3 sulfur 900 |
  steel_ingot x2 <- 2 iron_ingot, 1 coke, 1 limestone 1400 | steel_plate <- 2 steel_ingot 1300 |
  steel_pickaxe/axe/shovel <- 3/3/1 steel_ingot, 2 stick 1300 | graphite_electrode <- 3 coke 1200 |
  concrete x8 <- 4 gravel, 2 sand, 2 limestone 600.
 T3: silicon_wafer <- 2 silica, 1 coke 1700 | circuit <- 1 silicon_wafer, 3 copper_wire, 1 ceramic_insulator 900 |
  heavy_cable x6 <- 3 aluminum_ingot, 2 ceramic_insulator 900 | empty_cell x2 <- 1 aluminum_ingot 900 |
  wind_turbine <- 3 aluminum_ingot, 2 copper_coil, 1 steel_plate 1200 | solar_panel <- 2 silicon_wafer, 1 glass, 1 aluminum_ingot 1200 |
  still <- 1 chassis, 2 steel_plate, 2 glass, 1 copper_coil 1200 |
  combustion_engine <- 1 chassis, 4 steel_plate, 3 copper_coil, 1 circuit 1400 |
  geothermal_tap <- 1 chassis, 4 steel_plate, 2 copper_coil, 1 circuit 1400 |
  bore_rig <- 1 chassis, 2 tungsten_rod, 2 copper_coil, 1 circuit 1600.
 T4: superalloy x2 <- 2 steel_ingot, 1 tungsten_rod, 1 aluminum_ingot 2600 |
  power_drill <- 2 superalloy, 2 tungsten_rod, 1 copper_coil, 1 battery 2600 |
  lithium_bank <- 6 lithium_salt, 2 superalloy, 2 circuit 2400 | shield_suit <- 4 superalloy, 2 fused_quartz, 6 cord 2400 |
  centrifuge <- 1 chassis, 4 superalloy, 2 copper_coil, 2 circuit 2600 |
  electrolyzer <- 1 chassis, 2 superalloy, 2 fused_quartz, 1 circuit 2600 |
  fuel_rod <- 4 enriched_pellet, 1 superalloy 2000 | fission_pile <- 1 chassis, 6 superalloy, 4 fused_quartz, 4 circuit 2800 |
  magnet_ring <- 4 copper_coil, 2 superalloy, 2 lithium_salt 2800 |
  super_cable x6 <- 1 magnet_ring, 2 aluminum_ingot, 2 ceramic_insulator 2600 |
  star_core <- 6 magnet_ring, 8 superalloy, 6 fused_quartz, 4 circuit 3000.
MACHINE recipes (station = machine kind; ONE input item type; timeS; energyJ = drawW x timeS):
 crusher (1 kW, 4 s): crushed_copper x2 <- copper_ore | crushed_tin x2 <- tin_ore | crushed_iron x2 <- iron_ore |
  silica x2 <- quartz_ore | alumina x2 <- bauxite | tungsten_powder x2 <- wolframite | lithium_salt x2 <- spodumene |
  yellowcake x2 <- pitchblende | gravel <- rubble | sand <- gravel.
 still (2 kW, 20 s): fuel_canister <- 2 oil_shale.
 centrifuge (8 kW, 20 s): enriched_pellet <- 4 yellowcake.
 electrolyzer (20 kW, 45 s, must touch water): deuterium_cell <- 1 empty_cell.

### 2.4 Furnace tiers (FurnaceTierSpec)
| tier | block | name | maxTempC | heatCapacityJ | lossWPerC | crucibles | fuelSlots | speed | electricHeatW | warmth | upgradeTempC | upgradeCost |
|1| furnace_clay | Clay Furnace | 800 | 150 | 2.0 | 1 | 1 | 1.0 | 0 | 6 | - | - (crafted at the workbench) |
|2| furnace_blast | Blast Furnace | 1500 | 300 | 2.5 | 2 | 2 | 1.25 | 0 | 8 | 700 | 12 firebrick, 8 bronze_ingot, 1 bellows |
|3| furnace_arc | Arc Furnace | 2100 | 400 | 3.0 | 3 | 2 | 1.5 | 8000 | 10 | 1200 | 3 graphite_electrode, 4 copper_coil, 8 steel_plate, 8 firebrick |
|4| furnace_plasma | Plasma Furnace | 3200 | 800 | 8.0 | 4 | 2 | 2.0 | 40000 | 12 | 1900 | 4 tungsten_rod, 8 steel_plate, 6 copper_coil, 3 circuit, 4 aluminum_ingot |
|5| furnace_star | Starhearth | 3200 (5000 once ignited) | 800 | 8.0 | 4 | 2 | 3.0 | 40000 | 24 | 3000 | 1 star_core, 8 deuterium_cell |

### 2.5 Machines (MachineSpec; numbers live in src/content/tech.ts, behaviour in src/sim)
Generators
| kind | output | rule |
| thermopile | 0.25 W per C above 100 of an adjacent furnace, cap 300 W | must touch a furnace (any of 6 faces). Draws 4x its output from the furnace as heat. |
| steam_engine | min(2000, 4 x (T - 250)) W | must sit directly ON TOP of a furnace and touch water on one of its 4 sides. Draws 3x its output as heat. |
| burner_generator | 3000 W | burns any FuelSpec item from its fuel slot at 30% efficiency (electric J = energyJ x 0.3). Load-following (see 3.2). |
| water_wheel | 400 W | needs >= 2 water blocks among its 6 neighbours. Output is divided by the number of water wheels within 3 blocks (itself included). |
| wind_turbine | 1500 W x wind(t) x altitude | needs open sky (no solid block anywhere above). wind(t) = slow noise in 0.25..1; altitude = clamp((y-40)/40, 0.25, 1). |
| solar_panel | 300 W x sunlight (0 at night) | needs open sky. |
| combustion_engine | 12000 W | burns fuel_canister: 6 MJ each at 40% = 2.4 MJ electric (200 s at full load). Load-following. |
| geothermal_tap | 2000 W per adjacent lava block, cap 6000 W | never depletes. |
| fission_pile | 60000 W | burns fuel_rod: 72 MJ electric each (20 min). Needs >= 2 water blocks among its 6 neighbours. See 3.3. |
| furnace (tier 5, ignited) | 1,000,000 W | the Starhearth after ignition. |
Storage: battery ("Acid Battery") 2 MJ, 3 kW | lithium_bank 40 MJ, 150 kW. Charging is 90% efficient.
Cables (rating of the whole network = lowest-rated cable in it; a network without any cable is unlimited):
copper_cable 10 kW | heavy_cable 120 kW | super_cable 2 MW.
Consumers
| lamp 10 W | lit (active) while powered |
| blower 150 W | keeps the draft of every adjacent furnace at >= 0.8 x f |
| space_heater 300 W | warm radius 6 while powered |
| crusher 1000 W | runs crusher recipes: 1 input slot, 1 output slot |
| still 2000 W | still recipes |
| bore_rig 4000 W | mines the column straight below it, 1 block per 2 s, top to bottom, stops at corestone/liquids; drops go to its 9-slot buffer; pauses when the buffer is full |
| centrifuge 8000 W | centrifuge recipes |
| electrolyzer 20000 W | electrolyzer recipes; only runs while touching water |
| furnace electric heat | tier 3: up to 8 kW, tier 4-5: up to 40 kW (thermostat, see 3.1) |
| Starhearth ignition | 300 kW for 90 s |
crate: 27 slots. Every machine with an output buffer pushes finished items into a crate that touches it, if any.

### 2.6 Ore veins (OreVeinSpec; y band, veins per chunk x size, biome multipliers)
coal_ore 20-70, 5 x 8 (marsh x1.5) | copper_ore 16-60, 4 x 6 (dunes x2) | tin_ore 30-66, 2.5 x 5 | limestone 22-52, 1.5 x 14 |
iron_ore 6-46, 4 x 6 (marsh x1.5) | sulfur_ore 4-34, 1 x 5 (scar x3) | oil_shale 10-40, 1 x 8 (dunes x2, scar x2) |
quartz_ore 6-38, 1.5 x 5 | bauxite 18-46, 1.5 x 6 (dunes x2) | wolframite 3-20, 0.7 x 5 (frostfell x2) |
spodumene 3-22, 0.6 x 5 (dunes x2) | pitchblende 2-14, 0.5 x 4 (scar x3).
Nothing is biome-exclusive: every ore exists everywhere, some biomes are richer.

### 2.7 Objectives (in order; the tracker shows the first incomplete one)
gather 4 logs (any: break oak_log or pine_log x4) -> make 4 plank -> place workbench -> have 3 flint ->
make flint_pickaxe -> have 12 rubble and 6 clay (two objectives) -> place furnace_clay -> flag furnace_lit ->
make 4 charcoal -> flag well_warmed -> make 2 copper_ingot -> make 4 bronze_ingot -> make bronze_pickaxe ->
furnaceTemp 800 (bellows) -> generate 100 W (thermopile) -> place lamp -> furnaceTier 2 -> make 8 iron_ingot ->
make 6 steel_ingot -> place crusher -> flag machine_job -> generate 2000 W -> stored 1 MJ -> furnaceTier 3 ->
furnaceTemp 1900 -> make 2 circuit -> generate 10000 W -> make 4 tungsten_rod -> furnaceTier 4 ->
make 8 superalloy -> place fission_pile -> generate 60000 W -> make 8 deuterium_cell -> make star_core ->
furnaceTier 5 -> flag ignited.
Flags emitted by code: furnace_lit, bellows_pumped, well_warmed, rested, machine_job, ignited.

---------------------------------------------------------------------------------------------------------

## 3. Rules

### 3.1 The furnace (simulated every tick, dt = 0.05 s) - constants in src/core/constants.ts
State: tier, tempC (starts at ambient 20), lit, draft 0..1, fuel slots, current burn (item + seconds left),
crucibles [{ input: Slot, progress s, output: Slot }], electric on/off, ignition { state, progress }.
```
draft   = max(0, draft - 0.1*dt);  a Blower holds it at >= 0.8*f.   pump(): draft = min(1, draft + 0.34)
burning : lit && a fuel item is burning. When one burns out the next is taken from the fuel slots; if none
          is left the fire dies (lit = false, event furnace:out). Burn time elapses at rate (1 + draft).
flameEff= fuel.flameTempC + 250*draft
Qfuel   = burning && temp < flameEff ? (fuel.energyJ / fuel.burnS) * (1 + draft) : 0
Qelec   = electric (tier >= 3, switched on, on a network) ? f * demandW : 0
          demandW = clamp(loss + extract + (maxTempC - temp) * C / 2, 0, electricHeatW)      // thermostat to max temp
loss    = lossWPerC * (temp - 20);   extract = sum of thermopile / steam engine heat draw
temp   += (Qfuel + Qelec - loss - extract) * dt / heatCapacityJ
temp    = clamp(temp, 20, tier.maxTempC); fuel heating never pushes temp past flameEff (clamp to flameEff
          when Qfuel alone would overshoot), so a steady fire sits exactly at its flame temperature.
hot     = temp >= 200  -> the voxel's active flag (glow, light, warmth) follows `hot`.
```
- Lighting: `light()` needs fuel in a fuel slot. Adding fuel to a furnace that is still hot (>= 200 C) relights it automatically.
- Smelting: a crucible advances while temp >= recipe.minTempC, at speed tier.speed x (1 + min(1, (temp - minTempC)/300)).
  Each completed item moves to the crucible's output stack (event furnace:smelted). The crucible picks its recipe
  from the input item (smelt inputs are unique). Loading requires recipe.minTier <= tier.
- Forging: needs temp >= recipe.minTempC and tier >= recipe.minTier. Ingredients come from the player's inventory
  first, then from crates within 4 blocks of the furnace. Each forge removes 25 C. Output goes to the player's inventory
  (refused when it would not fit). Events: item:made, sfx forge.
- Upgrading (in place): needs upgradeCost (same ingredient sources) and temp >= upgradeTempC. The voxel's block id
  changes to the next tier's block (facing and state preserved), the entity keeps everything.
- Starhearth: tier 5 behaves like tier 4 until ignited. `startIgnition()` is allowed at temp >= 3000 C on a network.
  It then demands IGNITION_POWER_W (300 kW) on top of heating; progress advances while f >= 0.95 and resets to 0
  ('failed') if f < 0.95 for more than 2 s in a row. After IGNITION_SECONDS (90 s): ignited = true -> temp is
  pinned at 5000 C, it needs no fuel or power, generates 1 MW, every forge/smelt minimum is met; flag 'ignited',
  event game:won. The game continues afterwards.
- Rest: at night, when the player is inside the warm radius of a hot furnace, `rest()` skips the clock to dawn.
  It is refused unless the fire can last: remaining burn time (all fuel in the firebox at the current draft) or an
  electrically heated furnace. It consumes 60 s worth of fuel. Flag 'rested'.
- Home: the last furnace the player placed or opened is "home": respawn point and HUD compass target.

### 3.2 Power networks
Every block with `power` ('cable' or 'device') joins a network with its 6-neighbour power blocks (flood fill;
rebuild affected networks whenever a power block is placed or removed). Per network, per tick:
```
G      = sum of generator available watts
D      = sum of consumer demand watts
rating = min cable rating in the network (Infinity when it has no cables)
dis    = min(max(D - G, 0), sum battery.maxOutW)          maxOutW = min(rateW, storedJ/dt)
supply = min(G + dis, rating)
f      = D > 0 ? min(1, supply / D) : 1                   // satisfaction; every consumer gets the same f
used   = f * D
fromGen= min(G, used);   fromBat = used - fromGen          // batteries only cover what generators cannot
chg    = dis > 0 ? 0 : min(min(G, rating) - used, sum battery.maxInW)    maxInW = min(rateW, (capJ-storedJ)/(0.9*dt))
batteries share fromBat / chg pro rata:  storedJ += (0.9*chg_i - out_i) * dt
load   = G > 0 ? (fromGen + chg) / G : 0                   // fuel generators burn fuel in proportion to load
overloaded = (G + dis) > rating && D > supply
```
Consumers run at speed x f; below f = 0.25 they stall (no progress). Fuel-burning generators only count as
available while they hold fuel, and consume fuel energy = output x load x dt / efficiency. Emit power:alert
('overload', 'brownout', 'recovered') on state CHANGES only (never every tick).
Network stats exposed to the UI: generationW (potential), demandW, deliveredW, storedJ, capacityJ, rating,
satisfaction f, overloaded, list of members with their status text, and a rolling 60 s history of G and used.

### 3.3 Fission
core temp C; with a fuel rod loaded and switched on it produces heat; cooled = >= 2 water neighbours.
Cooled: core settles at 600 C and outputs 60 kW. Uncooled: output 0 and core rises 8 C/s from wherever it is.
>= 900 C: power:alert meltdown_warning (once), sfx alarm every 2 s, radiation 4 in radius 6.
>= 1200 C for 10 s: meltdown -> explosion radius 3 (removes non-corestone blocks, destroys machines), the pile
becomes a corium block. Switching the pile off or restoring water cools it 20 C/s.

### 3.4 Survival (per second unless noted)
Health 20. Warmth 0..100: drain 0.3 at night, +0.2 day / +0.6 night in frostfell, +0.4 while in water; x0.5 with a
padded_coat; x0.5 while Well-Warmed. Regain +4 inside any heat radius (furnace/torch/lava/space heater: block
warmth radius, Euclidean), +0.5 on a mild day. At 0 warmth: 1 damage every 3 s. Well-Warmed: 8 s within the
radius of a furnace at >= 400 C grants 300 s of +25% mining speed and half warmth drain (flag well_warmed, event buff:gained).
Air: 15 s underwater, then 1 damage/s. Fall: 1 damage per block beyond 3.5. Lava: 4 damage/s. Radiation: sum of
radiating blocks within 4 blocks (linear falloff), dose > 1 -> 1 damage per 2 s (x0.1 dose with shield_suit).
Health regenerates 1 per 4 s when warmth > 50 and no damage for 8 s. Death: respawn at home furnace (or world
spawn) keeping the whole inventory; full health if the home furnace is hot, half otherwise.

### 3.5 Time
A day is 900 s. timeOfDay 0..1 (0 = sunrise, 0.64 = sunset). sunlight factor 1 by day, ~0.08 at night with
smooth 0.05-wide dawn/dusk ramps. Events time:phase on change. A new world starts at 0.05 (early morning).

### 3.6 Mining and placing
Mining time = hardness / speed, speed = tool.speed if the held tool's kind matches the block's tool (or the tool
is universal) else 1; x1.25 while Well-Warmed. If block.minTier > the effective tool tier (0 for hands or a
wrong tool kind) mining takes 3x longer and drops nothing. hardness -1 cannot be mined. A matching tool loses 1
durability per block. Drops go straight into the inventory (event item:gained); what does not fit is lost with a
warning toast. Reach 5 blocks. Blocks cannot be placed inside the player. Oriented blocks face the player.
Interact ("use") priority: a held block is placed when the player forces it (Shift + Use, the touch Place toggle) or
when it is a building block (machine, generator, tank, cable, pipe, hearth wall) aimed at a block with a screen
anywhere but its front (an engine on a furnace, a tank on a tank); else station/machine block under the crosshair
opens its screen (from any face with an empty hand, an item or an ordinary block); else item-specific use (pail);
else place the held block item. Use looks past a thin block without a screen (a cable in a furnace mouth).

---------------------------------------------------------------------------------------------------------

## 4. Architecture

```
src/core/      (DONE, read-only for everyone) types.ts, registry.ts, events.ts, gameEvents.ts, context.ts,
               constants.ts, math.ts
src/content/   blocks, items, recipes, tech (ages, furnace tiers, machines), objectives, ore veins
src/world/     worldgen, chunks, World (implements IWorld), lighting, mesher, chunk worker + pool
src/game/      inventory, crafting, mining rules, player state, survival, clock, objectives
src/sim/       block entities: furnace, power networks, machines, explosions
src/render/    procedural textures, three.js renderer, chunk meshes, sky, particles, held item, item icons
src/player/    input (keyboard/mouse/touch), physics, raycast, block interaction
src/ui/        styles.css, kit/ (widgets), hud/, screens/
src/audio/     WebAudio synth
src/save/      persistence          src/main.ts  wiring + game loop        scripts/e2e.mjs  browser test
```
Layering (a module may import from modules to its left, never to its right, never sideways unless stated):
core <- content <- world, game <- sim <- render, audio <- player, ui <- main.
`core`, `content`, `world` (except its worker pool), `game`, `sim` are DOM-FREE and must run in node (vitest)
and, for core/content/world, inside a Web Worker. Only render, player, ui, audio, main touch the DOM.

Read src/core/*.ts before writing anything: those contracts are fixed. If you believe a core contract is wrong,
do NOT edit it - work within it and report the problem in your final report. The single exception:
you may APPEND new events to GameEvents in src/core/gameEvents.ts and new constants to src/core/constants.ts
(re-read the file immediately before editing; never rename or remove).

Cross-module communication: the typed EventBus (src/core/events.ts + gameEvents.ts). Sound is ALWAYS requested
with the 'sfx' event; HUD messages with 'toast'; screens with 'ui:open'.

Persistence contract: every stateful class exposes `toJSON(): <PlainSnapshot>` and a static/instance
`fromJSON(snapshot)`/`load(snapshot)` that restores it exactly. Snapshots are plain JSON (no typed arrays - encode
them, e.g. base64 or run-length). src/save composes them.

Game loop (main.ts): requestAnimationFrame; frame dt clamped to 0.1 s; player physics + controls every frame;
simulation, survival, clock and objectives on a fixed 20 Hz accumulator (max 5 catch-up ticks per frame);
world chunk streaming every frame with a time budget; render last.

Coordinates: +X east, +Y up, +Z south; yaw 0 looks north (-Z); block (x,y,z) occupies [x,x+1) etc.
World height 96 (y 0..95), sea level 32, chunks are 16x16 columns addressed (cx, cz) = floor(x/16), floor(z/16).

### Working rules for every build agent
- Stay inside the files/directories you own. Never edit another module's files; if you need something from it
  that it lacks, say so in your report.
- Other agents are working in this repository AT THE SAME TIME. Type errors and failing tests outside your
  directory are not yours: check only your own with
  `npx tsc --noEmit -p . 2>&1 | grep -E "^src/<yourdir>/"` and `npx vitest run src/<yourdir>`.
- Git: never checkout, stash, reset or rebase. When your module is finished (and at sensible checkpoints), commit
  ONLY your own paths and push: `git add <your paths> && git commit -m "<what and why>" && git push origin HEAD`
  (retry a few times if the index is locked or the push races another engineer; if the push is rejected, run
  `git pull --no-rebase --no-edit origin HEAD` and push again). End every commit message with the line
  `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not install packages.
  Do not leave servers or watchers running.
- TypeScript strict. No `any` unless unavoidable (and then narrow it immediately). Keep files focused (aim
  for < 350 lines; split by responsibility). Comments only where the WHY is not obvious. No TODO stubs:
  everything you export must work. No dead code.
- Unit tests (vitest, `*.test.ts` next to the code) for all DOM-free logic. Tests must be deterministic.
- Performance matters on phones: no per-frame allocations in hot loops, no O(world) scans per tick.
- When you finish, write docs/api/<your-module>.md: the PUBLIC API other modules will call (exact exported names
  and signatures, one-line semantics), deviations from this spec, and known gaps. Later engineers read it.
- Finish by running your typecheck + tests and reporting honestly. Your final report must list: the files you
  wrote, the PUBLIC API other modules will call (exact exported names and signatures, with one-line semantics),
  any deviation from this spec, and known gaps.

---------------------------------------------------------------------------------------------------------

## 5. Fixed cross-module details

- Furnace block entity (written by src/sim, read by game/ui/render): `{ kind: 'furnace', x, y, z, tier: number,
  tempC: number, lit: boolean, draft: number, ignited: boolean, ... }`. These five field names are a contract.
- Cable ratings live on the block (`BlockSpec.cableRatingW`): copper_cable 10000, heavy_cable 120000, super_cable 2000000.
- The world keeps voxel data loaded for every chunk that contains a block entity and for the 8 chunks around it,
  no matter how far the player is, so machines keep working. The simulation still must skip any entity whose
  chunk is not loaded yet (e.g. right after loading a save).
- Player edits must be visible on the very next frame (the edited chunk is re-meshed synchronously on the main
  thread; neighbours and lighting ripples may follow asynchronously with high priority).
- Texture names are free-form strings chosen by src/content; src/render paints one 16x16 RGBA tile per entry of
  `TEXTURE_NAMES` (registry). Item icons default to the texture `item_<key>`; cube-like block items are drawn as
  small isometric cubes from the block's face textures.
- The page shell is src/page.html (fixed). The game mounts into `#app`; the WebGL canvas gets class
  `game-canvas`; all UI lives in one overlay root appended to `#app`. src/ui/styles.css is inlined into the page
  by the build. The published page is hosted inside a sandboxed frame: alert/confirm/prompt do nothing, downloads
  are blocked, localStorage may throw (always try/catch), pointer lock and fullscreen may be refused (always
  handle rejection and fall back), audio only starts after a user gesture, no network requests at runtime.

---------------------------------------------------------------------------------------------------------

## 6. Trying things in a real browser (for every module that touches the DOM)

Headless Chromium with WebGL2 (software rendering - slow, ~5-20 fps in a full scene, but correct) and Playwright
are installed. Bundle ANY entry file with the game's own pipeline (three.js, the inlined chunk worker, the page
shell and src/ui/styles.css) like this:

    cd /home/user/game && node scripts/build.mjs --dev --entry=<abs path to harness.ts> --out=<abs scratch dir>

That writes <out>/index.html + game.js. Keep harness sources in your scratch directory (they may import from
/home/user/game/src/... by absolute path). Then drive it from a .cjs script in your scratch directory:

    const { chromium } = require('playwright');              // works from any directory; launch() needs no options
    const { pathToFileURL } = require('url');
    (async () => {
      const { serve } = await import(pathToFileURL('/home/user/game/scripts/build.mjs').href);
      const server = await serve(0, '<abs out dir>'); const port = server.address().port;
      const browser = await chromium.launch();
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });   // phone: 390x844 with hasTouch: true, isMobile: true
      page.on('console', m => console.log('[page]', m.type(), m.text())); page.on('pageerror', e => console.log('[pageerror]', e));
      await page.goto(`http://localhost:${port}/`);
      // ... page.evaluate / page.keyboard / page.mouse / page.touchscreen ... page.screenshot({ path })
      await browser.close(); server.close();
    })();

Look at your screenshots with the Read tool and judge them critically. Do not run `playwright install`.
Pointer lock is not available in headless Chromium - code must already cope with that (drag-to-look fallback).

---------------------------------------------------------------------------------------------------------

## 7. Module briefs for the second build wave

Controls (authoritative, the README documents exactly these):
Desktop: WASD move, mouse look (click the view to capture; if pointer lock is refused, drag with the mouse to
look), Space jump / swim up, Shift sprint, hold LEFT mouse = mine, RIGHT mouse = use / place, 1-9 and wheel =
hotbar, E = inventory + hand crafting, L = Hearth Log, Esc = pause or close the open screen.
Touch: left thumb = floating joystick (pushing it to the edge sprints), drag on the right half = look, on-screen
buttons Jump, Mine (hold), Use; a short TAP on the world = use/place at the crosshair, PRESS AND HOLD on the world
= mine at the crosshair; tap a hotbar slot to select it; bag button = inventory; tap the goal tracker = Hearth
Log; pause button. Targeting is always the crosshair at screen centre.

### 7.1 src/sim/ - furnace, power, machines   (DOM-free, node-testable)
Implements spec sections 2.4, 2.5, 3.1, 3.2, 3.3 exactly, reading every number from the registry (FURNACE_TIERS,
MACHINES, recipes, block cableRatingW) and src/core/constants.ts - no magic numbers duplicated in code.
- Block entities are plain JSON objects stored in the world (world.setEntity). ALL machine state lives in plain
  fields on the entity at all times (inventories as plain slot arrays), because the world serialises entities
  as they are. Field names fixed by spec section 5 for furnaces.
- class Simulation(world: IWorld, bus, player: PlayerState, clock: GameClock). tick(dt) advances every entity
  whose chunk is loaded, then solves every power network.
- Entity lifecycle is driven by 'block:changed': a block with `machine` appearing creates its entity (unless one
  of the same kind is already at that position - furnace upgrades swap the block id and keep the entity); a
  machine block disappearing removes the entity, returns everything it held to the player (fuel, crucible
  contents, buffers; toast if something did not fit) and emits machine:removed. The simulation sets the voxel
  active flag of machines to mirror "running/hot/lit" (only on change).
- Slot access for the UI: every machine exposes its slot groups as Inventory-compatible objects with accept rules
  (furnace: fuel slots accept only fuels with a flame; crucible inputs accept only items smeltable at the current
  tier; outputs are take-only; generator fuel slots accept only that generator's fuels; processors accept only
  their recipe inputs) so the UI can use the same click/tap transfer logic as for the player inventory.
- Player actions (each returns { ok: true } or { ok: false, reason: string } with a short human reason the UI can
  show): light, douse, pump, setElectric, forge(recipeId, times), upgrade, startIgnition, rest, toggle machine
  on/off. Forging and upgrading take ingredients from the player first, then crates within STATION_CRATE_RADIUS;
  expose the same source list so the UI can show accurate have/need numbers (also for the workbench).
- Queries for the UI and objectives: a per-furnace view (temperature, trend, flame/target temperature, burn time
  left across the firebox, per-crucible recipe + progress + status text, forgeable recipe list with per-recipe
  availability and reason, next upgrade with have/need and temperature check, electric demand/delivery,
  ignition state, whether rest is possible); a per-machine view (status text, rates, progress, placement
  problem if any, e.g. "Needs water on one side"); network stats as listed in 3.2 for the network at a position
  and for all networks; totals: maxFurnaceTempC(), maxFurnaceTier(), generationW() (sum of available generator
  watts over all networks), storedJ().
- Home: placing a furnace or opening its screen ('ui:opened' with a furnace screen) sets player.home.
- Explosions (meltdown): remove blocks in a sphere except corestone, emit 'explosion', damage the player by
  distance, destroy machines inside (their contents are lost).
- Events: furnace:lit/out/pumped/smelted/upgraded/ignition, machine:placed/removed/job, power:alert, flag
  (furnace_lit, bellows_pumped, machine_job, rested, ignited), game:won, sfx (ignite, fire_out, bellows, forge,
  smelt_done, upgrade, machine_on/off/done, alarm, explosion, ignition, win), toast for things the player must
  know. Never emit per-tick spam.
- Tests: furnace reaches each fuel's flame temperature and sits there; bellows raise it by up to 250 C and burn
  fuel faster; cooling curve; crucible gating/progress/speed; forge chill, ingredient sourcing from crates,
  refusal reasons; upgrades; thermopile and steam-engine coupling against the spec's formulas (a coal fire with
  a steam engine settles near 820 C delivering ~2 kW); every generator's placement rule; network solve cases
  (surplus charging with 90% efficiency, battery discharge, brown-out factor, stall below 0.25, cable rating
  cap + overloaded flag, load-following fuel use, splitting and merging networks when cables are removed/added,
  alerts only on change); every processor and the bore rig (with crate push); fission cooled/uncooled/meltdown;
  ignition success and failure; entity JSON round trip mid-run continues identically; and one long scripted
  PLAYTHROUGH test that walks the whole tech tree through the public API only (give raw materials, place blocks
  in a fake world, tick): tier 1 -> bronze -> tier 2 -> steel -> thermopiles/steam -> tier 3 on electric heat ->
  tier 4 -> fission -> star core -> tier 5 -> ignition -> game:won. Performance: 300 entities tick in < 1 ms.

### 7.2 src/render/ - everything drawn in 3D, plus item icons
- textures/: pure, deterministic pixel painters - paintTexture(name): Uint8ClampedArray (16x16 RGBA) for EVERY
  entry of TEXTURE_NAMES, built from a small shared palette and parametric families (stone-likes, ores = host
  rock + coloured flecks, planks, bricks, machine casings with rivets/vents/gauges, glowing furnace mouths per
  tier, ingots, plates, dusts, tools by head material, parts...). Our own look: warm, slightly desaturated
  naturals; soot-and-ember industry; electric cyan accents on powered machines. Item icons have transparent
  backgrounds and a 1px darker outline so they read on dark UI. Node tests: every TEXTURE_NAMES entry has a
  dedicated painter (no silent fallback), no texture is blank or fully transparent (except by design), painting
  is deterministic, block textures are fully opaque unless the block is cutout/translucent.
- atlas: one THREE.DataArrayTexture (WebGL2 sampler2DArray), nearest magnification, mipmaps for distance.
- materials: custom ShaderMaterial (GLSL ES 3.00) for the opaque, cutout (alpha test) and translucent batches
  using the MeshBatch attributes (position, uv, layer, light bytes). Lighting = max(sky * sunlight, block) through
  a perceptual ramp, block light tinted warm (firelight), sky light tinted by time of day, shade byte multiplied
  in, emissive flag = full brightness, sway flag = gentle wind motion, liquid flag = slow surface shimmer. Distance
  fog that matches the sky colour and hides the edge of the loaded world; darker blue fog when the camera is
  under water.
- chunk meshes: consume 'chunk:meshed' / 'chunk:unloaded'; three meshes per chunk; correct draw order; proper
  disposal; frustum culling.
- sky: gradient dome by time of day (GameClock), sun and moon, stars at night, simple drifting clouds.
- effects: outline on the targeted block; mining crack overlay in stages; pooled particles (block debris in the
  block's colours when mining/breaking, smoke rising from every hot fuel-burning furnace so the base is visible
  from afar, sparks on bellows pumps and forging, steam from running machines, explosion burst); first-person
  held item (tool / block / empty hand) with a swing while mining and a dip when placing or switching.
- icons: createIconProvider() -> (itemKey) => HTMLCanvasElement (cached; cube-like block items as small
  isometric cubes with shaded faces from the block's textures, everything else as the flat 16x16 icon scaled
  with nearest-neighbour) for the UI.
- class Renderer(container, world, bus, clock, settings): creates the canvas (class game-canvas), caps pixel ratio
  (2 on desktop, 1.5 on touch devices), setView(x, y, z, yaw, pitch), setFov, setTarget(block or null, crack
  stage), setHeldItem(itemKey or null), triggerSwing(), render(dt), resize(), stats (draw calls, triangles),
  dispose(). No per-frame allocations. Throws a clear error if WebGL2 is unavailable. Handles context loss.
- Verify in the browser (spec section 6) with a harness that streams a real World and flies a camera: daytime
  vista, dusk, night, inside a cave with a torch, a lit furnace at night with smoke, water, every biome, a wall
  of every block (texture review). Judge the screenshots like an art director; iterate on palette and textures
  until the world looks intentional and each ore is recognisable. Report triangle counts and software-rendered fps.

### 7.3 src/player/ - controls, physics, interaction
- input: one InputManager producing a per-frame intent (move vector, look delta, jump, sprint, mine held, use
  pressed, hotbar change, menu keys) from keyboard+mouse AND touch, per the controls above. Pointer lock with a
  drag-to-look fallback when it is unavailable or refused. Touch overlay (joystick, look zone, Jump / Mine / Use
  buttons, bag and pause buttons) is created inside the UI root's touch layer; it appears when settings say so
  (auto = device has touch), respects safe-area insets, works in portrait and landscape, uses pointer events with
  proper multi-touch tracking (stick + look + button at the same time), never triggers page scroll/zoom, and is
  hidden while a screen is open. Ship its CSS from your own module (inject a <style>), using the kit's CSS
  variables so it matches. Honour InputState (uiOpen / paused): no gameplay input then.
- physics: player box 0.6 x 1.8 against solid voxels (slabs are half height and can be stepped onto), gravity,
  jump, sprint, swimming in liquids (buoyancy, slower, Space to rise), no tunnelling at any speed (sub-step),
  fall damage via PlayerState.damage, falling out of the world returns the player to spawn. Unloaded chunks are
  solid walls (never fall through missing terrain).
- raycast: exact voxel traversal (DDA) from the eye along the view up to REACH; returns block, face and the
  adjacent cell for placement; ignores air and (unless a pail is held) liquids; thin shapes (torch, cross, cable,
  slab) are targetable through their real bounds or their whole cell - either is fine but be consistent.
- interaction per spec 3.6 using src/game/mining.ts: mining progress with 'block:mining' events and periodic dig
  sfx by material, completion (set voxel to air, drops via player.give, tool wear, 'block:broken'), placing with
  a short repeat delay, validity rules (not inside the player, placeOn, target replaceable), oriented blocks face
  the player, using stations/machines emits 'ui:open' with the right ScreenRequest, pail logic, hotbar selection.
- class PlayerController that ties these together each frame, drives the camera through the Renderer (eye
  position, yaw/pitch, slight view bob, FOV kick while sprinting, target outline + crack stage, held item, swing)
  and keeps InputState.pointerLocked / touch up to date; re-captures the pointer when a screen closes.
- Tests (node): physics (rest on ground, walls, ceilings, no tunnelling in a 60 m fall, step onto slab, swim),
  raycast (faces, reach, negative coordinates), interaction rules with fakes. Then verify in a real browser
  (spec section 6) with a harness that boots World + Renderer + your controller: keyboard walking moves the
  player, holding the mouse mines a block and the item arrives, placing works; and in a phone viewport with
  touch emulation: the joystick moves, dragging looks, the buttons work. Screenshot both.

### 7.4 src/ui/hud and src/ui/screens - the HUD and every in-game screen (built on the existing kit)
- class GameUI(root: UIRoot, deps): owns the HUD and all screens; listens to 'ui:open' / 'ui:close'; sets
  InputState.uiOpen; emits 'ui:opened' / 'ui:closed'; Esc / back closes; only one screen at a time; refreshes
  open screens ~8 times per second plus on relevant events; never rebuilds DOM that has not changed.
- HUD: hotbar (9 slots, counts, durability, selection; tappable), vitals (health, warmth, air only when under
  water), Well-Warmed indicator with time left, home compass (arrow towards the home furnace relative to where
  the player looks, distance, hot/cold state and temperature), goal tracker (current objective title + progress;
  tap/L opens the Hearth Log), power strip once any network exists (generation vs demand), day/night dial,
  crosshair with a mining progress ring and the targeted block's name, item-gain feed, toasts, banners for new
  ages and completed objectives, vignettes (red on damage, frost creeping in below 30 warmth, amber when
  Well-Warmed), optional FPS. On phones the HUD must leave the thumbs' zones free for the touch controls
  (bottom-left stick, bottom-right buttons): hotbar at the bottom centre, everything else along the top.
- Screens:
  * Inventory: the 36 slots (hotbar row marked) + the hand recipe list.
  * Workbench: its recipe list + inventory.
  * FURNACE - the most important screen in the game; it must be a pleasure to sit at. Header: tier name and
    age, Upgrade button showing have/need for the next tier (glows when affordable; explains what is missing).
    FIREBOX panel, always visible whatever tab is open: big thermometer coloured by the heat ramp with notches
    for the crucibles' and the selected recipe's required temperatures, live flame (height follows draft,
    colour follows temperature), fuel slots with burn bar and time left, Light / Douse, a large PUMP button for
    the bellows (satisfying: sparks, sound, the needle jumps), the electric heating switch with demand/delivered
    (tier 3+), a one-line status that always says the most useful thing ("Burns out in 2:10", "Copper needs
    700 C - now 540", "No fuel"). Tabs: SMELT (one row per crucible: input slot, recipe + progress, required
    temperature badge, output slot), FORGE (the main recipe list with category chips - Tools, Parts, Machines,
    Power, Building - showing requirement badges, have/need chips, Make and x5; rows you cannot make yet say
    why; rows from higher tiers are shown locked with what unlocks them, so the list reads as the tech tree),
    GRID (the network this furnace is on: generation / demand / stored figures, 60 s sparkline, cable limit,
    alerts, member list with status; and the Starhearth ignition panel at tier 5), LOG (Hearth Log: current
    goal, upcoming, completed, ages). Plus "Rest until dawn" when allowed. The player's inventory is reachable
    from every tab (side panel on wide screens, collapsible drawer on phones).
  * Machine screens by role (generator, burner with fuel slot, processor with in/out and progress, battery
    with charge, bore rig with depth and buffer, fission pile with core temperature gauge, rod slot, on/off,
    cooling state and warnings, crate with 27 slots), each showing the placement hint and any placement problem.
  * Hearth Log as a standalone screen, death screen (cause + Respawn), win screen (ignition celebration, stats,
    Keep playing).
- Slot interaction, identical everywhere: click/tap a slot to pick up its stack (shown attached to the cursor /
  as a highlighted "held" slot on touch), click/tap another slot to drop/swap/merge; right-click / long-press
  picks up half; double-click / a "quick move" affordance sends the stack to the other inventory. It must be
  fully usable with touch only.
- Phone first: 390x844 portrait, 844x390 landscape, 1280x800 desktop. No clipped text, no page scroll.
- Verify in the browser (spec section 6) with a harness that builds real PlayerState + Simulation + a small World
  (or fake IWorld), places a furnace, gives items, opens each screen and screenshots it at all three sizes in
  several states (cold furnace, roaring furnace mid-smelt, tier 3 on electricity with a network, tier 5 ready
  to ignite, a brown-out). Use it like a player: click through real flows with Playwright (load fuel, light, pump,
  smelt copper, forge a pickaxe, upgrade) and fix whatever is awkward.

### 7.5 Integration - src/main.ts, src/app/**, src/save/**, scripts/e2e.mjs, README.md
- Boot: title screen (kit menus) -> New World (seed) or Continue -> loading (spawn area generated) -> play.
  Pause menu, settings (persisted), save and quit to title. Friendly full-screen message if WebGL2 is missing.
- class Game wiring every module in dependency order, the game loop of spec section 4, feeding audio ambience
  and listener, HUD data, objective queries from the simulation, home/respawn, death and win flows.
- Saving: src/save - one versioned JSON document in localStorage (every access in try/catch, in-memory fallback,
  graceful handling of quota errors and corrupt/old saves): seed, world edits + entities, player, clock,
  objectives, settings. Autosave every 30 s, on pause, on visibilitychange/pagehide. Continue restores exactly.
- window.__hw debug handle for tests: read-only state summary plus helpers (give, teleport, setTime, setVoxel,
  open a screen, run N simulation ticks, save, reset).
- scripts/e2e.mjs (uses scripts/lib/browser.mjs): builds, serves, and proves in headless Chromium on desktop AND
  phone viewports that the game boots without console errors, chunks render, the player can walk, mine a tree,
  craft planks through the real UI, place a workbench and a furnace, load fuel, light it, see the temperature
  rise, smelt and collect an ingot, forge an item, that touch controls move the player, and that save -> reload
  -> Continue restores position, inventory and furnace state. Exit code 1 on any failure.
- You may edit any module to fix integration bugs (keep such edits minimal and list them in your report).

Already in the repository for 7.5: src/save/storage.ts (SaveStore: versioned, never-throwing JSON persistence with
memory fallback - build the save document on top of it), scripts/lib/browser.mjs (openGame, waitFor,
createReporter, VIEWPORTS for desktop / phonePortrait / phoneLandscape), README.md (update it where the final
game differs), .github/workflows (CI runs typecheck, tests and the build).

Note for 7.3: src/player/input/** (InputManager producing a per-frame Intent from keyboard, mouse and touch, plus
the on-screen touch overlay) and note for the game loop: src/audio/** (AudioEngine) are built by separate
engineers ahead of the second wave. Build on them; do not rewrite them. If they have a bug, fix it minimally and
say so in your report.

---------------------------------------------------------------------------------------------------------

## 8. (removed)

- src/render/textures/ has its own brief inside 7.2; whoever builds the rest of src/render builds on it.

---------------------------------------------------------------------------------------------------------

## 9. How the second wave is split (so its engineers can work at the same time)

- src/sim (7.1), src/render (7.2), src/player (7.3) and the first half of the UI (7.4a) are built SIMULTANEOUSLY.
  None of them may import another of them. They meet only through src/core, src/content, src/world, src/game, the
  UI kit, and events.
- Render <-> player: the Renderer implements `IView` from src/core/context.ts (setView, setFov, setTarget,
  setHeldItem, triggerSwing). The PlayerController takes an IView and never imports src/render.
- Player -> machines/screens: only through 'ui:open' events and world.setVoxel (the simulation reacts to
  'block:changed'); the player module never imports src/sim.
- 7.4a "HUD and basic screens" (src/ui/hud/**, src/ui/gameUI.ts, src/ui/screens/inventory, workbench, log, death,
  win, plus the shared slot-interaction controller in src/ui/screens/slots.ts): depends on src/game and the kit
  only. GameUI exposes registerScreen(type, factory) so more screens can be added without editing it. Whatever
  the HUD needs from the simulation (home furnace temperature/tier/hot, grid generation and demand, current
  network alerts) comes through a small injected query interface that 7.4a defines and documents.
- 7.4b "furnace and machine screens" (src/ui/screens/furnace/**, src/ui/screens/machines/**) is built AFTER the
  simulation and 7.4a exist, registers its screens with GameUI, and uses the slot-interaction controller of 7.4a.
- Integration (7.5) comes last.

---------------------------------------------------------------------------------------------------------

## 10. Briefs of the first wave (verbatim from the original assignments)

### 10.1 src/game
YOUR MODULE: src/game/ (you own this directory and nothing else). Everything here is DOM-free and runs in node. The world engine (src/world) is being written right now by another engineer: you never import it - you only touch the world through the IWorld interface in src/core/types.ts, and in tests you use a small in-memory fake that implements it.

Build the rules of the game that are not machines:
- inventory.ts - class Inventory over a fixed number of slots (ItemStack | null). It must be able to WRAP AN EXISTING plain slot array without copying (new Inventory(size) allocates; Inventory.over(slots) or an optional constructor argument adopts the given array and writes through to it) because the simulation stores machine inventories as plain arrays on block entities that are serialised as they are. Operations: add (stacks onto existing stacks first, respects ItemDef.stack, returns the leftover count), remove, count, has, canFit (for one or several ItemAmounts at once), firstEmpty, clear; an optional per-inventory accept rule (item key, slot index) => boolean and a take-only flag, both honoured by every operation that puts items in; slot-level operations the UI needs for click/tap interaction between any two inventories (move a whole stack, move half, move one, swap, merge, quick-move a stack into another inventory); tool durability is preserved when stacks move and tools never stack; a change listener; toJSON/fromJSON.
- crafting.ts - ingredient logic shared by every station: availability(recipe, sources: Inventory[]) -> have/need per ingredient and an ok flag, counting across several inventories in priority order (the player's first, then nearby crates); craft(recipe, sources, destination, times?) that is atomic (either all ingredients are taken and all outputs added, or nothing changes; refuse with a reason when the outputs do not fit); maxCraftable; recipe lists for 'hand' and 'workbench'. Temperature/tier gating of furnace recipes is NOT your job (the simulation does it) but your functions must be the ones it calls for ingredients.
- mining.ts - pure rules of spec 3.6: miningTime(block, heldStack, wellWarmed), canHarvest, rollDrops(block, rng), wear.
- clock.ts - GameClock per spec 3.5: timeOfDay, day count, tick(dt), sunlight(), phase, isNight, skipToDawn(), emits 'time:phase' on changes, toJSON/load.
- playerState.ts - PlayerState: position/velocity/yaw/pitch, onGround, inWater, headInWater, health, warmth, air, the 36-slot inventory (slots 0-8 are the hotbar), selectedSlot, home position, world spawn, buff timers, lifetime stats (items made, blocks placed, blocks broken - by key), dead flag; helpers heldStack(), damage(amount, cause) (emits player:damage / player:death, sfx hurt/death), heal, respawn(homeIsHot), give(item, count, durability?) that emits item:gained and inventory:changed and toasts a warning when the inventory is full (returns what did not fit); toJSON/load. Yaw convention: radians, 0 looks north (-Z), positive turns left (three.js camera.rotation.y); pitch positive looks up.
- survival.ts - Survival.tick(dt): warmth, Well-Warmed buff, air, lava and contact damage, radiation, regeneration, cold damage - exactly spec 3.4. Heat sources: block entities whose voxel has warmth (iterate world.entities(), read the voxel and use voxelWarmth from the registry, which honours the active flag) plus a small local scan (radius 4) for non-entity warm blocks such as torches and lava; do the scans at most twice per second, never every tick. The Well-Warmed buff needs a furnace entity with tempC >= FURNACE_BUFF_C (spec section 5 fixes the entity field names). Biome is supplied by a callback (x, z) => BiomeKey so you do not import src/world. Expose what the HUD needs: current warmth trend (warming/cooling/steady), whether the player is inside a heat radius, radiation dose, time left on the buff.
- objectives.ts - ObjectiveTracker: tracks OBJECTIVES in order using the bus (item:made, block:placed, block:broken, flag, furnace:upgraded ...) and the player state; conditions that need the simulation (furnaceTemp, furnaceTier, generate, stored) read from an injected query object { maxFurnaceTempC(), maxFurnaceTier(), generationW(), storedJ() }. Checks at most a few times per second. When the current objective completes: grant rewards, emit objective:completed, toast, sfx objective, and immediately evaluate the next one (cascading). Tracks the current age (highest furnace tier ever reached maps to FurnaceTierSpec.age) and emits age:advanced once per age. Exposes the current objective, progress for it as numbers and text (e.g. "3 / 8"), the upcoming and completed lists; toJSON/load. Lifetime counters (made/placed/broken) are recorded from the first moment of the game, not only while their objective is current.
- index.ts re-exporting the public API.

Tests (vitest): inventory stacking/splitting/moving edge cases incl. full inventories, tools, accept rules, take-only, wrapping an external array (mutations visible both ways, JSON.stringify of the array is the saved state); atomic crafting across several source inventories; mining times and harvest rules against real blocks and tools from the registry; clock phases and sunlight continuity; survival scenarios (night drain, coat, furnace warmth restoring, Well-Warmed after 8 s near a furnace at 400 C+, drowning, cold damage at 0 warmth, radiation with and without suit, regeneration, death and respawn keeping the inventory); objective tracker walking through the first ten real objectives with scripted events, cascade completion, reward granting, age advancement, save/load round trip in the middle.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/game/"   and   npx vitest run src/game

### 10.2 src/world
YOUR MODULE: src/world/ (you own this directory and nothing else). src/content now exists; the content engineer's API notes are at the end of this prompt.

Build the voxel world engine. Everything here is DOM-free and must run in node and inside a Web Worker, except workerPool.ts.

Files and responsibilities:
- chunk.ts - chunk storage (Uint16Array of CHUNK_VOLUME, index via voxelIndex), coordinate helpers.
- worldgen.ts - generateChunk(seed, cx, cz): Uint16Array - a pure deterministic function of its arguments (no hidden state, safe to call in any order, in any thread). Also biomeAt(seed, x, z): BiomeKey and findSpawn(seed): {x, y, z}.
  Terrain: four biomes from low-frequency climate noise with smooth height blending - woodland (rolling hills, oak trees, tall_grass, lakes and rivers with sand/clay/gravel shores), dunes (sand dunes, dry_shrub, sandstone-free: use sand over stone, rare water), frostfell (high snowy mountains up to y~84, pine trees, snow cover, ice on water), scar (dark basalt badlands, crags, lava pools at the surface). Surface heights roughly 28..84 with sea level 32; water fills up to sea level. corestone at y=0 (and scattered at y=1). Caves: 3D-noise tunnels and a few chambers, never breaching water (keep >= 3 solid blocks under any water column) so there are no hanging water walls; cave air at y <= 8 is lava. Gravel patches in stone and on shores, clay under shallow water in woodland. Ore veins from ORE_VEINS (registry): deterministic blobs replacing stone/basalt only, honouring the y band, veinsPerChunk (fractional = probability) and biome multipliers; veins and trees may cross chunk borders - generate them from per-chunk seeds of the 3x3 neighbourhood and clip, so the result never depends on generation order.
  Spawn: findSpawn must return a dry woodland spot above sea level and guarantee - assert this in tests over at least 12 seeds - that within 48 blocks there are at least 8 logs worth of trees, exposed or shallow stone, clay, gravel, and standing water. If the natural terrain does not provide one of these near the chosen spot, pick another spot (search outward deterministically); never fake it by editing the world after generation.
- lighting.ts - computeLight for one chunk from the 3x3 neighbourhood of voxel arrays: sky light (15 with open sky above, attenuating 1 per block sideways/down through non-opaque blocks, -2 extra through water) and block light (BFS from emitters using voxelLight(v), 15 max). Stateless and exact because light travels at most 15 blocks and the neighbourhood margin is 16. Returns light for the centre chunk plus a 1-voxel border (needed for smooth lighting). Unloaded neighbours count as fully sky-lit air.
- mesher.ts - meshChunk(input): ChunkMeshData (types in src/core/types.ts: MeshBatch layout is a contract). Face culling against opaque neighbours (and same-liquid neighbours), per-vertex ambient occlusion and smooth lighting (average of the 4 cells around each vertex) baked into the light bytes [sky, block, shade, flags]; face shading baked into shade (top 1.0, bottom 0.5, north/south 0.8, east/west 0.65, multiplied by AO); quad diagonal flipped to avoid AO anisotropy. Shapes: cube; liquid (surface lowered by 2/16 when the block above is not the same liquid; LIGHT_FLAG_LIQUID on the top face; translucent batch for water, opaque for lava with LIGHT_FLAG_EMISSIVE); cross (two diagonal double-sided quads, cutout batch, LIGHT_FLAG_SWAY on the upper vertices); torch (thin 2/16 post 10/16 tall with a brighter emissive tip, cutout or opaque); cable (6/16 core plus an arm towards each neighbour whose block has power set); slab (bottom half). Blocks whose light value > 0 for the current voxel state render that face with LIGHT_FLAG_EMISSIVE only where the texture is the active/front variant (a lit furnace mouth glows; its brick sides do not). Texture layers via faceLayer()/voxelFaceLayer() from the registry. Output typed arrays sized exactly (no slack) so they can be transferred.
- worker.ts - Web Worker entry (bundled separately by scripts/build.mjs and exposed to the main bundle as the default export string of 'virtual:worker'): handles 'generate' and 'mesh' jobs, transfers results.
- workerPool.ts - creates 1-4 workers from the inlined source via Blob URL; if the source is empty or Worker creation throws, runs the same job functions on the main thread inside a per-frame time budget instead. One Promise-returning run(job) API either way; jobs are cancellable/skippable when their chunk is no longer wanted.
- world.ts - class World implements IWorld (src/core/types.ts) and owns streaming: update(playerX, playerZ, renderDistance, budgetMs) loads/generates chunk columns nearest-first, applies stored player edits on top of generated terrain, requests meshes once the 3x3 neighbourhood is present, re-meshes dirty chunks (player edits: synchronously, same frame, for the edited chunk; neighbours/lighting ripples asynchronously with priority), emits 'chunk:loaded', 'chunk:meshed', 'chunk:unloaded' and 'block:changed' on the GameBus. Unloads voxel data beyond renderDistance + 3 EXCEPT chunks pinned by block entities (see spec section 5). Edits are remembered forever as sparse per-chunk maps so they survive unloading. Block entities: a Map keyed by position; entities() iterates all. surfaceY, isLoaded as per the interface. Also expose what the game loop needs: a synchronous way to make sure the chunks around a position are generated before the player is dropped into the world (e.g. ensureLoadedAround(x, z, radiusChunks)), counts for a debug overlay, and toJSON()/load() covering seed, edits (compact encoding) and entities.
- index.ts re-exporting the public API.

Tests (vitest, all deterministic): worldgen determinism (same seed twice -> identical arrays; neighbouring chunks agree at borders for cross-border trees/veins by checking that generating in different orders gives identical data); spawn guarantees over >= 12 seeds; every ORE_VEINS block appears within its y band across a 12x12-chunk sample and roughly at the configured density (within a factor of 3); no water voxel has air directly below or beside it at generation (no hanging water); lighting (open sky = 15, sealed cave = 0, torch falloff, light crossing a chunk border); mesher (one block in air = 6 faces, 24 vertices, 36 indices; two adjacent opaque blocks share no interior faces; water surface; cable arms); World (get/set across chunk borders and at negative coordinates, edits survive unload and reload, toJSON/load round trip, block:changed emitted, entity pinning). Log the average time of generateChunk and meshChunk over 30 chunks; target under 25 ms each in node - optimise if you are far above it (worldgen must not call 3D noise per voxel at full resolution: sample caves on a coarse lattice and interpolate, or equivalent).

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/world/"   and   npx vitest run src/world

### 10.3 src/render/textures
YOUR MODULE: src/render/textures/ (you own this directory and nothing else; a later engineer builds the rest of src/render and will upload your tiles to the GPU and draw item icons from them).

Deliver pure, deterministic, DOM-free pixel painters:
- index.ts exporting paintTexture(name: string): Uint8ClampedArray (16x16 RGBA, row-major, top row first), hasPainter(name: string): boolean, TEXTURE_SIZE = 16, and averageColor(name): [r, g, b] (mean of opaque pixels; the particle system uses it for debris). paintTexture must return a fresh, correctly sized array for ANY string; names without a dedicated painter get an obvious magenta/black checker so they are noticed. Results may be cached internally but callers may mutate what they get.
- A small shared palette (palette.ts) and a toolkit (canvas.ts or similar: a tiny pixel canvas with set/fill/rect/line, seeded per-texture noise so every texture is deterministic, dithering/speckle, shading helpers, outline for icons).
- One painter per entry of TEXTURE_NAMES (registry) - about 164 names: block faces and item icons. Organise by family in several files (terrain, ores, wood and plants, building blocks, furnaces, machines, cables and grid, item icons: raw materials, metals, parts, tools, gear). Build families parametrically (e.g. ore(hostRock, fleckColours, pattern), ingot(metal), plate(metal), dust(colour), tool(kind, headMetal), machineFront(variant, lit)) but give every texture its own identity - two ores must never be confusable at a glance, in the world or as an icon.

Art direction - Hearthwatt's own look, not an imitation of any other voxel game:
- Naturals are warm and slightly desaturated: mossy olive grass rather than saturated green, umber soil, ochre sand, slate-violet stone shadows, deep teal water. Low contrast inside a tile (so tiling does not strobe), stronger contrast between materials. Tiles must tile seamlessly on all four edges; avoid obvious repeating blobs; no single-pixel noise soup.
- Industry is soot and ember: fired-clay and brick furnaces with a glowing mouth (the *_on / active variants glow - dull red for the clay furnace, orange for blast, white-yellow for arc with a blue rim, violet-white plasma, and a golden star for the Starhearth), dark riveted iron casings, copper windings, and a cool electric cyan indicator on powered machines (the *_on variants light it). Each machine front must say what it does: crusher jaws, still coils and flask, bore rig drill head, centrifuge drum, electrolyzer cells, turbine blades, solar cells grid, battery terminals and charge window, thermopile fins, steam engine piston and boiler gauge, fission pile hazard core.
- Ores: host rock plus distinctive flecks - shape and colour both differ (coal: black angular chunks; copper: orange-green streaks; tin: pale silver cubes; iron: rusty bands; sulfur: yellow crystals; quartz: white-pink shards; bauxite: red-brown pisolites, i.e. round nodules; wolframite: steel-blue blades; spodumene: lilac laths; pitchblende: black-green with a faint glow; oil shale: dark laminated layers with amber seams).
- Item icons: transparent background, a 1px darker outline, lit from the top left, readable at 32px on a dark UI. Tools show their head material clearly (flint grey, bronze gold-brown, iron grey, steel blue-white, power drill distinct). Ingots, plates, wires, coils, dusts, cells, rods and circuits must be distinguishable from each other by silhouette first, colour second.
- Cutout/cross textures (tall_grass, dry_shrub, torch, leaves if the content marks them non-opaque) use full transparency for holes; ordinary block faces are fully opaque. Glass is mostly transparent with a visible frame and a few glints. Water and lava are drawn for a translucent/emissive surface.

Review your work visually - this is the main part of the job. The repository has a contact-sheet tool: \

### 10.4 UI kit (src/ui/styles.css, src/ui/kit, src/ui/menus)
YOUR MODULE: the UI foundation - src/ui/styles.css, src/ui/kit/**, src/ui/menus/** (you own these; a later engineer builds src/ui/hud and src/ui/screens on top of your kit - you do NOT build the HUD or the inventory/furnace/machine screens).

Design direction (commit to ONE dark look; this is a game, it does not follow the host theme):
- The world of the game is fire and electricity: soot, brick, iron, embers; later copper and cold electric light. Two semantic hues carry meaning everywhere: HEAT (ember amber/orange, with a temperature ramp dull red 500C -> orange 800C -> yellow 1100C -> white 1500C -> blue-white 1900C+) and POWER (a cool electric cyan). Status colours (good/warn/bad) are separate from both. Neutrals are warm-biased greys, never pure grey. Panels read as forged plate: crisp 1-2px edges, small radii (0-3px) or chamfered corners, no soft glassmorphism, no big drop shadows, no gradients-as-decoration, no emoji.
- Type: 'Chakra Petch' for display/labels, 'IBM Plex Sans' for body, 'IBM Plex Mono' with tabular numbers for every reading (temperature, watts, counts). The page already links these fonts; always give fallback stacks.
- Everything is defined as CSS custom properties on :root in src/ui/styles.css (set color-scheme: dark and an explicit body background). Class prefix: hw-. Item icons are pixel art: image-rendering: pixelated.
- PHONE FIRST. The player is probably on a phone. Touch targets >= 44px. Works at 390x844 (portrait), 844x390 (landscape, very little height!) and 1280x800. No horizontal page scroll ever. Respect safe areas: anything at a screen edge adds env(safe-area-inset-*, 0px). Windows become full-screen sheets on small viewports with their own internal scrolling. Respect prefers-reduced-motion. Visible keyboard focus.

Build (plain TypeScript + DOM, no framework):
- kit/dom.ts: a tiny typed element helper (h(tag, props, ...children)), class toggling, listener disposal helpers.
- kit/root.ts: UIRoot - creates the overlay root inside #app with ordered layers (hud, touch, windows, toasts/banners, tooltip) and exposes them.
- kit/window.ts: a modal Window (title, optional subtitle, optional header-right slot, optional tab bar, body, optional footer status line, close button; closes on Escape; onClose callback; one window at a time is enough; full-screen sheet on small viewports), and Tabs.
- kit/controls.ts: Button (primary / quiet / danger, disabled-with-reason, optional hold-to-confirm), IconButton, Toggle, Slider, Segmented choice, TextField.
- kit/slot.ts: ItemSlot (icon, count, durability bar, selected/highlight/disabled states, empty state) and SlotGrid. Icons come from an injected provider: type IconProvider = (itemKey: string) => HTMLCanvasElement | null (the rendering engineer supplies it later; until then draw a neutral placeholder tile with the item's initials). Slots report primary (click/tap) and secondary (right-click / long-press) activation; they do not implement inventory logic.
- kit/recipe.ts: RecipeRow (icon, name, requirement badges such as "900 C" or "Tier 2", ingredient chips showing have/need with clear enough/not-enough states, a disabled reason line, a Make button and a "x5" button) and RecipeList (scrollable, optional category chips, keeps scroll position when rows update). Rows must be cheap to update in place (the furnace screen refreshes them several times per second).
- kit/gauges.ts: Thermometer (vertical; fill coloured by the heat ramp; settable notches with labels for recipe thresholds; numeric readout), Meter (horizontal bar with label and value), StatFigure (big number + unit + caption), Sparkline (canvas line/area for a rolling history, two series), Badge, Chip.
- kit/feedback.ts: Toasts (stack with kinds info/good/warn/bad and optional item icon, auto-dismiss), Banner (large centred announcement used for new ages and completed objectives), Tooltip (hover on desktop, long-press on touch; never leaves the viewport).
- kit/format.ts: heatColor(tempC) -> CSS colour on the ramp, formatWatts (W / kW / MW), formatJoules (J / kJ / MJ), formatTemp, formatDuration, formatCount. Unit-test these (vitest, node environment - keep format.ts DOM-free).
- menus/title.ts: TitleScreen - the game's front door and a designed moment: the wordmark HEARTHWATT, one line of promise, buttons New World (with an optional seed field), Continue (only when a save exists), Settings, How to Play. menus/pause.ts: PauseMenu (Resume, Settings, How to Play, Save and quit to title). menus/settings.ts: SettingsPanel bound to the Settings type in src/core/context.ts (render distance, field of view, look sensitivity for mouse and touch, invert Y, volume, touch controls auto/on/off, show FPS) calling back on every change. menus/howto.ts: HowToPlay - controls for keyboard+mouse and for touch, and the core loop in five short lines (furnace is the heart; heat then watts). All menus take callbacks/options and import nothing from other game modules except src/core.
- kit/index.ts re-exporting everything.

Verify visually before you finish: write a throwaway demo page in your scratch directory (not in the repo) that mounts every component with realistic content (a mock furnace window with a thermometer, recipe rows, slots; the title screen; the pause menu; toasts; a banner), bundle it with esbuild (node /home/user/game/node_modules/.bin/esbuild ... --bundle, inline src/ui/styles.css and the same font links as src/page.html - fonts may not load in this sandbox, so the fallback stack must look fine too), and screenshot it with Playwright (const { chromium } = require('playwright') works from a .cjs script; chromium.launch() needs no options) at 390x844, 844x390 and 1280x800. Look at the screenshots yourself (Read tool) and fix what is clipped, overlapping, unreadable or generic-looking. Iterate until all three sizes look intentional. In your report's publicApi, include a short usage example for Window + RecipeList + Thermometer.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/ui/"   and   npx vitest run src/ui

### 10.5 src/player/input
YOUR MODULE: src/player/input/ (you own this directory and nothing else). A later engineer builds physics, raycasting, block interaction and the PlayerController in src/player/ on top of your input layer - you do NOT build those.

Build the input layer: one InputManager that turns keyboard, mouse and touch into a per-frame INTENT, exactly per the controls in spec section 7. THE PLAYER IS PROBABLY ON A PHONE: the touch controls must feel as good as a native mobile game.

Deliver:
- intent.ts - the Intent type: moveX (strafe, -1..1), moveZ (forward positive, -1..1; the vector is clamped to length 1), lookYaw and lookPitch deltas in radians for this frame (already scaled by the mouse/touch sensitivity and invertY from Settings), jump (held), sprint (held), mine (held), use (true on the frame it was pressed; when the button stays held, true again every 0.25 s so blocks can be placed in a row), hotbarSlot (0-8 when a number key was pressed, else null), hotbarStep (-1/0/+1 from the wheel), and edge-triggered menu flags: inventory, log, pause.
- InputManager class. constructor({ container (the #app element, receives pointer events for looking and for world tap/hold), touchLayer (element the on-screen controls are built in), settings: Settings, state: InputState, bus: GameBus }). Methods: frame(dtSeconds): Intent (returns and clears accumulated deltas/edges; returns a neutral intent while state.uiOpen or state.paused is true, and also releases every held control at that moment so nothing stays stuck); requestPointerCapture() (call from a user gesture; resolves to whether the pointer is now captured); releasePointerCapture(); setTouchVisible via settings.touchControls ('auto' = show when the device has a coarse pointer / touch points; listen for 'settings:changed'); dispose() removing every listener and DOM node.
- Keyboard + mouse: WASD and arrow keys, Space, Shift, 1-9, wheel, E, L, Escape (Escape while the pointer is locked is consumed by the browser to exit the lock - treat the resulting pointerlockchange as a pause request so one press pauses). Pointer lock on click of the container; keep state.pointerLocked accurate from pointerlockchange/pointerlockerror. If requestPointerLock is missing, throws, rejects, or errors, switch to drag-to-look: while a mouse button is held and the pointer moves more than a few pixels it rotates the view; a left press that does not turn into a drag still mines while held, and a right click still uses. Never leave the player unable to look around. Ignore keyboard events whose target is an input/textarea/contenteditable. Release all keys on window blur and visibilitychange.
- Touch (pointer events, touch-action: none, multi-touch tracked by pointerId): a FLOATING joystick - it appears where the left thumb lands anywhere in the lower-left region, follows a little if dragged past its radius, and releases on lift; pushing beyond ~90% of the radius sets sprint. Dragging anywhere else on the screen that is not on a button looks around, with a little smoothing but no lag. A short tap in the look area (under ~220 ms and ~10 px) fires use; pressing and holding still (over ~280 ms, under ~10 px) starts mine and keeps it while held, and the same finger may drag to look while mining. Buttons, sized and placed for thumbs in both portrait (390x844) and landscape (844x390): Jump (bottom right), Mine (hold) and Use above/beside it, a bag button (inventory) and a pause button at the top right. Buttons show a pressed state, never steal the look/joystick pointers of other fingers, and all three zones work simultaneously (walk + look + mine). Respect env(safe-area-inset-*). The overlay is hidden while state.uiOpen or state.paused. Ship the overlay's CSS from your module (one injected <style> element, class prefix hw-touch-), using the kit's CSS variables with fallbacks. Icons are simple inline SVG or CSS shapes drawn by you - no emoji, no icon fonts.
- Prevent the browser from interfering: no page scroll, no pinch zoom, no context menu on long-press or right-click inside the game, no text selection, no double-tap zoom; do not block interaction with UI windows (elements outside the container's game surface, i.e. events whose target is inside an element with class hw-window or hw-ui-blocking must be left alone).
- index.ts re-exporting the public API.

Structure the code so the gesture logic is testable without a browser: a pure state machine for touch gestures (pointer down/move/up with timestamps in, joystick vector / look deltas / tap / hold out) and a pure key-state reducer, with thin DOM adapters around them. Unit tests (vitest, node): joystick vector and dead zone, sprint threshold, tap vs hold vs drag classification with timing, simultaneous pointers, use auto-repeat, neutral intent + released controls when uiOpen flips, diagonal keyboard movement normalised, opposite keys cancel, hotbar keys and wheel steps, sensitivity and invertY applied.

Then verify in a real browser (spec section 6). Write a harness in your scratch directory that mounts the InputManager on #app with a visible debug readout of the live intent (move vector, accumulated yaw/pitch, held flags, counters for use/inventory/log/pause), bundle it with scripts/build.mjs --entry, and drive it with Playwright:
 1. desktop 1280x800: hold W+D and check the vector; press Space, Shift, 3, E, L; mouse-drag to look (pointer lock is unavailable headless, so this exercises the fallback); left hold = mine, right click = use.
 2. phonePortrait 390x844 and phoneLandscape 844x390 with hasTouch: use CDP for real multi-touch (const client = await page.context().newCDPSession(page); client.send('Input.dispatchTouchEvent', { type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: [{ x, y, id }] })) - joystick drag gives the expected vector while a second finger looks and a third holds Mine; tap = use; hold = mine; buttons work; nothing scrolls.
Screenshot the overlay in both phone orientations (with the joystick active) and look at the screenshots: the controls must be clearly visible over both bright sky and dark cave backgrounds (put a bright and a dark half behind them in the harness), comfortably sized, not overlapping each other or the bottom-centre area where the hotbar will sit (leave the bottom-centre ~60% width x 64px free). Fix what you see. Report the results of each check.

Check with: npx tsc --noEmit -p . 2>&1 | grep -E "^src/player/"   and   npx vitest run src/player

---------------------------------------------------------------------------------------------------------

## 11. Integration notes collected from module engineers (read before wiring main.ts)

- player: place the player at `world.spawnPoint()` + 0.5 on x and z (it returns block-corner integers).
- player: send the controller's target to `GameUI.setTarget` as well as to the renderer (same signature); call
  `input.requestPointerCapture()` from the Play / Continue button's click.
- player: scooping with the pail leaves the water block in place (water does not flow); the click that captures
  the pointer does not mine.
- textures: machines look alike as small isometric cube icons; the icon provider may show machine fronts flat.
- world: create the pool with `new WorkerPool(workerSource)` (default export of 'virtual:worker') and call
  `world.update(...)` after the player controller and before rendering; otherwise edits show one frame late.
- world: the renderer must drop meshes on 'chunk:hidden' (chunk left the view, voxels may stay loaded for machines).
- sim: call `sim.resync()` after `world.load()`. Network history, alert state and once-per-session flags are not
  saved; they restart after loading.
- sim: an idle steam engine still draws furnace heat in proportion to its available output; the player can switch
  it off. targetC in the furnace view is an estimate.
- hud: wire releasePointer -> InputManager.releasePointerCapture; intent.inventory/log/pause -> 'ui:open';
  tee IView.setTarget to GameUI.setTarget; GameUI.setIconProvider(createIconProvider()); call ui.frame(dt) every
  frame. Simulation already satisfies the HUD's UISimQuery. Full wiring notes in docs/api/hud.md.
- hud: touch has no item tooltip (long-press picks half); item descriptions show on desktop hover only.
- render: create the Renderer BEFORE the first world.update() (it builds meshes only from 'chunk:meshed' events);
  call renderer.render(dt) after world.update; catch the constructor's WebGL2 error and show the friendly message.

---------------------------------------------------------------------------------------------------------

## 12. Food, farming and animals (added at the player's request)

The player asked for: animals, a food mechanism, cooking in the furnace, farming and crops, and crafting dough
that is baked in the furnace into bread. This section REPLACES "no creatures" in pillar 4: there are now
passive animals (no hostile creatures, still no combat against the player). Everything stays original: plain
real-world animals drawn as our own blocky models, our own item names and numbers.

The design keeps the furnace at the centre: all cooking and baking happens in the furnace's crucibles, the best
meal is forged at the furnace, and electric-age tech (lamps, the crusher) feeds back into farming.

### 12.1 Hunger
- PlayerState gains `food` 0..20 (starts at 20). Saved.
- Drain per second: 1/60 (a full bar lasts ~20 min, longer than a 15-min day); x2.5 while sprinting; plus 0.03
  per block mined and 0.03 per jump. Well-Fed halves all drain.
- food <= 6: "Hungry" - cannot sprint, HUD warns once (toast) when crossing 6.
- food == 0: 1 damage every 6 s, never below 1 health (hunger alone does not kill).
- Health regeneration (spec 3.4) additionally requires food >= 12, and each health point regenerated costs 0.25 food.
- Eating: holding a food item and pressing Use (right mouse / Use button / tap the world) eats one immediately
  unless Use would plant it (see 12.4) or the crosshair is on a station/machine. Refused with a toast when food is
  full, except foods that grant a buff. 0.6 s cooldown between bites. Emits 'player:ate', sfx 'eat'.
- Well-Fed buff (from forged meals): 360 s, health regenerates twice as fast, food drain halved. HUD shows it like
  Well-Warmed.

### 12.2 Food items (ItemSpec.food = { hunger, buff?: 'well_fed', buffS? })
| item | hunger | from |
|---|---|---|
| raw_fowl | 2 | hen |
| raw_mutton | 3 | goat |
| raw_chop | 3 | boar |
| cooked_fowl | 6 | furnace |
| cooked_mutton | 7 | furnace |
| cooked_chop | 8 | furnace |
| potato | 1 | wild potato, potato crop |
| baked_potato | 5 | furnace |
| carrot | 3 | wild carrot, carrot crop |
| bread | 6 | furnace (from dough) |
| hearth_stew | 12, buff well_fed 360 s | forged at the furnace |
Non-food farm items: wheat_seeds, wheat, flour, dough, hide.

### 12.3 Cooking and baking - all at the furnace (tier 1)
Smelt recipes (one input, crucible, timed): cooked_fowl <- raw_fowl 180 C 6 s | cooked_mutton <- raw_mutton 200 C 8 s |
cooked_chop <- raw_chop 200 C 8 s | baked_potato <- potato 180 C 6 s | bread <- dough 220 C 10 s.
Forge recipes (instant at temperature, byproducts returned): hearth_stew <- 1 cooked_chop, 1 potato, 1 carrot,
1 water_pail @300 C, byproduct 1 pail (ids hearth_stew; variants hearth_stew_mutton and hearth_stew_fowl with the
other cooked meats).
Flour and dough: WORKBENCH flour <- 2 wheat (hand-ground); WORKBENCH dough <- 2 flour, 1 water_pail, byproduct 1 pail.
CRUSHER (machine) flour <- 1 wheat (twice as efficient: the electric mill).
Hide: WORKBENCH bellows_hide variant: bellows <- 4 plank, 2 hide; padded_coat_hide: padded_coat <- 4 hide, 2 cord.

### 12.4 Farming
- Hoes (ToolKind 'hoe'): flint_hoe (hand: 1 flint, 2 stick, 1 cord; tier 1, durability 64), bronze_hoe (forge
  600 C: 2 bronze_ingot, 2 stick; tier 2, 192), iron_hoe (forge 1000 C T2: 2 iron_ingot, 2 stick; tier 3, 384).
  Using a hoe on the top of grass or dirt with air above turns it into `farmland` (wears the hoe by 1; flag
  'tilled'; sfx 'till'). Hoes are not mining tools (mining with one counts as bare hands).
- farmland: cube, textures farmland_top + dirt sides/bottom, drops dirt, shovel, hardness 0.8.
- Crops: wheat, potato, carrot, each 4 stage blocks `<crop>_0` .. `<crop>_3` (shape cross, item false,
  hardness 0, placeOn ['farmland'], machine 'crop', textures `<crop>_stage0..3`). Planting = placing the seed item
  on farmland: wheat_seeds places wheat_0, potato places potato_0, carrot places carrot_0 (ItemSpec.block).
  Drops: stages 0-2 return their seed item (1); stage 3: wheat -> 1-2 wheat + 1-3 wheat_seeds;
  potato -> 2-4 potato; carrot -> 2-4 carrot. sfx 'harvest' on breaking a ripe crop, 'plant' on planting.
- Growth (src/sim, crop entities, MachineSpec kind 'crop', role 'crop'): a crop advances one stage per `stageS`
  seconds of growing time (params: stageS 100). It grows only while "lit": daytime (clock sunlight >= 0.3) with
  open sky above (no opaque block anywhere above it), OR a powered lamp within 5 blocks (any time, underground
  too - grow lamps). Hydrated (a water block within 4 blocks horizontally at the crop's y-1 or y) doubles speed.
  Needs farmland directly below, otherwise it does not grow. Ripe in 300 s hydrated in daylight, 600 s dry.
  The voxel id swaps to the next stage block (entity kept, like furnace upgrades); event 'crop:grew'.
  The machine view (status text: "Growing - stage 2 of 4", "Needs light", "Ripe") is shown nowhere special -
  crops have no screen; the HUD target name shows the stage ("Wheat (ripe)").
- Wild plants (worldgen): wild_wheat (cross; drops 1-2 wheat_seeds + 50% 1 wheat), wild_potato (drops 1-2
  potato), wild_carrot (drops 1-2 carrot); woodland and grassy frostfell edges, a few per chunk, in small
  patches. tall_grass also drops wheat_seeds 15%. Spawn guarantee adds: wild_wheat within 48 blocks.

### 12.5 Animals (src/mobs - new module, DOM-free core + render models in src/render)
CreatureSpec (src/content/creatures.ts, registry CREATURES): key, name, biomes, health, speed, size {w, h},
drops (Drop[]), likes (item keys that lure and breed it), group [min, max], model (parts as boxes with colours).
| key | name | biomes | hp | speed m/s | size w x h | drops | likes |
| hen | Hen | woodland, dunes, marsh | 4 | 2.2 | 0.45 x 0.7 | raw_fowl 1 | wheat_seeds |
| goat | Goat | frostfell, woodland | 8 | 2.6 | 0.8 x 1.2 | raw_mutton 1-2, hide 0-1 | wheat |
| boar | Boar | woodland, scar, marsh | 10 | 2.8 | 0.9 x 0.9 | raw_chop 1-3, hide 1 | potato, carrot |
- Behaviour (fixed-step AI at 20 Hz): idle / wander (pick a reachable point within 8 blocks; never step into
  liquid or a drop deeper than 2 blocks) / graze (stand, head down) / flee (when hurt: run directly away from the
  player at 1.6x speed for 5 s) / follow (player within 10 blocks holding a liked item: walk to 2 blocks from the
  player) / breed (feeding a liked item with Use makes it "eager" for 30 s, consumes 1 item, sfx 'eat'; two eager
  adults of a species within 8 blocks walk together and produce a baby after 3 s; both get a 300 s cooldown).
  Babies are half size, drop nothing, grow up after 300 s.
- Physics: AABB vs solid voxels with gravity, step up 1 block by hopping, water: float and swim to shore,
  lava/contact damage like the player. Unloaded chunks are walls.
- Spawning: the first time a chunk column is loaded, a deterministic roll (seed, cx, cz): 15% chance of one group
  of a species whose biome matches, on surface grass/snow/sand in daylight-open cells. The chunks around world spawn
  are guaranteed at least one hen group and one other group within 40 blocks. Keep-alive: if fewer than 6 adults
  are within 64 blocks of the player for 120 s of daytime, spawn one group out of sight (> 24 blocks, not in view
  direction) on matching surface. Hard cap 40 animals loaded, 300 stored.
- Persistence: every animal is saved (species, position, yaw, health, age, cooldowns). Animals in unloaded chunks
  are frozen and resume when their chunk loads. The set of chunk columns already rolled is saved.
- Combat: pressing Mine with the crosshair on an animal (ray hits its box before any block) hits it: damage 1 by
  hand, axe tier+2, pickaxe/shovel tier+1, hoe 1; 0.4 s cooldown; knockback; red flash; flee; tool wear 1.
  At 0 health it tips over for 0.6 s and its drops go straight into the player's inventory (player.give, like
  block drops). sfx 'mob_hurt' / species call. Events 'mob:hurt', 'mob:died'.
- Calls: each species makes its idle call (sfx 'hen' | 'goat' | 'boar') every 8-20 s at random, positioned.
- Rendering (src/render/mobs): each species a small box model (body, head, legs, plus beak/comb, horns,
  tusks/snout), flat-shaded with subtle per-face pixel noise in its colours; lit by the world light at its
  position (sky x sunlight, block light) like the terrain; leg swing with speed, head bob while grazing, red
  flash when hurt, tip-over on death, babies scaled 0.5. Frustum culled, no per-frame allocation.

### 12.6 Objectives added (insert in this order)
after get_warm: `cook_food` "Cook a meal" - any of make cooked_fowl / cooked_mutton / cooked_chop / baked_potato;
`eat_food` "Eat" - flag 'ate'.
after smelt_copper: `till_soil` "Till the soil" - flag 'tilled' (reward 3 wheat_seeds); `plant_seeds` "Plant
wheat" - place wheat_0.
after place_lamp (moved from after bronze_pickaxe: crops take minutes to ripen): `bake_bread` "Bake bread" - make bread.
Flags emitted by code: 'ate' (any food eaten), 'tilled'.

### 12.7 Events and sounds
GameEvents additions: 'player:ate' { item, hunger }, 'mob:spawned' { id, species }, 'mob:hurt' { id, species,
health }, 'mob:died' { id, species }, 'crop:grew' { x, y, z, stage }.
SfxName additions: eat, till, plant, harvest, hen, goat, boar, mob_hurt (src/audio must give each a patch).

### 12.8 UI
HUD: food meter beside health and warmth (drumstick-free original glyph: a small bowl), "Hungry" state, Well-Fed
indicator. Tooltips and recipe rows show "+N food" for food items. Furnace SMELT tab: cooking recipes appear in
the recipe list under a "Kitchen" chip (category Food). The target name for crops shows their stage; for animals,
their name and health.

---------------------------------------------------------------------------------------------------------

## 13. Buckets and water (player request)

- The pail becomes the BUCKET: item keys stay `pail` / `water_pail` (saves and recipes keep working) but every
  player-facing name and description says "Bucket" / "Water Bucket". Using an empty bucket on water fills it
  (sfx 'splash'). SUPERSEDED by section 18: water flows, and buckets only take source blocks. Using a water bucket on a block face pours a water block there and returns the
  bucket. A water bucket is also a fluid container for the fluid system of section 16 (a tank or fluid port
  accepts it and gives back an empty bucket, and vice versa).
- Dough REQUIRES water: dough <- 2 flour + 1 water_pail (byproduct: the empty bucket). Hearth stew also needs one.
  Tooltips and recipe rows show "returns the bucket".
- Buckets of lava: a bronze bucket (`bronze_bucket`, forge 700 C: 3 bronze_ingot) can also scoop LAVA
  (`lava_bucket`) - lava is a furnace fuel (flame 1300 C, 2 MJ, 100 s; the bucket comes back) and the fluid
  source for the geothermal tap via pipes. Scooping lava removes the lava block (lava pools are finite).

## 14. A richer world (player request: "make more of the world beyond the furnace screens")

The 3D world must be worth exploring and must feel alive; screens are where you plan, the world is where you live.
- Surface life: flowers (ember_poppy red, skybell blue, frost_lily white - cross plants, biome-specific, decor
  and dye-free), ferns in woodland shade, reeds at shorelines (cross, on sand/dirt/clay next to water), berry
  bushes (`berry_bush`, cross, drops 1-3 `wildberries`, food 2, and stays as `berry_bush_bare` that regrows in
  300 s - a crop-like entity), glowcap mushrooms on dark forest floor and cave floors (light 6, soft cyan - caves
  have their own light), cacti in dunes (contact damage 1/s, drops itself), ice spikes in frostfell, basalt
  columns and steam vents in the scar (vent: emits steam particles, warmth 3, hiss sound nearby).
- Trees with character: oaks in three sizes (bush, normal, broad old oak with a 2x2 trunk), tall and short pines,
  dead snags in the scar, palm-free dunes. Leaves sway (already in the shader).
- A new biome, MARSH: flat wetland at sea level with shallow pools, reeds, willow-shaped oaks, clay-rich ground,
  and PEAT (`peat` block, shovel, early fuel: 500 kJ, 50 s, flame 900 C - hotter than wood, before charcoal).
- Landmarks: OLD WORKS ruins - remnants of someone who tamed fire before you: crumbling stone-brick and brick
  walls, a collapsed cold furnace (decor block), rusted machine shells, and a loot crate with modest help
  (rubble, clay, copper or tin ore, coal, seeds, sometimes a bucket or a flint tool; deeper or farther ruins hold
  iron, a thermopile, cable). About one per 7x7 chunks; one is guaranteed within 96 blocks of spawn. Deterministic
  from the seed, generated chunk-order-independently like trees.
- Underground: crystal geodes (quartz_ore shell with an amethyst-free original `crystal_cluster` cross block
  inside, light 4), underground lakes, static lava falls in deep caves, ore outcrops visible on cliffs.
- Ambient motion (render only, no gameplay): fireflies at night near water and in woodland, drifting leaves under
  trees, wind-blown sand in dunes, snow flurries in frostfell, heat shimmer above lava, birds that circle high over
  woodland by day.
- MACHINES ALIVE IN THE WORLD: machines are not just textured cubes - the wind turbine has a spinning 3D rotor
  (speed follows wind), the water wheel turns, the steam engine's flywheel spins and puffs, the bore rig's drill
  turns and shakes, generators and furnaces glow, formed multiblock furnaces (section 17) look like one building
  with a roaring mouth, pipes show items moving through them (section 16). All render-only animation driven by
  the block entity state, cheap on phones (instanced / merged, culled, no per-frame allocation).

## 15. Day, night and weather (player request: "a whole dynamic day/night cycle")

The clock, sun, moon, stars, clouds and sunlight-driven lighting exist. Add:
- Moon phases: 8-day cycle; night brightness scales from 0.04 (new moon) to 0.12 (full moon); the moon is drawn
  with its phase. Stars slowly rotate. Sunrise and sunset paint the horizon on the sun's side (already partly).
- WEATHER, per world, changing every 4-12 minutes with smooth 30-60 s transitions; deterministic from the seed and
  the elapsed time so it is saved implicitly (save the current state anyway):
  clear (45%), cloudy (25%), rain (20%), storm (10%). In frostfell and high altitude rain falls as snow; in dunes
  rain becomes a dry dust wind instead.
  * visuals: cloud cover and darkness follow the weather; rain streaks / snowflakes / dust as camera-local pooled
    particles that stop under a roof (sky-light test at the camera); wet surfaces slightly darker and glossier;
    storms flash lightning (sky flash + delayed thunder by distance) - lightning is visual only, it never strikes.
  * sound: rain bed, wind gusts, thunder (new SfxName 'thunder'; ambience fields rain 0..1, storm 0..1).
  * gameplay: solar output x0.5 cloudy, x0.2 rain/storm/snow; wind turbines x1.5 in storms; rain hydrates crops
    (counts as water in reach); rain/snow adds 0.3 warmth drain per second when not under a roof; a furnace exposed
    to rain from above loses heat faster (+50% loss) - build it a roof.
- HUD: the day/night dial shows the weather glyph and the moon phase; the forecast line in the Hearth Log says
  "Rain within the hour" when the next state is rain or storm (the hearth keeper reads the sky).

### 13-15 data (laid down by the world-content pass; full tables in docs/api/world-content.md)
- Keys: blocks ember_poppy, skybell, frost_lily, fern, reeds, berry_bush, berry_bush_bare, glowcap, cactus,
  packed_ice + ice_spike (spires), basalt_column, steam_vent, peat, cracked_stone_brick, mossy_stone_brick,
  collapsed_furnace, rusted_shell, crystal_cluster (drops 1-2 silica, iron pickaxe), oil (liquid 'oil'); items
  bronze_bucket, lava_bucket (FuelSpec.fuelReturns 'bronze_bucket'), wildberries. Machine `berry_bush` (role 'bush',
  params regrowS 300); a picked bush is `BlockSpec.harvestLeaves`. The bronze bucket scoops lava only.
- Marsh: BiomeKey 'marsh'; coal and iron x1.5; hens and boars live there. Ruins: RUIN_* constants and loot tables
  'near' / 'deep' (src/content/loot.ts, `rollLoot` in the registry).
- Weather: WeatherState in src/core/types.ts, WEATHER_* / moon / lightning constants in src/core/constants.ts,
  lookups in src/core/weather.ts, events 'weather:changed' / 'weather:lightning', sfx thunder, steam_hiss, scoop_lava,
  AmbienceState rain / storm / sheltered. The first night has a full moon; solar panels need sunlight > 0.15.

---------------------------------------------------------------------------------------------------------

## 16. Item and fluid transport (player request: "pipes and item/fluid transport a la FTB mods")

Researched mechanics (BuildCraft, Thermal Dynamics, EnderIO, Mekanism, Pipez), our own design and names. Core
rules: the destination is chosen when an item leaves; travel is a timer; rendering only interpolates; items never
spill or clog; every port always shows why it is idle.

### 16.1 Blocks and items
| key | name | made | rate |
| item_pipe | Bronze Chute | forge T1 800 C: 2 bronze_ingot, 1 glass -> 8 | 1 transfer of up to 4 items every 2 s, 4 blocks/s |
| fast_item_pipe | Steel Conveyor Pipe | forge T2 1300 C: 2 steel_plate, 1 glass -> 8 | up to 16 items every 0.5 s, 10 blocks/s |
| fluid_pipe | Iron Fluid Pipe | forge T2 1000 C: 2 iron_plate, 1 glass -> 8 | 200 L/s per port, cold fluids only (water, crude oil, fuel) |
| hot_fluid_pipe | Steel Hot Pipe | forge T2 1400 C: 2 steel_plate, 1 ceramic_insulator -> 8 | 1000 L/s per port, any fluid incl. lava and steam |
| pump | Pump | forge T2 1000 C: 1 chassis, 1 copper_coil, 2 fluid_pipe | consumer 50 W; must touch a liquid block; water bodies of >= 2 blocks are endless; lava and oil blocks are removed as they are pumped (one block per 1000 L, nearest connected first, BFS <= 32) |
| tank | Tank | forge T2 1000 C: 4 iron_plate, 4 glass | 16 000 L; vertically stacked tanks share one fluid and one level |
| wrench | Wrench | forge T1 600 C: 3 bronze_ingot | configures pipe ends (16.3) |
Units: litres; a bucket is 1000 L. Pipes are shape 'pipe' (like 'cable': a core plus arms to every connectable
neighbour) - item pipes connect to item pipes and item endpoints, fluid pipes to fluid pipes and fluid endpoints;
the two families never join. Active voxel bit = carrying something (for a subtle tint).

### 16.2 Endpoints
Every inventory or tank-bearing block entity is an endpoint: crates (all slots), every machine (its input slots
accept, its output slots give), and the FURNACE with smart sides: inserted fuel goes to the firebox, smeltable items
to a free crucible input (or one with the same input), forge ingredients are not accepted, extraction only takes
finished crucible outputs. A formed hearth (section 17) exposes the same through its hatches. Fluid endpoints:
tank, pump (gives), steam_engine (takes water - piped water replaces the adjacent-water rule), electrolyzer and
fission pile (take water as coolant; piped water >= 100 L/s counts as cooled), combustion_engine (takes fuel:
1000 L of fuel = one fuel_canister of energy), still (takes crude_oil 500 L -> gives fuel 400 L, or 2 oil_shale ->
fuel_canister as before), geothermal_tap (takes lava: 1000 L runs it 600 s at full output; adjacent lava blocks
still work), furnace fluid hatch (takes lava as fuel: 1000 L = one lava bucket of fuel).
Buckets: using a bucket on a tank or a fluid endpoint fills or empties 1000 L (water, lava with the bronze bucket).

### 16.3 Pipe ends (ports) and the wrench
A pipe end touching an endpoint is a PORT with config { mode: 'push' (default: the pipe delivers into the block)
| 'pull' (the pipe extracts from the block) | 'off'; distribution: 'nearest' | 'round'; filter: up to 5 item or
fluid keys + allow/deny; priority -2..+2 }. Using the WRENCH on a pipe arm that touches a block cycles
push -> pull -> off (toast "Pulling from Blast Furnace"); using it on the centre of a pipe toggles that pipe's
connection to the targeted neighbouring pipe. Using a pipe with an empty hand (or long-press on touch) opens the
PIPE SCREEN: one row per port of that pipe's network segment near you, with the endpoint's icon, a segmented
control Push / Pull / Off, the status line ("Moving 4 every 2 s", "No destination", "Destination full", "Too hot
for this pipe"), and an expandable section with distribution, filter slots and priority.

### 16.4 Network simulation (20 Hz, phone-safe)
- Rebuild (flood fill) a family's networks only when a pipe or endpoint is placed/removed; caps: 1024 pipes and 64
  ports per network (beyond: "Network too long" warning, extra pipes inert).
- Items: each 'pull' port has a cooldown; when it fires it takes the first extractable stack that passes its
  filter, picks a destination among 'push' ports whose filter accepts the item (never its own block; priority
  first, then nearest by path length or round-robin), reserves space there, removes the items and creates a packet
  {item, count, from, to, path length, elapsed}. Arrival inserts; if the destination no longer accepts, re-route to
  the next candidate; if none, return to the source; if that fails too, the packet waits at its end and the port
  shows "Blocked". Max 48 packets per network; pulling pauses at the cap. No destination -> nothing is extracted.
- Fluids: a network holds ONE fluid and an amount, capacity 250 L per pipe. 'pull' ports drain up to the rate from
  their endpoint into the network; the network fills 'push' ports by priority, equal split inside a priority.
  Connecting two networks holding different fluids is refused (the joint stays unconnected and shows a mismatch).
  An empty network forgets its fluid. Cold pipes refuse lava and steam ("Too hot for this pipe").
- Packets and fluid amounts are saved (packets in flight are delivered to their destination on load).

### 16.5 Fluids
| key | name | colour | where it comes from |
| water | Water | blue | pump on water (endless), water bucket |
| lava | Lava | orange, glowing | pump on lava (finite), lava bucket |
| steam | Steam | white | BOILER: a new block `boiler` (forge T2 1100 C: 4 iron_plate, 2 copper_coil, 1 tank) placed directly on a furnace or hearth top: takes water, turns furnace heat into steam (needs >= 200 C; 1 L water -> 10 L steam; draws heat like a heat engine) |
| crude_oil | Crude Oil | black | pump on oil pools (new world liquid `oil`, static pools in dunes and the scar) |
| fuel | Refined Fuel | amber | still (crude_oil -> fuel) |
Steam use: a new generator `steam_turbine` (forge T3 1600 C: 1 chassis, 4 steel_plate, 4 copper_coil; 8000 W at
800 L/s steam; takes steam through a hot pipe) - the furnace-as-power-plant fantasy at scale.

## 17. Multiblock hearths (player request: "multi block furnaces ... like FTB mods")

Researched mechanics (Tinkers' smeltery cuboid scan, Mekanism free-port cuboids, Immersive Engineering formation
feedback), our own design. The furnace block becomes the HEARTH CONTROLLER. Tier 1 (Clay) stays a single block. To
run at tier 2-5 the controller must sit in the wall of a FORMED structure of that tier. Formation is automatic (no
hammer step - one less fiddly tap on a phone).

### 17.1 Structure rules
A hollow cuboid; the controller sits in a wall (a face cell, not an edge), its front facing outward; the cell
behind it is interior.
| tier | wall block (frame + faces; floor; ceiling) | interior (x*z*y) | ceiling | required parts | crucibles |
| 2 Blast | brick | 1x1x1 .. 3x3x3 | optional (an open top shows the fire) | - | min(4, x*z) + 1 |
| 3 Arc | refractory_brick | 1x1x1 .. 4x4x3 | required | >= 1 electrode in the ceiling | min(6, x*z + 1) |
| 4 Plasma | plasma_casing | 2x2x2 .. 5x5x4 | required | >= 2 power_port | min(8, x*z + 2) |
| 5 Starhearth | star_casing | 3x3x3 .. 5x5x5 | required | >= 4 power_port | 9 |
- Faces (not edges) may also be: glass (window; loses heat x2 for that cell), item_hatch, fluid_hatch,
  power_port, blower (counts as a tuyere: +25% smelting speed each, max 4; it still needs its 150 W).
  Ceilings may hold electrodes (T3+). Interior: air only.
- Structural tier = the lowest tier whose wall rules are fully met; walls of a higher tier's block also satisfy
  lower tiers (a plasma_casing wall works for a Blast hearth).
- The floor cell directly under the controller (when the furnace sits on the lowest inside layer) is walled in by the
  furnace and the ground, so it counts as frame whatever solid block stands there (grass, dirt, a lower tier's brick);
  it is never counted towards a tier. A first hearth on flat ground never needs digging under the furnace.
- The controller's effective tier = min(its own upgraded tier, structural tier). The controller is still upgraded
  in place with its upgradeCost (existing flow, objectives unchanged), but the Upgrade button additionally needs
  the structure for the next tier to be formed ("Build a Blast hearth: brick walls around the furnace").
- Interior size grants: crucibles (table), heat capacity x (interior volume)^0.5 and heat loss x (shell area / 26)
  (bigger hearths take longer to heat and cost more to keep hot; windows count double), smelting speed x
  (1 + 0.1 * (interior volume - 1)) capped at x2.
- Power: tier 3+ electric heating draws through power_port blocks (or a cable touching the controller); the hearth
  is one consumer.
- Hatches proxy to the controller: item_hatch = smart sides of 16.2; fluid_hatch takes lava (fuel) and gives
  nothing else for now; power_port joins cable networks.

### 17.2 New blocks (recipes)
| key | name | recipe |
| refractory_brick | Refractory Brick | forge T2 1300 C: 4 brick, 1 coke -> 4 |
| plasma_casing | Plasma Casing | forge T3 1900 C: 2 steel_plate, 1 aluminum_ingot, 1 tungsten_rod -> 2 |
| star_casing | Star Casing | forge T4 2800 C: 2 superalloy, 1 fused_quartz, 1 magnet_ring -> 2 |
| electrode | Arc Electrode | forge T2 1200 C: 3 graphite_electrode, 1 copper_coil |
| item_hatch | Item Hatch | forge T2 1000 C: 1 crate, 2 iron_plate |
| fluid_hatch | Fluid Hatch | forge T2 1000 C: 1 tank, 2 iron_plate |
| power_port | Power Port | forge T3 1200 C: 2 copper_coil, 2 ceramic_insulator, 1 iron_plate |
Furnace upgrade costs shrink accordingly (the structure is now most of the cost): T2 4 bronze_ingot, 1 bellows;
T3 2 copper_coil, 2 steel_plate; T4 2 circuit, 2 tungsten_rod; T5 1 star_core, 8 deuterium_cell (unchanged).

### 17.3 Validation
- Algorithm (cuboid scan, ~1100 voxel reads worst case): from the cell behind the controller walk interior air in
  the 4 horizontal directions to find the walls (max inner size of the tier + 1), check the controller's layer,
  scan down to the floor, scan up to the ceiling or until a layer stops being a wall ring; classify each cell as
  frame (edge), face, floor, ceiling or interior and check its rules; another controller in the shell fails.
  Collect up to 8 problems { code, position, text } ("Interior must be empty", "Glass cannot sit on an edge",
  "Needs 1 more Power Port", "Wall is not Refractory Brick").
- When: on any block change within the shell's bounding box + 1 (scan next tick); while unformed, every 1 s only
  if the player is within 16 blocks or the furnace screen is open; while formed, verify one shell cell every 4
  ticks (safety net).
- Unforming never destroys anything: crucibles above the new count lock (contents can still be taken out), the
  effective tier drops, the player gets a toast.

### 17.4 Feedback and rendering
- Furnace screen gains a STRUCTURE tab: status chip ("Formed - Blast hearth 3x3x2", or "Not formed"), a checklist
  (Floor, Walls, Ceiling, Electrodes 1/1, Power ports 0/2) with ticks, the problems in plain words - tapping one
  highlights that block in the world (pulsing red outline for 10 s, plus an edge-of-screen arrow when off-screen) -
  and a target-tier picker that shows the blocks needed (a materials list with have/need) and a GHOST PREVIEW: for
  the chosen tier and interior size, translucent blue cubes in the world where blocks are missing and red where
  a block is wrong. The ghost stays visible after closing the screen until the structure forms or is dismissed.
- Formed: every shell block's voxel active bit is set (glowing-seam texture variants that brighten with
  temperature); the interior shows a molten glow (a light-emitting pool at the floor whose colour follows the
  temperature heat ramp) and the hearth lights its surroundings by temperature; open tops emit heat shimmer and
  smoke; windows show the inner glow. Formation moment: a light sweep across the shell, a deep "whoomph" (new
  SfxName 'hearth_formed'), toast "Blast hearth formed".

### 16-17 data (laid down by the tech-content pass; full tables in docs/api/tech-content.md)
- Contracts: BlockShape 'pipe' with `BlockSpec.pipe` (family, ratePerS, batch, speedBlocksPerS, capacityL, hot);
  `FluidKey` / `FluidSpec` and the registry's `FLUIDS` (water, lava, steam, crude_oil, fuel - colour, hot, glow, world
  liquid, bucket); `MachineSpec.fluids` (accepts, gives, capacityL); `FurnaceTierSpec.structure` (wall, min/maxInner,
  ceiling, electrodes, powerPorts, crucible rule); `BlockTextures.bottomActive`; roles 'tank' and 'hearth_part'; events
  'hearth:formed' / 'hearth:unformed'; sfx hearth_formed, pipe_clunk; PIPE_* and HEARTH_* constants; pure hearth
  lookups in src/core/hearth.ts; registry helpers pipeJoins, pipeCarries, isItemEndpoint, isFluidEndpoint,
  hearthWallTier, fluidInBucket, bucketFilledWith, fluidOfLiquid.
- Keys: blocks item_pipe, fast_item_pipe, fluid_pipe, hot_fluid_pipe, pump, tank, boiler, steam_turbine,
  refractory_brick, plasma_casing, star_casing, electrode, item_hatch, fluid_hatch, power_port; item wrench (a tool
  with no ToolSpec). Machines pump, tank, boiler, steam_turbine, item_hatch, fluid_hatch, power_port; fluid ports on
  steam_engine, electrolyzer, fission_pile, combustion_engine, still, geothermal_tap.
- Objectives pipe_ore ("Pipe it in", after blast_furnace) and pump_water ("Pump water", after arc_furnace). The
  progression solver requires each tier's smallest shell (16 brick; 24 refractory brick + 1 electrode; 53 plasma
  casing + 2 power ports; 93 star casing + 4 power ports) to be obtainable at the previous tier.

---------------------------------------------------------------------------------------------------------

## 18. Flowing water and source blocks (player request - replaces "water does not flow" and the endless-spring bucket rule of section 13)

### 18.1 Water states (voxel encoding of the `water` block)
- variant bits (0..7) = LEVEL: 0 = SOURCE, 1..7 = flowing water, 1 strongest .. 7 weakest.
- active bit = FALLING (water dropping down a column; behaves as a strong flow when it lands).
- World generation places only sources (every existing lake, river and pool), so a freshly generated world is
  perfectly still. Water only moves after something changes next to it.

### 18.2 Flow rules (src/world, a scheduled cellular update - never a scan of the world)
- A water cell is re-evaluated when it or one of its 6 neighbours changes (block placed/broken, water arrives or
  leaves). Updates are queued with a delay of 5 game ticks (0.25 s) per step so water visibly spreads, processed at
  most 256 per tick (excess carries over), and never cross into an unloaded chunk (retried when it loads).
- Down first: if the cell below is air or a block water can wash away, water flows into it as FALLING water.
- Sideways: a source or a flowing cell of level L < 7 that is resting on something solid (or on water) spreads to
  each horizontal neighbour that is air or washable, with level L + 1 (falling water lands and spreads as level 1).
  Spreading prefers the directions that lead to the nearest drop within 4 blocks; if no drop is near, all
  directions are equal.
- Draining: a flowing cell whose feeding neighbour is gone recomputes its level from its neighbours (lowest
  neighbour level + 1, or falling if fed from above); if nothing feeds it, it disappears (levels recede over a few
  updates, not all at once).
- New sources: a flowing cell with at least 2 horizontally adjacent SOURCE cells, and a solid block or a source
  below it, becomes a source. This is what keeps lakes and two-block pools endless for buckets and pumps.
- Washable blocks (water flows into them and destroys them, no drop): tall_grass, fern, flowers, dry_shrub, reeds.
  Everything else (crops, torches, machines, pipes, cables, crates, ...) blocks the flow.
- Lava and crude oil stay still (unchanged).

### 18.3 Buckets (replaces 13: "every water block is an endless spring")
- An empty bucket can only take a SOURCE block: the ray aims through flowing water at the first source along the
  line of sight (as if flowing water were not there); taking it REMOVES the source (set to air), and the water
  around reacts (a hole in a lake refills from its neighbours by the new-source rule; a lone source is gone).
- A water bucket places a SOURCE block in the targeted cell (air, a washable block, or flowing water) and returns
  the empty bucket; the new source then flows by the rules above.
- Tanks and fluid endpoints keep working with buckets exactly as before (section 16.2).
- Pumps: a pump takes water from source blocks; a source with at least 2 adjacent sources is endless (same rule
  as before, now consistent with 18.2), a lone source is removed when pumped.

### 18.4 Rendering and physics
- Flowing water is drawn lower by level (source and falling: full height minus 2/16; level L: (8 - L) / 9 of a
  block), with sloped surfaces: each top corner takes the average height of the up-to-4 water cells around it,
  and a flowing surface scrolls its texture in the flow direction (vertex data; no new texture layers needed).
- Currents: the player and animals standing or swimming in flowing water are pushed along the flow (~1.4 m/s at
  level 1, weaker at higher levels); falling water pushes down.
- Everything that needs "water nearby" (steam engine, water wheel, crops hydration, fission cooling, electrolyzer)
  counts flowing water as water.

---------------------------------------------------------------------------------------------------------

## 19. The Emberbound - hostile automatons (player request: "war-forged, ember-fueled automatons of various
## types, as if once ago in this world the late-game items and mechanisms were more prevalent than now")

Replaces "no hostile creatures" in pillar 4. Lore (How to Play, Hearth Log, item texts): long ago this land burned
bright with machines - the Old Works were their forges. The machines outlived their makers. Some still walk,
fed by the last embers in their cores, and they wake in the dark. Everything they carry is a relic of that
age: scrap, ember cores, and now and then a part the player will not be able to make for hours.

### 19.1 The types (CreatureSpec with `hostile: {...}`; original designs, blocky like the animals, with glowing
### ember parts: eyes, vents, cores - emissive model parts)
| key | name | where / when | hp | speed | attack | drops |
| cinder_mite | Cinder Mite | caves and dark places, surface at night; groups of 2-4 | 4 | 3.2 | bite 1, 0.8 s | scrap_metal 0-1 |
| forge_warden | Forge Warden | guards ruins (placed with the ruin, persistent, active day and night within 12 blocks of its ruin); rare at night elsewhere | 16 | 2.4 | hammer 3 after a 0.5 s raise; its shield arm halves damage from the front | scrap_metal 1-3, 10% copper_coil, 4% circuit |
| kiln_sentry | Kiln Sentry | a turret on ruin walls (persistent, never moves) | 12 | 0 | lobs an ember bolt (2 damage + burning 2 s at 1/s) every 3 s at range <= 16 with line of sight; its vent glows brighter for 0.7 s before each shot | ember_core 1, scrap_metal 1-2 |
| bellows_hound | Bellows Hound | surface at night, scar biome any time it is dark; alone or in pairs | 10 | 4.5 | dash: crouches 0.8 s (bellows inhale, vents flare), then charges in a straight line, 4 damage + knockback | scrap_metal 1-2, 25% ember_core |
| arc_drone | Arc Drone | hovers over high ground during storms and on moonless nights | 8 | 3 (flies) | arc zap 2 at range <= 8 after a 0.6 s crackle; double damage if the player stands in water | scrap_metal 1, 20% copper_wire 2, 8% silicon_wafer |
| slag_colossus | Slag Colossus | rare: deep caves (y < 20) and the scar at night; at most one loaded | 60 | 1.6 | ground slam: raises both arms 1.2 s, then 6 damage within 3 blocks + knockback | superalloy 1, ember_core 3, 30% magnet_ring, scrap_metal 4-8 |
All attacks are TELEGRAPHED (a visible and audible wind-up the player can step out of) - important on a phone.

### 19.2 Behaviour (src/mobs, same manager as the animals)
- Senses: notices the player within 16 blocks with line of sight (or 6 without), forgets after 10 s out of reach.
- Moves by steering straight at the player with the animal physics (hop 1 block, swim, avoid lava; no long-range
  pathfinding - they give up and wander when blocked for 4 s). Drones fly at 2-4 blocks above ground. Sentries
  turn but never move.
- Daylight: at dawn, automatons standing under open sky WIND DOWN: they stop, their glow dims, they go dormant (do
  not attack, take normal damage, wake if hit) and despawn when > 48 blocks from the player. Ruin guards and
  sentries keep watch in daylight but only inside their ruin.
- They never enter the WARM ZONE of a furnace that is at least 200 C (its warmth radius): they halt at its edge
  and turn away - the hearth is the safe heart of the base, at every stage of the game.
- Projectiles: ember bolts arc (gravity), are visible (glowing, trailing sparks), hit the first solid block or
  the player, never break blocks.
- Damage to the player goes through PlayerState.damage with new causes 'automaton' and 'ember' (burning).

### 19.3 Spawning
- Difficulty setting (Settings + New World option): Peaceful (no hostiles; objectives that need combat
  complete themselves), Normal (default), Hard (x1.5 caps, x1.25 damage).
- Night/dark spawning near the player: every 2 s, if fewer than the cap (Normal 10 loaded hostiles), try one spot
  24-40 blocks away on a solid floor with block light < 7, never in sunlight by day, not within the warm zone of a
  hot furnace, not within 32 blocks of a powered ward_beacon, not in view of the camera; pick a type by place
  (cave/surface/scar/storm/high ground/depth) and weights. Despawn when > 64 blocks away (except ruin guards).
- Ruins (src/world features): each Old Works ruin gets 1-2 forge_wardens and, on half of the ruins, a kiln_sentry
  on a wall, created once when the ruin's chunk first loads (like its loot crate), saved, never respawned.
- Light matters: torches and lamps (block light >= 7) prevent spawns around them.

### 19.4 Fighting back
- Mine on a hostile attacks it (same as animals): hands 1, tools as for animals, and new WEAPONS - mauls, made for
  breaking metal (they do not mine faster):
  bronze_maul (forge T1 700 C: 4 bronze_ingot, 2 stick) 5 damage | iron_maul (forge T2 1100 C: 4 iron_ingot,
  2 stick) 7 | steel_maul (forge T2 1400 C: 4 steel_ingot, 2 stick) 9 | arc_maul (forge T3 1800 C: 2 steel_plate,
  1 copper_coil, 1 ember_core, 1 battery) 12 and stuns automatons for 1 s.
  Attack cooldown 0.5 s (tools 0.4 s), durability like tools. Hits knock back, flash, clang.
- ARMOUR (worn from the inventory like the padded coat; the best one counts): plated_coat (forge T2 1100 C:
  6 iron_plate, 1 padded_coat) -25% damage and keeps the coat's warmth; steel_cuirass (forge T2 1400 C: 6 steel_plate,
  1 padded_coat) -40%.
- WARD BEACON (machine consumer, 500 W; forge T3 1500 C: 2 ember_core, 1 circuit, 2 steel_plate, 1 glass): no
  hostile spawns within 32 blocks while powered; existing hostiles avoid its radius like a warm zone.
- New items: scrap_metal (smelts into iron_ingot at 1150 C, T2), ember_core (fuel: 3 MJ, 120 s, flame 1700 C -
  the hottest early fuel, and a component), the mauls, the armour, ward_beacon. Relic drops (coil, circuit,
  wafer, superalloy, magnet ring) are existing items.
- Objectives (insert): after `make_bronze`: `forge_maul` "Forge a maul" (make bronze_maul); after the first night
  objective (`get_warm`) is fine for flavour but the combat one is `salvage_automaton` "Salvage an automaton" (flag
  'automaton_salvaged', or completes itself on Peaceful) placed after `bronze_pickaxe`; after the tier-3 objective:
  `ward_base` "Ward your base" (place ward_beacon).
- Death by automaton: the death screen names the type ("Felled by a Forge Warden").

### 19.5 Presentation
- Models from CreatureSpec boxes with emissive ember parts that flare before attacks; dormant ones are dark; a
  small spark/smoke emitter on each active automaton; break-apart on death (debris in their colours, sparks).
- HUD: target name + health for hostiles ("Forge Warden - 9/16"), a subtle red screen-edge pulse in the direction
  of an attacker that hit you (directional damage indicator), a danger hint when a telegraphed attack is coming
  from off-screen (edge arrow).
- Sounds (new SfxName): automaton_step (heavy clank, positioned), automaton_wake (whirr up), automaton_windup
  (rising hiss/inhale), automaton_attack (metal impact), ember_bolt (launch whoosh), arc_zap, automaton_hurt
  (clang), automaton_break (crash and tinkle); music-free.

### 19 data (laid down by the emberbound-content pass; full tables in docs/api/emberbound-content.md)
- Contracts: `CreatureSpec.hostile` (HostileSpec + HostileHabitat with SpawnPlace weights), `CreaturePart.emissive`, anims
  legML/legMR/armL/armR; automatons are the registry's `AUTOMATONS` (not `CREATURES`). Weapons are tool kind `'maul'` (mines
  like a hand) plus `ItemSpec.weapon { damage, stunS? }`; armour is `ItemSpec.armour { reduction, warmthDrainMult? }` (the
  padded coat has one too). `Settings.difficulty` and `Settings.uiScale`. Causes 'automaton' / 'ember', events
  `hostile:*`, `player:attacked`, `projectile:*`, `automaton:salvaged`, the eight sfx; every number of 19.2-19.4 is a
  HOSTILE_* / RUIN_* / EMBER_BOLT_* / WARD_BEACON_RADIUS / WEAPON_HIT_COOLDOWN_S constant; pure lookups in src/core/hostile.ts.
- `ward_base` sits after `make_circuits` (the beacon needs a circuit). Flags the code emits: 'automaton_salvaged' (an
  automaton broken apart by the player) and 'peaceful' (a session on Peaceful), which completes salvage_automaton and ward_base.

---------------------------------------------------------------------------------------------------------

## 20. Steam and shafts - mechanical power before electricity (player request)

The furnace boils water, steam turns a rotor, rotation travels through axles and gearboxes to machines that need
motion. Watts come later: in the Forge Age a DYNAMO turns shaft rotation into electricity. This moves first
electricity from the Ember Age to the Forge Age and gives the Ember Age its own mechanisms.

### 20.1 Model (src/sim, a MECHANICAL network beside the electrical one, same solver shape)
- Every block with `mech` ('shaft' | 'source' | 'consumer') joins a shaft network with its connected neighbours.
  Axles connect only along their axis (axis stored in the voxel: facing bits N/S = z, E/W = x, variant bit = y);
  gearboxes, sources and consumers connect on all six sides.
- Units: TORQUE in N*m. Each source offers torque, each consumer needs torque. Per tick: supply S (sum of running
  sources), demand D (sum of consumers switched on and with work), rating R (lowest axle rating in the network),
  f = D > 0 ? min(1, min(S, R) / D) : 1. Consumers run at speed x f and stall below 0.25. The network's SPEED
  (0..1, for animation and readouts) = f when D > 0, else 1 if S > 0. Overload never breaks anything: the shaft
  just turns slower and the HUD/machine screens say "Overloaded - add a source or a stronger axle".
- Shown to the player as "Torque 120 / 200 N*m" and a turning speed in rpm (60 rpm x speed).

### 20.2 Blocks (content numbers - the content engineer may tune them, documenting why)
| key | name | age | made | role |
| kettle | Copper Kettle | Ember | forge T1 600 C: 3 copper_ingot, 1 bucket | sits ON a furnace; holds 4000 L water (filled by bucket, an adjacent water block, or a pipe); boils 20 L/s into steam while the furnace is >= 120 C, drawing 3 kW of furnace heat at full boil |
| steam_rotor | Steam Rotor | Ember | forge T1 650 C: 2 copper_ingot, 2 tin_ingot, 1 plank | source: touches a kettle (or a steam pipe later); 120 N*m at 20 L/s steam, proportionally less |
| wooden_axle | Wooden Axle | Ember | workbench: 3 plank -> 4 | shaft, rated 150 N*m |
| bronze_gearbox | Bronze Gearbox | Ember | forge T1 700 C: 2 bronze_ingot, 1 wooden_axle | shaft junction, all six sides, rated like the weakest attached axle |
| iron_axle | Iron Axle | Forge | forge T2 1000 C: 1 iron_ingot -> 2 | shaft, rated 1000 N*m |
| steel_axle | Steel Axle | Current | forge T2 1300 C: 1 steel_ingot -> 2 | shaft, rated 6000 N*m |
| water_wheel | (existing) | Ember | (existing recipe moves to the workbench + 2 copper_ingot) | becomes a MECHANICAL source: 30 N*m per flowing-water neighbour (flow matters now that water flows), max 90 |
| steam_engine | (existing) | Forge | (existing) | becomes a MECHANICAL source: 600 N*m on top of a furnace, fed water as before |
| millstone | Millstone | Ember | workbench: 4 stone_brick, 1 wooden_axle | consumer 40 N*m: wheat -> flour (1:1, 2 s), copper_ore / tin_ore -> 2 crushed (4 s) - early ore doubling |
| saw_bench | Saw Bench | Ember | forge T1 600 C: 2 bronze_ingot, 4 plank | consumer 30 N*m: 1 log -> 6 plank (2 s) |
| mech_bellows | Shaft Bellows | Ember | workbench: 1 bellows, 1 wooden_axle, 2 plank | consumer 20 N*m: holds an adjacent furnace's draft at >= 0.7 (the hand-pumped bellows, automated) |
| trip_hammer | Trip Hammer | Forge | forge T2 1100 C: 4 iron_ingot, 1 bronze_gearbox, 2 stone_brick | consumer 120 N*m: 2 ingots -> 1 plate (iron, steel), 3 s |
| dynamo | Dynamo | Forge | forge T2 1000 C: 2 copper_coil, 1 iron_axle, 2 iron_plate | consumer of torque AND electrical generator: converts up to 400 N*m into up to 2000 W (5 W per N*m) - the bridge to the electric grid |
All four machines have an input and output slot (pipes and crates work with them like every machine).

### 20.3 Progression changes
- Thermopile moves to Forge Age (forge T2) so the Ember Age has no electricity; the first-power objective moves
  after the Blast hearth and accepts a dynamo or a thermopile.
- New Ember Age objectives after `smelt_copper`: `boil_water` "Boil water" (place kettle), `first_motion`
  "Set it turning" (a steam rotor running), `grind` "Grind" (a millstone job). Forge Age: `first_power`
  "Make electricity" (generate 100 W) placed after `blast_furnace`.

### 20.4 Presentation
- Axles, gearboxes, rotors, the water wheel, millstone, saw and trip hammer TURN in the world, at the network's
  speed (instanced machine parts like the wind turbine; the axle block itself is drawn by the parts renderer so
  it can spin). Steam puffs from a boiling kettle and a running rotor. Stalled shafts stop; overloaded shafts
  turn slowly and creak.
- Machine screens show the shaft network: torque supply/demand/rating, speed, members. The HUD power strip shows
  shaft power when the player stands near a shaft network.

### 20.5 DECIDED by the player: the Ember Age is the age of steam and mechanics - speed and stress
This replaces the torque-only model of 20.1 and settles decision 1 (no electricity in the Ember Age; the
thermopile moves to the Forge Age).

Two quantities on every shaft network:
- SPEED in rpm. Each source turns at its own speed (Steam Rotor 32 rpm at full steam, less with less steam;
  Water Wheel 16; Windmill 8-24 with the wind). A network runs at the speed of its fastest source; slower
  sources still add their capacity.
- STRESS: every source adds CAPACITY, every working machine adds LOAD. A machine's load = its base stress x
  (network speed / 16). If load > capacity the network is OVERSTRESSED: it seizes (speed 0, a groan, everything
  on it stops) until load is removed or capacity added. Nothing is destroyed. Capacity: Steam Rotor 256,
  Water Wheel 64 per flowing side (max 192), Windmill 32-128, Steam Engine (Forge) 1024, Steam Turbine
  (Current) 4096.
- GEARS trade speed for load: a Large Cog meshed with a Small Cog doubles speed (and every machine downstream
  then costs double stress) or halves it, depending on which side drives. Chains of gear pairs stack, capped at
  256 rpm. Axles themselves have no limit in the Ember Age; material tiers limit SPEED instead: wooden parts
  shatter-proof but capped at 64 rpm, iron 128, steel 256 (faster input is simply clamped).
- Machines have a MINIMUM speed and work faster above it (rate = speed / minimum, up to x4):
  Millstone min 16, stress 4 | Saw Bench min 32, stress 4 | Shaft Bellows min 8, stress 2 (draft grows with
  speed: 0.5 at 8 rpm to 1.0 at 64) | Mechanical Pump min 16, stress 4 (50 L/s per 16 rpm - water without
  electricity) | Mechanical Drill min 32, stress 8 (mines the column below, 1 block per 4 s at 32 rpm) |
  Trip Hammer min 16, stress 8 (bronze plates in Ember, iron and steel later) | Draft Fan min 32, stress 2
  (a blower for hearth walls, +25% smelting speed) | Dynamo (Forge) min 64, stress 16, 30 W per rpm up to 2 kW.
- Control and reading blocks: Clutch (a lever block: disconnects a shaft; Use toggles), Gearshift (reverses - only
  matters for future direction-sensitive machines; skip in v1), Flywheel (adds no capacity; keeps the network
  turning for 10 s when steam drops, so a dying fire does not seize the line), Speed Gauge and Stress Gauge
  (blocks with a needle readable in the world; the machine screens show the same numbers).
- Recipes (Ember unless noted): wooden_axle (workbench 3 plank -> 4), small_cog (workbench 2 plank, 1 stick ->
  2), large_cog (workbench 4 plank, 1 wooden_axle), bronze_gearbox (forge 700 C: 2 bronze_ingot, 1 wooden_axle;
  6-way junction), clutch (workbench: 1 wooden_axle, 1 stick, 1 cord), flywheel (forge 700 C: 4 bronze_ingot,
  1 wooden_axle), speed_gauge / stress_gauge (forge 600 C: 1 copper_ingot, 1 glass, 1 small_cog),
  mech_pump (forge 700 C: 2 bronze_ingot, 1 item_pipe, 1 small_cog), mech_drill (forge 800 C: 4 bronze_ingot,
  2 flint, 1 large_cog), draft_fan (workbench: 4 plank, 1 small_cog), others as 20.2.
- Ember objectives: boil_water - first_motion - grind - gear_up ("Gear it up": a network above 32 rpm) -
  saw_planks - auto_bellows ("Let the shaft breathe for you": shaft bellows running).

---------------------------------------------------------------------------------------------------------

## 21. The Bronze Age - pressure, pneumatics and moving heat (player request; inserts a new age)

Player: "we should have a fully separate bronze age with pneumatics and pressure mechanics and steam boilers and
steam engines etc. forge era will be more advanced smelting, heavy factory stuff/machines still. there should be
thermocouple blocks in the bronze era that can move heat when connected to a heated source".

SIX ages now: 0 Ember - 1 Bronze - 2 Forge - 3 Current - 4 Atomic - 5 Star. SIX furnace tiers:
1 Clay Furnace (800 C) - 2 Bronze Furnace (1100 C, NEW) - 3 Blast (1500) - 4 Arc (2100) - 5 Plasma (3200) -
6 Starhearth. Every existing `minTier >= 2`, tier objective, hearth structure rule and age index shifts up by one.

### 21.1 What each early age is about
- EMBER (clay furnace): fire, copper, tin, food, and SIMPLE turning: kettle + steam rotor (open, unpressurised
  steam), water wheel, windmill, wooden axles and cogs, millstone, saw bench, shaft bellows. Speed and stress.
  Ends by smelting bronze.
- BRONZE (bronze furnace): PRESSURE. Sealed boilers, steam under pressure in pipes, piston steam engines,
  compressed air and pneumatic machines, and THERMOCOUPLES that carry heat away from the furnace to where it
  is needed. No electricity.
- FORGE (blast hearth): iron and steel, the multiblock hearth, heavy factory machines (rolling mill, drop forge,
  big trip hammers, crusher), and at its end the dynamo: first electricity.

### 21.2 Bronze Furnace (tier 2)
Upgrade in place from the Clay Furnace: 8 bronze_ingot, 4 firebrick, 1 bellows at 700 C. Single block (no
structure yet - the Blast hearth is the first multiblock). 1100 C, 2 crucibles, 2 fuel slots, heat capacity 220,
loss 2.2. Recipes that move here from the old tier 1/2: bronze tools stay Ember; everything in 21.3-21.5 is made
here. Iron still needs the Blast hearth (1150 C).

### 21.3 Heat network - thermocouples
- `thermocouple` (bronze rod block, shape like a pipe: core + arms): joins a HEAT network with touching
  thermocouples, heat sources and heat users.
- Sources: a furnace or formed hearth at >= 200 C (offers heat at its temperature), lava (1300 C, 2 kW per face),
  later a fission pile jacket. Users: kettle, boiler, `hot_plate` (cooks food and dries without a furnace:
  crucible-less cooking recipes at up to the delivered temperature, 1 slot), `heat_vent` (warmth radius 6:
  heated rooms far from the furnace), `drying_rack`-free v1.
- Rule per network per tick: each user asks for watts; total drawn from the hottest source first; every
  thermocouple block in the path loses 2% (the network's delivered temperature = source temperature x
  0.98^(blocks on the shortest path), delivered watts likewise); a network carries at most 6 kW (bronze),
  later `iron_thermocouple` 20 kW. Heat drawn is added to the source furnace's heat extraction, like the kettle.
  So: the furnace is still the only origin of heat, but boilers and kitchens can stand a few blocks away.
- Touching a thermocouple carrying more than 300 C burns (1 damage/s, cause 'burn'). They glow by temperature
  (the heat ramp) - you can see heat travel.

### 21.4 Steam under pressure
- `boiler` (existing block, re-timed to Bronze): sealed vessel, heated by standing on a furnace OR by a heat
  network. Water in (bucket, pipe, mech pump). Makes steam into its STEAM NETWORK.
- Steam network = boiler(s) + `steam_pipe` (bronze; the existing hot fluid pipe becomes the steel upgrade) +
  users. State: PRESSURE in bar (0-12). Volume = 100 L per pipe + 2000 L per boiler + `steam_tank` 8000 L.
  Each tick: pressure rises with steam made / volume and falls with steam used; boilers boil faster when hot
  (rate = heatW / 2260 kJ per kg, scaled to game units: 1 kW -> 6 L/s of steam at 1 bar).
- Users need a minimum pressure and use more steam at higher pressure, giving more output:
  `steam_engine` (piston engine; mech source: rpm = 16 x bar up to 96, capacity = 128 x bar; min 2 bar),
  `steam_hammer` (direct steam trip hammer, min 4 bar), `steam_whistle` (decor/alarm), `air_compressor` (below).
- Safety: bronze boilers and pipes are rated 8 bar. `safety_valve` (set 2-8 bar with Use) vents above its
  setting with a shriek and a plume. No valve and pressure above 8 bar for 5 s -> the weakest part BURSTS
  (explosion radius 2, scalding 6 damage, the block is destroyed, a warning hiss and a shaking gauge start at
  7 bar). `pressure_gauge` block shows bar with a needle. This is the Bronze Age's signature danger.

### 21.5 Pneumatics
- `air_compressor` (mech consumer min 32 rpm, stress 8, or steam-driven): fills an AIR network (bronze
  `air_tube` + `air_tank` 4000 L) to up to 6 bar.
- Air users: `pneumatic_tube` item transport - items shoot through air tubes fast (replaces the Bronze Chute as
  the Bronze-age item pipe: 16 items per 0.5 s while the network holds >= 2 bar, each transfer uses air);
  `pneumatic_press` (plates and wire from ingots, 2 s, min 3 bar), `pneumatic_drill` (mines the column below
  2x faster than the mech drill, min 3 bar), `air_hammer` hand tool (a bronze-age power tool: mines like an iron
  pickaxe, holds 60 charges, refilled by Use on an air tank), `blast_nozzle` (hearth wall part: forced air,
  counts as two tuyeres - the reason the Blast hearth reaches 1500 C: REQUIRED for the tier 3 structure).
- Leaks: an open-ended air tube vents (hiss, pressure falls) - cap ends or close the loop.

### 21.6 Forge Age re-centred on heavy industry
Blast hearth (brick shell + at least one blast_nozzle fed with air). Iron, steel, coke. `rolling_mill`
(plates x2 yield, mech 64 rpm, stress 32, iron axles), `drop_forge` (tools and machine parts from plates
without the forge chill, steam 6 bar), crusher (shaft or steam driven), `iron_thermocouple`, steel steam pipes
(16 bar), steel axles. The age ends with the DYNAMO and copper cable: first watts, lamps, the acid battery.
The thermopile stays a Forge item.

### 21.7 Objectives (Bronze Age chain)
bronze_furnace (tier 2) - move_heat (place a thermocouple network that feeds a user) - seal_boiler (a boiler
making steam) - read_pressure (place a pressure gauge) - fit_valve (place a safety valve) - piston_power
(a steam engine turning) - compress_air (an air network at 2 bar) - pneumatic_post (an item arrives by
pneumatic tube) - press_plates (pneumatic press job) - blast_nozzle (make one) -> Forge: blast_furnace.

### 21.8 DECIDED by the owner: the Bronze Furnace stays a single block; the STEAM BOILER is the first multiblock
"bronze furnace will be what it is and the steam boiler will be the first separate multiblock". This replaces the
single-block `boiler` of 21.4 for the Bronze Age (the old one-block boiler becomes the Ember KETTLE's role only).

- Structure: a hollow cuboid of `boiler_plate` (bronze casing; forge T2 800 C: 2 bronze_plate -> 2), standing
  anywhere - it is NOT built around the furnace. Interior 1x1x2 up to 3x3x4 (x*z*y), always closed (floor, walls,
  roof). Controller: `boiler_gauge_glass` in a wall face (shows the water level in the world; Use opens the
  boiler screen). Required wall parts: >= 1 `heat_port` (a thermocouple network connects here - heat still comes
  only from the furnace or lava), >= 1 `water_port` (bucket or pipe in), >= 1 `steam_port` (steam pipe out).
  Optional in the roof: `safety_valve` (setting 2-8 bar). Glass is not allowed (pressure vessel).
- Size grants: water capacity 2000 L per interior cell; steam volume 1000 L per interior cell; heat intake limit
  6 kW per heat_port; rated pressure 8 bar (bronze plate) - iron plate later 16 bar.
- Formation: automatic, same cuboid scan and feedback as the hearth (reuse `src/sim/hearthScan.ts` by making its
  scan take a rule set: wall blocks, part kinds, interior rule, ceiling rule); active bit on formed shell
  blocks; Structure tab on the boiler screen with checklist, problems, ghost preview.
- Burst (21.4) applies to the whole vessel: above rated pressure for 5 s with no working valve -> the shell
  blows out (radius 3), the plates drop as items (half are lost), scalding 6 in radius 4.
- Running dry: heating an empty formed boiler for 20 s warps it (unforms; one plate cracks into scrap) -
  warning text and a rattle from 5 s on. Keep the water port fed (mech pump).
- Objectives: `seal_boiler` becomes "Build a steam boiler" (a formed boiler); the rest of 21.7 unchanged.
- The Forge Age Blast hearth is then the SECOND multiblock the player builds, with the same language of
  shells, ports and the Structure tab.

<!-- ======================== END docs/SPEC.md ======================== -->


---

<!-- ======================= BEGIN README.md ======================= -->
# FILE: README.md

# Hearthwatt

A first-person voxel sandbox about heat, power and the furnace at the centre of your base.

You start with bare hands in a woodland. Everything you become runs through one block: the furnace. It is
where you smelt and forge, it keeps you warm through the night, it is your first generator and later the
largest machine on a power grid you build from wood, coal, wind, water, sunlight, oil, lava and uranium.
The game ends when you turn it into a star.

Animals (hens, goats, boars) are passive: you hunt them for food and hide, and you can raise your own, but
nothing hunts you and there is no combat. The world itself is the danger: cold nights and rain, hunger, long
falls, deep water, lava, radiation and reactors you forgot to cool.

## Play

```
npm install
npm run build         # dist/index.html + dist/game.js (dist/artifact.html for hosts that supply the page)
node scripts/build.mjs --serve    # serves dist/ on http://localhost:5173 (any static file server works)
```

`npm run dev` rebuilds on change and serves the game on http://localhost:5173.

The game runs in any browser with WebGL2, on desktop and on phones; without WebGL2 it says so instead of
starting. Progress is saved in the browser: when you enter a world, every 30 seconds, when you pause, when you
switch away from the page, and on "Save and quit". Continue on the title screen picks up exactly where you
left. Inside a page that blocks storage the game still runs, warns you once, and keeps your world until the
page is closed. A save that cannot be read (or comes from a newer version) is kept as a backup and never
overwritten unless you start a New World; a full storage never deletes the last good save.

## Controls

| | Keyboard and mouse | Touch |
|---|---|---|
| Move | W A S D | left thumb stick |
| Look | mouse (click the view to capture it) | drag on the right half |
| Jump / swim up | Space | Jump button |
| Sprint | Shift | push the stick to its edge |
| Mine | hold left mouse button | hold the Mine button, or press and hold on the world |
| Use / place / eat / feed an animal | right mouse button | Use button, or tap the world |
| Place a block against a furnace or machine | Shift + right mouse button (machines, pipes, cables, tanks and hearth walls also go on any side but the front without Shift) | arm the Place button, then Use |
| Pick hotbar slot | 1-9 or mouse wheel | tap the slot |
| Inventory and hand crafting | E | bag button |
| Hearth Log (goals) | L | tap the goal tracker |
| Pause / close a screen | Esc | pause button |
| At the furnace: pump the bellows / show the backpack | P / B | Pump button / Backpack handle |
| Set a pipe end to Push, Pull or Off | Use with the wrench on the pipe | the same |
| Open the pipe screen (what flows, filters, priority) | Use on a pipe with an empty hand | the same |

Screens use the same slot rules everywhere: click (tap) a stack to pick it up, click (tap) where it goes;
right-click (long-press) takes half; shift-click (double-tap) or the "To ..." buttons move it straight across.
Switching away from the page pauses the game.

## How the game works

**The furnace is your crafting table.** A workbench exists: it builds your first furnace and a few
wooden things, and everything you can make by hand can be made there too. Nearly every other recipe is forged at the furnace. Recipes are a list: pick one, see what you
have and what you need, make it. Rows you cannot make yet tell you why: the fire is not hot enough, or the
furnace needs its next upgrade.

**Fire first.** Fuel has a flame temperature: sticks 450 C, logs 650 C, charcoal 1000 C, coal 1250 C,
coke 1550 C. Pump the bellows to push a fire up to 250 C hotter while burning fuel faster. Ores are loaded
into crucibles and smelt over time while the furnace stays hot enough; tools, parts and machines are forged
on the spot, and every forging takes a little heat out of the fire.

**Then watts.** Bolt a thermopile onto the furnace and its heat becomes your first electricity. A steam
engine on top turns more heat into more power, and now the same fire has to choose between power and steel.
Water wheels, burner generators, wind turbines, solar panels, combustion engines and geothermal taps follow.
Cables join machines into networks; every cable type has a limit, and batteries cover the gaps.

**The furnace grows with you.** It is upgraded in place five times, and each tier begins an age (six ages in all). The Bronze Furnace is still one block;
every upgrade after it needs a formed hearth around the furnace first: walls of the right block with enough room inside. The
furnace's Structure tab shows the plan, marks every missing block in the world and says what is wrong; then the
upgrade panel asks for the parts and the heat below.

| Furnace | Age | Reaches | Heated by | Needs |
|---|---|---|---|---|
| Clay Furnace | Ember | 800 C | wood, charcoal | built at the workbench |
| Bronze Furnace | Bronze | 1100 C | wood, charcoal, coal | no hearth; 8 bronze ingots, 4 firebrick, a bellows, fire at 700 C |
| Blast Furnace | Forge | 1500 C | coal, coke, bellows | Blast hearth (brick); 4 bronze ingots, a bellows, fire at 700 C |
| Arc Furnace | Current | 2100 C | fuel, or 8 kW of electricity | Arc hearth (refractory brick, a ceiling, an Arc Electrode); 2 copper coils, 2 steel plates, 1200 C |
| Plasma Furnace | Atomic | 3200 C | 40 kW of electricity | Plasma hearth (plasma casing, 2x2x2 inside, 2 Power Ports); 2 circuits, 2 tungsten rods, 1900 C |
| Starhearth | Star | - | 300 kW held for 90 seconds to ignite | Star hearth (star casing, 3x3x3 inside, 4 Power Ports); the star core, 8 deuterium cells, 3000 C |

A bigger hearth also gives the furnace more crucibles.

**Come home at night.** Nights are cold, and rain or snow under open sky chills you faster, day or night;
the frostfell is cold even by day. At 0 warmth the cold hurts. Any roof overhead keeps the rain off, and a
fire, a torch or a hot furnace warms everything around it. Time spent beside the furnace leaves you
Well-Warmed: faster at mining and slower to freeze. The HUD warns you, with the cause, as warmth falls, and a
short line under the bars says what to do ("Soaked: find a roof", "Hungry: eat something"). Your
last furnace is home: the compass points to it, and it is where you wake up if the world gets the better of
you, with everything you carried.

**Weather.** Each world has its own sky: clear, cloudy, rain and storms that drift in and out (the first day
and night are always dry). In the frostfell and up high the rain falls as snow, in the dunes as dust. Rain
cools a furnace that stands under open sky, and storms bring lightning.

**Food and hunger.** The food bar runs down as you work and faster when you sprint. Hold food and press Use to
eat it. Cooked food fills far more than raw: meat, potatoes and dough cook in the furnace's crucibles (the
Kitchen chip on the Smelt tab), and a hearth stew forged at the furnace makes you Well-Fed. Hungry, you cannot
sprint; below 12 food you do not heal; an empty bar slowly wears your health down.

**Farming and animals.** A hoe turns grass or dirt into farmland. Wheat seeds (from tall grass), potatoes and
carrots grow on it in daylight or lamplight, twice as fast with water within four blocks; aim at a crop to see
how long it has left. Mine an animal to hunt it. Hold what it likes and it follows you: hens like wheat seeds,
goats wheat, boars potatoes and carrots. Press Use on an animal to feed it; feed two of a kind near each other
and they raise a young one. Animals you have fed stay tame. Animals keep clear of lava and cacti, and the wild
herd refills as you explore.

**Buckets, water and bread.** Water flows: it runs downhill, spreads up to seven blocks and drains away when
its source is gone. A bucket takes one source block out of still water (a lake refills the gap, a lone puddle
does not) and pours it back out as a new source. Four wheat grind into two flour at the workbench, two flour and
a bucket of water make dough, and dough bakes into bread at 220 C. A bronze bucket can carry lava, which also
burns as furnace fuel and hands the bucket back.

**Pipes and the wrench.** Bronze chutes carry items, iron fluid pipes carry water and oil, and steel hot pipes
carry steam and lava. Use the wrench on a pipe where it meets a crate, a furnace or a machine to cycle that end through
Push, Pull and Off; use it between two pipes to part or join them. Use a pipe with an empty hand to open the
pipe screen: what flows, filters and priorities. Pumps draw water, lava or oil; a boiler on a hot furnace makes
steam for a steam turbine (set the pipe end at the boiler to Pull). Hatches and power ports built into a hearth
wall feed the furnace through its walls. Breaking a full crate or machine puts what fits in your pack and leaves
the rest in a crate where it stood.

## Development

```
npm run typecheck   # TypeScript, strict
npm test            # unit tests (vitest)
npm run build       # dist/game.js + dist/index.html
npm run e2e         # drives the built game in headless Chromium (needs Playwright)
```

`npm run e2e` (about 15 minutes on software WebGL) runs three scripts. `scripts/e2e.mjs` plays the opening of
the game on desktop, a portrait phone and a landscape phone with real keyboard, mouse and touch input (mine
logs, craft, place a workbench and a furnace, fuel and light it, smelt, forge, save, reload, Continue), then
checks a sandboxed page (no storage, no pointer lock) and a browser without WebGL2; `--device=desktop|phonePortrait|phoneLandscape|sandbox`
picks one, `--no-build` reuses dist/. `scripts/e2e-features.mjs` hunts, cooks and eats, tills, plants, bakes
bread, scoops and pours lava and water and checks rain. `scripts/e2e-tech.mjs` builds a Blast hearth brick by
brick, pipes ore into it with the wrench and uses buckets on a tank. Screenshots land in `test-results/e2e*/`. In the page, `window.__hw` is a debug handle (state summary, give,
teleport, setTime, tick, save...).

| Directory | What lives there |
|---|---|
| `src/core` | shared types, the content registry, the event bus, gameplay constants |
| `src/content` | every block, item, recipe, machine, furnace tier, ore vein and objective, as data |
| `src/world` | terrain generation, chunks, lighting, meshing, the chunk worker |
| `src/game` | inventory, crafting, mining rules, survival and hunger, day and night, weather, objectives |
| `src/sim` | the furnace, hearths, power networks, machines, pipes, crops |
| `src/mobs` | animals: spawning, behaviour, feeding and breeding, saving |
| `src/render` | procedural textures, the three.js renderer, sky, particles, item icons |
| `src/player` | keyboard, mouse and touch input, physics, block interaction |
| `src/ui` | the HUD and every screen |
| `src/audio` | synthesised sound |
| `src/save` | saving and loading |
| `src/app`, `src/main.ts` | boot, title, loading, the game loop and the wiring of everything above |

All textures are painted in code and all sound is synthesised; the repository contains no asset files.
Game balance lives in `src/content` and `src/core/constants.ts`.

<!-- ======================== END README.md ======================== -->
