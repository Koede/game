# Night creatures

Harmless ambient life, stateless: `src/sim/nightlife.ts` `critters(env, px, pz)` is a pure function of seed, darkness,
rain, world time, biome and surface height, over 12-block cells within 3 cells of the player.

- Fireflies: dark >= 0.55 and dry; marsh 75% of cells, woodland 25%; blink and drift.
- Bats: dusk and dawn (darkness 0.2-0.8), not in the frostfell; circle 6 blocks above the ground.
- Owls: darkness >= 0.85 in the woodland; perched on the highest block of the cell, eyes blink.
- Drawn by `src/render/nightlifeFx.ts` as short-lived particles (`Renderer.spawnParticle`), re-spawned each frame from
  `Game.drawNightlife`. They cannot be hit, hurt or collected.
- Not done: the wandering trader (needs a trade entity and screen), owl hoots / bat squeaks (audio), per-model meshes.
- Tests: `src/sim/nightlife.test.ts`, `src/render/nightlifeFx.test.ts`.
