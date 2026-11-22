# Unit 3 - Small known gaps (build spec)

Status: design pass, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Builder: read this file top to bottom
once, then work the plan in section 8 in order. Every path, function, constant and string below was grepped in the tree on
2026-11-22; anything that does not exist yet is marked **NEW**.

**Threads:** T1 (heat drawn is energy: the steam engine pays for the work it does on BOTH of its outputs, and nothing
else), T8 (one phrasing grammar: pump / boiler / turbine statuses and hints, the structure tab's machine line), T9 (no new
sounds; the existing `break` / `harvest` / `ui_click` reused at their tiers; debris particles capped), T10 (no new saved
fields - everything in this unit is derived; old saves load and are healed), plus the phone-first rule of SYSTEMS 1.3
(caption and hotbar floors). T2 is read, not changed: shaft capacity of a generator stays `watts x suPerW`
(`GENERATOR_SHAFT`), the unit only changes WHICH watts.

Shared ids read: `GENERATOR_SHAFT` (src/workshop/workshop.ts:33), `Workshop.generatorWatts` (workshop.ts:104),
`MachineSpec.params.heatPerWatt` (src/content/tech.ts:105-119), `HEARTH_HIGHLIGHT_S` + bus event `highlight:block`
(src/ui/screens/furnace/structureTab.ts:338), `isUnsupported` (src/game/farming.ts:148), `rollDrops`
(src/game/mining.ts:44), `PlayerState.dropAll` (docs/api/ground-items.md), `UI_SCALE_LARGE` / `--hw-ui-scale`
(src/ui/kit/uiScale.ts), `--hw-tap` (src/ui/styles.css:78, 96). Shared ids defined: none in the SYSTEMS 6.2 table;
the new members below are local to their owning modules and listed in section 2.

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Five small seams that each make the world feel slightly untrue. None is a feature; each is the kind of thing a phone
player notices in the first hour and stops trusting the game over.

1. **Crops pop off when their farmland goes.** Today, if the player breaks farmland by hand the wheat on it pops and drops
   its seeds (`Interaction.popUnsupported`, src/player/interaction.ts:366). If ANYTHING ELSE removes the farmland - a
   workshop drill or deployer, a piston dragging the soil away, an explosion's edge, a contraption moving the field - the
   wheat stays hanging in the air forever, never grows ("Needs farmland") and cannot be told apart from a planted crop
   except by its status. After this unit there is one rule for every plant (`placeOn` block): *a plant left standing on
   nothing pops on the next tick and drops what it would have dropped if you had broken it.* Nothing is ever lost and
   nothing floats. Old saves that already contain floating crops are healed the first time those crops are looked at.

2. **The steam engine draws heat only for work it actually does.** SYSTEMS T1 lists "steam engine draws heat even when
   idle: Unit 3 fixes". The code check (section 3.2) shows the ELECTRIC half is already honest - `heatEngine.apply` takes
   `heatPerWatt x outW`, and `outW` follows the grid's load. What is NOT honest is the SHAFT half: the workshop turns a
   shaft from the engine's `outW` (the watts the grid uses), so (a) an engine that only drives shafts - no lamp, no
   battery - turns nothing at all, and (b) when it does turn shafts, the shaft work is free: no heat is drawn for it. The
   fantasy is the furnace as the one honest source of energy (SYSTEMS 1.1, T1 rule 4: "Heat drawn is energy"): stand at
   the furnace, look at the firebox's "Heat drawn" figure, and see it rise when the millstone upstairs takes load and
   fall to nothing when everything is still.

3. **UI size floors.** The Settings "UI size" choice (Normal / Large) already exists (`Settings.uiScale`,
   src/ui/kit/uiScale.ts). What remains of review item ui-10 is two hard floors that hold in BOTH sizes and on every
   device: no visible caption smaller than 10 px, and no hotbar slot smaller than 44 x 44 px - without the hotbar
   wrapping into an accidental second row or running under the touch buttons.

4. **The structure tab lists its machines.** The furnace's STRUCTURE tab already has the shift buttons
   (`Shift left` / `Shift right`, structureTab.ts:130) and the "In the way (n)" list (structureTab.ts:321). What it lacks
   is the other half of "what is this furnace doing for me": which machines are working with it. After this unit the
   tab opens with `Structure - 4 machines: Boiler, Steam Engine x2, Item Hatch` and one tappable row per kind that glows
   each instance in the world, cycling, exactly like the "In the way" rows.

