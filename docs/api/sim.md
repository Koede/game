# src/sim - public API

The furnace, power networks, every machine, fission and the Starhearth (spec 2.4, 2.5, 3.1-3.3, brief 7.1).
DOM-free, runs in node. Import from `src/sim` (index). 6 test files, 64 tests: `npx vitest run src/sim`.

All numbers come from the registry (`furnaceTier()`, `machine(kind).params`, recipes, `cableRatingW`) and
`src/core/constants.ts`. All machine state lives in plain fields on the block entities the world stores and
saves (`world.setEntity`); the simulation keeps only caches beside them.

## Wiring (for integration)

```ts
const sim = new Simulation(world: IWorld, bus: GameBus, player: PlayerState, clock: GameClock);
// fixed 20 Hz step:      clock.tick(DT); sim.tick(DT); survival.tick(DT); objectives.tick(DT);
// objectives:            new ObjectiveTracker(bus, player, sim)   // sim satisfies SimQuery
// HUD / screens (7.4a):  deps.sim = sim                           // sim satisfies UISimQuery structurally
// after world.load(...): sim.resync()                             // rebuilds the runtime from world.entities()
```

- `tick(dt)` advances every entity whose chunk is loaded (`world.isLoaded`), skips the rest (they hold still and
  give/draw no power), then solves every power network.
- Entity lifecycle follows `'block:changed'` (never call anything to place or break a machine): a block with
  `machine` appearing creates its entity (or adopts one already stored at that position with the same kind); a
  furnace block swapped for another furnace tier keeps its entity; a machine block disappearing removes the
  entity, hands everything it held to the player (`player.give`, which toasts what did not fit) and emits
  `machine:removed`. Placement by the player (`source: 'player'`) of a furnace makes it home.
- `'chunk:loaded'` / `'chunk:unloaded'` refresh only machines in or beside that chunk and networks that reach it.
- `'ui:opened'` with a `furnace` screen sets `player.home`.
- `dispose()` unsubscribes from the bus.

## class Simulation

### Player actions - each returns `ActionResult = { ok: true } | { ok: false; reason: string }`
The reason is a short sentence for the UI (e.g. "Needs 700 C - the furnace is at 512 C", "Missing 2 Tin Ingot").
Every action on a position without a furnace refuses with "There is no furnace here".

| method | does | refuses when |
|---|---|---|
| `light(x, y, z)` | starts the fire from the firebox; `furnace:lit`, sfx `ignite`, flag `furnace_lit` (once) | ignited / already lit / "No fuel in the firebox" |
| `douse(x, y, z)` | puts the fire out, fuel stays; `furnace:out`, sfx `fire_out` | ignited / not lit |
| `pump(x, y, z)` | bellows: draft += 0.34 (max 1); `furnace:pumped`, sfx `bellows` (pitch rises with draft), flag `bellows_pumped` (once) | ignited |
| `setElectric(x, y, z, on: boolean)` | electric heating switch (default ON for every furnace); sfx `machine_on/off` | tier without `electricHeatW` ("Electric heating starts with the Arc Furnace") |
| `forge(x, y, z, recipeId, times = 1): ForgeResult` | `ForgeResult = { ok: true; made: number } \| { ok: false; reason }`. Makes up to `times` (floored) in a row, -25 C each (not once ignited); stops early, still `ok`, when it gets too cold or runs out - `made` says how many. Ingredients: pack first, then crates near the furnace. Output to the pack. `item:made`, sfx `forge` (once per call) | not a forge recipe / locked tier ("Needs the Blast Furnace") / `times < 1` ("Nothing to make") / too cold / missing ingredients / no room in the pack |
| `upgrade(x, y, z)` | rebuilds as the next tier in place (block id swapped, facing and state kept, more slots, entity kept); `furnace:upgraded`, sfx `upgrade`, toast "Upgraded to the Blast Furnace" | last tier / "Missing ..." (checked first) / too cold |
| `startIgnition(x, y, z)` | Starhearth only: starts the 90 s, 300 kW ignition; `furnace:ignition` `started`, sfx `ignition` | not tier 5 / already ignited / under way / below 3000 C / "Connect it to a power network first" (no generation and nothing stored on its network) |
| `rest(x, y, z)` | skips the clock to dawn (`clock.skipToDawn()`), burns 60 s of fuel (`REST_FUEL_S`, at no draft) unless electrically heated or ignited; flag `rested`, toast | not night / furnace below 200 C / player farther than the tier's warmth radius ("Come closer to the furnace") / "The fire would not last the night - add fuel" (needs >= 60 s of fire at the current draft, or electric heat actually delivered, or ignited) |
| `setMachineOn(x, y, z, on)` / `toggleMachine(x, y, z)` | any machine's switch (generators, consumers, storage, fission pile); sfx `machine_on/off` on change. Switched-off storage neither charges nor discharges | crate or nothing there ("There is no machine here") |
| `explode(x, y, z, radius)` | removes every block in the sphere except unbreakable solids (corestone), destroys machines inside WITH their contents, `explosion` event + sfx, damages the player: `ceil(20 x (1 - d / 2r))`, 0 beyond twice the radius | - |

