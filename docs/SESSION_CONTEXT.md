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
