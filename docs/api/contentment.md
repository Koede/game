# Contentment and coming back (src/npcs/contentment.ts)

A pure module (no world, no rendering). Wired in by `src/npcs/settlement.ts` and the manager: see `docs/api/npcs.md`, "Newcomers, housing and contentment". Implements items 4 and 5 of "Borrowed from Terraria's town NPCs" in `docs/plans/just-you-and-orrin.md`.

## Contentment

- `TASTES`: per person (`orrin`, `rosa`, `gruk`, `mara`, `bram`, `veyra`) likes and dislikes. A subject is a neighbour (a person id) or a surrounding tag (`hearth`, `trees`, `water`, `fumes`, `forge`, `crowded`, `quiet`). Orrin also has a small `company` bonus.
- `contentment(person, facts)` takes `facts = { neighbours, tags, residentsNearby }` and returns `{ score, reasons }`. Each matched like adds, each matched dislike subtracts (neighbour 0.35, tag 0.3). Residents above `CROWD_LIMIT` (3) subtract 0.25 each, capped at 0.75. The raw sum goes through `tanh`, so `score` is in [-1, 1]. `reasons` are short lines such as `likes living near Gruk`.
- Effects, all bounded (any input, including NaN, is clamped first):
  - `priceFactor(score)` in [0.85, 1.2]: content means cheaper.
  - `tipFactor(score)` in [0.5, 1.5].
  - `favourRate(score)` in [0.5, 1.5].
  - `lineTone(score, grumpy?)` gives `'warm'` (>= 0.25), `'neutral'`, or `'grumpy'` (<= -0.25, or when `grumpy` is set).
- Contentment never blocks anything. Callers read the factors and multiply; nothing is gated on them.

## Knock-down and return

State is a plain value (`ContentmentState`: `away` and `rooms`). Every function returns new state.

- `freshContentment()`: empty state.
- `knockDown(state, person, day)`: the person is away on `day`.
- `isAway(state, person, day)`: true on the knock-down day only.
- `returnsOn(state, person)`: the next day (the morning they come back), or `null` if not knocked down.
- `isGrumpy(state, person, day)`: true on the morning they come back. Pass it to `lineTone`.
- `assignRoom(state, person, roomId)` and `roomOf(state, person)`: the room stays recorded through a knock-down and the return. Nothing here touches the world.
