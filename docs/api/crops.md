# Crop growth (src/sim) - public API

Spec 12.4 (growth paragraph), data from the `crop` MachineSpec (docs/api/food.md). DOM-free, inside src/sim.
Files: `src/sim/cropRules.ts` (numbers, stage table, entity, lit/hydrated/rate rules), `src/sim/crops.ts`
(`CropField`: the cache, sleeping and stage swaps), `src/sim/crops.test.ts` (14 tests), wiring in
`src/sim/simulation.ts`. `npx vitest run src/sim/crops.test.ts`.

## Wiring

Nothing new to call. The existing `Simulation` follows `'block:changed'`: a crop block appearing creates (or adopts)
its entity, a crop block disappearing forgets it. `sim.tick(dt)` grows crops after the machines (so a lamp switched on
this tick already counts). `sim.resync()` after loading picks crop entities up like machines.

## Rules (all numbers from `machine('crop').params`)

- **Stage**: the block itself. Stage blocks are `<crop>_<n>` from `MachineSpec.blocks` (wheat, potato, carrot, 4
  stages each). A stage advance swaps the voxel id in place (`withId`, facing/active/variant bits kept, source
  `'sim'`, so the world re-meshes it asynchronously), keeps the entity, and emits `'crop:grew' { x, y, z, stage }`
  (0-based, 3 = ripe). Nothing else is emitted: no sfx, no toast, no `machine:placed` / `machine:removed`.
- **Growth**: `growS += rate x dt`; at `stageS` (100 s) the next stage. `rate` = 1 hydrated, `dryRate` (0.5) dry,
  0 when ripe, unlit or not on farmland. Ripe in 300 s hydrated, 600 s dry (the food engineer's reading of spec 12.4).
- **Lit**: (clock sunlight >= `minSunlight` 0.3 AND no opaque block anywhere above the crop) OR a lit lamp (a `lamp`
  machine whose voxel active flag is set: switched on and powered) within `lampRadius` (5, Euclidean between block
  positions) - any hour, underground too. Glass lets the sun through; leaves do not (they are opaque).
- **Hydrated**: a water block with |dx|, |dz| <= `hydrationRadius` (4) at the crop's y or y - 1.
- **Soil**: `farmland` directly below. Without it the crop holds still (it does not pop: whether a crop breaks when its
  farmland goes is a game-rules decision for src/game / src/player).
- **Harvest/removal**: the crop's entity is removed with no `player.give` (the block's drops are the harvest).

## Exports

From `src/sim` (index):
```ts
interface CropEntity extends BlockEntity { kind: 'crop'; growS: number }  // seconds of full-rate growth into the stage
const isCrop: (e: BlockEntity | undefined) => e is CropEntity;
interface CropView {
  x: number; y: number; z: number;
  crop: string;          // 'wheat' | 'potato' | 'carrot'
  name: string;          // block name, e.g. "Wheat (ripe)"
  stage: number;         // 0-based
  stages: number;        // 4
  ripe: boolean; soil: boolean; lit: boolean; hydrated: boolean;
  rate: number;          // 1, dryRate or 0 right now
  progress: number;      // 0..1 through the current stage (1 when ripe)
  nextStageS: number;    // at the current rate; 0 when ripe, Infinity while not growing
  ripeInS: number;       // at the current rate; 0 when ripe, Infinity while not growing
  status: string;        // "Ripe" | "Needs farmland" | "Needs light" | "Growing - stage 2 of 4"
}
```
New `Simulation` members:
| member | semantics |
|---|---|
| `cropView(x, y, z): CropView \| null` | what the crop there is doing (null: no crop, or its chunk was never seen loaded). Cheap; for a HUD target line or a tooltip. |
| `cropCount: number` | crops followed. `entityCount` still counts only furnaces, machines and crates. |
| `cropsAwake: number` | crops visited on a tick (diagnostic; the others sleep). |

Crops are **not machines** for every other query: `machineAt`, `machineView`, `machineSlots` return null for them,
they are never in a network (`networkAt`, `allNetworks`, `grid`), never in `stationSources`, never counted by
`entityCount`. The machine screen (`createMachineScreen`) therefore returns null for a crop, so no screen opens.

