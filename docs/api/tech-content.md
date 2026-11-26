# Tech content - data for spec sections 16 and 17

> **Numbering note (BRONZE_PLAN W0, done):** furnace tiers and ages below that were written for five tiers are now six: tier 2 is the single-block Bronze Furnace, so the old tiers 2-5 are 3-6 and the old ages 1-4 are 2-5 (`docs/api/ages.md`). A furnace without a formed hearth runs as the Bronze Furnace (tier 2), not the Clay Furnace.


Item and fluid transport (pipes, pumps, tanks, boiler, steam turbine, the wrench) and multiblock hearths (walls,
electrodes, hatches, power ports, structure rules). This pass lays down **data, contracts, textures and sounds
only**: nothing moves items, pumps a litre or forms a hearth yet. Section 6 says what each next engineer builds on it.
At the time of writing `npm test` has 959 tests; everything of mine passes, typechecks and builds (the one failing test
and type error at that moment were in `src/world` trees, another engineer's work in progress).

## 1. Core contracts (appended; nothing renamed or removed)

### src/core/types.ts
```ts
type BlockShape = ... | 'pipe';          // core + arms, like 'cable'; spans PIPE_CORE_MIN..PIPE_CORE_MAX of the cell
interface BlockTextures { ...; bottomActive?: string }   // NEW: a hearth ceiling's underside glows too (default: bottom)
interface BlockSpec { ...; pipe?: PipeSpec }              // set on every 'pipe' block and nothing else
interface BlockDef  { ...; pipe: PipeSpec | null }
interface PipeSpec {
  family: 'item' | 'fluid';             // the two families never join
  ratePerS: number;                     // item: transfers per second per pulling port (0.5 = every 2 s); fluid: litres/s per port
  batch?: number;                       // item: most items per transfer
  speedBlocksPerS?: number;             // item: packet travel speed
  capacityL?: number;                   // fluid: litres each pipe adds to its network
  hot?: boolean;                        // fluid: may carry hot fluids (lava, steam)
}
interface FurnaceTierSpec { ...; structure?: HearthStructureSpec }   // absent on tier 1
interface HearthStructureSpec {
  wall: string[];                       // accepted wall blocks, this tier's own first, then every higher tier's
  minInner: [x, z, y]; maxInner: [x, z, y];   // x and z interchangeable
  ceiling: 'optional' | 'required';
  electrodes?: number;                  // in ceiling faces
  powerPorts?: number;                  // in faces
  maxCrucibles: number; crucibleBonus: number;   // crucibles = min(maxCrucibles, x*z + crucibleBonus)
}
type MachineRole = ... | 'tank' | 'hearth_part';
interface MachineSpec { ...; fluids?: MachineFluids }
interface MachineFluids { accepts?: FluidKey[]; gives?: FluidKey[]; capacityL: number }  // capacityL per internal buffer
type FluidKey = 'water' | 'lava' | 'steam' | 'crude_oil' | 'fuel';
interface FluidSpec {
  key: FluidKey; name: string; colour: number /* 0xRRGGBB */; hot: boolean; glow: boolean;
  liquid?: LiquidKind;                  // world liquid a pump draws it from
  bucket?: { full: string; empty: string };   // item that carries 1000 L, and the bucket handed back
}
```

### src/core/constants.ts (appended)
| constant | value | meaning |
|---|---|---|
| `LITRES_PER_BUCKET` | 1000 | a bucket on a tank / fluid endpoint fills or empties this much |
| `PIPE_CORE_MIN`, `PIPE_CORE_MAX` | 4/16, 12/16 | pipe core and arm cross-section (texture rows/cols 4..11) |
| `PIPE_MAX_PIPES`, `PIPE_MAX_PORTS` | 1024, 64 | per network; beyond: "Network too long", extra pipes inert |
| `PIPE_MAX_PACKETS` | 48 | item packets in flight per network; pulling pauses at the cap |
| `PIPE_FILTER_SLOTS` | 5 | filter keys per port |
| `PIPE_PRIORITY_MIN`, `PIPE_PRIORITY_MAX` | -2, 2 | port priority range |
| `HEARTH_FACE_PARTS` | glass, item_hatch, fluid_hatch, power_port, blower | may stand in a face (never an edge) instead of wall |
| `HEARTH_CEILING_PARTS` | electrode | may stand in a ceiling face |
| `HEARTH_SHELL_AREA_REF` | 26 | heat loss x (shell area / 26) |
| `HEARTH_OPENING_AREA` | 2 | a window or an open-top cell counts double in the shell area |
| `HEARTH_SPEED_PER_CELL`, `HEARTH_SPEED_MAX` | 0.1, 2 | smelting x min(2, 1 + 0.1 (volume - 1)) |
| `HEARTH_TUYERE_BONUS`, `HEARTH_MAX_TUYERES` | 0.25, 4 | each blower in a face: +25% smelting speed, at most 4 count |
| `HEARTH_MAX_PROBLEMS` | 8 | validation reports at most 8 problems |
| `HEARTH_RESCAN_S`, `HEARTH_RESCAN_RANGE` | 1, 16 | unformed: rescan every 1 s while the player is within 16 blocks or the screen is open |
| `HEARTH_VERIFY_TICKS` | 4 | formed: verify one shell cell every 4 ticks |
| `HEARTH_HIGHLIGHT_S` | 10 | a tapped structure problem pulses this long |

### src/core/gameEvents.ts (appended)
- `SfxName += 'hearth_formed' | 'pipe_clunk'`.
- `'hearth:formed': { x, y, z, tier, min: [x,y,z], max: [x,y,z] }` - the furnace at x,y,z now sits in a formed hearth
  of structural `tier`; `min`/`max` are the inclusive world corners of the shell (render: the light sweep; UI). Emit on
  a change of formed state or structural tier, together with `sfx hearth_formed` and the toast "Blast hearth formed".
- `'hearth:unformed': { x, y, z }` - it stopped being formed. Nothing is destroyed.

### src/core/hearth.ts (new, pure; tests in hearth.test.ts)
```ts
type Interior = readonly [x, z, y];
interiorFits(s: HearthStructureSpec, inner: Interior): boolean      // within min..max, x/z either way round
hearthCrucibles(s, inner): number                                    // min(maxCrucibles, x*z + crucibleBonus)
shellCells(inner, closed: boolean): number                           // every shell cell, controller and parts included
faceCells(inner): { walls, floor, ceiling }                          // non-edge cells: where parts may go
hearthScale(inner, { closed, windows, tuyeres }): { heatCapacity, loss, speed }
  // multipliers on FurnaceTierSpec.heatCapacityJ (sqrt(volume)), lossWPerC (area/26, windows and open-top cells
  // over the interior counting HEARTH_OPENING_AREA) and speed (size bonus capped at 2, times the tuyere bonus)
smallestShell(s): { inner, closed, cells, wall, electrodes, powerPorts }   // cheapest legal shell of a tier
```

### src/core/registry.ts
```ts
const FLUIDS: readonly FluidSpec[];
fluid(key: FluidKey): FluidSpec                       // throws on unknown
fluidOrNull(key: string): FluidSpec | null
fluidOfLiquid(kind: LiquidKind): FluidSpec | null     // water->water, lava->lava, oil->crude_oil
fluidInBucket(itemKey: string): FluidSpec | null      // water_pail->water, lava_bucket->lava
bucketFilledWith(emptyKey: string, key: FluidKey): string | null   // ('pail','water')->'water_pail'; wrong bucket -> null
isItemEndpoint(def: BlockDef): boolean                // furnaces, item hatches, every machine with slots (crates too)
isFluidEndpoint(def: BlockDef): boolean               // every machine with MachineSpec.fluids
pipeJoins(pipe: BlockDef, other: BlockDef): boolean   // arm towards a same-family pipe or that family's endpoint
pipeCarries(pipe: BlockDef, f: FluidSpec): boolean    // fluid pipes only; hot fluids only in hot pipes
hearthWallTier(blockKey: string): number              // brick 2, refractory_brick 3, plasma_casing 4, star_casing 5, else 0
```
`validateContent()` also runs `validateTech` (src/core/techValidation.ts): pipe shape <-> pipe spec, item pipes have
batch and speed, fluid pipes capacity; fluids unique with 0xRRGGBB colours, one fluid per world liquid, bucket items
exist; fluid ports name known fluids with capacity > 0; tier 1 has no structure and tiers 2+ do; walls exist, a higher
tier's walls count for every lower tier and each tier has its own; interior bounds; whole part counts; the smallest
shell has room for the controller, its parts and its electrodes; HEARTH_*_PARTS are blocks.

## 2. Content

### Blocks (src/content/blocksTech.ts, appended last; 119 blocks now)
| key | name | shape / tool / hardness | texture | notes |
|---|---|---|---|---|
| `item_pipe` | Bronze Chute | pipe / pickaxe / 0.4 | `pipe_item` | item: 0.5 transfers/s, batch 4, 4 blocks/s. Age 0 |
| `fast_item_pipe` | Steel Conveyor Pipe | pipe | `pipe_item_fast` | item: 2/s, batch 16, 10 blocks/s. Age 1 |
| `fluid_pipe` | Iron Fluid Pipe | pipe | `pipe_fluid` | fluid: 200 L/s per port, 250 L per pipe, cold only |
| `hot_fluid_pipe` | Steel Hot Pipe | pipe | `pipe_fluid_hot` | fluid: 1000 L/s, 250 L, hot |
| `pump` | Pump | cube, oriented, device | casing + `pump_front[_on]` | machine `pump` |
| `tank` | Tank | cube, no power | `tank_side`, `tank_top` | machine `tank` |
| `boiler` | Boiler | cube, oriented, no power | casing + `boiler_front[_on]` | machine `boiler` |
| `steam_turbine` | Steam Turbine | cube, oriented, device | casing + `steam_turbine_front[_on]` | machine `steam_turbine`. Age 2 |
| `refractory_brick` | Refractory Brick | pickaxe / 5 | `refractory_brick[_on]` | Arc hearth wall. Age 1 |
| `plasma_casing` | Plasma Casing | pickaxe / 6 | `plasma_casing[_on]` | Plasma hearth wall. Age 2 |
| `star_casing` | Star Casing | pickaxe / 8 | `star_casing[_on]` | Star hearth wall. Age 3 |
| `electrode` | Arc Electrode | pickaxe / 3 | `electrode[_on]` | ceiling part, not a machine. Age 1 |
| `item_hatch` | Item Hatch | pickaxe / 2, no power | `hatch_item[_on]` | machine `item_hatch` (role hearth_part) |
| `fluid_hatch` | Fluid Hatch | pickaxe / 2, no power | `hatch_fluid[_on]` | machine `fluid_hatch` |
| `power_port` | Power Port | pickaxe / 2, device | `power_port[_on]` | machine `power_port`. Age 2 |

`brick` gained `brick_on`. Every shell block (the four walls, electrode, hatches, port) uses its `_on` tile on **all six
faces** while active (the new `bottomActive`). Pipes are non-solid (walk-through, like cables) and have **no active
texture**: their active bit ("carrying something") is a tint for the mesher.

### Items
- `wrench` "Wrench": category `tool`, stack 1, **no ToolSpec** - it never mines faster and never wears out; the player
  code recognises it by key. Forged T1 at 600 C from 3 bronze_ingot.
- Block items of every block above. Pipes show their plus tile as a flat icon (like cables); the rest are cubes.
- `graphite_electrode`'s description now points at the Arc Electrode.

### Fluids (src/content/fluids.ts -> `FLUID_SPECS`, read as registry `FLUIDS`)
| key | name | colour | hot | glow | liquid | bucket |
|---|---|---|---|---|---|---|
| water | Water | 0x3a86b4 | no | no | water | water_pail / pail |
| lava | Lava | 0xff7a1e | yes | yes | lava | lava_bucket / bronze_bucket |
| steam | Steam | 0xe6ecf0 | yes | no | - | - |
| crude_oil | Crude Oil | 0x1d1814 | no | no | oil | - (no bucket holds oil) |
| fuel | Refined Fuel | 0xe2bc3a | no | no | - | - |

### Recipes (127 in all; forge rows inserted into their tier's block of the furnace list)
T1: `item_pipe` x8 (2 bronze_ingot, 1 glass, 800 C), `wrench` (3 bronze_ingot, 600 C).
T2: `refractory_brick` x4 (4 brick, 1 coke, 1300), `electrode` (3 graphite_electrode, 1 copper_coil, 1200),
`item_hatch` (1 crate, 2 iron_plate, 1000), `fluid_hatch` (1 tank, 2 iron_plate, 1000), `fast_item_pipe` x8 (2 steel_plate,
1 glass, 1300), `fluid_pipe` x8 (2 iron_plate, 1 glass, 1000), `hot_fluid_pipe` x8 (2 steel_plate, 1 ceramic_insulator, 1400),
`tank` (4 iron_plate, 4 glass, 1000), `pump` (1 chassis, 1 copper_coil, 2 fluid_pipe, 1000), `boiler` (4 iron_plate,
2 copper_coil, 1 tank, 1100).
T3: `plasma_casing` x4 (2 steel_plate, 1 aluminum_ingot, 1 tungsten_rod, 1900), `power_port` (2 copper_coil,
2 ceramic_insulator, 1 iron_plate, 1200), `steam_turbine` (1 chassis, 4 steel_plate, 4 copper_coil, 1600).
T4: `star_casing` x6 (2 superalloy, 1 fused_quartz, 2800); `star_core` takes 3 magnet_ring.

### Furnace tiers: upgrade costs of 17.2 and structures of 17.1
| tier | upgradeCost | wall (accepted) | inner min..max | ceiling | parts | crucibles |
|---|---|---|---|---|---|---|
| 2 | 4 bronze_ingot, 1 bellows | brick (+ the three above) | 1x1x1..3x3x3 | optional | - | min(5, xz + 1) |
| 3 | 2 copper_coil, 2 steel_plate | refractory_brick (+2) | 1x1x1..4x4x3 | required | 1 electrode | min(6, xz + 1) |
| 4 | 2 circuit, 2 tungsten_rod | plasma_casing, star_casing | 2x2x2..5x5x4 | required | 2 power_port | min(8, xz + 2) |
| 5 | 1 star_core, 4 deuterium_cell | star_casing | 3x3x3..5x5x5 | required | 4 power_port | 9 |
`FurnaceTierSpec.crucibles` is unchanged: it is the count of the unformed controller (all the game has until the sim
forms hearths); a formed hearth's count is `hearthCrucibles`.

### Machines (src/content/techMachines.ts, plus fluid ports on six existing machines in tech.ts)
| kind | role | fields | params |
|---|---|---|---|
| pump | consumer | drawW 50; fluids gives water, lava, crude_oil, 1000 L | litresPerS 200, litresPerBlock 1000, endlessMinBlocks 2, searchLimit 32 |
| tank | tank | fluids accepts/gives all five, 16 000 L | - |
| boiler | boiler | fluids accepts water, gives steam, 1000 L | minTempC 200, steamPerWater 10, steamLPerC 1, capLPerS 800, heatPerSteamL 20 |
| steam_turbine | generator | outputW 8000; fluids accepts steam, 1000 L | steamLPerS 800 |
| item_hatch | hearth_part | - | - |
| fluid_hatch | hearth_part | fluids accepts lava, 1000 L | lavaLPerFuel 1000 |
| power_port | hearth_part | power device | - |
| steam_engine | (generator) | + fluids accepts water, 1000 L | + pipedWaterLPerS 10 |
| electrolyzer | (consumer) | + fluids accepts water, 1000 L | + pipedWaterLPerS 100 |
| fission_pile | (generator) | + fluids accepts water, 2000 L | + pipedWaterLPerS 100 |
| combustion_engine | (generator) | + fluids accepts fuel, 4000 L | + fuelLPerCanister 1000 |
| still | (consumer) | + fluids accepts crude_oil, gives fuel, 4000 L | + oilPerRunL 500, fuelPerRunL 400, oilRunS 20 |
| geothermal_tap | (generator) | + fluids accepts lava, 2000 L | + lavaLPerRun 1000, lavaRunS 600 |
Every param is documented above its spec. Boiler: steam/s = clamp(steamLPerC (T - minTempC), 0, capLPerS), limited by
its water; it takes heatPerSteamL J of heat per litre (16 kW at full boil). Turbine: outputW x min(1, steam used /
steamLPerS) - 2 J of heat per J of power, better than the steam engine's 3. `pipedWaterLPerS`: piped water at that rate
replaces the water blocks (minWater / "cooled") and is used up at that rate.

### Objectives (44 now)
- `blast_furnace` text starts "Build a Blast hearth: brick walls around the furnace ...". `arc_furnace`, `plasma_furnace`
  and `starhearth` texts describe their hearths and the new costs.
- `pipe_ore` "Pipe it in" (age 1, place `item_pipe`) right after `blast_furnace`.
- `pump_water` "Pump water" (age 2, place `pump`) right after `arc_furnace`.

## 3. Progression solver (src/content/progression.ts)
- `hearthMaterials(tier): ItemAmount[]` - the smallest legal shell of a tier: `[own wall x count, electrode?, power_port?]`
  (tier 2: 16 brick; 3: 24 refractory_brick + 1 electrode; 4: 53 plasma_casing + 2 power_port; 5: 93 star_casing +
  4 power_port). An upgrade now needs these obtainable at the previous tier, besides its cost and temperature.
  `ELECTRODE_ITEM`, `POWER_PORT_ITEM` exported.
- A steam turbine is heat-driven (counts once, one furnace): it runs with a boiler owned and water to hand (bucket or
  pump), output from the boiler's steam at the hottest owned temperature.
- content.test.ts: the objective-order check counts hearth materials as consumed by the tier objective; the summary
  prints each tier's shell and raw budget. New `src/content/techContent.test.ts` (17 tests) and fixture
  `specRosterTech.ts`: fluids, fluid ports, pipe joins and heat rules, wrench, ages, the turbine, structure table,
  crucible column of 17.1, wall ranks, glowing twins on all faces, upgrade costs, smallest shells, every hearth buildable
  with the furnace before it, objectives. **The game stays completable**: every tier climbs, every recipe and objective
  is reachable in order.

## 4. Textures (src/render/textures/hearthShell.ts, transport.ts; 252 in TEXTURE_NAMES)
- Walls tile seamlessly cold and formed (in the tiling test). Formed twins are painted from the cold tile's random
  stream, so only the seams change: ember (brick), orange-white (refractory), violet (plasma), gold (star).
- Parts share an iron frame whose rim glows when formed; item hatch = bronze chute mouth, fluid hatch = flanged port with
  a sight glass (lava-lit when formed), power port = two ceramic bushings and a copper bus with the cyan pip, electrode =
  graphite rod end in a ceramic collar (blue-white tip when formed).
- Pipes: an 8/16 plus (rows/cols 4..11 opaque, corners clear - tested): bronze-ribbed glass tube, steel conveyor with a
  roller slot, iron with glass windows, ceramic-wrapped steel with straps. The centre is a flanged junction.
- Pump (volute, impeller blurs and shows water when running), tank (posts, sight glass with scale; riveted lid), boiler
  (copper drum, gauge needle rises, steam at the safety valve), steam turbine (bladed rotor, blurred when running), and
  `item_wrench`.
- `item_*` names are reserved for icons, hence `pipe_*` and `hatch_*` tile names. `building.ts` now exports `brick`.
- Reviewed on contact sheets (6-8x, 3x3 tilings, dark and sky), in the real game by day and night (a diorama of every
  block cold and formed) and as inventory icons at 390x844.

## 5. Sounds (src/audio/sfxTransport.ts; 50 patches)
- `hearth_formed` (1.9 s, priority 1): a deep whoomph (brown noise opening up, a sub sine gliding 48 -> 92 Hz, a pink
  roar) and a shimmer that rises after it (FM sine 660 -> 1320 Hz, tremolo triangle, airy noise). Measured in Chromium:
  peak 0.46, RMS -23.7 dB, the shimmer swells to its loudest at ~0.8 s; rebalanced from a bass-heavy first draft so a
  phone speaker hears it.
- `pipe_clunk` (0.23 s, jittered): a low triangle knock, a short metallic FM ring, a click. Peak 0.31, RMS -30.8 dB
  (level with `place`).
Measured, not listened to.

## 6. What the next engineers build on this
- **World (mesher, raycast)**: shape `pipe` is today drawn by a stand-in (`src/world/blockTables.ts` maps it to the cable
  code: a 6/16 core, arms only towards power devices). Draw a PIPE_CORE_MIN..MAX core with an arm towards every
  neighbour where `pipeJoins(pipe, neighbour)` (precompute per id pair or two per-id tables: pipe family, item/fluid
  endpoint), sampling the plus tile like cables; tint active (carrying) pipes slightly. A wrench-parted joint is per-pipe
  state in src/sim that the mesher cannot see (no free voxel bits for six directions): either draw the arm anyway with a
  render-side overlay, or agree a variant-bit scheme. `src/render/target.ts` `shapeBounds('pipe')` should return the
  core box.
- **Sim**: pipe networks per 16.4 (rebuild on pipe/endpoint place/remove, caps, packets, re-route, return, Blocked; fluid
  amounts, one fluid per network, priority split, mismatched joints refused, "Too hot for this pipe" via `pipeCarries`),
  port config `{ mode, distribution, filter (PIPE_FILTER_SLOTS), priority }` saved per pipe end, packets/amounts saved.
  Endpoints of 16.2 (`isItemEndpoint`/`isFluidEndpoint`; furnace smart sides; still oil runs; combustion engine fuel;
  geothermal lava; piped water rules; fluid hatch lava as fuel with `fuelReturns` not applying). Pump (BFS over liquid,
  endless water bodies, removes lava/oil blocks per 1000 L), tanks (stacks share level), boiler (on a furnace or hearth
  top, heat draw), turbine. Hearths per 17.1/17.3: validation scan, effective tier = min(controller tier, structural
  tier), `hearthScale` / `hearthCrucibles`, crucibles above the count lock, power through power ports, blowers in faces
  as tuyeres, `hearth:formed` / `hearth:unformed` + `sfx hearth_formed` + toast, the active bit on every shell block,
  and **the upgrade requiring the next tier's formed structure** ("Build a Blast hearth: brick walls around the furnace").
  Then the playthrough (src/sim/playthrough.test.ts, commented at the first upgrade) must build each hearth. Note: a
  blower's active bit already means "running" - leave machine parts' bits to their machine behaviour.
- **Player**: wrench on a pipe arm touching a block cycles push -> pull -> off (toast "Pulling from Blast Furnace", sfx
  `pipe_clunk`); on a pipe's centre toggles the joint to the targeted neighbour pipe. Use with an empty hand (or
  long-press) on a pipe opens the pipe screen (needs a ScreenRequest - none was added). Buckets on a tank or fluid
  endpoint: `fluidInBucket(held)` empties 1000 L and gives `bucket.empty`; an empty bucket takes 1000 L of a fluid where
  `bucketFilledWith(held, fluid)` is non-null.
