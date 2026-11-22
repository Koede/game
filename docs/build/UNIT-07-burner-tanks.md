# Unit 7 - Ground burner and tank fluids (build spec)

Status: design spec, 2026-11-22. Written against `docs/build/SYSTEMS.md` (binding). Where this file and SYSTEMS.md
disagree, SYSTEMS.md wins; section 14 lists the two places this spec asks the coordinator to amend it.

**Threads:** T1 (defines `BURNER_FUELS`, `BURNER_IDLE_W`, `BURNER_STOCK`; reads `FuelSpec`, `BOIL_J_PER_L`, `BOIL_LPS`,
`GLASS_MAX_C`, `FUEL_GRADES`), T3 (defines `tankFluids()`, the container fallback in `bucketUse`, receiver -> pipe -> tank
end to end; reads `FLUID_SPECS`, `CHEM_CONTAINERS`, `filledWith`, `nameOf`/`expand`), T8 (new crosshair lines of the
Still Base and the refusals), T9 (reuses `ignite`, `fuel_add`, `fire_out`; amber lamp + flame motes), T10 (two optional
fields on the still base entity, sanitised; no change to tank saves). T4: this unit adds **no new item**; it gives an
existing dead-end intermediate (`kerosene_canister`) its first consumer and a second consumer to `fuel_ethanol_beaker`,
`charcoal` and `coal`.

Ids used verbatim from SYSTEMS.md section 6.2: `BURNER_FUELS`, `tankFluids()`, receiver->tank. Consumers of this unit:
8 (`lube_base`, `lubricant` flow into tanks), 10 (spirit and tinctures in tanks), 11 (refinery products into tanks).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

**The fantasy.** You have walked two hundred blocks to the oil pool in the dunes. Your furnace is at home. You set a
Still Base on the sand, a Boiling Flask on it, three column segments and their condensers, pour in a canister of crude -
and feed the base a canister of kerosene you refined last week. A little blue-orange fire licks under the glass, the lamp
goes amber, and the column starts to band: gasoline, kerosene, diesel. The far-field still runs on its own product. When
it ends, the receivers drain through a Chemistry Port into a tank by the pumpjack, and nothing has to be bottled by hand.

At the other end of the ladder, an Ember player with a pot still and no furnace to spare drops two lumps of charcoal into
a base at the edge of the pine wood, boils sap into syrup at 130 C, and learns the lesson T1 teaches everywhere: *an open
fire is gentler than a furnace*. Charcoal holds 250 C, coal 280 C, fuel ethanol 300 C, kerosene 350 C - always below the
glass limit (450 C), and only kerosene is hot enough for crude.

**What this unit builds.**
1. **Ground burner.** A `still_base` that is not standing on a furnace (or a hearth shell block) burns a fuel item put in
   it with Use. Four fuels, one table (`BURNER_FUELS` in `src/core/distill.ts`). The base holds its flask at
   `min(setC, fuelCap)`; the fuel's joules are spent by the boil draw (`BOIL_J_PER_L` per litre, 8 kW at full boil) or by
   embers (`BURNER_IDLE_W` 500 W) while nothing boils. Beakers and canisters come back empty.
