# Companion dog and cat

- Content: `src/content/pets.ts` (`PET_SPECS`, appended to `CREATURE_SPECS`; `CreatureSpec.pet = true`, `biomes: []` so
  biome rolls never place them). The dog likes raw meat (chop, mutton, fowl), the cat raw perch or trout (all obtainable before the first furnace).
- Taming: `MobManager.feed` on a pet makes it tame at once (no breeding, no eager state), toast "trusts you".
- Following: `src/mobs/brain.ts` rule 3b: a tame pet always walks to 2.2 blocks of the player and sprints (x1.5) when
  more than 9 blocks behind; it idles and wanders when close. Tame pets are never retired and persist (`tame`).
- `src/game/pets.ts` (`GameState.pets`): strays (every 2 minutes at dusk/dawn, 35%, while the player has no pet and at
  most 2 exist, 18-30 blocks away), pack (4 stacks; Use on your pet with a non-food item hands it over, empty-hand Use
  takes everything back; saved per mob id with `World.persist('pets')`) and the warning (a hostile within 18 blocks of the
  player: "Dog growls" toast, at most every 25 s). Use goes through `AnimalTargets.pet` / `MobManager.petUse`.
- Not done: a pet pack screen, healing or fighting, bed/home, teleport-catch-up beyond the sprint.
- The first gift to a stray emits `pet:tamed { id, species }` and sfx `pet_tamed` (MobManager.feed); the achievement `first_pet` and a journal line listen.
- Tests: `src/game/pets.test.ts`. `src/mobs/petTamed.test.ts`.
