# Upgrade plans

One plan per upgrade. Each has the same shape: goal, what is fun about it, what exists, design, phases, tests, risks. Nothing here is built
yet. Order is a suggestion, not a promise.

| Plan | One line | Suggested order |
| --- | --- | --- |
| [rpg-inspirations.md](rpg-inspirations.md) | What to borrow from Diablo, Zelda, Souls, Skyrim, Monster Hunter and others | read first |
| [mod-inspirations.md](mod-inspirations.md) | What to borrow from mods: Apotheosis, Tinkers, Create, AE2, Farmer's Delight, Jade and more | read first |
| [ui-inventory-ground-items.md](ui-inventory-ground-items.md) | Ground-item smoothing (done), inventory and UI quality of life | any time |
| [improvements-to-existing.md](improvements-to-existing.md) | Concrete improvements to what already exists, system by system | any time |
| [modular-tools.md](modular-tools.md) | Every tool built from head, handle and binding with material traits, swap and repair by part | 2 |
| [tree-felling.md](tree-felling.md) | Valheim-style trees: tip over, can hurt, lie as logs you cut into pieces | any time |
| [loot-and-containers.md](loot-and-containers.md) | Rarity, nested tables, named finds, tavern vault and closet | 1 |
| [enchantments.md](enchantments.md) | A few bold, behaviour-changing enchants, found by experiment at the altar | 2 |
| [legendary-weapons.md](legendary-weapons.md) | Named weapons with legendary effects, utilities and visuals | 3 |
| [touch-and-settings.md](touch-and-settings.md) | Touch buttons for emotes, photo and sneak; the graphics setting control | 4 |
| [glass-and-liquids-polish.md](glass-and-liquids-polish.md) | Finish the glassware and animated liquids work | 5 |
| [wandering-trader.md](wandering-trader.md) | A trader who walks in with a changing stock and stories | 6 |
| [caves-and-depths.md](caves-and-depths.md) | Larger caves with their own rooms, hazards and loot | 7 |
| [auto-build-assist.md](auto-build-assist.md) | Blueprint-guided placing so big builds are fun on a phone | 8 |

Rules for every plan: the base progression never needs it (optional like magic), saves stay valid (new fields optional and sanitised),
content tests keep the one-age-ahead cap, and each phase ends with `tsc`, the full vitest run, the golden update where content changed,
and an e2e run on desktop and phone.

## New plans (queued after the current batch)

| Plan | One line | Suggested order |
| --- | --- | --- |
| [weather-that-matters.md](weather-that-matters.md) | Rain gauges, barrels, turbines, storms, snow and thaw | after the current batch |
| [animals-with-routines.md](animals-with-routines.md) | Daily spots, home ranges, wolves at night, luring and pens | after weather |
| [decor-that-does-something.md](decor-that-does-something.md) | Comfort, hearth heat, bed rest, tavern social effects, plants and mementos | after animals |
| [noise-and-light.md](noise-and-light.md) | Positional sound with walls, echo in caves, light colour, lit windows | with weather (shared audio and light code) |
| [message-bottles.md](message-bottles.md) | Notes on beaches, clues to real places, phrase-only share codes | after noise and light |
| [enemy-camp-grows.md](enemy-camp-grows.md) | A camp that grows per visit, opens new zones, repopulates cleared ground | after the caves plan |
