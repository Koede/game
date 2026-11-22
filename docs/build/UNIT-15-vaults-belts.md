# Unit 15 - Vault growth and border belts

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Design pass only; nothing here is built yet.
Names marked **NEW** do not exist in the code today; every other name was checked with grep in the tree at the time of writing.

**Threads:** T6 (helpers address a vault group as ONE container through `offer` / `take` / `logi.peek`; padlock and golem
contracts with Units 16 and 17), T8 (the vault group line `"Item Vault - group of 4, 312/432 stacks"`, toasts in the game's
voice), T10 (groups are DERIVED, only per-cell contents are saved; the save shape does not change; a load bug that clamps vault
contents is fixed), T2 visual boundary with Unit 13 (belt hand-off runs on `Workshop.onMoveEnd`, the END of a glide, never during
it), T9 (reuses existing sounds only; no new `SfxName`). T4: no new item; the unit adds no material, so no T4 row is needed.
T7: see section 2.5 (the "vault growth: forge" gate row is argued away in one sentence, per SYSTEMS rule 3).

Canonical numbers used: `VAULT_STACKS` 108 per cell, "a group shares the sum (4 cells = 432)" (SYSTEMS 5.2), `STRUCTURE_MAX` 48,
`PISTON_MAX` 4, `BELT_SPEED` 1 block/s at 16 rpm, `MAX_GROUND_ITEMS` 256. New constants: `VAULT_GROUP_MAX` 27,
`BELT_END_ZONE` 0.3 (today a literal in `moveBelts`).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The Item Vault already exists: one forge-made block (`forge('item_vault', '4 crate, 2 bronze_plate', 600)`) that holds 108 stacks.
Today four vaults side by side are four strangers: a funnel feeding the first one stops when it is full while the other three
stand empty, an arm must be wrenched to each, and the goggles list every item in one unreadable line. This unit makes vaults
behave like the strongroom a player imagines when they set them shoulder to shoulder:

- **Touching vaults are one store.** Put a second vault against the first and the crosshair says
  `"Item Vault - group of 2, 40/216 stacks"`. Feed any face of the block of vaults - a belt into the east cell, a funnel under the
  top one, an arm wrenched to the corner - and it is all one pile. Empty-hand Use on any cell gives the biggest stack of the
  whole group. Four cells hold 432 stacks; a 3 x 3 x 3 cube holds 2916.
- **Taking one away loses nothing.** Mine a vault out of the middle of a row and its load slides into the vaults it touched; only
  when the rest is full does anything spill, and the toast says how much (`"Vault removed - the group is full, 37 stacks spilled"`).
  The two halves become two groups, each still holding exactly what its cells held.
- **Vaults ride contraptions.** A vault group on a piston platform moves whole; its stacks go with it (they already do, through
  `Workshop.relocate`), and it re-forms its group wherever it stops.