5. **Pump / boiler / turbine wording to T8 grammar.** The fluid machines speak in three different voices ("Holds steam -
   wrench the pipe end at the boiler to Pull", "wrench the boiler end to Pull", "Full - nothing pulls from it"). After
   this unit every status is `<state>, <fact>, <fact>` and every problem is `<problem> - <the fix>`, with the number in
   it, one phrase for the wrench ("wrench the pipe end at the <machine> to Pull"), and every line fits in 60 characters.

The player's sentence for this unit: *"Nothing in this world floats, nothing is free, and everything tells me what it is
doing in a line I can read on my phone."*

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 Threads

| thread | what this unit does with it |
|---|---|
| T1 heat and fuel ladder | Rule 4 ("anything that boils draws from its source") extended to shaft work: a heat engine draws `heatPerWatt x (grid watts used + shaft watts used)`. Idle on both outputs = 0 W drawn. No number of the ladder changes. |
| T2 rotation and stress | Read only. A generator's shaft capacity stays `watts x GENERATOR_SHAFT[kind].suPerW`; the watts offered to the shaft become the SPARE watts (`availW - outW`) instead of the used watts. Water wheel and wind turbine benefit from the same fix (they draw no heat). No second capacity rule. |
| T8 reading the world | New structure-tab line and rows; 15 fluid-machine strings rewritten (section 6.1); 3 placement hints; one wrench phrase. |
| T9 sound and feel | No new `SfxName`. Popped plants reuse `break` / `harvest` at normal volume (1); structure rows reuse `ui_click`; popped plants spawn the existing debris burst through a NEW bus event with a smaller count (8 particles, under the 24 cap). Idle stays silent. |
| T10 saving | No new saved field. `PlantSupport` queue and `SimNode.shaftW` are runtime only. Old saves: floating crops healed on first refresh (section 7.3). |

### 2.2 What this unit PROVIDES (other units may rely on it after merge)

| id / signature | where | status | consumers |
|---|---|---|---|
| `popUnsupportedAt(world, bus, x, y, z, rng, drop): boolean` | src/game/farming.ts | **NEW** | Interaction (this unit), Simulation (this unit); Unit 13 (contraption moves) and Unit 15 (vault growth) get correct plant behaviour for free through the sim path, nothing to call |
| `class PlantSupport { queue(x,y,z); flush(world, pop, max); clear(); size }` | src/sim/plantSupport.ts | **NEW** | Simulation only |
| `CropField.onBareSoil: ((x, y, z) => void) \| null` | src/sim/crops.ts | **NEW** member | Simulation only |
| bus event `'plant:popped': { x, y, z, voxel }` | src/core/gameEvents.ts | **NEW** | src/render/emitters.ts (debris); free for Unit 12/16 sound or goal listeners |
| `Workshop.generatorUseW(x, y, z): number` | src/workshop/workshop.ts | **NEW** | Game wiring -> `Simulation.shaftUseW`; Unit 17 golem/harness work is unaffected |
| `SimContext.shaftUseW?: ((x, y, z) => number) \| null` and `Simulation.shaftUseW` | src/sim/entities.ts, src/sim/simulation.ts | **NEW** optional member | heatEngine behaviour |
| `SimNode.shaftW: number` (runtime) and `MachineView.shaftW: number` | src/sim/entities.ts, src/sim/gridViews.ts | **NEW** | machine status, firebox (unchanged code - reads `extractW`), goggles inspector |
| `StructureView.attached: AttachedMachine[]` | src/sim/hearthView.ts (type), filled in `Simulation.structureView` | **NEW** optional member (SYSTEMS 6.5 rule: optional additions only) | StructureTab; Unit 6 may reuse the row pattern |
| `machinesLine(list)`, `machineGroups(list)` | src/ui/screens/furnace/structureText.ts | **NEW** pure helpers | StructureTab |
| `litresText(L): string` (`<n> L` / `<x.x> buckets`) | src/sim/fluidMachines.ts (replaces the local `fmtL`) | **NEW** | fluid statuses; Units 7/14 SHOULD reuse it for tank/spout lines instead of writing a third litres formatter |
| `WRENCH_PULL(machine): string` -> `"wrench the pipe end at the <machine> to Pull"` | src/sim/fluidMachines.ts | **NEW** | fluid statuses; Unit 7 (receiver -> tank) and Unit 14 (spouts) use it for their own pull advice |

### 2.3 What this unit CONSUMES

| id | from | note |
|---|---|---|
| `isUnsupported(world, x, y, z)` | src/game/farming.ts:148 (exists) | the one support rule: `def.placeOn !== null && !def.placeOn.includes(below.key)` |
| `rollDrops(block, rng)` | src/game/mining.ts:44 (exists) | the same drops a hand break gives |
| `PlayerState.dropAll(stacks, at)` | src/game/playerState.ts (exists) | ground items, capped at `MAX_GROUND_ITEMS` 256 |
| `GENERATOR_SHAFT` | src/workshop/workshop.ts:33 (exists) | `steam_engine: { rpm: 24, suPerW: 1/50 }` |
| `formatWatts(w)` | src/game/objectives.ts:65 (exists) | watts text, already used by gridViews |
| `HEARTH_HIGHLIGHT_S`, `highlight:block` | used in structureTab.ts:338 (exists) | the glow of a tapped row |
| `--hw-tap` | src/ui/styles.css:78 (44px), :96 (52px Large) | the slot floor |

### 2.4 Contracts with other units (no conflicts expected)

- **Unit 0** does not touch any file of this unit except `src/core/gameEvents.ts` (both append; append-only rule).
- **Unit 6** (rig screen) copies the "row that glows a block, cycling `n of m`" pattern; this unit does not change the
  existing `ProblemRow` helper's behaviour.
- **Unit 7** rewrites tank accepts in `src/content/techMachines.ts` (`fluids.accepts` of `tank`). This unit edits ONLY the
  `placementHint` strings of `pump`, `boiler`, `steam_turbine` in the same file. Merge note for the coordinator: two
  different rows of the same array; a textual merge is trivial.
- **Unit 12** may listen to `plant:popped` for nothing; it is listed so nobody adds a second event.
- **Unit 13** (contraption tween): its moves call `world.setVoxel` with `'sim'` in one synchronous pass
  (src/workshop/contraption.ts:124-130). The deferred check of this unit (section 5.1, rule 3) guarantees a field moved
  WITH its crops never pops. Unit 13 must keep moves synchronous inside one tick, or tell the coordinator.
- **Unit 17** (harnessed animals on the treadwheel): treadwheel capacity does not go through `generatorWatts`; unaffected.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code

### 3.1 Crops and support

- `src/sim/cropRules.ts` - `STAGE_OF`, `CropNode { soil, sky, rain, water, lamp, dirty, ... }`, `growthRate(c, ctx)`
  returns 0 when `!c.soil` (line ~118). `CropView.status` "Needs farmland".
- `src/sim/crops.ts` - `class CropField`: `blockChanged` marks `DIRTY_SOIL` on the crop at `y + 1` (line ~139);
  `refresh(c)` recomputes `c.soil = voxelId(world.getVoxel(x, y - 1, z)) === FARMLAND` (line ~262); a crop with
  `rate <= 0` goes to sleep (`tick`, line ~199). So a crop whose farmland is removed is simply put to sleep, forever.
  `remove(x, y, z)` "Nothing is handed back" (line ~109).
- `src/sim/simulation.ts` - `onBlockChanged` (line ~308) forwards every block change to `crops.blockChanged`, then
  routes plant blocks to `crops.place/remove`. `tick` (line ~246) starts with `this.spills.place()` - the existing
  "next tick" pattern used because a break is still being announced while `block:changed` runs (src/sim/spills.ts
  header comment). `this.random` (mulberry32) exists; `this.player.dropAll` exists.
- `src/game/farming.ts:148` - `isUnsupported(world, x, y, z)`: "A block that must stand on something (`placeOn`: crops,
  wild plants, tall grass) and no longer does". Tested in `src/game/farming.test.ts:168-172`.
