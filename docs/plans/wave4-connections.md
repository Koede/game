# Wave 4 connections: what was built, what is left

Branch work on `docs/plans/feature-plan-2026-11-26.md` Wave 4 ("dead-end items" and "loot, enchantments and caves").

## Built

1. **Kerosene is tractor fuel.** `FUEL_GRADES.kerosene_canister` (`src/core/distill.ts`): one canister fills one canister's worth, the
   empty canister comes back, a chainsaw refuses it (`saw: 0`). Tests: `src/game/distillFuel.test.ts`, `src/vehicles/manager.test.ts`.
2. **Loot can carry enchants and quality.** `LootEntry.enchants` and `LootEntry.quality` (`src/core/types.ts`, applied in `src/core/registry.ts`
   `give`). A special entry is its own stack, a tool at its quality's durability, enchants it cannot take are skipped. Old tables roll exactly
   as before (the frozen regression test still passes).
3. **Quality and enchantments work together.** `effectiveEnchantLevel` (`src/core/enchant.ts`): a Masterwork tool runs an enchant one level
   higher, never past the maximum and never from nothing. Every effect in `src/game/enchantEffects.ts` reads it.
4. **A cave boss.** `src/world/caveLair.ts` picks, for about 1 chunk in 20, the first roofed open room (5x5 floor, 4 high) in the live chunk;
   `src/mobs/guards.ts` `guardLair` puts one Slag Colossus there, once, saved with the other guards. When the player breaks it, its chest
   (`cave_boss` table in `src/content/loot.ts`: Masterwork iron pickaxe with Veinseeker II and Magnet I, a Fine bronze axe with Bounty I, a scroll,
   Ember cores, metals) appears where it fell, once. Tests: `src/mobs/caveLair.test.ts`.
   **Caves hook (stub):** the lair reads the live chunk, not cave noise. When the caves work gives real rooms, `caveLairSite` is the one
   function to point at them; nothing else needs to change.
5. **Dead ends fixed:** `punched_card` (2 from one bronze plate) and `wind_vane` now have forge recipes; they were unobtainable.

## Not built (ranked)

- `tendFire` still conjures 12 oak logs for the tavern and camp fires. Removing them needs a fuel source (a woodpile crate beside each fire, or
  the storage bay); the settled-world tests expect lit hearths. Decision for the owner: stock-and-upkeep versus free ambience.
- Kerosene lamp (a lamp that burns canisters).
- Ruin and structure tables with enchanted entries: left alone because `rollLoot`'s frozen regression test pins them; do it with a new snapshot.
- Fine and Masterwork tools dropping from ordinary tables; mob drops carrying enchants.
- The "three unused gear designs": no such table was found in `src`; needs the owner to name them.
- Altar research that names an enchant from a loot scroll; cave crates in small chambers.
