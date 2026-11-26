# Gruk's town (phases 1-2, and the building board of phase 5)

Gruk builds a village next to the tavern from presaved templates (plan: `docs/plans/orrin-builds-a-town.md`). The builder is
`BUILDER_ID = 'gruk'` (exported from `townBuilder.ts`); the build board's trust goes to that id.

## Files

- `src/npcs/townPlan.ts`: pure. `planTown(seed, origin, surface)` picks a site 24 to 64 blocks from `origin`, lays plots on a
  12-block lattice around a plaza (nearest first), and assigns `TOWN_ORDER` to them. `footingHeights` checks a footprint
  (buildable, relief at most 3).
- `src/npcs/townTemplates.ts`: the template library (`TOWN_TEMPLATES`): storage bay, cottage, workshop, well and plaza, lamp post.
  Each has cells in five stages (`clearing`, `frame`, `walls`, `roof`, `finish`). Frame cells are oak logs and stone brick only.
- `src/npcs/townBuilder.ts`: `TownBuilder`, the saved progress and the storage bay. `buildCells` turns a planned building into
  ordered jobs (stilts and digs first, then the template cells). Talks to the game through `TownHost`. `syncCrate` reconciles the
  bay's stock with its crate (see below).
- `src/npcs/buildBoard.ts`: pure. The board, the town's reputation, the reputation gates (`UNLOCK_REP`) and the bay's places
  (`bayBoardSpot`, `bayFrontSpot`, `bayCrateSpot`).
- `src/npcs/manager.ts` (`tickTown`, `townDebug`, `town` in the npcs snapshot) and `src/npcs/host.ts` (`townSurface`, `townBlock`,
  `townEdited`, `townPlace`, `townCrate`) wire it in. The plan is anchored on the camp's centre in a new world (`camp.ts`, phase 1 of
  `docs/plans/just-you-and-orrin.md`), or the tavern's centre in an old world, and is made once. From the lodge's first stage the
  people's origin is the lodge's plot (`lodgeOrigin()`); the plan does not move. The builder is Gruk (`BUILDER_ID`): his name is on the
  board's toasts and he takes the build-bounty trust.

## State