- `src/player/interaction.ts:366` - `private popUnsupported(x, y, z)`: the ONLY caller. Called from `breakBlock` (line
  ~348) after a hand break. Drops via `player.dropAll(rollDrops(def, this.rng), ...)`, emits `block:broken` and sfx
  `harvest` (ripe) or `break`.
- Non-player paths that remove or move a support block and never pop: workshop `Logistics.act` mine mode
  (src/workshop/logistics.ts:538), the drill (logistics.ts ~560), contraption moves (src/workshop/contraption.ts:124),
  the shear pin (workshop.ts:421, a part, not soil - harmless), `explode` (src/sim/fission.ts:82), pump `drainBlock`
  (fluidMachines.ts:108 - liquids, harmless), leaf decay (src/world/leafDecay.ts:176 - leaves, harmless), the
  chainsaw (src/game/felling.ts:108 - logs). The tractor tiller already drops what it clears (src/vehicles/tractorWork.ts:90).

### 3.2 Heat engines and shafts

- `src/sim/machines.ts:72-93` - `heatEngine` (thermopile, steam engine): `prepare` sets `availW =
  clamp(wattsPerC x (T - minTempC), 0, capW)` when on, furnace present, water beside or piped. `apply` calls
  `followLoad` (`outW = availW x net.load`), then `hottest.extractW += heatPerWatt x outW`. Its doc comment already says
  "an idle engine on a grid with no load takes no heat". Locked partly by `src/sim/power.test.ts:11-34` (thermopile:
  "Only the lamp's 10 W is used, so only 40 W of heat is drawn"). **No test** covers a steam engine with zero load.
- `src/content/tech.ts:118-119` - `steam_engine`: `outputW 2000`, `wattsPerC 4, minTempC 250, capW 2000, heatPerWatt 3,
  minWater 1, pipedWaterLPerS 10`.
- `src/workshop/workshop.ts:33-35` - `GENERATOR_SHAFT = { water_wheel: {rpm 12, suPerW 1/50}, wind_turbine: {16, 1/50},
  steam_engine: {24, 1/50} }`; `sourceFor` (line ~343): `w = this.generatorWatts?.(x,y,z) ?? 0; return w > 0 ? { rpm:
  g.rpm, capacity: w x g.suPerW } : null`.
- `src/app/game.ts:162` - `this.workshop.generatorWatts = (x, y, z) => this.state.sim.machineView(x, y, z)?.outW ?? 0;`
  **This is the bug.** `outW` is the GRID's use. With no electric consumer `net.load` is 0 (src/sim/power.ts:125), so
  `outW` is 0 and the shaft gets no capacity; with a consumer, the shaft gets capacity equal to the grid's use and the
  heat engine never pays for the shaft's share.
- Tick order (src/app/game.ts:462-464): `this.state.tick(DT)` (sim, solves the grid) then `this.workshop.tick(DT)`.
- `src/sim/gridViews.ts:105-111` - generator status: `"<outW> of <availW> in use"`, or "The furnace is too cold".

### 3.3 UI size

- `src/ui/kit/uiScale.ts` - `UI_SCALE_LARGE = 1.2`, `uiScaleFactor`, `applyUiScale(root, scale)` sets
  `data-ui-scale` and `--hw-ui-scale` on `.hw-root`. Settings row "UI size" (src/ui/menus/settings.ts:44,
  `UI_SCALE_OPTIONS` in settingsText.ts:21). **Done; not in scope except the floors.**