- **Belts reach across the gap.** A belt on a piston shuttle or a bearing turntable holds its load at the edge instead of tipping
  it into the void, and the moment the platform stops (at the END of Unit 13's glide) every belt end that now faces a partner
  across the structure border hands its waiting items over: onto the static belt beyond, into the depot, the vault group, the
  millstone, the skiff. A static belt that runs into the path of a contraption, or onto a rail lane, waits for its ride the
  same way. The push hands it over even when the belt itself is not turning.

The fantasy: a Bronze/Forge yard where a turntable deals ore to three belts in turn, a piston shuttle ferries flour from the mill
to a wall of vaults, and the wall reads as one honest number.

Design tone (congruence): this is plumbing for items, so it obeys the same rules as the fluid side (T3 "litres are exact and
conserved") translated to items: **items are exact and conserved** across merge, split, move and hand-off; nothing is created,
nothing vanishes (the one exception, the ground-item cap, is called out in 5.3 and section 14).

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 T6 - how arms, funnels, chutes, deployers, golems and belts address a vault group

The machine interface (`docs/api/workshop.md`, "Machine interface for other systems") is unchanged in shape. What changes is the
meaning of a coordinate that lands on an `item_vault` cell: **every vault cell is a door to its whole group.**

| caller | call it makes today | behaviour after this unit |
|---|---|---|
| belt end (`Workshop.moveBelts`) | `this.logi.accept(ahead.x, ahead.y, ahead.z, e.item, e.count, false)` then commit | accepts into the group the front cell belongs to |
| ground intake (`Logistics.intakeGround`, `TAKES_GROUND` has `item_vault`) | `this.accept(x, y, z, e.item, e.count)` for items resting on top | items resting on ANY cell's top go into the group |
| funnel / chute (`Logistics.mover`) | `this.take(...from, c.filter, 8)` from behind/above; `this.accept(...dest, item, n)` in front | pulls from / pushes into the group |
| mech arm (`Logistics.arm`) | `this.peek(...src)`, `this.take(...src, entry.item, room)`, `this.accept(...t, ...)` | source or target is the group; reach (`ARM_REACH` 3) is checked against the wrenched cell only, so one cell within 3 blocks reaches the whole group |
| deployer, vacuum collector (output via `mover`) | `accept` | into the group |
| `Workshop.offer(x, y, z, item, count)` / `Workshop.take(x, y, z, filter, max = 64)` | `logi.accept` / `logi.take` | group-wide; this is what Unit 17's golem and any magic construct uses |
| player Use (`Logistics.use`, case `'item_vault'`) | put held stack; empty hand gives the biggest stack | group-wide; the stack appears on top of the cell you used |

Contract for Unit 17 (golems, SYSTEMS 6.2 "17 (golems target vault groups as one container)"): a golem's source or target is the
cell the player wrenched. Range `GOLEM_RANGE` 8 is measured from the golem's home to that cell only. The golem calls
`workshop.offer(cell, item, n)` / `workshop.take(cell, filter, 64)`; it never needs to know about groups. Its status line may
name the container with `blockOrNull(kind).name` ("Clay Golem - carrying 8 Flour to the Item Vault, fed 22 s"). Unit 15 exposes
`Logistics.vaultGroupAt(x, y, z)` (NEW, read-only, section 7) in case Unit 17 wants to show "group of 4" in its own line; it is
optional for 17.

### 2.2 Padlock interplay (Unit 16)

SYSTEMS T6: "`logi.take` refuses a locked container for every caller except the player's own hand." Unit 16 owns
`padlock_chest` and the lock check. Contract:

1. `padlock_chest` is its own block kind; it is never `item_vault`, so it never joins a vault group and a group never "contains"
   a padlock. Nothing to merge.
2. Unit 15 routes every group read/write through two private methods (`vaultAccept`, `vaultTake`, section 8) called from inside
   `Logistics.accept` / `Logistics.take`. Unit 16 puts its lock check at the TOP of `Logistics.take` (before the crate branch);
   the vault branch is below it, so a lock check on the addressed cell runs before any group take. No ordering conflict.
3. If a later unit makes vaults lockable, the rule is **a group is locked when any member cell is locked**, evaluated with
   `vaultGroupAt(x, y, z).cells.some(locked)`. This unit writes that rule as a comment at the vault branch of `take` so the next
   builder does not lock only one door of a strongroom.
4. Player Use is never refused by a lock (16's rule); the vault `use` path is the player's hand.

### 2.3 Hot items (Unit 4)

UNIT-04 section "Containers refuse hot items": "crates, machine slots, vaults, workshop depots and arms ... cannot take a boiling
pail or a full ladle". Vault groups obey it: `vaultAccept` returns 0 when `isHot(item)` (Unit 4's helper, **NEW** in
`src/game/inventory.ts`: `itemOrNull(item)?.cools !== undefined`). If Unit 4 has not merged when this is built, inline the same
expression with a `// Unit 4: isHot` comment. A hot item on a belt facing a vault therefore waits at the belt end (it does not
fall off), cools on the belt (ground items cool, Unit 4), and goes in once cold. Player Use with a hot ladle on a vault:
toast `"It is too hot to store - let it cool first"` (refusal voice, T8), return `'refused'`.

### 2.4 Unit 13 (motion) - the END of a step

UNIT-13 section 2.6 provides `Workshop.onMoveEnd(fn: (cells: readonly string[]) => void): () => void` (NEW in Unit 13), "called
once per glide when its `t0 + durS` has passed on the workshop clock ... with the destination cell keys ... Steps that were never
tweened ... call it in the same tick as the commit." Unit 15 registers ONE listener in the `Workshop` constructor:
`this.onMoveEnd((cells) => this.handOffBorders(cells))`. Vault groups need no listener: their cache is invalidated by `relocate`
at commit time (data moves at commit; only the drawing glides).

If Unit 13 has not merged when this unit is built: add `onMoveEnd` exactly with Unit 13's signature, backed by a private list of
listeners, and fire it from `Workshop.relocate(map)` with `[...map.values()].map(k3)` after the per-system relocates (same tick
as the commit, which is what Unit 13 does for untweened steps). On merge Unit 13's version replaces the body; callers are equal.

Items ride the structure in data at commit (`commit(moves, item)` moves `e.x/e.z`), so during the 0.6 s glide a carried belt's
items are already at their end positions. The hand-off waits for the glide end so an item is never seen jumping onto the far
belt while the platform is still drawn half way.

### 2.5 T7 gating

SYSTEMS T7 lists "vault growth" under forge. The vault block itself is already gated by its recipe (bronze plates, forge recipe
at 600 C); growth is not a recipe but the absence of a wall between two blocks the player already owns. Adding a second gate
(e.g. "vaults only merge at Blast Furnace tier") would make two identical blocks behave differently by furnace tier, which no
other block in the game does. **Decision: growth has no separate gate; it is available whenever the vault is.** Coordinator:
change the T7 row to "vault growth: follows the `item_vault` recipe (no own gate)". The progression solver is unaffected (no new
recipe, no new item).

### 2.6 Ownership

Unit 15 owns (SYSTEMS 6.2 "vault groups, belt border hand-off"): `VAULT_GROUP_MAX`, `vaultGroupAt`, the group store rules, the
break-pour rule, `BELT_END_ZONE`, `beltEnd`, `handOffBorders`, the waiting (dock) rule and `Contraptions.docks()`. It consumes
`onMoveEnd` (13), `isHot` (4), and leaves the lock hook to 16.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

All quotes from the tree on 2026-11-22.

### 3.1 The vault (`src/workshop/logistics.ts`)

- `export const VAULT_STACKS = 108;` (line 41). `item_vault` is in `LOGI_KINDS` (line 19) and `TAKES_GROUND` (line 25), and in the
  `peek` whitelist (line 228). It is in `NON_KINETIC` (`src/content/itemsWorkshopParts.ts` line 59), so it has no kinetic part and
  `Workshop.describe` falls through to `this.logi.describe(x, y, z)`.
- Item description (`itemsWorkshopParts.ts` line 41): `'Holds 108 stacks of anything. Funnels, arms and belts fill and empty it.
  Use it with an item to store, empty-handed to take the biggest stack.'`
- Goal (`src/content/objectivesWorkshop.ts` line 22): `goal('place_item_vault', 'Build an item vault', ...)` with text
  `'A Vault holds 108 stacks. Fill it with a funnel or an arm and take the biggest stack with an empty hand.'`
- Storage: `Cell.items: Record<string, number>` per cell (one map per vault, counts can exceed a stack).
- `accept` case `'item_vault'` (lines 163-172): counts used stacks as `sum(ceil(n / stackLimit(it)))`, room = free stacks times the
  item's limit plus the top-up room of its partial stack.
- `use` case `'item_vault'` (lines 295-304): held -> `putOrTake`; empty hand -> the entry with the largest count, gives
  `min(count, stackLimit)` as a ground item at `y + 1.1`.
- `take` (lines 233-257): generic: first entry of `c.items` (insertion order) matching the filter, up to `max` (default
  `CELL_CAP` 16 inside `Logistics`; `Workshop.take` defaults to 64).
- `noteBlock` (lines 100-111): when the block is no longer a logistic kind, **every item of the cell is spawned on the ground**
  at the cell centre (`this.host.ground.spawn(item, n, x + 0.5, y + 0.5, z + 0.5)`), then the cell is deleted.
- `describe` (lines 718-736): `Item Vault - <n> <Name>, <n> <Name>, ...` listing EVERY kind - no stack count, no capacity, easily
  over the 60-character HUD budget.
- `toJSON` / `load` (lines 738-764): rows `[x, y, z, kind, items, fluid, filter, src, targets]`.
  **Bug found:** `load` clamps every item count to `Math.min(CELL_CAP * 4, Math.floor(n))` = 64. A vault holding 500 flint saves
  500 and reloads 64: 436 flint vanish on every reload. Unit 15 fixes this (section 7.3); it is the most important line in the
  unit for players who already use vaults.
- `relocate(map)` (lines 694-716): moves cells and rewrites arm `src` / `targets` keys. Vault contents already move with a
  contraption.
- `verify()` (lines 767-772): deletes cells whose block is gone without spilling (chunk-safe: skips unloaded chunks).

### 3.2 Belts (`src/workshop/workshop.ts`)

- `BELT_SPEED = 1` (line 47). Belts are kinetic parts (`conveyor_belt` in `KINETIC`).
- `moveBelts(dt)` (lines 469-517): for every ground item whose cell `(floor(e.x), floor(e.y - 0.05), floor(e.z))` is a turning belt:
  direction `dir = rpm > 0 ? -1 : 1` times the facing vector `FACE_VEC[voxelFacing(...)]`; items are pulled to the centre line at
  2 blocks/s; when `along + step > 0.3` the front cell is tested in this order: (1) a mechanical twin with a recipe and
  `this.space(twinKey) >= e.count` takes all (`this.intake`); (2) `this.logi.accept(..., false)` > 0 and the front is not a belt:
  commit the accepted part; (3) `if (front.solid && front.key !== 'conveyor_belt') continue;` (stop); else (4) the item keeps
  moving - onto the next belt if there is one, **off the end into the air otherwise**. Note: `logi.accept` for a front
  `conveyor_belt` returns `n` (it would spawn) but the code skips the commit for belts, so belt-to-belt is pure physics.
- Two belts facing head-on today pass an item back and forth at the seam (each pushes it toward the other).
- `moveBelts` returns early when `this.speed.size === 0`, and skips belts whose rpm is 0: **a still belt never hands anything on.**
- `isMovable(kind)` (lines 164-167): `contraption_frame`, every `KINETIC` kind, every `isLogistic` kind (so `item_vault`), every
  `SIGNAL_KINDS` kind; never `CONTRAPTION_KINDS` or generators.

### 3.3 Contraptions (`src/workshop/contraption.ts`)

- `STRUCTURE_MAX = 48`, `PISTON_MAX = 4`, `PISTON_STEP_S = 0.8`, `BEARING_STEP_S = 1.5`, `SKIFF_STEP_S = 0.2`.
- `structure(start, skip)` (line 82): BFS over `host.movable`, returns null past 48 blocks. Because vaults are movable, a vault
  group touching a structure is carried WHOLE (or the push is refused: `'The contraption is too big to push (48 blocks)'`).
- `commit(moves, item)` (line 100): refuses if any destination is not air / non-solid; sets voxels inside `host.hold(...)` (the
  Workshop ignores `block:changed` while holding, so `noteBlock` does NOT spill the vault), calls `host.relocate(map)`, then moves
  the ground items standing on moved cells with the `item` callback.
- Pistons: structure in front, pushed `+d`, leaves a `contraption_frame` rod; pulled back when unpowered. Bearings: structure on
  top turned a quarter turn about the bearing column. Skiffs: one cell rolling on `rail`.
- `Contraptions.acts` is private; `describe` gives `"Piston - pushing, extended 2 of 4"`.

### 3.4 Tests that exist

- `src/workshop/parts.test.ts`: `setup()` returns `{ world, ground, shop, put, run, entities, toasts, rpm, bus }`; test
  `'an item vault holds many stacks and gives the biggest one back'` (offer 500 flint = 500; a million planks less than a million).
- `src/workshop/contraption.test.ts`: `'a belt on a turning platform still carries its items with it and the powered machine on it
  keeps its state'`, piston and skiff tests.
- `src/workshop/logistics.test.ts`: funnels, arms, depots, basins (no vault group tests).
- `scripts/e2e-workshop.mjs`: steps via `report.step(name, run)`, driver `d` with `d.hw`, `d.approach`, `d.use`, `d.selectItem`,
  `d.selectEmptyHand`, `d.settle`, `d.shot`; `scripts/lib/e2eDriver.mjs` has `holdMine(done, timeoutMs)`.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Group shape rules

- A **vault group** is a set of `item_vault` cells connected through shared FACES (the six neighbours `+-x`, `+-y`, `+-z`).
  Edges and corners do not join. Any shape counts: a row, an L, a tower, a 2 x 2 x 2 cube. No "must be a box" rule: phone players
  place blocks one at a time and a half-built cube must already work.
- At most `VAULT_GROUP_MAX` = 27 (**NEW**, `logistics.ts`) cells per group (a 3 x 3 x 3 cube, 2916 stacks). Why a cap: a group
  is a BFS on every query that misses the cache; 27 keeps that trivially cheap and keeps the goggles numbers readable (4 digits).
  27 x 108 = 2916 stacks = 288 684 rubble (stack 99) - more than any base needs.
- Group formation is deterministic. Sort all vault cells by the **fill order** `(y, z, x)` ascending ("bottom row first, then
  north to south, then west to east"). Take the first cell not yet grouped, BFS from it over face neighbours in that same sorted
  order, stop adding at 27; repeat with the next ungrouped cell. Cells left over past 27 form their own group(s) by the same rule.
  A 28th vault touching a full 27-group is therefore its own group of 1 and its line says so (`"Item Vault - 0/108 stacks"`);
  the place toast says `"Vault groups hold at most 27 vaults - this one stands alone"` (info).
- The **anchor** of a group is its first cell in fill order. It is used only for determinism (ordering groups, test assertions);
  it holds nothing special.

```
 top view, y = 0                  side view (x, y)
   x ->                             y
 z . V V .    V = vault cell        ^   . V .     a tower and a row joined
 | . V V .    one group of 4        |   . V .     by the face at (1,0): group of 5
 v . . . V    the diagonal V is     |   V V V
              its own group of 1    +---------> x
```

### 4.2 Capacity

`capacity(group) = cells.length x VAULT_STACKS` (108, 216, 324, 432, ... 2916).

`used(group) = sum over cells of sum over kinds of ceil(count / stackLimit(kind))` - counted per cell, exactly as the single vault
counts today (`stacks += Math.ceil(n / stackLimit(it))`). Invariant kept by every write: **each cell holds at most
`VAULT_STACKS` stacks** (so `used <= capacity` always, and a split never leaves a half over full).

Why per-cell counting and not a pooled count: a partial stack of flint in two cells really does occupy two stack slots. The
insertion order (4.4) keeps at most one partial stack per kind per group in normal play; merges can create a second one
(two vaults each with 10 flint join: 2 stacks used, not 1). That costs at most one stack per kind per merge and is honest. No
compaction pass is needed; it would move items between cells for no player-visible gain.

### 4.3 Store model: shared view over per-cell contents (decision)

Two models were considered:

| | (A) master cell holds the pooled store | (B) each cell keeps its own items; the group is a view (**chosen**) |
|---|---|---|
| save shape | changes (master moves when cells change) | unchanged: `LogiSnapshot.cells` rows as today |
| old saves | need a migration pass | load as they are; groups derive (T10 rule 5 "Groups ... are DERIVED where possible and only their contents are saved") |
| split | must partition the pool (proportional fill, overflow rules) | trivial: each half keeps what its cells hold |
| piston moves part of a group | must re-partition | cells carry their own items through `relocate` |
| break a cell | must decide the broken cell's "share" | the share is what the cell holds; it pours into its neighbours (4.6) |
| cost | one map | group ops iterate up to 27 cells (cheap) |

(B) is chosen. The group is computed, cached, and invalidated (8.2); nothing about it is saved.

### 4.4 Insertion order (accept)

`vaultAccept(group, item, n, commit)`:

1. Refuse (return 0) when `isHot(item)` (2.3) or `!itemOrNull(item)`.
2. **Top up partial stacks first**: walk cells in fill order; in each cell with `have = items[item] > 0` and
   `have % limit !== 0`, add up to `limit - have % limit`.
3. **New stacks second**: walk cells in fill order; in each cell with free stacks `free = VAULT_STACKS - used(cell)`, add up to
   `free x limit` (fill the bottom cell before the next).
4. Return the total placed (`<= n`). With `commit = false` compute the same number without writing (belts and arms ask first).

Result: a group fills like a bin, from the bottom cell up; a group that is 312/432 has its lower cells full and its top cells
holding the rest.

### 4.5 Extraction order (take, peek, empty-hand Use)

- `peek` on any member cell returns the **group total per kind**, one entry per kind, sorted by count descending then key
  ascending (deterministic; arms walk this list, so they move the most plentiful thing first - same spirit as "biggest stack").
- `vaultTake(group, item | null, max)`: when `item` is null pick the first kind of the `peek` order (the most plentiful); take up
  to `max` of it from cells in **reverse** fill order (top cell first), so the bottom stays full and the group stays compact.
  Returns `{ item, count }` or null. `max` keeps its caller's default (16 in `Logistics.take`, 64 via `Workshop.take`).
- Empty-hand Use: the kind with the largest group total (ties: key ascending), `n = min(total, stackLimit(kind))`, taken top
  first, spawned on top of the cell the player used at `y + 1.1` (unchanged position code). Toast none (the item pops up; that
  is the feedback, as today).

### 4.6 Breaking a cell: pour, then spill

When an `item_vault` cell's block becomes something else outside a contraption step (player mining, explosion, any `setVoxel`
not wrapped in `hold`), `Logistics.noteBlock` does, in order:

1. Collect the vault cells among the six face neighbours of the broken cell (the broken block is already gone in the world).
2. Group them (4.1, cache invalidated first). Order those neighbour groups by anchor in fill order. Remove duplicates (two
   neighbours may share a group).
3. For each item kind of the broken cell (kinds in key order), `vaultAccept(group, kind, left, true)` into each neighbour group in
   order until nothing is left.
4. Whatever is still left spills exactly as today: `ground.spawn(item, n, x + 0.5, y + 0.5, z + 0.5)` (which splits into stacks).
5. Toasts (only when the broken cell held anything AND had at least one vault neighbour):
   - all poured: `"Vault removed - its 12 stacks moved into the group"` (info). With several neighbour groups: same text.
   - some spilled: `"Vault removed - the group is full, 37 stacks spilled"` (warn).
   A lone vault (no neighbours) spills silently, as today.

"12 stacks" counts stacks of the broken cell's contents (`sum ceil(n / limit)`), so the number matches what the player saw.

Splitting: breaking the middle of a row `V V V` leaves `V . V`: two groups of 1. The middle cell's items pour into the WEST
group first (lower anchor in fill order), then the east. Each outer cell keeps what it held. Conservation: before = west + mid +
east; after = west' + east' + spilled; equal.

### 4.7 Placing a cell: merge

Placing an `item_vault` adds an empty cell (`noteBlock` creates it). The cache is invalidated; the new group is the union. No
items move. If the new cell joined at least one other vault, one info toast:
`"Vaults joined - group of 4, 432 stacks"` and one sound (6.3). No toast for a lone vault. If the 27 cap left the new cell alone:
the cap toast from 4.1.

### 4.8 Goggles and crosshair line (T8)

`Logistics.describe` for an `item_vault` cell returns, by the T8 grammar (first fact = state, then numbers, then contents):

| state | line |
|---|---|
| lone, empty | `Item Vault - empty, 108 stacks` |
| lone, some | `Item Vault - 12/108 stacks, most 640 Flint` |
| group, empty | `Item Vault - group of 4, empty, 432 stacks` |
| group, some | `Item Vault - group of 4, 312/432 stacks, most 2048 Flint` (55 chars) |
| group, full (used = capacity) | `Item Vault - group of 4, full, 432/432 stacks` |
| hot item refused (no state; toast only) | - |

Rules:
- `most <n> <Name>` is the kind with the largest group total; appended only when the whole line stays at or under
  `HUD_LINE_MAX` 60 characters (**NEW** local constant in `logistics.ts`), else omitted. Example that drops it:
  `Item Vault - group of 27, 2915/2916 stacks` + `, most 186000 Weathered Copper Plate` (too long).
- `n` printed as an integer, no thousands separator (matches `"holds 2 Wheat"` style).
- The line is the same with or without goggles (vaults are not kinetic). The full contents list is not shown on the HUD (no
  screen in this unit; see 13).

### 4.9 Belt border hand-off

Vocabulary:

- **Run direction** of a belt `b`: `d = FACE_VEC[voxelFacing(voxel)] x (rpm > 0 ? -1 : 1)` as in `moveBelts`. For a STILL belt
  (rpm 0) use `rpm > 0`'s direction, i.e. "away from the side it was laid from" - the way it runs when cranked forward.
- **Front** of `b`: `f = b + d` (same y).
- **End zone**: an item on `b` with `along >= BELT_END_ZONE` (0.3, **NEW** constant replacing the literal `0.3` in `moveBelts`),
  where `along = (e.x - cx) * dx` or `(e.z - cz) * dz` as today.
- **Carried belt**: a belt that is part of a contraption structure right now (piston front structure, bearing top structure).
- **Dock cell**: an air cell that some contraption structure could occupy: for a piston with extension `ext`, every structure cell
  shifted by `k x d` for `k` in `[-ext, PISTON_MAX - ext]`; for a bearing, every structure cell turned 0, 1, 2, 3 quarter turns
  about the bearing column; plus every air cell whose block below is `rail` (a skiff lane).
- **Border pair** (after a move with destination cells `M`): a belt `b` and its front `f` with exactly one of `b`, `f` in `M`.

#### Rule W (waiting, every tick, replaces "off the end into the air")

In `moveBelts`, when an item is in the end zone and the front is **air**:
- if `b` is a carried belt, or `f` is a dock cell: the item **waits** (treated like a solid front: no move along, centring
  continues);
- otherwise: unchanged, it rides off the end and falls (players use this to drop into pits and hoppers; keep it).

Also in `moveBelts`, NEW **head-on rule**: when the front is a `conveyor_belt` whose own run direction is `-d`, the item waits
(today it ping-pongs). Side-loading (front belt perpendicular) and straight continuation are unchanged physics.

#### Rule H (hand-off, once per move end)

`handOffBorders(cells)` runs from the `onMoveEnd` listener (2.4) with the destination keys `M`:

1. Candidate belts: every `conveyor_belt` part whose cell is in `M`, plus every belt part at a horizontal neighbour
   (`+-x`, `+-z`) of a cell in `M`.
2. For each candidate `b` with front `f` forming a border pair: snapshot the ground items on `b` that are in the end zone (by the
   same cell rule as `moveBelts`, skipping `homing`), and call `beltEnd(e, b, d, 'handoff')` for each, in ground-list order.
3. An item handed onto another belt is recorded in a local `Set<number>` of ground item ids and skipped if met again in the
   same pass (a loop of belts cannot hand one item twice per move).
4. Belt rpm does not matter: a still belt hands across too (the push does the work). This is the "after each move" promise.

#### `beltEnd(e, b, d, why)` (**NEW**, the one end-of-belt rule, used by both `moveBelts` and Rule H)

Returns `'taken' | 'moved' | 'wait' | 'fall'`. Front block `front = world.getBlock(f)`.

| order | front is | result |
|---|---|---|
| 1 | a mechanical twin (`TWIN.has(front.key)`) with `recipeFor(front.key, e.item)` and `space(fKey) >= e.count` | `intake(fKey, e.item, e.count)`, `e.count = 0`, `'taken'` |
| 2 | not a belt, and `logi.accept(f, e.item, e.count, false) > 0` (depot, basin, funnel, chute, crate, vault group, skiff, deployer...) | commit the accepted part, `e.count -= taken`; `'taken'` if 0 left else `'wait'` (the rest waits) |
| 3 | a `conveyor_belt` running head-on (`-d`) | `'wait'` |
| 4 | a `conveyor_belt` otherwise | `why === 'tick'`: `'fall'`-free physics, return `'moved'` (caller moves the item along as today). `why === 'handoff'`: place the item at the entry of `f`: `e.x = f.x + 0.5 - dx x 0.3`, `e.z = f.z + 0.5 - dz x 0.3`, `e.y = f.y + 0.6`, `vx = vz = 0`; return `'moved'` |
| 5 | solid | `'wait'` |
| 6 | air, and (b carried or f a dock cell, or `why === 'handoff'`) | `'wait'` |
| 7 | air otherwise | `'fall'` (caller lets it ride off, as today) |

`y + 0.6` is the height belts already use when `logi.accept` spawns onto a belt (`this.host.ground.spawn(item, n, x + 0.5,
y + 0.6, z + 0.5, ...)`).

#### Diagrams

Piston shuttle, top view. `P` piston facing east, `F` frame, `>` belt running east, `D` depot, `.` air.

```
 before (ext 0)                 after one push (ext 1)           after the glide ends
 P F > .  D                     P F F > D                        hand-off: item at the end of
     ^ item waits at the end        ^ rod  ^ belt end faces D    the carried belt goes into D
     (carried belt, Rule W)                                      (Rule H, row 2)
```

Turntable, top view. A bearing under the centre; the platform belt runs north. Three static belts wait on three sides.

```
      ^ static belt (running north, away)        after a quarter turn right the platform belt
      |                                          runs east: its end now faces the east static
  > [B^] >   the platform belt ^ runs north;     belt: Rule H moves the waiting items onto it.
      |      its end faces the north belt        The west static belt (running east, INTO the
                                                 platform) waits: its front is a dock cell.
```

Skiff lane, side view. `=` rail, `S` skiff, `>` static belt ending above the lane.

```
   > > .        the lane cell has rail below it: dock cell, the belt waits (Rule W)
   # # =  = =   when the skiff's step ends in that cell, Rule H hands the stack into it
                (logi.accept on 'skiff', depot rules: one stack of one kind)
```

Head-on, top view: `> <` - both belts hold their items at the seam; nothing oscillates.


### 4.10 Belt ends are structure borders (the rule that makes a border exist at all)

Today `Contraptions.structure` follows every face between two movable blocks. Belts and depots are movable, so a static belt that
touches a platform after one step is swallowed into the structure on the next step and dragged along: there IS no border to hand
across. Rule (**NEW**, in `structure()`):

> The BFS does not cross a face that lies on a belt's run axis. From a `conveyor_belt` cell it does not step to the cell in front
> of it or behind it (along `FACE_VEC[facing]`, either sign); from any cell it does not step INTO a belt whose run axis points at
> that cell.

Consequences, all intended:
- A belt on a platform still moves with the platform as long as it touches the structure through a side or its underside (the
  usual case: belts lie on frames). The existing test `'a belt on a turning platform still carries its items with it ...'`
  (belt at `(2,1,0)` facing North, frame at `(1,1,0)` to its west: a side face) keeps passing unchanged.
- A static belt pointing at the platform, or the depot / vault / millstone at the end of a carried belt, stays where it is.
  These end-to-end contacts are exactly the border pairs of Rule H.
- A belt line with no frame under it on a platform falls apart into "the belt touching the structure by its side" plus the rest,
  which stays. Documented in the Guide rules line (section 11): "Belts join a moving structure by their sides and undersides,
  never by their ends".
- Vault-to-vault faces are followed (a vault group moves whole, 5.4).

The start cell of `structure(start)` is always included (the piston's front / bearing top), even if it is a belt.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour, rules and edge cases

Each case: what happens, and the message if any. "Group" means the group after the event.

### 5.1 Vault groups

| case | behaviour | message |
|---|---|---|
| place a vault touching one or more vaults | merge (4.7); no items move | info `"Vaults joined - group of 3, 324 stacks"`; sound 6.3 |
| place a 28th vault touching a 27-group | it is its own group | info `"Vault groups hold at most 27 vaults - this one stands alone"` |
| place a vault touching two separate groups (bridge) | one group if the total is <= 27; else the fill-order BFS caps at 27 and the rest forms another group | join toast with the size of the group the new cell ended in |
| break the middle of `V V V` | middle pours west then east; two groups of 1 | `"Vault removed - its N stacks moved into the group"` or the spill toast |
| break a cell of a FULL group | its contents pour into the remaining groups up to their room (none if they are full), rest spills at the cell centre | warn `"Vault removed - the group is full, 37 stacks spilled"` |
| break a lone vault | spills everything (unchanged) | none |
| break a cell whose neighbours are full and the spill is large | `ground.spawn` splits into stacks; `GroundItems` keeps at most `MAX_GROUND_ITEMS` 256 entities and merges/evicts the oldest past that (existing). A full vault is 108 stacks, so one break stays under the cap unless the floor is already littered; see 14.3 | spill toast |
| `verify()` finds a vault cell whose block is gone (chunk reload) | deleted without spill (unchanged); cache invalidated | none |
| Use with a held stack on any cell | `vaultAccept` on the group; if 0 fits: `'refused'` | refusal toast `"The vault group is full"` (lone: `"The vault is full"`) |
| Use with a hot item | refused | `"It is too hot to store - let it cool first"` |
| Use with a held BLOCK | unchanged: `use` returns null when `placing`, the block is placed (this is how a player grows the group) | none |
| empty-hand Use on any cell | biggest kind of the group, one stack, on top of the used cell | none (unchanged) |
| empty-hand Use on an empty group | `'worked'`, nothing happens (unchanged) | none |
| funnel behind cell A pulling, belt filling cell B of the same group | both act on the one store; a funnel can empty what a belt fills | none |
| arm with source = cell A and target = cell B of the same group | each cycle takes from the group and puts back into the group: a no-op loop. Allowed (harmless) | none |
| item with durability on a belt into a vault | `logi.accept` takes only `item, count` today, so durability is dropped for depots and vaults alike (existing behaviour, not widened here; Unit 4 owns the boiling pail case, and hot items are refused anyway) | none |

### 5.2 Vaults and contraptions

| case | behaviour |
|---|---|
| a vault group on a piston platform | the structure BFS crosses vault faces, so the group moves whole (if the structure stays <= 48 blocks: else `'The contraption is too big to push (48 blocks)'`). Contents move through `Logistics.relocate` (unchanged). `commit` runs inside `hold`, so `noteBlock` never fires and nothing pours or spills. Cache invalidated in `relocate`. |
| a moving vault comes to rest touching a static vault | they merge from the next query (one group). On the next step the static vault is now part of the structure (vault faces are followed) and moves with it: documented in the Guide ("Vaults that touch move together") |
| a bearing turns a group | cells turn about the column; contents follow; group shape re-derives (still connected, still the same cells) |
| a skiff | holds one stack itself; it is not a vault and never joins a group |
| part of a group moved | cannot happen through the structure rule (vault faces are followed); the only way is a group larger than the structure limit, and then the step is refused. Should a future rule cut a group, (B) handles it with no extra code: each cell keeps its items |

### 5.3 Saving and loading vaults

| case | behaviour |
|---|---|
| save | unchanged rows; groups are not saved |
| load (new code) | each vault cell's counts are clamped per kind to `VAULT_STACKS x stackLimit(kind)` instead of `CELL_CAP x 4` (64). The fix |
| load an old save | loads as is (same rows); counts that the old code had already clamped to 64 stay 64 (they were lost on an earlier load, nothing to recover) |
| a loaded cell holds more than 108 stacks in total (hand-edited / corrupt) | kept, no deletion; `vaultAccept` sees the cell as full (free stacks < 0 counts as 0); the group line shows `used/capacity` honestly, e.g. `Item Vault - group of 2, full, 230/216 stacks`. Taking items out works normally |

### 5.4 Belts

| case | behaviour |
|---|---|
| belt end faces air, no contraption around | item rides off the end and falls (unchanged: `'fall'`) |
| carried belt's end faces air (shuttle away from its station) | item waits at the end (Rule W) |
| static belt faces a dock cell (the empty path of a piston/bearing structure) | waits |
| static belt faces a rail lane cell (air with `rail` below) | waits; when a skiff stops there, Rule H loads it |
| after a move, a carried belt's end faces a static belt running away | the waiting items are placed at the entry of the static belt (Rule H row 4); from then on, ordinary physics |
| after a move, end faces a static belt running head-on | waits (row 3) |
| after a move, end faces a depot / basin / funnel / chute / crate / vault group / skiff / deployer | `logi.accept` takes what fits; the rest waits |
| after a move, end faces a twin machine (millstone, saw...) | intake if it has a recipe for the item and room (row 1), else falls through to `logi.accept` (twins accept via `twinAccept`), else waits |
| after a move, end faces terrain | waits |
| static belt facing INTO a platform cell that is a perpendicular belt | ordinary side-loading every tick (unchanged physics), so a static feeder keeps loading a docked platform |
| loop of belts across a turntable | one hand-off per item per move end (id set); ordinary physics otherwise; no item is handed twice in one pass |
| belts at different heights | no hand-off (front is same y only); belts have no ramps in the game |
| a still belt after a move | Rule H still hands its waiting items across (the push did the work); Rule W does not apply to still belts because `moveBelts` skips them (nothing reaches the end of a still belt) |
| `speed.size === 0` early return in `moveBelts` | stays; Rule H runs from the move-end listener, not from `moveBelts` |
| move end while the item is mid-belt (not in the end zone) | not handed; it rides on with ordinary physics if the belt turns |
| items on a carried belt during the glide | already at their end position in data (Unit 13 draws them offset); Rule H fires at glide end |
| the destination of a hand-off onto a belt is occupied by another item | items do not collide in this game (ground items overlap); fine |
| a hot item reaches a vault/crate through a belt | `accept` returns 0 (Unit 4 rule) -> waits at the end, cools on the belt, then goes in |

### 5.5 Messages (complete list of new strings)

| id | text | kind | when |
|---|---|---|---|
| `vault.join` | `Vaults joined - group of {n}, {cap} stacks` | info | a placed vault touches others |
| `vault.alone` | `Vault groups hold at most 27 vaults - this one stands alone` | info | the cap left a placed vault alone |
| `vault.pour` | `Vault removed - its {s} stacks moved into the group` | info | broken cell held items, all poured |
| `vault.spill` | `Vault removed - the group is full, {s} stacks spilled` | warn | broken cell held items, some spilled ({s} = spilled stacks) |
| `vault.full` | `The vault group is full` / `The vault is full` | info | Use with a held stack, nothing fits |
| `vault.hot` | `It is too hot to store - let it cool first` | info | Use with a hot item |
| goggles | section 4.8 table | line | crosshair |

Toast ids are for the spec only; the code emits plain text through `this.host.bus.emit('toast', { text, kind })` as the module
already does. Plurals: `{s} stack` when 1 (`"its 1 stack moved"`), as the arm toast does with `target${... === 1 ? '' : 's'}`.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Phone layout

No new screen, button or HUD element. Everything is in-world (SYSTEMS 1.3 "In-world reading first"):
- the crosshair line (4.8) fits 60 characters by construction (`most ...` is dropped rather than overflowing);
- all actions are Use / Mine with a held item or empty hand; no drag, no long-press;
- toasts are the existing toast component, short (longest new string: `"Vault groups hold at most 27 vaults - this one stands alone"`,
  59 characters) so they fit one line at 390 px portrait.

### 6.2 Visual feedback

- **Seams.** No new mesh in this unit. Touching vaults keep their per-block faces. (A seamless multi-block texture would need
  connected-texture logic in the mesher; out of scope, 13.)
- **Belt waiting.** A waiting item sits still on the belt end, centred (the centring code keeps running). That is the visible
  "holding" state; it reads like an item queued at a depot.
- **Hand-off.** At the glide end the item appears at the entry of the next belt and rides on; with Unit 13 the platform has just
  stopped moving, so the eye sees "arrive, then pass across", never a jump in mid-glide (T9 rule 4).

### 6.3 Sounds (T9) - existing names only

| event | sound | volume tier | note |
|---|---|---|---|
| vaults join | `dig_metal`, `pitch: 0.6` | small 0.6 | a low lock-in clunk, once, at the placed cell |
| vault removed with pour | `dig_metal`, `pitch: 0.8` | small 0.6 | once at the broken cell (the break sound already plays) |
| spill | none extra (ground items make their own landing) | - | |
| belt hand-off | `step`, `volume: 0.3`, `pitch: 1.4` | whisper 0.3 | at most ONE per `handOffBorders` call (not per item), at the first handed belt; silent when nothing was handed |

No new `SfxName`, so `sfx.test.ts` (`72 + Object.keys(MAGIC_SFX).length`) is untouched and this unit does not collide with
`sfxWorkshop.ts` being created by Units 13/14/16. Rationale: three small events, all well served by existing metal/step patches.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types (TS sketches)

```ts
// src/workshop/logistics.ts
export const VAULT_STACKS = 108;              // exists
export const VAULT_GROUP_MAX = 27;            // NEW
const HUD_LINE_MAX = 60;                      // NEW (local)

/** A derived vault group: never saved. NEW */
export interface VaultGroup {
  /** Member cell keys "x,y,z" in fill order (y, z, x ascending). cells[0] is the anchor. */
  readonly cells: readonly string[];
  /** cells.length * VAULT_STACKS */
  readonly capacity: number;
}

export class Logistics {
  // NEW private state (derived, not saved)
  private vaultGroups: Map<string, VaultGroup> | null = null;   // cell key -> its group; null = stale

  /** NEW: the group of the vault at the cell, or null when the cell is not an item_vault. Read-only for other units. */
  vaultGroupAt(x: number, y: number, z: number): VaultGroup | null;
  /** NEW: stacks used across the group (per-cell ceil counting). */
  vaultUsed(g: VaultGroup): number;
  /** NEW: group totals per kind, count desc then key asc. */
  vaultTotals(g: VaultGroup): { item: string; count: number }[];
  private vaultAccept(g: VaultGroup, item: string, n: number, commit: boolean): number;   // NEW
  private vaultTake(g: VaultGroup, item: string | null, max: number): { item: string; count: number } | null;  // NEW
  private invalidateVaults(): void;                              // NEW: this.vaultGroups = null
}

// pure helper, exported for tests (NEW)
export function cellStacks(items: Record<string, number>): number;   // sum ceil(n / stackLimit(item))
export function fillOrder(a: string, b: string): number;             // compare "x,y,z" keys by y, then z, then x

// src/workshop/workshop.ts
export const BELT_END_ZONE = 0.3;             // NEW (replaces the literal in moveBelts)
type BeltEnd = 'taken' | 'moved' | 'wait' | 'fall';   // NEW
// private beltEnd(e: GroundItem, b: [number, number, number], d: [number, number], why: 'tick' | 'handoff'): BeltEnd;   NEW
// private handOffBorders(cells: readonly string[]): number;   NEW: returns items handed (for tests and the sound)
// private runDir(x: number, y: number, z: number): [number, number] | null;   NEW: belt run direction (still belt = forward)

// src/workshop/contraption.ts
export interface Docks { carried: ReadonlySet<string>; dock: ReadonlySet<string> }   // NEW
// Contraptions.docks(): Docks   NEW, cached; Contraptions.invalidate(): void NEW
```

### 7.2 Save

- **No new saved field.** `LogiSnapshot` is unchanged; `WorkshopSnapshot` is unchanged. Groups, docks and carried sets are derived
  (T10 rule 5). There is nothing to sanitise beyond what `load` already does, plus the clamp fix.
- No `SAVE_VERSION` bump (T10 rule 3).

### 7.3 The load fix ("migration" of old per-cell vault contents)

In `Logistics.load`, replace the single clamp

```ts
for (const [i, n] of Object.entries(items ?? {})) if (itemOrNull(i) && typeof n === 'number' && n > 0) c.items[i] = Math.min(CELL_CAP * 4, Math.floor(n));
```

with a per-kind cap:

```ts
const cap = (i: string): number => (kind === 'item_vault' ? VAULT_STACKS * stackLimit(i) : CELL_CAP * 4);
for (const [i, n] of Object.entries(items ?? {})) if (itemOrNull(i) && typeof n === 'number' && Number.isFinite(n) && n > 0) c.items[i] = Math.min(cap(i), Math.floor(n));
```

Old per-cell vault rows need no conversion: model (B) reads them as they are. A test loads a hand-written old snapshot (section
9, `'loads an old per-cell vault row with 500 flint as 500'`).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered)

Each step leaves `npm test` green. Files: `src/workshop/logistics.ts`, `src/workshop/workshop.ts`, `src/workshop/contraption.ts`,
`src/content/itemsWorkshopParts.ts`, `src/content/objectivesWorkshop.ts`, `src/ui/screens/workshop/workshopScreen.ts`, tests,
`scripts/e2e-workshop.mjs`, `docs/api/workshop.md`.

1. **Load clamp fix** (`logistics.ts` `load`): 7.3. Add the test first (it fails today).
2. **Pure helpers** (`logistics.ts`): `cellStacks(items)`, `fillOrder(a, b)`. Refactor the existing `accept` case `'item_vault'` to
   use `cellStacks` (no behaviour change yet).
3. **Group cache** (`logistics.ts`):
   - `invalidateVaults()` called from: `noteBlock` (any change involving an `item_vault`: created, or deleted), `relocate` (always;
     cheap), `load` (end), `verify` (when it deletes an `item_vault`).
   - `vaultGroupAt(x, y, z)`: if the cell is not an `item_vault` cell, null. If `vaultGroups` is null, rebuild: collect all
     `item_vault` cells from `this.cells`, sort by `fillOrder`, BFS as in 4.1 with `VAULT_GROUP_MAX`, map every member key to its
     group object. Return the map entry.
4. **Group primitives**: `vaultUsed`, `vaultTotals`, `vaultAccept` (4.4, with the hot check of 2.3), `vaultTake` (4.5).
5. **Wire the primitives**:
   - `accept` case `'item_vault'`: `return this.vaultAccept(this.vaultGroupAt(x, y, z)!, item, n, commit);`
   - `peek`: when `c.kind === 'item_vault'` return `this.vaultTotals(group)`.
   - `take`: before the generic loop, `if (c.kind === 'item_vault') return this.vaultTake(group, item, max);` with the comment of
     2.2 (3). Unit 16's lock check, when present, sits above (top of `take`).
   - `use` case `'item_vault'`: held hot -> refusal toast; held stack -> `vaultAccept` with commit, refuse with `vault.full` when 0;
     empty hand -> biggest kind via `vaultTotals[0]`, `vaultTake(group, kind, stackLimit(kind))`, spawn as today.
6. **Break pour** (`noteBlock`): when the removed cell's kind is `item_vault` and it holds items, invalidate, run 4.6 (neighbour
   groups, pour, spill rest, toast, sound) BEFORE the generic spill line, and skip the generic spill for vaults. Keep the generic
   spill for every other kind exactly as it is.
7. **Join toast** (`noteBlock` on creation of an `item_vault` cell): invalidate; if `vaultGroupAt(...).cells.length > 1` emit
   `vault.join` + sound; if a neighbour vault exists but the new group has 1 cell, emit `vault.alone`.
   Guard: `Logistics.load` calls `noteBlock` to create cells - suppress toasts while loading (a private `loading` flag set in
   `load`). Contraption steps never reach `noteBlock` (Workshop `holding`).
8. **Describe** (`describe`): early branch for `item_vault` producing 4.8 lines; `HUD_LINE_MAX` rule for `most`.
9. **Structure border** (`contraption.ts` `structure`): 4.10. Needs the belt facing: the BFS already has `host.world`; add a local
   `beltAxis(x, y, z): [number, number] | null` returning `DELTA[voxelFacing(...)]` when the block key is `conveyor_belt`. When
   stepping from cell `a` to neighbour `n` with delta `(dx, 0, dz)`: skip if `a` is a belt and `(dx, dz)` equals `+-axis(a)`, or if
   `n` is a belt and `(dx, dz)` equals `+-axis(n)`. Vertical steps are never on a belt axis.
10. **Docks** (`contraption.ts`): `docks(): Docks` cached in a private field, rebuilt when null: for each act: piston -> `s =
    structure(front)` (skip null), `carried += s` minus the front rod cell? (no - every cell in `s` is carried, rods included);
    `dock += { cell + k*d : k in [-ext .. PISTON_MAX - ext], cell in s }` keeping only cells whose block is air; bearing ->
    `s = structure([x, y+1, z])`, `carried += s`, `dock +=` the 3 other rotations of each cell (same formula as `bearing()`),
    air only. Skiffs add nothing (lanes are found by the rail rule at query time). `invalidate()` sets the cache to null; called
    from `noteBlock` and `relocate` of `Contraptions`, and from Workshop `noteBlock` for ANY movable kind change (a block added to or
    removed from a structure changes it). Cost bound: acts x 48 cells x 5 positions; rebuilt at most once per tick.
11. **beltEnd** (`workshop.ts`): extract rows 1-7 of 4.9 from `moveBelts` into `beltEnd`. `moveBelts` calls it when
    `along + step > BELT_END_ZONE`: `'taken'` -> `continue` (count already reduced; the existing splice removes it), `'wait'` ->
    `continue` (no move along), `'moved'`/`'fall'` -> fall through to `e.x += dx * step` as today. Head-on and dock rules live in
    `beltEnd`. `isDock(f) = this.contra.docks().dock.has(k3(f)) || (air(f) && world.getBlock(f.x, f.y - 1, f.z).key === 'rail')`;
    `isCarried(b) = this.contra.docks().carried.has(k3(b))`.
12. **handOffBorders** (`workshop.ts`): 4.9 Rule H; register in the constructor through `onMoveEnd` (2.4; add the minimal
    `onMoveEnd` if Unit 13 is absent). Emits the one hand-off sound when it handed anything. Removes zero-count ground items at the
    end (same splice loop as `moveBelts`).
13. **Text** (content): update the vault description and goal text (section 11 strings), the Guide rules line.
14. **Tests** (section 9), **e2e** (section 10), **docs** (section 11).

Helpers to reuse, not rewrite: `stackLimit` (`src/game/inventory.ts`), `itemOrNull` / `blockOrNull`, `k3` / `parse` (local in each
module), `FACE_VEC` (workshop.ts), `DELTA` (contraption.ts), `voxelFacing`, `this.space` / `this.intake` / `this.recipeFor`
(workshop.ts), `ground.spawn` (splits stacks).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

All use `setup()` from `src/workshop/parts.test.ts` unless noted (`t.put`, `t.shop`, `t.ground`, `t.run`, `t.toasts`). Stack limits: `stackLimit` defaults to 99 (`src/core/registry.ts`: `stack: spec.stack ?? (spec.tool ? 1 : 99)`); flint,
rubble and plank use the default, so the numbers below use `L = 99`. Write the tests with `const L = stackLimit('rubble')` etc.,
not literals, so a later stack change does not break them. A tiny
local helper in the new test file: `const all = (t, item) => sum of group totals via t.shop.logi.peek(...) + ground items of that
kind` for conservation checks.

### 9.1 New file `src/workshop/vaults.test.ts`

Pure:
1. `it('counts stacks per cell with ceil per kind')`: `cellStacks({ flint: 100, plank: 99 })` = 3 (flint 2 stacks, plank 1).
2. `it('orders cells bottom first, then north to south, then west to east')`: sort of `['1,0,0', '0,1,0', '0,0,1', '0,0,0']` by
   `fillOrder` = `['0,0,0', '1,0,0', '0,0,1', '0,1,0']`.

Groups:
3. `it('four touching vaults are one group of 432 stacks')`: put a 2 x 2 at `(0..1, 0, 0..1)`; `vaultGroupAt(1, 0, 1).cells.length`
   = 4, `capacity` = 432; `vaultGroupAt(0,0,0) === vaultGroupAt(1,0,1)` (same object).
4. `it('edges and corners do not join')`: vaults at `(0,0,0)` and `(1,0,1)`: two groups of 1.
5. `it('a group stops at 27 vaults and the 28th stands alone with a toast')`: a 3 x 3 x 3 cube then one more touching it:
   cube group 27 / capacity 2916; the extra cell's group has 1 cell; `t.toasts` contains
   `'Vault groups hold at most 27 vaults - this one stands alone'`.
6. `it('joining vaults says the new size')`: put `(0,0,0)` then `(1,0,0)`: toasts contain `'Vaults joined - group of 2, 216 stacks'`;
   the first placement produced no join toast.

Store:
7. `it('offer to any cell fills the bottom cell first and counts the whole group')`: tower `(0,0,0)`, `(0,1,0)`; `offer(0, 1, 0,
   'rubble', 110 * L)` returns 10890; `peek(0, 0, 0)` = `[{ item: 'rubble', count: 10890 }]`; the bottom cell holds 10692,
   the top 198 (read `t.shop.logi.cells.get('0,0,0').items`).
8. `it('a group of 4 takes exactly 432 stacks and no more')`: 2 x 2; `offer(..., 'flint', 432 * L + 10)` returns `432 * L` (42768); a
   further `offer(..., 'plank', 1)` returns 0; describe contains `'full, 432/432 stacks'`.
9. `it('tops up a partial stack before opening a new one')`: lone vault: `offer('flint', 10)` = 10, then
   `offer('rubble', 107 * L)` = 10593 (the 107 free stacks), then `offer('flint', 89)` = 89 (top-up of the partial stack),
   then `offer('flint', 1)` = 0 and `offer('plank', 1)` = 0.
10. `it('take pulls from the top cell first and peek sorts by count')`: tower `(0,0,0)`, `(0,1,0)`; set bottom cell items
    `{ flint: 99 }` and top cell `{ flint: 10, plank: 5 }` directly on `t.shop.logi.cells`; `take(0, 0, 0, 'flint', 12)`
    = `{ flint, 12 }`; top cell flint now 0 (deleted), bottom 97; `peek` = `[{flint, 97}, {plank, 5}]`.
11. `it('empty-hand Use on any cell gives one stack of the biggest kind in the group')`: 2 cells: bottom `{ flint: 200 }`, top
    `{ plank: 300 }`; `use(0, 0, 0, null, ...)` spawns a ground item `plank` x99 above `(0, 0, 0)` (y about 1.1); group plank 201.
12. `it('refuses hot items with a sentence')` (skip with `it.skipIf(!isHotAvailable)` only if Unit 4's key `ladle_copper` is not
    registered; otherwise run): `offer(0,0,0,'ladle_copper',1)` = 0; Use with held `ladle_copper` returns `'refused'` and toasts
    `'It is too hot to store - let it cool first'`.
13. `it('a belt into one cell and a funnel out of another use the same store')`: row of 2 vaults `(1,0,0)`, `(2,0,0)`; crank +
    belt at `(0,0,0)` running east into `(1,0,0)`; funnel at `(3,0,0)` facing east pulling from `(2,0,0)` into a depot `(4,0,0)`;
    spawn 3 flint on the belt; `t.run(10, [[crank]])`; depot holds 3 flint.

Split and conservation:
14. `it('breaking the middle of a row pours its load west, then east, and keeps every item')`: row `(0..2,0,0)`, cells set to
    west `{flint: 64}`, mid `{plank: 640}`, east `{}`; break mid (`t.world.setVoxel(1, 0, 0, 0)`); groups at 0 and 2 are 1 cell
    each; west holds flint 64 + plank 640; no plank on the ground; toasts contain `'Vault removed - its 7 stacks moved into the group'` (640 / 99 rounded up).
15. `it('a full group spills only what it cannot take, and says how much')`: row of 2, both cells full of rubble (108 stacks each);
    break the east cell: ground rubble total = 10692, west unchanged 10692; toast `'Vault removed - the group is full, 108 stacks spilled'`.
16. `it('items are conserved under random place / break / offer / take')` (fuzz, seeded `() => 0.5` style LCG, 200 ops on a
    3 x 3 x 1 area): track an expected total per kind (offers add accepted counts, takes subtract returned counts); after each op
    `sum(vault totals) + sum(ground items)` equals expected. Ground items are never evicted in this test (stay under 256: limit
    op counts accordingly).

Save:
17. `it('loads an old per-cell vault row with 500 flint as 500')`: `t.shop.load({ v: 1, parts: [], machines: [], logi: { cells:
    [[0, 0, 0, 'item_vault', { flint: 500 }, null, null, null, []]] } })` after placing the block; `peek(0,0,0)` flint 500 (fails
    before step 1 of section 8: 64).
18. `it('save and load keep a group and its contents; groups are not in the snapshot')`: 2 x 2 with 300 flint; `toJSON()` ->
    `JSON.stringify` has no `group` key; load into a fresh `setup()` with the same blocks: describe contains `'group of 4'`
    and peek flint 300.
19. `it('an over-full cell from a hand-edited save loads whole and takes nothing in')`: row `[0,0,0,'item_vault',{ rubble:
    10692, flint: 640 },...]` (115 stacks): flint 640 kept; `offer(0,0,0,'flint',1)` = 0; describe contains `'115/108 stacks'`.

Describe:
20. `it('the vault line follows the HUD grammar and fits 60 characters')`: lone empty `'Item Vault - empty, 108 stacks'`; lone
    with 640 flint `'Item Vault - 7/108 stacks, most 640 Flint'`; group of 4 with 312 stacks of rubble
    `'Item Vault - group of 4, 312/432 stacks, most 30888 Rubble'` (58 characters); a group of 27 with 2915 stacks of rubble
    exactly `'Item Vault - group of 27, 2915/2916 stacks'` (`, most 288585 Rubble` would make 62, so it is dropped); assert
    `line.length <= 60` for every case.

### 9.2 Additions to `src/workshop/contraption.test.ts`

21. `it('a vault group rides a piston whole, keeps its contents and does not spill')`: crank, piston east at `(1,0,0)`, frame
    `(2,0,0)`, vaults `(3,0,0)`, `(3,1,0)` with 100 flint; `t.run(1, [[0,0,0]])`: vaults at `(4,0,0)`, `(4,1,0)`, group of 2, flint
    100, no flint on the ground, no `Vault removed` toast.
22. `it('a static belt pointing at a platform is not dragged along')`: crank `(0,0,0)`, piston east `(1,0,0)`, frame `(2,0,0)`,
    carried belt on the frame `(2,1,0)` facing West (runs east), static belt `(3,1,0)` facing West (runs east, its back touches the
    carried belt's front). `t.run(1, [[0,0,0]])`: the push is refused (`t.toasts` contains `'Something blocks the piston'`) because
    the carried belt's destination `(3,1,0)` is the static belt, which stayed out of the structure; both belts unmoved. (Today the
    static belt is swallowed and the whole line moves to x+1.)
23. `it('a belt lying on a frame still turns with the platform')`: the existing turning-platform test stays green (no edit) -
    listed here so the builder runs it after step 9.
24. `it('a shuttle belt holds its item at the edge and hands it to the depot after the push')`: crank `(0,0,0)`, piston east
    `(1,0,0)`, frame `(2,0,0)`, belt `(2,1,0)` facing West (forward run = east; it touches no crank, so it is still), depot at `(4,1,0)` standing on a stone pillar `(4,0,0)` (terrain, not movable). Spawn 1
    flint at the end zone of the belt `(2.85, 1.6, 0.5)`. `t.run(0.85, [[0,0,0]])` (one push; with Unit 13 also run past
    `PISTON_MOVE_S`): belt at `(3,1,0)`, its front `(4,1,0)` is the depot: depot peek flint 1, no flint on the ground.
25. `it('a carried belt end facing air keeps its items instead of dropping them')`: same as 24 without the depot, belt cranked
    (separate crank network touching the belt? simpler: a crank on the platform at `(2,1,1)` beside the belt, cranked): after 3 s
    the flint is still on the belt cell (`Math.floor(item.x) === belt x`, `item.y > 1.3`).
26. `it('a static belt facing a piston path waits for the platform')`: piston at rest; static cranked belt whose front is a dock
    cell: item stays at its end for 3 s; then the push brings a depot (carried, on the platform) in front: the item goes into it.
27. `it('a belt facing a rail lane waits and loads the skiff when it stops there')`: rail line `(0..4, -1 is stone, rails at y=0)`,
    skiff riding at y=1; static cranked belt at `(2,1,1)` running north into `(2,1,0)` (lane cell): item waits; when the skiff's
    step ends at the lane cell `(2,1,0)` - put the rail END there so the skiff dwells 2 s (`SKIFF_DWELL_S`) - the skiff's
    `peek` has the flint and the belt is empty.

### 9.3 Additions to `src/workshop/workshop.test.ts`

28. `it('a belt end facing open air still drops items off the end')`: plain belt line with nothing around: item falls off (y below
    the belt top after 3 s) - guards Rule W against over-reach.
29. `it('two belts head-on hold their items at the seam')`: belts `(0,0,0)` running east and `(1,0,0)` running west, both cranked;
    after 4 s the item spawned on the first stays in cell 0 near the east edge (`x` between 0.75 and 1.0) and has not
    oscillated into cell 1 (sample x every tick: never >= 1).
30. `it('hand-off on a loop never hands one item twice in a pass')`: call the private hand-off via `(t.shop as any).handOffBorders`
    with a synthetic `cells` list on a 2-belt loop; returned count = number of items, not more.

Existing tests that must stay green: `parts.test.ts` vault test (offer 500 flint = 500; a million planks less than a million),
all of `contraption.test.ts`, `logistics.test.ts`, `workshop.test.ts`.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E steps (`scripts/e2e-workshop.mjs`)

Append three named steps after the existing contraption steps, in a fresh cleared patch so they do not depend on earlier layout.
Set-up through `window.__hw` (`setVoxel`, `give`, `teleport`, `lookAt`, `app.game.workshop`), actions with real input (`d.use`,
`d.holdMine`), assertions by reading state, one screenshot per step into `test-results/e2e-workshop/`. Run:
`node scripts/e2e-workshop.mjs --device=desktop` (no `HW_GPU`). The goggles line is UI, so also run
`--device=phonePortrait` once and check the crosshair text is fully visible (the screenshot).

**Step A: `'four touching vaults read as one group of 432 stacks'`**
1. `d.hw`: clear a 6 x 6 patch at `(x1, gy, z1)` as the existing yard step does (`hw.setVoxel(..., 'stone')` floor, air above);
   place three vaults with `hw.setVoxel` at `(x1, gy, z1)`, `(x1+1, gy, z1)`, `(x1, gy, z1+1)`; `hw.give('item_vault', 1)`,
   `hw.give('engineer_goggles', 1)`; teleport south-east, look at the floor cell `(x1+1, gy-1, z1+1)` top.
2. Real input: `d.selectItem('item_vault')`, `d.approach({ x: x1+1, y: gy-1, z: z1+1 })`, `d.use()` - the fourth vault is placed
   by the player.
3. Assert: `window.__hw.getBlock(x1+1, gy, z1+1).block === 'item_vault'`; a toast with `'Vaults joined - group of 4, 432 stacks'`
   appeared (read the toast layer text, as other steps read `document.body.innerText`).
4. `d.hw`: `workshop.offer(x1, gy, z1, 'rubble', 312 * 99)`; then real input: `d.selectItem('engineer_goggles')`,
   `d.approach` the vault `(x1+1, gy, z1+1)`; read `.hw-target-name` text: contains `'Item Vault - group of 4, 312/432 stacks'`.
5. `d.shot('vault-group')`.

**Step B: `'mining a vault out of a group loses nothing'`**
1. `d.hw`: `workshop.offer(x1, gy, z1, 'flint', 640)` on top of step A's rubble; record `before = group totals` (via `peek`).
2. Real input: `d.selectEmptyHand()` (or a pickaxe given with `hw.give` and `d.selectItem`), `d.approach` the cell
   `(x1, gy, z1+1)` - third in fill order, so it holds 96 stacks of rubble plus the 7 of flint - and `d.holdMine(async () =>
   (await d.hw((p) => window.__hw.getBlock(p.x, p.y, p.z).block, cell)) !== 'item_vault')`.
3. Assert: the rest `(x1, z1)`, `(x1+1, z1)`, `(x1+1, z1+1)` is still one group of 3 (connected through `(x1+1, z1)`, capacity
   324, 216 used before the pour, room 108 >= 103); `peek(x1, gy, z1)` totals per kind equal `before`; no flint or rubble
   ground items within 2 blocks of the cell; a toast reads `'Vault removed - its 103 stacks moved into the group'`.
4. `d.shot('vault-split')`.

**Step C: `'a piston shuttle hands its waiting flint into a depot after the push'`**
1. `d.hw`: in the same patch, build crank `(x1, gy, z1+4)`, piston facing east `(x1+1, gy, z1+4)`, frame `(x1+2, gy, z1+4)`,
   still belt on the frame `(x1+2, gy+1, z1+4)` facing west (runs east), stone pillar `(x1+4, gy, z1+4)` with a depot on it
   `(x1+4, gy+1, z1+4)`; spawn 1 flint at `(x1+2.85, gy+1.6, z1+4.5)` with `{ scatter: false }`.
2. Real input: `d.selectEmptyHand()`, `d.approach` the crank, `d.use()` once, `d.settle(1200)` (one push of 0.8 s plus the glide).
3. Assert: `workshop.logi.peek(x1+4, gy+1, z1+4)` has flint 1 and no flint lies on the ground. (The crank turns for
   `CRANK_S` 2.5 s, so the piston tries a second push - refused, the depot is in the way - and later pulls back; neither changes
   the depot, so assert only the depot.)
4. `d.shot('belt-handoff')`.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs and text to update

- `docs/api/workshop.md`, "Third slice" bullet **Item vault**: replace "108 stacks, empty-hand Use gives the biggest stack" with
  "108 stacks per cell; face-touching vaults form one group (up to 27 cells, 4 cells = 432 stacks) that every belt, funnel, arm and
  `offer/take` treats as one store (bottom cell fills first, takes from the top). Breaking a cell pours its load into the vaults it
  touched; only what does not fit spills. Goggles: 'Item Vault - group of 4, 312/432 stacks'. Groups are derived, never saved."
- Same file, **Contraptions** bullet: add "Belt ends are borders: a structure never grows through the end of a belt. A carried
  belt, or a static belt facing a contraption's path or a rail lane, holds items at its end; when a move ends, every belt end
  facing a partner across the border hands its waiting items over (belt, depot, vault, machine, skiff), even if the belt is
  still. Two belts head-on hold their items." And under Logistics: belts at their end "wait" instead of oscillating head-on.
- Same file "Tests and checks": add `src/workshop/vaults.test.ts`.
- `src/content/itemsWorkshopParts.ts` `item_vault.desc` (T8 item-description voice, names the use and the number):
  `'Holds 108 stacks. Vaults that touch share one store: four hold 432. Funnels, arms and belts fill and empty any of them. Use with
  an item to store, empty-handed to take the biggest stack.'`
- `src/content/objectivesWorkshop.ts` goal `place_item_vault` text: `'A Vault holds 108 stacks, and vaults that touch share them.
  Fill it with a funnel or an arm and take the biggest stack with an empty hand.'` (title unchanged; no new goal - SYSTEMS T7 side
  goals are not required for this unit, and the main track must not grow).
- `src/ui/screens/workshop/workshopScreen.ts` Rules text (line 43 area): append the sentence `'Vaults that touch are one store.
  Belts join a moving structure by their sides and undersides, never by their ends, and hand items across when it stops.'`
- Do NOT edit `docs/WHATS_LEFT.md` (coordinator) or `docs/build/SYSTEMS.md`. `docs/OVERHAUL_PLAN.md` status lines ("item vault
  multiblock growth", "belts that cross structure borders automatically") are left for the coordinator to tick.

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] Face-touching `item_vault` cells form one group; edges/corners do not join; at most 27 cells; deterministic by fill order.
- [ ] Capacity = cells x 108; a group of 4 accepts exactly 432 stacks (test 8).
- [ ] `offer`, `take`, `logi.peek`, belts, funnels, chutes, arms, ground intake and player Use on ANY cell act on the group.
- [ ] Bottom cell fills first; takes come from the top cell; partial stacks are topped up before new ones.
- [ ] Breaking a cell pours into touching groups first; only overflow spills; conservation fuzz (test 16) passes.
- [ ] Hot items (`cools`) are refused by vault groups (Unit 4 rule), with the sentence toast on Use.
- [ ] Vault contents survive save/load at full count (the 64 clamp is gone for vaults); old rows load unchanged; nothing about
      groups is saved.
- [ ] Goggles/crosshair line matches 4.8 and is <= 60 characters in every state.
- [ ] Vault groups ride pistons/bearings whole with no spill and no toast.
- [ ] Belt ends are structure borders (4.10); the existing turning-platform test still passes untouched.
- [ ] Carried belts and belts facing a dock cell or a rail lane hold items at the end; plain belts into air still drop them.
- [ ] Head-on belts hold at the seam (no oscillation).
- [ ] After each move END (Unit 13 `onMoveEnd`), waiting items at border belt ends are handed across, even from a still belt; one
      hand-off per item per pass.
- [ ] No new `SfxName`; sounds per 6.3; no sound while idle.
- [ ] All new strings exactly as 5.5; `npm test` green; `node scripts/e2e-workshop.mjs --device=desktop` green with three new
      screenshots; `--device=phonePortrait` shows the full vault line.
- [ ] `docs/api/workshop.md` and the three content strings updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- A vault contents screen / picker (taking a chosen kind). The vault stays "biggest stack" by hand; arms, funnels with filters and
  golems pick kinds. A future screen would list `vaultTotals`.
- Connected textures / one big vault mesh for a group.
- Padlocking vaults (Unit 16 owns locks; contract in 2.2).
- Belt ramps, lifts, belts at different heights, belt hand-off between two moving structures in mid-glide.
- Fluid vaults / tank groups (tanks already stack).
- Durability-carrying items in workshop containers (existing limitation, Unit 4's general fix).
- A new side goal (none is needed; the existing `place_item_vault` goal stays).
- Compaction of partial stacks after merges (4.2: at most one stack per kind per merge, honest and harmless).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **Existing data-loss bug fixed here:** `Logistics.load` clamps every logistic cell's counts to `CELL_CAP * 4` = 64, so any
   vault holding more than 64 of a kind loses the rest on every reload today. Section 7.3. Worth calling out in the merge notes;
   it can be cherry-picked ahead of the rest of the unit if wanted.
2. **T7 row change requested:** "vault growth: forge" -> "follows the `item_vault` recipe (no own gate)" (2.5).
3. **Ground-item cap:** a spill uses `ground.spawn`; `MAX_GROUND_ITEMS` 256 with merge-or-evict-oldest means a spill onto an
   already littered floor can still evict old ground items. Spills happen only when every touching group is full (rare) and are
   at most 108 stacks per broken cell. If the owner wants zero risk, a follow-up could drop overflow into a crate-like ground
   "sack"; not in this build.
4. **Structure rule change (4.10)** alters which blocks a piston/bearing carries: belt end-to-end contacts no longer join a
   structure. Unit 13 (motion) should know; no Unit 13 API changes. Units 2/16 (J5 roof on a piston) are unaffected unless their
   roof is held together by belts end to end (it is held by frames).
5. **Unit 13 dependency is soft:** if 13 has not merged, this unit adds `Workshop.onMoveEnd` with 13's exact signature, fired at
   commit (2.4). Merge order 13 -> 15 is cleaner but not required.
6. **Unit 16/17 contracts:** vault cells are doors to their group; `vaultGroupAt` is read-only and optional for them; "a group is
   locked when any member is locked" if vaults ever get locks.
7. **Unit 4 contract honoured:** vault groups refuse hot items (`isHot`).
8. No new item, recipe, sound name, saved field or screen; content tests and the progression solver are untouched.
