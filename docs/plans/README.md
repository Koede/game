# Upgrade plans

One plan per upgrade. Each has the same shape: goal, what is fun about it, what exists, design, phases, tests, risks. Order is a
suggestion, not a promise. The Status column was checked against the code on 2026-11-26; detail and evidence are in
[lookback-2026-11-26.md](lookback-2026-11-26.md) (table "Plan versus code"), open work in
[renormalize-2026-11-25.md](renormalize-2026-11-25.md).

| Plan | One line | Suggested order | Status |
| --- | --- | --- | --- |
| [rpg-inspirations.md](rpg-inspirations.md) | What to borrow from Diablo, Zelda, Souls, Skyrim, Monster Hunter and others | read first | reference |
| [mod-inspirations.md](mod-inspirations.md) | What to borrow from mods: Apotheosis, Tinkers, Create, AE2, Farmer's Delight, Jade and more | read first | reference |
| [ui-inventory-ground-items.md](ui-inventory-ground-items.md) | Ground-item smoothing (done), inventory and UI quality of life | any time | ground items built; the rest not checked |
| [improvements-to-existing.md](improvements-to-existing.md) | Concrete improvements to what already exists, system by system | any time | reference |
| [modular-tools.md](modular-tools.md) | Every tool built from head, handle and binding with material traits, swap and repair by part | 2 | not started |
| [tree-felling.md](tree-felling.md) | Valheim-style trees: tip over, can hurt, lie as logs you cut into pieces | any time | built (phases 1-5); sapling replanting not built |
| [loot-and-containers.md](loot-and-containers.md) | Rarity, nested tables, named finds, tavern vault and closet | 1 | phases 1-3 and named finds built; phase 4 (mob and fishing tables) not started |
| [enchantments.md](enchantments.md) | A few bold, behaviour-changing enchants, found by experiment at the altar | 2 | built (phases 1-4); Ember is level I only |
| [legendary-weapons.md](legendary-weapons.md) | Named weapons with legendary effects, utilities and visuals | 3 | not started |
| [touch-and-settings.md](touch-and-settings.md) | Touch buttons for emotes, photo and sneak; the graphics setting control | 4 | phases 1-3 built; layout variants not built |
| [glass-and-liquids-polish.md](glass-and-liquids-polish.md) | Finish the glassware and animated liquids work | 5 | built |
| [wandering-trader.md](wandering-trader.md) | A trader who walks in with a changing stock and stories | 6 | phases 1-3 built; phase 4 (friendship rewards) not started |
| [caves-and-depths.md](caves-and-depths.md) | Larger caves with their own rooms, hazards and loot | 7 | not started |
| [auto-build-assist.md](auto-build-assist.md) | Blueprint-guided placing so big builds are fun on a phone | 8 | not started (`src/game/blueprint.ts` exists, unwired) |

Rules for every plan: the base progression never needs it (optional like magic), saves stay valid (new fields optional and sanitised),
content tests keep the one-age-ahead cap, and each phase ends with `tsc`, the full vitest run, the golden update where content changed,
and an e2e run on desktop and phone.

## New plans (queued after the current batch)

| Plan | One line | Suggested order | Status |
| --- | --- | --- | --- |
| [weather-that-matters.md](weather-that-matters.md) | Rain gauges, barrels, turbines, storms, snow and thaw | after the current batch | not started |
| [animals-with-routines.md](animals-with-routines.md) | Daily spots, home ranges, wolves at night, luring and pens | after weather | not started |
| [decor-that-does-something.md](decor-that-does-something.md) | Comfort, hearth heat, bed rest, tavern social effects, plants and mementos | after animals | not started |
| [noise-and-light.md](noise-and-light.md) | Positional sound with walls, echo in caves, light colour, lit windows | with weather (shared audio and light code) | not started |
| [message-bottles.md](message-bottles.md) | Notes on beaches, clues to real places, phrase-only share codes | after noise and light | not started |
| [enemy-camp-grows.md](enemy-camp-grows.md) | A camp that grows per visit, opens new zones, repopulates cleared ground | after the caves plan | not started |

## Other plans in this folder

| Plan | Status |
| --- | --- |
| [orrin-builds-a-town.md](orrin-builds-a-town.md) | phases 1, 2 and 5 built (no next-building choice); phases 3 and 4 not started |
| [just-you-and-orrin.md](just-you-and-orrin.md) | camp and lodge (phases 1-4) built; newcomers 5-8 not started |
| [QUEUE.md](QUEUE.md) | the work queue and file ownership for the renormalize briefs |
