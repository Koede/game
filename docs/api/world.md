# src/world - public API

The voxel world engine: deterministic worldgen, stateless lighting, the chunk mesher, the chunk worker and
its pool, and `World` (implements `IWorld`). Everything except `workerPool.ts` is DOM-free and runs in
node and in a Web Worker. Import from `src/world` (index.ts). 66 unit tests: `npx vitest run src/world`.

## Wiring in main.ts

```ts
import workerSource from 'virtual:worker';            // the bundled chunk worker (scripts/build.mjs)
import { World, WorkerPool } from './world';

const world = new World(seed, bus, { pool: new WorkerPool(workerSource) });
const spawn = world.spawnPoint();                     // feet block; stand at x + 0.5, z + 0.5
world.ensureLoadedAround(spawn.x, spawn.z, 1);        // voxels under the player right now (sync)
// every frame, AFTER the player controller ran (so its edits show this frame), BEFORE rendering:
world.update(player.x, player.z, settings.renderDistance, 4 /* ms budget */);
// loading screen: wait until world.isReadyAround(spawn.x, spawn.z, 2)
```

The world does not import `virtual:worker` itself, so node tests never need it. `new World(seed, bus)`
without a pool builds chunks on the main thread (tests, tools).

## World (world.ts)

- `new World(seed: number, bus: GameBus, options?: WorldOptions)`; `WorldOptions { pool?: WorkerPool }`
- `static fromJSON(snapshot: WorldSnapshot, bus: GameBus, options?: WorldOptions): World`
- `get seed(): number`; `readonly bus: GameBus`; `readonly pool: WorkerPool`

IWorld:
- `getVoxel(x, y, z): Voxel` - coordinates are floored; corestone below y 0, AIR at y >= 96 and in unloaded chunks.
- `getBlock(x, y, z): BlockDef`
- `setVoxel(x, y, z, voxel, source: ChangeSource = 'player'): boolean` - false when y is out of range or the
  chunk is not loaded; true and no event when the voxel is already that value. Otherwise stores the edit
  forever, emits `block:changed {x, y, z, from, to, source}` and marks meshes dirty:
  - `source 'player'`: the chunk is re-meshed on the main thread in the next `update()` (same frame when the
    controller runs first). If the edit changed the block id on a chunk border, the face-sharing neighbour
    is re-meshed synchronously too (no hole for a frame); the diagonal one asynchronously.
  - `'sim'` / `'load'`: the same chunks are re-meshed asynchronously with priority.
  - Lighting: after every mesh, each neighbour whose last mesh saw different light along the shared border
    is re-meshed asynchronously with priority (see "lighting ripple" below).
- `isLoaded(x, z): boolean`, `surfaceY(x, z): number` (highest non-air y, -1 when unloaded)
- `getEntity(x, y, z)`, `setEntity(entity)` (adds or replaces by position), `removeEntity(x, y, z)`,
  `entities(): Iterable<BlockEntity>` (all of them, loaded or not). Entity objects are stored as given
  (by reference).

Streaming and extras:
- `update(playerX, playerZ, renderDistance, budgetMs): void` - once per frame. Re-meshes player edits,
  hides chunks that left the view, unloads far ones, starts generate/mesh jobs nearest first; in main-thread
  mode runs jobs for what is left of `budgetMs` (at least one per call when the budget is positive).
  Render distance is clamped to 1..32 (`MAX_RENDER_DISTANCE`).
- `ensureLoadedAround(x, z, radiusChunks): void` - generates every missing chunk within that Chebyshev
  radius on this thread, now (about 1-2 ms per chunk). Meshes still come from `update()`.
- `isReadyAround(x, z, radiusChunks): boolean` - every chunk in view within the radius has been meshed.
  False before the first `update()`.
- `chunkVoxels(cx, cz): Uint16Array | null` - the live voxel array of a loaded chunk (index with
  `voxelIndex`); read only, change voxels through `setVoxel`.
