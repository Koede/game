# Orrin builds a town

## Goal

Orrin, the tavern's artificer, slowly builds a village next to the tavern for the people of the world. The layout is procedural (drawn from
the world seed), and the buildings come from a library of presaved town structures. He raises each building's **frame** first, over a few
days, then **finishes** it (walls, roof, windows, furnishing) over more days. Progress is slow but never stops, and it is saved: come back
after a week and the village has grown.

## Is it fun? (honest take)

Yes, if it is visible and steady.
- **Fun:** the world changes without the player doing the work. A skeleton of logs appears on the hill, then walls, then a roof with smoke.
  You see Orrin up on the frame with his hammer. A village that grows next to your base is a reason to come back.
- **Risk:** too slow and nobody notices; too fast and it is a free town. Aim for a new frame every two or three days and a finished house
  every five or six, with the first frame showing on day 1 so the player sees it begin.
- **Risk:** it must never wreck the player's own builds. Plots avoid player edits, and Orrin never removes a block the player placed.

## What exists

- `src/npcs/manager.ts` `NpcManager`: owns the tavern people, saves its state as the optional fields of the npcs snapshot (old saves load),
  knows the tavern origin, reads the clock through `NpcHost` (`day()`, `timeOfDay()`, `worldSeed()`).
- `src/npcs/routines.ts`: per person a tavern-local spot for morning, day, evening and night; the manager walks them there.
- `src/world/structureDefs.ts`: the generated structures, drawn with the `Canvas` helpers (`set`, `box`, `fill`, `ring`, `gap`, `floor`,
  `pillar`, `roll`, `mix`). `old_home` is already a furnished village house.
- `src/game/blueprint.ts`: `Blueprint` (cells with block and facing) and `BuildJob` (places cells bottom-up at a fixed pace).
- `src/world/world.ts`: `setVoxel(x, y, z, voxel, source)` records edits (they survive unloads, `edits.ts`), `isLoaded(x, z)`.
- `src/game/clock.ts`: 1-based clock day.

## Design

### 1. The town plan (pure, from the seed)
- **Site:** a patch of fairly flat ground 24 to 64 blocks from the tavern, chosen from the seed by scoring candidate centres (slope, water,
  trees, distance). The tavern road leads to it.
- **Layout:** a small plaza with a well in the middle, a ring road of gravel paths, and plots around it. Plots are filled in order, nearest the
  plaza first, so the village grows outwards ring by ring.
- **Buildings (the presaved structures):** a library of town templates, each drawn with the same `Canvas` helpers as the world structures and
  split into **stages**. First set: a cottage, a workshop, a bakery, a smithy, a market stall row, a well and plaza, a lamp post, a garden
  plot, a town hall (last, large). Each template names its footprint, which way the door faces, and its plot size.
- **The storage bay (first building):** before anything else Orrin builds a storage bay, an open-fronted shed of posts and a roof over
  stacked crates, near the plaza. It holds his working materials. Everything he digs out goes into it, and everything he fills or builds
  with comes out of it (plus what he brings in himself). Its crates are real storage the player can look into.
- **Working with the terrain, not flattening it:** there is no free levelling. Each template is placed to suit the ground:
  - Footings follow the slope: stone footing and log posts run down to the ground on the low side (stilts and stepped foundations), so a
    house on a hill stands on a tall footing instead of a flattened pad.
  - Plots are chosen where the ground under the footprint varies by a few blocks at most; steeper plots are skipped.
  - Where something is in the way (grass, flowers, ferns, loose stone, a dirt bump, a boulder), Orrin moves it: he digs the block out, and
    what it drops goes into the storage bay. Where a small hole needs filling for a doorstep or path, he fills it from the bay's stock.
  - He never digs out logs of standing trees, ores in the open, water, or anything the player placed.
- **Stages per building:**
  1. *Clearing*: moves what is in the way into the storage bay, and fills small holes from it.
  2. *Frame*: the oak-log posts, beams and rafters, the stone footing.
  3. *Walls*: planks, stone, windows, the door.
  4. *Roof*.
  5. *Finish*: floor, furniture, torches, a chimney, flower boxes, a sign.
- Everything is a pure function of the seed and the tavern origin, so the plan is never saved, only how far Orrin has got.

### 2. The builder (saved progress)
- State saved in the npcs snapshot as one optional field: `town: { building, stage, cell, laid, lastDay }`. Old saves start a town on their
  next day turn.
- **Pace:** Orrin lays a block budget per working hour of the day phase (tuned so a cottage frame takes about 2 days and its finish about 3
  more). Nights and festival days he rests. Time away and sleeping still count: on a turned day the builder catches up the day's budget.
- **Placing:** cells are laid in stage order, bottom-up within a stage, through the world with a `town` change source. Cells in unloaded
  chunks wait: the counter keeps going, and when the chunk loads the builder lays everything up to the counter at once (catch-up), so the
  town is always where it should be.
