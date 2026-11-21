# Steam and mechanics - implementation plan

> **MOVED TO THE BRONZE AGE (owner: "again, steam is a bronze age thing"; "ember era should feel very manual").**
> Everything in this file - kettle-driven rotor, axles, cogs, speed and stress, shaft machines, water wheel,
> windmill - is now the FIRST HALF OF THE BRONZE AGE, built on the Bronze Furnace (tier 2), before the boiler
> and pressure of `docs/BRONZE_PLAN.md`. Read every "Ember" below as "early Bronze" and every "tier 1" recipe as
> tier 2. The Ember Age itself is handwork: `docs/EMBER_PLAN.md`. The mechanics, numbers, algorithms and
> pseudocode here are otherwise unchanged.

For the engineer (or model) who builds this. Design intent: `docs/SPEC.md` 20 and 20.5 (20.5 wins where they
differ) and `docs/PROGRESSION.md`. This file is the HOW: contracts, files, algorithms, numbers, tests, order,
and the traps already met in this codebase. Nothing here is built yet.

Player's words: "a basic steam power mechanic that happens in world and allows blocks like a turbine to get
rotation (animated texture) and then any axle block connected to it can move that rotation, and if connected
to another machine that needs rotation it will provide that power ... early game mechanisms through steam
power -> mechanical energy ... at some point the steam power will be able to be harnessed for Wattage but that
will be a later step" and "ember age is dominated by steam power and mechanical energy and stress and rotation
speed and all that". Ember Age has NO electricity.

## 0. Ground rules that already hold in this repo

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
- Checks: `npm run typecheck`, `npm test` (about 1350 tests), `npm run build`, `npm run e2e` (about 15 min;
  three scripts chained with `&&`: e2e.mjs, e2e-features.mjs, e2e-tech.mjs, plus e2e-ember.mjs once the
  Emberbound wiring lands). Under CPU load phone taps can read as holds; rerun alone before believing a failure.
- Visual work is verified in the built game in headless Chromium: build to a scratch `--out` dir, drive with
  `scripts/lib/browser.mjs` and `window.__hw` (see `docs/api/integration.md`), LOOK at the screenshots.
- Docs: each module has `docs/api/<name>.md`; add `docs/api/mechanics.md` and update the HANDOFF table.

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
  `kettle_boil` (ambience would be better than one-shots for the boil: add `steam: 0..1` to AmbienceState).
- constants.ts: `MECH_BASE_RPM = 16`, `MECH_MAX_RPM = 256`, `FLYWHEEL_COAST_S = 10`, `KETTLE_HEAT_W = 3000`,
  `KETTLE_BOIL_L_PER_S = 20`, `KETTLE_MIN_TEMP_C = 120`.
- registry: `mechOf(def)`, validation (sources have rpm+capacity; consumers minRpm+stress; cogs have cog).

## 2. Content (numbers to start from)