### Slot access (Inventory views with accept rules; use the game's transfer functions on them)
- `furnaceSlots(x, y, z): FurnaceSlots | null` - `{ fuel, crucibleIn, crucibleOut }`, each an `Inventory` over the
  entity's arrays (one stable object per entity: listeners stay valid; the arrays grow on upgrade, never get
  replaced). `fuel` accepts only items with a FuelSpec; `crucibleIn` only items with a smelt recipe whose
  `minTier <= tier`; `crucibleOut` is take-only. Crucible i = slot i of both crucible inventories.
- `machineSlots(x, y, z): Inventory | null` - crate: anything (27). Burner generator / combustion engine /
  fission pile: slot 0, only their fuels. Crusher, still, centrifuge, electrolyzer: slot 0 input (only items with
  a recipe at that machine), slot 1 output (accepts nothing, can be taken from). Bore rig: 9 take-only slots.
  Others have no slots (`size` 0).
- When the simulation writes slots itself (smelting, fuel, machine output, crate push) it calls
  `notifyChanged()` on the views that exist, so `onChange` listeners fire.
- `stationSources(x, y, z): Inventory[]` - the player's inventory, then every crate within `STATION_CRATE_RADIUS`
  (4, Chebyshev distance) of that position, nearest first. Exactly what forge/upgrade take from; use it for
  have/need numbers at the furnace AND the workbench.

### Lookups
- `furnaceAt(x, y, z): FurnaceEntity | null`, `machineAt(x, y, z): MachineEntity | null` - the live entities (read
  fields freely; write only through actions and slot views).
- `homeFurnace(): FurnaceEntity | null` - the furnace at `player.home`, if it still exists.
- `entityCount: number`.

### Queries for the UI (build on demand, a few times per second at most - never per frame for the big ones)
- `furnaceView(x, y, z): FurnaceView | null` - everything the furnace screen shows, recipe list included.
- `forgeList(x, y, z): ForgeRow[]` - just the forge rows (same as `furnaceView().forge`).
- `machineView(x, y, z): MachineView | null` - any non-furnace machine (crates too: role `crate`, empty status).
- `networkAt(x, y, z): NetworkStats | null` - the network of the power device OR cable at that position; null for
  nothing there, or a cable run that touches no device.
- `allNetworks(): NetworkStats[]` - every network; built at most once per tick and returned again within the same
  tick (cheap to poll from the HUD). `members` of each entry is computed on first read.
- `grid(): GridSummary` - totals over all networks and the worst state; allocation of one small object, fine
  every frame.

