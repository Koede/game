# Loot tables, rarity and the tavern's secret crates

Plan: `docs/plans/loot-and-containers.md`. Code: `src/content/loot.ts` (authored data), `src/core/registry.ts` (`rollLoot`, lookups, validation),
`src/world/ruinCrates.ts` (crate entities), `src/npcs/tavern.ts` (`TAVERN_CRATES`), `src/render/rarity.ts` (ground glow and beam).

## Tables

`LootTableSpec` (src/core/types.ts): `tier`, `rolls`, `entries`, plus optional `id` and `guaranteed`. A `LootEntry` is `{ item, count, weight }` with
optional `rarity` (`'common' | 'fine' | 'rare' | 'legendary'`, default common) and optional `table` (an entry that rolls another table by id; `item` is `''`).

- `lootTableById(id)`: ruin tiers are `ruin_near` and `ruin_deep`, structure tables are their structure key, named tables (`NAMED_TABLES`) their own id
  (`tavern_closet`, `tavern_vault`). `lootTable(tier)` and `STRUCTURE_LOOT` work as before.
- `rollLoot(table, random, { luck? })`: the table's `guaranteed` entries first, each once, then `rolls` weighted draws. A table entry rolls the nested table once in
  place. Nesting is limited to `LOOT_MAX_DEPTH` (3); `validateContent` rejects unknown ids, cycles and deeper nesting. `luck` (default 0 = unchanged) multiplies an
  entry's weight by `1 + luck x rank` (fine 1, rare 2, legendary 3). Tables without the new fields roll byte-identically to the old code
  (`src/core/lootRoll.test.ts` holds snapshots).
- `lootTableItems(table)` lists every item a table can give, nested and guaranteed ones included; content tests hold it to the one-age-ahead cap.

## Rarity

`rarityOf(itemKey)` (registry) reads `ITEM_RARITY` in src/content/loot.ts: data about an item, never a field of a stack. The tooltip title
(`TooltipCard.rarity`, `data-rarity`) and the slot edge (`SlotView.rarity`) take green, blue and gold; `itemRarity` in src/render/rarity.ts lifts a named item to the
ground-glow level (rare: beam, legendary: gold beam) over what its age gives.

## Named finds

`NAMED_FINDS` in src/content/loot.ts: `{ item, table, enchants? }`. `rollLoot` attaches `enchants` to the stack it creates (via `applyNamedFind`). Orrin's Spare Pick
(`orrins_spare_pick`, a bronze pickaxe with 256 uses, legendary, icon shared with the bronze pickaxe) lives in the `tavern_vault`; add `enchants: { veinseeker: 1 }` there
when the enchantment system defines it.

## The tavern

`buildTavern` places two crate entities once, for a new world, rolled from `hash32(world.seed, x, y, z)`: `tavern_closet` in the sealed closet (a research scroll, a fine
bronze axe, a few supplies) and `tavern_vault` behind the false wall (Orrin's Spare Pick, a research scroll, an essentia jar, two vials of cinder, a small stash). The entities
are saved with the world, so they never refill; old worlds are untouched. Both rooms stay reachable only through their secret routes (flood-fill tests in `src/npcs/npcs.test.ts`).
