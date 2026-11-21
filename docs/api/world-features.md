# World features - a richer world (spec 14, 12.4 wild plants, 13 lava, 16.5 oil pools)

World generation now builds the marsh, surface life for every biome, five kinds of tree, the deeper underground
(geodes, lakes, lava falls, cave glowcaps), ore outcrops on cliffs, oil seeps and the Old Works ruins with real
loot crates. Everything stays a pure, chunk-order-independent function of `(seed, cx, cz)`; the only thing that
is not in the generated voxels is a ruin's crate, which the `World` places through its entity API on first load.
Tests: `npx vitest run src/world` (86 tests; `features.test.ts` is new). Review: `node scripts/world-map.mjs`.

## Public API

Nothing changes for callers of `src/world` (index.ts exports are unchanged). New module-level functions, used by
the world itself, the map script and tests:

### worldgen.ts (unchanged signatures)
- `generateChunk(seed, cx, cz): Uint16Array` - stages: columns -> caves -> veins -> geodes -> underground lake ->
  lava fall -> cliff outcrops -> trees -> surface life -> cave glowcaps -> ruins.
- `biomeAt(seed, x, z): BiomeKey` - can now return `'marsh'`.
- `findSpawn(seed)` - additionally requires a wild wheat patch within 44 blocks (so plants lie within 48).

### terrain.ts
- `BIOME_KEYS` gains `'marsh'` (index `MARSH = 4`); `Column.wMarsh`, `Column.liquidTop` (y of the top liquid block).
- `LIQUID_OIL = 3`, `OIL_TOP_DUNES = 34`, `OIL_TOP_SCAR = 38`, `SURFACE_PEAT = 8`.
- `Terrain` gains noise fields `marsh`, `marshPool`, `oil`, `flora` (appended, so the older fields keep their seeds).

### flora.ts (trees)
- Kinds: `OAK`, `OAK_BUSH`, `OAK_BROAD` (2x2 trunk, root flares, 3-4 boughs, crown radius ~4.5), `PINE`,
  `PINE_TALL` (9-12 logs, wider skirts), `WILLOW` (marsh: wide flat crown with hanging leaf curtains), `SNAG`
  (scar: dead pine trunk with a bare stub).
- `TreeSite { x, z, base, kind, trunk, logs, bits }` (`pine` was replaced by `kind`; `logs` = log blocks, used by
  the spawn search); `newTreeSite()`, `treeInCell(t, gx, gz, out)`, `drawTree(voxels, x0, z0, site)`,
  `forEachTree(t, xa, za, xb, zb, reach, fn)`, `placeTrees(t, voxels, cx, cz)`.
- Broad oaks grow only in "broad cells" (even cells picked by a hash, ~2%); the 8 cells around a broad oak that
  actually grows stay empty. Both rules are pure functions of the cells, so trees stay order independent.

### plants.ts (surface life)
- `placeSurfaceLife(t, voxels, x0, z0, cols)`; `cropPatch(t, gx, gz, out): boolean` (wild crops; `CROP_CELL = 12`);
  `Patch`, `newPatch()`.
- Woodland grass: wild wheat/potato/carrot patches (radius 2-3, wheat half of them), berry bushes (patches, also
  marsh), meadows of ember poppies and skybells (flower noise, open ground), ferns and glowcaps under dense forest,
  frost lilies near frostfell, poppies near the scar, tall grass, rare dry shrubs; reeds on shores.
- Marsh: reeds and skybells along every pool, tall grass, ferns. Sand: cacti (1-3 tall, dunes), dry shrubs, reeds
  on shores. Snow: frost spires (packed ice under an ice spike, 5-13 tall centre with shoulders, one per 11x11 cell
  at most) and small spikes, frost lilies (denser in flower patches). Scar: basalt organ pipes (columns of 1-6
  `basalt_column` in patches), steam vent clusters (1-3 vents, at most one cluster per 13x13 cell), dry shrubs.

### underground.ts
- `placeGeodes(t, voxels, cx, cz)` - 7.5% of chunks: radius 3.3, 4.1 or 4.9, a basalt rind, a quartz ore shell and
  `crystal_cluster`s lining the inside; centres at y 13-19, above the deep-cave lava and below any lake bed, so a
  geode never opens under water. Replayed from the 3x3 neighbourhood like veins.