| key | role | numbers | recipe | age |
|---|---|---|---|---|
| kettle | machine role 'boiler'-like, on a furnace | 4000 L water, boils 20 L/s at >= 120 C, draws 3 kW heat pro rata | forge T1 600: 3 copper_ingot, 1 pail | 0 |
| steam_rotor | source | 32 rpm, capacity 256, needs 20 L/s steam from a touching kettle (pro rata on both) | forge T1 650: 2 copper_ingot, 2 tin_ingot, 1 plank | 0 |
| water_wheel [change] | source | 16 rpm, capacity 64 per FLOWING water neighbour (variant > 0 or falling), max 192; no electricity | workbench: 12 plank, 2 copper_ingot | 0 |
| windmill | source | 8-24 rpm and capacity 32-128 by `windAt` and altitude, open sky | workbench: 8 plank, 4 cord, 1 wooden_axle | 0 |
| wooden_axle | axle | maxRpm 64 | workbench: 3 plank -> 4 | 0 |
| small_cog / large_cog | cog | maxRpm 64 | workbench: 2 plank, 1 stick -> 2 / 4 plank, 1 wooden_axle | 0 |
| bronze_gearbox | junction (6 sides) | maxRpm 128 | forge T1 700: 2 bronze_ingot, 1 wooden_axle | 0 |
| clutch | clutch | Use toggles engaged | workbench: 1 wooden_axle, 1 stick, 1 cord | 0 |
| flywheel | flywheel | coast 10 s | forge T1 700: 4 bronze_ingot, 1 wooden_axle | 0 |
| speed_gauge / stress_gauge | gauge | needle | forge T1 600: 1 copper_ingot, 1 glass, 1 small_cog | 0 |
| millstone | consumer | minRpm 16, stress 4; recipes: wheat->flour 1:1 2 s; copper_ore/tin_ore -> 2 crushed 4 s | workbench: 4 stone_brick, 1 wooden_axle | 0 |
| saw_bench | consumer | minRpm 32, stress 4; oak_log/pine_log -> 6 plank 2 s | forge T1 600: 2 bronze_ingot, 4 plank | 0 |
| mech_bellows | consumer | minRpm 8, stress 2; draft = lerp(0.5, 1.0, (rpm-8)/56) on touching furnaces | workbench: 1 bellows, 1 wooden_axle, 2 plank | 0 |
| trip_hammer | consumer | minRpm 16, stress 8; 2 ingots -> 1 plate (bronze_plate NEW item, iron, steel) 3 s | forge T1 800: 4 bronze_ingot, 1 large_cog, 2 stone_brick | 0 |
| mech_pump | consumer + fluid source | minRpm 16, stress 4; 50 L/s per 16 rpm; same source-block rules as `pump` | forge T1 700: 2 bronze_ingot, 1 item_pipe, 1 small_cog | 0 |
| mech_drill | consumer | minRpm 32, stress 8; mines the column below, 4 s/block at 32 rpm, toolTier 2, 9-slot buffer | forge T1 800: 4 bronze_ingot, 2 flint, 1 large_cog | 0 |
| draft_fan | consumer, hearth wall part | minRpm 32, stress 2; counts as a tuyere (+25% smelting) | workbench: 4 plank, 1 small_cog | 0 |
| iron_axle | axle | maxRpm 128 | forge T2 1000: 1 iron_ingot -> 2 | 1 |
| steam_engine [change] | source | 64 rpm, capacity 1024, on top of a furnace/hearth, water by pipe/pump; no electricity | recipe loses the copper coils: 1 chassis, 4 iron_plate, 2 glass | 1 |
| dynamo | consumer + electrical generator | minRpm 64, stress 16; W = min(2000, 30 x rpm) x satisfaction; power 'device' | forge T2 1000: 2 copper_coil, 1 iron_axle, 2 iron_plate | 1 |
| crusher [change] | electrical consumer OR mech consumer | adds mech minRpm 32, stress 16; runs on whichever is present | unchanged | 1 |
| thermopile [change] | moves to forge T2 (minTier 2); loot table 'deep' only | | 1 |
| steel_axle | axle | maxRpm 256 | forge T2 1300: 1 steel_ingot -> 2 | 1 |
| steam_turbine [open decision 2] | source | 128 rpm, capacity 4096 at 800 L/s steam | unchanged | 2 |
| alternator [if decision 2 = convert] | consumer + generator | minRpm 128, stress 64; 80 W per rpm up to 20 kW | forge T3 1500: 4 copper_coil, 1 steel_axle, 2 steel_plate, 1 circuit | 2 |

Objectives (ids, in order, Ember): after `smelt_copper`: `boil_water` (place kettle), `first_motion`
(flag first_motion: any source turning), `grind` (machine_job of millstone - use flag `millstone_job`);
after `make_bronze`: `gear_up` (flag geared_up: a network above 32 rpm with a working machine), `saw_planks`
(make plank at saw - flag), `auto_bellows` (flag shaft_bellows). Forge: move `first_power` and `place_lamp`
to after `blast_furnace`; text names the Dynamo. Rewards: boil_water 4 wooden_axle; first_motion 2 small_cog.

