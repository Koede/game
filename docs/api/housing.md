# Housing (src/npcs/housing.ts, moveIn.ts, housingView.ts)

Pure modules for the town's housing. Nothing here is wired into the game yet; the manager and the UI call these later.

## Room check (`housing.ts`)

`checkRoom(world, bedX, bedY, bedZ, { doors? })` flood-fills the air from the bed and returns
`{ ok, reasons, cells }`.

- Enclosed: the fill must not reach sky, an unloaded column, or more than 2000 open cells. Otherwise `not enclosed`.
- Size: more than 300 open cells is `too large`. A 3 x 3 floor (furniture counts) is needed (`too small`), and height at least 3 (`too low`).
- Inside or bordering the room: a door (`needs a door`), a lit block (`needs a light`, any block with emitted light), the bed (`needs a bed` if the position is not a bed), and a seat or table (`needs a seat or table`).
- Keys: beds `wool_bedding`; seats and tables `dining_table`, `plank_bench`. Doors: `DOOR_KEYS` is `wooden_door`. Pass `doors` to test with another key.

## Move-in roll (`moveIn.ts`)

- `moveInChance(emptyNights)`: 0 on the first night (`emptyNights` 0); otherwise 0.04 plus 0.02 for each further empty night, capped at 0.30.
- `rollNight(state, rooms, people, rng)`: the first eligible person not yet arrived is in line; each free room is rolled in order and the first success takes them. At most one arrival per night. Returns the arrival, the rooms still free (aged one night) and the state.
- `rollNights(n, ...)`: rolls `n` nights one by one; each arrival carries its 1-based `night`.
- `ARRIVALS` is the line (Rosa: hearth; Gruk: first bronze; Mara: first magic; Old Bram: three residents; Veyra: alchemy). `newcomerLine(facts, reputation, thresholds)` builds the flags.

## Housing view (`housingView.ts`)

- `roomViews(rooms, occupancy)`: each room is `free`, `taken` (with the occupant) or `invalid` (with reasons).
- `nextInLine(line, hasFreeRoom)`: the first in line and what they wait for: `free room`, `reputation` or `trigger` (null when they can come).
- `assignRoom(occupancy, personId, roomId, rooms)`: refuses missing, invalid or taken rooms. `CAMP` always works.
- `evictBroken(occupancy, rooms)`: residents of invalid or missing rooms move to the first free valid room, or to `CAMP`.

Occupancy maps person id to room id (or `CAMP`).
