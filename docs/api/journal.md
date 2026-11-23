# Journal and explored map

`src/game/journal.ts` (DOM-free). `GameState.journal` is a `Journal(day, bus)`.

- Writes diary lines by itself from the bus: `objective:completed`, `age:advanced`, `player:death`, storm `weather:changed`, `mob:died` (first of a species), a few `item:made` firsts. A keyed entry is written once. `add(kind, text, key?)` lets any module write one. The newest `MAX_ENTRIES` (160) are kept.
- `explore(x, z)` is called every fixed tick; it marks cells (`CELL` = 4 blocks) within `SIGHT` (14 blocks) as seen. Seen cells live in 64x64-cell bitset regions. `isSeen`, `seenCells`, `seenBlocks`, `bounds()`.
- Save: optional `journal` field of `WorldSave` (`toJSON` / `load`, `isJournalSnapshot` guards it; a damaged one is ignored).
- UI: `JournalView` (src/ui/screens/log) is appended under the Hearth Log (L). `paintMap` renders the map into RGBA, shaded by `world.surfaceY`.
