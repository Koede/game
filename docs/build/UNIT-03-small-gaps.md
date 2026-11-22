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

## 6. UI and feedback

### 6.1 Every changed string (before -> after)

All in `src/sim/fluidMachines.ts` (`fluidStatus`, `pumpFullStatus`) unless noted. Length = characters of the AFTER text.
`<f>` = `fluidName(key)` (lower-case fluid name, exists), `<T>` = furnace `Math.round(tempC)`, `<min>` = `BP.minTempC` (200).

#### 6.1.1 Pump

| # | branch | before | after | len |
|---|---|---|---|---|
| P1 | no source | `Must touch still water, lava or oil` | `Not touching still water, lava or oil - set it against one` | 58 |
| P2 | buffer holds another fluid | `Still holds <f>` | `Still holds <f> - pipe it out first` | <= 41 |
| P3 | full, an end pulls but the line has no room (ui-13) | `Full - the line has nowhere to put it` | `Full, 1 bucket - the line has no room, add a Tank` | 49 |
| P4 | full, piped, nothing pulls | `Full - nothing pulls from it` | `Full, 1 bucket - wrench the pipe end at the pump to Pull` | 56 |
| P5 | full, no pipe | `Full - connect a pipe that pulls` | `Full, 1 bucket - lay a pipe from it and wrench it to Pull` | 57 |
| P6 | pumping, finite body | `Pumping <f> - 200 L/s (the pool shrinks)` | `Pumping <f>, 200 L/s, the pool shrinks` | <= 44 |
| P7 | pumping, endless water | `Pumping water - 200 L/s` | `Pumping water, 200 L/s, never runs dry` | 38 |

"1 bucket" is `litresText(PUMP.fluids.capacityL)` (1000 L), never a literal.

#### 6.1.2 Boiler

| # | branch | before | after | len |
|---|---|---|---|---|
| B1 | no furnace | `Must sit on top of a furnace` | `Not on a furnace - set it on top of a furnace or hearth` | 55 |
| B2 | furnace below `minTempC` | `The furnace is too cold` | `Too cold, furnace <T> C - it boils from <min> C` | <= 47 |
| B3 | no water | `Needs water - pipe it in` | `No water - pipe water in from a Pump or Tank` | 44 |
| B4 | full, piped, its end does not pull | `Holds steam - wrench the pipe end at the boiler to Pull` | `Full of steam - wrench the pipe end at the boiler to Pull` | 57 |
| B5 | full, piped, pulled but unused | `Steam is not being used` | `Full of steam - nothing uses it, add a Steam Turbine` | 52 |
| B6 | full, no pipe | `Steam is not being used - pipe it to a turbine` | `Full of steam - pipe it to a Steam Turbine (hot pipe)` | 53 |
| B7 | boiling | `Boiling <n> L of steam a second` | `Boiling, <n> L/s of steam, <formatWatts(rateL x heatPerSteamL)> of heat` e.g. `Boiling, 800 L/s of steam, 16 kW of heat` | <= 48 |

#### 6.1.3 Steam turbine

| # | branch | before | after | len |
|---|---|---|---|---|
| U1 | piped, no end pulls from a boiler (sim-3) | `Steam line has no end pulling from a boiler - wrench the boiler end to Pull` (73, too long) | `No steam - wrench the pipe end at the boiler to Pull` | 51 |
| U2 | piped and pulled, nothing arrives | `No steam coming in` | `No steam - the boiler is cold or out of water` | 45 |
| U3 | not piped | `No steam - pipe it in through a hot pipe` | `No steam - pipe it in from a Boiler (hot pipe)` | 46 |
| U4 | **NEW** branch: holds steam, `outW > 0` (was the generic generator line) | `6 kW of 8 kW in use` | `Turning, 6 kW of 8 kW in use, 600 L/s of steam` | <= 50 |
| U5 | **NEW** branch: holds steam, `outW` 0 | `0 W of 8 kW in use` | `Ready - nothing on the cables uses power` | 40 |

#### 6.1.4 Still (same function; T8 commas only)

| # | before | after |
|---|---|---|
| S1 | `Refining crude oil - 40%` | `Refining crude oil, 40%` |
| S2 | `Needs <oilPerRunL> L of crude oil` | `Needs <litresText(oilPerRunL)> of crude oil` (a value of 1000 or more now reads in buckets) |
| S3 | `Fuel is full - pipe it out` | unchanged (already `<problem> - <fix>`) |