- `spawnPoint(): {x, y, z}` (= `findSpawn(seed)`), `biomeAt(x, z): BiomeKey` (for Survival's BiomeLookup).
- `stats(): WorldStats` - `{ loaded, meshed, generating, meshing, urgent, queued, pinned, entities, edits,
  editedChunks, generateMs, meshMs, mode: 'workers' | 'main', workers }` for a debug overlay
  (`generateMs`/`meshMs` are running averages of job time where the jobs ran).
- `toJSON(options?: { shared?: boolean }): WorldSnapshot` - (entities are deep copies; `shared: true` hands the live
  entity objects to a caller that serialises at once - the autosave, `GameState.toSaveJson`) `{ version: 1, seed, edits: Record<"cx,cz", base64>, entities: BlockEntity[] }`,
  plain JSON (entities deep-copied). Edits are base64 of little-endian uint16 pairs (voxel index, voxel):
  about 5.3 characters per edited voxel.
- `load(snapshot): void` - replaces everything: emits `chunk:hidden`/`chunk:unloaded` for every chunk, then
  streams again with the snapshot's seed, edits and entities. Throws on a malformed or newer snapshot
  before changing anything. `WORLD_SNAPSHOT_VERSION = 1`.
- `dispose(): void` - stops streaming; disposes the pool only if the World created it.

### Streaming rules
- A chunk at offset (dx, dz) from the player's chunk is meshed when dx² + dz² <= r² + r (circle of
  radius r + 0.5) and hidden again only past r + 1.5. Voxels are kept for every chunk in view and its 8
  neighbours (a mesh needs the 3x3 neighbourhood), and unloaded only past r + 3 (Chebyshev, `UNLOAD_MARGIN`).
