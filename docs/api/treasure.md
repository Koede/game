# Treasure maps

A loot item (`treasure_map`, no recipe; add it to loot tables / ruin crates) that points at a landmark and a chest
buried near it. Optional: nothing needs it.

- `src/world/treasure.ts`: `makeTreasureMap(seed, serial, age, landmarks)` is a pure function, so a stack only needs a
  `serial` and the `age` (0..5) it was found in. It returns the landmark, the chest x/z (6-22 blocks from the landmark,
  the caller finds y with `surfaceY`), a compass word, the loot (pools per age in `TREASURE_POOLS`, 2-4 kinds, richer
  with age). `treasureClue`, `treasureHint(map, px, pz)` (warm/cool/cold) and `nearTreasure` drive the UI.
- Content: `src/content/areas/world_treasure.ts`, icon in `src/render/textures/areas/world_treasure.ts`.
- Wired: see docs/api/exploration.md.
- Tests: `src/world/treasure.test.ts`.