### Totals (objectives: `SimQuery`)
- `maxFurnaceTempC()`, `maxFurnaceTier()` (0 without furnaces), `generationW()` (sum of available generator watts
  G over all networks - an ignited Starhearth counts its 1 MW), `storedJ()` (all batteries and lithium banks).

## View types (exact fields)

### FurnaceView
| field | meaning |
|---|---|
| `x, y, z, tier` | position; tier 1..5 |
| `spec: FurnaceTierSpec` | this tier's numbers (name, maxTempC, crucibles, fuelSlots, speed, electricHeatW, warmth, blurb...) |
| `home: boolean` | it is `player.home` |
| `tempC` | current temperature, C (20..maxTempC; 5000 once ignited) |
| `maxTempC` | tier max (5000 once ignited) - top of the thermometer |
| `trend: 'rising' \| 'falling' \| 'steady'` | from `rateCPerS` with a 0.5 C/s dead band |
| `rateCPerS` | change over the last tick, C per second |
| `lit` | the fire is on (it may have just run out of the item: see `burning`) |
| `burning` | lit and an item is burning |
| `hot` | `tempC >= 200` (glows, lights, warms, can rest) |
| `draft` | bellows draft 0..1 (decays 0.1/s; a powered blower holds >= 0.8 x f) |
| `flameC: number \| null` | flame temperature of the burning item incl. draft bonus (+250 x draft); null without a fire; 5000 once ignited |
| `targetC` | ESTIMATE of where the temperature settles with the present fire, draft, heat engines and electric heat (capped at maxTempC) - for a "heading for" marker |
| `burnItem: string \| null` | item burning now |
| `burnItemLeftS` | seconds left of that item at the current draft |
| `burnTimeLeftS` | seconds of fire in the whole firebox (item burning + every item waiting) at the current draft; also meaningful while unlit |
| `fuelItems` | items waiting in the fuel slots |
| `crucibles: CrucibleView[]` | one per crucible (tier.crucibles) |
| `electric.available` | this tier has electric heating (tier >= 3) |
| `electric.on` | the switch |
| `electric.networked` | its network has another device besides the furnace |
| `electric.demandW` | heating watts the thermostat asks for this tick: `clamp(loss + extract + (max - T) x C / 2, 0, electricHeatW)`; 0 when off or not available |
| `electric.deliveredW` | `demandW x satisfaction` |
| `electric.maxW` | tier.electricHeatW |
| `electric.satisfaction` | network f 0..1 (0 without network) |
| `extractW` | heat pulled out by thermopiles and steam engines, W |
| `ignited` | the Starhearth burns on its own |
| `ignition.state` | `'idle' \| 'running' \| 'failed' \| 'done'` ('failed' stays until restarted) |
| `ignition.progress` | 0..1 of the 90 s |
| `ignition.powerW`, `ignition.seconds` | 300000, 90 (from params) |
| `ignition.canStart: ActionResult` | what `startIgnition` would answer now |
| `upgrade: UpgradeView \| null` | the next tier; null at tier 5 |
| `canRest: ActionResult` | what `rest` would answer now |
| `forge: ForgeRow[]` | EVERY forge recipe of the game in tech-tree order, locked ones included |
| `smelt: SmeltRow[]` | every smelt recipe, locked ones included (what the crucibles can take) |
| `status` | the most useful single line, one of: "A star burns here. It needs nothing more." / "Igniting - 42%" / "Connect it to a power network to heat it electrically" / "No power for electric heating" / "No fuel" / "The fire is out - add fuel" / "Ready to light" / "Cooling - light it again" / "<Item> needs <C> C - now <T> C" (a loaded crucible is too cold) / "Electric heating is starved of power" (f < 0.25) / "Burns out in m:ss" / "Holding <T> C" / "Heading for <targetC> C" |

