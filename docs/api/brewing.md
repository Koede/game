# Brewing simulation (src/sim/brewing.ts) - API for the player, UI, render and game modules

Status: written before the code (BREWING_PLAN sections 4, 8, 9 and 11 as they concern src/sim). Block and item
KEYS are owned by the brewing data engineer (`src/core/brewing.ts`, `docs/api/brewing-content.md`); sim reads every
key from there, none are hard-coded in this API. Where this file names a key it is the plan's name.

## What the sim owns

Two entity kinds, plain JSON in the world (saved with it), never machine nodes: they do not join a power network,
the tick's machine list, `machineView`, `machineAt`, `furnaceAt`, `entityCount`, pipes or grids.

```ts
BoilBucket { kind: 'boil_bucket', x, y, z, heatS: number, boiling: boolean, dryS: number, container: string }
BrewCup    { kind: 'brew_cup',    x, y, z, stage: 'cup' | 'cone' | 'loaded' | 'brewing' | 'done',
             drink: string | null /* drink ITEM key */, brewS: number, steamS: number }
```
`container` is the held-item key that was set down (today `water_pail`), so a boiled-dry or broken bucket returns
the right empty container (`container.emptyTo`). Created from `block:changed` like crops (also on load), removed when
the block goes. The block id is the look; the entity holds the timers.

## Player-facing calls on `Simulation`

```ts
brewUse(x: number, y: number, z: number, heldKey: string | null): BrewResult
placeContainer(x: number, y: number, z: number, heldKey: string | null): BrewResult
isFurnaceTop(x: number, y: number, z: number): boolean
brewView(x: number, y: number, z: number): BrewView | null

type BrewResult =
  | { ok: true; consume: boolean; give?: string; giveDurability?: number; toast?: string }
  | { ok: false; reason: string };
```

`heldKey` is the item key of the held stack, or null for an empty hand. The sim never touches the held slot; the
player module applies the result:
- `consume: true`: remove ONE of the held item. Then, if `give` is set, put one `give` into the same slot when it
  became empty, else into the pack (spill if full). `giveDurability` (a boiling pail's seconds-left, BOILING_KEEPS_S)
  is the stack's `durability`.
- `ok: false`: do nothing to the world or pack; show `reason` as a toast (it is a full sentence that says what to do
  next). The tap is consumed either way (do not go on to place a block, eat or pour).
- Sound and events are emitted by the sim (`sfx` pour / drip / smelt_done, `brew:started`, `brew:done`,
  `water:boiling`, flags `FLAG_BOILED_WATER`, `FLAG_BREWED` via `flagOnce`).

### `brewUse` - call it when the aimed block is a brewing block
Call it first (after animals) when the targeted block's machine role is `brew` (cup states, `furnace_bucket*`), and
when the block is a kettle (`kettle` machine) and the hand holds an empty container. `x,y,z` is that block.

| Aimed block | Held | Result |
|---|---|---|
| clay_cup | drip_cone | block -> cup_cone, `consume` |
| clay_cup | other | refuse "Set a drip cone on the cup" |
| cup_cone | item with `brews` | block -> cup_cone_loaded, entity drink = item.brews, `consume` |
| cup_cone | anything else | refuse "Load the cone with tea leaves or ground coffee" |
| cup_cone_loaded | any container's `boilsTo` (boiling_pail) | stage brewing, `consume`, `give` = container emptyTo (pail), sfx pour, `brew:started` |
| cup_cone_loaded | a water container (water_pail) | refuse "The water must be boiling - heat the bucket on the furnace" |
| cup_cone_loaded | other | refuse "Pour boiling water over it" |
| (brewing) | any | refuse "Still dripping" |
| cup_full | any (empty hand too) | block -> cup_cone, `give` = the drink item (no consume), flag nothing |
| furnace_bucket_boiling | any | block removed, `give` boiling container, `giveDurability` BOILING_KEEPS_S |
| furnace_bucket | any | block removed, `give` the water container (`container`) |
| kettle, boiling (water in it, furnace >= KETTLE_BOIL_C) | empty container (`emptyTo` of a container) | 1000 L out of the kettle, `consume`, `give` its `boilsTo` |
| kettle, not boiling | empty container | refuse "The kettle is not boiling yet" |

Anything else on a brew block refuses with a sentence; it never silently does nothing. If the pack has no room for
`give` the player module spills it as for any give.

### `placeContainer` - holding a water container, aiming at the TOP face of a furnace
`x,y,z` is the AIR CELL above the furnace (the cell that would receive the block). Works when the cell below is a
furnace, or a block of a formed hearth's shell (the roof) - `isFurnaceTop(x,y,z)` says so without acting (use it
to decide, per aim, whether the placing priority applies). Result: the block of `CONTAINER_BLOCKS[heldKey]` is set
(`source: 'player'`), `consume: true`, no `give`. Refusals: not a furnace top, cell not empty (`"There is no room on
top"`), held item is not a water container ("Only a bucket of water can be heated here"). Water is NOT poured out.

