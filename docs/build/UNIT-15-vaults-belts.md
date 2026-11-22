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
  27 x 108 = 2916 stacks = 186 624 cobblestone - more than any base needs.
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
| group, some | `Item Vault - group of 4, 312/432 stacks, most 2048 Cobblestone` |
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
