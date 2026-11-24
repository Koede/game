# Upgrade plans

One plan per upgrade. Each has the same shape: goal, what is fun about it, what exists, design, phases, tests, risks. Nothing here is built
yet. Order is a suggestion, not a promise.

| Plan | One line | Suggested order |
| --- | --- | --- |
| [loot-and-containers.md](loot-and-containers.md) | Rarity, nested tables, named finds, tavern vault and closet | 1 |
| [enchantments.md](enchantments.md) | A few bold, behaviour-changing enchants, found by experiment at the altar | 2 |
| [touch-and-settings.md](touch-and-settings.md) | Touch buttons for emotes, photo and sneak; the graphics setting control | 3 |
| [glass-and-liquids-polish.md](glass-and-liquids-polish.md) | Finish the glassware and animated liquids work | 4 |
| [wandering-trader.md](wandering-trader.md) | A trader who walks in with a changing stock and stories | 5 |
| [caves-and-depths.md](caves-and-depths.md) | Larger caves with their own rooms, hazards and loot | 6 |
| [auto-build-assist.md](auto-build-assist.md) | Blueprint-guided placing so big builds are fun on a phone | 7 |

Rules for every plan: the base progression never needs it (optional like magic), saves stay valid (new fields optional and sanitised),
content tests keep the one-age-ahead cap, and each phase ends with `tsc`, the full vitest run, the golden update where content changed,
and an e2e run on desktop and phone.