#### 6.1.5 Heat engine status (src/sim/gridViews.ts generator branch)

| # | branch | before | after |
|---|---|---|---|
| E1 | heat engine, `shaftW > 0` | `1.5 kW of 2 kW in use` (shaft invisible) | `1.5 kW to the grid, 400 W on the shaft, of 2 kW` (47) |
| E2 | heat engine, `shaftW` 0 | `1.5 kW of 2 kW in use` | unchanged (keeps power.test / machineText tests green) |
| E3 | engine hot, both outputs idle | `0 W of 2 kW in use` | unchanged - and the firebox "Heat drawn" reads `None` (firebox.ts:226 already prints `None` for 0) |

#### 6.1.6 Content strings (src/content/techMachines.ts `placementHint`, src/content/objectives.ts)

| id | before | after |
|---|---|---|
| `pump.placementHint` | `Must touch still water, lava or oil.` | `Set it against still water, lava or oil, wire it to power, and wrench the pipe end at the pump to Pull.` |
| `boiler.placementHint` | `Goes directly on top of a furnace or a hearth. Pipe its steam out through a hot pipe, and set the pipe end at the boiler to Pull with the wrench.` | `Set it on top of a furnace or a hearth. Lay a hot pipe from it to a Steam Turbine, and wrench the pipe end at the boiler to Pull.` |
| `steam_turbine.placementHint` | `Pipe steam in from a boiler through a hot pipe, and set the pipe end at the boiler to Pull with the wrench.` | `Lay a hot pipe from a Boiler to it, and wrench the pipe end at the boiler to Pull.` |
| objective `pump_water` text (objectives.ts:125) | `... lay Iron Fluid Pipe to a Tank or a machine, and wrench the pump end so it pulls.` | `... lay Iron Fluid Pipe to a Tank or a machine, and wrench the pipe end at the pump to Pull.` (only the last clause changes) |

The `desc` fields (techMachines.ts) and block descriptions (blocksTech.ts:50-56) already name the use and the number
("Boils piped water into ten times as much steam ... up to 800 litres a second, taking 20 J of heat for every litre");
they stay as they are. Item/block descriptions are paragraphs, not lines: "litres" spelled out is the existing voice there.

#### 6.1.7 Structure tab (new strings, src/ui/screens/furnace/structureText.ts + structureTab.ts)

| where | text |
|---|---|
| summary line, 0 | `Structure - no machines yet` |
| summary line, 1 | `Structure - 1 machine: <Name>` |
| summary line, n | `Structure - <n> machines: <Kind>[ xN], <Kind>...[, +k more]` (<= 60) |
| section head | `Machines (<n>)` |
| row main | `<Name>` / `<Name> x<N>` |
| row note after tap | `Shown in the world` / `Shown in the world - <i> of <N>` |
| row aria-label | `<Name> - show it in the world` / `<Name> x<N> - show them in the world one by one` |
| empty hint | `Set a Boiler, Steam Engine or Thermopile against the furnace to put its heat to work.` |

#### 6.1.8 Floor-related strings

None change. The PLACE label stays `PLACE` (only its size changes).

### 6.2 Where the player sees each change

