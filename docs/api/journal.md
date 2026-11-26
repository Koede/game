# Journal and explored map

`src/game/journal.ts` (DOM-free). `GameState.journal` is a `Journal(day, bus)`.

- Writes diary lines by itself from the bus: `objective:completed`, `age:advanced`, `player:death`, storm `weather:changed`, `mob:died` (first of a species), a few `item:made` firsts, and one `first` line each (keys `first:fish`, `first:waypoint`, `first:treasure`, `first:enchant`, `first:pet`) from `fish:caught`, `waypoint:travelled`, `treasure:dug`, `enchant:applied` and `pet:tamed`. A keyed entry is written once. `add(kind, text, key?)` lets any module write one. The newest `MAX_ENTRIES` (160) are kept.
- `explore(x, z)` is called every fixed tick; it marks cells (`CELL` = 4 blocks) within `SIGHT` (14 blocks) as seen. Seen cells live in 64x64-cell bitset regions. `isSeen`, `seenCells`, `seenBlocks`, `bounds()`.
- Save: optional `journal` field of `WorldSave` (`toJSON` / `load`, `isJournalSnapshot` guards it; a damaged one is ignored).
- UI: `JournalView` (src/ui/screens/log) is appended under the Hearth Log (L). `paintMap` renders the map into RGBA, shaded by `world.surfaceY`, plus optional markers
  (`MapMarker`: waypoint = blue diamond, treasure landmark = red X; off-map ones become one pixel on the border, toward them).
  `mapFrame` / `placeMarkers` are the DOM-free placement; `setMapMarkerSource` (set to `Exploration.mapMarks` by the app) feeds `JournalView`.

## Achievements and the title backdrop

`src/game/achievements.ts`: `ACHIEVEMENTS` (id, name, text, and either `test(ProgressFacts)` or `on: <bus event>`), `Achievements(bus, facts)`; `GameState.tick` calls `tick(dt)` (re-checks the `test` ones once a second, toasts "Achievement: Name"). The `on` ones are earned the moment their event fires: `first_fish` (`fish:caught`, src/game/exploration.ts), `first_waypoint` (`waypoint:travelled`), `first_treasure` (`treasure:dug`: a buried crate opened or broken; the unopened crates are kept in the exploration save as `buried`), `first_enchant` (`enchant:applied`, src/magic/magic.ts) and `first_pet` (`pet:tamed`, src/mobs/manager.ts). `dispose()` drops the listeners. Saved as optional `achievements: { unlocked: { id: day } }`. Not yet: a festival medal, first building and first bounty (their emitters live in src/npcs).
`titleStage(age)` (0..5) sets `data-stage` on the title screen; `styles.css` warms/brightens the backdrop glow per age. `TitleScreen` takes `stage` and has `setStage()`; `App` keeps `savedAge` from the save.

## Phone quality of life

- Resume prompt: `GameState.resumed`; `Game` toasts `resumeLine(day, current goal, last diary line)` when a saved world is picked up.
- One-handed layout: `Settings.oneHanded` ('off' | 'left' | 'right', Settings > Controls). `TouchGestures.handed` moves the stick region to the lower part of that side (buttons still win the hit test, everything else looks); `TouchOverlay.setHanded` mirrors the cluster for the left thumb (CSS `hw-touch--one-left/right`).
- Auto-build assist was not built.

## Story beats

`src/game/storyBeats.ts`: `STORY_BEATS` (one per age from the second on) and `StoryDirector(bus, journal, phase, savedAge)`. When an age is reached, the first night after brings its lines as timed toasts and a journal entry keyed `story:<age>`. The journal is the only memory: on load, reached ages whose key is missing re-arm. `GameState.story.tick` runs each fixed step.

The pause menu has Journal and Achievements entries (`PauseMenuOptions.openLog`, wired by `GameUI`): each opens the Hearth Log as `{ type: 'log', section }`, scrolled to that section.
The Hearth Log (L) also lists every achievement (`AchievementsView`, src/ui/screens/log): earned ones with their day, the rest dim with what to do.
