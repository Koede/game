# Noise and light

## Goal
Sound and light carry the world: a jukebox you can hear from the yard, a forge that roars, a candle-lit room that glows from the path, rain on
the roof, and a cave that echoes. They tell you where things are and what they are doing, before you see them.

## What is fun
- Hearing the jukebox through the wall before you open the door.
- Walking up a hill at night and seeing the tavern windows glow, and the forge flicker on the trees.
- A cave whose echo changes with its size; a waterfall you hear before you find it.
- Lanterns that cast shadows and colour the grass.

## What exists
The audio system (src/audio, named sfx with positional volume), the day and night light (src/core/weather.ts moon and night light), lit blocks
and lighting (src/world/lighting.ts), the jukebox sound, and the cold and warmth systems.

## Design
1. **Sound sources.** Blocks that make sound (furnace, forge, jukebox, waterfall, wind chime, anvil) have a source with a radius, a falloff and
   a loop. Volume depends on distance and on walls between you and the source (solid blocks in the line reduce it).
2. **Sound through walls.** A muffled version (lower band, quieter) plays through a solid wall, so the jukebox is audible but soft in the hall.
3. **Echo.** Caves and large rooms add a short reverb, scaled by the open volume around the listener (estimated from the block grid when you
   enter a space).
4. **Light sources.** Torches, lanterns, candles and lit furnaces emit light with radius and colour; colours blend where they overlap. Shadows
   use the existing light probe, not new shadow maps.
5. **Night visibility.** Lit windows are visible from a distance; a candle-lit window reads differently from a hearth-lit one.
6. **Rain and wind.** Rain on roofs and in the open, quieter under cover; wind in the trees follows storm strength (see weather-that-matters.md).
7. **Accessibility.** A sound-cues option turns sources into captions or icons; the graphics setting controls light quality.

## Phases
1. Sound sources with distance falloff and wall occlusion.
2. Muffled sound through walls; the jukebox and forge as the first sources.
3. Echo in caves and large rooms.
4. Light colour and radius; lit windows at night.
5. Rain and wind sounds; the captions option.

## Tests
Volume falls with distance and drops behind a wall; echo scales with open volume; light colour blends where two sources overlap; a source stops
when its block is removed; the captions setting lists active sources.

## Risks
Audio cost with many sources (cap the active set to the nearest eight); mud from too much reverb (keep it subtle); light cost on phones (reuse
the existing probe).

## Open questions
Should the jukebox be audible from outside the tavern at night, or only inside?