- Chunks pinned by block entities (the entity's chunk and its 8 neighbours, spec section 5) are never
  unloaded, and are generated after the chunks in view even when far away (e.g. after loading a save).
  They are not meshed unless in view. Two kinds of entity pin nothing (`EntityStore` in entities.ts): crates,
  and wild bushes (machine role `'bush'`, the entity a picked berry bush gets), which only regrow and are woken
  by src/sim on `chunk:loaded`. Planted crops and every machine still pin.
- Edits are applied over freshly generated voxels before `chunk:loaded` is emitted.

### Events (GameBus)
- `chunk:loaded {cx, cz}` / `chunk:unloaded {cx, cz}` - voxel data arrived / was dropped.
- `chunk:meshed {mesh}` - new or replacement mesh; the renderer owns the buffers.
- `chunk:hidden {cx, cz}` - **appended to core/gameEvents.ts by this module**: drop this chunk's mesh, it
  left the view (voxels may stay loaded, e.g. pinned chunks). Emitted before `chunk:unloaded` when a drawn
  chunk is unloaded. A later `chunk:meshed` brings it back.
- `block:changed` - every successful `setVoxel` that changed a voxel.

## Mesh data (mesher.ts) - for the renderer

`meshChunk(input: MeshInput): ChunkMeshData`; `MeshInput { cx, cz, chunks: ChunkNeighborhood, light? }`;
`meshBuffers(mesh): ArrayBuffer[]` (the 15 transferable buffers); `LIQUID_SURFACE = 14/16`.
- Positions are chunk-local: place the mesh at (cx * 16, 0, cz * 16). Arrays are exactly sized.
- Triangles are counter-clockwise seen from outside. Plant quads are emitted once per side, so back-face
  culling is safe for opaque and cutout. Liquid and glass faces are single-sided too: draw the translucent
  batch double-sided if the water surface should be visible from below.
- uv (0,0) is the bottom-left of a face seen from outside, v up; top/bottom faces have u pointing east.
  Partial shapes (slab, torch, cable, lowered liquid) sample the matching part of the 16x16 tile.
- `light` bytes per vertex: `[sky * 17, block * 17, shade, flags]` - sky and block light 0..15 scaled to
  0..255 and smoothed (average of the up-to-4 non-opaque cells at the vertex); `shade` = face shading (top 1,
  bottom 0.5, north/south 0.8, east/west 0.65) x ambient occlusion (0.5, 0.67, 0.84, 1) x 255. Multiply
  sky light by the clock's sunlight factor in the shader. Flags: 1 emissive (draw full-bright), 2 sways
  (plant tops), 4 liquid surface.
- Batches: opaque (cubes, slabs, cables, lava with the emissive flag), cutout (plants, torches),
  translucent (water, glass). Emissive faces: lava; a torch's tip (its post is not); the faces of a block
  whose active texture differs from its inactive one while its voxel emits light (a lit furnace's mouth, a
  lit lamp's sides).

## Lighting (lighting.ts)
- `computeLight(chunks: ChunkNeighborhood): Uint8Array` - LIGHT_VOLUME bytes covering the chunk plus a
  1-cell border on every side (also above and below); sky light in the high nibble, block light in the low
  one (`skyLightOf(cell)`, `blockLightOf(cell)`, `lightIndex(lx, y, lz)` with lx, lz in -1..16, y in -1..96).
  Sky light 15 under open sky, -1 per block sideways/down, -3 per block of water; missing neighbours count
  as open air. Exact for the chunk and its border.
- `borderHashes(light): Uint32Array` - hash of the light on each side (+X, -X, +Z, -Z), two cells deep,
  in world order: a chunk's +X hash equals its east neighbour's -X hash exactly when both meshes saw the
  same light there. **Lighting ripple:** after a mesh, any neighbour whose stored hash of the shared border
  differs is re-meshed. A unit test makes random edits (torches, lit furnaces, water, digging near borders)
  and checks that every drawn mesh then equals a fresh mesh of the current voxels.

## Worker pool (workerPool.ts) and jobs (jobs.ts, worker.ts)
- `new WorkerPool(source: string, options?: WorkerPoolOptions)`; `WorkerPoolOptions { workers? (1..4,
  default cores - 1), createWorker?(url) => WorkerLike, readyTimeoutMs? (6000) }`.
  Starts the workers from a Blob URL. Falls back to the main thread when the source is empty, Worker is
  missing, creation throws, a worker fires `error`, or no worker reports ready in time (unfinished jobs are
  re-run on the main thread; a console warning says why).
- `run(job, wanted?): Promise<Result | null>` - `wanted()` is asked right before the job starts; false
  skips it (resolves null). Rejects when the job throws.
- `pump(budgetMs)` - main-thread mode only: runs queued jobs until the budget is spent.
- `mode: 'workers' | 'main'`, `workerCount`, `fallback: string | null` (why it runs on the main thread),
  `pending`, `capacity`, `dispose()`.
- `runJob(job)`: `{type: 'generate', seed, cx, cz}` -> `{voxels, ms}`; `{type: 'mesh', cx, cz, chunks}` ->
  `{mesh, borders, ms}`. `resultTransferables(result)`. The worker answers `{ready: true}` once, then
  `{id, result}` or `{id, error}` per request.

## Worldgen
`generateChunk(seed, cx, cz): Uint16Array`, `biomeAt(seed, x, z): BiomeKey`, `findSpawn(seed): {x, y, z}`,
`SPAWN_RESOURCE_RADIUS = 48`. Review terrain with `node scripts/world-map.mjs`. The marsh, surface life, tree
kinds, the underground, outcrops, oil seeps and the Old Works ruins (whose loot crates the World places on chunk
load; crates no longer pin chunks) are described in `docs/api/world-features.md`.

Also exported: `Chunk`, `chunkCoord`, `localCoord`, `chunkKey`, `keyChunkX`, `keyChunkZ`, `ChunkNeighborhood`,
`EditLog`, `EditsSnapshot`.

`chunkKey(cx, cz)` is one number per chunk column, decoded by `keyChunkX` / `keyChunkZ`. Within |cx|, |cz| < 8192
(131072 blocks each way) keys are below 2^28, V8 small integers, so the Map lookups behind every `getVoxel` and
`isLoaded` allocate nothing (the old 2^31-sized keys boxed a heap number per lookup: ~2.7 MB per 336k lookups
measured, now ~0). Columns farther out, up to |cx|, |cz| < 32768, get distinct larger keys (correct, only slower).
Keys live only in memory: saves name chunks `"cx,cz"`.

## Measured
- node (warm): generateChunk ~1-2 ms, light + mesh ~2.7 ms per chunk.
- Headless Chromium, render distance 6 around spawn, 3 workers: 193 chunks generated, 137 meshed, first
  chunk after ~75-100 ms (worker start-up), all meshed after 0.7-1.0 s; main-thread frames stayed under 2 ms.
  Main-thread fallback: the same 137 meshes in ~1.6 s with frames up to ~13 ms (one job may exceed a small
  budget). Results identical in both modes.
- A player edit costs 2-3 ms on the main thread; with the CPU throttled 4x (a slow phone) 8-14 ms, and
  20-28 ms when the edit is on a chunk border (two chunks re-meshed synchronously).

## Deviations from the spec
- Appended the event `chunk:hidden` to src/core/gameEvents.ts (the renderer must listen to it).
- Liquid surfaces are not lowered when the block above is opaque (water under ice), so no 2/16 gap opens.
- Torch: a post (0..8/16) plus a separate emissive tip (8/16..10/16), 10 quads, instead of one box with a
  glowing upper edge, so the flame is crisp and the stick is not lit up.
- Cable arms get an end cap when they meet a device that does not fill its cell (solar panel slab).
- Faces of slabs and cables glow by the same active-texture rule as cubes.
- The world does not import `virtual:worker`; main.ts passes the source to `new WorkerPool(source)`.

## Known gaps
- An edit on a chunk border costs two synchronous meshes (see Measured); on slow phones that can drop a frame.
- A light change in a chunk that is loaded but not drawn (e.g. a pinned furnace just outside the view)
  marks its drawn neighbours for re-meshing; light changes two chunks away through undrawn chunks are not
  followed (they show up when those chunks are next meshed).
- Chunks whose generation threw are not retried for the rest of the session (logged with console.error).
- `streamer.ts` (367 lines) and `mesher.ts` (354) are a little over the 350-line aim.
- The renderer is not built yet, so meshes were checked by unit tests and counts/timings in the browser,
  not by looking at them.

## Later additions (feature visuals, see docs/api/render-machines.md)
- Shape `pipe` is meshed for real (`src/world/meshPipe.ts`): core, arms to every same-family neighbour
  (`PIPE_JOINS` / `PIPE_FAMILY` = registry.pipeJoins), collars at endpoints; item pipes in the translucent batch.
- Light colour: `computeLight(chunks, hueOut?)`, `MeshInput.hue`; flags byte bit 3 = violet, bits 4-7 = cool share
  of the block light (`LIGHT_FLAG_VIOLET`, `LIGHT_COOL_SHIFT`, `LIGHT_COOL_MAX` from mesher.ts). `LIGHT_HUE[id]`.
- The quad machinery of the mesher lives in `src/world/meshQuads.ts`.

## Flowing water (spec 18, see docs/api/water.md)
- Water flows: `World.water` (`WaterFlow`, src/world/flow.ts) is a scheduled cellular update woken by `setVoxel`
  (never by `'load'` edits) and ticked by the game at 20 Hz; its pending queue is `WorldSnapshot.water` (optional,
  version still 1). Water states and lookups in src/world/water.ts (level in the variant bits, falling = active bit).
- The mesher draws liquids with per-corner heights (src/world/meshLiquid.ts; `LIQUID_SURFACE` moved there and is
  re-exported) and marks moving water with flags bits 2 + 4, its texture coordinates turned along the flow.
