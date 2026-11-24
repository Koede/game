# Loot and containers

## Goal

Opening a container should be a small event. Rare finds are named and different from anything you can craft; ordinary finds keep the
ladder honest (never more than one age ahead).

## What is fun

- A secret room (the tavern closet and vault) that pays out something you remember.
- A rare beam of colour on the ground, then a named item with a line of story.
- Crates that are different from each other: a glassblower's holds glass, a lodge's holds hides.

## What exists

`src/content/loot.ts` (near and deep tables), `src/content/lootStructures.ts` (one table per structure), `rollLoot` and `lootTable` in
`src/core/registry.ts`, crate entities in `src/world/ruinCrates.ts`. The tavern builds its closet and vault empty (`src/npcs/tavern.ts`).
Mobs and fishing roll their own fixed tables.

## Design

1. **Rarity.** `common`, `fine`, `rare`, `legendary` on loot entries. Names and tooltips take the colour (white, green, blue, gold).
2. **Nested named tables.** An entry can point at another table by id (depth limit 3, cycle check). Every table gets a `guaranteed` themed
   item plus random extras.
3. **Named finds.** A few hand-written legendary items (for example "Orrin's Spare Pick", a pickaxe with a line of story and a fixed
   enchant). They are placed once per world in the best containers, never rolled twice.
4. **Tavern payoff.**
   - Closet: a handwritten note (a research scroll) and one Fine item.
   - Vault: one named find, a research scroll, an essentia jar of a starter aspect and a small stash. Placed in `buildTavern`, rolled from the
     world seed, remembered as edits so a crate never refills.
5. **Mobs and fishing on the same tables.** `mob_<kind>` tables with a guaranteed drop and a thin rare slice; fishing gets a treasure slice
   (a bottle with a map).
6. **Locked crates (later).** A rusted key from another table opens them; some wake a golem marker.

Cut for the first pass: pity counters, loot log and curses (bookkeeping, not play).

## Phases

1. Types and `rollLoot` v2 (rarity, nesting, guaranteed). Old tables roll identically for a fixed seed.
2. Rarity colours, tooltips and the ground beam.
3. Tavern closet and vault crates and tables.
4. Mob and fishing tables.
5. Named finds.

## Tests

Deterministic per seed; every entry respects its age cap; nesting depth and cycles are rejected; tavern crates exist at their cells and the
closet and vault stay sealed (existing flood-fill tests); save round-trip with rarity fields absent.

## Risks

Loot inflation. Keep rare weights low and cap guaranteed items to the theme. Rarity must not appear on items that cannot carry it
(stackables); colour the name, not the stack.
