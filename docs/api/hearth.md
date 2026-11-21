# Multiblock hearths (src/sim) - public API

Spec 17 (17.1 structure rules, 17.3 validation; the feedback of 17.4 that the simulation owns), on the data of
`docs/api/tech-content.md`. Also in this pass: the furnace hands back `fuelReturns`, berry bushes regrow, heat engines
draw heat for the power actually used, and the item/fluid **endpoint interface** the transport engineer builds on.
DOM-free, inside `src/sim`. `npx vitest run src/sim` (13 files, 131 tests).

| file | what |
|---|---|
| `hearthScan.ts` | the pure cuboid scan: box, cell classification, problems, structural tier, `tierProblems` |
| `hearthStats.ts` | `HearthSummary` (saved on the furnace), `FurnaceStats` (what a furnace runs at), `buildHint` |
| `hearth.ts` | `HearthSet` / `Hearth`: when to scan, forming and coming apart, active bits, links, proxies, lava |
| `hearthView.ts` | `structureView`: the STRUCTURE tab's data and the ghost preview |
| `endpoints.ts` | `ItemEndpoint` / `FluidEndpoint` for pipes (spec 16.2) |
| `hearthKit.ts` | test fixture: `buildHearth`, `shellBox`, `boxCells` (import by path) |

## Wiring

Nothing new to wire: `Simulation` owns the hearths. Every furnace is a hearth controller (a lone one simply is not
formed). `sim.tick()` runs the due scans first; views and actions run them too, so an edit is seen at once.

## Rules as built

