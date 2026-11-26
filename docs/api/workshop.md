# Bronze workshop (src/workshop) - API note

Design: `docs/OVERHAUL_PLAN.md` part A (Create-style, adapted). The planned shaft core of STEAM_PLAN (axles, cogs,
mechGraph/mech) is NOT built; this module is a self-contained kinetic layer that it can feed later through `extraRpm`.

## Content (`src/content/itemsWorkshop.ts`, `recipesWorkshop.ts`, fixture `specRosterWorkshop.ts`)
Blocks: `hand_crank`, `drive_shaft`, `conveyor_belt` (slab, oriented), `mech_saw` (chopping_block recipes, full blade yield),
`mech_millstone` (hand_quern), `mech_mortar` "Stamp Mill" (mortar, with its bonus chance), `mech_loom` (loom). Item:
`engineer_goggles`. All age `ageIndexOf('bronze')` (= 1 since BRONZE_PLAN W0) and all forged at the Bronze Furnace (`forge(2, ...)`: the six that were workbench recipes - crank, shaft, belts, millstone, loom - are furnace recipes at 400-500 C now). The eleven workshop goals sit in the Bronze Age after `bronze_furnace` (`docs/api/ages.md`). Faces/icon: `src/render/textures/iconsWorkshop.ts`.

## Runtime (`workshop.ts`, class `Workshop`, owned by `Game`, saved with `world.persist('workshop')`)
- Parts join on all six sides into networks (BFS each tick, capped 512). A network turns at `CRANK_RPM` 16 while a crank in it
  was Used in the last `CRANK_S` 2.5 s (holding Use repeats). Capacity `CRANK_CAPACITY` 8 su per turning crank; `STRESS`:
  belt 0.25, saw/millstone/mortar 4, loom 2. Over capacity: overstressed, stops, one toast.
- The voxel ACTIVE bit mirrors turning (faces `*_on`).
- Belts move ground items lying on them away from the side they were laid from (`-facing`), `BELT_SPEED` 1 block/s at 16 rpm,
  centred on the belt. At the end a mechanical station in front takes the items in; any other solid block stops them.
- Stations take items lying on their top or put in by Use (held stack, up to `MACHINE_BUFFER` 16), work one stroke recipe in
  `strokes x STROKE_S` (0.5 s) at 16 rpm and drop the output out of their front as ground items. Broken: contents dropped.
- `use(x,y,z, held, takeHeld)` (called first in `Interaction.beforeUse`; a held block is never eaten: null so it is placed),
  `tick(dt)`, `netAt`, `describe(x,y,z)` ("Millstone - 16 rpm, load 4.25/8 su, Flour 40%, holds 2 Wheat"), `toJSON/load`,
  `verify()` (drops saved parts whose block is gone; Game calls it every 200 ticks), `extraRpm` hook.
- `inspector.ts`: `inspect(probe, x,y,z)` for Engineer's Goggles (carried anywhere in the pack): workshop part, else furnace heat
  and fire, else machine status and watts. Game shows it as the crosshair name.

## Tests and checks
`src/workshop/workshop.test.ts` (belt carries and stops, belt into millstone, top intake + Use, overstress, held block, save);
`node scripts/e2e-workshop.mjs [--no-build] [--device=...]`, chained in `npm run e2e`.

## Rotation (src/workshop/kinetics.ts, pure solver; Workshop owns state)
Sources: `hand_crank` (16 rpm, 8 su while Used), `clockwork_motor` (24 rpm, 48 su, Use winds 30 s, max 120 s), and the generator blocks
`water_wheel` (12 rpm), `wind_turbine` (16), `steam_engine` (24) that touch a shaft: capacity = their watts / 50 su (`generatorWatts` hook,
Game feeds it from `sim.machineView().outW`). Speed is signed (right/left). It flows outward from the sources; a part hands it on to every
neighbour it did not receive it from, after: `reverse_box` negate, `ratio_dial` x0.5/1/2/3 (Use cycles), `governor` cap 32/64/96, `clutch` Use
engages/releases (released passes nothing), `sequence_gearshift` loop programs (3, Use cycles), `worm_gear` /8. `chain_sprocket` (range 16) and
`belt_pulley` (range 9, size 1/2/3 by Use, speed by size ratio) join two parts in a straight horizontal line. Reaching one part with two
different speeds is a JAM: the network stops and one toast says so. Stress: each part costs `BASE_STRESS[kind] x clamp(16/|rpm|, .25, 4)`;
over capacity the network stops. Oil: Use a `residue_canister` (distillery lube base) x1.25 for 10 min, `pine_resin` x1.10 for 5 min, whole net.
Belts reverse with the sign of the speed. Goggles text: "right|left N rpm, load a/b su".

## Machine interface for other systems (stable; golems and constructs from src/magic use exactly this)
All calls are on `Game.workshop` (the `Workshop` instance); coordinates are block cells; nothing here needs a screen.
- `offer(x, y, z, item, count): number` - hand items to the machine/funnel/depot/basin/crate at that cell; returns how many it took.
- `take(x, y, z, filter?: string | null, max = 64): { item, count } | null` - pull a stack out of a depot, a machine's output buffer or a crate.
- `crank(x, y, z, seconds = CRANK_S): boolean` - turn a `hand_crank` as if a player held Use. A construct that cranks is a source of 8 su.
- `signal(x, y, z, on: boolean)` - set a lever/plate cell, read by deployers and gearshifts (1-bit).
- `act(a: MachineActAction): false | 'used' | 'consumed'`: use `item` on the block at `target` from `face`
  (`{ item, target: [x,y,z], face, mode: 'auto' | 'use' | 'strike' | 'place' | 'mine' }`) the way a deployer does: the Game's `actHook`
  first (hand stations take the stroke through `sim.stroke`), else placing a held block into free air ('consumed') or breaking a solid
  block ('mine', or 'auto' with a non-block item) with its drops left as ground items. A golem that does "what a player does at that
  block" calls `workshop.act(...)` too.