- **Render**: the formed glow. Today the mesher makes a face emissive only for blocks with `lightActive`, so formed
  walls look right by day but their seams are dark at night. Needs an emissive mask for `_on` shell tiles (e.g. the
  bright seam pixels) brightened by the hearth's temperature, the interior molten glow, open-top shimmer and smoke,
  window glow, the formation light sweep (`hearth:formed` bounds), the ghost preview, items moving in pipes, fluid
  colours (`FluidSpec.colour`, `glow`) in pipe windows and tanks.
- **UI**: pipe screen (16.3), STRUCTURE tab and target-tier picker with materials (`smallestShell`, `hearthMaterials`
  idea), problem highlight. `ROLE_TEXT` in machineScreen.ts got `tank: 'Storage'`, `hearth_part: 'Hearth'`.

## Deviations from spec 16-17
- The wrench is a `tool` item without a ToolSpec (ToolKind unchanged): no mining effect, no wear.
- `BlockTextures.bottomActive`, `MachineRole` 'tank' / 'hearth_part', `FluidSpec.liquid` / `bucket` and the events
  `hearth:formed` / `hearth:unformed` are contract additions beyond the brief's list, made so the formed glow covers
  undersides and the sim, render and UI can share fluids and formation without guessing.
- Numbers the spec leaves open (my choices, documented on the specs): pump 200 L/s and its buffers; every capacityL;
  steam engine 10 L/s of piped water; electrolyzer/fission 100 L/s (spec: "piped water >= 100 L/s"); boiler 1 L/s
  per C over 200 up to 800 L/s at 20 J/L; still 20 s per oil run; combustion engine 4000 L buffer; pipe hardness 0.4.