### CrucibleView
`index`, `input: Slot`, `output: Slot`, `recipe: RecipeDef | null` (what the loaded input runs), `progress` 0..1
through the current item, `requiredC: number | null`, `secondsLeft` (current item at the current speed; Infinity
when not advancing), `active` (advancing this tick), `status`: "Empty" / "Done - take it out" (output only) /
"Cannot be smelted here" / "Needs 2 Alumina" (not enough input for one) / "Output is full - take it out" /
"Needs 700 C - now 512 C" / "Smelting Copper Ingot". Speed: `tier.speed x (1 + min(1, (T - minTempC) / 300))`.

### UpgradeView
`next: FurnaceTierSpec`, `ingredients: IngredientStatus[]` (`{ item, need, have, ok }` counted over
`stationSources`), `requiredC`, `tempOk`, `ok`, `reason: string | null` ("Missing 4 Firebrick, 1 Bellows" first,
else "Needs 700 C - now 650 C").

### ForgeRow
`recipe: RecipeDef` (minTempC, minTier, inputs, output), `locked` (minTier > tier), `tempOk` (T >= minTempC, always
true once ignited), `canMake`, `reason: string | null` in this order: "Needs the Blast Furnace" / "Needs 800 C" /
"Missing 1 Tin Ingot, 2 Stick" / "No room in your pack"; `ingredients: IngredientStatus[]`; `max` (times the
ingredients at hand allow, ignoring heat and room); `heatAllows` (times in a row before the 25 C chill drops it
below minTempC: `floor((T - minTempC) / 25) + 1`, 0 when too cold, Infinity once ignited). A "x5" button should
call `forge(..., min(5, max))`; forge stops by itself when it gets too cold.

### SmeltRow
`recipe`, `locked`, `tempOk`, `have` (input items in the pack and nearby crates), `reason: string | null`
("Needs the Arc Furnace" / "Needs 1500 C").

### MachineView
| field | meaning |
|---|---|
| `kind, name, role` | machine kind, display name, `MachineRole` |
| `x, y, z` | position |
| `on` | its switch |
| `running` | the voxel's active flag (generating / working / lit) |
| `status` | e.g. "Switched off", "Must touch a furnace", "No fuel", "The furnace is too cold", "No sunlight", "1.2 kW of 2 kW in use", "Waiting for input", "Not enough input", "Output is full", "No power", "Not enough power" (f < 0.25: stalled), "Running at 80% power", "Making Crushed Iron - 40%", "Boring at depth 12", "Stopped at water", "Pitchblende is too hard for the bore", "64% - charging 2 kW", "64% - feeding 3 kW", "64% - idle", "64% - not connected", "No fuel rod", "No cooling - core at 940 C and rising" |
| `problem: string \| null` | placement problem: "Must touch a furnace", "Must sit on top of a furnace", "Needs water on one side", "Needs water on 2 sides (1 now)", "Must touch water", "Needs open sky above", "Must touch lava" |
| `hint: string \| null` | `MachineSpec.placementHint` |
| `network: number \| null` | id of its network (matches `NetworkStats.id` of the same tick) |
| `availW` | generators: watts available this tick (potential); 0 for others |
| `outW` | generators: watts actually delivered (`availW x load`); storage: discharge watts |
| `demandW` | consumers: watts wanted this tick (0 when idle/blocked) |
| `satisfaction` | consumers: network f (0 without network); 1 for everything else |
| `progress` | processors: 0..1 through the job; bore rig: through the current block |
| `recipe: RecipeDef \| null` | processors: job in progress |
| `storedJ, capacityJ, chargeW` | storage: joules held, capacity, watts going in (before 90% efficiency) |
| `fuelJ` | fuel generators and fission pile: electric joules left (item burning + slot) |
| `fuelLeftS` | `fuelJ / outW`; Infinity while not delivering |
| `coreC, cooled` | fission pile core temperature and >= 2 water neighbours (others: 20 / true) |
| `depthY` | bore rig: y of the last block mined (starts at its own y) |
| `slots: Slot[]` | the LIVE slot array - read only; move items through `machineSlots` |