- Captions below 10 px today (grep of every `font-size` / `font:` in src/ui and src/player):
  - `src/ui/hud/hud.css:714` `.hw-hotbar .hw-slot::after { font: 600 9px / 1 var(--hw-font-mono) }` (number key labels; desktop only)
  - `src/ui/styles.css:1001` `.hw-slot__hint { font: 600 9px / 1 var(--hw-font-display) }` (empty-slot hints such as FUEL)
  - `src/player/input/touchStyles.ts:98` `.hw-touch-btn--place .hw-touch-label { font-size: 8px; }` (the PLACE toggle)
  - `.hw-touch-label` base is 10px (touchStyles.ts:75): at the floor, fine.
- Hotbar: `.hw-hotbar { width: min(100%, 520px); padding: 4px }` (hud.css:691); grid `.hw-slotgrid` (styles.css:1050):
  `--hw-cols: 9; --hw-slot-min: var(--hw-tap); auto-fill minmax(max(min, share), 1fr)`; hotbar overrides gap 3px,
  max 56px (hud.css:700); Large: gap 2px, max 64px, hotbar `min(100%, 600px)` (src/ui/hud/combat.css:230-236). Because
  the minimum is `--hw-tap`, a slot never shrinks under 44 px (52 px Large) - instead, when 9 do not fit, `auto-fill`
  silently WRAPS: at 390 px portrait 9 x 44 + 8 x 3 + 8 + 2 = 430 px > 390, so slot 9 drops to a second row of one,
  under or behind the touch cluster. That is the "hotbar < 44 px" complaint in its current shape: either too small (old
  code) or broken into 8 + 1 (today).

### 3.4 Structure tab

- `src/ui/screens/furnace/structureTab.ts` - `class StructureTab`: tier picker, steppers, rules line, shift row
  (`updateShift`, line ~304: "Position n of m", disabled "At the edge"), "In the way (n)" (`updateMachines`, line ~321:
  rows "Move the <Name> first", tap emits `highlight:block` for `HEARTH_HIGHLIGHT_S` and sfx `ui_click`), materials,
  ghost toggle. Problem rows with "Shown in the world - i of n" cycling (line ~259).
- `src/sim/hearthView.ts:87` `interface StructureView` (`note: string | null` at :107, `target.machines: PlanMachine[]`
  at :139 = blocks IN THE WAY, not machines working); `structureView(world, e, scan, sources, target)` at :249.
- `src/sim/simulation.ts:610` `structureView(x, y, z, target?)` wraps it.
- `SimNode.furnaces: FurnaceEntity[]` (src/sim/entities.ts:166) - the furnaces a node touches/works with (heat engines,
  boilers, blowers). Hearth parts know their controller through `NodeSet.shellOwner(key)` (simulation.ts: `nodes.shellOwner
  = (key) => this.hearths.shellOwner(key)?.e ?? null`).
- So "shift buttons" and the "In the way" list are DONE (SESSION_CONTEXT 6 "sim-7" / "ui" entries are stale for those);
  the machines-working list is the gap.

### 3.5 Fluid machine wording

- `src/sim/fluidMachines.ts:265-311` - `pumpFullStatus(links)` and `fluidStatus(node, world, links)`; `fmtL` (line ~258)
  uses `toLocaleString` ("1,000 L") - against T8 (">= 1000 L reads as buckets").
- `src/content/techMachines.ts:18-48` - `desc` / `placementHint` of `pump`, `boiler`, `steam_turbine`.
- `src/content/blocksTech.ts:50-56` - block descriptions of the same three (left as they are; see 6.1.4).
- `src/ui/screens/machines/fluidText.ts` (+ `fluidText.test.ts:57-65`) - screen tank rows; read-only for this unit.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Gap A - plants pop off (one support rule for every `placeOn` block)

**Rule (player words):** *A plant left standing on nothing pops and drops what it would.* It applies to every block with
`BlockSpec.placeOn` (today: the wheat / potato / carrot stages on `farmland`; tall grass and wild plants on their soils;
the tea and coffee bushes on `BUSH_SOIL` = grass, dirt, peat, farmland - src/content/blocksBrew.ts:10). One rule, the
existing `isUnsupported`, no list of crops anywhere.

**Who pops:**