### `brewView` - the sentence for the target name and screens
```ts
interface BrewView {
  kind: 'boil_bucket' | 'brew_cup';
  stage: 'heating' | 'boiling' | 'cup' | 'cone' | 'loaded' | 'brewing' | 'done';
  text: string;           // e.g. "Water Bucket - 8 s to the boil", "Boiling water - take it",
                          // "Cup with drip cone - add tea or ground coffee", "Brewing 3 s", "Coffee - take it"
  progress: number;       // 0..1 of the current phase (heating -> boil, brewing -> done), 0 elsewhere
  secondsLeft: number;    // whole seconds, 0 when not timed
  drink: string | null;   // drink item key once loaded
  tempC: number | null;   // furnace under a bucket
}
```
Null when no brew entity stands there. Cheap: reads the entity and the furnace below, no allocation beyond the view.

## Callbacks the player module must call
1. Use on a block with machine role `brew`: `sim.brewUse(x,y,z,heldKey)` before wrench/bucket/station logic and
   before placing; apply `BrewResult` as above. (Also on a kettle with a held container.)
2. Use with a water container aimed at a furnace top: if `sim.isFurnaceTop(x,y,z)` -> `sim.placeContainer`.
3. The cooling boiling pail (`ItemSpec.cools`) is a pack concern (Survival/game), not sim.

## Heat, timing and lifecycle (what tests pin)
- Furnace below: the furnace entity directly under, else the furnace a formed hearth's shell block stands for
  (`shellOwner`). None -> ambient, heating decays 1 s per s.
- Heating: `heatS += dt * clamp((T-100)/200 + 0.5, 0.5, 2)` while `T >= BOIL_TEMP_C`; boils at `BOIL_SECONDS` (12).
  So 150 C: 12 / 0.75 = 16 s; 400 C: 12 / 2 = 6 s. Below 100 C `heatS` decays at 1 s per s.
- Boiling: swaps to `furnace_bucket_boiling`, `water:boiling`, `FLAG_BOILED_WATER` once. Furnace below `BOIL_TEMP_C
  - 20` stops the boil (back to the heating block, `heatS` = half). `BOIL_DRY_SECONDS` of boiling: the bucket is
  removed and the empty container goes to the player (spilled to a crate when the pack is full), toast "The bucket
  boiled dry".
- Heat draw: `furnace.extractW += 300` while boiling, `+= 600` while heating at >= 100 C (shown on the firebox
  panel), added before the furnace is advanced the same tick.
- Brewing: `BREW_SECONDS` (4), sfx `drip` every 0.5 s, then block -> `cup_full`, `brew:done`, sfx `smelt_done`
  (pitched up), `FLAG_BREWED` once. A done cup steams `BREW_STEAM_S` (render reads `brewView`/entity `steamS`).
- Breaking the furnace under a bucket: the bucket block is removed and the container returned (as
  boil-dry). Breaking the cup/bucket block itself: entity forgotten, the block's own drops apply (the player module's
  break handler); the sim returns nothing extra.
- Save/load: both entities are JSON; `resync()` re-adopts them. A bucket mid-boil continues; a cup mid-brew continues.
- Perf: O(brew entities) per tick, one furnace lookup each (two map reads); sleeping buckets cost a few flops.