### NetworkStats
`id` (renumbered whenever the topology changes - do not keep it across block changes), `generationW` (G,
potential), `demandW` (D), `deliveredW` (f x D), `storedJ`, `capacityJ`, `chargeW` (into storage), `dischargeW`
(from storage), `ratingW` (weakest cable; Infinity without cables), `cables`, `satisfaction` (f), `overloaded`
(`G + discharge > rating && D > supply`), `state: 'ok' | 'brownout' | 'overload'` (the announced state, see
alerts), `members: NetworkMember[]` (`{ kind, name, x, y, z, role, watts, status }`, watts > 0 feeds, < 0
draws, storage = discharge - charge, ignited furnace = its share of the load), `historyG` / `historyUsed`
(`HISTORY_SECONDS` = 60 samples, one per second, each the mean of that second, oldest first; zeros before the
network existed; kept across rebuilds while the network keeps its first member).

### GridSummary
`{ networks, generationW, demandW, deliveredW, storedJ, capacityJ, state }` - sums over all networks; `state` is
the worst announced one (overload > brownout > ok).

## Entities (fields other modules may read; spec 5 fixes the first five furnace fields)
- `FurnaceEntity`: `kind: 'furnace'`, `x, y, z`, `tier`, `tempC`, `lit`, `draft`, `ignited`, `fuel: Slot[]`,
  `burnItem`, `burnLeftS` (at no draft), `crucibleIn/crucibleOut: Slot[]`, `crucibleProgress: number[]` (seconds),
  `crucibleRecipe: (string | null)[]`, `electric`, `ignition`, `ignitionProgressS`, `ignitionLowS`, and last-tick
  figures `flameC`, `rateCPerS`, `extractW`, `heatDemandW`, `demandW` (heat + ignition), `deliveredW`, `availW`.
- `MachineEntity` (every other kind): `on`, `slots`, `progress`, `recipe`, `fuelJ`, `storedJ`, `coreC`, `hotS`,
  `warned`, `alarmS`, `depthY`, `halted`, `availW`, `outW`, `demandW`, `f` (consumers: network f; storage: charge W).
- `isFurnace(e)` type guard. `JSON.parse(JSON.stringify(entity))` + `resync()` continues identically (tested).

## Other exports
`REST_FUEL_S` (60), `HISTORY_SECONDS` (60), `smeltRecipeFor(item): RecipeDef | null`,
`machineRecipeFor(kind, item): RecipeDef | null`, `windAt(timeS, min, max): number` (deterministic wind factor).

## Crops (spec 12.4)
Crop growth lives in `src/sim/crops.ts` / `cropRules.ts`; API, rules and numbers in `docs/api/crops.md`. Crops are
block entities of kind `crop` but never machines: `machineAt` / `machineView` / networks / `entityCount` leave them
out; use `cropView(x, y, z)`, `cropCount`.

## Events emitted
`machine:placed`, `machine:removed`, `furnace:lit`, `furnace:out`, `furnace:pumped`, `furnace:smelted` (each item),
`furnace:upgraded`, `furnace:ignition` (`started`, `progress` in 10% steps, `failed`, `done`), `machine:job`,
`item:made` (forge via `craftByPlayer`, each smelted item with station `furnace`, each machine job with the machine
kind as station), `power:alert` (`overload` / `brownout` / `recovered` on state changes only, after the new state
held 10 ticks; `meltdown_warning` once per overheating), `flag` (`furnace_lit`, `bellows_pumped`, `machine_job`
once per session; `rested`, `ignited`), `game:won` (once), `explosion`, `toast` (fire burned out - only when no
electric heat holds the furnace, upgrades, overheating pile, meltdown, ignition failed/done, rested), `sfx`
(`ignite`, `fire_out`, `bellows`, `forge`, `smelt_done`, `upgrade`, `machine_on`, `machine_off`, `machine_done`,
`spark` on overload, `alarm` every 2 s while a pile is >= 900 C, `explosion`, `ignition`, `win`, `dig_stone` for
the bore rig). Nothing is emitted per tick.