- **Crop pop:** a short puff of soil-and-leaf debris (8 particles, the block's own colours - the existing `debris(x, y, z,
  voxel, count, scale)` in src/render/emitters.ts:77, called with count 8, scale 0.8), the `break` / `harvest` sound, the
  seeds hop out like any drop. No toast (it is not news; it is physics).
- **Engine:** the furnace screen's firebox "Heat drawn" figure (firebox.ts:226) moves with shaft load; the engine's
  machine screen status line (E1); the goggles kinetic line of the shaft network shows its capacity (unchanged format)
  now non-zero with no grid.
- **Floors:** visible only as legibility; no new UI.
- **Structure:** the new section in the STRUCTURE tab.
- **Wording:** machine screens' status line and the crosshair target line.

### 6.3 Phone layout

- Hotbar: section 4.3. At 390 x 844 portrait Normal, two rows (242-302 px wide x 101-127 px tall), centred in the bottom
  band; the touch cluster's portrait offsets are raised by the second row's height if they would overlap (assertion in
  10.3). At 844 x 390 landscape: one row (844 > 445).
- Structure rows: each row is a `button` of the existing `.hw-st__problem` style; min-height must be >= 44 px (`--hw-tap`).
  If `.hw-st__problem` is shorter today, add `min-height: var(--hw-tap)` to the NEW `.hw-st__machine` class rather than
  changing the shared class (structure.css). The list scrolls with the tab (no inner scroller).
- The summary line wraps at 390 px if needed (it is a screen line in a tab, not the HUD); the 60-character limit keeps it
  to two lines at the tab's font.

### 6.4 Sounds (T9)

No new `SfxName`; `sfx.test.ts` count unchanged.

| event | sound | volume tier |
|---|---|---|
| plant pops (sim) | `harvest` if ripe, else `break` (positioned at the block) | normal (1, the request default) |
| structure row tap | `ui_click` | small (default of UI sounds) |
| engine starts taking shaft load | none (machines make sound only when their state changes: the engine's active bit does not change) | - |

### 6.5 Particles

`plant:popped` -> `Emitters.debris(x, y, z, voxel, 8, 0.8)` (18 for `block:broken` today). Under the 24-per-emitter cap
(T9 rule 4). A field of 48 popping in one tick = 6 emitters' worth over 1-2 ticks; the existing particle pool handles a
TNT-sized burst already.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Type sketches

```ts
// src/sim/plantSupport.ts  (NEW)
export const PLANT_POPS_PER_TICK = 64;
export class PlantSupport {
  private readonly keys = new Set<string>();
  /** Remembers a cell whose plant may have lost its footing; checked on the next flush. */
  queue(x: number, y: number, z: number): void;
  get size(): number;
  /**
   * Checks up to `max` queued cells (insertion order) and calls `pop` for each one in a loaded chunk; every checked cell
   * leaves the queue whatever `pop` returns. Returns how many popped.
   */
  flush(world: IWorld, pop: (x: number, y: number, z: number) => boolean, max?: number): number;
  clear(): void;
}

// src/game/farming.ts  (NEW export, next to isUnsupported)
/**
 * Pops the plant at x,y,z if it no longer stands on what its `placeOn` needs: sets air (with `source`), drops
 * `rollDrops(def, rng)` through `drop` at the block centre, emits sfx harvest/break and, for source 'sim', 'plant:popped'.
 * Returns the popped voxel, or null when it was supported (nothing changes).
 */
export function popUnsupportedAt(
  world: IWorld, bus: GameBus, x: number, y: number, z: number, rng: () => number,
  drop: (stacks: ItemAmount[], at: { x: number; y: number; z: number }) => void,
  source: 'player' | 'sim',
): number | null;

// src/core/gameEvents.ts  (NEW event, appended)
'plant:popped': { x: number; y: number; z: number; voxel: number };

// src/sim/crops.ts  (NEW member)
class CropField { onBareSoil: ((x: number, y: number, z: number) => void) | null = null; }

// src/sim/entities.ts  (NEW optional / runtime members)
interface SimContext { shaftUseW?: ((x: number, y: number, z: number) => number) | null }
interface SimNode { shaftW: number }          // runtime only, 0 in the node factory (entities.ts ~193)

// src/sim/gridViews.ts
interface MachineView { /* existing */ shaftW: number }   // node.shaftW, 0 for non-engines

// src/workshop/workshop.ts  (NEW)
class Workshop {
  /** Watts a generator part's shaft network uses from it now (its share of the used stress / suPerW); 0 when stalled. */
  generatorUseW(x: number, y: number, z: number): number;
}

// src/sim/hearthView.ts  (NEW)
export interface AttachedMachine { x: number; y: number; z: number; block: string; name: string }
interface StructureView { attached?: AttachedMachine[] }

// src/ui/screens/furnace/structureText.ts  (NEW exports)
export interface MachineGroup { name: string; block: string; at: Array<[number, number, number]> }
export function machineGroups(list: readonly AttachedMachine[], from: { x: number; y: number; z: number }): MachineGroup[];
export function machinesLine(list: readonly AttachedMachine[], max?: number /* 60 */): string;