- Shell area: the spec says loss x (shell area / 26) and "windows count double". I count the closed box's cells, each
  window double and, with an open top, each cell over the interior double - an open top loses a little more than a lid.
- Tuyeres multiply the size bonus (the size cap of x2 applies before them).
- Pipes have no active texture (the texture array is at 252 of WebGL2's guaranteed 256 layers).
- Tile names `pipe_*` / `hatch_*` instead of the block keys (`item_*` means "icon" to the texture tests and tools).

## Known gaps
- No behaviour (by design): section 6. The playthrough upgrades without hearths until the sim requires them.
- **Texture budget: 252 of 256** guaranteed layers. Anything more needs the renderer to check
  `MAX_ARRAY_TEXTURE_LAYERS` (real devices report 2048) or split the array; the content test caps at 256.
- **Balance**: the spec's casing recipes make the smallest Plasma shell cost ~114 iron ore and 29 wolframite, and the
  smallest Star shell ~432 iron ore, 295 copper ore, 113 silica, 103 wolframite and 53 spodumene (raw, see the content
  summary). That is a long grind on a phone; consider 4 casings per craft or a smaller star shell after playtesting.
- Formed walls do not glow at night until the renderer adds an emissive mask (seen in the real renderer).
- Sounds measured in Chromium, not heard.
