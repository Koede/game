# Landmarks

Three hand-placed landmarks join the generated structure types (`src/world/structureDefs.ts`, appended to
`STRUCTURE_DEFS`, loot in `src/content/lootStructures.ts`). Each is tall and recognisable and its crate leans on one
notable item (weight 40 of about 80; the crate rolls 3-4 times):

- Standing Circle (woodland): eight mossy pillars, a hanging light, glowcaps - Vis Rod.
- Frost Watchtower (frostfell): a 10-high ice-glazed tower with torches on its crown - Plated Coat.
- Buried Colossus (dunes): a limestone head with glass eyes and an open mouth - Treasure Map.

They are also the first choice of treasure maps (`Exploration.landmarksNear`, `LANDMARK_KEYS`), so a map reads "the Frost
Watchtower" and leads to a chest nearby.

Not done: larger caves. Appending three types changes which type new sites in those biomes get (selection is by index among
eligible types), so unexplored chunks of an existing seed differ; explored ones are saved edits and do not change.
Tests: `src/world/structures.test.ts` (counts, palettes, crates, guards).
