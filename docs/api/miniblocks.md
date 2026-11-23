# Miniblock models (`src/world/miniModel.ts`)

A block drawn from a list of small boxes in 1/16-block units (like a Minecraft block model) instead of a flat sprite or a
full cube. The block stays an ordinary `cube` / `slab` in the content: collision, aiming, Use rules, saves and gameplay are
unchanged; only the mesh and the target outline follow the model.

## Format
`MINI_MODELS[blockKey] = { boxes: MiniBox[] }`, in the block's NORTH frame (front = -Z; East/South/West voxels turn the model
about the cell centre). Face names: `n`=-Z `s`=+Z `e`=+X `w`=-X `u` `d`.

| Field | Meaning |
|---|---|
| `from`, `to` | corners, sixteenths |
| `faces.{n,s,e,w,u,d}` | `uv: [u0,v0,u1,v1]` (sixteenths of the tile, v up), `tex` (another atlas texture by name), `hide` |
| `rot` | `{axis:'x'\|'y'\|'z', angle (deg), origin?}`: a leaning spout, a tilted pole (any angle) |
| `shade` | brightness multiplier (darker inside, lighter rim) |
| `emissive` | the faces ignore light (a lit lamp pane, a glowing core) |
| `part` | a named MOVING part (lid, handle, crank): not meshed into the chunk; `miniParts(model)` lists them for the renderer, which animates them with `src/render/parts` |

Helpers: `mb(x0,y0,z0,x1,y1,z1, extra)`, `vessel(min, max, floor, h, wall, y0)` (floor + four walls round an open top).
By default a face samples the block's own tile at the face's position in the cell (same as the older station boxes).

## Pipeline
* `stationShapes.ts`: keys of `MINI_MODELS` get a station index above `MINI_BASE`; `stationBounds(key)` returns the model's
  bounds (rotation included) for the outline. The old `STATION_BOXES` table (stump, quern, anvil, loom...) is unchanged.
* `blockTables.ts` marks such a block non-opaque (it hides no neighbour face and casts no shadow), as for stations.
* `meshStation.ts` `miniShape/miniBox`: per box, turns the corners to the facing, picks the world face from the turned geometry
  (shade, texture layer, glow), culls axis-aligned faces flush against an opaque neighbour, applies `uv` / `tex` /
  `shade` / `emissive`, and emits straight into the chunk's cutout/opaque batch (no extra draw calls).

## Converted so far
`alloy_pot` (the clay pot): foot, belly, shoulder, neck ring round the open top, a tilted spout, a looped handle.

## Not yet
Held-item / inventory-icon drawing from the same model, collision boxes beyond the whole cell, the moving-part renderer for
`part` boxes, and the other blocks (kettle, cups, jars, essentia jars, buckets, crates/barrels, bottles, lamps, bells, the
distillery glassware, tanks): add a `MINI_MODELS` entry per key; blocks whose content shape is `cup`/`bucket`/`cross` need
their shape moved to `cube`/`slab` first (their sprite tiles then need face art for a box model).
