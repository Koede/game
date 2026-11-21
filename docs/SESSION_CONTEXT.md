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
