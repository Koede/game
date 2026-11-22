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
| `SPOUT_RETURN_S = 2` | **NEW** constant | `logistics.ts` | seconds a spout keeps a caught can it cannot fill (the tank now holds another fluid) before releasing it empty |
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

`F` is the throat's fluid when the throat is not empty, otherwise `fb.offer(above)?.fluid`. With no `F` (empty throat, empty
source) nothing is caught (status `idle`): a can is caught only when `containerFor(item, F)` is non-null, so a spout never
holds a can it could not fill at that moment.

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

**Leftover litres (pipe empty mid-pour, fluid changed).** A player cannot take a caught can out of a spout (no Use case,
not in `peek`/`take`), so the throat can only be stranded two ways, and each has one rule:

- *Source runs dry mid-pour:* `draw` returns less (or 0); the throat keeps what it has and the can STAYS caught - a pipe
  that refills the tank finishes it, which is what a belt line wants (it waits for the pipe, nothing goes out half done).
  Crosshair: `"Spout - the tank is empty, 600/1000 L in the Bucket"`. A player who gives up breaks the spout: the can
  drops (`noteBlock` spills `items`), the throat litres are lost (the tank rule: "breaking a tank loses what it held").
- *Source now holds another fluid `G`* (drained and refilled with something else) while the throat holds `F`: nothing is
  drawn (draw is always called with `F`). After `SPOUT_RETURN_S` 2 s in this state (`c.timer`, transient, unused by spouts
  today) the spout RELEASES the caught can, still empty, onto the depot/floor below (so a belt line moves on), and from then
  on, every tick, tries to push the throat back up: `back = fb.fill(above, F, throat)`, `throat -= back`. While the tank holds
  `G` it refuses (`room` 0) and the spout catches nothing new (it would draw `G` into an `F` throat): crosshair
  `"Spout - holds 400 L Water, tank has Kerosene: empty it"`. When the tank is emptied (or holds `F` again) the throat flows
  back and the spout returns to normal. Litres conserved throughout.
- The same push-back runs for any throat with no caught can (only reachable through the release above, or a hand-edited
  save that the load clamp let through).
- A caught can is never given back part-full: `ItemStack` has no per-stack litres (SYSTEMS 2), so partial litres live only
  in the throat.

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

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (with edge cases and messages)

### 5.1 Spout state machine (continuous mode)

Each tick `spoutFlow(c, dt, fb)` (NEW, replaces `spoutFromTank`) computes one `PourStatus` (NEW transient type, kept on
the cell as `c.pour`, NOT saved, recomputed every tick) and acts on it:

| status | when | action | crosshair line (T8, <= 60 chars) |
|---|---|---|---|
| `shut` | `!host.gate(...)` | nothing; `c.timer` keeps counting for the return rule | `Spout - shut by signal` |
| `basin` | target 1, basin takes `F`, source offers `F` | basin += draw | `Spout - pouring Water into the basin, 400/1000 L` |
| `basin_full` | target 1, basin at 1000 L of `F` | nothing | `Spout - the basin is full (1000 L Water)` |
| `basin_other` | target 1, basin holds another fluid | nothing | `Spout - the basin holds Milk, not Water` |
| `pouring` | caught container, source offers `F` | throat += draw | `Spout - pouring Water, 750/1000 L in the Bucket` |
| `dry` | caught container (or basin), source offers nothing | nothing | `Spout - the tank is empty, 600/1000 L in the Bucket` |
| `other` | throat holds `F`, source offers `G != F` | after 2 s release the can empty; push the throat back whenever the source takes `F` | `Spout - holds 400 L Water, tank has Kerosene: empty it` |
| `cannot_carry` | an empty container sits below that `containerFor` refuses for the source's fluid | not caught | `Spout - a Bucket cannot carry Crude Oil, needs a canister` |
| `waiting` | nothing to fill below | nothing (throat is empty here by construction) | `Spout - waiting for a can, tank holds Water` |
| `idle` | the source offers nothing and nothing is below | nothing | `Spout - the tank is empty` |

Names in lines: fluids by `fluidOrNull(key)?.name` (`Water`, `Crude Oil`, `Lubricant`), containers by
`itemOrNull(key)?.name` (`Bucket` for `pail`, `Bronze Bucket`, `Empty Canister`, `Glass Beaker`). Litres per T8: `<n> L`
below 1000; the `n/1000 L` fraction always uses litres because it is a progress figure (a bucket reads `750/1000 L`, a
beaker `125/250 L`). Basin litres are integers (`Math.round`).

### 5.2 Drain lines

| state | line |
|---|---|
| throat pouring | `Item Drain - pouring Water into the tank, 600 L left` |
| tank full (`room` 0, same fluid) | `Item Drain - the tank below is full, 400 L Water waiting` |
| tank other fluid | `Item Drain - tank holds Kerosene, 400 L Water waiting` |
| no endpoint below, throat not empty | `Item Drain - nothing below takes it, 400 L Water waiting` |
| shut | `Item Drain - shut by signal, 400 L Water waiting` (or `Item Drain - shut by signal`) |
| idle | the existing generic `describe` output (`Item Drain - empty`, `Item Drain - 2 Empty Canister`) |

`describe` calls NEW `private pourLine(c): string | null` first for `spout` / `item_drain` and returns it when non-null;
otherwise the existing generic line (so the basin-fed spout and the basin drain read as today).

### 5.3 Electromagnet: Use, flat, recharge

Controller (`src/player/controller.ts:171`) becomes:

```ts
// Use with a collector in hand: aimed at a battery it recharges a charge collector; otherwise it runs it.
if (intent.use && (p.collectors.recharge(this.currentTarget) || p.collectors.trigger())) intent.use = false;
```

`this.currentTarget` is last frame's `RayHit | null` (`{ x, y, z, block, ... }`); `recharge` takes
`{ x: number; y: number; z: number; block: BlockDef } | null` so tests pass a literal.