Snapshot field `town` (optional, old saves load and start a town): the plan (site and buildings, in build order), `building` (index),
`base` and `ground` (the current building's base row and footprint heights), `stage`, `cell` (how far the budget reached),
`laid` (how far placement reached), `lastDay`, `owed`, `accrued`, `blocked` and `bay` (the storage bay's stock). The board is
`town.board` (`bounties`, `rep`, `spot`, `bay`, `placed`). The stock crate's contents are the crate's own slots (the save keeps them with
the world).

`townDebug()` (`window.__hw.town()` in the browser) reads the state for the e2e: site, building, base, waiting, standing, board,
bay, crate, front, stock, coin, plan and `progress` (cell, laid, next cell, skipped plots and why).

## Building board

- **Bounties** come only from `missing()` for the current building and stage. Three are up at a time. Each asks for a chunk of 8 to 32
  of one item (or what is left, when less) and never more than the building still needs. The board is redrawn every tick, so a
  bounty appears as soon as a stage needs material. Draws are seeded from the world seed and a counter kept in the save.
- **Payouts:** coin is added to the coin counter (`coins` in the npcs snapshot, the same counter the favours board uses) as the item's
  price (`priceOf` in `economy.ts`) times the count, a little more on later stages, at least 4. Each part also pays town reputation
  (1 + size/8 + stage) and Gruk's trust (2, or 3 for big chunks). Parts pay their shares, so the totals are exact.
- **Rare rewards:** each new bounty rolls once for a rare item from `BOARD_REWARDS` (5%, 15% on the finishing stage). It is paid when
  the bounty is complete.
- **Reputation:** rises with each part filled and by `REP_PER_BUILDING` per finished building. `REPUTATION_STEPS` (strangers,
  neighbours, village, town) are data.
- **Unlocks:** `UNLOCK_REP` gates templates by standing: the storage bay, the well and plaza and the lamp post need none, the workshop
  10, the cottage 20. A locked building in the queue is passed over: the next unlocked one is brought to the front (the plan is saved
  in that order). When nothing planned is unlocked Gruk waits, and the board says what standing the next one needs (`lockNote`).
- **The board block:** a `quest_board` block placed in the storage bay's floor row (`BuildBoard.spot`) as soon as Gruk has started the
  bay, so the first materials can be handed in before the bay stands. Use it from `bayFrontSpot` or from inside the bay, within
  6 blocks, with a stack in hand that matches a bounty to hand it in: the items are taken from hand, go into the stock, and pay coin,
  standing and trust. Use it empty-handed to read the open bounties and standing. Use on the tavern's quest board is unchanged.
- **The stock crate:** the bay's one crate (`BAY_CRATE`, on the floor row) holds the stock. Use it to open the crate. Each look at the
  crate (every tick once the crate exists) reconciles both ways: what the player put in counts as delivered, what the player took out
  leaves the stock, and then the crate is brought to the stock (what does not fit stays in the stock). Hand-ins and the builder's own
  takes show in the crate the same way. The stock map stays the source of truth.
- **Save:** `town.board` in the npcs snapshot (optional, old saves load an empty board; `bay` is optional too).

## Pace

`DAY_BUDGET` = 32 cells per day, spent during the day phase. A turned day credits what it did not spend, and each skipped working
day is credited in full (capped at four days). Festival days (`festival.ts`, the last day of each season) are rest days: no budget is
earned on them and nothing is dug or placed in their day phase. A cottage frame is about two days, its finish about three more.

## Rules

- Every placed block comes from the bay. With too little stock Gruk waits; `missing()` lists what the current stage still needs.
  `deliver(item, count)` adds stock (the building board hands it in, see above).
- Movable blocks in the way (grass, plants, dirt, gravel, stone, snow, sand, clay) are dug out into the bay. Their chance drops are
  rolled (`rollDrops`) with a generator seeded from the world seed and the cell, so a dig gives the same result every time and the
  stock is right on average.
- A cell the world has edited (`IWorld.wasEdited`) is never overwritten or dug. A plot with more than `MAX_BLOCKED` such cells is
  skipped, as is a plot with trees, water or steep ground. The reason is kept for the debug read (`progress.skips`).
- Cells in unloaded chunks wait; the budget keeps counting and placement catches up in batches of `MAX_PER_TICK`.

## Tests and e2e

- `townBuilder.test.ts` and `buildBoard.test.ts`: rest days, skipped days, seeded chance drops, unlock gating and the plan swap,
  the stock crate both ways and across a save, the board's place and save.
- `scripts/e2e-town.mjs` (headless, real input for the board and the crate): new world, the site and board placed, the first bounty
  handed in by Use, days skipped with `setDay` with the bounties handed in again, the bay checked in the world, the crate opened
  with Use, and a cottage frame checked.

## Adding a template

1. Write a `template(key, name, w, d, door, draw)` in `townTemplates.ts`. Use `c.stage = '...'` and the canvas helpers
   (`set`, `box`, `perimeter`, `fill`, `unset`). Keep the frame to oak logs and stone brick.
2. Keep `w` and `d` at 9 or less. Add the key to `TOWN_TEMPLATES`.
3. Add its key to `TOWN_ORDER` in `townPlan.ts` where it belongs, and a standing to `UNLOCK_REP` in `buildBoard.ts`.
4. `townTemplates.test.ts` checks the stages, the frame and the footprint automatically.

## The lodge (`src/npcs/lodge.ts`, phases 3 and 4 of `docs/plans/just-you-and-orrin.md`)

The lodge is the second building in the plan (`TOWN_ORDER`, after the storage bay). It takes the nearest plot whose ground holds the
whole tavern footprint, 13 x 15 (the hall and its yard), at rotation 0. Its plot never overlaps a 9 x 9 lattice plot (the pitch is 12).

- **Stages.** `LODGE_PATH` = `lodge`, `lodge_bar`, `lodge_kitchen`, `lodge_upper`, `lodge_tavern`. Gruk builds them in order on the same
  plot and floor row (`TownBuilder.lodgeStage`): the lodge with its first bedroom, the bar counter and a second bedroom, the kitchen,
  pantry and a third bedroom, the upper floor with its guest rooms and stairwell, and the yard, pool, stage, jukebox and cellar.
  Each stage is an ordinary building job: bounties from `missing()`, stages, bay stock.
- **The split.** `groupOf` puts every `layoutBlocks()` placement into one of five groups by region. `layoutAt(k)` is the layout of
  groups 0..k; `stateAt(k)` adds the temporary rooms standing at that stage (`roomCells`: walls, a 2-high door, a bed, a bench and a
  torch). `stageBlocks(k)` is the diff from stage k-1: the cells a stage places, and the air it clears. Applied in order, the five
  stages end exactly on `layoutBlocks()` (`lodge.test.ts`).
- **Templates.** `lodgeTemplate(k)` is stage k as a town template (13 x 15 footprint, `TOWN_STAGES` for each cell). `townTemplate`
  falls back to these keys, so the plan and the saves can name them.
- **Owned cells.** Gruk's own blocks read as not edited by the player: `TownBuilder.owned` maps each cell the lodge placed (and the
  air cleared over the plot, and the footing) to the block it should hold. A later stage may dig or replace those; the player's
  blocks stay protected.
- **Clearing.** Stage 0 starts by clearing the air over the plot (`lodgeVolume`, no budget). A non-movable block or a player's block
  in the way counts against the plot (`MAX_BLOCKED`).
- **Temporary rooms.** The ground-floor bedrooms are walls the upper floor takes down: the clearing at the start of stage 3 removes
  them. The bedroom of stage 0 is the spawn point until then.
- **Save.** `TownSnapshot.lodge` = `{ stage, base, done }`, optional: a town with no lodge in its plan (every older save) has none.
  The owned cells are recomputed from the stage, not saved.
- **Settle.** `TownBuilder.finishLodge()` marks the lodge done (the dev skip builds the full tavern); a lodge not yet started is
  skipped by the builder.
- **Reads.** `lodgeLevel()` is the number of finished stages (0..5); `hasLodge()`; `lodgeOrigin()` is the plot corner at the floor row,
  once stage 0 has started.

Known gap: the upper floor's two guest rooms have open doorways (`air`) and no seat, so they do not pass `checkRoom` as the layout
stands. Fixing it changes `layoutBlocks()` (a door and a bench), which the spec keeps exact; it needs a decision.