| path | today | after |
|---|---|---|
| player breaks the soil by hand (`Interaction.breakBlock`) | pops at once (same frame) | unchanged behaviour; the body moves into the shared helper `popUnsupportedAt` |
| anything else changes the block under a plant: deployer `act` mine, drill, piston / bearing / contraption move, explosion edge, `__hw.setVoxel`, dev tools, a future unit | plant floats, sleeps, "Needs farmland" forever | pops on the NEXT simulation tick (50 ms, `TICK_RATE` 20) |
| an old save already holding a floating crop | floats forever | pops the first time its chunk is loaded and the crop is refreshed |
| a contraption moves the farmland AND the crop together | (moves both) | nothing pops: the check runs after the move completed |
| the soil is replaced by another soil the plant accepts (e.g. a bush's grass becomes dirt) | - | nothing pops (`placeOn` still satisfied) |

**Why the next tick, not inside the `block:changed` handler:** (1) the same reason `Spills` defers its crate
(src/sim/spills.ts header): the change is still being announced, and a nested `setVoxel` inside a `block:changed`
listener would re-enter every listener (transport, hearths, crops, hand) mid-announcement; (2) contraption moves clear
every cell first and then set them at their destination (contraption.ts:124-130) - checking at once would pop crops that
are being carried; (3) 50 ms is invisible.

**Drops:** exactly `rollDrops(def, sim.random)` - the same table a bare-hand break uses: a young wheat stage gives its
seed, a ripe one gives wheat + seeds, tall grass its chance of seed, a picked bush its cutting. Drops spawn as ground items
at the plant's centre (`player.dropAll(drops, { x: x + 0.5, y: y + 0.5, z: z + 0.5 })`), so the vacuum collector and the
hand vacuum pick them up like any drop. If the ground list is full (`MAX_GROUND_ITEMS` 256) `GroundItems.spawn` already
merges into the nearest same-kind stack or removes the oldest; that is the game's existing cap rule and acceptable here.

**Not credited to the player:** a sim pop does NOT emit `block:broken` (which bumps `PlayerState.stats.broken`,
src/game/playerState.ts:166, and the HUD coach, hud.ts:140). It emits the NEW event `plant:popped` instead; the debris
emitter listens to both. A hand break keeps emitting `block:broken` exactly as today (objective counters unchanged).

**Budget:** at most `PLANT_POPS_PER_TICK` = 64 (**NEW**, src/sim/plantSupport.ts) pops per tick; the rest stay queued for
the next tick. 64 because the biggest single event that can strand plants is an explosion of radius 4 (a 9 x 9 rim =
81 cells at most, of which only the outer ring holds plants; the realistic count is under 40) or a 6 x 8 piston field
(48); 64 keeps such an event to one or two ticks while bounding a pathological case (a 16 x 16 field cut out by a
contraption) to 4 ticks.

**Queue size cap:** the queue is a `Set<string>` of position keys; duplicates collapse. No cap beyond the budget is
needed: every entry is removed on flush whether it popped or not.

### 4.2 Gap B - heat engines pay for what both outputs use

**Rule (player words):** *An engine takes heat only for the power it actually gives - to the cables or to the shaft.*

Definitions per heat-engine node per tick:

- `availW` - what the engine can make now (unchanged formula: `clamp(wattsPerC x (T - minTempC), 0, capW)`).
- `outW` - what the grid uses (unchanged: `availW x net.load`).
- `spareW = max(0, availW - outW)` - **offered to the shaft**. Electricity has first call: the engine's description is
  "spins a dynamo" (src/content/blocks.ts:197), the grid is solved before the workshop ticks (game.ts:462-464), and it
  avoids a circular "shaft first" dependency. A heavy grid therefore starves the shaft - and the shaft says so in its
  goggles line ("overstressed") and the engine's status says where its watts went (section 6.1.5).
- `shaftW` - watts the shaft network actually USES from this engine: `this source's share of the network's stress /
  suPerW`. A network that is jammed, overstressed (stalled) or has nothing but shafts on it uses 0.
- Heat drawn: `extractW += heatPerWatt x min(availW, outW + shaftW)`.
- Piped water boils while `outW + shaftW > 0` (today: while `outW > 0`) at `pipedWaterLPerS` 10 L/s, unchanged rate.

**Share of stress:** for a network with sources S (crank 8 su, clockwork 48, engine 40, ...), capacity `C = sum(cap_s)`
(times the `LUBE` factor when oiled), used stress `U`: source s uses `min(U, C) x cap_s / C` su. The `LUBE` factor
multiplies C AND each cap_s equally, so it cancels in the share: **oil makes an engine able to carry more, it does not
make the work cheaper** - correct by T2 rule 1 (oil is capacity, not efficiency). Converting back to watts: `su / suPerW`
= su x 50 W.

**Numbers (reasoned against SYSTEMS 5 and the existing specs):**

| situation (steam engine, furnace at 820 C, `availW` 2000) | before | after |
|---|---|---|
| nothing connected (no cable, no shaft) | 0 W heat, 0 su | 0 W heat, 0 su (locked by a NEW test) |
| battery full, lamp off (grid load 0) | 0 W heat | 0 W heat |
| one lamp on the grid (`drawW` 10) | 30 W heat | 30 W heat |
| only a shaft with a millstone at 24 rpm (stress 4.25 x clamp(16/24) = 2.83 su; any other parts add theirs) | **0 su: the millstone does not turn** | capacity 40 su (2000 W / 50), uses 2.83 su = 141.7 W -> **425 W heat** |
| shaft fully loaded to 40 su, no grid | impossible (0 su) | 2000 W used -> 6000 W heat = the full-grid figure of power.test.ts:56 (`extractW` 6000). One engine, one ceiling. |
| grid uses 1500 W, shaft wants 20 su | shaft got 1500 W x 1/50 = 30 su for free; heat 4500 W | shaft gets spare 500 W = 10 su -> overstressed (20 > 10), stalls, uses 0; heat 4500 W. The goggles show the shaft overstressed; the engine status says "1.5 kW to the grid, 0 W on the shaft, of 2 kW". |
| grid uses 1500 W, shaft wants 8 su | free shaft, heat 4500 W | spare 10 su, uses 8 su = 400 W -> heat 3 x 1900 = 5700 W |

Water wheel / wind turbine: the same `spareW` rule (they are `GENERATOR_SHAFT` sources too); they have no
`heatPerWatt`, so only the shaft capacity changes: a lone water wheel (`outputW` per its spec / wheels) now turns a shaft
with nothing on its grid. That was the documented intent (docs/api/workshop.md:31-32: "capacity = their watts / 50 su").

The thermopile is not in `GENERATOR_SHAFT`; it keeps exactly today's behaviour.

**Why this is the "idle draw" fix and not a new feature:** the T1 note says "draws heat even when idle". The electric
path is already idle-honest; the shaft path is where an engine's work was mis-accounted (free when busy, dead when
alone). Fixing the accounting is the whole of the gap. SYSTEMS T1 "Exists" should be corrected by the coordinator
(section 14).

