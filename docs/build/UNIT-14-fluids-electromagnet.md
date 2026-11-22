# Unit 14 - Continuous fluids and the electromagnet

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Where this file and SYSTEMS.md disagree,
SYSTEMS.md wins unless this file argues the change in a sentence and lists it in section 14 for the coordinator.
Ids marked **NEW** do not exist in the code today; every other name was grepped in the tree at commit `2b24bdc`.

**Threads:** T3 (implements `fluidBlock.draw/fill`, `SPOUT_LPS` 250 L/s spouts and drains, litres conserved, containers as
tables: `FluidSpec.bucket` + `CHEM_CONTAINERS`), T1 (the electromagnet is the first held tool running on STORED electricity;
its charge is drawn, joule for joule, from a network's batteries through the NEW sim hook `drawJoules`), T4 (one new item,
`electromagnet`, an end product with a producer and a use), T8 (crosshair lines of spout / drain, charge card row, toasts),
T9 (`spout_pour`, `magnet_hum` in `sfxWorkshop.ts`, a pour-stream particle capped at 24), T10 (no new save fields: the
spout/drain buffers ride in the existing `LogiSnapshot` row; the magnet's charge is `durability`).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Two small things that make the Forge and Current ages feel *plumbed* and *electric*.

**The pour.** Today a spout under a tank fills a whole bucket in one clunk every second, and a drain swallows a bucket in one
gulp. After this unit a spout fed from a tank (which a pipe keeps topped up) *pours*: a thin stream of the fluid's colour
falls from the spout's nozzle into the empty can waiting below, a soft gurgle plays, and the crosshair reads
`"Spout - pouring Lubricant, 750/1000 L into the Empty Canister"`. A canister takes 4 s, a beaker 1 s, a basin fills from
empty in 4 s. On a belt line the spout *catches* one empty can off the belt, fills it, and sets the full one back down to
ride on - the J1 picture: a Chemistry Port pipes lubricant into a tank, and a row of empty canisters on a belt comes out the
other end full, without the player touching a thing. A drain over a tank does the reverse at the same rate: buckets and
canisters dropped on it glug out over 4 s and the empties walk out of its front.

**The magnet.** Out at a mined vein in the Current age, ore and ingots lie scattered after a drill or a blast. The player
holds the Electromagnet, presses Use, and for 3 s a low hum rises while every piece of metal within 12 blocks - copper ore,
iron plate, a dropped steel pickaxe, scrap metal - lifts and streams in at 14 blocks/s. Stones, logs and wheat stay where they
lie: it is a *magnet*, not a vacuum. It carries 120 kJ (100 bursts) as its own charge; back at the base, Use on an Acid
Battery (or a Lithium Bank) tops it up from that network's stored joules. A furnace-age player who built batteries for the
night now has a second reason to keep them full.

Both are optional conveniences: nothing on the tech spine needs them (T7), and the bucket-by-bucket paths stay as the
fallback when no tank stands above the spout.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 What this unit defines (SYSTEMS 6.2 row "14")

| id / API | kind | file | notes |
|---|---|---|---|
| `fluidBlock.draw?(x, y, z, fluid, L): number` | implementation (Unit 0 declares the type) | `src/app/game.ts` | drains up to `L` litres of `fluid` from the fluid endpoint at the cell; returns litres moved |
| `fluidBlock.fill?(x, y, z, fluid, L): number` | implementation (Unit 0 declares) | `src/app/game.ts` | pours up to `L` litres into the endpoint; returns litres moved |
| `fluidBlock.offer?(x, y, z): { fluid: string; litres: number } \| null` | **NEW optional member** | type: `src/workshop/workshop.ts` + `LogiHost` in `logistics.ts`; impl: `game.ts` | what the endpoint would give (a copy). Needed: `draw` must name a fluid, and the spout must know which one the tank holds |
| `fluidBlock.room?(x, y, z, fluid): number` | **NEW optional member** | same | litres of `fluid` it would take now (0 = refuses: full, or holds another fluid). Needed so a drain refuses a bucket it could never empty instead of swallowing it |
| `SPOUT_LPS = 250` | **NEW** constant | `src/workshop/logistics.ts` | SYSTEMS 5.2 |
| `POUR_BUFFER_L = 1000` | **NEW** constant | `logistics.ts` | most litres a spout or drain holds in its throat (one bucket/canister) |
| `SPOUT_RETURN_S = 2` | **NEW** constant | `logistics.ts` | a spout with litres in its throat and nothing to fill pours them back up after this long |
| continuous spout + drain behaviour | behaviour | `logistics.ts` (`spout`, `spoutFromTank`, `accept` case `item_drain`, NEW `drainPour`) | section 5 |
| `PourView` + `WorkshopView.pours?` | **NEW optional member** of `WorkshopView` | `workshop.ts`; rendered in `src/render/workshop/` | `{ x, y, z, colour, toY }` per pouring spout/drain, for the stream particles |
| `electromagnet` | **NEW** item | `src/content/itemsGround.ts` (`GROUND_ITEMS`) | section 4.2 |
| `ItemSpec.charge?: { capacityJ: number }` | **NEW optional member** | `src/core/types.ts` | stored-electricity tools; `fullDurability` reads it |
| `ELECTROMAGNET_J = 120_000` | **NEW** constant | `src/content/itemsGround.ts` | SYSTEMS 5.2 "charge 120 kJ" |
| `COLLECTORS.electromagnet` | **NEW** row | `src/game/collectors.ts` | radius 12, pull 14, burst 3 s, `{ kind: 'charge', watts: 400 }`, `accepts: isMetalItem` |
| `PowerSource` member `{ kind: 'charge'; watts: number }` | **NEW** union member | `collectors.ts` | drains the held stack's `durability` (joules) and never breaks it |
| `CollectorDef.accepts?` / `ActiveCollector.accepts?` | **NEW optional members** | `collectors.ts`, `src/game/groundItems.ts` | `(item: string) => boolean`; the item filter (ground-items.md already names this exact shape) |
| `isMetalItem(key)` + `METAL_WORDS` | **NEW** | `src/content/itemsGround.ts` | section 4.3 |
| `Collectors.recharge(hit)` + `Collectors.drawJoules` hook | **NEW** | `collectors.ts`; Game wires the hook | Use on a storage block with a charge tool |
| `Simulation.drawJoules(x, y, z, J): number` | **NEW** sim hook (SYSTEMS 5.2 names it) | `src/sim/simulation.ts` (+ helper in `src/sim/power.ts`) | takes up to `J` from the storage of the network that the storage block at the cell belongs to |
| `spout_pour`, `magnet_hum` | **NEW** `SfxName`s | `src/core/gameEvents.ts`, `src/audio/sfxWorkshop.ts` | T9 |

### 2.2 The exact host-hook signature (Unit 0 + this unit's two optional members)

Unit 0 changes the type at `src/workshop/workshop.ts:119` (and the `LogiHost.fluidBlock()` return type at
`src/workshop/logistics.ts:59`, which must stay identical) to:

```ts
/** Fluid blocks of the pipe network for spouts and drains; set by Game. Litres in, litres out: every method returns what it really moved. */
export interface FluidBlockHook {
  is(x: number, y: number, z: number): boolean;
  use(x: number, y: number, z: number, item: string): string | null;
  draw?(x: number, y: number, z: number, fluid: string, L: number): number;   // Unit 0 declares, Unit 14 implements
  fill?(x: number, y: number, z: number, fluid: string, L: number): number;   // Unit 0 declares, Unit 14 implements
  offer?(x: number, y: number, z: number): { fluid: string; litres: number } | null; // NEW (Unit 14): optional, a copy
  room?(x: number, y: number, z: number, fluid: string): number;              // NEW (Unit 14): optional
}
fluidBlock: FluidBlockHook | null = null;
```

If Unit 0 wrote the type inline (as SYSTEMS 6.5 shows), Unit 14 extracts it into the exported `FluidBlockHook` interface
(**NEW** name, same shape) and uses it in both places, so the two declarations can never drift. The two new members are
OPTIONAL (SYSTEMS 6.5: "if one needs more, it adds an OPTIONAL member and says so"). They mirror `FluidEndpoint.offer/room`
in `src/sim/endpoints.ts:41`, so the Game implementation is one line each.

**Fallback rule (normative).** Logistics checks `fb.draw && fb.fill && fb.offer && fb.room`; if any is missing (a test host,
an older Game), the spout and drain run the **existing** bucket-by-bucket code (`fb.use`) unchanged. That is also how the
existing tests in `logistics.test.ts` that build a host with only `is/use` keep passing.

### 2.3 Game implementation (exact)

`src/app/game.ts`, inside the existing `this.workshop.fluidBlock = { ... }` block (line ~169). `Face` 2 is what the existing
`use` passes; tank stacks and chem ports ignore the face.

```ts
const ep = (x: number, y: number, z: number) => this.state.sim.fluidEndpoint(x, y, z, 2 as Face);
this.workshop.fluidBlock = {
  is: (x, y, z) => isFluidEndpoint(world.getBlock(x, y, z)),
  use: (x, y, z, item) => { const r = this.state.sim.bucketUse(x, y, z, 2 as Face, item); return r.ok ? r.held : null; },
  draw: (x, y, z, fluid, L) => ep(x, y, z)?.drain(fluid as FluidKey, L) ?? 0,
  fill: (x, y, z, fluid, L) => (fluidOrNull(fluid) ? ep(x, y, z)?.fill(fluid as FluidKey, L) ?? 0 : 0),
  offer: (x, y, z) => { const o = ep(x, y, z)?.offer(); return o && o.litres > 0 ? { fluid: o.fluid, litres: o.litres } : null; },
  room: (x, y, z, fluid) => (fluidOrNull(fluid) ? ep(x, y, z)?.room(fluid as FluidKey) ?? 0 : 0),
};
```

`Simulation.fluidEndpoint(x, y, z, face)` (simulation.ts:644) already returns chem ports (Unit 7's receiver outlets), tank
stacks (`tankStackEndpoint`, so a spout under ANY tank of a stack drains the whole stack top-down) and machine fluid buffers.
Litres are conserved because every move goes through `FluidEndpoint.drain/fill` (T3 rule 1). What a tank accepts is Unit 7's
`tankFluids()` through `ep.room` - this unit never lists fluids (anti-pattern 6d).

### 2.4 What this unit consumes

| from | what | how used |
|---|---|---|
| Unit 0 | `fluidBlock.draw?/fill?` type | implemented here |
| Unit 7 | `tankFluids()` accept list; `CHEM_CONTAINERS` fallback in `bucketUse` (beakers on tanks) | `ep.room` answers per fluid; the spout's container table (4.1) reads `CHEM_CONTAINERS` + `FluidSpec.bucket`, the same tables Unit 7 uses, so a beaker that `bucketUse` can fill by hand the spout can fill too |
| Unit 4 | `isHot(item)` (`src/game/inventory.ts`, NEW there) | spouts and drains never catch a hot item (the existing rule: hot things live only in the pack and on the ground) |
| Unit 8 | `Workshop.use(..., give?)` optional parameter | not needed: neither spout nor drain gains a player Use action (section 5.7); if Unit 8 merged first, the spout/drain cases simply ignore `give` |
| Unit 13 | `Workshop.relocate` moves cells | the spout's caught container and throat litres live on the `Cell` (`items`, `fluid`) so they move with it for free |
| Unit 15/16 | `padlock_chest`, vault groups | not touched |

No other unit consumes this unit's ids (SYSTEMS 6.2: consumers "-").

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

### 3.1 Spouts and drains (`src/workshop/logistics.ts`)

- Geometry (important, and different from OVERHAUL_PLAN's prose): a **spout** sits UNDER its source: the source is the
  cell above (`y + 1`: a `basin` cell or a fluid endpoint), the container waits in the cell below (`y - 1`: a `depot`, or a
  ground item - typically on a belt - whose cell is the spout's column and whose `y` is within `c.y - 1.6 .. c.y`).
  An **item drain** sits OVER its target: items enter it from the top (ground items resting on it via `intakeGround`, funnels,
  belts, arms through `accept`), the target is the cell below (`y - 1`: a `basin` or a fluid endpoint), and the empties leave
  from its front via `mover` (`item_drain` is in the `mover` case of `tick`).
- `Logistics.spout(c, dt)` (line 568): if the cell above is not a basin but `fb.is(...)`, it calls `spoutFromTank`. Otherwise,
  basin path: needs `basin.fluid.litres >= 1000` and an empty `f.bucket.empty` on the depot below or on the ground; after
  `SPOUT_S` (1 s) it moves 1000 L and swaps the empty for `f.bucket.full`; sfx `splash` volume 0.4.
- `Logistics.spoutFromTank(c, dt, fb)` (line 605): collects holders (depot items, ground items under it), keeps those in
  `FLUIDS_EMPTY = new Set(['pail', 'bronze_bucket', 'empty_canister'])` (a hard-coded list; beakers are missing), and every
  `SPOUT_S` asks `fb.use(c.x, c.y + 1, c.z, h.item)` = `sim.bucketUse`, i.e. **1000 L in one step**.
- `accept(...)` case `'item_drain'` (line 173): over a fluid endpoint (not a basin), a full bucket item is poured at once with
  `fb.use` and the empty lands in `c.items`; over a basin, the bucket's fluid is added (`BASIN_LITRES` 1000 cap) and
  `f.bucket.empty` lands in `c.items`. Uses `fluidInBucket(item)`, so beakers (no `FluidSpec.bucket`) are refused today.
- `Cell` has `fluid: { key, litres } | null` and `items` - both **unused by spouts and drains** today and both **already
  saved** in `LogiSnapshot.cells` rows (index 4 items, index 5 fluid). `load` clamps fluid to `BASIN_LITRES` (1000) and
  items to `CELL_CAP * 4`. That is exactly the room this unit needs: no save format change.
- `noteBlock` spills a removed cell's `items` as ground items (fluid in it is lost - the same rule as a broken tank,
  tanks.ts header: "breaking a tank loses what it held").
- `describe(x, y, z)` builds `"<Name> - <bits>"` or `"<Name> - empty"`; a cell with `fluid` already prints
  `"<n> L <Fluid>"`.
- Item text today (`src/content/itemsWorkshopParts.ts:29-30`): Spout `"Under a basin: fills an empty bucket on the depot or
  belt beneath it from the basin, 1000 L at a time."`; Item Drain `"Empties full buckets dropped on it into the basin below,
  and passes the empty ones out of its front."` Recipes (`recipesWorkshop.ts:36-37`): `spout` 1 bronze_ingot + 1 stick @600,
  `item_drain` 2 bronze_ingot + 1 stone_brick @600 (unchanged by this unit).
- Signals: `tick` skips `POWERED` kinds whose `host.gate` is false; spouts and drains are not powered and ignore signals.

### 3.2 The Game wiring

`src/app/game.ts:169-175` sets `workshop.fluidBlock = { is: isFluidEndpoint(...), use: sim.bucketUse(x, y, z, 2 as Face,
item) }`. `Simulation.fluidEndpoint` (simulation.ts:644) and `FluidEndpoint { room, fill, offer, drain }` (endpoints.ts:41)
exist; `tankStackEndpoint` (tanks.ts:83) is what a tank answers. `LITRES_PER_BUCKET` = 1000 (`src/core/constants.ts:210`).
`CHEM_CONTAINERS` (distill.ts:111) maps full containers to `{ fluid, litres, empty }`; `filledWith(emptyKey, fluid)`
(distill.ts:128), `bucketFilledWith(emptyKey, fluid)` and `fluidInBucket(item)` (registry.ts) do the lookups.

### 3.3 Collectors (`src/game/collectors.ts`)

- `CollectorDef { item, radius, pull, burstS, power: PowerSource, sound?, soundEveryS? }`, `COLLECTORS` has only
  `hand_vacuum` (radius 9, pull 11, burst 2.5 s, `{ kind: 'wear', perS: 1 }`, `steam_hiss` every 0.55 s). The electromagnet is
  a comment: `// electromagnet (Current Age, future): { item: 'electromagnet', radius: 12, pull: 14, burstS: 3, power: { kind:
  'electric', watts: 400, supply: ... } }`.
- `PowerSource` = `wear` | `free` | `electric { watts, supply(joules): boolean }`; `drawPower(player, def, dt)` switches on it.
- `Collectors.trigger()` arms for `burstS` (sfx `machine_on` 0.6 / pitch 1.4 on start), `tick(dt)` returns
  `ActiveCollector[]` for `GroundItems.tick`. `label` getter. The controller (`src/player/controller.ts:171`) does
  `if (intent.use && p.collectors.trigger()) intent.use = false;` BEFORE any other use; Survival ticks it
  (`survival.ts:208`).
- `GroundItems.tick` (groundItems.ts:205) pulls every ready item inside a collector's radius regardless of kind and with no
  line-of-sight test (items fly straight to the body). `ActiveCollector { radius, pull }`.
- `PlayerState.wearHeldTool(uses)` deletes the stack at 0 and toasts `"Your <Name> broke"` - wrong for a charge.
- `fullDurability(item)` (inventory.ts:30) = `tool?.durability ?? wear ?? mould?.pours`; `sanitize` clamps a loaded
  durability to `[1, full]`. `itemCard` (src/ui/screens/inventory/slotViews.ts:10) prints `"Suction left"` for `wear`.
- The renderer glows pulled items and draws three cyan rings while `collectors.running` (game.ts:378).

### 3.4 Power storage

`battery` (Acid Battery, forge tier 2, 2 MJ, 3 kW) and `lithium_bank` (tier 4, 40 MJ, 150 kW) are machines of role
`'storage'` (`src/content/tech.ts:214-221`). `Network` (`src/sim/power.ts`) keeps `storage: SimNode[]`, solves charge/discharge
per tick and sums `storedJ`; each storage entity holds `storedJ`, `on`. `Simulation.storedJ()` sums all networks. There is
no way to take joules out of storage from outside the solver today.

### 3.5 Content facts that change the SYSTEMS recipe

`magnet_ring` is `age: 3` (atomic) and forged at the Plasma Furnace (`forge(4, 'magnet_ring', ...)` at 2800 C,
recipes.ts:205). SYSTEMS T4's electromagnet recipe ("forge T3 1400 C: 1 magnet_ring, ...") would therefore make a Current
tool depend on an Atomic part, which `content.test.ts`'s age check rejects and which breaks T7's gating table
("electromagnet: current"). Section 4.2 replaces it with Current-age parts (see 14.1).

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 The continuous spout

**When it is continuous.** A spout pours continuously when (a) the cell above it is a fluid endpoint
(`fb.is(c.x, c.y + 1, c.z)` and it is not a `basin` cell) and (b) the host hook has all four of `draw/fill/offer/room`.
Under a basin, or with a hook missing, the existing bucket-by-bucket code runs unchanged (the fallback SYSTEMS T3 keeps).
"Fed by a pipe" means: the pipe network keeps that tank (or Chemistry Port, or machine buffer) supplied; the spout itself is
not a pipe endpoint (making it one needs a `MachineSpec` with `fluids` and a pipe-join rule - out of scope, 13).

**The throat.** The spout's `Cell.fluid` (`{ key, litres }`, exists, saved) is its *throat*: the litres that have left the tank
and are on their way into the container below, at most `POUR_BUFFER_L` 1000. Litres move tank -> throat -> container, every
step through `fb.draw` / `fb.fill` or a plain number move between two cells, so nothing is created or lost while the block
stands (T3 rule 1). The spout's `Cell.items` holds **at most one caught container** (the can it is filling).

**Targets, checked in this order every tick (first match wins):**

| # | what is below (cell `y - 1`) | what the spout does |
|---|---|---|
| 1 | a `basin` cell | pours straight into `basin.fluid` at `SPOUT_LPS`: `n = min(SPOUT_LPS * dt, BASIN_LITRES - basin litres)`, `got = fb.draw(above, F, n)`, basin += got. Needs basin empty or holding `F`. No throat, no container. |
| 2 | the spout already holds a caught container (`c.items` has one) | keeps filling it (below) |
| 3 | a `depot` cell holding an empty container that can carry the tank's fluid | takes ONE into `c.items` (depot count - 1) |
| 4 | a ground item under the nozzle (`Math.floor(e.x) === c.x`, `Math.floor(e.z) === c.z`, `c.y - 1.6 < e.y < c.y`, `e.delayS <= 0.4`, `!e.homing`, `e.count > 0`) that is an empty container able to carry the tank's fluid | catches ONE (`e.count -= 1`, `c.items[item] = 1`); belts keep moving the rest of that stack |

`F` is the throat's fluid when the throat is not empty, otherwise `fb.offer(above)?.fluid`.

**The container table (no hard-coded list).** NEW private helpers in `logistics.ts`, built only from existing tables:

```ts
/** The full container `empty` becomes with `fluid`, and its litres; null when it cannot carry that fluid. */
function containerFor(empty: string, fluid: string): { full: string; litres: number } | null {
  const b = bucketFilledWith(empty, fluid as FluidKey);           // FluidSpec.bucket: pail, bronze_bucket, empty_canister (1000 L)
  if (b) return { full: b, litres: LITRES_PER_BUCKET };
  const c = filledWith(empty, fluid);                              // CHEM_CONTAINERS: glass_beaker (250 L), empty_canister (1000 L)
  return c ? { full: c, litres: CHEM_CONTAINERS[c].litres } : null;
}
/** An empty fluid container of any table (replaces the hard-coded FLUIDS_EMPTY set). */
const isEmptyContainer = (key: string): boolean => FLUIDS.some((f) => f.bucket?.empty === key) || isEmptyChemContainer(key);
/** A full container: its fluid, litres and the empty it leaves. Buckets first, then CHEM_CONTAINERS. */
function fullContainer(item: string): { fluid: string; litres: number; empty: string } | null { /* fluidInBucket(item) -> 1000 L, f.bucket.empty; else CHEM_CONTAINERS[item] */ }
```

`FLUIDS_EMPTY` is deleted (anti-pattern 6d: a hard-coded list where a registry exists). `glass_vial` is in neither table
(T3 rule 4) so a spout never fills a vial. Hot items are never caught or accepted: both helpers' callers test
`isHot(item)` first (Unit 4's helper; if Unit 4 has not merged, `itemOrNull(item)?.cools !== undefined` inline - the same
test).

**Filling a caught container** (`c.items` = `{ [empty]: 1 }`, `t = containerFor(empty, F)`):

1. `want = t.litres - throat`; if `want > 0` and the source offers `F`: `got = fb.draw(above, F, Math.min(want, SPOUT_LPS * dt))`;
   `throat += got`.
2. When `throat >= t.litres - 1e-6`: `throat -= t.litres` (to 0, rounding cleared), `delete c.items[empty]`, and the full
   container goes out: onto the depot below when target 3 caught it (`depot.items[t.full] += 1`, the existing write the
   bucket path already does), otherwise `ground.spawn(t.full, 1, c.x + 0.5, c.y - 0.45, c.z + 0.5, { scatter: false,
   delayS: 0.2 })` - it drops from the nozzle onto the belt or floor below and rides on. sfx `splash` (exists) volume 0.4.
3. A spout fills one container at a time.

**Numbers (SYSTEMS 5.2, canonical):** `SPOUT_LPS` 250 L/s: Bucket / Bronze Bucket / Empty Canister 4 s, Glass Beaker 1 s, an
empty basin 4 s. Each spout draws independently; two spouts under one tank stack empty it twice as fast. A 16 000 L tank
fills 16 canisters in 64 s. (Today's tank spout moves 1000 L per `SPOUT_S` 1 s; continuous is slower per can on purpose:
it is visible, it reads in the crosshair, and it is the canon rate. The basin spout keeps `SPOUT_S`.)

**Leftover litres (pipe empty mid-pour, can taken away).**
- *Source runs dry mid-pour:* `draw` returns less (or 0); the throat keeps what it has and the can stays caught. The pour
  resumes the moment the tank has `F` again. Crosshair: `"Spout - the tank above is empty, 600/1000 L in the Bucket"`.
- *Source now holds another fluid* (it was drained and refilled with something else) while the throat holds `F`: no draw
  (draw is always called with `F`). The throat empties into the caught can only if it reaches the can's litres, so it waits:
  `"Spout - holds 400 L Water, the tank above gives Kerosene"`.
- *Throat not empty and nothing caught:* after `SPOUT_RETURN_S` 2 s with no container (a NEW transient timer on the cell,
  `c.timer`, which spouts do not use today) the spout pushes the throat back up: `back = fb.fill(above, F, throat)`,
  `throat -= back`. A tank refilled with another fluid refuses (`room` 0): the throat waits. Breaking the spout loses
  its throat litres (the tank rule: "breaking a tank loses what it held"); its caught can drops as a ground item
  (`noteBlock` already spills `items`).
- A caught can is never given back half full: `ItemStack` has no per-stack litres (SYSTEMS 2), so partial litres live
  only in the throat.

**Wrong container.** A Bucket under a crude tank (`containerFor('pail', 'crude_oil') === null`) is not caught; it rides on.
Crosshair while it sits there: `"Spout - a Bucket cannot carry Crude Oil, needs a canister"`. A Bronze Bucket is a lava
container (`FluidSpec.bucket.empty` for lava); under a water tank it is not caught (`bucketFilledWith('bronze_bucket',
'water')` is null - same as the hand rule `"A bronze bucket is kept for lava"`).

**Signals.** A spout (and a drain) pours only while `host.gate(c.x, c.y, c.z)` is true - the same rule as every powered
logistic machine (a lever touching it shuts the valve). No signal cell touching it: it just pours. This adds no new signal
code; `gate` exists on `LogiHost`.

### 4.2 The continuous item drain

**When it is continuous.** The cell below is a fluid endpoint (not a `basin`) and the hook has all four methods. Over a
basin the existing instant 1000 L path stays (the basin is a small open vessel; there is nothing to watch).

**Accepting** (`accept(x, y, z, item, n, commit)` case `'item_drain'`, continuous branch):

1. `fc = fullContainer(item)`; refuse (0) when null, when `isHot(item)`, or when `total(c.items) >= CELL_CAP` (empties back up).
2. Throat empty, or throat fluid `=== fc.fluid` and `throat + fc.litres <= POUR_BUFFER_L` (so one bucket/canister, or up to
   four beakers, queue in the throat).
3. `fb.room(below, fc.fluid) > 0` - the tank takes this fluid and has some room. (Room need not be the whole bucket: the
   drain pours what fits and holds the rest. This is the one probe that stops a drain swallowing water over a kerosene tank.)
4. Commit: `throat += fc.litres` (key `fc.fluid`), `c.items[fc.empty] += 1`. Returns 1 (one container per call, as today).

**Pouring** (NEW `private drainPour(c, dt)`, called from `tick` for `item_drain` before `mover`): while the throat has litres
and the gate is open: `moved = fb.fill(below, F, Math.min(throat, SPOUT_LPS * dt))`, `throat -= moved`; `throat <= 1e-6`
clears to `null`. The empty container leaves through the front at once (the existing `mover`), so a belt line of full cans
keeps moving: the litres follow at 250 L/s.

**Edge cases.**
- *Tank fills up mid-pour:* `fill` returns 0; the throat keeps its litres; `room` is 0 so new cans are refused and sit on top
  (ground items stay resting; a funnel feeding it waits). `"Item Drain - the tank below is full, 400 L Water waiting"`.
- *Tank broken or replaced:* the cell below is no longer an endpoint: the throat waits (no basin fallback mid-pour); if a
  basin is placed below, the drain does NOT tip its throat into it (keeps one rule per mode).
  `"Item Drain - nothing below takes it, 400 L Water waiting"`.
- *Breaking the drain:* empties in `items` spill (exists); throat litres are lost (tank rule).

### 4.3 The electromagnet (item, recipe, metal rule)

| field | value | reason (SYSTEMS 5) |
|---|---|---|
| key | `electromagnet` | SYSTEMS 6.2 / T4 |
| name | `Electromagnet` | plain English (4) |
| category | `'tool'` (no `ToolSpec`: like `hand_vacuum`, it mines as bare hands) | |
| age | `ageIndexOf('current')` (= 2 today) | T7 gating table: "electromagnet: current" |
| stack | 1 | tools 1 (T4) |
| icon | `item_electromagnet` (**NEW**, `src/render/textures/iconsGround.ts`) | a horseshoe of red-painted iron with copper windings, two bright pole tips |
| charge | `charge: { capacityJ: ELECTROMAGNET_J }` = 120 000 J; the stack's `durability` is joules left | 5.2: "charge 120 kJ (100 bursts) held as durability"; T10 rule 4 |
| desc | `"A copper coil on an iron core, with a battery in the grip. Hold it and press Use: metal within twelve blocks flies to you for 3 s. Holds 120 kJ, 100 pulls - Use it on an Acid Battery to charge it."` | names the use and the numbers (1.4) |

**Recipe (Arc Furnace forge, `src/content/recipes.ts`, after `chainsaw` in the "Arc Furnace" block):**

```ts
forge(3, 'electromagnet', '3 copper_coil, 2 iron_plate, 1 battery, 1 circuit', 1400),
```

Why these parts: an electromagnet IS copper wound on iron (`copper_coil`'s own text: "Wire wound on an iron core");
`battery` is its charge (forge tier 2); `circuit` is the Current marker that every Arc-furnace tool carries (chainsaw,
tractor). Cost sits between the chainsaw (1 chassis, 2 steel plate, 1 coil, 1 circuit @1300) and the tractor (@1400)
(5.3: "Current: alumina, circuit, coil"). `magnet_ring` is NOT used: it is Atomic (`age: 3`, Plasma Furnace 2800 C,
section 3.5) - see 14.1. Crafted full (120 kJ): it is built around a charged battery.

**Collector row (`COLLECTORS.electromagnet`):**

```ts
electromagnet: {
  item: 'electromagnet',
  radius: 12,                       // SYSTEMS 5.2
  pull: 14,                         // blocks/s
  burstS: 3,                        // one Use
  power: { kind: 'charge', watts: 400 },  // 400 W x 3 s = 1.2 kJ a burst -> 100 bursts from 120 kJ; 300 s of held Use
  accepts: isMetalItem,
  sound: 'magnet_hum',
  soundEveryS: 0.5,
},
```

Balance vs the Hand Vacuum Pump (radius 9, pull 11, 2.5 s, 480 s of wear then GONE): the magnet reaches further and faster
and never wears out, but only takes metal and must go back to a battery every 300 s of pulling. The pump stays the tool for
wheat and logs.

**What counts as metal - `isMetalItem(key)` (NEW, `src/content/itemsGround.ts`).** SYSTEMS 5.2 says "keys containing `ore`,
`ingot`, `plate`, `wire`, `bloom`, `scrap`, `nugget`, or tools of metal". Taken literally as substrings that rule pulls
`coal_ore`, `sulfur_ore`, `quartz_ore`, `pressure_plate`, `signal_wire`, `ingot_mould`, `unfired_ingot_mould` (and
`ember_core` contains "ore") and misses `copper_coil`, `bronze_cog`, `tungsten_rod`, `bronze_bucket`. So the rule is
token-based, by material, and keeps SYSTEMS' intent (ores, ingots, plates, wire, blooms, scrap, nuggets, metal tools):

```ts
/** Material words: an item whose key STARTS with one of these is made of metal (iron_ore, copper_wire, scrap_metal, bronze_cog). */
export const METAL_WORDS: readonly string[] = ['copper', 'tin', 'bronze', 'iron', 'steel', 'aluminum', 'tungsten', 'superalloy', 'scrap', 'magnet'];
/** Shape words: a key ENDING in one of these is a metal piece whatever its metal (future gold_ingot, iron_nugget). */
const METAL_ENDS: readonly string[] = ['ingot', 'nugget', 'bloom'];
export function isMetalItem(key: string): boolean {
  const def = itemOrNull(key);
  if (!def || def.cools) return false;                 // molten ladles and boiling pails: never (T1: hot things stay put)
  const parts = key.split('_');
  if (METAL_WORDS.includes(parts[0])) return true;
  if (METAL_ENDS.includes(parts[parts.length - 1])) return true;
  return (def.tool?.tier ?? 0) >= 2;                   // bronze and up: chainsaw, power_drill, arc_maul, every metal tool
}
```

Verified against the item list today (371 items). **Pulled:** `copper_ore tin_ore iron_ore copper_cable bronze_pickaxe
bronze_axe bronze_shovel iron_pickaxe iron_axe iron_shovel steel_pickaxe steel_axe steel_shovel bronze_hoe iron_hoe
copper_ingot tin_ingot bronze_ingot iron_ingot steel_ingot aluminum_ingot iron_plate steel_plate copper_wire copper_coil
tungsten_powder tungsten_rod bronze_bucket scrap_metal bronze_maul iron_maul steel_maul steel_cuirass bronze_hammer
bronze_pickaxe_head bronze_axe_head bronze_shovel_head bronze_hoe_head bronze_maul_head copper_bloom tin_bloom bronze_bloom
copper_plate bronze_plate bronze_rod iron_rod bronze_cog magnet_ring power_drill arc_maul chainsaw`.
**Not pulled (tests assert these):** `coal_ore sulfur_ore quartz_ore pressure_plate signal_wire ingot_mould
unfired_ingot_mould ember_core flint_pickaxe lava_bucket water_pail stone oak_log wheat electromagnet`. New units' keys follow
automatically (Unit 11's `steel_flask` is pulled; Unit 4's `ladle_bronze` is not - hot, and `ladle` is clay).

**Through walls.** The magnet pulls through walls, as the Hand Vacuum Pump already does (`GroundItems.tick` has no
line-of-sight test): a magnetic field passes through stone, and a line-of-sight raycast per item per tick costs more than
it gives. Items fly straight to the body (they visibly pass through the block in the way for a moment - the same as the
pump today). Items sealed in a fully closed cave still need a path for the PLAYER only to come within 12 blocks.

### 4.4 Charge: draw, drain and recharge

- **Units.** `durability` = joules left, float, 1 .. 120 000. `sanitize` already clamps loads to `[1, full]`; a magnet is
  *flat* when `durability - 1 < watts * dt` (one 20 Hz tick needs 20 J).
- **Drain.** NEW `PowerSource` member `{ kind: 'charge'; watts: number }`. `drawPower` case `'charge'`: needs the held stack
  to have `durability - 1 >= watts * dt`; subtracts it (not in Dev Mode, mirroring `wearHeldTool`), calls
  `player.inventory.notifyChanged()`; returns false when flat (the collector then stops). It never deletes the stack.
- **Recharge.** Use with a charge collector held, aimed at a block whose machine role is `'storage'`
  (`machineOfBlock(hit.block)?.role === 'storage'`: `battery`, `lithium_bank`, and any storage a later unit registers - no
  list): draws `missing = capacityJ - durability` with `Collectors.drawJoules(x, y, z, missing)`, adds what came back.
  Instant, one tap (phone first). Joules are real (T1 rule 4): 120 kJ is 6% of an Acid Battery's 2 MJ, refilled by a 3 kW
  network in 40 s; nothing is free and nothing is lost on the way (no second efficiency: the battery's `chargeEfficiency` 0.9
  already charged its losses on the way in).
- **`Simulation.drawJoules(x, y, z, J): number`** (NEW): `nodes.fresh()`; the node at the cell must be a storage node with a
  `net`; takes `min(J, available)` from that network's storage nodes that are `loaded && e.on && storedJ > 0`, each in
  proportion to its `storedJ` (so a mixed battery + bank network drains evenly); subtracts from each `e.storedJ` and from
  `net.storedJ`; returns joules taken. Any other cell: 0. A switched-off battery on the network gives nothing; the one aimed
  at may be off while another on its network gives (the network is the store, as in the power screen).