Solver changes (`progression.ts`): Ember Age must not rely on any electricity; the Ember objectives need the
kettle, rotor, axle and millstone obtainable at tier 1; first electricity requires a dynamo (needs the steam
engine or enough rotor speed through gears: 32 rpm x 2 = 64) or a thermopile at tier 2. The crusher is
reachable by shaft at tier 2. Add a test: "no item with `power` or a generator role is obtainable before
furnace tier 2".

Textures: every new block face and icon, plus bronze_plate. Art direction as before (docs/api/textures.md):
wood-and-bronze machinery for Ember, iron for Forge. Kettle: copper drum with a riveted lid and a sight glass.

## 3. Simulation (src/sim)

New files: `mechGraph.ts` (network build), `mech.ts` (solve + machines), `mechViews.ts`, `kettle.ts`, tests.
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

**Kettle** (`kettle.ts`, a `Behaviour` like the boiler in `fluidMachines.ts` - read it first; reuse `fluidIn`
for water and `rateL`): on top of a furnace or a formed hearth's roof (use the same "furnace below" lookup as
steam_engine/boiler in `surroundings.ts`, including hearth shell proxies). Fills from a touching water block
(endless only if that source has two source neighbours - same rule as pumps), buckets (`bucketUse` already
handles fluid endpoints if the spec has `fluids.accepts: ['water']`) or pipes. Boils `KETTLE_BOIL_L_PER_S x
demandFraction` while furnace temp >= `KETTLE_MIN_TEMP_C`, where demandFraction = steam the touching rotors can
use; heat drawn = `KETTLE_HEAT_W x demandFraction` added to the furnace's `extractW` (heat engines already draw
by power USED - follow that path in `furnace.ts` / `machines.ts`). No steam is stored: rotor drive = boil rate
available to it / 20, shared equally between touching rotors.

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

