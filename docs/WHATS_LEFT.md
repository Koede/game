# Hearthwatt - what is left to do (2026-11-21)

Update 2026-11-26: several items below are done (marked **DONE**). For the current plan-versus-code status read
`docs/plans/lookback-2026-11-26.md` and the briefs in `docs/plans/renormalize-2026-11-25.md`.

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
~~Rig screen and ghost previews~~ **DONE** (`src/ui/screens/distill/rigScreen.ts`); ~~reflux head and filter bed~~ **DONE**;
~~lubricant consumer~~ **DONE** (`lubricant_canister` halves chainsaw bar wear, `src/game/felling.ts`); ~~`distill:step` event~~ **DONE**
(emitted, no listener yet). Still open: ground burner (charcoal or fuel ethanol without a furnace); bitumen and asphalt road blocks with a speed effect; potions
(essences, tinctures, elixirs tied to the brewing buffs), drinks and the antiseptic bandage; tank support for the new fluids and
pipes out of a receiver into tanks end to end; shaft hooks (stirrer, lubricant stress); catalyst bed, pressure cap, cracker and
the refinery tower multiblock; own sounds, a Codex progression branch, a balance pass.

## 5. Handwork, brewing, food - `docs/api/handwork*.md`, `casting.md`, `sugar.md`
Casting Bench block is inert (pouring happens at the furnace); hand-taking molten metal for anvil hot work (the hot window
opens on `cast:poured`); ~~sap-tap state is not saved~~ **DONE** (saved as `extras.sap`,
`src/player/sapTools.ts`), the tap still has no animation or particles; a boiling pail's seconds-left
is lost when moved by `Inventory.add`/spill; more baked goods and a sugar-aware brewing/alcohol tie-in; the clay table/cup
decision above.

## 6. Smaller known gaps (collected from every session's report)
Rack under glass keeps running (confirm intent); crops whose farmland is removed stay without growing; steam engine draws heat
when idle; ~~UI size setting (Normal/Large)~~ **DONE** (`Settings.uiScale`); Structure tab shift buttons and machines list; pump status wording; boiler/turbine
hint texts; the steam-plan item names (copper_kettle vs kettle_pot, mech_pump recipe item). See `docs/SESSION_CONTEXT.md` section 6.

## 7. Process notes for whoever continues
- Run everything locally; `HW_GPU=1` renders e2e on a real GPU, `HW_DIAG=1` and `?diag=1` give diagnostics (`docs/SESSION_CONTEXT.md` section 9).
- Several sessions shared one checkout: give each disjoint files, commit often, and use the `.gate-heavy` lock folder before any
  `npm run build`, full vitest or e2e (`docs/lanes/FOUNDATION.md`, `scripts/lib/lock.mjs`). Pause everything before merging upstream.
- Pointer lock is refused in automation-driven browser windows; test the real cursor in a normal browser.
- Regenerate the handoff bundle with `bash scripts/make-handoff-bundle.sh HEARTHWATT_COMPLETE_HANDOFF.md`.

## 8. Known e2e flakes seen after W0 (not furnace-related)
`node scripts/e2e.mjs` (GPU): "mines four logs by holding Mine" (phoneLandscape, pack held 2 logs) and, in the sandboxed-frame run,
"save and quit keeps the world in memory; Continue restores it: inventory not restored from memory" (a pickup lands between the two
state reads). Both are timing in the real-input mining steps; the Bronze upgrade step and the furnace/hearth steps passed on all devices.
The rest of the e2e chain (features, tech, ember, handwork, ground, vehicles, dev, distill, magic, workshop) was NOT run after W0.