| situation | result | toast (kind `info` unless noted) / sound |
|---|---|---|
| Use, charged, not aimed at storage | arms for 3 s; holding Use keeps it armed | sfx `machine_on` 0.6 / pitch 1.4 at start (exists), `magnet_hum` every 0.5 s at 0.35 while running |
| Use, flat (`durability - 1 < 20`) | not armed; Use consumed (does not fall through to the world) | `The Electromagnet is flat - Use it on an Acid Battery to charge it` at most once per `FLAT_TOAST_S` 3 s (NEW constant in collectors.ts) |
| goes flat during a burst | stops (`drawPower` false); renderer rings stop | the same flat toast (same cooldown) |
| Use aimed at a storage block, missing >= 1 J, network gives all | charge = full | `Electromagnet charged - 120/120 kJ` ; sfx `spark` volume 0.6 at the block |
| network gives part | charge += got | `Electromagnet charged to 70/120 kJ - the batteries ran dry` ; sfx `spark` 0.6 |
| network gives 0 | nothing | `No charge to draw - the batteries here are empty or switched off` |
| already full (missing < 1 J) | nothing | `The Electromagnet is already charged (120 kJ)` |
| Use aimed at a storage block holding the Hand Vacuum Pump | `recharge` returns false (power kind is `wear`); pump runs as today | - |
| Use aimed at a non-storage block | `recharge` false -> `trigger` | - |
| player dead | `trigger`/`tick` already stop (exists) | - |
| Dev Mode | no drain (like `wearHeldTool`) | - |
| pack full while pulling | items whose `inventory.space` is 0 are not pulled (exists in `GroundItems.tick`); charge is still drawn (it is a field, not a per-item cost) | - |

kJ in toasts: `Math.floor(durability / 1000)`; 120 kJ when full. Recharge also calls `stop()` so a burst does not continue
while aiming at the battery.

**Only metal moves.** In `GroundItems.tick` the collector loop gains one test: `if (c.accepts && !c.accepts(e.item))
continue;` - a non-metal item outside `PICKUP_RADIUS` is left alone; inside `PICKUP_RADIUS` everything is picked up as
always. `reach` stays the max collector radius (cheap; the per-item test decides). The `pulled` glow therefore shows only on
metal.

### 5.4 Save/load

- Spout and drain throats (`Cell.fluid`) and the spout's caught can (`Cell.items`) are in the existing `LogiSnapshot` rows;
  `load` already accepts them (fluid clamped to `BASIN_LITRES` = `POUR_BUFFER_L` = 1000). A saved-and-reloaded half-full
  pour resumes. `c.pour` and `c.timer` are transient.
- Old saves: spouts/drains have `fluid: null` and no items -> idle; the first tick picks the new behaviour. No migration.
- The magnet's charge is `durability`: the pack, crates, ground items (`spawn(..., { durability })`), and `PlayerSnapshot`
  already carry it. `fullDurability` returning `capacityJ` makes `sanitize` keep it in range.
- `Workshop.relocate` (contraptions, Unit 13) moves the whole `Cell`, throat and caught can included.

### 5.5 Conservation (normative, tested)

For any tick: `tankLitres + throat + basinLitres + litresInFullContainers * their size` is unchanged by spouts and drains
except litres in a block that is broken. Items: a caught can is in exactly one place (ground, depot, or `c.items`).

### 5.6 Performance

`fb.offer` / `fb.draw` / `fb.room` resolve an endpoint (a Map lookup + `tankColumn` walk). A spout calls at most
`offer` + one `draw` per tick; a drain at most one `fill` per tick and one `room` per `accept`. With 20 spouts that is 40
lookups per tick - negligible next to the pipe solver. No allocation per tick beyond what `tankColumn` already does.

### 5.7 Things that deliberately do NOT change

- No player Use on a spout or drain (the existing `use` switch has no case for them; the bucket in hand on a tank is the
  hand route). Unit 8's `give?` parameter is untouched.
- Basin-fed spout (`SPOUT_S` 1 s per 1000 L) and basin drain (instant) stay exactly as today, with their tests.
- `COLLECTORS.hand_vacuum` and `PowerSource` `wear`/`free`/`electric` are unchanged; `electric` stays for a future
  grid-tethered tool.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Strings (exact, T8)

Item descriptions (`src/content/itemsWorkshopParts.ts`, replace):

- `spout`: `"Pours a fluid into what waits below it. Under a tank: 250 L a second into a basin, bucket, canister or beaker - it catches one off a belt and sets it back down full. Under a basin: a bucket at a time."`
- `item_drain`: `"Empties full buckets, canisters and beakers dropped on it - into a tank below at 250 L a second, or into a basin below at once - and passes the empties out of its front."`
- `electromagnet`: see 4.3.

Item tooltip card (`itemCard`, slotViews.ts): for `def.charge` add the row `['Charge', `${Math.floor(d / 1000)} / ${def.charge.capacityJ / 1000} kJ`]`
(e.g. `Charge  84 / 120 kJ`). The slot's durability bar is already `durability / fullDurability`, so it shows charge.

Workshop Guide (`src/ui/screens/workshop/workshopScreen.ts:43`, Rules text): the sentence `"Fluids reach spouts and drains
from tanks on the pipe network."` becomes `"Spouts under a tank pour 250 L a second into the basin or can below; drains over a
tank empty cans at the same rate."`

All crosshair lines: section 5.1 / 5.2. All toasts: section 5.3. No exclamation marks.

### 6.2 Goggles

Spout and drain are `NON_KINETIC`; goggles show the same single line as the bare crosshair (`Workshop.describe` ->
`logi.describe`). No kinetic second line.

### 6.3 Phone

- No new screen, button or chip. The magnet works with the existing Use button (tap = 3 s burst, hold = keeps pulling);
  recharging = aim at the battery + Use. Charge is read from the hotbar slot's bar (no hover needed) and, in the inventory,
  the tooltip card on tap.