**Changes to existing machines.** `water_wheel`, `steam_engine` (and `steam_turbine` if decision 2 = convert)
lose `role: 'generator'` / `power: 'device'` and become mech sources. Old saves: on `resync()` (after
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
recipe rate at 1x and 2x speed; mech bellows draft; dynamo watts and that Ember Age has zero watts; water wheel
on still vs flowing water; save/load mid-run identical; perf (200 mech blocks, 10 networks < 0.2 ms/tick).
Extend the playthrough: before bronze the scripted player builds kettle + rotor + axle + millstone and grinds
flour and crushed ore; in the Forge Age makes first electricity with a steam engine + cogs + dynamo.

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
- Screenshots to review: a kettle and rotor on a lit clay furnace driving a millstone through a corner
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
- Codex page: regenerate from the registry (scripts in the session scratchpad are not in the repo - the
  extraction is 40 lines: bundle `src/core/registry` + `src/render/textures` with `scripts/lib/bundle.mjs`,
  dump items, recipes, blocks and PNG data URIs; consider adding it as `scripts/codex-data.mjs`).

## 6. Order of work (each step leaves `npm test` green)

1. Core contracts + content + solver + roster + textures + sounds (one engineer; the thermopile and wheel/
   engine moves break `playthrough.test.ts` - give the scripted player stand-ins and mark them, as was done
   for food and hearths).
2. In parallel: (a) sim mechanics + playthrough for real; (b) world shapes + render parts; (c) UI panel + HUD
   + How to Play. They meet only through `docs/api/mechanics.md` written FIRST by (a) (views, render snapshot,
   callbacks) - commit that note within the first minutes.
3. Wiring (player callbacks, app, audio ambience) + `scripts/e2e-steam.mjs` on desktop and phonePortrait:
   place kettle on a lit furnace, fill with a bucket, place rotor, axle, millstone; flour comes out; add a
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
- Open decisions (see PROGRESSION.md 6): steam turbine as shaft source + alternator (plan: yes), Star hearth
  casing count.

## 8. State of the repo when this was written

- Branch `ccr-3c8b169f-e78nk2` (only branch; no PR possible until a base branch exists).
- Released artifact = commit 2c247eb (flowing water, review fixes). After it: Emberbound data, AI, combat
  rules, ward beacon and safe zones are merged and tested; Emberbound step 3 (render, UI, wiring + e2e-ember)
  was IN PROGRESS in three background runs - check `git log`, `docs/api/emberbound-*.md` and HANDOFF.md to see
  what landed, finish what did not, run the full e2e, then republish the artifact.
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

What follows from them (design law for the steam layer):
- IN THE WORLD: every conversion is a block you can see working. No hidden menus doing the work. If a number
  matters (rpm, stress, steam) there is a way to read it by looking at a block, not only on a screen.
- THE FURNACE IS THE BOILER'S HEART: steam always starts from furnace heat. No standalone coal boiler, ever.
  More machines = more steam = a hungrier fire = more reasons to stand at the furnace.
- EARLY, NOT LATE: a player should have something turning within 15 minutes of lighting the first fire.
- WATTS ARE EARNED: electricity appears in the Forge Age, made FROM rotation. The dynamo is a celebration.
- THE OLD WORLD HAD ALL THIS: ruins should show it - broken axles, a seized rusted gearbox, a dead dynamo.
  Add to ruin generation: decor blocks `rusted_axle`, `rusted_cog` (drop 1 scrap_metal with a pickaxe), and a
  rare ruin variant "mill ruin" by water with a broken wheel. Forge Wardens' hammer arm IS a trip hammer.

## 10. The Ember Age as it is played (the experience to build toward)

Minute by minute, a first-time player on a phone, following only the goal tracker:
- 0-8: wood, planks, workbench, flint pickaxe, rubble, clay. Night falls around minute 10.
- 8-14: Clay Furnace placed and lit; charcoal; first night by the fire (Well-Warmed); cook a boar chop; eat.
- 14-20: copper ore, 700 C with bellows or charcoal, first ingots. Goal: "Boil water".
- 20-24: forge the KETTLE (3 copper, bucket). Tap it onto the furnace top. Fill it with the bucket (the lake
  refills; a lone puddle would not). The lid starts to rattle, steam puffs, a soft boil sound. The furnace
  thermometer shows a new notch: "Kettle 3 kW". Goal: "Set it turning".
- 24-28: forge the STEAM ROTOR, place it against the kettle: it spins up over about 2 s, paddles visible. Toast:
  "32 rpm". Workbench: wooden axles, a millstone. Lay 3 axles from the rotor, set the millstone on the end: the
  axles turn, the runner stone turns, wheat goes in, flour comes out twice as cheaply. Goal "Grind" done.
- 28-40: bronze. Saw bench wants 32 rpm (fine) but the shaft bellows + millstone + saw + trip hammer together
  ask more stress than one rotor has: the line SEIZES - everything stops with a wooden groan, the stress gauge
  needle is in the red, the HUD says "Line seized - 280 of 256 stress". The player learns: open a clutch,
  or add a second rotor (the kettle has four sides), or dig a channel so flowing water turns a wheel.
  Gears: a large cog driving a small one doubles the saw's speed and its stress cost.
- 40+: brick walls around the furnace: the Blast hearth forms. The kettle sits on its rim; later the boiler.
What must be true for this to feel right (acceptance for the whole feature):
1. Kettle + rotor + 3 axles + millstone works with only Ember materials, on a phone, guided by goal texts.
2. The first seize is understandable without reading docs: sound, stopped parts, a gauge, a status sentence
   that names the numbers and two ways out.
3. Standing at the furnace you can SEE your machines turning from it.
4. The fire visibly matters: let it die and the rotor slows, the flywheel carries the line 10 s, then it stops
   (not a seize - status "No steam - the fire is low").
5. Nothing electrical is craftable or lootable before the Blast hearth (test in the solver).

## 11. Exact work items with acceptance checks

Numbering = order. "AC" = acceptance check that must be automated unless marked (look).

**W1 - contracts, content, art, sound (one engineer, nobody else in the repo)**
1. `src/core/types.ts`: MechSpec, MechRole, BlockSpec.mech / BlockDef.mech, MachineRole 'mech', BlockShape 'axle'
   and 'cog', `axleVoxel(id, face)`, `axleAxis(voxel): 'x'|'y'|'z'`. AC: unit tests for axis round trip.
2. `src/core/constants.ts`, `gameEvents.ts` (events, flags as constants `FLAG_FIRST_MOTION` etc., SfxNames,
   AmbienceState.steam is in `src/audio` not core), `registry.ts` (`mechOf`, validation in a new
   `src/core/mechValidation.ts` like `hostileValidation.ts`). AC: validateContent() [] and mutation tests
   (a source without capacity fails).
3. `src/content`: new file `blocksMech.ts`, `itemsMech.ts` (bronze_plate), recipes in `recipesMech.ts`, machine
   specs in `techMech.ts`, objectives inserted, loot tables (thermopile only in 'deep'; add small_cog, wooden_axle
   to 'near'), ruin decor `rusted_axle`, `rusted_cog`. Move thermopile recipe to tier 2; water_wheel recipe to the
   workbench; steam_engine recipe without coils; remove `power`/generator role from wheel and engine.
   AC: content tests green; new solver test "no electricity before tier 2"; objectives satisfiable in order.
4. `specRoster*.ts` second copy + `progression.ts` (mech sources/consumers; millstone crushed ore counts as an
   ore-doubling route at tier 1). AC: "game completable" and "completable on Peaceful" still pass.
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

**W4 - review and release**  six-angle review, verify, fix, full suite, rebuild, republish game + Codex,
update README (controls: clutch; features: steam and shafts), HANDOFF release state, PROGRESSION "built" tags.

## 12. Ready-to-paste briefs

Each engineer gets: the common preamble (read HANDOFF.md, docs/SPEC.md incl. its working rules, src/core, every
docs/api note; scratch dir; quality bar; write your docs/api note; commit only your paths; attribution line)
plus ONE of these. The chain workflow used all session takes `{ model, effort, tasks: [{ label, brief }] }`.

- `steam:content` - "FEATURE DATA: steam and mechanics. Read docs/STEAM_PLAN.md completely - sections 1, 2, 9,
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

## 13. The Bronze Age has its own plan

The owner added a separate Bronze Age (pressure, pneumatics, thermocouples, the steam boiler as the first
multiblock). Everything about it - design, numbers, algorithms, work items, briefs - is in `docs/BRONZE_PLAN.md`.
What it changes HERE: this file now covers the EMBER mechanics only (kettle, rotor, wheel, windmill, wooden
axles and cogs, gearbox, clutch, flywheel, gauges, millstone, saw bench, shaft bellows, mech pump, mech drill,
draft fan, bronze trip hammer). The steam engine, boiler and pressure move to Bronze; iron/steel axles, crusher
drive, thermopile and the DYNAMO move to Forge (still built as written in sections 2-3, just later in the tier
order). Do the six-tier refactor (BRONZE_PLAN W0) BEFORE any wave of this file.


## 14. Pseudocode for the hard parts (Ember mechanics)

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

### 14.3 Kettle and rotor coupling (`kettle.ts`)
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


## 15. Owner decisions after this plan was written

- **Steam turbine:** "shaft source in ember era and bronze era, a modern steam turbine can be made in a later
  era that can convert direct to electricity". So: every steam device of the Ember and Bronze ages (steam
  rotor, piston steam engine) is a SHAFT source. The existing `steam_turbine` block stays a Current-age DIRECT
  generator exactly as it is built today (steam in, watts out, no shaft). Remove the `alternator` and the
  "steam turbine as shaft source" rows from section 2 and from PROGRESSION; the dynamo (Forge) remains the only
  shaft-to-watts bridge.
- **Kettle gives boiling water** for brewing (BREWING_PLAN 11.3): Use with an empty container on a boiling
  kettle fills it.
