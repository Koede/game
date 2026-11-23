# Generated structures and biome life (SYNERGY_PLAN slices 1-3)

Design: `docs/SYNERGY_PLAN.md`. Sixteen small structure types stand in the world next to the Old Works ruins.

## Structures (`src/world/structures.ts`, `structureDefs.ts`, loot `src/content/lootStructures.ts`)
- `STRUCTURE_DEFS`: key, name, desc, biomes, footprint `w x d`, `age` (0 ember, 1 bronze, 2 forge), crate cell, `guards` (species key, local cell,
  `up` height, role), floor, and a `build(canvas)` drawn in local coordinates (`y = 0` is the first block above the floor row).
- `Canvas` (clipped to the chunk): `set`, `box`, `fill`, `ring`, `gap`, `floor`, `pillar`, `roll`/`mix` (hash of the site, so every chunk agrees).
- Placement: one per `STRUCTURE_GRID_CHUNKS` (5) square with `STRUCTURE_CHANCE`; `squareStructure(seed, sx, sz)` is pure and cached; the type is chosen among
  those of the site's biome whose age the distance from spawn allows (`AGE_DISTANCE` 0 / 90 / 220); never on a ruin, a tree, a wild crop patch, water or
  a cave mouth, never within 20 blocks of spawn. `worldgen.generateChunk` draws `structuresNear(seed, cx, cz)` after the ruins.
- Crates: the crate cell is left empty; `World.placeRuinCrates` places a crate with `structureCrateEntity` (table `STRUCTURE_LOOT[key]`, via the registry).
  Loot is held to its structure's age + 1 by `structures.test.ts`.
- Guards: `structureGuardPlans(seed, cx, cz)`; `mobs/guards.ts guardStructure` creates them once when the whole structure has loaded (key `s:x0,z0`
  in the saved `guarded` set, so they are never respawned). `GuardHome` is the shared minimal shape of a ruin or structure.

| Key | Biome | Age | Guardians |
|---|---|---|---|
| charcoal_camp, hunters_lodge, caravan_well, peat_stilt_hut | woodland, frostfell, dunes, marsh | ember | none |
| hollow_oak_shrine | woodland | ember | Barkwright |
| lumber_mill | woodland | bronze | Barkwright x2 |
| glassblower_kiln | dunes | bronze | Glass Scarab x2 |
| frost_cairn | frostfell | bronze | Rime Husk x2 |
| ember_altar | scar | bronze | Magma Crawler x2 |
| sunken_alchemist_tower | marsh | bronze | Bog Lantern x2 |
| pump_house | marsh | bronze | Forge Warden |
| waystone | woodland, dunes, frostfell, marsh | bronze | none |
| oil_derrick | dunes | forge | Forge Warden, Kiln Sentry on the beam |
| frozen_foundry | frostfell | forge | Forge Warden x2 |
| basalt_forge_pit | scar | forge | Bellows Hound x2 |
| slag_depot | scar | forge | Kiln Sentry, Cinder Mite x3 |

## Biome life (`src/content/biomeMobs.ts`)
- Animals (passive, `CREATURE_SPECS`): Stag (woodland), Dune Hare (dunes), Snow Ox (frostfell), Slag Newt (scar), Marsh Heron (marsh).
- Feral servants (hostile, `AUTOMATON_SPECS`): Barkwright, Glass Scarab, Rime Husk, Magma Crawler, Bog Lantern. New `SpawnPlace`s `wood_night`, `dunes_night`,
  `frost_night`, `marsh_night` (open sky at night in that biome; scar uses `scar_night`); `core/hostile.ts NIGHT_PLACE`.

## Artificer attunement (`src/content/areas/synergy_artificer.ts`, `recipesMagic.ts INFUSIONS`, `magic/entries.ts`)
- Twelve tools `rune_|gale_` x `bronze_|iron_` x pickaxe/axe/shovel, made at the Infusion Altar from the plain tool and two vials of the aspect.
  Rune: x3 durability. Gale: x1.5 speed. Research `attunement` (bronze) and `master_attunement` (forge). Icons: base icon plus a sparkle.

## Tests
`src/world/structures.test.ts` (palette per biome, crate cell, guard footing, determinism, ruin overlap, World crate, MobManager guards),
`src/content/biomeMobs.test.ts`, `src/content/synergyArtificer.test.ts`.