- **Never wreck the player's work:** a cell the player has edited is skipped (not overwritten); a plot with too many player edits is
  dropped and the next plot is used. Mining a town block is allowed (it is the player's world), and Orrin does not rebuild it.
- **Materials come from the player.** Orrin builds only with what is in the storage bay (plus what clearing digs out). When the next cells
  need a block the bay does not have, he stops and waits on that building, and the building board says what is missing.
- **The building board** (at the plaza, next to the storage bay, and like the tavern's quest board in `favours.ts`): Orrin pins
  **material bounties** for what the current building needs next, sized to a stage (for example "24 oak logs for the cottage frame",
  "40 planks for the walls", "12 glass for the windows"). Use the board with the items in hand, or put them in the storage bay, to deliver.
  Each bounty pays:
  - **coin** (gold), scaled to the materials' value,
  - **reputation** with the town (a new town standing value) and trust with Orrin,
  - **rarely an item** (a small roll: a tool, a decoration, a blueprint, a rare material), more likely on big or finishing bounties.
  Three bounties are up at a time; a new one is pinned when one is filled or the stage moves on. Bounties never ask for more than the
  building still needs.
- **Town reputation:** rises with each bounty and each finished building. Thresholds unlock things: the next building types, better
  rewards, and later the residents.

### 3. Orrin on site
- On working days his day spot is the current building (not the tavern): he walks there in the morning, works, and walks back for the
  evening. He stands on the frame, facing the cells he is laying, with a hammer animation and a soft knock sound.
- Talk to him on site for a line about the build ("The smithy's frame is up. Walls tomorrow, if the weather holds.") and a progress line in
  his menu (building, stage, percent, days left).
- A sign at the plaza names the village (from the seed) and lists the finished buildings.

### 4. The town grows
- New templates unlock with the player's age (bronze brings the smithy and the mill, forge brings the clock tower).
- When a cottage is finished, it is marked for a resident (a hook for future villagers; no new NPCs in this plan).

## Phases (each shippable on its own)

Phases 1 and 2 are shipped, and the board part of phase 5 (`docs/api/town.md`). Phases 3 and 4, the unlocks and the next-building choice of phase 5 are not started.

1. **Plan and templates (pure), shipped:** site choice, layout of plots and paths, the template format with stages, templates that fit to the
   terrain (footings and posts that reach the ground), five templates (storage bay, cottage, workshop, well and plaza, lamp post). Tests
   only, nothing in the world yet.
2. **The builder, shipped:** saved progress, daily budget, building only from the storage bay's stock (waits when a block is missing), the storage
   bay built first, clearing that moves blocks into the bay and fills from it,
   laying cells through the world with catch-up for unloaded chunks, player-edit protection, the day-turn catch-up. Visible in the game:
   the village starts on day 1 with the storage bay.
3. **Orrin on site:** routine to the build by day, hammer animation and sound, site dialogue and progress in his menu, the plaza sign.
4. **More buildings and growth:** bakery, smithy, market stalls, gardens, town hall; age-gated templates; plots grow outward.
5. **The building board and reputation (board part shipped):** material bounties for the current stage (coin, town reputation and Orrin's
   trust, rare item rolls), delivery by hand into the storage bay, reputation steps as data. Still to do: the building types that
   reputation unlocks, and a choice of the next building from his menu.

## Tests

- Site choice is deterministic per seed, stays in range of the tavern, avoids water and steep ground.
- Every template fits its plot, has every stage non-empty, and its frame stage is only posts, beams and footing.
- On sloped ground the footing and posts reach the ground on every side (no floating corners) and no terrain is removed except movable
  blocks; standing tree logs, ores, water and player blocks are never dug.
- Clearing conserves material: what is dug goes into the storage bay, what is filled comes out of it.
- No material from nowhere: every placed block is taken from the bay; with an empty bay the builder waits and names what is missing.
- Bounties ask only for what the building still needs, pay coin and reputation, and the rare item roll stays rare over many draws.
- Progress: a budget lays exactly that many cells; stages run in order; a building finishes and the next begins.
- Catch-up: cells in an unloaded chunk are laid when it loads, and none twice.
- Protection: a player-edited cell is never overwritten; a heavily edited plot is skipped.
- Save round trip of the town state; an old save without it starts a town.
- e2e: new world, skip three days, the first frame stands near the tavern; skip ten more, a finished cottage.

## Risks

- **Frame-time cost:** laying many cells at catch-up. Batch per tick (a few hundred cells) and remesh once per chunk.
- **Terrain:** uneven ground under a plot. Footings and posts step down to the ground, and plots with large drops are rejected at site
  choice; no free levelling.
- **Trees:** a plot under a tree is skipped at layout time; felling still works on trees around it.
- **Old worlds:** worlds without a tavern have no Orrin, so no town.

## Open questions

1. How far from the tavern? My pick: 24 to 64 blocks, close enough to see the frame from the tavern door.
2. Decided: the player supplies the materials through the building board's bounties (coin, reputation, rare items).
3. Should finished cottages get new villagers later? (Not in this plan, but the hook is there.)