**Geometry (17.1).** A hollow cuboid; the controller sits in a wall face with its front facing out and the cell behind it
inside. Inside sizes are `[across, deep, high]` (across = along the controller's wall, deep = away from its back). The
inside must be **air only**. Cells: interior; wall faces; edges (vertical corners and the rings of floor and ceiling);
floor faces; ceiling faces. Shell cells hold a wall block of the tier, or in **faces** (never edges) a part: glass
(window), `item_hatch`, `fluid_hatch`, `power_port`, `blower`; `electrode` only in **ceiling faces** (any tier may hold one).
A higher tier's wall block counts for every lower tier.

**Structural tier** = the highest tier (2..5) all of whose rules hold: no hard problem, every wall block of that tier or
higher, the inside within its bounds (x/z either way round), a ceiling where required, enough electrodes and power
ports. So the weakest wall block caps it (spec: "the lowest tier whose wall rules are met" - read as "the weakest
wall decides", since a star-casing box also meets the Blast rules). 0 = not formed.

**Scan (17.3)** - `scanHearth(world, x, y, z, facing)`: from the cell behind the controller it walks solid-free cells
across (both ways) and deep, at most `MAX_ACROSS` (5) inside cells, to find the walls; down to the floor (at most
`MAX_HIGH`); then up layer by layer: a layer whose inside footprint is at least half solid is the **ceiling** (closed);
a layer whose ring is less than half built is **open sky** (open top - so a steam engine or blower resting on the rim
does not count as a wall layer); anything else is another inside layer. Then it classifies every cell of the box
(<= 7x7x7 = 343 reads) and checks it. Walking stops only at solid blocks, so a torch or water inside is reported as
clutter rather than mistaken for a wall. Measured on the real World: **0.20 ms** for the largest box (budget 1 ms).

**Problems** - `{ code, x, y, z, text }`, at most `HEARTH_MAX_PROBLEMS` (8), each naming a block to highlight:

| code | text |
|---|---|
| `behind` | "The block behind the furnace must be the hollow inside - its front faces out" |
| `open` | "No walls found - the inside can be at most 5 blocks across" |
| `no_floor` | "No floor under the hearth" |
| `too_tall` | "Too tall - the inside can be at most 5 blocks high" |
| `interior` | "Interior must be empty" |
| `missing` | "Wall has a gap" / "Floor has a gap" / "Ceiling has a gap" |
| `wrong_block` | "Dirt cannot be part of the wall" (floor / ceiling) |
| `edge_part` | "Glass cannot sit on an edge" |
| `electrode_place` | "Arc Electrodes only work in the ceiling" |
| `controller` | "Another furnace is part of this wall" |
| `size` (tier) | "Too big for a Blast hearth - the inside can be at most 3x3x3" / "Too small for a Plasma hearth - the inside must be at least 2x2x2" |
| `ceiling` (tier) | "An Arc hearth needs a ceiling" |
| `electrodes` (tier) | "Needs 1 more Arc Electrode" |
| `ports` (tier) | "Needs 2 more Power Ports" |
| `wall_tier` (tier) | "Wall is not Refractory Brick" (one per weak block) |

**When it scans.** On the tick after any block-id change within the shell's box + 1 (a controller that is not formed
watches everything it could reach: `HEARTH_REACH + 1` around it); after a chunk near it loads; while not formed, every
`HEARTH_RESCAN_S` (1 s) but only while the player is within `HEARTH_RESCAN_RANGE` (16) or its furnace screen is open;
while formed, one cell of the box (shell and inside) is re-read every `HEARTH_VERIFY_TICKS` (4) ticks. A scan waits while
any chunk it could reach is unloaded (it never unforms a hearth because its neighbour chunk has not arrived).
Measured: a formed 5x5x5 hearth with its lit furnace costs **0.010 ms per tick** (budget 0.05 ms).

**Effective tier** = `max(1, min(furnace tier, structural tier))` - saved as `FurnaceEntity.effTier`. It drives the max
temperature, heat capacity and loss, electric heat, smelting speed, crucibles, which recipes can be smelted and
forged, and the Starhearth's ignition. A furnace standing alone runs on tier 1 (Clay Furnace) numbers. `e.tier` stays
the block's tier (objectives, the furnace name, warmth radius, fuel slots).

**Grants of a formed hearth** (`furnaceStats`, `src/core/hearth.ts` maths):
- crucibles = `hearthCrucibles(tier rules, inside)`;
- heat capacity x sqrt(volume), heat loss x shell area / 26 (windows and open-top cells count double) - **measured
  against the tier's smallest legal shell** (see deviations), so the smallest hearth of each tier runs exactly at the
  tier table's numbers;
- the fire and the electric heater are **sized to the shell**: fuel burns `fireScale` (= the loss multiplier) times as
  fast and gives as much more heat, and `electricHeatW` is multiplied by it - every legal hearth reaches the same
  temperatures, a bigger one costs more fuel and power to keep hot;
- smelting speed x min(2, 1 + 0.1 (volume - 1)), times 1.25 per **running** blower in a face (tuyere, max 4).
- A furnace above its (new) maximum is no longer heated and cools down by itself (nothing snaps).

**Coming apart never destroys anything.** Crucibles beyond the new count lock: they hold still, refuse new input, and
their input and output can still be taken out (`CrucibleView.locked`, "Locked - take it out"). Crucible arrays only
grow. The effective tier drops; toast "The Blast hearth came apart - wall has a gap" (the first problem).

**Formed state in the world.** Every shell block's active bit is set (only where it differs) - wall blocks, glass,
electrodes, hatches and ports (via their nodes); the controller and blowers keep their own meaning of the bit. Cleared
when it comes apart, except blocks that belong to another formed shell. Verified in the real renderer: the walls and
the hatch switch to their glowing-seam tiles.

**Events.** `hearth:formed { x, y, z, tier, min, max }` + `sfx hearth_formed` (at the controller) + toast "Blast hearth
formed" when it forms, changes tier or changes box; `hearth:unformed { x, y, z }` + the warning toast when it comes
apart. Breaking the furnace emits `hearth:unformed` without a toast. Nothing per tick.

**Upgrades.** `upgrade()` and `UpgradeView` also need the next tier's hearth formed (`e.hearth.tier >= next`), reason
"Build a Blast hearth: brick walls around the furnace" / "Build an Arc hearth: refractory brick walls around the
furnace, a ceiling and 1 Arc Electrode" / "Build a Plasma hearth: plasma casing walls around the furnace, a ceiling and
2 Power Ports" / "Build a Starhearth: star casing walls around the furnace, a ceiling and 4 Power Ports"
(`buildHint(tier)`). Order of reasons: hearth, ingredients, temperature. A clay furnace in a Blast hearth is formed
(it may upgrade) but still runs as tier 1. Recipes above the effective tier say "Needs a formed Blast hearth".
Ignition needs an effective tier 5.

**Power.** The controller joins networks like any device (a cable or device touching it). Each power port of a formed
hearth is linked to the controller in the network flood fill, so the hearth is one consumer however many ports it has
(ports on different cable runs join them into one network through the hearth).

**The shell stands for its furnace.** A thermopile or blower touching any block of a formed shell touches the furnace; a
steam engine on any shell block sits on it (so it works on a hearth's ceiling). A blower set in a face is also a tuyere.

**Saving.** `FurnaceEntity.hearth: HearthSummary | null` (`{ tier, inner, closed, windows, min, max }`) and `effTier`
are saved with the furnace; a loaded game runs on that state and the first scan confirms it quietly or announces the
change (test: a load with a wall missing unforms on the first tick).

## Simulation members (new)

| member | semantics |
|---|---|
| `structureView(x, y, z, target?: StructureTarget): StructureView \| null` | the STRUCTURE tab (below); runs due scans first |
| `validateHearths(): void` | runs every due scan now and refreshes the stats (ticks do it anyway) |
| `itemEndpoint(x, y, z, face: Face): ItemEndpoint \| null` | what a pipe end on `face` of that block may insert/extract |
| `fluidEndpoint(x, y, z, face: Face): FluidEndpoint \| null` | the same for fluids |
| `giveBack(item): void` | hands one item to the player (`SimContext`; used for burned containers that found no slot) |

### StructureView
`{ x, y, z, controllerTier, effectiveTier, formed, tier, name, inner, closed, windows, status, problems, tiers, target }`
- `status`: "Formed - Blast hearth 3x3x2" / "Not formed"; `name`: "Blast hearth" ... "Starhearth" or null.
- `inner`/`closed`/`windows`: what the last scan found (`inner` null without a box).
- `problems`: hard problems + the target tier's, at most 8, each with a position (tap to highlight).
- `tiers: TierChoice[]` - `{ tier, name, wall, minInner, maxInner, ceiling, electrodes, ports }` for the picker.
- `target`: `{ tier, name, inner, closed, min, max, checklist, materials, cells, ready }` for `target` (default: the
  tier the furnace needs now, else the next upgrade's; `defaultTargetTier(e)`), and its inside (default: the scanned
  box fitted into the tier's bounds, else the smallest, centred across the furnace, the furnace on the lowest inside
  layer).
  - `checklist: StructureCheck[]` - `{ key: 'floor'|'walls'|'ceiling'|'interior'|'electrodes'|'ports', label, have, need, ok }`
    ("Floor 8/9", "Walls 6/7", "Ceiling", "Inside empty", "Electrodes 0/1", "Power ports 0/2"); ceiling only when closed.
  - `materials: MaterialRow[]` - `{ item, need, placed, missing, have, ok }` per block kind of the whole shell; `have`
    counts the pack and the crates near the furnace.
  - `cells: GhostCell[]` - **the ghost preview**: `{ x, y, z, role: 'wall'|'edge'|'floor'|'ceiling'|'interior', want,
    has, state: 'ok'|'missing'|'wrong' }` for every shell cell (controller excluded) and every inside cell that is not
    air (`want: 'air'`). Blue ghost = `missing`, red = `wrong`. Missing electrodes go in the empty ceiling face nearest
    the middle, missing ports in the empty wall face nearest the furnace (existing valid parts are kept).
  - `ready`: every listed cell is `ok`.
- The scripted playthrough builds every hearth exactly from these cells (`Play.buildHearth(tier)`).

### FurnaceView additions
`effectiveTier`, `cruciblesActive`, `hearth: HearthBrief` (`{ formed, tier, name, inner, closed, windows, blowers,
tuyeres, text, problem }`), `CrucibleView.locked`, `UpgradeView.structureOk` / `structure` (always set; optional in the
type only so the UI's hand-built test views compile). `maxTempC`, `electric.maxW/available`, `targetC`, `burn*LeftS`
follow the effective stats. New status lines: "No Arc hearth formed - it runs like a Clay Furnace", "The Blast hearth
holds it back - it runs like a Blast Furnace".

## Endpoints (for the transport engineer)

```ts
interface ItemEndpoint {
  readonly entity: BlockEntity;                       // what really holds the items (a hatch's controller furnace)
  room(item: string): number;                         // how many it would take now (0 = refuses); no reservations kept
  insert(item: string, count: number, durability?: number): number;   // returns how many it took
  offer(filter?: (item: string) => boolean): ItemStack | null;         // copy of the first stack it would give
  take(item: string, max: number): ItemStack | null;  // up to max from the first slot giving it (durability travels)
}
interface FluidEndpoint {
  readonly entity: BlockEntity;
  room(fluid: FluidKey): number;                      // litres it would take now
  fill(fluid: FluidKey, litres: number): number;      // returns litres taken
  offer(): FluidStack | null;                         // { fluid, litres } it would give now (a copy)
  drain(fluid: FluidKey, litres: number): number;     // returns litres given
}
```
- Item sides: crate - all slots both ways; processors - recipe inputs in (slot 0), products out (slot 1); fuel
  generators and the fission pile - their fuels in, nothing out; bore rig - nothing in, its buffer out; lamps and other
  slotless machines - null. **Furnace (smart sides)**: fuel -> firebox; smeltables (at the effective tier) -> a working
  crucible already holding that item, else an empty one; an item that is both (logs, coal) goes to a crucible only when
  one already holds it, else to the firebox; forge ingredients and anything else refused; out: finished crucible
  products (locked crucibles too), then containers burned fuels left in the firebox (the bronze bucket) - never fuel
  or ore. `item_hatch` of a formed hearth = its controller's endpoint; of no formed hearth = null. `power_port` and
  `fluid_hatch` have no item side.
- Fluid sides: every machine with `MachineSpec.fluids`, through `MachineEntity.fluidIn` / `fluidOut` (`FluidStack | null`,
  new fields, null on older saves): `fill` takes accepted fluids into `fluidIn` up to `capacityL` (one fluid at a time);
  `offer`/`drain` give from `fluidOut`, or from `fluidIn` for a fluid the machine both accepts and gives (the tank).
  `fluid_hatch` of a formed hearth takes lava; each `lavaLPerFuel` (1000 L) burns like a lava bucket with no bucket
  coming back (it relights a hot furnace, counts in `burnTimeLeftS`, lets `light()` start a fire). Of no formed hearth:
  null.
- Endpoint objects are cached per entity; fetch again after block changes. `face` is part of the lookup; every side of
  today's blocks behaves the same. Hot/cold pipe rules (`pipeCarries`) and reservations are the network's business.
- **Not done here (transport):** what machines do with their fluid buffers (steam engine piped water, still oil runs,
  combustion engine fuel, geothermal lava, boiler, turbine, pump, stacked tanks).

## Other changes in src/sim
- **fuelReturns**: when a fuel with `fuelReturns` (lava bucket) goes into the fire, its container is left in the
  firebox slot it emptied (else another slot, else handed to the player).
- **Heat engines** (thermopile 4x, steam engine 3x) draw heat for the power the network actually uses (`outW`), not
  what they could make; the furnace thermostat counts last tick's draw. An engine on a grid with no load takes no heat.
  The boiler does not exist in the simulation yet; it should follow the same rule.
- **Berry bushes** (spec 14): role 'bush' is folded into `CropField` as a one-stage wild family (`StageInfo.wild`,
  `stageS` = regrowS 300): `berry_bush_bare` swaps back to `berry_bush` after 300 s anywhere, any hour; entity kind
  `berry_bush` `{ growS }`; never a machine (no node, view, network, sound or machine event); `crop:grew` stage 1;
  `cropView` status "Fruiting again" / "Ripe". `isPlant(e)`, `isPlantBlock(def)` in cropRules.ts. Old machine-shaped
  bush entities are adopted.

## Test fixtures
- `kit.formed(x, y, z, options?)` (testKit): builds the smallest hearth of the furnace's tier around it and forms it.
- `buildHearth(world, x, y, z, { tier, inner?, wall?, closed?, facing?, electrodes?, ports?, dy? })` (hearthKit).
- `Play.buildHearth(tier)` (playKit): breaks what the ghost marks wrong, places what is missing, checks it formed.

## Verification
- `hearthScan.test.ts` (12): every tier's smallest hearth, box/cells, four facings, min/max sizes and beyond, higher
  walls / weakest wall, parts in faces, every problem code with its text and position, tier rules, the 8-problem cap.
- `hearth.test.ts` (19): forming (event, sound, toast, active bits, crucibles), coming apart (locked crucibles keep
  contents, can be emptied, reopen), breaking the controller, cooling above the new max, effective tier for every
  combination, grants (capacity, loss, heater, windows), fire sizing, size and tuyere speed, the scan schedule
  (changes in reach, far changes, unformed retry near the player / screen open, formed sweep catching a silent change),
  upgrade gating, recipe locks, ignition gating, power through ports (and unlinking), shell proxies for heat engines,
  save/load (quiet when intact, re-validated when not), lava bucket return, heat by used power.
- `hearthView.test.ts` (5), `endpoints.test.ts` (8), `bushes.test.ts` (4), `hearthPerf.test.ts` (real World).
- Every older sim test now builds its hearths; `playthrough.test.ts` builds all four hearths with real placements
  (16 brick; 24 refractory + electrode; 53 plasma casing + 2 ports; 93 star casing + 4 ports) from the structure view,
  the Arc controller overloads copper cable inside the bigger Plasma shell, and it reaches `game:won` with every
  objective in order (165 min of game time, ~3.5 s).
- Built game in headless Chromium (1280x800 and 390x844, via `window.__hw`): a 3x3x2 Blast hearth with a window and an
  item hatch - plain bricks while a brick is missing; placing it forms it (toast, glowing seams, lit mouth, smoke from
  the open top); by night the seams glow; a hole in the floor takes it apart (warning toast, plain bricks again).

## Deviations from the spec, and decisions
- **Scaling against each tier's smallest shell.** Spec 17.1 multiplies heat capacity by sqrt(volume) and loss by area/26
  - absolute, with a 1x1x1 reference. Since the Plasma hearth is at least 2x2x2 and the Starhearth 3x3x3, that alone
  makes the smallest Plasma hearth lose 2.15x and the smallest Starhearth 3.77x the tier table's heat, contradicting the
  rest of the game's numbers (the objective's "about 21 kW at 2600 C", the 340 kW ignition budget; the Starhearth would
  need ~90 kW just to hold 3000 C). The multipliers are divided by those of the tier's smallest legal shell
  (`smallestShell`), so the smallest hearth runs exactly at the table's numbers and bigger ones cost more. Blast and
  Arc are unchanged (their smallest is 1x1x1; a closed 1x1x1 Blast hearth loses 26/27 of an open one).
- **Fire and heater sized to the shell** (`fireScale`): without it a bigger hearth could never reach its temperatures on
  fuel or on the tier's electric heater (a 4x4x3 Arc hearth would top out near 550 C).
- **Structural tier** read as "the weakest wall decides" (see above). Electrodes are allowed in any ceiling face at any
  tier. Interiors must be pure air (torches, water and plants inside are clutter).
- Open top: a layer with less than half its ring built counts as open sky.
- Problems: hard problems first, then the target tier's; the scan keeps up to 8 hard ones and counts them all.
- A clay furnace in a Blast hearth is "formed" (events, glow, toast) though it still runs at tier 1: that is the cue it
  can be upgraded.
- Shell blocks stand for the controller for heat engines and blowers (not in the spec; it lets a steam engine sit on a
  closed hearth and a thermopile touch any wall).
- Ports on separate cable runs join them into one network through the hearth.

## Known gaps
- **Balance**: the playthrough spends ~45 of its 165 minutes making the Star hearth's 93 casings (47 magnet rings, ~230
  superalloy, ~240 copper coils). As the tech-content notes say, consider 4 casings per craft or a smaller Star shell.
- Machine fluid behaviour (consuming the new buffers) and the boiler are the transport engineer's.
- The STRUCTURE tab, problem highlight and ghost rendering are UI/render work on `structureView`.
- A shell block shared by two formed hearths is mapped to the later one (proxies, links); bits stay correct.
- `src/sim/simulation.ts` is 553 lines (it was 452; aim 350) - the facade gained the hearth and endpoint members.
