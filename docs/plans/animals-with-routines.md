# Animals with routines

## Goal
Animals live a day. Deer graze at dawn, drink at the pond at dusk, and rest in the trees at noon. Wolves circle at night. Animals you have fed
or befriended follow a routine near your base and come when called. The world feels inhabited.

## What is fun
- Walking up on a deer grazing at dawn and seeing it look up.
- A pond at dusk that slowly fills with deer, rabbits and a fox.
- A wolf pack circling the camp at night, so you know to bring a torch.
- A rabbit lured with a carrot into a fenced pen, and a goat that gets used to the tavern yard.

## What exists
Mobs and animals (src/mobs, src/content/biomeMobs.ts, animalYields.ts), goat milking and shearing, pets (src/content/pets.ts), and the NPC
routine pattern in src/npcs/routines.ts (time-of-day spots and walking). The NPC routines are the model: a spot per phase, a walk toward it, a rest.

## Design
1. **Daily spots.** Each species has phase spots by biome: grazing meadows (dawn, day), water (dusk, drinking), shelter (noon, night). Each
   animal picks its own spot nearby, deterministically from the world seed and its home.
2. **Home and range.** Each animal has a home and returns to it at night; it wanders within its range by day. Saved as a home point, not every step.
3. **Predators.** Wolves hunt at night in packs and keep a circle of about a dozen blocks from a camp or a torch; they avoid fire and lit yards.
   Foxes take unguarded chickens and rabbits.
4. **Luring and following.** Carrots, wheat and berries attract rabbits, deer and goats. Fed animals follow a few blocks and come when you call.
   Fenced pens hold them; a trough keeps them near.
5. **Visibility.** Animals at their spots, a small sound cue (bleat, hoot, rustle) near you, and an icon when they are hungry or ready for
   milking or shearing.
6. **Ecology.** Grazing lowers grass for a few days and it regrows; a pond with no animals stays clean; a predator-free meadow gets crowded.

## Phases
1. Daily spots and home range for the existing animals.
2. Night and dawn cycles by species; the pond at dusk.
3. Predators (wolves at night, foxes) with the fire and light rule.
4. Luring, following, fences and troughs.
5. Ecology and sounds.

## Tests
Spots are deterministic per seed and inside the animal's range; an animal returns home at night; wolves avoid lit cells; a fed animal follows
within range and not beyond it; saves keep home points; old saves place animals at their home.

## Risks
Cost of many animals (cap per chunk, sleep far ones); pathing into water and walls (reuse NPC navigation); wolves becoming a chore (clear warning,
and a defence with torches and fences).