// src/sim/fluidMachines.ts  (NEW exports; fmtL removed)
export function litresText(litres: number): string;
export const WRENCH_PULL = (machine: string): string => `wrench the pipe end at the ${machine} to Pull`;
```

`popUnsupportedAt` returns the voxel (a number) rather than a boolean so the Interaction caller can emit `block:broken`
with it; the Simulation caller treats non-null as "popped". (`PlantSupport.flush`'s `pop` callback returns boolean:
`(x, y, z) => popUnsupportedAt(...) !== null`.)

### 7.2 Saved fields

None. `PlantSupport` is runtime; `SimNode.shaftW` is runtime; `StructureView.attached` is a view. No `world.persist` key,
no `PlayerSnapshot` field, no `SAVE_VERSION` change (T10 rule 3).

### 7.3 Old saves

- A save with floating crops: on load `resync` -> `CropField.track` (`DIRTY_ALL`) -> first `refresh` finds `soil` false ->
  `onBareSoil` queues -> next tick they pop and drop. The player who reloads finds seeds/wheat lying where the floating
  crops were (ground items despawn after `DESPAWN_S` 300 s - long enough to notice and pick up). A test covers this
  (9.1, "an old save's floating crop pops once its chunk is seen").
- Saves with a steam engine: no stored state is read differently; the shaft simply starts turning when it should.

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npx tsc --noEmit` and `npx vitest run` green)

**Step 1 - shared support helper.** `src/game/farming.ts`: add `popUnsupportedAt` (7.1) next to `isUnsupported`. Body: `if
(!isUnsupported(world, x, y, z)) return null; const voxel = world.getVoxel(x, y, z); const def = blockOf(voxel); if
(!world.setVoxel(x, y, z, AIR, source)) return null; drop(rollDrops(def, rng), { x: x + 0.5, y: y + 0.5, z: z + 0.5 });
bus.emit('sfx', { name: isRipeCrop(def) ? 'harvest' : 'break', x: x + 0.5, y: y + 0.5, z: z + 0.5 }); if (source ===
'sim') bus.emit('plant:popped', { x, y, z, voxel }); return voxel;`. Imports `rollDrops` from `./mining`, `blockOf` from
`../core/registry`, `GameBus` type from `../core/context`, `ItemAmount` from core types. Add `'plant:popped'` to
`GameEvents` in `src/core/gameEvents.ts` (append at the end of the map).

**Step 2 - Interaction uses it.** `src/player/interaction.ts` `popUnsupported(x, y, z)`: replace the body with the helper
call (source `'player'`, `this.rng`, `(s, at) => this.player.dropAll(s, at)`); when it returns a voxel, emit
`block:broken` with it (as today). Behaviour identical; existing tests of hand breaks stay green.

**Step 3 - PlantSupport.** New `src/sim/plantSupport.ts` (7.1). `queue` adds `posKey(x, y, z)` (from `./entities`); `flush`
iterates a snapshot of up to `max` keys, deletes each, parses it, skips unloaded (`world.isLoaded(x, z)`), calls `pop`.

**Step 4 - wire into Simulation** (`src/sim/simulation.ts`):
- field `private readonly support = new PlantSupport();`
- constructor, after `this.crops = new CropField(world, bus);`: `this.crops.onBareSoil = (x, y, z) => this.support.queue(x, y, z);`
- `onBlockChanged`: after `if (from.id === to.id) return;` and the destructuring, add `if (ev.source !== 'load' && y + 1 <
  WORLD_HEIGHT && blockOf(this.world.getVoxel(x, y + 1, z)).placeOn !== null) this.support.queue(x, y + 1, z);`
  (import `WORLD_HEIGHT` from core/types).
- `tick`: after `this.spills.place();`: `if (this.support.size > 0) this.support.flush(this.world, (x, y, z) =>
  popUnsupportedAt(this.world, this.bus, x, y, z, this.random, (s, at) => this.player.dropAll(s, at), 'sim') !== null,
  PLANT_POPS_PER_TICK);`
- `resync`: `this.support.clear()` next to `this.crops.clear()`.

**Step 5 - CropField hook** (`src/sim/crops.ts`): add `onBareSoil` member; in `refresh`, inside `if (d & DIRTY_SOIL) { ... }`
after computing `c.soil`, `if (!c.soil) this.onBareSoil?.(x, y, z);` (the wild-bush early return above already excludes
bushes). Update the class doc: "a crop whose soil is gone is reported through `onBareSoil` (the simulation pops it)".
Change `remove`'s doc comment "Nothing is handed back" to "Nothing is handed back here: the simulation drops a popped
plant's harvest (src/sim/plantSupport.ts)".

