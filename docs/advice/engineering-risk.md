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