## Test fixtures (import by path; not in the index)
- `src/sim/testKit.ts`: `makeKit(makeWorld?)` -> `{ bus, world: FakeWorld, player, clock, sim, run(seconds),
  furnace(x, y, z, block?), machine(block, x, y, z), record(eventType) }`; `fire(kit, furnaceEntity, fuel, count?)`.
- `src/sim/playKit.ts`: `class Play` - a scripted player over the fake world (gather, craft, place, break, pour
  water, load/collect/stash with the transfer functions, smelt, forge, process, step/until with survival, clock
  and objective tracker running). Useful for UI harnesses that need a furnace in a given state.

## Verification
- `playthrough.test.ts`: one scripted game through the public API only - clay furnace -> bronze -> Blast
  Furnace -> steel -> thermopile, steam engine, crusher, battery, burner generators -> Arc Furnace on electric
  heat -> still and combustion engines -> Plasma Furnace (copper cable overloads, replaced by heavy cable) ->
  superalloy -> centrifuge, fuel rod, fission pile -> lithium banks, electrolyzer, deuterium -> star core ->
  Starhearth -> super cable -> 90 s ignition -> `game:won`. Every objective completes in order, no damage, alerts
  only on changes. About 98 minutes of game time; 1.4 s to run.
- `perf.test.ts`: 300 entities of 10 kinds on 30 cabled networks (arc furnaces on electric heat, heat engines,
  busy crushers pushing into crates, burners, batteries, solar, water wheels, geothermal taps, lamps).
  Measured in node on this machine: tick mean 0.03-0.05 ms (median batch ~0.02 ms); a tick with a block edit
  beside a machine 0.02-0.04 ms; a tick with a cable edit (full network rebuild) 0.7-1.1 ms. Asserts < 1 ms per tick.

## Deviations from the spec, and decisions
- Heat engines (thermopile 4x, steam engine 3x) draw heat in proportion to their AVAILABLE output, not to what the
  network uses: an idle steam engine still cools its furnace. Switch it off to get the heat back (the playthrough
  does this to reach 1200 C).
- Brown-out = f < 0.999 with demand; alerts are announced only after the new state held for 10 ticks (0.5 s), so
  a machine starting up does not flicker alerts.
- Starhearth (tier 5) before ignition behaves like tier 4 with its own speed (3.0) and warmth; ignition demand is
  added to the furnace's own electric demand; progress needs f >= 0.95 and fails after more than 2 s below.
- Electric heating defaults to ON; a furnace on a network at tier >= 3 heats itself as soon as power is there.
- Rest burns 60 s of fuel at no draft; it is allowed with an electrically heated furnace only while power is
  actually delivered.
- Crate radius is Chebyshev distance (a 9x9x9 cube around the station).
- `furnace:out` is still emitted when a fire dies under electric heat, but the warning toast is not.
- Storage honours the machine switch (spec only lists toggling generally).
- `flagOnce` flags (`furnace_lit`, `bellows_pumped`, `machine_job`) are remembered per Simulation instance, not
  saved: after loading a save each can be emitted once more. The objective tracker ignores repeats.

## Known gaps
- Placing or removing a power block rebuilds every network (about 1 ms with 300 entities in node, perhaps 3-5 ms
  on a phone) - a player-paced event, but a bore rig never triggers it (it only mines non-power blocks).
- `targetC` is an estimate (it assumes the current draft and network share hold).
- Network history and alert state are not saved; after loading they start from zero / 'ok'.
- `allNetworks()` returns the same array within one tick, so an action in that tick is only visible from the
  next one (or through `networkAt`, which is always fresh).
- `src/sim/simulation.ts` is 378 lines (aim 350); `machines.test.ts` 389, `playthrough.test.ts` ~370.

## Weather (spec 15)
The weather feature changed this module: see `docs/api/weather.md` for what was added and why.
