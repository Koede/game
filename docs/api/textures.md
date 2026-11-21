# src/render/textures - public API

Pure, deterministic, DOM-free pixel painters (safe in node and workers). Import from `src/render/textures`.

```ts
export const TEXTURE_SIZE = 16;
export function paintTexture(name: string): Uint8ClampedArray;
export function hasPainter(name: string): boolean;
export function averageColor(name: string): [number, number, number];
```

- `paintTexture(name)` - 16x16 RGBA, 1024 bytes, row-major, **top row first** (row 0 is the top of a side face
  seen from the front; on top/bottom faces row 0 is the north edge). A fresh array on every call (results are
  cached internally and copied), so callers may mutate it. Any string works: names without a painter return a
  magenta/black checker. `missing` (layer 0) is that checker by design.
- `hasPainter(name)` - true for every entry of the registry's `TEXTURE_NAMES` (164 including `missing`).
- `averageColor(name)` - mean colour of the pixels with alpha >= 128 (all visible pixels if there are none),
  rounded, 0..255. Meant for debris particles.

## Alpha conventions
- Cube block faces, lava, leaves (opaque cubes in this game), slab and machine faces: alpha 255 everywhere.
- `water`: alpha ~200 everywhere (translucent batch). `glass`: opaque frame, low-alpha tinted pane, a few
  brighter glints.
- `tall_grass`, `dry_shrub`, `torch`: alpha 0 holes (cutout).
- Cables (`copper_cable`, `heavy_cable`, `super_cable`): opaque plus-shaped band (rows and columns 5..10, the part
  the mesher's 6/16 core and arms sample), transparent corners - they double as flat item icons.
- `item_*`: transparent background, 1px darker outline, lit from the top left.

## Status
The API above is final. Painters are being refined family by family; see the rest of this file once the module
is marked done in HANDOFF.md.