- Crosshair lines all <= 60 characters (counted: `Spout - pouring Lubricant, 750/1000 L in the Empty Canister` is 59,
  `Spout - the tank is empty, 600/1000 L in the Empty Canister` 59, `Item Drain - the tank below is full, 400 L Water waiting`
  57). Fluid names longer than `Lubricant` (`Fuel Ethanol`) may push a line to 62: acceptable, the HUD wraps at ~64.

### 6.4 Sounds (T9)

NEW `src/audio/sfxWorkshop.ts` exporting `WORKSHOP_SFX` (Units 13 and 16 add to the same file - create it if missing, append
if present; see 14). Patches follow the shape of `sfxBrew.ts`:

| name | patch | when | volume |
|---|---|---|---|
| `spout_pour` | band-passed noise (centre ~900 Hz, Q 1.2) with a slow 6 Hz amplitude wobble, 0.9 s, soft attack/release | each spout/drain while pouring: on the first pouring tick, then every 1 s while it keeps pouring (a per-cell timer, NOT saved); stops when the pour stops | 0.3 (whisper tier, it repeats) |
| `magnet_hum` | sine 110 Hz + 220 Hz (0.4), 4 Hz vibrato +-3 Hz, 0.55 s | `CollectorDef.sound` of the magnet, every 0.5 s while running | 0.35 (as the pump's hiss) |

`splash` (exists) 0.4 stays the "container full" cue. `spark` (exists) is the recharge cue. Add both names to the
`SfxName` union (`src/core/gameEvents.ts`), widen `CollectorDef.sound` to include `'magnet_hum'`, merge `WORKSHOP_SFX`
in `src/audio/sfx.ts`, and update `sfx.test.ts` to `72 + MAGIC + ... + Object.keys(WORKSHOP_SFX).length` (whatever the
expression is after the other units; this unit adds 2). Idle spouts and drains are silent (T9 rule 3).

### 6.5 The pour stream (render)

`WorkshopView` gains an OPTIONAL member `pours?: PourView[]` (NEW; SYSTEMS 6.5 allows optional members):

```ts
export interface PourView { x: number; y: number; z: number; colour: number; toY: number; item?: string }
```

`Workshop.view()` fills it from `logi.pours()` (NEW): one row per spout/drain whose `c.pour` is `basin` or `pouring` (spout:
from the nozzle `y` = `c.y` down to `toY` = `c.y - 0.9` for a can / `c.y - 0.2` for the basin top surface; drain: from
`c.y + 0.1` down to `c.y` - a short glug inside the grate). `colour` = `FluidSpec.colour`. The workshop renderer
(`src/render/workshop/`) keeps a pool of at most 16 thin boxes (0.07 x 1 x 0.07, unit height scaled to `y - toY`), coloured
per row, lit by the terrain light, and a pool of droplet sprites: at most 6 per stream (well under the 24-per-emitter cap),
spawned at the bottom with a small random hop, recycled. Hidden when `pours` is empty or absent. Glowing fluids (`glow:
true`, lava) use the emissive material the pipe renderer uses for lava. No per-frame allocation (anti-pattern 6d).

A container being filled is drawn by the existing ground-item renderer? No - while caught it lives in `c.items`, not as a
ground item. The renderer therefore also draws the caught can from `PourView.item` (the caught empty's key);
the workshop renderer reuses the held-item sprite mesh (the one `GroundItemRenderer` shares) at `(x + 0.5, toY, z + 0.5)`,
not spinning. If reusing the sprite is awkward in `src/render/workshop/`, draw nothing for the can: the stream ending in
mid-air above the belt is acceptable for this unit, and the goggles line names the can (fallback the builder may take;
note it in the PR).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save (TypeScript sketches)

```ts
// src/core/types.ts - ItemSpec gains (NEW, optional)
/** A tool that runs on stored electricity: its stack's `durability` is joules left (1 = flat). Stack 1. */
charge?: { capacityJ: number };

// src/game/inventory.ts - fullDurability (one more fallback)
return def?.tool?.durability ?? def?.wear ?? def?.mould?.pours ?? def?.charge?.capacityJ;

// src/workshop/workshop.ts
export interface FluidBlockHook { /* section 2.2 */ }
export interface PourView { x: number; y: number; z: number; colour: number; toY: number; item?: string } // NEW
export interface WorkshopView { /* spin, swings, links, moving (Unit 0) */ pours?: PourView[] }              // NEW optional

// src/workshop/logistics.ts
export const SPOUT_LPS = 250;           // NEW, SYSTEMS 5.2
export const POUR_BUFFER_L = 1000;      // NEW
export const SPOUT_RETURN_S = 2;        // NEW
export type PourStatus = 'shut' | 'basin' | 'basin_full' | 'basin_other' | 'pouring' | 'dry' | 'other' | 'cannot_carry' | 'waiting' | 'idle'; // NEW
export interface Cell { /* existing */ pour?: { status: PourStatus; fluid: string | null; item: string | null; litres: number; soundT: number } } // NEW, transient
// LogiHost.fluidBlock(): FluidBlockHook | null   (type only; same object)

// src/game/collectors.ts
export type PowerSource = /* wear | free | electric (unchanged) */ | { kind: 'charge'; watts: number }; // NEW member
export interface CollectorDef { /* existing */ accepts?: (item: string) => boolean; sound?: 'steam_hiss' | 'machine_on' | 'spark' | 'magnet_hum' }
export const FLAT_TOAST_S = 3;          // NEW
class Collectors {
  /** Takes joules from the storage network of the block at x, y, z (Game: sim.drawJoules); null = nothing to draw from. */
  drawJoules: ((x: number, y: number, z: number, J: number) => number) | null = null; // NEW
  recharge(hit: { x: number; y: number; z: number; block: BlockDef } | null): boolean;    // NEW
}

// src/game/groundItems.ts
export interface ActiveCollector { radius: number; pull: number; accepts?: (item: string) => boolean } // NEW optional

// src/sim/power.ts
/** Takes up to J joules out of the network's usable storage, in proportion to what each holds. Returns joules taken. */
export function drawFromStorage(net: Network, J: number): number; // NEW
// src/sim/simulation.ts
drawJoules(x: number, y: number, z: number, J: number): number;  // NEW
```

**Saved fields:** none new. `LogiSnapshot` row layout is unchanged (`[x, y, z, kind, items, fluid, filter, src, targets]`);
spouts/drains now put real values in `items` and `fluid`. `load` sanitises them already (unknown items/fluids dropped, fluid
clamped to 1000, counts to `CELL_CAP * 4`). One extra sanitising line: for a `spout`, keep at most ONE item total in `items`
(extras spill as ground items at the cell on the first tick - or simply clamp to the first entry with count 1; the builder
picks the clamp, documented in a comment: a spout never holds more than one can).

**Old saves:** load with `fluid: null`, empty items: identical to a fresh spout/drain. Magnet: no old save holds one.
**T10 test:** load a `LogiSnapshot` row for a spout without items/fluid (the old shape) and one with a half-full throat;
both load; the second resumes and finishes the can.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered)

Prerequisite: Unit 0 merged (the `draw?/fill?` type). If it is not, add the two members yourself exactly as 2.2 (they are
type-only) and tell the coordinator.

1. **Hook type** - `src/workshop/workshop.ts`: export `FluidBlockHook` (2.2), use it for `fluidBlock`; `LogiHost.fluidBlock():
   FluidBlockHook | null` in `logistics.ts`. Export `PourView`; add `pours?: PourView[]` to `WorkshopView`.
2. **Container helpers** - `logistics.ts`: `containerFor`, `isEmptyContainer`, `fullContainer` (4.1) from `bucketFilledWith`,
   `fluidInBucket`, `FLUIDS` (`src/core/registry.ts`), `CHEM_CONTAINERS`, `filledWith`, `isEmptyChemContainer`
   (`src/core/distill.ts`), `LITRES_PER_BUCKET` (`src/core/constants.ts`); delete `FLUIDS_EMPTY`. `isHot` from
   `src/game/inventory.ts` (Unit 4) or the inline `cools` test. Check `src/workshop` may import `src/core/distill.ts`
   (it is DOM-free core; `logistics.ts` already imports `src/game/*`).
3. **Spout** - replace `spoutFromTank(c, dt, fb)` with `private spoutFlow(c: Cell, dt: number, fb: FluidBlockHook): void`
   implementing 4.1 / 5.1; `spout(c, dt)` routes: basin above -> existing basin code; endpoint above and full hook ->
   `spoutFlow`; endpoint above but partial hook -> the OLD bucket code (keep it as `private spoutByBucket(...)`, renamed
   from `spoutFromTank`, using `isEmptyContainer` instead of `FLUIDS_EMPTY`). Sound: `spout_pour` on `c.pour.soundT`.
4. **Drain** - `accept` case `'item_drain'`: insert the continuous branch (4.2) before the existing `fb.use` branch; the
   existing branch stays for a partial hook. `tick` case `'item_drain'`: `this.drainPour(c, dt); this.mover(c, dt);`
   (NEW `private drainPour(c: Cell, dt: number): void`).
5. **Gate** - spouts and drains read `this.host.gate(c.x, c.y, c.z)` inside `spoutFlow` / `drainPour` (do NOT add them to
   `POWERED`; that set means "needs shaft power").
6. **Lines** - `private pourLine(c: Cell): string | null` (5.1/5.2), called first in `describe` for the two kinds.
7. **View** - `Logistics.pours(): PourView[]` (reuses one array, rows rewritten in place); `Workshop.view()` sets
   `pours: this.logi.pours()`.
8. **Load clamp** - `load`: a spout keeps one item (7).
9. **Game hook** - `src/app/game.ts`: the four-member implementation of 2.3 (imports `fluidOrNull` from registry,
   `FluidKey` type).
10. **Render** - `src/render/workshop/` (the renderer that reads `WorkshopView`; grep `swings` to find it): stream pool +
    droplets (6.5).
11. **Sounds** - `src/audio/sfxWorkshop.ts` (create or append), `SfxName` union, `sfx.ts` merge, `sfx.test.ts` count.
12. **Item spec field** - `ItemSpec.charge?` (`src/core/types.ts`), `fullDurability` (`src/game/inventory.ts`), the
    `Charge` row in `itemCard` (`src/ui/screens/inventory/slotViews.ts`).
13. **Item + metal rule** - `src/content/itemsGround.ts`: `ELECTROMAGNET_J`, `METAL_WORDS`, `isMetalItem`, the
    `electromagnet` row in `GROUND_ITEMS` with `age: ageIndexOf('current')` (import from `src/magic/ageMap.ts`; if the
    content layer must not import magic, use the same constant the other content files use for Current - grep
    `ageIndexOf(` in `src/content/` first; Unit 0 may have moved it).
14. **Recipe** - `src/content/recipes.ts` after `chainsaw`: `forge(3, 'electromagnet', '3 copper_coil, 2 iron_plate, 1 battery, 1 circuit', 1400)`.
15. **Icon** - `src/render/textures/iconsGround.ts`: `item_electromagnet: icon(electromagnet)` with a 16x16 painter in the
    file's style (red horseshoe, copper bands, silver tips). Must pass the texture readability test.
16. **Collectors** - `collectors.ts`: `charge` member + `drawPower` case; `accepts`, widened `sound`; `COLLECTORS.electromagnet`
    (replace the comment); `trigger()` flat check + toast cooldown; `recharge(hit)`; `tick` copies `def.accepts` into
    `this.out.accepts` (set `undefined` for the pump so a reused `out` object never keeps a stale filter).
17. **Ground items** - `groundItems.ts`: `ActiveCollector.accepts?` and the one-line test in the collector loop.
18. **Sim hook** - `src/sim/power.ts` `drawFromStorage(net, J)`; `src/sim/simulation.ts` `drawJoules(x, y, z, J)`
    (`this.nodes.fresh()`, `this.nodes.byKey.get(posKey(x, y, z))`, `node.spec.role === 'storage'`, `node.net`). Call
    `this.touch(e)` for each battery changed so an open power screen refreshes.
19. **Wiring** - `src/app/game.ts`: `state.player.collectors.drawJoules = (x, y, z, J) => this.state.sim.drawJoules(x, y, z, J);`
    next to the other hooks, and cleared on dispose (`offs.push(() => { ...drawJoules = null; })`).
20. **Controller** - `src/player/controller.ts:171` (5.3).
21. **Text** - spout / drain descriptions (6.1); Workshop Guide sentence if applicable.
22. **Rosters** - `src/content/specRosterGround.ts`: add `'electromagnet'` to the key list and
    `'electromagnet: 1 electromagnet <- 3 copper_coil, 2 iron_plate, 1 battery, 1 circuit @1400 T3'` to the recipe list
    (same format as the `hand_vacuum` line).
23. **Docs** (11), tests (9), e2e (10).

Helpers to reuse, not rewrite: `tankStackEndpoint` (through `sim.fluidEndpoint`), `bucketFilledWith`, `filledWith`,
`fluidInBucket`, `isEmptyChemContainer`, `stackLimit`, `ground.spawn`, `host.gate`, `machineOfBlock`, `fullDurability`,
`Network.storage`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

### 9.1 `src/workshop/parts.test.ts` / `logistics.test.ts` (spouts and drains)

Add a test helper in the file that uses it (NOT a new fixture file): `fakeTank(at: [x, y, z], fluid, litres, cap = 16000)`
returning a full `FluidBlockHook` (`is`, `use` (1000 L bucket swap, for the fallback), `draw`, `fill`, `offer`, `room`)
over one in-memory `{ fluid, litres }`, with a `total()` accessor. Use the existing `setup()` / `put` / `run` / `count`.

1. `it('a spout under a tank pours 250 L/s: a canister on the depot below is full after 4 s, not before')` - tank (0, 2, 0)
   gasoline 2000; spout (0, 1, 0); depot (0, 0, 0) with 1 `empty_canister`. `run(3.9)`: depot has no `gasoline_canister`,
   tank 2000 - ~975 (`toBeCloseTo(1025, -1)`), `describe(0, 1, 0)` matches `/^Spout - pouring Gasoline, \d+\/1000 L in the Empty Canister$/`.
   `run(0.2)`: depot has 1 `gasoline_canister`, tank 1000.
2. `it('a spout fills a glass beaker in one second')` - spirit tank 1000 L, `glass_beaker` on the depot: after 1.05 s the depot
   holds 1 `spirit_beaker` (`filledWith('glass_beaker', 'spirit')`), tank 750. (Water has no beaker row: `water_pail` is its
   only `CHEM_CONTAINERS` entry, so a beaker under a water tank is `cannot_carry` - assert that too.)
3. `it('a spout catches a can off a belt and sets it back down full')` - cranked belt line under the spout carrying 3
   `empty_canister` ground items; after `run(15)`: 3 `gasoline_canister` items exist (ground or past the belt's end), 0
   empties, tank -3000. Items conserved (count of cans before = after).
4. `it('a spout under a tank fills the basin below at 250 L/s and stops at 1000 L')` - tank water 5000; basin (0, 0, 0);
   `run(2)`: basin `fluid.litres` within 10 of 500; `run(3)`: exactly 1000, tank 4000; line `Spout - the basin is full (1000 L Water)`.
5. `it('a pour waits when the tank runs dry mid-fill and finishes when it is refilled')` - tank 600 L; can on depot; `run(5)`:
   no full can, throat 600, tank 0, line contains `the tank is empty, 600/1000 L`; set tank 1000; `run(2)`: full can,
   tank 600. Conservation: tank + throat + 1000*fullCans constant at every 0.5 s sample.
6. `it('a tank switched to another fluid releases the can and takes the throat back once emptied')` - water tank 400 L,
   can on the depot: `run(3)` -> throat 400, tank 0; set the tank to kerosene 1000 (`fakeTank.set`); `run(1)`: line
   `Spout - holds 400 L Water, tank has Kerosene: empty it`, can still caught; `run(1.2)`: the empty can is back on the depot,
   throat 400 water, tank still 1000 kerosene; set tank to 0 L; `run(0.1)`: tank 400 water, throat null. Conservation of
   water (tank water + throat) at every sample.
7. `it('the spout never draws a second fluid into its throat')` - continue 6 before emptying: `run(5)` with a fresh empty can on
   the depot: no kerosene drawn, the can not caught.
8. `it('a bucket under a crude tank is left alone')` - crude tank, `pail` on the depot: `run(5)`: pail still on the depot,
   tank unchanged, line `Spout - a Bucket cannot carry Crude Oil, needs a canister`.
9. `it('a hot item is never caught')` - `boiling_pail` (has `cools`) under a water tank on the depot: untouched after 5 s.
10. `it('a lit signal shuts a spout and a drain')` - lever touching the spout (use the signals fixture from `signals.test.ts`
    or set the gate by placing a `crank_lever` off): no litres move in 3 s; switch on -> pours. (Use whatever makes
    `gate` false: a signal cell touching it that is OFF.)
11. `it('a drain over a tank pours a canister at 250 L/s and passes the empty on at once')` - drain (0, 1, 0) facing east
    over tank (0, 0, 0) gasoline 0/16000: `offer(0, 1, 0, 'gasoline_canister', 1) === 1`; after 0.3 s an `empty_canister`
    has left the front (ground item at x 1 or in `peek`), tank ~75; after 4.1 s tank 1000, line idle.
12. `it('a drain refuses a can its tank cannot take')` - tank holding kerosene: `offer(0, 1, 0, 'water_pail', 1) === 0`
    (`room('water')` is 0); tank full of gasoline (16000/16000): `offer(0, 1, 0, 'gasoline_canister', 1) === 0`; nothing
    lands in the drain's `items`.
13. `it('a drain holds what the tank has no room for')` - tank gasoline 15600/16000; offer one canister: accepted; after 5 s
    tank 16000, throat 600, line `Item Drain - the tank below is full, 600 L Gasoline waiting`; a second offer is 0.
14. `it('four beakers queue in a drain throat, a fifth waits')` - spirit tank: four `spirit_beaker` accepted, the fifth 0
    until the throat drops below 750.
15. `it('without draw/fill the old bucket-by-bucket spout and drain still work')` - the existing test at parts.test.ts:138
    stays green unchanged (it is the fallback test). Add an assertion comment.
16. `it('a spout's throat and caught can survive a save round trip')` - pour 2 s, `toJSON()`, new Workshop, `load`, `run(2.1)`:
    full can, litres conserved. And an old row `[0, 1, 0, 'spout', {}, null, null, null, []]` loads idle.
17. `it('a contraption moves a pouring spout with its throat')` - optional if Unit 13's relocate test fixture is handy:
    `logi.relocate(new Map([['0,1,0', [5, 1, 0]]]))` keeps `fluid` and `items`.
18. `it('pours() lists one stream per pouring spout with the fluid colour')` - colour equals `fluidOrNull('gasoline').colour`.

### 9.2 `src/game/collectors.test.ts` (electromagnet)

Use the existing `setup()` / `lie()`.

1. `it('the electromagnet is a registered Current item with a 120 kJ charge as durability')` - `player.give('electromagnet', 1)`
   -> `durability === ELECTROMAGNET_J`; `itemOrNull('electromagnet').age === ageIndexOf('current')`; `collectorOf('electromagnet').radius === 12`.
2. `it('pulls metal from twelve blocks and leaves stone, wood and wheat lying')` - lie `iron_ore` at 11.5, `copper_ingot` at
   -10.5, `scrap_metal` at 6.5, `stone`/`oak_log`/`wheat` at 8.5, `iron_plate` at 14.5 (out of range); trigger, tick 3:
   pack has iron_ore, copper_ingot, scrap_metal; ground still has the three non-metals and the iron plate. Sounds include
   `magnet_hum`.
3. `it('a burst costs 1.2 kJ and holding Use costs 400 W')` - after one full burst durability = 120000 - 1200 (+-25);
   holding (re-trigger every 0.25 s) for 10 s costs 4000 +- 50.
4. `it('a flat magnet does not run, says how to charge it, and is not destroyed')` - give with durability 10: trigger returns
   true, `running` false after a tick, toast `The Electromagnet is flat - Use it on an Acid Battery to charge it` once even
   after 10 triggers within 1 s; the stack is still there with durability >= 1.
5. `it('runs out mid-burst and stops')` - durability 600 (0.5 burst) -> after 3 s `running` false, durability < 25, stack present.
6. `it('recharges from a storage block, joule for joule')` - `player.collectors.drawJoules = (x, y, z, J) => { asked = J; return J; }`;
   durability 20000; `recharge({ x: 0, y: 0, z: 0, block: blockOrNull('battery')! })` -> true, durability 120000, asked 100000,
   toast `Electromagnet charged - 120/120 kJ`.
7. `it('partial and empty recharges say so')` - hook returns 50000 of 100000 -> `Electromagnet charged to 70/120 kJ - the batteries ran dry`;
   returns 0 -> `No charge to draw - the batteries here are empty or switched off`; full -> `The Electromagnet is already charged (120 kJ)`.
8. `it('recharge ignores non-storage blocks and non-charge collectors')` - `recharge({ block: stone })` false; with
   `hand_vacuum` held on a battery false; with nothing held false.
9. `it('isMetalItem follows the material and shape rules')` - table test over the two lists in 4.3 (pulled / not pulled).
10. `it('the hand vacuum still pulls everything')` - existing tests stay green; add one: pump pulls `wheat` and `iron_ore`.
11. `it('Dev Mode does not drain the charge')`.

### 9.3 `src/game/groundItems.test.ts`

`it('a collector with accepts pulls only what it accepts, and plain pickup still takes everything')` - collectors
`[{ radius: 10, pull: 12, accepts: (i) => i === 'coal' }]`: coal at 8 flies in, flint at 8 stays, flint at 1 is picked up.

### 9.4 `src/sim/power.test.ts`

1. `it('drawJoules takes from the storage of the aimed battery's network in proportion')` - two batteries cabled together,
   storedJ 1 MJ and 0.5 MJ: `sim.drawJoules(b1, 300000)` returns 300000; storedJ 0.8 MJ / 0.4 MJ.
2. `it('drawJoules gives what there is, skips switched-off storage, and is 0 for other blocks')` - battery off -> 0; stone -> 0;
   battery with 50 kJ asked 120 kJ -> 50000.
(Use the power test fixture already in `power.test.ts`; `Simulation` is constructed there for network tests.)

### 9.5 Content and roster

- `src/content/specRosterGround.ts`: key + recipe line (8, step 22). `content.test.ts` progression still completes (the
  magnet is optional; its inputs are all obtainable at tier 3: copper_coil T2, iron_plate T2, battery T2, circuit T3).
  The age check: recipe `age` 2 (`forge(3, ...)` -> `minTier - 1`) equals the item's `ageIndexOf('current')` 2.
- Texture readability test covers `item_electromagnet`.
- `src/audio/sfx.test.ts`: count includes the two new names.
- `src/game/inventory.test.ts`: `fullDurability('electromagnet') === 120000`; a loaded slot with durability 999999 clamps to
  120000, with 0 to 1.
- Spout/drain item desc text: if a roster or snapshot test pins descriptions, update it.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E steps (`scripts/e2e-workshop.mjs`)

Add two named steps at the end of the existing run (they reuse the cleared yard `P = { gy, x0, z0 }` of the first step; use
a fresh strip of it: `x0 - 3 .. x0 - 1`, `z0 + 6 .. z0 + 7`, or clear a new 3 x 3 x 5 box next to it the same way the first
step does). `hw.tick(n)` runs `n` fixed steps of `DT` (0.05 s): `tick(20)` = 1 s. `window.__hw` ONLY for setup and reading
state; the actions are real input (`d.use()`, `d.aimAt`, `d.holdUse`). Run `node scripts/e2e-workshop.mjs --device=desktop`
(no `HW_GPU`); the spout step has no UI so desktop is enough; run `--device=phonePortrait` too for the magnet step (Use button).

**Step A - `step('a spout under a tank pours 250 L/s into a canister on a belt', ...)`**

1. Setup (`d.hw`): `hw.setVoxel(ax, gy + 2, az, 'tank')`; set its fluid:
   `window.__hw.app.game.state.sim.machineAt(ax, gy + 2, az).fluidIn = { fluid: 'gasoline', litres: 4000 }`;
   `hw.setVoxel(ax, gy + 1, az, 'spout')`; a depot at `(ax, gy, az)`; give the player 2 `empty_canister` and 1
   `engineer_goggles`.
2. Action (real input): select the canister slot (`hw.selectSlot` is setup - acceptable; or press the hotbar key), aim at the
   depot (`d.aimAt({ x: ax, y: gy, z: az })`) and `d.use()` twice -> two empties on the depot (the depot's existing
   `putOrTake`).
3. `hw.tick(40)` (2 s). Read `workshop.describe(ax, gy + 1, az)`: matches `/^Spout - pouring Gasoline, \d+\/1000 L in the Empty Canister$/`
   and the number is between 400 and 600. Screenshot `spout-pouring` (the stream must be visible above the depot; aim at the
   spout so the crosshair line shows: `d.aimAt` the spout first, then shoot).
4. `hw.tick(140)` (7 s more, 9 s total). Read: depot `peek` has 2 `gasoline_canister`, 0 `empty_canister`; the tank's
   `fluidIn.litres` is 2000 (+-1). Screenshot `spout-done`.
5. Assert the goggles line now reads `Spout - waiting for a can, tank holds Gasoline`.

**Step B - `step('the electromagnet pulls metal from 12 blocks and recharges at a battery', ...)`**

1. Setup: `hw.give('electromagnet', 1)` (fresh = full); select it. Spawn ground items with
   `window.__hw.app.game.state.player.ground.spawn('iron_ore', 3, px + 10.5, gy + 0.5, pz + 0.5, { scatter: false, delayS: 0 })`,
   `'copper_ingot'` 2 at `px - 9.5`, and `'stone'` 4 at `px + 8.5` (non-metal). Place `battery` at `(px + 2, gy, pz)`
   with `machineAt(...).storedJ = 1_000_000`.
2. Action: look at the open sky (or the floor away from the battery), `d.use()` once (desktop right click / phone Use).
3. `hw.tick(80)` (4 s). Assert: pack has 3 `iron_ore` and 2 `copper_ingot`; ground still has 4 `stone`; the held stack's
   `durability` is 118 800 +- 60. Screenshot `magnet-pulled` taken after 1 s of ticks (pulled items glowing, rings shown).
4. Drain to flat: set the held stack's `durability = 10` (setup); `d.use()`; assert a toast element containing
   `The Electromagnet is flat` appears (read the toast DOM the way other steps do, or `hw.state()` toasts if exposed).
5. Recharge: `d.aimAt({ x: px + 2, y: gy, z: pz })` (the battery), `d.use()`. Assert: durability 120 000; the battery's
   `storedJ` fell by 119 990 +- 1 (no generator on it, so nothing refills it in between - tick 0 between the two reads);
   a toast `Electromagnet charged - 120/120 kJ`. Screenshot `magnet-recharged`.

Screenshots land in `test-results/e2e-workshop/<device>-<name>.png` (the script's `d.shot`).

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/workshop.md`: replace the spout/drain sentences in "Logistics and processing" and the "Fluids" bullet of the third
  slice with the continuous rules (250 L/s, throat, catching off a belt, basin fill, drain throat, return rule, signals,
  lines, fallback without the full hook); document `FluidBlockHook` (draw/fill/offer/room) in the machine-interface section;
  `WorkshopView.pours`. Remove "fluid pipes into spouts/drains" from the "Not built yet" line.
- `docs/api/ground-items.md`: replace the "Electromagnet (Current Age, future - not built)" paragraph with the built tool
  (item, recipe, charge, `charge` power kind, `accepts` / `isMetalItem` with the rule, recharge at storage, toasts, sounds);
  add `accepts?` to the `ActiveCollector` / `CollectorDef` lines and the `drawJoules` hook.
- `docs/api/sim.md`: `Simulation.drawJoules(x, y, z, J)` and `drawFromStorage` (power section).
- `docs/api/tech-content.md`: the electromagnet recipe row in the Arc Furnace list.
- `docs/api/audio.md`: `sfxWorkshop.ts` names `spout_pour`, `magnet_hum`.
- `docs/api/content.md` (if it documents `ItemSpec`): `charge?`.
- Never `docs/WHATS_LEFT.md` or `docs/build/SYSTEMS.md` (the coordinator; see 14).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `FluidBlockHook` exported with `draw/fill/offer/room` optional; Game implements all four over `sim.fluidEndpoint`.
- [ ] A spout under a tank fills a canister in 4.0 s (+- one tick), a glass beaker in 1.0 s, an empty basin in 4.0 s; litres
      conserved at every tick (unit test samples).
- [ ] A spout catches one empty off a moving belt, fills it, sets it back down full; 3 cans in, 3 full out.
- [ ] A dry tank pauses the pour and keeps the throat and the can; refilling finishes it. A tank switched to another fluid
      releases the can (empty) after 2 s and keeps the throat until the tank can take it back. No litres appear or vanish (except a broken block).
- [ ] Containers come only from `FluidSpec.bucket` + `CHEM_CONTAINERS`; `FLUIDS_EMPTY` is gone; vials and hot items are never
      filled or caught.
- [ ] A drain over a tank takes a full can only when the tank takes that fluid and has room, passes the empty on at once, pours
      at 250 L/s, holds what the tank cannot take, and says so.
- [ ] The basin spout and basin drain behave exactly as before; the existing parts.test.ts spout/drain test is untouched and green.
- [ ] A lit-off signal touching a spout or drain stops it.
- [ ] Every crosshair line of 5.1/5.2 appears in tests verbatim and is <= 60 characters.
- [ ] `spout_pour` plays only while pouring; idle spouts are silent; the stream renders with <= 6 droplets per stream and <= 16
      streams pooled; no per-frame allocation.
- [ ] `electromagnet` exists: Current age (`ageIndexOf('current')`), stack 1, 120 kJ charge as durability, icon readable,
      recipe `3 copper_coil, 2 iron_plate, 1 battery, 1 circuit @1400 T3`, in `specRosterGround.ts`.
- [ ] It pulls only `isMetalItem` items from 12 blocks at 14 b/s for 3 s; costs 1.2 kJ a burst (100 bursts); never breaks;
      a flat magnet says how to charge it (toast at most every 3 s).
- [ ] Use on an Acid Battery / Lithium Bank recharges joule for joule from that network's usable storage; switched-off storage
      gives nothing; every toast of 5.3 is tested.
- [ ] Hand vacuum behaviour unchanged (all old collector tests green).
- [ ] `content.test.ts` progression and `gates.test.ts` green; `sfx.test.ts` count updated.
- [ ] E2E steps A and B pass on `--device=desktop`; B also on `--device=phonePortrait`; screenshots saved.
- [ ] Docs of section 11 updated. `npm test`, `npx tsc --noEmit` (or the repo's `npm run check`) and the build pass.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Making the spout itself a pipe endpoint (a `MachineSpec` with `fluids` so a pipe joins it directly). Today "fed by a pipe"
  means the pipe feeds the tank/port/machine above it. A later unit can add it; the throat model already fits.
- Partly filled containers as items (no per-stack metadata, SYSTEMS 2).
- Spouts filling vials of essentia, or tube-fed spouts (magic tubes are their own network, Unit 19).
- A drain over a basin pouring continuously; spout-from-basin continuous (both stay bucket-by-bucket by design).
- A grid-tethered electric tool (`PowerSource.electric` stays unused) and wireless charging; charging the magnet from a
  generator directly or from a power port.
- The magnet pulling blocks, mobs, Emberbound automatons or items out of containers; line-of-sight for collectors.
- A HUD charge chip (the slot bar is the read-out; a chip can come with a later HUD pass).
- A side goal for the magnet or the spout (none is listed in SYSTEMS T7 for this unit; adding one is a coordinator call, 14.5).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **Recipe change (SYSTEMS T4 row `electromagnet`).** The T4 recipe "forge T3 1400 C: 1 magnet_ring, 2 copper_coil,
   1 battery, 1 iron_plate" uses `magnet_ring`, which is Atomic (`age: 3`, `forge(4, ...)` at 2800 C). This spec uses
   `forge(3, 'electromagnet', '3 copper_coil, 2 iron_plate, 1 battery, 1 circuit', 1400)`. Please update the T4 row.
2. **Metal rule (SYSTEMS 5.2).** The substring list would pull coal/sulfur/quartz ore, pressure plates, signal wire and ingot
   moulds and miss coils, cogs and rods. This spec uses `isMetalItem` (first word a metal, or last word ingot/nugget/bloom, or
   a tool of tier >= 2; never a `cools` item). Please reword 5.2's parenthesis to "metal items (`isMetalItem`, Unit 14)".
3. **Hook members.** Two OPTIONAL members are added to Unit 0's `fluidBlock` shape: `offer?` and `room?` (mirroring
   `FluidEndpoint`), and the shape is exported as `FluidBlockHook`. `WorkshopView` gains optional `pours?`. Please note them
   in SYSTEMS 6.5.
4. **Sounds.** SYSTEMS T9 lists `spout_pour` for this unit; this spec also adds `magnet_hum` (the magnet needs its own voice;
   reusing the pump's `steam_hiss` would be wrong). Units 13, 14 and 16 all create/append `src/audio/sfxWorkshop.ts` and bump
   the `sfx.test.ts` count: whichever merges second rebases onto the first's file.
5. **Side goal (optional).** If the owner wants one: `fill_from_spout` "Bottle by the pipe" (a spout fills 4 containers) -
   not specced here; T7 lists none for Unit 14.
6. **Speed vs today.** The existing tank spout moves 1000 L per second (`SPOUT_S` 1). The canon 250 L/s makes the tank spout
   four times slower per can but continuous and readable; the basin spout is unchanged. Flag it in the release notes.
7. **Merge overlaps.** `logistics.ts` (Units 15, 16 also touch `accept`/`take`: 16's padlock rule in `take` does not affect
   spouts/drains, which use neither); `src/app/game.ts` hook block (Units 0, 13, 17 add hooks next to it); `collectors.ts` and
   `controller.ts:171` are touched only by this unit. `transportActions.ts` is NOT touched by this unit (Unit 7 owns the
   `bucketUse` container fallback this spec relies on for the old path).
8. **Unit 4 dependency is soft.** `isHot` is used if Unit 4 merged; otherwise the inline `cools` test (same meaning).
