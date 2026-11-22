# Hearthwatt - complete handoff bundle

One file with everything needed to continue the game in a fresh session. Generated 2026-11-22T00:16Z from commit 8bfb3f0 on branch ccr-3c8b169f-e78nk2 of https://github.com/Koede/game.
Order: 0 session context (state, open decisions, follow-ups) - 1 how to start locally (setup, phases, first message) - 2 current status - 3 whole-game progression - 4 Ember plan - 5 Brewing plan - 6 Steam plan - 7 Bronze plan - 8 Distillery plan and the API notes of the newest features - 9 full design spec and build rules - 10 README.
The other per-module API notes live in the repository under docs/api/*.md and are NOT included here (read them as you reach each module).

## Contents
1. `docs/SESSION_CONTEXT.md`
2. `docs/WHATS_LEFT.md`
3. `docs/LOCAL_HANDOFF.md`
4. `HANDOFF.md`
5. `docs/PROGRESSION.md`
6. `docs/EMBER_PLAN.md`
7. `docs/BREWING_PLAN.md`
8. `docs/STEAM_PLAN.md`
9. `docs/BRONZE_PLAN.md`
10. `docs/DISTILLERY_PLAN.md`
11. `docs/api/sugar.md`
12. `docs/api/dev-mode.md`
13. `docs/api/distillery.md`
14. `docs/api/ground-items.md`
15. `docs/api/chainsaw.md`
16. `docs/api/handwork-front.md`
17. `docs/SPEC.md`
18. `README.md`


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
- repo still has five furnace tiers until W0 (six-age refactor) runs
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
3. Six-age refactor (BRONZE_PLAN W0): commit an old-save fixture FIRST, renumber tiers/ages, migrate saves, add the single-block Bronze Furnace. Full e2e.
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
4. Roadmap unchanged: six-age refactor (BRONZE_PLAN W0: commit an old-save fixture FIRST), Steam first half, Bronze second
   half, review pass, republish game and Codex.
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
7. W0 six-age refactor: only `src/magic/ageMap.ts` needs its table changed for these pieces.

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
1. Six-age refactor (BRONZE_PLAN W0): commit an OLD-SAVE FIXTURE first, renumber tiers/ages everywhere, save migration, add the
   single-block Bronze Furnace. Several new items are gated by tier today (vacuum pump, chainsaw, workshop parts, magic ages) and
   have notes saying where to move them when W0 lands (`docs/api/ground-items.md`, `docs/api/chainsaw.md`, `OVERHAUL_PLAN` age tables).
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

<!-- ======================== END docs/WHATS_LEFT.md ======================== -->


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

Note on numbering: the game today has five ages and five furnace tiers. The Bronze Age inserts a new second
age and a new tier 2 (BRONZE_PLAN work item W0 renumbers everything).

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

### Age 1 - Bronze (Bronze Furnace, to 1100 C) - about 45 minutes  [planned, BRONZE_PLAN]

- **Furnace:** still one block; 1100 C, two crucibles.
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
3. BRONZE_PLAN W0 - six tiers and ages (pure refactor, with a save migration).
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

**W0 - six tiers and ages (alone in the repo; before anything else, also before STEAM_PLAN's waves)**
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
> `vacuum_pump` below. Until W0 it is made at the tier-1 furnace; after W0 move its recipe to `forge(2, ...)` and give it `age: 1`.
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
- Recipe: Clay Furnace forge at 800 C: 4 bronze plate, 2 leather, 1 bellows, 2 copper plate. **Gate:** the code still has five tiers and ages; the Bronze Furnace (tier 2 after BRONZE_PLAN W0) does not exist, so the pump is made at the tier-1 furnace from Ember crafts and documented as a Bronze Age tool. After W0 move it to `forge(2, 'hand_vacuum', ...)` and set `age: 1` in `itemsGround.ts`. No objective yet (a "Gather from afar" goal fits after the Bronze Furnace goals).
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

**Current Age** (PROGRESSION "Age 3 - Current"; `age: 2` and forged at furnace tier 3 in today's five-age numbering, the
six-age renumbering (BRONZE_PLAN W0) bumps both like every other `age:`/`minTier`).

- It needs an *engine*. The only engine in the game that runs on a liquid fuel is the Combustion Engine, forged at the
  Arc Furnace, and the only liquid fuel is the **Fuel Canister** from the Still (Current). A chainsaw is that engine on
  a handle, so it belongs where the engine and its fuel do.
- Not Ember: the age is manual handwork with no machines (owner decision, docs/LOCAL_HANDOFF.md section 2); the Chopping
  Block and the axe are the Ember answer to trees.
- Not Bronze/Forge: steam devices drive shafts and are not portable, there is no fuel to carry before the Still, and
  Forge is about iron and heavy factory machines. (A pneumatic saw on an air tank would suit Bronze if the owner wants
  one earlier; it would be a second item, not a change to this one.)

Recipe (Arc Furnace, 1300 C): `1 chassis, 2 steel_plate, 1 copper_coil, 1 circuit`. Objective `fell_tree` ("Fell a
tree", flag `felled_tree`, age 2) sits right after Ward your base.

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

**The furnace grows with you.** It is upgraded in place four times, and each tier begins an age. Every
upgrade needs a formed hearth around the furnace first: walls of the right block with enough room inside. The
furnace's Structure tab shows the plan, marks every missing block in the world and says what is wrong; then the
upgrade panel asks for the parts and the heat below.

| Furnace | Age | Reaches | Heated by | Needs |
|---|---|---|---|---|
| Clay Furnace | Ember | 800 C | wood, charcoal | built at the workbench |
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