Internal but stable for the weather engineer (`src/sim/cropRules.ts`):
```ts
interface CropContext { sunUp: boolean }               // set once per tick by CropField.tick
function isLit(c: CropNode, ctx: CropContext): boolean
function isHydrated(c: CropNode, ctx: CropContext): boolean   // THE place hydration is decided
function growthRate(c: CropNode, ctx: CropContext): number
```
**Rain (spec 15)**: add e.g. `raining: boolean` to `CropContext`, set it in `CropField.tick` (pass it in from
`Simulation.tick` next to `sunlight`), and return `c.water || (ctx.raining && c.sky)` from `isHydrated`. Hydration only
changes the rate of a crop that is already awake (lit), so no wake-up logic is needed for rain.

## Performance design

- Each crop caches soil, open sky, water and lamp light. A block change refreshes only what it can alter: the
  column (opacity change above it, anything at y - 1), water appearing/disappearing within 4 columns at y or y - 1,
  a lamp turning on/off within 5 blocks, its chunk (or one within 4 blocks) loading or unloading. Lookups go
  through a per-column index; nothing scans per tick.
- Only crops that can grow are visited each tick. Ripe, unlit, off-farmland or unloaded crops sleep until a relevant
  change, or until the sunrise (the tick where sunlight crosses `minSunlight`; the whole crop list is walked once then).
- Refreshes are spread under a budget of ~1500 world reads per tick (a dry crop's water scan is 162 reads); a crop
  waiting for its refresh is credited the waiting time once refreshed, so the budget never costs growth.
- Measured (node, this machine; `crops.test.ts`, real `World`): 500 growing crops tick in 0.008-0.018 ms (stage swaps
  included), 0.0002-0.0008 ms at night (all asleep); after a load the 500 crops refresh over ~60 ticks at 0.17-0.31 ms
  each. The brief's bound is 0.3 ms per tick for 500 growing crops.

## Verification

- Unit tests: hydrated timing (100 s per stage, ripe at 300 s, then it stops, same entity), dry timing (200 s per
  stage), sleep at dusk and resumption at sunrise, water reach (4 horizontally, y and y - 1 only; removing and pouring
  water), no growth without farmland (and resuming when it is placed), open sky (stone above stops it, glass does not,
  leaves do), lamp at night under a stone roof (in reach grows, 6 blocks away does not, switching off / breaking the
  lamp stops it, unpowered lamp does not count), not-a-machine (no view, no network, no sfx/toasts/machine events,
  nothing given when broken, replanting starts at 0), sleeping costs, save/load mid-growth continues identically,
  waiting for an unloaded chunk then adopting the stored entity, old-style crop entities without `growS`, speed.
- Real game in headless Chromium (desktop, through `window.__hw`): a watered sun bed, a roofed bed lit by a powered
  lamp, and a dry bed. Stage blocks swapped and re-meshed on screen at 100 s; at night the lamp bed (and the sun-bed
  crops within 5 blocks of the lamp) ripened while the rest held still; the next morning growth resumed. No sfx,
  no toasts, no page errors.

## Deviations and decisions

- Crops do not emit `machine:placed` / `machine:removed` (they are not machines to the player; nothing listening
  for machines should have to filter them).
- A crop entity holds only `{ kind, x, y, z, growS }`. Crop entities saved before this change (plain machine-shaped
  entities) are adopted and start at `growS` 0.
- Losing farmland does not break the crop (see Soil above).

## Known gaps

- Rain hydration is left to the weather engineer (see above).
- `berry_bush` (spec 14, kind `berry_bush`, role `bush`, regrowS 300) was being added to content by another engineer
  while this was written; the simulation still treats it as an inert machine. Its regrowth (swap
  `berry_bush_bare` -> `berry_bush` after 300 s) would fit `CropField` with a one-stage family; not done here.
- `src/sim/simulation.ts` is now ~420 lines (it was 378 before; aim 350).