- `fillUndergroundLake(t, voxels, cx, cz, cols)` - 14% of chunks: a domed cavern (radius 4.5-5.5, 6-8 high, centre
  y 15-24, never above the column's cave limit) with water in its lower half; every water block that would touch air
  at its sides or below drains until the pool is contained; a gravel/clay bed; glowcaps crowd the shore so the
  grotto has its own light.
- `placeLavaFall(t, voxels, cx, cz)` - 30% of chunks: a lava column from a cave ceiling at y 15-30 to the floor plus
  a splash pool, never beside water.
- `placeCaveGlowcaps(t, voxels, x0, z0, cols)` - clusters on cave floors below the surface.

### ores.ts
- `placeOutcrops(t, voxels, x0, z0, cols)` - small ore clusters in bare surface rock: the faces of cliffs, terraces
  and gorges (cells of a column above its lowest neighbour; 1 in 8 clusters) and, more rarely, rock lying open on
  top (1 in 32). The ore follows the vein weights, biome multipliers and y bands of `ORE_VEINS`; most show in the
  scar's terraces and in mountain and river cliffs.

### ruins.ts and ruinCrates.ts (the Old Works)
- `RuinSite { x0, z0, w, d, floor, biome, bits, door, crateX, crateZ }`; `squareRuin(seed, sx, sz)` (the ruin of
  a `RUIN_GRID_CHUNKS` square, `RUIN_CHANCE`, up to 8 tries for level dry ground with no tree trunk or wild crop
  patch on it), `spawnRuin(seed)` (always 30-78 blocks from spawn, so its crate is within `RUIN_SPAWN_RADIUS`),
  `ruinsNear(seed, cx, cz)`, `drawRuin(voxels, x0, z0, site)`, `ruinCrateCells(seed, cx, cz)`.
- A ruin: a 5x5 to 7x7 room levelled into the ground; walls of stone brick / cracked / mossy (wet biomes) or a
  brick variant, crumbling (corners tallest, one side mostly fallen); a doorway; a `collapsed_furnace` built into
  the opposite wall facing the door with a 1-2 brick flue; rusted shells along the walls; rubble (sand in the
  dunes); fallen wall blocks around it; on some sites a row of rusted machines in the yard. The crate stands in an
  inner corner on the furnace's side.
- `ruinLootTier(x, y, z, spawn)` ('deep' beyond `RUIN_DEEP_DISTANCE` or at y <= `SEA_LEVEL - RUIN_DEEP_BELOW_SEA`),
  `ruinCrateSlots(seed, x, y, z, tier)` (27 slots, `rollLoot(lootTable(tier), mulberry32(hash32(seed, x, y, z)))`),
  `ruinCrateEntity(seed, x, y, z, spawn)` (a crate with the same fields as `src/sim` `createMachine('crate')`),
  `CRATE_VOXEL`.

### World (world.ts), EntityStore, EditLog
- On every `chunk:loaded` the World places that chunk's ruin crates: `setEntity(ruinCrateEntity(...))` then
  `setVoxel(x, y, z, CRATE_VOXEL, 'load')`, so the simulation adopts the stored entity exactly like a crate from a
  save (tested with the real `Simulation`: `machineSlots` returns the loot). It only does so when the cell was never
  edited and holds no entity; the placement itself is an edit, so a looted or broken crate never comes back, and
  old saves get their crates the first time those chunks load.
- `EditLog.has(cx, cz, index): boolean` (new).
- **Crates no longer pin chunks** (EntityStore): they never act on their own, and every machine or furnace that
  reaches into a crate (touching, or within 4 blocks) pins the chunks around itself. Without this every ruin the
  player walked past would keep 9 chunks loaded forever.

### scripts/world-map.mjs
- Colours for every new block; ruin crates drawn as yellow squares and listed with their distance to spawn;
  `--at=x,z` centres the map (and the section) on any position.

## Numbers (measured)
- `generateChunk`: ~0.6-0.7 ms warm in plain node (1.1 ms best batch inside vitest, 1.8 ms average with other test
  files running in parallel); the first chunk of a seed in a thread also pays the spawn search and spawn ruin
  (2-15 ms once). The test asserts the best of five 12-chunk batches is under 4 ms.
- Spawn ruin crate 27-57 blocks from spawn over 18 seeds. Ruins in about 65% of the 7x7-chunk squares (the rest
  fail the dice or find no level dry ground). Marsh covers roughly a fifth of the temperate land, never within
  150 blocks of the origin (every world still starts in woodland).

## Deviations from the spec
- Ruins appear in about 65% of the 7x7-chunk squares, not the 80% `RUIN_CHANCE` alone would give: steep or wet
  squares get none (a ruin needs level, dry ground).
- The ruin crate is placed by `World` at chunk load (an edit plus an entity), not written by `generateChunk`:
  generation must stay a pure voxel function, and an entity has to exist for the simulation.
- Crates do not pin their chunks (see above) - a change to the world engine's pinning rule of spec section 5.
- Oil pools sit at fixed levels (y 34 in the dunes, y 38 in the scar), sunk in a bowl whose rim is raised above
  the oil; deep dunes put them in hollows a few blocks below the crests.
- Lava falls are single columns (one block wide) with a one-block splash pool.

## Known gaps
- Generated berry bushes have no block entity until something changes them (the simulation creates one when a
  bush is picked and turns bare, like any machine block appearing).
- Steam particles and hiss above vents, and the cyan tint of glowcap/crystal light, are render work (see
  docs/api/world-content.md section 6); the world only places the blocks.
- Rusted shells inside a ruin can sit next to the crate; they need a bronze pickaxe, the crate does not.
- The oil texture tiles into a visible repeating pattern over a large pool (texture work, src/render/textures).
- `meshChunk`'s own timing test (src/world/mesher.test.ts, 25 ms) now meshes ~4% more faces on generated terrain
  (plants, ruins); it passes alone (12-21 ms) but can exceed 25 ms when the machine is heavily loaded.
