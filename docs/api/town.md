# Orrin's town (phases 1-2)

Orrin builds a village next to the tavern from presaved templates (plan: `docs/plans/orrin-builds-a-town.md`).

## Files

- `src/npcs/townPlan.ts`: pure. `planTown(seed, origin, surface)` picks a site 24 to 64 blocks from `origin`, lays plots on a
  12-block lattice around a plaza (nearest first), and assigns `TOWN_ORDER` to them. `footingHeights` checks a footprint
  (buildable, relief at most 3).
- `src/npcs/townTemplates.ts`: the template library (`TOWN_TEMPLATES`): storage bay, cottage, workshop, well and plaza, lamp post.
  Each has cells in five stages (`clearing`, `frame`, `walls`, `roof`, `finish`). Frame cells are oak logs and stone brick only.
- `src/npcs/townBuilder.ts`: `TownBuilder`, the saved progress and the storage bay. `buildCells` turns a planned building into
  ordered jobs (stilts and digs first, then the template cells). Talks to the game through `TownHost`.
- `src/npcs/manager.ts` (`tickTown`, `town` in the npcs snapshot) and `src/npcs/host.ts` (`townSurface`, `townBlock`, `townEdited`,
  `townPlace`) wire it in. The origin is the tavern's centre for now; any generic origin can be passed to `tick`.

## State

Snapshot field `town` (optional, old saves load and start a town): the plan (site and buildings), `building` (index),
`base` and `ground` (the current building's base row and footprint heights), `stage`, `cell` (how far the budget reached),
`laid` (how far placement reached), `lastDay`, `owed`, `accrued`, `blocked` and `bay` (the storage bay's stock).

## Pace

`DAY_BUDGET` = 32 cells per day, spent during the day phase. A turned day credits what it did not spend, and skipped days are
credited in full (capped at four days). A cottage frame is about two days, its finish about three more.

## Rules

- Every placed block comes from the bay. With too little stock Orrin waits; `missing()` lists what the current stage still needs.
  `deliver(item, count)` adds stock (bounties come in phase 5).
- Movable blocks in the way (grass, plants, dirt, gravel, stone, snow, sand, clay) are dug out into the bay.
- A cell the world has edited (`IWorld.wasEdited`) is never overwritten or dug. A plot with more than `MAX_BLOCKED` such cells is
  skipped, as is a plot with trees, water or steep ground.
- Cells in unloaded chunks wait; the budget keeps counting and placement catches up in batches of `MAX_PER_TICK`.

## Adding a template

1. Write a `template(key, name, w, d, door, draw)` in `townTemplates.ts`. Use `c.stage = '...'` and the canvas helpers
   (`set`, `box`, `perimeter`, `fill`, `unset`). Keep the frame to oak logs and stone brick.
2. Keep `w` and `d` at 9 or less. Add the key to `TOWN_TEMPLATES`.
3. Add its key to `TOWN_ORDER` in `townPlan.ts` where it belongs.
4. `townTemplates.test.ts` checks the stages, the frame and the footprint automatically.
