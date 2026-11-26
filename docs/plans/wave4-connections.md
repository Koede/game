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

## Added after the first pass

- **Hearths burn real logs.** The tavern and camp fires no longer conjure oak logs. A new world's town has a finite woodpile
  (`FIREWOOD_START`, 144 logs, saved), then the storage bay's logs are used (`TownBuilder.draw`); when both are empty the hearth burns down
  and a toast says to put logs in the bay. Test: `src/npcs/npcs.test.ts` ("never conjures fuel").
- **Enchanted ruin loot.** `ruin_deep` can hold a Magnet bronze pickaxe or a Fine Bounty axe; the lumber mill crate a Fine Ember axe. The frozen
  loot snapshot was regenerated on purpose. A test checks every enchant and quality on every table is legal.
- **The boss now holds real caves.** `caveLairSite` prefers the caves work's deep camps (`findCaveCamp`, `caveBandAt`): half of the deep camps
  have a Slag Colossus beside the crate. The open-room scan remains for rooms without a camp.

## Not built

- Kerosene lamp: it needs a new block, art and a fuel UI; the plan allows "lamp or tractor fuel", and tractor fuel is done.
- Fine and Masterwork tools dropping from ordinary tables; mob drops carrying enchants.
- The "unused gear designs": dropped (no such table exists).
- Altar research that names an enchant from a loot scroll; cave crates in small chambers.