**Step 6 - debris for sim pops.** `src/render/emitters.ts:77` area: add `bus.on('plant:popped', (e) => this.debris(e.x, e.y,
e.z, e.voxel, 8, 0.8))`. Check the `debris` signature's last parameter meaning (it is passed `1` for breaks) and keep the
same meaning (smaller burst).

**Step 7 - engine accounting.**
- `src/sim/entities.ts`: `SimContext.shaftUseW?` optional; `SimNode.shaftW: number`, initialised `0` in the node factory
  (where `furnaces: []` is set, ~line 193).
- `src/sim/simulation.ts`: public field `shaftUseW: ((x: number, y: number, z: number) => number) | null = null;` (Simulation
  implements SimContext / ActionHost: it satisfies the optional member).
- `src/sim/machines.ts` `heatEngine.apply`: as 5.2 rule 1. Update the doc comment: "...by heatPerWatt times the power
  actually USED - on the cables (`outW`) and on a shaft (`shaftW`, the workshop's figure via `ctx.shaftUseW`). Idle on
  both: no heat."
- `src/sim/gridViews.ts`: `MachineView.shaftW = node.shaftW ?? 0`; generator status: when `e.availW > 0 && view.shaftW >
  0` return E1; else unchanged.
- `src/workshop/workshop.ts`: add `private readonly sourceCap = new Map<string, number>();` filled in the network solve:
  where the sources of a network are collected (`sources.set(key, src)` from `sourceFor`) record `this.sourceCap.set(key,
  src.capacity)`; clear it at the start of each solve pass. `generatorUseW(x, y, z)`: `const key = k3(x, y, z); const p =
  this.parts.get(key); const g = p && GENERATOR_SHAFT[p.kind]; if (!g) return 0; const info = <the NetInfo of that part>;
  const cap = this.sourceCap.get(key) ?? 0; if (!info || info.jammed || info.overstressed || info.rpm <= 0 || cap <= 0 ||
  info.capacity <= 0) return 0; return (Math.min(info.stress, info.capacity) * cap / info.capacity) / g.suPerW;` The
  NetInfo per part is whatever the existing `for (const key of members)` loop after `const info: NetInfo = ...` (workshop.ts
  ~line 425) stores it in; use that map. If the solve multiplies capacity by the `LUBE` factor, multiply `cap` by the same
  factor (or divide `info.capacity` by it) so the share is computed on like terms; add a test for it (9.2).
- `src/app/game.ts:162`: `generatorWatts` reads the spare (5.2 rule 5) and the next line sets `this.state.sim.shaftUseW`.
  Check `GameState` exposes `sim` as used (`this.state.sim.machineView` is already used there).

**Step 8 - UI floors.**
- `src/ui/hud/hud.css:714`: `font: 600 10px / 1 var(--hw-font-mono);`
- `src/ui/styles.css:1001`: `font: 600 10px / 1 var(--hw-font-display);`
- `src/player/input/touchStyles.ts:98`: `.hw-touch-btn--place .hw-touch-label { font-size: 10px; letter-spacing: 0.02em; }`
- `src/ui/hud/hud.css` after the `.hw-hotbar .hw-slotgrid` rule: `@media (max-width: 445px) { .hw-hotbar .hw-slotgrid {
  --hw-cols: 5; } }` and in `src/ui/hud/combat.css` with the Large rules: `@media (max-width: 509px) {
  .hw-root[data-ui-scale='large'] .hw-hotbar .hw-slotgrid { --hw-cols: 5; } }`. Verify the hotbar's `max-width` formula
  (`--hw-cols x --hw-slot-max + gaps`, styles.css:1065) gives the narrow two-row block and that `.hw-hotbar` centres it
  (it is `width: min(100%, 520px)` - add `width: fit-content; margin-inline: auto` inside the media query if the plate
  stretches wider than the grid).
- Portrait touch cluster (touchStyles.ts): if the e2e overlap assertion fails, raise the portrait `--hw-touch-b` (or the
  hotbar's bottom offset) by the second row (44 + 3 px, 52 + 2 px Large). Do not move the hotbar above the crosshair band.
- Add the CSS floor test (9.4).

**Step 9 - structure tab machines.**
- `src/sim/hearthView.ts`: export `AttachedMachine`, add `attached?` to `StructureView`.
- `src/sim/simulation.ts` `structureView(x, y, z, target?)`: after building the view, `view.attached = this.attachedTo(node)`.
  NEW private `attachedTo(furnace: SimNode): AttachedMachine[]`: (1) `for (const n of this.nodes.all) if (n !== furnace &&
  n.furnaces.includes(furnace.e as FurnaceEntity)) push(n)`; (2) `else if (n.spec.role === 'hearth_part' &&
  this.hearths.shellOwner(n.key)?.e === furnace.e) push(n)`; (3) `for (const e of this.world.entities()) if
  ((isChemKind(e.kind) || isBrewKind(e.kind)) && this.furnaceUnder(e.x, e.y, e.z) === furnace.e) push(e)`; `push` reads
  `blockOf(world.getVoxel(x, y, z))` for `block` and `name`, de-duplicates by position. (Use whatever collection
  `NodeSet` exposes for all nodes - simulation.ts constructs `new SafeZones(() => this.nodes.all)`, so `nodes.all` exists.
  Check `furnaceUnder`'s return type and compare entities, not nodes.)
- `src/ui/screens/furnace/structureText.ts`: `machineGroups`, `machinesLine` (4.4, 6.1.7).
- `src/ui/screens/furnace/structureTab.ts`: NEW fields `machinesHead: HTMLElement`, `machinesLineEl`, `machinesList`,
  `machinesHint`, `machinesKey = ''`, `machineRows: { el, note, group, next }[]`; build them in the constructor and insert
  them after the shift row / rules, before the "In the way" head. NEW `private updateAttached(list: AttachedMachine[] |
  undefined)` called from `update()` next to `this.updateMachines(t.machines)` (rename nothing). Row click: highlight
  `group.at[row.next]`, set the note text with `i of N`, advance `row.next = (row.next + 1) % N`, hide other rows' notes,
  sfx `ui_click`.
- `src/ui/screens/furnace/structure.css`: `.hw-st__machine { min-height: var(--hw-tap); }` and the muted hint style
  reusing existing tokens (`--hw-ink-muted`, `--hw-fs-sm`).

**Step 10 - wording.** `src/sim/fluidMachines.ts`: add `litresText`, `WRENCH_PULL`; delete `fmtL`; rewrite the returned
strings of `pumpFullStatus` and `fluidStatus` per 6.1 (the turbine's `if (heldL(e, 'steam') > 0) return null;` becomes
the U4/U5 branch: `return e.outW > 0 ? \`Turning, ${formatWatts(e.outW)} of ${formatWatts(e.availW)} in use,
${Math.round(e.rateL ?? 0)} L/s of steam\` : 'Ready - nothing on the cables uses power';`). Import `formatWatts` from
`../game/objectives` (gridViews already does; follow its import). Update the file header comment's pump/boiler bullets if
they quote strings. `src/content/techMachines.ts`: the three `placementHint` strings (6.1.6). `src/content/objectives.ts:125`:
the last clause.

**Step 11 - fix the tests that quote old strings.** `grep -rn "nowhere to put it\|nothing pulls from it\|connect a pipe that
pulls\|Holds steam\|Steam is not being used\|Needs water - pipe it in\|Steam line has no end\|No steam coming in\|pipe it in
through a hot pipe\|Must touch still water\|Must sit on top of a furnace\|of steam a second\|the pool shrinks\|Refining crude
oil -" src scripts` and update each expectation to the new text (they assert wording, not behaviour). Note:
`'Must sit on top of a furnace'` is ALSO the steam engine's placement problem in `placementProblem` (machines.ts:44) -
**leave that one unchanged** (it is the engine's, not the boiler's; out of scope).

**Step 12 - docs** (section 11), then the e2e steps (section 10).

Helpers reused, not rewritten: `isUnsupported`, `rollDrops`, `isRipeCrop`, `PlayerState.dropAll`, `posKey`, `formatWatts`,
`fluidName`, `heldL`, `HEARTH_HIGHLIGHT_S`, `h`/`setText`/`glyph` of the ui kit as structureTab.ts already imports them.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest; exact files, names, assertions)

### 9.1 `src/sim/plantSupport.test.ts` (NEW) - uses `makeKit()` from `src/sim/testKit.ts` (`kit.world.put`, `kit.run`)

1. `it('a crop whose farmland is replaced by a machine pops on the next tick and drops its seeds')` - put `farmland` at
   (0, 1, 0) and `wheat_0` at (0, 2, 0); `kit.run(0.05)`; set (0, 1, 0) to `dirt` with source `'sim'`; assert the block at
   (0, 2, 0) is still `wheat_0` immediately (deferred); `kit.run(0.05)`; assert `air`; assert
   `kit.player.ground.count('wheat_seeds') >= 1` (or the stage-0 drop item read from `block('wheat_0').drops[0].item`, not
   a literal); assert `kit.sim.cropCount` (the existing count getter at simulation.ts:818, whatever its name) dropped by 1.
2. `it('a ripe crop pops with its harvest')` - same with the ripe stage key (compute as `wheat_${stages - 1}` via
   `cropStage` from src/game/farming.ts); assert the ground holds `wheat`.
3. `it('a sim pop emits plant:popped and not block:broken')` - spy on `kit.bus`: one `plant:popped` with the voxel, zero
   `block:broken`; one `sfx` named `break` (young) / `harvest` (ripe).
4. `it('a field moved together with its soil in one pass does not pop')` - in one synchronous block: set (0,1,0) and
   (0,2,0) to air, then set (1,1,0) farmland and (1,2,0) `wheat_0` (simulating a contraption move); `kit.run(0.1)`; assert
   (1, 2, 0) is still `wheat_0` and nothing dropped.
5. `it('a tea bush stays when its farmland becomes dirt')` - `tea_bush_bare` on farmland -> dirt: no pop.
6. `it('an old save\'s floating crop pops once its chunk is seen')` - build a world where `wheat_0` stands on `stone`
   (with its crop entity), `kit.sim.resync()`, `kit.run(0.1)`: air, seeds on the ground.
7. `it('pops at most PLANT_POPS_PER_TICK per tick and finishes the rest after')` - 80 crops on a farmland row, replace all
   80 farmland with dirt; after one tick 64 are air, after two ticks 80.
8. `it('a crop in an unloaded chunk is not popped until it loads')` - queue a pop at a position the kit reports unloaded
   (if the kit cannot unload, test `PlantSupport.flush` directly with a fake `IWorld` whose `isLoaded` returns false:
   `pop` is not called and `size` is 0 afterwards).
9. `it('load-sourced block changes never queue a pop')` - emit a `block:changed` with `source: 'load'` under a crop: queue
   size stays 0 (call through the bus, read `size` via a test-only accessor or by observing no pop after one tick while the
   crop's own refresh is suppressed - prefer the direct `PlantSupport` unit test if the kit makes this awkward).

### 9.2 `src/sim/power.test.ts` (extend `describe('heat engines')`)

1. `it('a steam engine with nothing to feed takes no heat')` - the 820 C rig of the existing test WITHOUT the battery;
   `kit.run(60)`; `engine.availW` 2000; `engine.outW` 0; furnace `extractW` (read via the firebox view `furnaceView(...).extractW`
   or the entity after a run) 0.
2. `it('a steam engine pays heat for the shaft work it does')` - same rig, no battery; set `kit.sim.shaftUseW = () => 500`;
   run; furnace drew `3 x 500` = 1500 W (`toBeCloseTo(1500, 6)` on the value sampled after `apply`, before `applyFurnace`
   clears it - if the entity's `extractW` is cleared by the time the test reads it, read `furnaceView(...).extractW` which
   is the last tick's draw, as firebox.ts does).
3. `it('shaft heat never exceeds the spare watts')` - battery taking 1800 W, `shaftUseW = () => 900`: drawn `3 x 2000`
   (clamped: 1800 + 200), `machineView.shaftW` 200.
4. `it('the engine status names the shaft share')` - with `shaftUseW = () => 400` and a lamp: status starts `"10 W to the
   grid, 400 W on the shaft, of "` (use `formatWatts` to build the expectation, not literals).

### 9.3 `src/workshop/kinetics.test.ts` (extend; it already stubs `generatorWatts` at line 136)

1. `it('a generator\'s used watts are its share of the network stress')` - `generatorWatts = (x) => x === 0 ? 400 : 0`
   (8 su), a millstone on the shaft; tick; `shop.generatorUseW(0, y, z)` equals `stressOfMillstone / (1/50)` within 1e-6
   (compute stress with the same `BASE_STRESS x clamp(16/|rpm|, 0.25, 4)` rule the test file already uses).
2. `it('two sources share the load by capacity')` - generator 400 W (8 su) + a turning crank (8 su) on one network, load
   6 su: generator uses 3 su = 150 W.
3. `it('a stalled network uses nothing from its generator')` - overload past capacity: `generatorUseW` 0.
4. `it('oil does not change a generator\'s share')` - same as 1 with the network oiled (`LUBE.residue`): same watts.
5. `it('a non-generator part reports 0')`.

### 9.4 `src/ui/uiFloors.test.ts` (NEW, node environment, reads files with `node:fs`)

1. `it('no stylesheet sets a caption under 10 px')` - read every `*.css` under `src/ui` (recursive) plus the CSS string
   exported or embedded by `src/player/input/touchStyles.ts` (import the module's exported style text if it exports one;
   else read the file as text); regex every `font-size:\s*([\d.]+)px` and every `font:\s*[^;]*?([\d.]+)px` (the FIRST px
   number of the shorthand = the size); assert each >= 10. Values inside `calc(...)` are checked as their px literal
   (e.g. `calc(10px * var(--hw-ui-scale, 1))` -> 10). Report the file and line of any failure.
2. `it('the hotbar minimum slot is the tap size')` - `src/ui/styles.css` contains `--hw-slot-min: var(--hw-tap)` in
   `.hw-slotgrid`, `--hw-tap: 44px` in `:root` and `52px` under `[data-ui-scale='large']`.
3. `it('the hotbar switches to five columns where nine do not fit')` - hud.css contains the `max-width: 445px` media rule
   with `--hw-cols: 5`; combat.css the `509px` Large one. (Layout itself is verified in the browser, 10.3.)

### 9.5 `src/ui/screens/furnace/structureLogic.test.ts` (extend; tests the pure text helpers)

1. `it('machinesLine counts machines and groups kinds')` - list Boiler, Steam Engine, Steam Engine, Item Hatch ->
   `'Structure - 4 machines: Boiler, Item Hatch, Steam Engine x2'` (alphabetical; note the T8 example's order is
   illustrative).
2. `it('machinesLine says when there are none and when there is one')` - `[]` -> `'Structure - no machines yet'`; one
   Boiler -> `'Structure - 1 machine: Boiler'`.
3. `it('machinesLine stays within 60 characters')` - 9 distinct long names -> length <= 60 and ends with `+<k> more`
   where k = kinds left out; the count still says 9.
4. `it('machineGroups orders instances nearest first')`.

### 9.6 `src/sim/hearth.test.ts` (extend, beside "a steam engine on the ceiling and a thermopile on a wall work the furnace", line 308)

1. `it('the structure view lists the machines working with the hearth')` - same rig; `kit.sim.structureView(...)!.attached`
   contains the steam engine and the thermopile by block key, length 2; add an item hatch in the shell -> 3; a tank two
   blocks away connected by nothing -> still 3.
2. `it('a still base on a furnace top is listed')` - place `still_base` on a single furnace: attached includes it.

### 9.7 `src/sim/fluidMachines.test.ts` (extend; and update existing string expectations per step 11)

1. `it('litresText reads litres below a bucket and buckets above')` - 0 -> `'0 L'`, 250 -> `'250 L'`, 999 -> `'999 L'`,
   1000 -> `'1 bucket'`, 1500 -> `'1.5 buckets'`, 16000 -> `'16 buckets'`.
2. `it('every pump, boiler and turbine status is T8 grammar within 60 characters')` - drive each branch of 6.1 (P1-P7,
   B1-B7, U1-U5) with the existing fixtures (`makeKit`, `pipeKit.ts` for links), collect the strings, and assert for each:
   length <= 60; no `!`; matches `/^[A-Z]/`; contains no `°`; problems (P1-P5, B1-B6, U1-U3) contain exactly one `' - '`;
   every one containing "Pull" contains `WRENCH_PULL('<machine>')` or the P5 short form.
3. `it('the boiler too-cold line names both temperatures')` - furnace at 150 C -> `'Too cold, furnace 150 C - it boils from
   200 C'` built from `machine('boiler').params.minTempC`.
4. `it('a turning turbine says how much and from how much steam')` - U4 matches `/^Turning, .+ of .+ in use, \d+ L\/s of steam$/`.

### 9.8 `src/content/techContent.test.ts` (extend)

1. `it('pipe advice uses one wrench phrase')` - for `pump`, `boiler`, `steam_turbine`, `placementHint` contains `wrench the
   pipe end at the` and does not contain `boiler end` or `with the wrench`.

---------------------------------------------------------------------------------------------------------------------------