### 4.3 Gap C - UI floors (both sizes, every device)

Two floors, as testable invariants:

1. **Caption floor.** Every `font-size` (and the size in a `font:` shorthand) that applies to visible text in the game UI
   is at least **10 px** at Normal size. Large size multiplies (via its own rules or `--hw-ui-scale` 1.2) and therefore
   stays above. Concretely the three violators change: hotbar key numbers 9 -> 10 px, `.hw-slot__hint` 9 -> 10 px, PLACE
   toggle label 8 -> 10 px with `letter-spacing: 0.02em` (PLACE at 10 px bold uppercase is ~34 px wide; the button is 46 px:
   it fits with 6 px a side).
2. **Hotbar floor.** Every hotbar slot is at least `--hw-tap` square (44 px Normal, 52 px Large), and the hotbar is laid
   out on purpose, never by accidental wrap:
   - **One row of 9** whenever it fits. Width needed = `9 x tap + 8 x gap + 2 x 4 padding + 2 x 1 border`: Normal
     9 x 44 + 8 x 3 + 10 = **430 px**; Large 9 x 52 + 8 x 2 + 10 = **494 px**.
   - **Two rows, 5 over 4**, when the viewport is narrower than the one-row width plus 16 px of side margin: Normal
     `max-width: 445px`, Large `max-width: 509px` (media queries on the viewport; the hotbar's container is the full
     width bottom band). Slots 1-5 on the top row, 6-9 on the bottom row, left-aligned under them (the grid fills row by
     row; nothing to code but `--hw-cols: 5`). At 390 px portrait Normal: 5 x 44 + 4 x 3 + 10 = 242 px wide, 2 x 44 + 3
     + 10 = 101 px tall; the slots may grow up to `--hw-slot-max` 56 px from the existing `minmax(..., 1fr)`, i.e. up
     to 5 x 56 + 22 = 302 px - still clear of a 390 px screen's touch cluster edges (see 6.3).
   - Why 5 + 4 and not "7 visible, 2 hidden" (the other phone convention): hiding slots 8-9 would change what the number
     keys and the slot-select intents can reach and would need a save-visible rule; two rows change nothing but layout.
   - Why not scroll: SYSTEMS 1.3 "no drag"; a scrolling hotbar is a drag.
   - The touch cluster must clear the taller hotbar: in portrait, the cluster's bottom offset `--hw-touch-b`
     (touchStyles.ts) gains the extra row height when the hotbar is two rows (the builder checks the actual offsets; the
     acceptance is the no-overlap e2e assertion of section 10, not a number).

### 4.4 Gap D - the structure tab's machines list

**What counts as "a machine working with this furnace"** (`AttachedMachine`, **NEW**):

1. Every sim node whose `furnaces` contains this furnace's entity: heat engines (thermopile, steam engine), the boiler,
   the blower, any future `node.furnaces` user. (For a formed hearth the sim already lists machines touching any shell
   block in `node.furnaces`; hearth.test.ts:308 "a steam engine on the ceiling and a thermopile on a wall work the furnace".)
2. Every hearth part built into its shell: nodes with `spec.role === 'hearth_part'` whose `NodeSet.shellOwner(node.key)`
   is this furnace (Item Hatch, Fluid Hatch, Power Port).
3. Glassware and brewing that draw its heat: every world entity with `isChemKind(e.kind)` or `isBrewKind(e.kind)` for
   which `Simulation.furnaceUnder(e.x, e.y, e.z)` is this furnace (Still Base, the brewing setups on the furnace top).
   This is computed from `world.entities()` only while the STRUCTURE tab is open (it refreshes at the tab's existing
   update rate); the number of entities is small and this never runs per frame in the render loop.

Not listed: machines connected only by pipe or cable (the tank, pump and turbine of a steam line). They do not work WITH
the furnace; they work with the boiler. See section 14 note 2 for the SYSTEMS T8 example, which lists them.

**Shape:**

```ts
// src/sim/hearthView.ts  (NEW, exported)
export interface AttachedMachine {
  x: number; y: number; z: number;
  block: string;   // block key, e.g. 'steam_engine'
  name: string;    // block display name, e.g. 'Steam Engine'
}
export interface StructureView { /* existing */ attached?: AttachedMachine[] } // optional: filled by Simulation
```