2. **One accept list.** `tankFluids()` (every registered fluid) replaces the hand-written lists on the tank, and the
   Chemistry Port's accept list becomes `tankFluids().filter(isChemFluid)` (every fluid the mixture model has a grade for). Tanks therefore take spirit, syrup, slop,
   kerosene, and every fluid later units register (Unit 0's `lube_base`, `lubricant`) with no edit.
3. **Containers on tanks by hand.** A full canister of any fluid (today only buckets work, see 3.6) and a full or empty
   beaker (250 L) pour into / take from a tank with Use, through the existing `bucketUse`, by adding a `CHEM_CONTAINERS`
   fallback (T3 rule 3: containers are tables).
4. **Receiver -> pipe -> tank end to end**, proven by unit test and by the e2e: a Chemistry Port beside a receiver, its
   pipe end set to Pull, a fluid pipe to a tank. The port's filter picks the grade (T3 rule 2).

**What it is not.** No new block, no new item, no new screen, no new sound name. The burner is a second heat source for
an existing block, the accept list is a deletion, the container fallback is a table read.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Provided (other units may rely on these after merge)

| id | where | signature / shape | consumers |
|---|---|---|---|
| `BURNER_FUELS` | `src/core/distill.ts` (NEW) | `Readonly<Record<string, BurnerFuel>>`, keyed by item key | 11 (may read for the steel-flask note "a burner cannot exceed 350 C"), 12 (balance pass, Codex text) |
| `BurnerFuel` | `src/core/distill.ts` (NEW) | `{ capC: number; energyJ: number; empty: string \| null }` | - |
| `burnerFuel(item)` | `src/core/distill.ts` (NEW) | `(item: string) => BurnerFuel \| null` | `distillActions.ts`, `slotViews.ts` |
| `BURNER_IDLE_W` | `src/core/distill.ts` (NEW) | `500` (W) | - |
| `BURNER_STOCK` | `src/core/distill.ts` (NEW) | `4` (items of one fuel a base holds) | - |
| `BURNER_MAX_C` | `src/core/distill.ts` (NEW) | `350` = max of `capC` (test-asserted) | 11 (steel flask doc: "a burner cannot exceed 350 C") |
| `tankFluids()` | `src/content/fluids.ts` (NEW) | `() => FluidKey[]` - every key of `FLUID_SPECS`, authored order | `techMachines.ts` (tank), `machinesDistill.ts` (port), any unit's new fluid endpoint |
| `isChemFluid` (exists) | `src/core/chem.ts` line 225 | `(fluid: string) => boolean` - has a grade, or is slop | `machinesDistill.ts` (port list = `tankFluids().filter(isChemFluid)`) |
| `isFluidContainer(key)` | `src/core/registry.ts` (NEW) | `(key: string) => boolean` - a bucket (full/empty, from `FLUIDS`) or a `CHEM_CONTAINERS` item (full/empty) | `src/player/pipeTools.ts` |
| `ChemEntity.fuel?`, `fuelJ?`, `burnW?` | `src/sim/distill.ts` | optional fields on the still base entity (section 7) | render (`distillFx`), view |
| `Distillery.burning(base)` | `src/sim/distill.ts` (NEW) | `(e: ChemEntity) => boolean` - on the ground and `fuelJ > 0` | `distillActions.ts`, render |
| `Distillery.onFurnace(base)` | `src/sim/distill.ts` (NEW) | `(e: ChemEntity) => boolean` - `host.furnaceUnder(x, y-1, z) !== null` | `distillActions.ts` |

### 2.2 Consumed (exists today, or from Unit 0)

| id | from | how used |
|---|---|---|
| `FuelSpec.energyJ` of `charcoal` (400 000 J) and `coal` (800 000 J) | `src/content/items.ts` lines 72-73 | `BURNER_FUELS` copies the numbers; a test asserts they stay equal |
| `BOIL_J_PER_L` 400, `BOIL_LPS` 20, `GLASS_MAX_C` 450, `STILL_SETPOINTS`, `STILL_DEFAULT_C` 97 | `src/core/distill.ts` | burn draw; caps; setpoint cycling |
| `CHEM_CONTAINERS`, `filledWith`, `EMPTY_BEAKER`, `EMPTY_CANISTER` | `src/core/distill.ts` | container returns; tank fallback |
| `FLUID_SPECS` | `src/content/fluids.ts` | `tankFluids()` source (includes Unit 0's two oil fluids once merged, through `DISTILL_FLUIDS`) |
| `chemPortEndpoint` | `src/sim/distillActions.ts` line 141 | unchanged; the receiver outlet already offers `nameOf(outlet.mix)` |
| `tankStackEndpoint`, `TAKES` | `src/sim/tanks.ts` lines 15, 83 | `TAKES` is built from `TANK.fluids.accepts`, so changing the content list is the fix |
| `takes(ep, key)` | `src/sim/fluidNet.ts` (last line) | reads `MACHINES...accepts`; becomes true for every fluid at a tank |
| `bucketUse` | `src/sim/transportActions.ts` | gains the `CHEM_CONTAINERS` fallback |
| `PipeTools.use` | `src/player/pipeTools.ts` lines 66-74 | widened from `BUCKETS.has(held)` to `isFluidContainer(held)` |
| `setPort(x, y, z, dir, { mode: 'pull' })` | `Simulation.setPort` (`src/sim/simulation.ts` line 730) | e2e set-up only |
| Unit 0: `lube_base`, `lubricant` in `DISTILL_FLUIDS` | Unit 0 | appear in `tankFluids()` automatically; a test asserts it if they exist |
| Unit 6 rig screen | Unit 6 | reads `chemView` text; the new base lines show there unchanged |
| Unit 12 `still_bubble` boil ambience | Unit 12 | counts boiling flasks; a burner flask boils like any other, nothing to do |

### 2.3 Not touched (guards for parallel units)

`FUEL_GRADES` (engines) is not changed: kerosene stays refused by the chainsaw and tractor (`fuelGrade` returns null);
its fuel row is `BURNER_FUELS` (T1 rule 2 satisfied). `src/content/progression.ts` `chemReady` is not changed (section 13).
`STILL_SETPOINTS` is not changed (Unit 11 appends 480 and 560 for steel flasks; this unit never offers them).

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (verified 2026-11-22)

### 3.1 The still base and its heat

- `src/core/distill.ts`: `CHEM.base = 'still_base'`; `STILL_SETPOINTS = [78, 92, 97, 130, 200, 260, 350, 420]`;
  `STILL_DEFAULT_C = 97`; `GLASS_MAX_C = 450`; `BOIL_LPS = 20`; `BOIL_J_PER_L = 400`; `CHEM_STEP_HZ = 4`. No burner code.
  `FUEL_GRADES` has `fuel_canister`, `gasoline_canister`, `diesel_canister`, `fuel_ethanol_beaker` - no kerosene row.
- `src/sim/distill.ts`:
  - `ChemEntity` (line 32) - `kind, mix, state, setC?, ran?, recvS?, flow?, band?, tempC?`.
  - `track(stored)` (line 111) sanitises loaded entities (setC must be one of `STILL_SETPOINTS`).
  - `baseTemp(base)` (line 192): `host.furnaceUnder(base.x, base.y - 1, base.z)`; null when none or cold
    (`f.tempC <= AMBIENT_TEMP_C + 1`); else `Math.min(setC, f.tempC, GLASS_MAX_C)`. **This is the one function that
    decides a base's heat.**
  - `stepStill` (line 217): computes `ts = this.baseTemp(base)`; when `ts === null` and the flask has `ran`, the flask goes
    `blocked` (line 229); at the end (line 307-308) `f.extractW += (moved / dt) * BOIL_J_PER_L` - with a non-null
    assertion on `base!` (safe today because `ts !== null` implies a base).
  - `show()` (line 367): the base's state is `working` only while its flask is `working` (line 388-390).
  - `announce()` (line 409): `machine_done` + toast on run done; `pipe_clunk` on blocked.
- `src/sim/distillActions.ts`:
  - `chemUse` (line 34): empty hand on a base cycles `STILL_SETPOINTS` and toasts `Still Base set to ${e.setC} C`; a
    `CHEM_CONTAINERS` item pours into flask/vessel/receiver/jacket; an empty container takes out; anything else returns
    `null` (so a lump of charcoal on a base today does nothing and the tap carries on).
  - `chemView` (line 86), base case (line 100-105):
    `` `${name} - set ${e.setC} C, ${t === null ? 'no hot furnace under it' : `holding ${Math.round(t)} C`}${still ? '' : ', no flask on it'}` ``.
  - `litresText` (line 28) - `<n> L` / `<x.x> buckets`, matches T8.
- `src/content/blocksDistill.ts` `LOOKS.still_base` (line 22): name "Still Base", age 0, glow 6, desc "A copper burner
  plate. Set it on a furnace and a flask on it; tap it to choose the temperature it holds the flask at."
- `src/content/machinesDistill.ts` `DESC.still_base` (line 11): "Holds the flask on it at the set temperature with the
  heat of the furnace below."
- Recipe (from `specRosterDistill.ts` line 57): `still_base: 1 still_base <- 2 copper_ingot, 2 firebrick @700 T1` - Ember.
- `src/render/textures/distill.ts` `EMBLEMS.still_base(c, lit)` (line 72) already draws a row of flames when `lit`
  (the active-bit texture `chem_still_base_on`). `src/render/distill/distillFx.ts` draws bubbles and drips in a
  `MOTION_MAX` 768 instanced mesh rebuilt every 0.25 s; it has no flame motes.

### 3.2 Fuels

- `src/content/items.ts` line 72: `coal` - `fuel(800, 100, 1250)` (kJ, s, C); line 73: `charcoal` - `fuel(400, 80, 1000)`.
- `src/content/itemsDistill.ts`: `fuel_ethanol_beaker` (age 1, stack 16), "Nearly pure alcohol from a column still. It burns
  clean: a weak fuel for the chainsaw and the tractor."; `kerosene_canister` (age 1, stack 8), "Pale kerosene, the middle
  cut of crude oil. Lamp and heater fuel to come." - the dead end T1 calls a bug.

### 3.3 Tanks

- `src/content/techMachines.ts` line 25-29: tank `fluids: { accepts: ['water', 'lava', 'steam', 'crude_oil', 'fuel'],
  gives: [same], capacityL: 16_000 }`.
- `src/sim/tanks.ts` line 15: `const TAKES = new Set<FluidKey>(TANK.fluids?.accepts ?? [])`; `room()` returns 0 for any
  fluid not in `TAKES`. Stacks share one fluid (`tankColumn`), fill bottom up (`level`).
- `src/content/specRosterTech.ts` line 53 pins the tank's lists: `tank: [['water', 'lava', 'steam', 'crude_oil', 'fuel'], [...], 16_000]`.
- `src/sim/sanitize.ts` `cleanFluid` (line 32) accepts any `fluidOrNull` key: tank saves of new fluids load already.

### 3.4 The Chemistry Port

- `src/content/machinesDistill.ts` line 24: `PORT_ACCEPTS = ['water', 'crude_oil', ...distillFluids]`, gives
  `['water', ...distillFluids]` - a hand-written list (anti-pattern 6d #2).
- `chemPortEndpoint` (`distillActions.ts` line 141): beside a receiver it is an outlet - `offer()` returns
  `{ fluid: nameOf(outlet.mix), litres: total(outlet.mix) }`, `drain()` pours out only while the name matches. Beside a flask
  or vessel it is an inlet (`fill` expands the grade; refuses steam/lava).
- `pipeState.ts` `defaultMode` (line 88): a block that both accepts and gives starts as **push**, so the pipe end at a port
  must be wrenched to **Pull** to drain a receiver. This stays (a port beside a flask must push).

### 3.5 What already works end to end, and what breaks

Receiver -> port (pull) -> pipe -> tank: the network pulls `low_wines` from the port, then `push()` asks the tank's
`room('low_wines')` -> 0 (not in `TAKES`) -> port state `refuses`, pull end `no_dest`. **The only blocker is the tank's
accept list.** Crude oil and refined fuel already flow.

### 3.6 Two hand-path bugs found while researching

1. `src/player/buckets.ts` line 37: `BUCKETS = {'pail', 'water_pail', 'bronze_bucket', 'lava_bucket', 'empty_canister'}`.
   `PipeTools.use` (line 72) only routes `BUCKETS` items to `bucketUse`, so a **full** canister (`crude_canister`,
   `kerosene_canister`, ...) used on a tank does nothing (the tank screen opens), although `bucketUse` itself supports it
   (`fluidInBucket`). Docs/api/distillery.md claims "tanks ... handle canisters like buckets". This unit fixes it because
   it is the hand half of "tanks take every fluid".
2. Beaker fluids (`sap`, `syrup`, `sugar_wash`, `low_wines`, `spirit`, `fuel_ethanol`) have no `FluidSpec.bucket`, so once a
   tank holds spirit nothing can take it out by hand. The `CHEM_CONTAINERS` fallback fixes it.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 No new ids

| kind | new ids |
|---|---|
| blocks | none (`still_base` gains behaviour) |
| items | none |
| recipes | none (`still_base` recipe unchanged: 2 Copper Ingot + 2 Firebrick, furnace 700 C, tier 1) |
| fluids | none |
| sfx | none (reuses `ignite`, `fuel_add`, `fire_out`, `pipe_clunk`) |
| flags | `burner_lit` (NEW, past-tense rule: set with `flagOnce` the first time a ground burner is lit) |
| events | none (toasts and sfx through the bus as the distillery already does) |

Age and gate (T7 table: "ground burner ... ember"): the burner is behaviour of an Ember block, so it is open from the
first Clay Furnace. Each fuel is gated by its own item's age: charcoal and coal are `age: 0` (`ageIndexOf('ember')`);
`fuel_ethanol_beaker` and `kerosene_canister` are `age: 1` (`ageIndexOf('forge')`) - the column and canisters are Forge.
Nothing new to gate; no literal age numbers are written by this unit.

### 4.2 `BURNER_FUELS` (the T1 table, numbers from SYSTEMS.md section 5.1)

```ts
// src/core/distill.ts (NEW, after FUEL_GRADES)
/** One fuel a Still Base burns on the ground (T1): the most it lets through, the heat in one item, the empty it returns. */
export interface BurnerFuel {
  /** The base holds its flask at min(setting, capC). Always below GLASS_MAX_C. */
  capC: number;
  /** Joules in one item: spent at the boil draw (BOIL_J_PER_L per litre boiled) or BURNER_IDLE_W while nothing boils. */
  energyJ: number;
  /** Handed back when the item is put in (the beaker or canister), or null when the fuel is eaten whole. */
  empty: string | null;
}
export const BURNER_FUELS: Readonly<Record<string, BurnerFuel>> = {
  charcoal: { capC: 250, energyJ: 400_000, empty: null },
  coal: { capC: 280, energyJ: 800_000, empty: null },
  fuel_ethanol_beaker: { capC: 300, energyJ: 320_000, empty: EMPTY_BEAKER },
  kerosene_canister: { capC: 350, energyJ: 2_400_000, empty: EMPTY_CANISTER },
};
export const burnerFuel = (item: string): BurnerFuel | null => BURNER_FUELS[item] ?? null;
/** Embers: what a lit ground burner burns while its flask is not boiling (W). */
export const BURNER_IDLE_W = 500;
/** Most items of one fuel a Still Base holds at once. */
export const BURNER_STOCK = 4;
/** The hottest any ground burner gets (the kerosene cap). */
export const BURNER_MAX_C = 350;
```

Reasoning, row by row (T1 table; full boil = `BOIL_LPS` 20 L/s x `BOIL_J_PER_L` 400 J/L = 8 kW):

| fuel | cap | J per item | boil time at 8 kW | idle time at 500 W | why this number |
|---|---|---|---|---|---|
| Charcoal | 250 C | 400 000 (= its `FuelSpec.energyJ`) | 50 s | 13.3 min | covers every Ember card: syrup 130 C, wash 97 C, low wines 97 C, spirit 92 C; 260 C setpoint is just out of reach (honest "the fire is too weak") |
| Coal | 280 C | 800 000 (= `FuelSpec.energyJ`) | 100 s | 26.7 min | same band, twice as long; reaches the 260 C setpoint |
| Fuel Ethanol beaker | 300 C | 320 000 (250 L x 1280 J/L, a weak fuel - consistent with `FUEL_GRADES` 0.25 saw) | 40 s | 10.7 min | the still feeds itself; beaker back |
| Kerosene canister | 350 C | 2 400 000 | 300 s | 80 min | the first fuel that reaches the crude setpoint (350); a canister runs a full 4000 L crude flask (crude card: 260 s for 8 canisters) with margin; canister back |

Ordering is strictly increasing in cap and every cap is `< GLASS_MAX_C` (450) - T1 rule 1. The 350 setpoint on a kerosene
fire boils crude exactly like a furnace at >= 350 C, so `refine_crude` runs in the field unchanged.

### 4.3 Where the burner lives (rules of the block)

A `still_base` is **on a furnace** when `host.furnaceUnder(x, y - 1, z)` returns an entity (a furnace node, or a formed
hearth's shell block - the existing `Simulation.furnaceUnder`, line 427). Otherwise it is **on the ground** (any block,
including air: a base hanging off a wall works - no placement rule is added; the description says "on the ground").

| situation | heat source | `baseTemp` |
|---|---|---|
| on a furnace, furnace hot | furnace (unchanged) | `min(setC, f.tempC, GLASS_MAX_C)` |
| on a furnace, furnace cold | none (unchanged) | null |
| on the ground, `fuelJ > 0` and `fuel` known | burner | `min(setC, BURNER_FUELS[fuel].capC)` |
| on the ground, no fuel | none | null |

The furnace always wins: fuel left in a base that then has a furnace placed under it waits, unburned, and burns again
if the furnace is removed. (No per-tick fuel movement between the two; nothing is lost.)

The burner has no warm-up: an open fire is at its cap at once (the furnace has inertia because it is a mass of clay; a
burner plate does not). The flask still climbs at the boil rule (`flask.tempC = min(ts, bubblePoint)`).

### 4.4 Feeding the burner (Use with a fuel item)

`chemUse(d, x, y, z, held)` on a base with `burnerFuel(held) !== null`:

1. On a furnace -> refuse: `"This Still Base sits on a furnace - feed the furnace instead"`.
2. Burning another fuel (`e.fuel !== held && e.fuelJ > 0`) -> refuse:
   `"The Still Base is burning Charcoal - let it burn down first"` (fuel name = `item(e.fuel).name`).
3. Full (`fuelJ + energyJ > BURNER_STOCK * energyJ + 1`) -> refuse: `"The Still Base holds 4 Charcoal at most"`.
4. Else: `e.fuel = held; e.fuelJ = (e.fuelJ ?? 0) + energyJ;` result `{ ok: true, consume: true, give: empty ?? undefined, toast }`.
   - first light (fuelJ was 0): toast `"Charcoal lit - the flask holds up to 250 C"`, sfx `ignite` at the base,
     `host.flagOnce('burner_lit')`.
   - added to a lit fire: toast `"Charcoal added - 1.7 min of boiling"` (time = `fuelJ / 8000` W formatted, section 6.2),
     sfx `fuel_add`.

The sfx are emitted from `chemUse` through a new public `Distillery.sound(name: SfxName, e: ChemEntity, volume?: number)` helper (it already holds `bus`), not from
the player module, so the deployer/arm/golem path (Unit 0 `offerItem`, Unit 17) gets them too. Note: `chemUse` mutates
the entity and the player module applies `consume`/`give` exactly as for containers (`BrewTools.apply`), so the empty
beaker/canister lands in the slot the fuel came from (existing behaviour for pours).

Refusal 2 is deliberate: one fuel at a time keeps one cap and one line; the toast says how to fix it. (Rejected:
mixing caps by joules - a cap that changes mid-run as fuels interleave is unreadable.)

### 4.5 Burning (the sim)

Per chemistry step (4 Hz), for every rig:

1. `stepStill` as today. At its end, the heat bill goes to the source:
   ```ts
   const f = this.host.furnaceUnder(base.x, base.y - 1, base.z);
   const boilW = (moved / dt) * BOIL_J_PER_L;
   if (f) f.extractW += boilW;
   else this.burn(base, boilW, dt);   // NEW
   fired.add(still.base);             // NEW: this base paid this step
   ```
2. After all stills, for every module of kind `still_base` in the rig that is `burning()` and not in `fired`:
   `this.burn(e, BURNER_IDLE_W, dt)` (embers; a lone base with no flask is a rig of one module and idles too).
3. `burn(e, watts, dt)`:
   ```ts
   private burn(e: ChemEntity, watts: number, dt: number): void {
     const w = Math.max(watts, BURNER_IDLE_W);
     e.burnW = w;
     e.fuelJ = Math.max(0, (e.fuelJ ?? 0) - w * dt);
     if (e.fuelJ > 0) return;
     const wasBoiling = watts > BURNER_IDLE_W;
     delete e.fuel; delete e.fuelJ; delete e.burnW;
     this.sound('fire_out', e);
     if (wasBoiling) this.bus.emit('toast', { text: 'The Still Base fire went out - add more fuel', kind: 'warn' });
   }
   ```
   The last step may boil up to `0.25 s x 8 kW = 2 kJ` more than the fuel held (the step boils before it bills). That is
   0.5 % of a charcoal lump and is accepted; litres stay exactly conserved (only joules round).
4. `show()`: the base is `working` when its flask is working **or** `this.burning(e)` (lit embers glow amber; the
   existing `lightActive: 6` makes a lit field burner a night light). Unchanged for bases on furnaces.

### 4.6 The fire runs out mid-run; a run that is done

- Fuel runs out while the flask boils: next step `ts === null`, `flask.ran` -> existing rule makes the flask `blocked`
  (red lamp, `pipe_clunk`), its line says "stopped", the base line says "no fire - Use charcoal or coal on it". Feeding the
  base resumes the run on the next step (flask -> `working`). Same experience as a furnace going cold.
- **Change (small, deliberate):** a flask whose state is already `done` stays `done` when its heat goes (furnace cools or
  embers die). Today a finished pot still on a burner would flip green -> red with a clunk 13 minutes later when the
  embers die, which reads as a fault. In `stepStill`, the `ts === null` branch becomes:
  `flask.state = total <= 0 ? 'idle' : flask.ran ? (ts === null ? (flask.state === 'done' ? 'done' : 'blocked') : 'done') : ...`.
  Applies to furnaces too (a finished run on a furnace you let go out stays green). Existing tests must stay green; if one
  pins the old flip, update it and say so in the PR.

### 4.7 Setpoints on a burner

Empty-hand Use still cycles all of `STILL_SETPOINTS`. The toast tells the truth about the cap when it binds:
- `"Still Base set to 130 C"` (cap above the setting, or on a furnace, or unlit) - unchanged.
- `"Still Base set to 350 C - the Charcoal fire holds 250 C"` when on the ground, burning, and `setC > capC`.

### 4.8 Tank fluids (`tankFluids()`)

```ts
// src/content/fluids.ts (NEW exports, after FLUID_SPECS)
/** Every fluid a tank (and any other store of "one fluid at a time") takes: all of them (T3, one accept list). */
export const tankFluids = (): FluidKey[] => FLUID_SPECS.map((f) => f.key);
```
Defined in content (not the registry) because `techMachines.ts` is content evaluated before the registry exists; content
already imports content (`fluids.ts` imports `fluidsDistill.ts`), so there is no cycle.

- `techMachines.ts` tank: `fluids: { accepts: tankFluids(), gives: tankFluids(), capacityL: 16_000 }`. Desc unchanged
  ("Holds 16 000 litres of any one fluid. ...") - it is now literally true.
- `machinesDistill.ts`: `PORT_ACCEPTS = tankFluids().filter(isChemFluid)` for both `accepts` and `gives`. That is exactly
  today's accepts list (water, crude oil, the distillery grades, slop) but derived, so Unit 0's `lube_base`/`lubricant`
  (which get grades) join by themselves. Refined Fuel (`fuel`) stays out: it has no grade, and `expand('fuel', L)` would
  turn it into slop (`SLOP_MIX`, `chem.ts` line 218) - glassware must not silently ruin a fluid. Gives gains `crude_oil`
  (a receiver can hold a crude-named mix), which is harmless and truthful.
- Pumps keep their own `gives` (they draw from the world). Boiler, turbine, fluid hatch keep their specific lists (they
  take only what they use). Hot fluids still need a hot pipe (`pipeCarries`, `FluidNet.carries`) - unchanged.

### 4.9 Containers on tanks (`bucketUse` fallback)

`bucketUse(t, x, y, z, face, held)` keeps its bucket path first (`fluidInBucket`, `bucketFilledWith`), then falls back to
`CHEM_CONTAINERS`:

- Full container, no `FluidSpec.bucket` for it (`syrup_beaker`, `spirit_beaker`, `fuel_ethanol_beaker`, ...): litres =
  `CHEM_CONTAINERS[held].litres` (250). Needs `ep.room(fluid) >= litres`. Pours, returns the empty (`glass_beaker`).
- Empty container that is not a bucket for the offered fluid: `into = filledWith(held, offer.fluid)`; needs
  `offer.litres >= CHEM_CONTAINERS[into].litres`; drains that many; returns `into`.
- `glass_vial` is **not** aliased here (T3 rule 4: vials are reserved; `chemUse` keeps its own alias for glassware).

Refusals reuse the existing sentences with the container's litres:
`"The Tank holds low wines"` (other fluid), `"The Tank is full"`, `"Not enough room for a beakerful"` (NEW wording for
250 L), `"A Glass Beaker cannot carry crude oil - try an Empty Canister"` (NEW), `"A Glass Beaker takes 250 L - it holds
120 L"` (same shape as the bucket line).

`PipeTools.use` (player) routes `isFluidContainer(held)` (NEW registry helper) instead of `BUCKETS.has(held)` for fluid
endpoints and for "do not open the pipe screen when holding a container" (line 69). `BUCKETS` itself stays as is - it
drives world scooping (`SCOOPING_BUCKETS`, `Buckets.use`), which this unit does not change.

**Order of Use is unchanged:** chem blocks (including the Chemistry Port) are handled by `BrewTools` first, so a beaker on
a port still gets the distillery's own answer; tanks never have a chem role, so they reach `PipeTools`.

### 4.10 Receiver -> pipe -> tank (end to end)

Nothing new in code beyond 4.8; this unit makes it a documented, tested path:

1. Receiver (any: a head, a side cut) with a Chemistry Port touching it (any face).
2. Fluid pipe from the port to a tank (any distance, normal pipe rules). Wrench the pipe end at the port to **Pull**
   (it starts as push because a port both takes and gives - the pipe screen's end row says "Push"; one wrench tap).
3. The network pulls the receiver's named grade (`nameOf`) at the pipe's rate and pushes it into the tank stack.
4. **Grade filter:** the port end's filter (pipe screen, existing: allow list) decides which grades leave. With "allow:
   Spirit" the heads (named `slop` or `low_wines` while the cut is impure) stay in the receiver and the port end reads
   "Filtered"; only Spirit reaches the tank. This is the T3 "outlet for named grades".
5. When the tank is full or holds another fluid: the push end reads "Full" (existing `full` state), the pull end
   "Destination full" (`dest_full`); the receiver keeps collecting until it is full; then the still goes `blocked` (red)
   by the existing receiver-full rule. Emptying the tank (pipe or containers) resumes everything with no player action.
6. When the receiver's grade changes mid-run (spirit -> slop at the tail), the network holds the old grade until it
   drains; the port end reads "Other fluid" meanwhile (`other_fluid`), then the new grade flows if the tank and filter
   take it. Nothing is ever mixed in a tank: a tank holds one named fluid (`tankColumn`), as today.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules, with edge cases

| # | case | rule | player sees |
|---|---|---|---|
| 1 | Charcoal on a ground base, empty | lit, 400 kJ, cap 250 | toast `Charcoal lit - the flask holds up to 250 C`, `ignite`, lamp amber, flames on the emblem, motes |
| 2 | Second charcoal | +400 kJ (max 4 items = 1.6 MJ) | toast `Charcoal added - 1.7 min of boiling`, `fuel_add` |
| 3 | Fifth charcoal | refused, nothing consumed | `The Still Base holds 4 Charcoal at most` |
| 4 | Coal on a charcoal fire | refused | `The Still Base is burning Charcoal - let it burn down first` |
| 5 | Any fuel on a base on a furnace (hot or cold) | refused | `This Still Base sits on a furnace - feed the furnace instead` |
| 6 | Kerosene canister | lit, 2.4 MJ, cap 350, `empty_canister` handed back in the same slot | toast `Kerosene lit - the flask holds up to 350 C` |
| 7 | Fuel Ethanol beaker | lit, 320 kJ, cap 300, `glass_beaker` back | toast `Fuel Ethanol lit - the flask holds up to 300 C` |
| 8 | Base lit, no flask | embers 500 W | `Still Base - Charcoal embers, set 97 C, no flask on it` |
| 9 | Flask boiling | fuel at the boil draw (8 kW full, less within 2 C of the bubble point; never below 500 W) | `Still Base - Charcoal fire, holding 97 C, 42 s` |
| 10 | Setpoint above the cap | holds the cap | `Still Base - Charcoal fire, holding 250 C (set 350), 42 s`; toast on setting |
| 11 | Fuel runs out mid-run | flask `blocked` (red), `fire_out` + warn toast, base dark | flask `... stopped`; base `Still Base - no fire - Use charcoal or coal on it` |
| 12 | Embers die after a finished run | flask stays `done` (green); `fire_out`, no toast | base line as 11 |
| 13 | Fuel added to a blocked flask | resumes next step | flask `working` |
| 14 | Furnace placed under a lit base | furnace wins; fuel waits unburned; base line is the furnace line | `Still Base - set 97 C, holding 97 C` |
| 15 | Base broken while lit | entity removed with its fuel (like "contents are lost with the glass", `Distillery.remove`); drops `still_base` | desc warns: "fuel in it is lost if you break it" |
| 16 | Save while lit, load | `fuel`, `fuelJ` saved in the entity JSON; sanitised (section 7) | same fire, same seconds |
| 17 | Old save (no fields) | unlit | as today |
| 18 | Rain / underwater | no effect (out of scope, 13) | - |
| 19 | Pipe from a receiver to a tank of the same fluid | flows | tank status `3,250 of 16,000 L` |
| 20 | Pipe from a receiver to a full tank | push `full`, pull `dest_full`; receiver fills; still blocks when the receiver is full | red lamp on the flask; pipe screen rows |
| 21 | Tank holds Spirit, receiver gives Slop | push end `full` (the tank takes slop in general but holds Spirit now: `room` 0, `takes` true) | pipe screen "Full"; set a filter |
| 22 | Spirit beaker on an empty tank | 250 L in, beaker back | splash, tank `250 of 16,000 L` |
| 23 | Empty beaker on a tank of spirit with 120 L | refused | `A Glass Beaker takes 250 L - it holds 120 L` |
| 24 | Kerosene canister on a tank of water | refused | `The Tank holds water` |
| 25 | Full canister on a tank (any fluid with `bucket`) | 1000 L in (fixes 3.6 bug 1) | splash |
| 26 | Lava pumped through a hot pipe into a tank | unchanged (tanks always took lava) | - |
| 27 | Workshop spout over a tank with a beaker (`fluidBlock.use` -> `bucketUse`) | now pours/takes 250 L (a side effect of 4.9; Unit 14 replaces spouts with continuous flow) | - |

Failure-message grammar (T8): full sentences, the fix in them, no exclamation marks, numbers with units, fluid names
lower case mid-sentence as `bucketUse` does today (`The Tank holds water`).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair lines (`chemView`, base case), exact templates

All under ~60 characters with realistic values; `<Fuel>` is the item's display name (`Charcoal`, `Coal`, `Fuel Ethanol`,
`Kerosene` - use `item(fuel).name` with a trailing " Canister"/" Beaker" stripped: `Kerosene Canister` -> `Kerosene`; the
beaker item's name is already `Fuel Ethanol`).

| state | template | example (chars) |
|---|---|---|
| problem on the base (rig scan) | `${name} - ${problem.text}` (unchanged) | - |
| on a furnace | unchanged: `Still Base - set 97 C, holding 97 C` / `..., no hot furnace under it` (+ `, no flask on it`) | 36 |
| ground, unlit | `Still Base - no fire - Use charcoal or coal on it` | 50 |
| ground, lit, flask boiling, setC <= cap | `Still Base - <Fuel> fire, holding <t> C, <time>` | `Still Base - Coal fire, holding 97 C, 1.7 min` (45) |
| ground, lit, flask boiling, setC > cap | `Still Base - <Fuel> fire, holding <cap> C (set <setC>), <time>` | `Still Base - Charcoal fire, holding 250 C (set 350), 42 s` (57) |
| ground, lit, not boiling | `Still Base - <Fuel> embers, set <setC> C, <time> idle` | `Still Base - Kerosene embers, set 350 C, 1.3 h idle` (51) |
| ground, lit, no flask | `Still Base - <Fuel> embers, set <setC> C, no flask on it` | `Still Base - Charcoal embers, set 97 C, no flask on it` (54) |

`<time>` = `fuelJ / max(burnW ?? BURNER_IDLE_W, BURNER_IDLE_W)` seconds, formatted by NEW `timeText(s)` in
`distillActions.ts`: `< 60` -> `${Math.round(s)} s`; `< 3600` -> `${(s / 60).toFixed(1)} min`; else
`${(s / 3600).toFixed(1)} h` (T8: "14 s", "1.5 min"; T8 has no rule above an hour, `h` is the natural extension - noted
for the coordinator). `ChemView.tempC` = the held temperature (unchanged meaning). `ChemView.secondsLeft` = `<time>` while
lit (used by Unit 6's rig screen if it wants a bar; 0 otherwise).

### 6.2 Toasts (exact)

| when | text | kind |
|---|---|---|
| first light | `<Fuel> lit - the flask holds up to <cap> C` | `good` |
| add | `<Fuel> added - <fuelJ/8000 W as timeText> of boiling` | `info` |
| setpoint above cap | `Still Base set to <setC> C - the <Fuel> fire holds <cap> C` | `info` (as today's setpoint toast) |
| fire out during a boil | `The Still Base fire went out - add more fuel` | `warn` |
| refusals | section 4.4 / 4.9 sentences (through `BrewTools.apply` -> `advise`) | as today |

### 6.3 Descriptions and tooltips (exact new text)

- `blocksDistill.ts` `LOOKS.still_base.desc`: "A copper burner plate. Set it on a furnace, or on the ground and feed it
  charcoal (250 C), coal (280 C), fuel ethanol (300 C) or kerosene (350 C). Tap it to choose the temperature it holds the
  flask at; fuel in it is lost if you break it."
- `machinesDistill.ts` `DESC.still_base`: "Holds the flask on it at the set temperature: with the heat of a furnace below,
  or on the ground by burning the fuel you put in it (charcoal 250 C up to kerosene 350 C)."
- `itemsDistill.ts` `kerosene_canister.desc`: "Pale kerosene, the middle cut of crude oil. In a Still Base on the ground it
  burns at 350 C for 5 minutes of boiling - hot enough to refine crude far from the furnace. The canister comes back."
- `itemsDistill.ts` `fuel_ethanol_beaker.desc`: "Nearly pure alcohol from a column still. It burns clean: 300 C in a Still
  Base on the ground, and a weak fuel for the chainsaw and the tractor."
- `src/content/blocksTech.ts` line 44, `fluid_pipe` desc (today "Carries water, crude oil and fuel, 200 litres a second
  through each end. Lava and steam are too hot for it."): "Carries any cold fluid - water, oil, fuels, spirit, syrup - 200
  litres a second through each end. Lava and steam are too hot for it." (keep the existing rate wording if the number
  there differs). Pipes and ports are Forge (age 1), so the receiver -> tank path is a Forge convenience; Ember players
  bottle by hand.
- Charcoal and coal descs in `items.ts` are NOT edited (shared file, already long); instead the inventory tooltip
  (`src/ui/screens/inventory/slotViews.ts` `itemCard`) gains one row for every `burnerFuel(item)`:
  `['Still burner', `${formatTemp(capC)}, ${formatDuration(energyJ / 8000)} boiling`]` - e.g. `Still burner | 250 °C, 50 s
  boiling`; kerosene `350 °C, 5 m 00 s boiling`. Screens use `°C` and `formatDuration` (T8).

### 6.4 Phone layout

No new screen, button or chip. Every action is Use with an item or an empty hand (44 px hotbar slots, existing). The
crosshair lines fit 60 characters (6.1). The tank's machine screen is unchanged (its stack row already says "Empty - holds
any one fluid"). The pipe screen's port row (filter, mode) is unchanged and already phone-tested. Checked at 390 px
portrait and 844 x 390 landscape in the e2e screenshot of the lit burner (section 10, `--device=phonePortrait`).

### 6.5 Sound (T9)

Only state changes: `ignite` (normal 1.0) at first light; `fuel_add` (small 0.6) when adding; `fire_out` (small 0.6) when
the fuel ends; `pipe_clunk` (existing) when the flask blocks. No loop is added (Unit 12's boil ambience counts boiling
flasks regardless of heat source). No new `SfxName`, so `sfx.test.ts` is untouched.

### 6.6 Visuals (T9: amber = working; particles <= 24 per emitter)

- The base's active bit is on while lit (4.5 step 4) -> the existing `chem_still_base_on` tile with its flame row, and
  `lightActive: 6`: a field burner glows at night.
- Flame motes (NEW) in `src/render/distill/distillFx.ts`: for each still base entity with `fuelJ > 0` and within
  `DISTILL_RANGE`, add motion instances to the existing motion mesh (no new draw call): **4** motes when embers
  (`burnW <= BURNER_IDLE_W`), **10** when boiling, each a 0.06-0.1 block box starting on the plate (y + 0.55) inside the
  middle 0.6 x 0.6, rising 0.35 blocks over 0.5-0.9 s, colour `0xffb040` (embers `0xd8602a`), kerosene `0x9ad0ff` tint at
  the base of the flame (first third of motes) - the blue of a kerosene flame. Same vertex-shader motion as bubbles
  (`aStart`, `aTravel`, `aTime`); respect `MOTION_MAX` (stop adding when full). `Mod` (the render's entity view) gains
  `fuelJ?`, `burnW?`, `fuel?` read straight from the entity JSON.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

```ts
// src/sim/distill.ts - ChemEntity gains (all optional; only a still base uses them)
export interface ChemEntity extends BlockEntity {
  // ...existing...
  /** Still base on the ground: the BURNER_FUELS item it burns. Absent when unlit. */
  fuel?: string;
  /** Joules left in the fire (<= BURNER_STOCK x that fuel's energyJ). Absent when unlit. */
  fuelJ?: number;
  /** Render/view hint: watts burned last step (written every step, harmless in a save). */
  burnW?: number;
}
```

Sanitising in `Distillery.track(stored)` (extends the existing base line):
```ts
if (e.kind === CHEM.base) {
  e.setC = /* existing */;
  const bf = typeof e.fuel === 'string' ? burnerFuel(e.fuel) : null;
  const j = finite(e.fuelJ, 0);
  if (!bf || !(j > 0)) { delete e.fuel; delete e.fuelJ; delete e.burnW; }
  else { e.fuelJ = Math.min(j, BURNER_STOCK * bf.energyJ); e.burnW = Math.max(BURNER_IDLE_W, finite(e.burnW, BURNER_IDLE_W)); }
} else { delete e.fuel; delete e.fuelJ; delete e.burnW; }
```

- Saved where: in the entity JSON the world already persists for chem modules (`world.setEntity`), like `setC`. No new
  `world.persist` key, no `SAVE_VERSION` change (T10 rule 3).
- Old saves: fields missing -> unlit base (T10 rule 1). A test loads a base entity with no fuel fields and one with junk
  (`fuel: 'diamond'`, `fuelJ: -5`, `fuelJ: NaN`, `fuelJ: 1e12`).
- Tanks: `fluidIn` already saved as `{ fluid, litres }` and sanitised by `cleanFluid` (`fluidOrNull`), so a tank of spirit
  saves and loads with no change. Test asserts it.
- Contraptions: chem modules are not moved by the workshop today; nothing to relocate.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npm test` green)

1. **`src/core/distill.ts`** - add `BurnerFuel`, `BURNER_FUELS`, `burnerFuel`, `BURNER_IDLE_W`, `BURNER_STOCK`,
   `BURNER_MAX_C` (4.2). Pure data, no imports beyond the file's own `EMPTY_BEAKER`/`EMPTY_CANISTER`.
2. **`src/content/fluids.ts`** - add `tankFluids()` (4.8).
3. **`src/content/techMachines.ts`** - tank `accepts: tankFluids(), gives: tankFluids()`; import from `./fluids`. Update the
   comment on line 24 ("one fluid at a time; takes every fluid there is - tankFluids()").
4. **`src/content/machinesDistill.ts`** - `const PORT_FLUIDS = tankFluids().filter(isChemFluid)` (import `isChemFluid`
   from `../core/chem`, `tankFluids` from `./fluids`); `fluids: { accepts: PORT_FLUIDS, gives: PORT_FLUIDS, capacityL: 1000 }`;
   drop the `DISTILL_FLUIDS` import if unused. Comment: "glassware takes every fluid it has a grade for (T3)".
5. **`src/content/specRosterTech.ts`** line 53 - the tank row becomes the full key list of `FLUID_SPECS` (write it out, it
   is a roster: `water, lava, steam, crude_oil, fuel, sap, syrup, sugar_wash, low_wines, spirit, fuel_ethanol, gasoline,
   kerosene, diesel, residue, slop` + Unit 0's `lube_base, lubricant` if merged first). `specRosterDistill.ts`: the port's
   fluids row if pinned.
6. **`src/core/registry.ts`** - `isFluidContainer(key)`:
   `FLUIDS.some((f) => f.bucket?.full === key || f.bucket?.empty === key) || key in CHEM_CONTAINERS || isEmptyChemContainer(key)`.
   (registry may import `core/distill.ts`: both are core.)
7. **`src/sim/transportActions.ts` `bucketUse`** - container fallback (4.9). Keep the bucket path byte-for-byte first.
   Shape: compute `const chem = !full ? CHEM_CONTAINERS[held] : undefined` (full container) and for the empty branch
   `filledWith(held, offer.fluid)`; litres from the table; existing refusal lines generalised with the container's name
   (`itemOrNull(held)?.name`) and litres. Return `{ ok: true, held: <empty or filled>, fluid, litres }`. The first-line
   guard becomes `if (!full && !isEmptyBucket(held) && !isChemish(held))` where `isChemish = held in CHEM_CONTAINERS ||
   isEmptyChemContainer(held)`.
8. **`src/player/pipeTools.ts`** - import `isFluidContainer` from core/registry; lines 69 and 72 use it instead of
   `BUCKETS.has(held)`. Update the file comment ("a bucket, canister or beaker ...").
9. **`src/sim/distill.ts`**:
   - `ChemEntity` fields (7); `track` sanitising (7).
   - `onFurnace(e)`, `burning(e)` (public), `burnerCap(e): number | null` (private).
   - `baseTemp(base)` (4.3): furnace branch unchanged; else `const cap = this.burnerCap(base); return cap === null ? null
     : Math.min(finite(base.setC, STILL_DEFAULT_C), cap);`.
   - `stepRig`: `const fired = new Set<string>()`, passed to `stepStill`; after stills, idle burn for lit bases not fired.
   - `stepStill` end (4.5 step 1) - replace the `base!` assertion with an explicit `if (base)`; the done-stays-done change (4.6).
   - `burn(e, watts, dt)` (4.5 step 3); `sound(name, e)` helper (emits `sfx` at the block centre with the right volume).
   - `show()` base case: `working` if flask working or `this.burning(e)`.
10. **`src/sim/distillActions.ts`**:
    - `chemUse`: before the `CHEM_CONTAINERS` branch, `const bf = burnerFuel(heldKey)`; if `bf && e.kind === CHEM.base`
      -> the 4.4 table. If `bf` and the module is not a base -> fall through (charcoal on a flask is not chemistry: null,
      as today). **Order matters:** `fuel_ethanol_beaker` is both a `CHEM_CONTAINERS` item and a burner fuel; on a base it
      burns (bases hold no liquid, so the pour branch would refuse anyway); on a flask it pours.
    - empty-hand setpoint toast suffix (4.7).
    - `chemView` base case (6.1); `timeText`, `fuelName(item)` helpers (module-local).
11. **`src/content/blocksDistill.ts`, `machinesDistill.ts`, `itemsDistill.ts`, `blocksTech.ts` (fluid pipe)** - text (6.3).
12. **`src/ui/screens/inventory/slotViews.ts`** - the `Still burner` row (6.3).
13. **`src/render/distill/distillFx.ts`** - flame motes (6.6).
14. **`src/sim/distillKit.ts`** - `buildRig(rig, y0 = 2, kit = makeKit(), opts: { ground?: boolean } = {})`: with
    `ground`, `B` cells place a `still_base` without a furnace under it (nothing else changes; `furnaces` stays empty).
15. Tests (9), e2e (10), docs (11).

Helpers to reuse, not rewrite: `finite`, `posKey`, `item()`/`itemOrNull()`, `litresText`, `an()`, `filledWith`,
`isEmptyChemContainer`, `fluidInBucket`, `bucketFilledWith`, `takes`, `tankColumn`/`stackContent`, `formatTemp`/`formatDuration`
(UI only), `flagOnce` (via `DistillHost`).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

### 9.1 `src/core/distill.test.ts` (NEW file, or append to the closest existing core test)

```ts
it('burner fuels sit on one ladder below the glass limit', () => {
  const caps = ['charcoal', 'coal', 'fuel_ethanol_beaker', 'kerosene_canister'].map((k) => BURNER_FUELS[k].capC);
  expect(caps).toEqual([250, 280, 300, 350]);
  expect(Math.max(...caps)).toBe(BURNER_MAX_C);
  expect(BURNER_MAX_C).toBeLessThan(GLASS_MAX_C);
});
it('burn times at a full boil match SYSTEMS T1 (50, 100, 40, 300 s)', () => {
  const fullW = BOIL_LPS * BOIL_J_PER_L; // 8000
  expect(['charcoal', 'coal', 'fuel_ethanol_beaker', 'kerosene_canister'].map((k) => BURNER_FUELS[k].energyJ / fullW)).toEqual([50, 100, 40, 300]);
});
it('containers come back: beaker and canister fuels name their empty', () => {
  expect(BURNER_FUELS.fuel_ethanol_beaker.empty).toBe(CHEM_CONTAINERS.fuel_ethanol_beaker.empty);
  expect(BURNER_FUELS.kerosene_canister.empty).toBe(CHEM_CONTAINERS.kerosene_canister.empty);
});
```

### 9.2 `src/content/content.test.ts` (or `techContent.test.ts`) additions

- `charcoal` and `coal` `BURNER_FUELS[k].energyJ === item(k).fuel!.energyJ` (the copy never drifts).
- Every key of `BURNER_FUELS` is a registered item.
- **T1 rule 2:** every fuel fluid has a row: for each of `gasoline`, `kerosene`, `diesel`, `fuel_ethanol`, its container
  item (from `CHEM_CONTAINERS`) is in `FUEL_GRADES` or `BURNER_FUELS`.
- **T3:** `machine('tank').fluids.accepts` and `.gives` equal `FLUIDS.map((f) => f.key)` (same order); if Unit 0 has merged,
  they include `lube_base` and `lubricant` (`expect(...).toEqual(expect.arrayContaining(...))` guarded by
  `fluidOrNull('lubricant')`).
- `machine('chem_port').fluids.accepts` equals `FLUIDS.map((f) => f.key).filter(isChemFluid)`; contains no hot fluid and
  not `fuel`.
- Roster: `specRosterTech.ts` tank row updated (step 5); `content.test.ts` progression still completes; `gates.test.ts`
  green.

### 9.3 `src/sim/distill.test.ts` - new `describe('ground burner', ...)`

Fixture: `const r = buildRig(POT, 2, makeKit(), { ground: true })` (POT = `'CR/F./B.'`); helpers `fill` (existing).

1. `'a base on the ground holds nothing until fed, then min(setting, the fuel cap)'`:
   unlit -> `d.baseTemp(base) === null`; `chemUse(d, ...base, 'charcoal')` -> ok, consume, no give; `baseTemp === 97`;
   `base.setC = 350` -> `baseTemp === 250`; kerosene base (fresh rig) at 350 -> 350.
2. `'it distils wash into low wines with no furnace, spending the fuel at the boil draw'`:
   fill F with 1000 L `sugar_wash`, feed 2 charcoal, run `runUntil(r, 0, () => F.state === 'done', 300)` (tempC arg is
   ignored without furnaces); expect receiver `nameOf === 'low_wines'`; expect joules spent within 1 % of
   `litresBoiled x 400 + idleSeconds x 500` - measure by summing `total(receiver.mix)` (litres boiled) and comparing to
   `800_000 - base.fuelJ` with tolerance `2_000 + 500 x idleS` (record idle steps via `burnW`).
3. `'embers burn 500 W while nothing boils, and a lone base burns too'`: one charcoal, no flask (a base alone via
   `buildRig('B', 2, kit, { ground: true })`), step 100 s -> `fuelJ === 400_000 - 50_000` (+-1 J); base state `working`,
   active bit on (`d.shows(...)`).
4. `'fuel running out mid-run blocks the flask; more fuel resumes it'`: 4000 L `sugar_wash` at the default 97 C, one
   `fuel_ethanol_beaker` (320 kJ = 40 s of full boil, less than the run needs) -> step until `base.fuel === undefined` ->
   flask `blocked` and `ran`; the bus spy saw `sfx fire_out` once and `toast { text: 'The Still Base fire went out - add
   more fuel', kind: 'warn' }` once; feed 1 charcoal -> after one `distill.step(0.25)` the flask is `working`.
5. `'a finished run stays done when the embers die'`: run to `done`, keep stepping until unlit -> flask still `done`
   (and the same with a furnace cooled to ambient - update any older test pinning the flip, say so in the PR).
6. `'refusals: on a furnace, another fuel burning, the stock full'` (exact strings from 4.4); nothing consumed, entity
   unchanged.
7. `'beaker and canister fuels hand their empty back'`: `fuel_ethanol_beaker` -> `give: 'glass_beaker'`;
   `kerosene_canister` -> `give: 'empty_canister'`. A `fuel_ethanol_beaker` on a flask still pours (`toast` contains
   "poured in").
8. `'a furnace under a lit base wins; the fuel waits'`: lit base, then a furnace at y-1 (kit furnace) at 900 C -> step ->
   `fuelJ` unchanged, `f.extractW > 0`.
9. `'crosshair lines'` - exact strings for: unlit (`Still Base - no fire - Use charcoal or coal on it`), boiling under the
   cap, capped (`(set 350)`), embers with flask, embers without flask; each `length <= 60`.
10. `'setpoint toast tells the cap'`: lit charcoal, empty-hand taps to 350 -> toast
    `Still Base set to 350 C - the Charcoal fire holds 250 C`.
11. Save: `'a lit base saves and loads with the same fire; junk and missing fields load unlit'` - `JSON.parse(JSON.stringify(e))`
    into a fresh `Distillery.track`; cases: missing, `fuel: 'diamond'`, `fuelJ: -5`, `NaN`, `1e12` (clamped to
    `4 x energyJ`).
12. Conservation: extend the existing fuzz (`'never makes or loses a litre in random rigs'`) so a third of the generated
    rigs are built `{ ground: true }` and their bases are fed a random burner fuel; litres stay conserved.

### 9.4 Tanks and pipes - `src/sim/fluidPipes.test.ts` / `distill.test.ts` `describe('player and pipes')`

1. `'a receiver drains through a pulling port into a tank, end to end'`: rig POT on a furnace + port touching R + pipe + tank
   (`run(kit.world, 'fluid_pipe', a, b)` and `until(kit, what, done, maxS)` from `src/sim/pipeKit.ts`, as `fluidPipes.test.ts` does); fill R with 1000 L `expand('spirit', 1000)`; set the port end
   to pull (`sim.setPort(..., { mode: 'pull' })`); tick 10 s -> tank stack `{ fluid: 'spirit', litres: 1000 }`, R empty;
   total litres (R + network + tank) === 1000 at every tick.
2. `'the port filter keeps other grades in the receiver'`: allow list `['spirit']`, R holds slop -> nothing moves, port
   state `filtered`.
3. `'a full tank stops the line; the receiver keeps collecting'`: tank pre-filled to 16 000 L of spirit -> push end `full`.
4. `'every fluid fits a tank'`: for each `FLUIDS` key, `tankStackEndpoint([...]).room(key) === 16_000` on an empty tank.
5. `'beakers and canisters pour into and take out of a tank'` (`bucketUse`): `spirit_beaker` -> `{ held: 'glass_beaker',
   litres: 250 }`; `glass_beaker` on 250 L of spirit -> `spirit_beaker`; `kerosene_canister` -> 1000 L, `empty_canister`;
   refusals with exact strings (4.9); conservation.
6. `'a tank of spirit saves and loads'` (sanitize keeps `fluidIn`).

### 9.5 Player - `src/player/pipeTools.test.ts` (exists)

`'a full canister or a beaker on a tank goes to bucketUse, not the tank screen'` - fake `TransportHands` records the
call; `held = 'kerosene_canister'` and `'spirit_beaker'` -> outcome `'pail'`; `held = 'charcoal'` -> null.

### 9.6 UI - `src/ui/screens/inventory/slotViews.test.ts` (NEW if absent)

`itemCard({ item: 'charcoal', count: 1 }).rows` contains `['Still burner', '250 °C, 50 s boiling']`;
`kerosene_canister` -> `['Still burner', '350 °C, 5 m 00 s boiling']`; `stick` has no such row.

### 9.7 Render - `src/render/distill/distillFx.test.ts` (exists)

A lit ground base adds 4 motion instances idle and 10 boiling; an unlit base adds none; total never exceeds `MOTION_MAX`.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E - `scripts/e2e-distill.mjs`

Append three steps after `'the gasoline refuels a chainsaw and the canister comes back empty'` and before
`'no console errors during the run'`. Extend the `mod()` reader to also return `fuel: e.fuel ?? null, fuelJ:
Math.round(e.fuelJ ?? 0)`. Set-up through `window.__hw` only; actions by real input (`d.selectItem`, `tapTimes`,
`d.use`).

**Step A - `'a still base on the ground burns charcoal and distils wash with no furnace'`**
- Set-up (`d.hw`): a stone pad south of the yard: `bx = P.pot.base.x, gy = P.gy, bz = P.z0 + 4`. Clear `bx-1..bx+5`,
  `gy..gy+5`, `bz-1..bz+1` to air over stone. Place `still_base (bx, gy, bz)` directly on stone, `boiling_flask (bx, gy+1)`,
  `condenser_coil (bx, gy+2)`, `receiver (bx+1, gy+2)`, `chem_port (bx+2, gy+2)`, `fluid_pipe (bx+3, gy+2)`,
  `fluid_pipe (bx+3, gy+1)`, `tank (bx+3, gy, bz)`. Then
  `sim.setPort(bx+3, gy+2, bz, 1, { mode: 'pull' })` (`Face.NX = 1` in `src/core/types.ts`: the end of the pipe at
  bx+3 that faces the port at bx+2). Store `P.g = { base, flask, recv, tank }`.
- Real input: `give('wash_beaker', 4)`, select, `tapTimes(P.g.flask, 4)` -> flask 1000 L. `give('charcoal', 2)`, select,
  `tapTimes(P.g.base, 2)`.
- Assert: `mod(P.g.base)` -> `fuel === 'charcoal'`, `fuelJ === 800000`, `active === true`; the crosshair view text (read via
  `sim.brewView(x, y, z).text`, `Simulation.brewView` line 457) starts with `Still Base - Charcoal`.
- `fastForward((c) => sim.distill.entityAt(...).state === 'working', P.g.flask, 'the ground still to boil')`, then the
  flask `tempC <= 97.5`, `sim.furnaceAt` irrelevant (no furnace within 1 block: assert `getBlock(bx, gy-1, bz).block ===
  'stone'`).
- Screenshot `test-results/e2e-distill/8-ground-burner.png` from 3 blocks south looking at the base (`hw.setTime(0.8)` -
  dusk, so the lit lamp and motes read). Also `--device=phonePortrait` run saves the same name under its device folder.

**Step B - `'the receiver pipes its cut into a tank end to end'`**
- `fastForward` until the tank stack holds > 0 L (read `sim.machineView(x, y, z).fluids.stack`, filled by `tankView` in `src/sim/tanks.ts`), max 20 rounds.
- Assert `stack.fluid` is `low_wines` (or the receiver's `nameOf`) and conservation: `flask + receiver + tank + network`
  litres within 1 L of 1000 minus nothing (wash has no vented share).
- Real input: `give('glass_beaker', 1)`, select, `tapTimes(P.g.tank, 1)` -> inventory gains `low_wines_beaker` (the 4.9
  fallback; only if the tank holds >= 250 L - fast-forward until it does; if the wash yields less than 250 L of low wines,
  pour 2 more wash beakers first: the receiver test is about flow, the beaker check about the hand path).

**Step C - `'kerosene drives a ground burner to 350 C and the canister comes back'`**
- Set-up: a lone `still_base` at `(bx+5, gy, bz)` on stone.
- Real input: `give('kerosene_canister', 1)`, select, tap the base once -> inventory has `empty_canister` +1, base
  `fuel === 'kerosene_canister'`; empty hand, tap 4 times from default 97 (97 -> 130 -> 200 -> 260 -> 350) -> `setC === 350`;
  view text contains `set 350 C`. Then `give('charcoal', 1)`, select, tap -> charcoal count unchanged (refused; the toast
  text `The Still Base is burning Kerosene - let it burn down first` is visible in `#hw-toasts` - assert via the text of `.hw-toasts` (`src/ui/kit/feedback.ts` line 45)).

Run: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-distill.mjs --device=desktop` (no `HW_GPU`), and
`--device=phonePortrait` (the script already runs both; UI text is touched). Both must pass; attach the two screenshots
to the PR.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/distillery.md`: Contracts -> new "Ground burner" bullet (fuels table, idle draw, stock, cap rule, furnace
  wins, done-stays-done); Simulation calls -> `chemUse` table gains the fuel row; Entity line gains `fuel?, fuelJ?, burnW?`;
  Heat line: "or a burner fuel on the ground: `min(setC, BURNER_FUELS[fuel].capC)`"; port accepts = `tankFluids().filter(isChemFluid)`; test count.
- `docs/api/water.md` (tank section) and `docs/api/tech-content.md` (tank spec): "a tank takes every fluid
  (`tankFluids()`); beakers (250 L) and canisters (1000 L) pour in and take out by hand".
- `docs/api/sim.md`: `Distillery.burning`, `onFurnace`; `bucketUse` container fallback.
- `docs/DISTILLERY_PLAN.md` section 15: mark items 2 ("Burner on the ground") and 5 ("Tank support ... end to end in the
  e2e") as done with the commit hash (status lines only).
- NOT `docs/WHATS_LEFT.md` (coordinator), NOT `docs/build/SYSTEMS.md` (coordinator; see 14).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] `BURNER_FUELS` exists in `src/core/distill.ts` with exactly the four rows of 4.2; caps 250/280/300/350; test-proved
      burn times 50/100/40/300 s at 8 kW.
- [ ] A still base with no furnace under it and no fuel holds nothing (`baseTemp === null`); fed, it holds
      `min(setC, cap)`; a furnace under it always wins.
- [ ] Fuel is spent at `BOIL_J_PER_L` x litres boiled, never below `BURNER_IDLE_W`; a lone lit base burns 500 W.
- [ ] Beaker and canister fuels return their empty into the same slot.
- [ ] Four refusals and four toasts read exactly as in 4.4 / 6.2; every crosshair line in 6.1 is <= 60 characters.
- [ ] Fuel out mid-run -> flask blocked (red), `fire_out`, one warn toast; refuel resumes. A done flask stays done.
- [ ] Lit base: amber lamp, flame emblem, glow at night, flame motes (4 / 10), no new draw call, no sound loop.
- [ ] `fuel` / `fuelJ` save and load; junk and missing values sanitise to unlit; old saves load.
- [ ] Tank `accepts`/`gives` are `tankFluids()`; no hand-written fluid list remains in `techMachines.ts` or for the port
      in `machinesDistill.ts` (grep: no `['water', 'lava', 'steam', 'crude_oil', 'fuel']` literal outside rosters/tests).
- [ ] A receiver drains through a pulling Chemistry Port into a tank (unit test + e2e); litres conserved; the port filter
      holds back other grades.
- [ ] Full canisters and full/empty beakers work on a tank by hand.
- [ ] `npm test` green (content, progression, gates, sfx unchanged); `npx tsc --noEmit` clean; e2e-distill desktop and
      phonePortrait pass with the two new screenshots.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Rain, wind or water putting out a ground fire; the fire spreading; smoke. (Danger is environmental, but an open still
  fire in rain is a later polish item.)
- A burner warm-up curve or a burner heat buffer (furnace-like inertia).
- Burning items other than the four (logs, planks, sticks, coke, gasoline, diesel, residue). Gasoline and diesel are
  engine fuels (`FUEL_GRADES`); coke is the furnace's; residue is oil and asphalt feed (Units 8, 9).
- Pipe-fed burners (a fluid pipe feeding kerosene into a base). Fuel goes in by hand, deployer or golem (`offerItem`).
- Teaching the progression solver (`chemReady`) that a card may run on a burner. The solver stays conservative (a base
  needs a furnace reaching the setting) - correct, because every card is reachable with a furnace and the burner is
  optional (T7 rule 6).
- A kerosene lantern or heater (DISTILLERY_PLAN 8.1) - kerosene's second consumer is a future unit.
- Continuous spouts/drains on tanks (Unit 14); tanks as golem targets (Unit 17).
- Changing default pipe-end modes at chem ports (wrench to Pull stays one tap).
- `FUEL_GRADES` rows for kerosene.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **SYSTEMS.md amendments requested** (small): (a) T1 burner table - add "stock: up to `BURNER_STOCK` 4 items of one
   fuel; a different fuel is refused while one burns; a furnace under the base wins and the fuel waits". (b) T8 numbers -
   add "time >= 60 min: `1.3 h`" (the kerosene idle time is 80 min). (c) T3 "one accept list" - note that glassware endpoints
   (the port) take `tankFluids().filter(isChemFluid)`: every fluid with a grade; Refined Fuel has none and stays out.
2. **Scope additions found while researching** (both in the T3 spirit, small): full canisters were never routed to
   `bucketUse` from the player's hand (`BUCKETS` in `src/player/buckets.ts` omits them), and beaker fluids could not leave
   a tank by hand. Fixed here via `isFluidContainer` + the `CHEM_CONTAINERS` fallback. This touches `src/player/pipeTools.ts`
   and `src/sim/transportActions.ts`; Unit 14 (continuous spouts) also touches `transportActions`/workshop fluid paths -
   merge order 7 before 14 is easiest; the edits are in different functions.
3. **Behaviour change visible to existing players:** a finished flask no longer turns red when its furnace goes cold
   (4.6). It is a fix, but it changes furnace stills too.
4. **Unit 0 interaction:** `lube_base` and `lubricant` reach tanks and ports automatically through `tankFluids()`; no
   ordering needed. If Unit 7 merges first, Unit 0's roster edit adds two keys to the tank row in `specRosterTech.ts`.
5. **Unit 6** shows the new base lines unchanged; `ChemView.secondsLeft` now carries the burn time while lit if the rig
   screen wants a bar.
6. **Unit 11**: the steel flask spec can cite `BURNER_MAX_C` (350) for "a burner cannot exceed 350 C".
7. **Unit 12** balance pass may retune `BURNER_FUELS` energies; tests pin the T1 numbers, so a retune must update SYSTEMS
   5.1/T1 and the tests together.
8. No new item -> no T4 row needed; the T4 effect is `kerosene_canister` gaining its first consumer.
