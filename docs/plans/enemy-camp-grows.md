# Enemy camp that grows

## Goal
An enemy camp in the wild is a place that changes. Each time you visit it has grown: a new tent, a new area to explore, a new kind of enemy.
Clear it and it comes back, and enemies re-inhabit the ground you already cleared. Your old victories stay in the world, and the camp never
stops being a threat or a reason to return.

## What is fun
- Returning to a camp you cleared and finding a new tent on the far side, and a scout who saw you leave.
- A camp with a history: a banner that changed, a chest looted and then restocked, a fire lit again.
- Choosing whether to clear it fully or leave a foothold to watch it grow.

## What exists
Structures and camps (src/world/structures.ts, structureDefs.ts), mobs and biome mobs (src/mobs, src/content/biomeMobs.ts), loot crates, the day
clock, and the world save.

## Design
1. **Camp state.** Each camp has a seed, a stage (1 to N), its cleared zones, a last-visit day and a garrison. Saved compactly per camp.
2. **Growth.** Each in-game day an unvisited camp grows slowly; each visit grows it by a larger step. Growth adds a new tent or structure in a new
   zone (generated from the camp seed and the stage), a new enemy type, and a bigger garrison, always within a cap.
3. **Repopulation.** Cleared zones refill over a few days (faster at later stages), so the camp is never empty for long.
4. **New ground.** Each stage opens a zone to explore: a path, a cave mouth, a chest. Zones come from the seed, so the layout is stable.
5. **Loot.** Crates are restocked on each growth step from the loot tables (loot-and-containers.md), with a chance of a named find at higher stages.
6. **Signs of life.** A fire lit or out, banners, scouts that report sightings, footprints on the sand. Each reflects the stage and last visit.
7. **Balance.** Stages are capped. A boss at a high stage ends growth with a reward chest. Early stages are easy so the first visit feels safe.

## Phases
1. Camp state, growth per day, repopulation of cleared zones.
2. New zones and tents per stage; scouts and sightings.
3. Loot restock and named finds.
4. Signs of life and the boss clear that ends growth.

## Tests
Growth is deterministic from seed and stage; cleared zones refill after the expected days; the garrison never exceeds its cap; a boss clear stops
growth; saves keep stage and cleared zones; old worlds start camps at stage one.

## Risks
Endless grind (a boss end state and a clear reward); camps spawning on player builds (keep a radius around builds and the tavern); performance
with many camps (only nearby camps simulate).

## Open questions
How many camps per world, and should they remember your previous visits and react to you?