- `workshop.logi.peek/accept/take` are the container primitives (depot, basin, funnel, chute, deployer hand, crates by block entity).
- Events (bus `sfx`/`toast` only, nothing new in core): machines emit `item:made` like the hand stations.

## Logistics and processing (src/workshop/logistics.ts, `Workshop.logi`; basin recipes in src/content/basinWorkshop.ts)
- `depot` holds one stack of one kind; `basin` two kinds (16 each) and 1000 L; `funnel` passes items from the block behind / on top to the
  block in front (or the ground), Use with an item sets a filter, empty hand clears; `chute` does the same downward from the block above;
  `item_drain` empties a full bucket (any fluid with a bucket) into the basin below and passes the empty bucket on; `spout` under a
  basin fills an empty bucket on the depot / belt beneath it. Belts hand items to any of these (and crates) at their end; machines put
  their output into the container in front instead of dropping it when there is one.
- `mech_arm` (3 su, 16 rpm: 1.5 s a cycle): wrench on it, then on a source, then up to 4 targets within 3 blocks, then on it again.
  `deployer` (6 su, 2 s): holds a stack and acts on the block in front. `mech_drill` (6 su): breaks the block in front, time =
  hardness x 1.2 s at 16 rpm, tier 1 at most, drops land where the block was. `mixer` (6 su, needs 32 rpm: use a ratio dial) and
  `mech_press` (8 su, 16 rpm) work the basin below them: `BASIN_RECIPES` (dough, cold bronze alloy, bronze and iron plate).
- `mech_hammer` (Trip Hammer) is the twin of the stone anvil's stroke recipes.
- Not built yet (listed in OVERHAUL_PLAN status): fluid pipes into spouts/drains, vacuum collector, contraptions, rail skiff, signals.

## Third slice: more sources and safety, tie-ins, signals, the guide, contraptions
- **Differential** (`differential`): two inputs meet at their mean speed (opposed is fine) and the mean flows on to the other sides. **Flywheel**: charged
  while its line turns, then a source of 12 su (fading) for `FLYWHEEL_COAST_S` 4 s. **Shear pin**: when the load tops the capacity the pin
  snaps (block gone, a scrap_metal drops, one toast) instead of the line seizing. **Treadwheel**: 12 rpm / 24 su while `standingOn(x, y+1, z)`
  (Game: the player stands on it; tame animals are not read yet).
- **Tractor power take-off**: `Workshop.tractors()` (Game: the vehicle manager); a driven, fuelled tractor within 2.6 blocks turns the nearest drive shaft at
  24 rpm / 30 su.
- **Saw arm** (5 su): fells the whole trunk in front every 3 s (`trunkAbove` of the chainsaw rules, no fuel), logs drop as items. **Vacuum collector**
  (3 su): pulls loose items within 4 blocks in, passes them out of its front. **Item vault**: 108 stacks, empty-hand Use gives the biggest stack.
- **Fluids**: `Workshop.fluidBlock` (Game: `isFluidEndpoint` + `sim.bucketUse`). An `item_drain` over a tank (not a basin) pours a full bucket or canister
  into it (every distillery canister is a fluid bucket), a `spout` under a tank fills the empty one waiting on the depot / belt below it.
- **Signals** (`signals.ts`, `Workshop.signals`, `signal(x,y,z,on)`): lever (Use), push button (Use: 2 s), timer (Use cycles `TIMER_PRESETS`), relay (reads the cell behind, drives the front at 15; Use cycles `RELAY_MODES`: repeater, delay 1/3 s, hold 3 s, one pulse), pressure plate (an item on it, or you), metronome (1 s in 4), signal wire
  (15 steps, -1 per wire), lamp, bell (also rings within 12 blocks when a machine seizes or jams). Every powered logistic machine that touches a
  signal cell works only while it is lit; touching none it just works; a clutch touching a lit cell flips. `tally_board` counts what it passes;
  `clockface` reads `Workshop.clockText`.
- **Workshop Guide**: Use Engineer's Goggles on empty air (`ScreenRequest { type: 'workshop' }`, `src/ui/screens/workshop/workshopScreen.ts`): Parts,
  Basins (recipe cards: inputs > machine rpm, s > output) and Rules.
- **Contraptions** (`contraption.ts`): a *structure* is the face-connected set of movable blocks (`contraption_frame`, every workshop part, belts,
  depots, levers...; never terrain, crates, generators or other pistons/bearings, at most 48). `piston` (6 su, 0.8 s a step, up to 4): while turning it
  pushes the structure in front of it one block, leaving a frame rod; stopped, it pulls it back; a lever makes it a lift. `bearing` (6 su): turns the
  structure on top a quarter turn every 1.5 s, right or left with the sign of the speed, facings turned with it. All per-block state (machine
  buffers, depot stacks, arm settings, cranks, signals) and loose items on moved blocks move with them (`Workshop.relocate`); a belt keeps carrying.
  Blocked steps refuse with a toast. `skiff` on `rail` (rails under it): rolls 5 blocks/s, waits 2 s at the end of the rail, turns round; it holds one
  stack that arms and funnels load and unload; a signal cell touching it brakes it while off. Steps are discrete (no tween yet).
