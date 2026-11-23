# Hot springs and cold peaks

Both ride on the existing warmth system (`src/game/survival.ts`).

- **Hot springs** (`src/world/springs.ts`, last stage of `generateChunk`): in 20% of frostfell chunks, on a flat 6-block
  disc with nothing standing above it, a pool of two blocks of still water ringed with basalt and two `steam_vent`s.
  Steam vents are ordinary warm blocks, so a bather near one is "heated" (warmth rises at WARMTH_GAIN_HEAT and the cold
  water drain is ignored), and the vents steam like the scar's. A pure function of (seed, cx, cz); a spot with anything above
  it (spires, trees) is skipped, so nothing is cut in half.
- **Cold peaks** (`src/game/peaks.ts`): above y 58 the air chills, smoothly up to 0.35 warmth/s at y 74, day and night in
  every biome; `survival.ts` adds it to the drain as a 'frost' cause (so the existing cold toast applies). A fire, a
  coat, Well-Warmed or a hot spring cancels or softens it exactly as for other cold.
- Tests: `src/world/springs.test.ts`, `src/game/peaks.test.ts`.
