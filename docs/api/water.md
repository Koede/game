# Flowing water and source blocks (spec 18)

The player's request: "Let water flow like in Minecraft. Also when you pick up water and place it with a bucket have it
only work on source blocks and then you take that source block." Water now flows; every generated lake, river and pool
is made of still SOURCE blocks; a bucket takes one source and pours one source; pumps take sources.

Touches `src/world` (water states, the flow engine, the mesher), `src/render/shaders/chunk.ts` (scroll along the
flow), `src/player` (buckets, the bucket's ray, currents), `src/mobs/physics.ts` (currents), `src/sim/fluidMachines.ts`
(pumps), `src/content` (texts), `src/app/state.ts` (one line: the tick), `scripts/lib/e2eFeatures.mjs` (a new step).

Tests: `npx vitest run src/world/flow.test.ts src/world/meshLiquid.test.ts src/player src/mobs/physics.test.ts
src/sim/fluidPipes.test.ts src/sim/flowingWater.test.ts src/app/state.test.ts`.

## 1. Water states (src/world/water.ts)

A water voxel's variant bits hold its LEVEL, its active bit means FALLING:

```ts
WATER_ID: number                         // block id of 'water'
MAX_FLOW_LEVEL = 7                       // a level-7 cell spreads no further
WATER_SOURCE: Voxel                      // level 0, not falling (= makeVoxel(WATER_ID): what worldgen always wrote)
WATER_FALLING: Voxel                     // active bit + level 1 (lands as the strongest flow)
flowingWater(level: number): Voxel       // level 1..7
isWater(v) / isWaterSource(v) / isFlowingWater(v) (water, not a source) / isFallingWater(v): boolean
waterLevel(v): number                    // 0 source, 1..7 (falling reads 1)
isLiquidSource(v): boolean               // lava and oil blocks always (they never flow); water only at level 0
WASHABLE_KEYS: readonly string[]         // tall_grass, fern, ember_poppy, skybell, frost_lily, dry_shrub, reeds
WASHABLE: Uint8Array                     // by masked block id
isOpenForWater(v): boolean               // air or a washable plant
waterHeight(v): number                   // own surface height: sources and falling 14/16, level L (8 - L) / 9
currentStrength(v): number               // 1 for sources, falling and level 1 .. 1/7 at level 7
CURRENT_SPEED = 1.4                      // m/s of the current in level-1 water
interface VoxelReader { getVoxel(x, y, z): Voxel }          // an IWorld fits
flowDirection(read, x, y, z, out: {x, z}): {x, z}           // unit vector (0, 0 when still)
currentAt(read, x, y, z, out: {x, y, z}): boolean           // the current there in m/s; falling water: out.y = -1
refillsAsSource(read, x, y, z): boolean  // the new-source rule: >= 2 horizontal sources and a source or solid below
```

Flow direction: water runs from lower levels towards higher ones; flowing cells also run towards open neighbours (the
tip of a stream). Sources only feel flowing neighbours, so a lake whose shore meets air looks still, exactly as it is.

## 2. The flow engine (src/world/flow.ts)

`World` owns one: `readonly water: WaterFlow`. **The game ticks it**: `GameState.tick` calls `world.water.tick()` right
after `sim.tick` (20 Hz, so it pauses with the game and catches up with it).

```ts
FLOW_DELAY_TICKS = 5      // 0.25 s per step of spread
FLOW_MAX_PER_TICK = 256   // cells looked at per tick; the rest carry over, oldest first
FLOW_SEEK_DISTANCE = 4    // how far sideways spreading looks for a drop
class WaterFlow {
  constructor(host: FlowHost)                 // { chunk(cx, cz): Uint16Array | null; setVoxel(x, y, z, v, source) }
  changed(x, y, z, from, to, source): void    // the World calls it after every setVoxel
  chunkLoaded(cx, cz): void                   // the World calls it on 'chunk:loaded'
  tick(): void
  stats(): FlowStats                          // { pending, deferred, updates, changes, lastTickMs, maxTickMs }
  toJSON(): WaterSnapshot                     // { queue: [x, y, z, ticksLeft, ...], deferred: [cx, cz, x, y, z, ...] }
  load(snapshot | undefined): void            // undefined = an older save: nothing pending
  clear(): void
}
checkWaterSnapshot(snapshot | undefined): void   // throws on malformed data
```

- **Waking.** Every `World.setVoxel` wakes the water cells at and around the changed cell (6 neighbours), each looked at
  FLOW_DELAY_TICKS later (a cell already waiting is not queued twice). A flag-only change of a non-water block (a
  machine's active bit) wakes nothing, and nor does source `'load'` (a save being restored, a ruin crate, scenery in
  tests) - **a freshly generated or loaded world never moves on its own** (tested over 12 seeds: 0 updates).
- **Unloaded chunks.** A cell whose column or any of its four neighbours' columns is not loaded waits for that chunk
  (`deferred`) and is woken when it loads. Reads further out (the drop search) see an unloaded cell as solid.
- **Rules of one cell** (a source never changes itself; it only spreads):
  1. A non-source cell takes its state from its neighbours: FALLING when water is above it; a SOURCE when
     `refillsAsSource`; else flowing at one level weaker than its strongest *feeder* - a horizontal neighbour that is
     resting (below: solid, or a source when the neighbour is itself a source) and stronger than the cell; with no
     feeder a flowing cell is *orphaned* and recedes one level per update (falling water with nothing above and no feeder
     is gone at once). Orphans do not spread.
  2. Then it pours down into open space (air, a washable plant, or flowing water that is not falling) as FALLING water
     and does nothing else; or, resting, it spreads sideways at the next level into the open or weaker cells among the
     directions whose path through open cells reaches a drop soonest (within 4; all open directions when none is near).
- Writes are `'sim'` edits through the World (re-meshed asynchronously; every module sees `block:changed`), so each
  write wakes the next cells. Washable plants are overwritten (no drop); crops, torches, machines, pipes, cables and
  every other block stop the water.
- **Save.** `WorldSnapshot.water?: WaterSnapshot` (version stays 1). The queue keeps its order and the ticks left, so a
  world saved mid-flow continues exactly as it would have (tested through `World` and through `GameState`). A damaged
  water snapshot logs a warning and loads with nothing pending - never a reason to lose the world.

Measured: a 7-level flood on flat ground (113 cells, 8 busy ticks): node/vitest mean 0.26-0.36 ms per busy tick, worst
0.5-0.8 ms (cold); plain node mean 0.09 ms; the built game in headless Chromium after warm-up mean 0.10 ms, max 0.3 ms
(the first flood of a session up to 1.8 ms while the code is compiled).

## 3. Drawing it (src/world/meshLiquid.ts, mesher.ts, src/render/shaders/chunk.ts)

- `liquidShape(v, id, p, x, y, z)` fills `LIQ { h: Float32Array(4) (corner heights, index i + 2j), moving, fx, fz }`.
  A cell's own height is `waterHeight` (full 1 under the same liquid, and for sources under an opaque cover as before);
  each top corner averages the up-to-4 cells of that liquid around it, and is full when any of them has that liquid
  above - so neighbouring cells share corners and the surface is one slope, a pool rises to meet a falling column, and
  no gap opens. Lava and oil use the same corners (their cells are all sources: unchanged except next to a lava fall).
  Worked out only at the cell's first visible face (most cells of a lake show none).
- Side faces take the corner heights for their top edge. **Moving water** (any non-source) marks its side faces with
  the liquid bit 4 and bit 2 (`LIGHT_FLAG_LIQUID | LIGHT_FLAG_SWAY`), v pointing DOWN, the tile stretched x2
  (`FALL_STRETCH = 0.5`) and a lighter face shade (0.95 instead of 0.65 / 0.8: a waterfall reads as water, not a dark
  pillar). A top face whose `flowDirection` is not zero gets the same two bits and texture coordinates rotated so v runs
  along the flow (the cell's offset taken modulo the tile, keeping the numbers small for mediump).
- Shader: bit 2 alone still sways plants; with bit 4 it means moving water: `uvShift = (0, fract(uTime *
  WATER_SCROLL))`, `WATER_SCROLL = 0.9` tiles a second, so the texture runs along the flow on top and down the sides.
  The still-water drift is now `fract(...)` too (same look, no precision loss on phones after a long session). No
  vertex attribute, uniform or texture layer was added.

## 4. Buckets (src/player/buckets.ts, raycast.ts, controller.ts)

- `raycast(..., liquids: LiquidAim, out)` with `type LiquidAim = boolean | 'sources'`. `'sources'` (an empty wooden or
  bronze bucket in hand) looks through flowing water for the first liquid SOURCE; `RayHit.throughFlow?: boolean` says it
  crossed flowing water, and when nothing lies behind the flow within reach the first flowing cell is returned as the hit.
- Empty bucket: a water source is taken and **removed** (`'player'` edit; the water around reacts: a hole in a lake fills
  again as a source within 0.25 s, a lone source is gone). Aiming through or at flowing water with no source behind it
  refuses with `BUCKET_HINTS.flowing` ("No still water in reach - a bucket takes a source block, not flowing water");
  plain ground stays silent. Lava (bronze bucket) as before.
- Water bucket: pours a SOURCE into the targeted cell - air, a washable plant (aimed at directly: it is washed away) or
  flowing water; never onto a source or another liquid. Lava bucket unchanged.
- Tanks and fluid endpoints go through `sim.bucketUse` first, as before (unchanged).

## 5. Currents (src/player/physics.ts, src/mobs/physics.ts)

- Player: the current at the feet, else at the waist (`currentAt`) is added to the velocity the intent eases towards,
  so standing or swimming in a stream carries you along it (1.4 m/s in level 1, weaker downstream, still water and lakes
  push nothing). Falling water pulls a swimmer down at 10 m/s^2; swimming up still climbs it at about 2 m/s.
  `PlayerPhysics.current` holds this step's current.
- Animals: the same current is added to their sweep (the brain's velocity is untouched); under a waterfall they sink at
  up to 2.5 m/s instead of floating.

## 6. The simulation and content

- Pumps (`pumpSource`, `drainBlock`): only a touching liquid SOURCE is drawn (flowing water never). A water source that
  `refillsAsSource` never runs dry; any other source (a lone puddle, a thin line, lava, oil) loses the farthest source of
  its connected body (BFS over sources, <= 32) per 1000 L. Status "Must touch still water, lava or oil". The content
  param `endlessMinBlocks` is gone (`litresPerS`, `litresPerBlock`, `searchLimit` remain).
- Every "water nearby" rule already counted the `water` block id, so flowing water counts (steam engine, water wheel,
  fission cooling, electrolyzer, crop hydration) - now tested (`src/sim/flowingWater.test.ts`), including the machines
  noticing when the flow dries up.
- Texts: Bucket ("Use it on still water to take one source block - flowing water slips out. A lake refills the gap; a
  lone puddle is gone."), Water Bucket, the water block, the pump (block, machine description, placement hint) and the
  `pump_water` objective explain sources; nothing says "endless spring" any more (a content test checks it).
- The playthrough's roof pool is 2x2 (a 1x2 pool is no longer endless).

## 7. Verified in the built game

`npm run build` to a scratch directory, headless Chromium through `scripts/lib/browser.mjs` and `window.__hw`, at
1280x800 and 390x844 (touch): a channel dug from a pond fills one block per 0.25 s and stops at level 7 (the texture
runs along it); a water bucket poured on a terraced hillside runs straight down the steps to the nearest drops, little
falls at each step, grass and flowers washed away; an empty bucket at a lake edge takes the source and the hole fills
again; a poured puddle spreads into a diamond (and runs off towards the pad's edge), and taking its only source drains it
ring by ring; a spring on a 7-high cliff top runs to the edge and falls as a column whose sides stream downwards, then
spreads around the foot; swimming into the foot of the fall the current carries the player away. Frames 0.35 s apart
differ only in the water. `scripts/lib/e2eFeatures.mjs` gained a step (pour, flow, take the source, drained) - passes on
desktop; `scripts/e2e-tech.mjs` (bucket into a tank and back) passes on desktop. On the phone both scripts failed at
earlier, unrelated steps in this run (taps read as holds on slow software frames, and the build included other
engineers' unfinished UI work); the same water actions passed on the phone in the scene script.

## Deviations from the spec

- Falling water is stored as level 1 + the active bit (so variant 0 always means a source).
- Flowing water that lands on a source joins that body instead of spreading a film over it (the spec's "resting on
  water" is kept for sources stacked on water). A source hanging over air only pours down (it is not resting).
- Feeders must be stronger than the cell they keep alive (otherwise two cut-off cells keep raising each other in a
  checkerboard); with no feeder a flowing cell recedes one level per update - "lowest neighbour + 1" with that guard.
- `'load'` edits wake no water; a non-water block's flag change wakes none either.
- The pump's endless rule is the new-source rule itself (>= 2 horizontal sources AND a source or solid below), so a
  pump and a bucket agree with what the flow engine would refill.
- The bucket's "no source" toast only appears when the ray met flowing water.

## Known gaps

- Lava and oil stay still; water and lava do not react to each other.
- Every flow change is a world edit: the edit log (and the save) remembers each cell water ever touched, ~5 characters
  each, even after it dried up.
- One scroll speed for all levels; corner heights only average cells of the same liquid, so a stream's edge stands up
  against air (as the spec says) rather than sloping down to it.
- Waking a generated source next to air (a lake shore where terrain dips below the water line) makes it spread; that is
  the rule, but it can surprise near odd terrain.
- Not run on a real phone; timings from software GL in a shared container.
