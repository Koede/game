# Orrin's town (phases 1-2, and the building board of phase 5)

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
  `townPlace`) wire it in. The origin is the camp's centre in a new world (`camp.ts`, phase 1 of `docs/plans/just-you-and-orrin.md`)
  and the tavern's centre once it stands. The builder is Gruk (`BUILDER_ID` in manager.ts): his name is on the board's toasts and he
  takes the build-bounty trust.

## State

Snapshot field `town` (optional, old saves load and start a town): the plan (site and buildings), `building` (index),
`base` and `ground` (the current building's base row and footprint heights), `stage`, `cell` (how far the budget reached),
`laid` (how far placement reached), `lastDay`, `owed`, `accrued`, `blocked` and `bay` (the storage bay's stock).

## Building board (phase 5)

- `src/npcs/buildBoard.ts`: pure. `BuildBoard` holds the bounties, the town's reputation and the board's spot. `refresh(now, missing, seed)`
  redraws from the builder's `missing()`; `deliver(id, take)` pays one part of a bounty; `finished()` adds reputation per finished
  building. `REPUTATION_STEPS` and `BOARD_REWARDS` are data. `bayBoardSpot` places the board inside the storage bay.
- **Bounties** come only from `missing()` for the current building and stage. Three are up at a time. Each asks for a chunk of 8 to 32
  of one item (or what is left, when less) and never more than the building still needs. A bounty is redrawn when it is filled, and the
  whole board when the stage or building moves on. Draws are seeded from the world seed and a counter kept in the save.
- **Payouts:** coin is the item's price (`priceOf` in `economy.ts`) times the count, a little more on later stages, at least 4. Each
  bounty also pays town reputation (1 + size/8 + stage) and Orrin's trust (2, or 3 for big chunks). Parts pay their shares, so the
  totals are exact.
- **Rare rewards:** each new bounty rolls once for a rare item from `BOARD_REWARDS` (5%, 15% on the finishing stage). It is paid when
  the bounty is complete.
- **Reputation:** rises with each part filled and by `REP_PER_BUILDING` per finished building. `REPUTATION_STEPS` (strangers,
  neighbours, village, town) are data for the unlocks that come later.
- **The board block:** a `quest_board` block placed inside the storage bay (`BuildBoard.spot`) once the bay is finished. Use it
  within 6 blocks of the spot (the manager checks the player's position through the host), with a stack in hand that matches a
  bounty to hand it in: the items are taken from hand, go into the storage bay, and pay coin, standing and trust. Use it empty-handed
  to read the open bounties and standing. Use on the tavern's quest board is unchanged.
- **Save:** `town.board` in the npcs snapshot (optional, old saves load an empty board).

## Pace

`DAY_BUDGET` = 32 cells per day, spent during the day phase. A turned day credits what it did not spend, and skipped days are
credited in full (capped at four days). A cottage frame is about two days, its finish about three more.

## Rules

- Every placed block comes from the bay. With too little stock Orrin waits; `missing()` lists what the current stage still needs.
  `deliver(item, count)` adds stock (the building board hands it in, see below).
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