**Grouping and order:** group by `name`; groups sorted by name A-Z (stable, predictable on a phone where the list does not
re-order itself while you watch); inside a group, instances by distance from the furnace's controller (nearest first),
ties by x, y, z. `machineGroups(list)` returns `{ name, block, at: [x, y, z][] }[]`.

**Summary line (`machinesLine(list)`)** - T8 grammar, max 60 characters:

| count | text |
|---|---|
| 0 | `Structure - no machines yet` |
| 1 | `Structure - 1 machine: Boiler` |
| n, all kinds fit | `Structure - 4 machines: Boiler, Steam Engine x2, Item Hatch` (59) |
| n, too long | kinds are added in order while the line stays <= 60 characters; the rest collapse into `, +k more` (k = number of kinds left out): `Structure - 9 machines: Blower, Boiler, +3 more` |

The count is MACHINES (instances), the list is KINDS with ` xN` for N >= 2 (T8 example "Steam Engine x2").

**Rows:** one button per group under a section head `Machines (n)` (n = instances), each row: glyph `gear` if it exists
in the glyph set, else `chevron` only; main text `<Name>` or `<Name> x<N>`; a note span that appears after a tap:
`Shown in the world` (one instance) or `Shown in the world - i of N` (cycling, same arithmetic as structureTab.ts:259).
Tap: `bus.emit('highlight:block', { x, y, z, seconds: HEARTH_HIGHLIGHT_S })` for the next instance + sfx `ui_click`.
Empty state: no rows; under the head line a muted hint `Set a Boiler, Steam Engine or Thermopile against the furnace to
put its heat to work.` (77 characters: a screen paragraph, not a crosshair line, so the 60 rule does not apply).

Placement in the tab: directly under the rules line and shift row, ABOVE "In the way". Reason: the tab's first job when
a hearth stands is "what is it doing"; the build plan below is for when it does not.

### 4.5 Gap E - pump / boiler / turbine wording

Grammar used (T8, normative): a STATUS is `<state>[, <fact>][, <fact>]` - sentence case, commas between facts, units after
a space. A PROBLEM is `<problem> - <the fix>`. The screen shows the status alone; the crosshair prepends `<Name> - `, so a
problem in the crosshair reads `Pump - full - wrench the pipe end at the pump to Pull`; this double dash is the T8
example's own form ("`no condenser on top - add a Condenser Coil`") and accepted. Every line <= 60 characters WITHOUT the
name prefix (the test checks this; with the prefix the crosshair may reach ~75 on these three machines - section 14 note 4).

One wrench phrase everywhere: **`wrench the pipe end at the <machine> to Pull`** (`WRENCH_PULL('boiler')`). It replaces
"wrench the boiler end to Pull" and "set the pipe end at the boiler to Pull with the wrench".

Litres follow T8: `litresText(L)` -> `"<n> L"` (integer) below 1000, `"1 bucket"` at exactly 1000 to 1049, `"<x.x>
buckets"` otherwise at or above 1000 (one decimal, trailing `.0` dropped: `"2 buckets"`, `"1.5 buckets"`). Rates are `"<n>
L/s"` (the machines' rates are all under 1000 L/s: pump 200, boiler cap 800, turbine 800).

The full before/after table is section 6.1.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (with edge cases and messages)

### 5.1 Plant support

1. On every `block:changed` with `ev.source !== 'load'` and `from.id !== to.id` at (x, y, z), if `y + 1 < WORLD_HEIGHT`
   and the block at (x, y + 1, z) has `placeOn !== null`, `PlantSupport.queue(x, y + 1, z)`. This runs at the TOP of
   `Simulation.onBlockChanged`, before its early returns (plant / station / distill / brew branches), so every path is seen.
2. `CropField.onBareSoil(x, y, z)` is called from `CropField.refresh` when `DIRTY_SOIL` was recomputed, the crop is not
   wild, and `c.soil` came out false. Simulation sets it to `(x, y, z) => this.support.queue(x, y, z)`. This catches crops
   whose soil vanished while their chunk was unloaded, and old saves (on load `CropField.track` marks `DIRTY_ALL`).
3. At the start of `Simulation.tick`, right after `this.spills.place()`, `this.support.flush(world, pop, PLANT_POPS_PER_TICK)`:
   for each queued key, if `!world.isLoaded(x, z)` drop it (the crop's `chunkChanged` re-dirties it on load and rule 2
   re-queues it); else call `popUnsupportedAt(world, bus, x, y, z, this.random, (s, at) => this.player.dropAll(s, at))`.
4. `popUnsupportedAt` re-checks `isUnsupported` (the block may have been put back, moved away or replaced since it was
   queued); if supported it returns false and changes nothing. Else it sets AIR with source `'sim'`, rolls drops, drops
   them, emits `plant:popped { x, y, z, voxel }` and sfx (`harvest` when `isRipeCrop(def)`, else `break`) at the block
   centre, volume default (1, "normal" tier), and returns true.
5. The AIR it sets is itself a `block:changed`; rule 1 queues (x, y + 1, z) if something with `placeOn` stands on the
   popped plant (nothing does today). Chains terminate because each pop removes a block.
6. `Interaction.popUnsupported` becomes: `if (popUnsupportedAt(this.world, this.bus, x, y, z, this.rng, (s, at) =>
   this.player.dropAll(s, at), 'player')) this.bus.emit('block:broken', { x, y, z, voxel })`. To keep `block:broken` for
   hand breaks the helper takes a `source: 'player' | 'sim'` argument, uses it as the `setVoxel` source, and returns the
   popped voxel or `null` (signature fixed in section 8). Hand pops keep emitting `block:broken` (stats, coach) as today.
7. While `Simulation.destroying` (an explosion in progress) nothing is popped synchronously - the queue flushes on the next
   tick when `destroying` is false again. Plants at the edge of a blast therefore drop their goods (the blast removed the
   soil, not the plant). Plants INSIDE the sphere are removed by the blast itself with no drops, as today.
8. Crop status strings are unchanged: "Needs farmland" (cropText.ts:13 `"<name> - needs farmland"`) can still be seen for at
   most one tick or while a chunk edge is unloaded; it is not removed.

Edge cases:

| case | result |
|---|---|
| farmland mined by a workshop deployer (`Logistics.act` mine) | the farmland's own `dirt` drop spawns (existing), next tick the wheat pops with its seeds |
| piston pushes the farmland one block sideways, crop not part of the structure | crop pops next tick |
| bearing rotates a planter box with soil and crops | nothing pops (moved together, synchronous) |
| crop under a glass roof that is removed | not a support change (block above, not below): no pop |
| the farmland becomes water-logged / liquid flows into the crop's cell | not this rule (crops are replaceable; liquids replacing them is the flow's business) |
| dev mode / `__hw.setVoxel(x, y - 1, z, 'dirt')` | pops next tick (this is how the unit test and e2e set up the case) |
| tea bush on farmland, farmland becomes dirt | no pop: `BUSH_SOIL` contains dirt |
| two pops in one tick at the same key (queued by both rule 1 and rule 2) | Set collapses; one pop |
| pack full | irrelevant: drops go to the ground, the pack is never touched |

