# Dyeing, staining and furniture

Area `src/content/areas/decor.ts` (textures `src/render/textures/areas/decor.ts`). Nine new blocks (ids appended to the lock), six items.

- Dyes (`red|yellow|blue|green|black|white_dye`): ground at the Mortar, 4 strokes, 1 plant -> 2 dye (wildberries, carrot, crushed tin,
  fiber, charcoal, flour). The wild flowers grind too (`FLOWER_DYES`: `ember_poppy` -> red, `skybell` -> blue, `frost_lily` -> white;
  3 strokes, 1 bloom -> 2 dye, recipe ids `<colour>_dye_<flower>`). They are a bonus route: biome-only flowers are outside the lean-world solver test.
- Stained planks (`<colour>_stained_plank`): furnace forge at 100 C, 4 plank + 1 dye -> 4 stained planks.
- Furniture: `dining_table`, `plank_bench` (slabs) and `bookshelf` (cube), at the workbench from planks, sticks and cloth.
- `SPEC.maxTextures` raised by 15 in specRoster.ts (append-only line).
