# src/render/textures - public API

Pure, deterministic, DOM-free pixel painters (safe in node and workers). Import from `src/render/textures`.

```ts
export const TEXTURE_SIZE = 16;
export function paintTexture(name: string): Uint8ClampedArray;
export function hasPainter(name: string): boolean;
export function averageColor(name: string): [number, number, number];
```

- `paintTexture(name)` - 16x16 RGBA, 1024 bytes, row-major, **top row first**: row 0 is the top of a side
  face seen from the front (the mesher's v points up, so the uploader must put row 0 at v = 1, or flip). Top
  and bottom textures are drawn so their orientation does not matter. Always a fresh array (results are cached
  internally and copied), so callers may mutate it. Works for any string: names without a painter return a
  magenta/black checker (4 px squares). `missing` (layer 0) is that checker by design.
- `hasPainter(name)` - true for every one of the 164 entries of the registry's `TEXTURE_NAMES`, false for
  anything else (own properties only: `toString`, `__proto__` are false).
- `averageColor(name)` - mean colour of the pixels with alpha >= 128 (of all visible pixels if none reach
  128), rounded to integers 0..255. Meant for debris particles; cheap after the first call (cached tile).

Painting all 164 tiles from scratch takes well under a second in node (the test caps it at 1.5 s).

## Pixel conventions the renderer and UI can rely on
- **Opaque**: every face of cube, slab and lava blocks, idle or active, is alpha 255 everywhere. Leaves are
  opaque cubes in this game's content, so they have no holes (dark depths instead).
- **Translucent**: `water` is alpha 205 everywhere. `glass` has an opaque 2px frame (alpha 255), a pane of alpha
  46 tinted pale cyan, and a few glints at alpha 190-210.
- **Cutout**: `tall_grass`, `dry_shrub`, `torch` use only alpha 0 and 255.
- **Torch**: the 2px post is columns 7-8, rows 8-15; the flame covers columns 7-8 in rows 6-7 (what the mesher's
  10/16 post and its top sample) and is drawn wider above for the flat item icon.
- **Cables** (`copper_cable`, `heavy_cable`, `super_cable`): an opaque plus - rows 5..10 and columns 5..10,
  exactly the 6/16 core and arms the mesher samples - with transparent corners. Each band carries lengthwise
  stripes so an arm looks like a cable from every side; the centre is a junction collar. The same tile is the
  cable's flat item icon.
- **Lit faces**: `*_front_on`, `lamp_on` and every furnace `_front_on` are drawn knowing that the mesher marks the
  whole face emissive (full-bright) when the block has `lightActive`: furnace fronts fall off into shadow away
  from the mouth and catch its light near it. Every powered machine front has the same power pip in its
  bottom-right corner (x 12-13, y 12-13): dark teal when idle, cyan when running.
- **Item icons** (`item_*`, 60): transparent background, alpha 0/255 only, a 1px outline darker than the pixels it
  touches, lit from the top left. Category silhouettes: ingots (trapezoid bar), plates (flat lozenge with rivet
  holes), crushed ore (pile of angular chunks), powders (smooth mound), rods (diagonal bar, graphite thicker),
  cells (upright capsule), wire (loose loops), coil (wound drum). Tools share one handle; heads differ by material
  (flint is chipped and cord-lashed, bronze gold-brown, iron grey, steel blue-white); the power drill is a hazard-
  yellow pistol drill.

## Files (all internal; only index.ts is public)
`index.ts` API and cache - `painters.ts` merges the families - `canvas.ts` pixel canvas, seeded per-texture
randomness (tileable value noise, scatter, Voronoi cells, sprites, outline) - `palette.ts` five-step ramps -
`brush.ts` cracks, bevelled cells, strata, bevels, rivets - `shapes.ts` icon silhouettes - families:
`terrain.ts`, `ores.ts`, `plants.ts`, `building.ts`, `furnaces.ts`, `casing.ts` (machine_side/top, front plate,
pip), `generators.ts`, `consumers.ts`, `grid.ts` (cables, battery, lithium bank), `iconsMaterials.ts`,
`iconsTools.ts`, `iconsParts.ts`.

Every texture's random stream is seeded by its own name, so a tile never depends on what was painted before it.
Ores in stone paint the exact `stone` tile under their flecks (they blend into the rock around them); the deep
ores (wolframite, spodumene, pitchblende) share a darker layered host rock of their own.

## Review tools
- `node scripts/texture-sheet.mjs --out=<dir> --scale=6` - every tile on dark and sky backgrounds.
- `npx vitest run src/render/textures` - 16 tests: API (fresh arrays, checker, coverage of every TEXTURE_NAMES
  entry, determinism in any order, averageColor), no blank/flat/duplicate tile, opacity rules per block shape,
  water/glass alpha, torch and cable regions the mesher samples, seamless wrap of 24 featureless terrain tiles,
  ores keep the stone host untouched between flecks, icon background and darker outline, ore fleck palettes
  that do not overlap, lit variants differ and lit furnace mouths are brighter.

## Deviations from the spec
- `missing` has a painter (the checker) so `hasPainter` is true for every registry name.
- Cable textures have transparent corners (never sampled by the mesher; they make the flat icon a clean plus).
- Leaves are opaque (the content defines them as opaque cubes), unlike "leaves if the content marks them
  non-opaque" - nothing to cut out.

## Known gaps and what I am least happy with
- Machine fronts are drawn for a 16px face; as small isometric cube icons in the UI the machines look alike (dark
  casing, small detail). The icon provider (src/render) might show the front face larger or flat for machines.
- `combustion_engine_front` reads as a finned grille more than an engine; `water_wheel_front` reads as a gear;
  `wind_turbine_front` idle is sparse.
- `item_iron_plate` / `item_steel_plate` are lozenges that read as "flat metal" but not strongly as plates.
- `stone` is soft and a little pale at a distance; `oil_shale` seams are regular; `log_top` rings are boxy.
- `item_shield_suit` reads more like a robot than a suit; `workbench_side` reads as a shelf.
- Only judged in my own harnesses (contact sheets, 4x4 tilings, the UI kit's real slots at 390x844, and a three.js
  scene with simple Lambert lighting by day and night) - not yet in the real renderer with its light ramp and fog.