### 5.2 Heat engine accounting

1. `heatEngine.apply(node, ctx, dt)`: `followLoad(node, ctx)` (unchanged); `const shaftW = Math.max(0, Math.min(e.availW -
   e.outW, ctx.shaftUseW?.(e.x, e.y, e.z) ?? 0))`; `node.shaftW = shaftW`; `const used = e.outW + shaftW`; `if (used > 0 &&
   hottest) hottest.extractW += heatPerWatt x used`; piped water while `used > 0`.
2. `shaftUseW` is the workshop's figure of the PREVIOUS workshop tick (the workshop ticks after the sim). A 50 ms lag; the
   clamp to `availW - outW` keeps it from ever charging more than the engine could give this tick.
3. `ctx.setActive(node, e.availW > 0)` is unchanged (the block's lit look means "hot enough to work", not "working").
4. `Workshop.generatorUseW(x, y, z)` returns 0 for any position that is not a `GENERATOR_SHAFT` part, for a part whose
   network is jammed, overstressed or not turning, and otherwise `share_su / GENERATOR_SHAFT[kind].suPerW`.
5. Game wiring: `this.workshop.generatorWatts = (x, y, z) => { const v = this.state.sim.machineView(x, y, z); return v ?
   Math.max(0, v.availW - v.outW) : 0; }` and `this.state.sim.shaftUseW = (x, y, z) => this.workshop.generatorUseW(x, y, z)`.
6. Fluid-fed engines with no water: `availW` 0 -> nothing offered anywhere (unchanged).
7. A dead / unloaded engine: `availW` 0 (simulation.ts tick sets it for unloaded tickers) -> no capacity, no draw.

### 5.3 UI floors

1. Normal: no rendered text below 10 px (measured in the browser via `getComputedStyle(el).fontSize` over every element
   with a non-empty text node or `::after` content under `.hw-root` and `.hw-touch`). Large: no rendered text below 12 px.
2. Hotbar slots: every `.hw-hotbar .hw-slot` bounding box >= `--hw-tap` in both axes (44 / 52 px), at desktop 1280 x 800,
   phone portrait 390 x 844, phone landscape 844 x 390, Normal and Large.
3. Rows: 1 row when the viewport is wider than the thresholds of 4.3, else exactly 2 rows of 5 + 4. Never 8 + 1.
4. No overlap: the hotbar's bounding box does not intersect any `.hw-touch-btn` box nor a 24 px square around the
   crosshair centre.

### 5.4 Structure tab machines

1. `Simulation.structureView` fills `attached` (section 4.4) for the furnace at x, y, z, also when the hearth is not formed
   (a single-block furnace has machines too: a boiler on a Clay Furnace... is not possible by tier, but a thermopile is).
2. The tab hides the section only when the screen is not a furnace screen; with 0 machines it shows the head line and the
   empty hint.
3. Re-render only when the list's key (`block@x,y,z;...`) changes, as `updateMachines` does with `wayKey`.
4. A machine removed while its row's highlight cycles: next tap uses the refreshed list; a stale index wraps with `% N`.

### 5.5 Fluid statuses

Exactly the strings of 6.1, chosen by the same branches as today (no branch added or removed except: the turbine gains a
running line, the boiler's too-cold line gains numbers, the pump's "Still holds" gains a fix). The decision tree of
`fluidStatus` stays as it is; only the returned strings change.

---------------------------------------------------------------------------------------------------------------------------
