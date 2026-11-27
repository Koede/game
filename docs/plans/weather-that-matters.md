# Weather that matters

## Goal
Weather changes what you do in a day. Rain fills what is open, storms threaten what is exposed, snow and cold change movement and fire,
and water is something you collect and plan around. The game already has weather kinds and precipitation (src/core/weather.ts, the cold
system in src/game/cold.ts, the caravan, and torches). This plan makes weather act on the world.

## What is fun
- Setting out a bucket before a storm and finding it full of clean water in the morning.
- A rain turbine on the hill turning on a grey day, powering a machine you forgot about.
- A storm that snaps a loose branch and drops a log across the path, or puts out the torch at the cave mouth.
- Snow that makes the far hills feel distant, and the first thaw that opens a frozen stream.

## Design
1. **Rainfall as a value.** Rainfall intensity per block column comes from the weather state, reduced under cover (trees, roofs, overhangs)
   and varied by biome. Derived per column, not stored.
2. **Rain gauge.** A small wood-and-glass block. It shows the millimetres it has collected today as a tick line on its tube, readable from
   across the room.
3. **Rain barrel.** An open-top barrel on a stand. Each rainy tick adds water at a rate set by the open area above it (a barrel under the eaves
   gets less). It holds water up to a capacity; a tap at its base feeds a bucket or a pipe. In snow it freezes and cracks unless emptied first;
   a crack is repaired at the anvil.
4. **Rain turbine.** A vertical turbine on a mast, driven by rainfall intensity (storms turn it hard, drizzle weakly). It feeds the power
   network like the other machines and stops in dry weather and snow.
5. **Storms and wind.** Wind strength rises in storms: loose blocks (sand, gravel, leaves, a crate stacked on top) can slide; a tree with a
   weakened trunk can fall (ties to tree-felling.md); unsheltered torches and small fires go out.
6. **Snow and cold.** Snow lies on flat top surfaces and slows walking. It freezes water in barrels and buckets and melts on a warm day.
   Frozen rivers can be crossed until the first thaw, when they break.
7. **Feedback.** A weather strip in the HUD (icon and the next change), the rain gauge reading, and sound (rain on the roof, wind in the
   trees), all following the graphics setting and reduce motion.
8. **Balance.** Water is never scarce in a rainy biome; in dry biomes the barrels and turbines are the way to get it. Nothing essential depends
   only on weather: the bucket and the pump always work.

## Phases
1. Rainfall per column and the rain gauge (read-only feedback).
2. Rain barrel filling and the tap.
3. Rain turbine and power.
4. Storms and wind effects (loose blocks, torches, branches).
5. Snow, freezing and thaw; HUD strip and sound.

## Tests
Rainfall under cover is lower than in the open; barrels fill at the expected rate and stop at capacity; turbine output scales with rainfall
and is zero in dry weather; freezing and thaw are deterministic per day; weather state saves and loads; old saves start in clear weather.

## Risks
Weather tedium (keep storms short and warned); chunk cost of per-column rainfall (compute on demand, cache per chunk); freezing that punishes
players who did nothing wrong (always warn first).

## Open questions
Should rain barrels also water crops? Should the turbines show a wind direction?
