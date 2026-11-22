# Technology spine - design dossier for the builders (Steam, Bronze, distillery rest, workshop polish)

Advisor note, 2026-11-21, branch `ccr-3c8b169f-e78nk2`. READ-ONLY pass: nothing was built or run; the six-age refactor (W0) was still in
the checkout, so line numbers can drift (symbol and file names are stable). Sources read: `STEAM_PLAN`, `BRONZE_PLAN`, `DISTILLERY_PLAN` s.15,
`OVERHAUL_PLAN` A, `WHATS_LEFT`, `team.md`, `CONGRUENCE.md`, `docs/api/{workshop,distillery,sim,transport,tech-content}.md`, and code in
`src/workshop/{kinetics,workshop}.ts`, `src/sim/{pipeGraph,fluidNet,hearthScan,...}.ts`, `src/content/tech*.ts`.
Items marked **(verify)** are claims I could not confirm in code.

Fixed by the owner (not relitigated): six ages Ember/Bronze/Forge/Current/Atomic/Star; Ember = handwork only; Bronze = steam, shafts, then the
boiler multiblock; Forge = iron/steel + dynamo at the end; Current = electricity and the modern steam turbine; furnace is the heart of the base;
original names; in-world interaction first, phone first.

---

## 0. The decisions that shape everything (read this first)

| # | Decision | Why |
|---|---|---|
| K1 | **One shaft world: `src/workshop` (kinetics.ts + workshop.ts). `MechSpec`/`mech.ts`/`mechGraph.ts` of STEAM_PLAN are NOT built.** Steam, wind and water become *source providers*, dynamo/compressor/pump become *load providers*, of that solver. | Built, tested, saved; 3000 lines. Matches CONGRUENCE D1. |
| K2 | **One power convention: shaft power W = `su x |rpm| x 3.125`** (`W_PER_SU_RPM = 50/16`). It is the *existing* `suPerW = 1/50` at 16 rpm, so nothing built has to change, and it makes every conversion a one-line ledger entry. | The plans' engine numbers (6 kW heat -> 768 su at 96 rpm = 230 kW) violate conservation by ~100x. See section 1.5. |
| K3 | **Energy ledger: heat (W) -> steam (L/s at 167 J/L) -> shaft (W) -> {work, air, watts}. Every arrow has an efficiency < 1 that lives in ONE table (`src/core/energy.ts`) and ONE conservation test.** | Free-energy loops are the biggest balance trap (section 4). |
| K4 | **Gas (steam, air) is a pressure model on the existing pipe graph, not a second graph.** `GasNet extends PipeNet` (like `FluidNet`), `PipeSpec.family` gains `'steam' | 'air'`; flood fill, joints, anchors, saving and pipe meshing are reused. Only **heat** (thermocouples) needs a tiny new graph (`heatNet.ts`, same flood helper). BRONZE_PLAN's full `netGraph<T>` generalisation of `pipeGraph.ts` is **dropped**. | `pipeGraph.ts` (318 lines) also carries the Forge item/fluid nets; rewriting it is the riskiest edit in the plan and buys nothing. |
| K5 | **No key renames, no re-meaning of existing keys.** Old `boiler`, `steam_engine`, `steam_turbine`, `water_wheel`, `wind_turbine` stay exactly as blocks/machines (display names change, `age` changes, `legacy` flag). New Bronze things get NEW keys: `boiler_plate`, `boiler_gauge_glass`, `beam_engine` (not `piston_engine`: collides with workshop `piston`), `mill_wheel`, `windmill`, `steam_kettle` (CONGRUENCE), `steam_rotor`. | Voxels store ids by palette key; an alias that points an old saved boiler at a vessel controller would silently convert saves. CONGRUENCE D3/D4 proposed renames; this supersedes them (record in its conventions sheet). |
| K6 | **Retire the watt->shaft bridge `GENERATOR_SHAFT` in `workshop.ts` (and `generatorWatts`).** Legacy generators produce watts only. The only shaft->watts bridge is the Forge `dynamo`; there is no watts->shaft block until Current. | Removes the loop generator -> shaft -> dynamo (section 4, R3). |
| K7 | **Engines draw steam in proportion to the shaft's load**, not at full rate (`Workshop.loadFraction(x,y,z)`), with a 10% idle draw. | Fixes "steam engine draws heat when idle" (SESSION_CONTEXT s.6) and gives the pressure gauge meaning. |
| K8 | The Bronze steam `steam` gas is **not** the pipe-fluid `FluidKey 'steam'` (1 L = 20 J, Forge/Current). Gas L are "volume at 1 bar of this network". No `FluidKey` change; families never join. | Avoids editing the closed `FluidKey` union and the old boiler/turbine numbers. |

---

## 1. The unified kinetic / heat / fluid model

### 1.1 Units (all new code uses these; nothing else)

| Quantity | Unit | Notes |
|---|---|---|
| Temperature | degC (float in sim, integer display) | `AMBIENT_TEMP_C` 20 |
| Heat flow | W (display kW) | furnace `extractW` bus (existing) |
| Gas amount | litres at network bar; `bar = L / volumeL` | steam and air |
| Liquid | L in code. "mL" appears only on glassware/beaker labels (CONGRUENCE 4.2). The user's "mL" = beaker sizes; machines are L | |
| Shaft speed | rpm signed | base 16 |
| Stress | su; **capacity** of sources, **load** of machines | `BASE_STRESS x clamp(16/|rpm|, .25, 4)` (existing) |
| Power conversion | `W_PER_SU_RPM = 3.125` | K2 |
| Electric | W (Forge dynamo end, Current) | existing |
| Pressure | bar (display 1 decimal) | |

Hard consequence of K2 and the existing stress formula: a machine's *load power* is `base x 16 x 3.125 = base x 50 W` at any rpm in 4..64 (constant power),
and *conservatively higher* above 64 rpm (clamp .25 keeps base x 0.25 su while pure physics would drop further). So gearing up never creates energy. Table of
machine powers: crank-fed quern/saw 4 su = **200 W**; drill 6 su = 300 W; hammer/press 8 su = 400 W; belt 0.25 su = 12.5 W.

### 1.2 The ledger (`src/core/energy.ts`, new, constants + tiny pure functions; T0)

```ts
export const W_PER_SU_RPM = 3.125;
export const STEAM_J_PER_L = 167;           // 1 kW of heat = 6 L/s of steam (BRONZE_PLAN 5.2, kept)
export const WATER_PER_STEAM = 0.1;         // L water per L steam (kept)
export const AIR_J_PER_L = 6.25;            // shaft energy stored per L of compressed air
export const ETA = {                        // every arrow < 1; one place to tune
  rotor: 0.06,                              // Hero-style open rotor: weak on purpose
  beamEngine: (bar: number) => Math.min(0.18, 0.04 + 0.025 * bar),   // 2 bar .09 ... 5.6+ bar .18
  steamHammer: 0.12, compressor: 0.75,
  dynamo: 0.85,                             // Forge
  hotPlate: 0.9, thermocoupleLossPerBlock: 0.02,
} as const;
export const suFromW   = (w: number, rpm: number) => w / (Math.abs(rpm) * W_PER_SU_RPM);
export const wFromSu   = (su: number, rpm: number) => su * Math.abs(rpm) * W_PER_SU_RPM;
```

Test (`src/core/energy.test.ts`, T0): for every source provider at its max, `shaftW <= heatW_in x ETA`, and for every pair of converters that can chain
(`dynamo` then any watts->shaft block, `compressor` then pneumatic tool, `mech_pump` then wheel) the product of efficiencies is < 1.

### 1.3 Three layers, one pattern

```
HEAT  (W)         furnace fire  --draw--> {kettle, thermocouple net, boiler heat port, still base, brewing pail, hot plate}
  |  furnace.extractW is the single bus (exists). All draws go through heat.draw(); losses are paid by the fire.
GAS   (L, bar)    boiler / kettle --steam--> {beam engine, rotor, steam hammer, whistle, valve}        (family 'steam')
                  compressor --air--> {tank, pneumatic press/drill/hammer, vacuum pump, blast nozzle}  (family 'air')
SHAFT (rpm, su)   source providers  --solveNetwork()-->  load providers (machines, dynamo, compressor, mech_pump, stirrer)
```

Each layer is "a network of members + a pure tick function + entities saved on an anchor + a snapshot for render". No layer reaches into another except
through three narrow seams, all declared in T0 so builders do not edit each other's files:

| Seam | Contract (file) | Producer -> consumer |
|---|---|---|
| Heat draw | `sim/heat.ts`: `drawHeat(f: FurnaceEntity, wantW: number, minTempC: number): { gotW, tempC }` (`f.extractW += gotW`, capped by what the fire can give this tick; refuses under `minTempC`) | all heat users |
| Steam use | `GasNet.take(L)`, `GasNet.put(L)`, `net.bar`; engines call `take` | boiler/kettle put, engines take |
| Shaft | `workshop/sources.ts`: `SourceProvider`, `LoadProvider`, `Workshop.addSourceProvider/addLoadProvider`, `Workshop.loadFraction()` | gas users that turn shafts |

### 1.4 Data contracts (append-only; T0 lands all of them in one commit so builders start from a green tree)

```ts
// core/types.ts (append)
export interface HeatSpec { role: 'conductor' | 'user' | 'port'; capW?: number; demandW?: number; minTempC?: number }
export interface GasSpec  { family: 'steam' | 'air'; role: 'pipe' | 'tank' | 'user' | 'source' | 'valve' | 'gauge' | 'port' | 'station';
                            volumeL: number; ratedBar: number; minBar?: number }
// BlockSpec: heat?: HeatSpec; gas?: GasSpec; legacy?: boolean (hidden in Codex, still works)
// PipeSpec.family: 'item' | 'fluid' | 'heat' | 'steam' | 'air'   (BlockShape 'pipe' reused; families never join)
export interface StructureRules { key: string; controller: string; walls: string[]; interior: 'air';
  minInner: [number, number, number]; maxInner: [number, number, number];
  faceParts: string[]; roofParts: string[]; required: Record<string, number> }
// MachineRole gains 'vessel' (boiler controller) and 'gas' (steam/air devices that own no watts and no shaft)

// workshop/sources.ts (new)
export interface Env { windAt(x:number,z:number):number; flowAround(x:number,y:number,z:number):number; skyOpen(x:number,y:number,z:number):boolean; dt:number }
export interface SourceSample { rpm: number; powerW: number }            // capacity = suFromW(powerW, rpm)
export interface SourceProvider { kinds: readonly string[]; sample(c: Cell, env: Env): SourceSample | null }
export interface LoadProvider   { kinds: readonly string[]; minRpm: number; wantW(c: Cell, rpm: number): number; give(c: Cell, gotW: number, dt: number): void }
// Workshop: loadFraction(x,y,z): number  // 0..1 stress/capacity of the network that cell is on (1-tick old)

// core/gameEvents.ts (append)  'steam:vent' {x,y,z,rateL}  'steam:warning' {x,y,z,bar,rated,on}  'steam:burst' {x,y,z,radius}
//   'air:leak' {x,y,z}  'boiler:formed' | 'boiler:unformed' {x,y,z}  'boiler:dry' {x,y,z,seconds}  'heat:burn' {x,y,z}
//   'distill:step' {rig, from, to}   flags: first_motion heat_moved boiler_formed engine_turning air_2bar tube_delivery press_job geared_up shaft_bellows
// SfxName: valve_shriek boiler_burst boiler_formed boiler_rattle air_hiss beam_creak pneumatic_thump tube_whoosh steam_whistle scald kettle_rumble
// core/constants.ts: the BRONZE_PLAN list (THERMO_*, BURST_SECONDS 5, AIR_MAX_BAR 6, DRY_WARN_S 5, DRY_WARP_S 20, VALVE_MAX_VENT_L_S 400, ...) minus the ones in energy.ts
```

### 1.5 What the plans got wrong, numerically (so nobody copies them)

| Plan number | Implied shaft power | Heat in | Verdict |
|---|---|---|---|
| STEAM_PLAN rotor 32 rpm x 256 su, 20 L/s (3.3 kW) | 25.6 kW | 3.3 kW | 8x free. **Use 16 rpm x 4 su = 200 W (6%).** |
| BRONZE_PLAN engine 6 bar: 96 rpm x 768 su, one 6 kW port | 230 kW | 6 kW | 38x free. **Use ledger: 1.8 kW from a 10 kW port.** |
| STEAM_PLAN water wheel 64 su per flowing side, 16 rpm | 3.2 kW per side | free | dwarfs steam. **Mill wheel 6 su/side (300 W), max 3 sides.** |
| Old watt generators as shaft sources `W/50 su` | consistent with K2 | - | consistent, but breaks the loop rule (K6) |

Worked example that becomes `steam.test.ts` (smallest vessel: interior 1x1x2 = 2 cells, steam volume 2000 L, + 10 steam pipes 1000 L = 3000 L; one heat port, **10 kW**):
steam made `10 kW x 6 = 60 L/s`. One beam engine draws `10 L/s per bar` at full load -> equilibrium `bar = 6`, `eta = .18`, shaft `.18 x 60 x 167 = 1.8 kW`, rpm 96,
**capacity 6.0 su**. Two engines: 3 bar each, `eta = .115`, 576 W each, 48 rpm, 3.84 su each, total 1.15 kW (< 1.8 kW: the player learns that one hot engine beats two cool ones).
No user, no valve: 60 L/s into 3000 L = 0.02 bar/s: 7 bar in ~5.8 min, burst 5 s after crossing the rating. (Tune by `HEAT_PORT_W`, never by shrinking volume.)

### 1.6 Existing code: reuse / retire / rename

| Existing | Fate |
|---|---|
| `workshop/kinetics.ts` `solveNetwork`, `passOn`, `BASE_STRESS` | **Keep.** Extend: add dynamic loads (section 3.1), new part kinds (engine, rotor, windmill, mill_wheel, compressor, dynamo as kinds with `BASE_STRESS` 0 + provider). |
| `workshop.ts` `GENERATOR_SHAFT`, `generatorWatts`, `extraRpm` | **Retire** `GENERATOR_SHAFT`/`generatorWatts` (K6). `extraRpm` becomes `SourceProvider`s. Tests that touch generator shafts are rewritten (T1). |
| `workshop.ts` `LUBE` (residue 1.25 x 10 min, pine resin 1.1 x 5 min) | Keep; move the table to `content/lube.ts` (data) so the distillery adds `lubricant_can` without touching `workshop.ts` (T0). |
| `sim/pipeGraph.ts`, `pipeNet.ts`, `fluidNet.ts`, anchors, `transport.ts` | **Reuse** for gas: add `GasNet extends PipeNet`; `Transport.tick` also ticks gas nets after furnaces; family tables get two entries. No change to item/fluid behaviour (tests prove it). |
| `sim/itemNet.ts` (packets, destinations) | Reuse for the Bronze Chute with a `suction` flag (section 2.8). |
| `sim/hearthScan.ts` (441 lines) | Extract the box-scan core into `structureScan.ts` **inside T4** with hearth tests unchanged and green; the boiler is a second client (BRONZE_PLAN 14.5 stands). |
| `sim/fluidMachines.ts` boiler/turbine, `content/tech*.ts` boiler/steam_turbine/steam_engine | Untouched logic. Display names: `boiler` -> "Furnace Boiler", `steam_engine` -> "Steam Dynamo"; `age` -> Forge/Current; recipes unchanged; Codex shows them under their age. Add `legacy:true` only if W0 removes their recipes. |
| `game/collectors.ts` (vacuum/hand pump) | The ONE pull algorithm (CONGRUENCE D7). The chute's vacuum pump registers a collector kind. |
| `sim/brewing.ts` / `distill.ts` `furnace.extractW +=` | Route through `drawHeat()` in T2 (mechanical edit, behaviour identical) so the bus has one door. |

---

## 2. Feature designs

Each: **Player sees/does** - **Numbers** - **Art/anim/sound** - **Status sentence** (<= 70 chars) - **Owns** (task id, section 5).

### 2.1 Wooden power: windmill and mill wheel (first rotation without fire) - T1
- *Player:* a windmill on a hillside, wooden axle down to a quern; a mill wheel in a stream. Goggles: "Windmill: 12 rpm, load 2/4 su".
- *Numbers:* `windmill` rpm `8 + 16 x w` (w = `windAt` 0..1, + altitude bonus `min(0.3, (y-62)/100)`), `powerW = 100 + 300 x w`, needs `skyOpen` and no other windmill within 5 blocks (spam guard, R4). Storm gust (w>0.9 for 3 s): load spike x1.5 -> a fitted shear pin snaps first. `mill_wheel`: 16 rpm, 6 su (300 W) per flowing-water side (flowing = variant>0 or falling), max 3 sides; frozen water (frost) gives 0; counts only the wheel's two lateral faces.
- *Art:* four-sail frame that turns by rpm, sails furl in a storm (idle at w<0.1); wheel with paddles whose water-side blades darken. Sound: windmill creak layer by w; wheel splash loop (reuse water ambience, volume by rpm). Texture painters in `render/textures/steam.ts`.
- *Status:* "Windmill: 12 rpm, wind 0.6, load 2/4 su" / "Mill Wheel: needs flowing water on a side".

### 2.2 Steam kettle + rotor: "heat makes motion" - T2
- *Player:* place the Copper Steam Kettle (`steam_kettle`) on a Clay/Bronze furnace, pour a pail in, put a `steam_rotor` on top, an axle beside it; the rotor whirls and the quern behind it starts.
- *Numbers:* kettle holds 4000 L water; boils when furnace >= 120 C: steam rate `20 L/s x demand` where demand = 1 only while a rotor (or whistle) wants steam (open kettle: no pressure, no burst); heat `3.3 kW` (`drawHeat`); rotor `eta .06`: **16 rpm, 4 su (200 W)** (one quern); two rotors split the kettle (each half). Dry kettle: `dryS` 5 s rattle, 20 s the kettle warps (becomes `scrap_metal`, toast). Refill by pail, pipe, or touching a water source (50 L/s).
- *Art:* riveted copper drum with sight glass whose level is the water fraction; steam puffs from the spout in time with the rotor; rotor = a hub with two bent jets, blur disc above 32 rpm-equivalent. Sound: low rumble `kettle_rumble` by boil rate, a rising whistle at the moment the first rotor spins (`first_motion`).
- *Status:* "Steam Kettle: boiling, 2800 L water, rotor 16 rpm" / "Boiling dry - add water".
- Also: the kettle takes the two brewing Use rows (fill a cup/pail with boiling water) by reusing `brewUse` (STEAM_PLAN s.2); it must not change boil rules.

### 2.3 Thermocouples, heat rods, hot plate, vent - T2
- *Player:* a bronze rod laid from the furnace along the wall; it glows by temperature and burns your hand; a Hot Plate at the far end cooks (every smelt recipe at the delivered temperature); a Heat Vent warms a room.
- *Numbers:* thermocouple 2%/block loss (ETA), 6 kW cap per network (bronze), 20 kW iron (Forge upgrade `iron_thermocouple`), burn threshold 300 C (1 dmg/s, `heat:burn`); users: hot_plate 500 W cooking, heat_vent 400 W (warmth radius 6), `heat_port` up to 10 kW into a boiler. Network heat is **charged to the furnace** `gotW / 0.98^n` (the fire pays losses).
- *Algorithm (replaces BRONZE_PLAN 14.2 detail):* per rebuild BFS distances; per tick sort users by distance, `drawHeat` against the best `T x 0.98^n` source; store `Tblock` in a typed array for the renderer and `hotAt()` query (2 Hz survival scan).
- *Art:* rods use three emissive tile steps by `Tblock` (cheap, no per-vertex); at night the rod is a glowing line; the hot plate's top tile glows. Sound: faint tick as rods heat.
- *Status:* "Thermocouple: 640 C, 2.1 kW through" / "Hot Plate: cooking, 640 C".

### 2.4 Boiler multiblock (the age's big build) - T4
- *Player:* Structure planner ghost shows the shell; place plates around a furnace-fed volume, add heat port(s), water port, steam port, a Gauge Glass in a side face. On the last block the shell *flashes seams* and rings (`boiler_formed`); the gauge glass shows water; pressure on the goggles and as a needle on the glass.
- *Numbers (BRONZE_PLAN s.6 stands except where noted):* shell `boiler_plate` 8 bar; interior 1x1x2 .. 3x3x4; capacity water `2000 x cells` L, steam volume `1000 x cells` L; heat 10 kW (`HEAT_PORT_W`) per heat port; dry fire 5 s warn / 20 s warp; smallest vessel 34 blocks (30 plates + glass + 3 ports) - raise plate yield to 3 per 2 ingots if the solver says wall.
- *Rules:* formation scan on change, retry only when the player is within 16 blocks, sweep one cell per 4 ticks when formed; entity kind **`boiler_vessel`** (NOT `boiler`, which is a legacy machine kind), saved on the gauge-glass cell: `{kind:'boiler_vessel', waterL, dryS, formed:{x0,y0,z0,x1,y1,z1}}`.
- *Safety:* valve + burst (2.5). Burst scalds within 4 (6 dmg, cause 'burn'), destroys the weakest member, never chains.
- *Art/Sound:* formed twin textures (rivets align across cells); gauge glass level + needle in the parts layer; simmer ambience by pressure; `boiler_rattle` while dry; `boiler_burst`.
- *Status:* "Boiler: 5.4 of 8 bar, water 3200 L, 10 kW in" / "Boiler pressure high - 7.2 bar of 8".

### 2.5 Steam network, pressure, valve, burst - T3
- *Rules:* BRONZE_PLAN 5.2 with these changes: gas on the pipe graph (K4); `makeL = heatW/167 x dt` consuming `makeL x 0.1` water; sag 0.2%/s; valve vents `(bar-set) x volume` capped 400 L/s with `steam:vent` (1/s) and plume; rating = min `ratedBar` of members; `overS += dt` above rating, burst at 5 s, decays at 2x; warning from rating-1 (`steam:warning`, gauge shake). Players choose valve 2/4/6/8 by Use.
- *Signature moment:* the safety valve sings (`valve_shriek`, a rising-then-steady whistle with white plume) before anything bursts.
- *Pipe look:* bronze pipes with white collar near joints; warm to touch? no (only rods burn). `pressure_gauge` shows the needle for its network.
- *Status:* "Steam Pipe: 4.2 bar" and the gauge target name "Pressure Gauge - 5.4 bar".

### 2.6 Beam engine and steam hammer (the first strong source) - T3 (gas side) + T1 (shaft side)
- *Player:* a beam engine (a rocking beam over a cylinder and flywheel) next to the boiler; the beam rocks in time, the shaft turns, the goggles read "96 rpm, load 3/6 su".
- *Numbers:* min 2 bar; full-load draw `10 L/s per bar`; draw = `full x max(0.1, loadFraction)`; output per K2/ledger: `powerW = ETA.beamEngine(bar) x draw x 167`, `rpm = min(96, 16 x bar)`; 2 bar -> 32 rpm; 4 bar -> 64 rpm; 6 bar -> 96. Flywheel on the shaft evens the beat. `steam_hammer`: 4 bar, 30 L a blow, ingot -> plate in 1.5 s (bronze only; same recipe rows as the stone-anvil strokes via `recipesHand` twin rule).
- *Art:* beam pivots +-18 deg with phase = integral of rpm (never jumps on rpm change: STEAM_PLAN 14.4); piston rod, steam puff at each stroke from the cylinder; flywheel spokes. Sound `beam_creak` at stroke rate (pitch by rpm), `piston` ambience.
- *Status:* "Beam Engine: 3.4 bar, 54 rpm, load 3/4 su" / "Needs 2 bar - has 1.3".

### 2.7 Air and pneumatics - T6
- *Player:* a compressor on a shaft (needs >= 32 rpm) puffs air into copper tubes to a tank; a pneumatic press stamps plates; a Use of the air hammer on the tank refills it. Open tube ends hiss and leak.
- *Numbers:* compressor 1.5 L/s per rpm (so 48 L/s at 32 rpm) for a load of 8 su base x (16/32) = 4 su = 400 W at 32 rpm; stored energy `48 L/s x 6.25 J = 300 W`, i.e. eta .75 (`ETA.compressor`); max 6 bar; stalls; `air_tube` 50 L, leak 100 L/s per open end; `air_tank` 4000 L; press 3 bar min, 200 L per 2 s job; drill 3 bar, 100 L/block, tier 3; air hammer pickaxe tier 3, 60 charges; blast nozzle 2 bar, 20 L/s while the hearth burns (gate to Forge, 2.9).
- *Art:* copper tubes with glass windows (same mesh code as essentia tubes); packets visible as brass capsules for the tube post; tank with a dial; hiss puff particles at leaks. Sound `air_hiss` (by leak), `pneumatic_thump`, `tube_whoosh`.
- *Status:* "Air Tank: 4.8 of 6 bar" / "Compressor: needs 32 rpm - has 16".

### 2.8 Vacuum-drawn Bronze Chute - T6 (uses `collectors.ts`)
- *Player:* glass-ended bronze chutes carry items only toward a running Vacuum Pump; items rattle through at 8 blocks/s and land in the chest next to the pump.
- *Implementation (no second pull algorithm, CONGRUENCE D7):* `item_pipe` keeps its `ItemNet`; add `net.suction = pumpsOnNet.some(running)`. With suction, every port in `pull` mode and every dropped-item collector adjacent to the net seeds packets whose **destination is the nearest running pump** (BFS distance cached per rebuild); without suction packets do not move. The pump's own collector (radius 3) registers in `game/collectors.ts` as a `CollectorKind` (one definition, like the electromagnet later).
- *Numbers:* pump needs >= 2 bar air (its own `air_tube`), 30 L/s while items move, pulls 16 items per 0.5 s, buffer 9 slots or the touching inventory. The Ember Age has no item pipes (BRONZE_PLAN 5.4).
- *Pseudocode:* section 3.4.
- *Status:* "Vacuum Pump: 3.1 bar, moving 12 items/s" / "Vacuum Pump: needs 2 bar air".

### 2.9 Blast nozzle gate to the Forge - T6
`requiredParts: { blast_nozzle: 1 }` on the tier-3 structure (hearth data), nozzle satisfied when `airNet.bar >= 2`. Edits only the hearth table + a one-line check in `hearthScan` (shared with T4: T6 waits for T4 to land). Signature moment: hearth flares white when air arrives.

### 2.10 Shaft hooks for the distillery - T1 (API) + T8 (use)
- `Workshop.driveAt(x,y,z): { rpm, loadSu, capacitySu } | null` is the single read API for any non-workshop machine on a shaft (also the vacuum cap pump and the stirrer).
- **Stirrer** (`still_stirrer`, load provider, 2 su): on a still base's top it lowers batch time by `min(0.3, rpm/64 x 0.3)` and raises purity +2%; needs rpm >= 16.
- **Vacuum cap pump:** a `vacuum_cap` on a vessel is a `LoadProvider` (4 su at 32 rpm) that lowers boiling points (see 2.11).
- **Lubricant:** `LUBE` data (content/lube.ts) gets `lubricant` (x1.4, 15 min). Oiled shafts show an oil sheen tile overlay + quieter loop; goggles "oiled, 9 min".

### 2.11 Distillery remaining list - T8 (all inside `src/sim/distill*`, `core/chem|distill`, `content/*Distill`)
Priority order and designs (DISTILLERY_PLAN s.15):

| # | Item | Design | Numbers/rules |
|---|---|---|---|
| 1 | Ground burner | `still_burner` block: hand-fed charcoal (or fuel-ethanol beaker) under a still base; same `drawHeat` bus source (a pseudo-furnace entity `BurnerEntity {fuelS, tempC}`) | charcoal 4 min per item at 3 kW max 350 C; ethanol 0.25 L/min at 2 kW, 120 C cap; visible flame, sound crackle; Ember comfort |
| 2 | Reflux head | segment kind `reflux`: returns a fraction of condensate down the column: +1 effective tray | purity grade up one step if >=1 tray; lowers rate 25% |
| 3 | Filter bed | vessel module with sand + charcoal items; slop -> water, residue cleaned of ash | 1 item per 100 L, consumed |
| 4 | Lubricant | vacuum cap on `residue` -> `lubricant` fluid + `bitumen` residue; `lubricant_can` (`empty_canister` filled at a tank `spout`); chainsaw bar oil uses the same can (`felling.ts` consumer: 1 mL per second of cut... use 10 L-equivalent per can = 5 min) | process card `vacuum_residue` (350 C at 0.3 bar via cap pump) |
| 5 | Bitumen / asphalt | `bitumen_block` (slope-friendly road, +20% walk speed on it) and `asphalt` (Forge) | speed effect read in `player` via block `speedFactor` **(verify field exists)** |
| 6 | Potions / essences / tinctures | reaction cards: `distill_essence` (jar aspect `cinder/brook/gale/...` + spirit under vacuum cap -> `<aspect>_essence` vial, 1 per 4 L spirit), tincture (essence + spirit at the cup via `brewBuffs`), elixir (+heal over time); Spirit drink = Warmed (+cold resist) then Tipsy (aim sway) | one `DRINK_HUNGER` table (E owns); essence fingerprints via aspectTable overrides (D) |
| 7 | Tanks and receiver->tank pipes | add all 11 distillery fluids to `tank` `accepts`; a `chem_port` outlet joins a fluid pipe | tank tests per fluid; e2e receiver->pipe->tank |
| 8 | Catalyst bed, pressure cap, cracker, refinery tower | Forge multiblock via `StructureRules` (T4's scan): tower of N segments with side draws; `catalyst_bed` item consumed 1 per 500 L; pressure cap needs air net >= 3 bar (T6) | table of cuts by height (core/chem) |
| 9 | `distill:step` event, sounds, Codex branch | event on module state change (idle->working->done), sfx `still_bubble` loop, `still_drip`; Codex branch edit is the scripts session's | |
| 10 | Rig screen and ghosts | recipe-card ghost from `PROCESS_CARDS.rig`; problems already in crosshair line; **no new screen** unless the card picker needs one (one sheet, phone full-screen) | |

### 2.12 Workshop polish list (WHATS_LEFT s.2) - T7
| Item | Design (in-world) | Acceptance |
|---|---|---|
| Smooth tween of moving structures | contraption renderer interpolates pose between sim steps (position at render dt, never snap); player carried by skiff uses delta of the structure | skiff with player moves 20 blocks, collision never desyncs >0.05 |
| Riding the skiff | Use on skiff sits you (`riding` flag locks input except dismount: Jump); view bob by grade | headless: ride rail, dismount on end |
| Tame animals on treadwheel | `Workshop.standingOn` also asked of `mobs.tamedAt(x,y,z)`; goat 12 rpm/24 su, tires after 4 min (stamina), needs food; horn calls it | mob test |
| Vacuum-pump hookup | `vacuum_collector` becomes an optional consumer on a compressed air tube (2 bar) as well as a shaft; Bronze version unchanged | depends on T6 |
| Continuous spouts from pipes | `spout` on a fluid pipe network end fills any container on a depot/belt each second (pull from net, 250 L/s) | e2e: tank->pipe->spout fills 3 cans |
| Punched gearshift cards | `gear_card` item (3 presets + player-punched: 8 steps, set by Use cycling at a Punch Bench... reuse workbench with tool), Use on gearshift loads it | program persists in save (`s`) |
| Vault growth | vault multiblock adds 108 stacks per adjoining vault block, max 4 | logistics test |
| Trinkets | wind vane (reads `windAt`), weather cock, spyglass (long-press zoom), horn, padlock chest, lantern chain: one block each, status sentence | roster + textures |
| Belts cross structure borders | belt end hands items to a belt in a neighbouring contraption | contraption test |
| Weather on machines | rain x0.8 belt speed outdoors, frost thickens mill wheel flow | goggles "wet belt" |

---

## 3. Pseudocode for the hard parts

### 3.1 Solver: providers, dynamic loads, load fraction (T1; `kinetics.ts` stays pure)

```ts
// workshop.ts per network (replaces sourceFor + GENERATOR_SHAFT)
sources = new Map()
for key in members:
  p = parts[key]
  s = crank/clockwork/treadwheel/pto/flywheel (as today)
     ?? providerFor(p.kind)?.sample(cell, env)            // {rpm, powerW} -> {rpm, capacity: suFromW(powerW, rpm)}
  if s: sources.set(key, s)

solved = solveNetwork({ ..., sources })                    // static BASE_STRESS loads, as today
// pass 2: dynamic loads (dynamo, compressor, mech_pump, stirrer, vacuum cap)
dyn = 0
for key in members where loadProviderFor(kind) and solved.rpm.has(key):
  lp = provider; r = |solved.rpm[key]|
  if r < lp.minRpm: lp.give(cell, 0, dt); continue
  want = lp.wantW(cell, r)                                  // e.g. dynamo: electric demand W / ETA.dynamo
  wantSu = suFromW(want, r); dyn += wantSu; want[key] = want
spare = max(0, solved.capacity - solved.stress)
scale = dyn > 0 ? min(1, spare / dyn) : 1                   // loads share the spare; static loads win
for key: lp.give(cell, want[key] * scale, dt)
total = solved.stress + dyn * scale
overstressed = total > solved.capacity && !solved.jam       // only STATIC overload seizes; dynamic loads just slow down
loadFraction[net] = min(1, total / max(1e-6, solved.capacity))   // read next tick by engines (K7)
```
A dynamo that cannot get shaft power returns less electricity (brown-out), never seizes the line. Providers are called once per network per tick.

### 3.2 Gas net tick (`sim/gasNet.ts`; T3)

```ts
class GasNet extends PipeNet {            // family 'steam' | 'air'
  store = { fluid: family, litres: 0 }    // same anchor-entity persistence as FluidNet
  volumeL: number                          // sum of member volumeL (+ vessel interior for steam ports)
  get bar() { return this.store.litres / this.volumeL }
  tick(dt, env) {
    // 1 sources first: boiler/kettle put(), compressor put()
    for s of sources: this.store.litres += s.makeL(dt, this)          // boiler: min(heatGot/167, water*10) dt
    // 2 users: priority valve < whistle < engines/hammers
    for u of users sorted by priority: u.use(this, dt)                // engine: take(full * max(.1, load) * dt) if bar >= min
    // 3 sag and leaks
    this.store.litres *= 1 - STEAM_SAG_PER_S * dt                     // air: leaks = openEnds * 100 * dt
    // 4 over-rating: burst clock (5 s), decays 2x when below
    rated = min(members.ratedBar)
    if bar > rated: overS += dt else overS = max(0, overS - 2*dt)
    if overS >= BURST_SECONDS: burst(weakestNearestSource)            // scald 6 within 4, destroy block, litres = 0
    if bar > rated - 1 (and not warned): emit steam:warning on
    this.store.litres = clamp(this.store.litres, 0, volumeL * 12)
  }
}
```
Water used by the boiler is taken from the vessel entity (`waterL`), never from the gas net. Gas nets never mix: a joint of `steam` with `air` is refused with a joint reason (existing `JointReason`).

### 3.3 Heat draw (`sim/heat.ts`; T2)

```ts
export function drawHeat(f: FurnaceEntity, wantW: number, minTempC: number): { gotW: number; tempC: number } {
  const T = f.tempC;                                     // furnace chamber temperature
  if (T < minTempC || !f.lit) return { gotW: 0, tempC: T };
  const cap = Math.max(0, f.availW - f.extractW);        // what the fire can still give this tick (availW exists on the entity)
  const got = Math.min(wantW, cap);
  f.extractW += got;
  return { gotW: got, tempC: T };
}
```
All current direct `extractW +=` sites (brewing, distill, fluidMachines) call it in T2 as a pure refactor (tests unchanged).

### 3.4 Bronze Chute with suction (`itemNet.ts` change; T6)

```ts
rebuild(): for each pump p on net: dist = bfs(net, p.cell)            // cached; invalidated on place/remove
net.suction = pumps.some(p => p.running)                              // running = air >= 2 bar and not jammed
tick(dt):
  if !net.suction: return                                              // chutes do nothing by themselves
  budget = 16 items per 0.5 s per pump (shared)
  for port in net.ports where port.mode == 'pull': seed packets from the inventory/ground at that port
  for packet: advance toward lower dist at 8 blocks/s; at the pump: deliver into touching inventory or buffer(9)
  air.take(30 L/s while any packet moved)
```
Packets are the existing `ItemNet` packets (cap `PIPE_MAX_PACKETS`).

### 3.5 Structure scan reuse (`structureScan.ts`; T4) - BRONZE_PLAN 14.5 stands. Rule: boiler data in a `STRUCTURES` content table; scan returns `{formed, problems[], cells}`; hearth tests unchanged and must stay green before the boiler is wired.

### 3.6 Render: turning parts never jump
Keep an `angle` accumulator per part in the renderer; `angle += rpm x 6 x dt` (deg), never `angle = rpm x t`. Same for beam phase and sails.

---

## 4. Risks

| # | Risk | Mitigation / test |
|---|---|---|
| R1 | **Plans' numbers violate conservation (section 1.5).** Builders copy them. | T0 ledger test; this document wins over STEAM/BRONZE tables where they differ; `docs/api/steam.md` states the final numbers. |
| R2 | **Save migration.** New entities (`boiler_vessel`, gas anchors, heat none), new workshop part kinds, removal of `GENERATOR_SHAFT`, W0 renumbering. | Missing keys load empty; `sanitize.ts` drops unknown kinds; keys never renamed (K5); old-save fixture (committed in W0) loaded by every stream's test; old `water_wheel`/`wind_turbine`/`steam_engine` saves keep working as watt generators; `normalizeDocument` defaults; no `SAVE_VERSION` bump unless shape breaks. |
| R3 | **Free-energy loops.** generator -> shaft -> dynamo; compressor -> air -> pneumatic drill -> ore -> fuel; mech_pump -> wheel; flywheel; gearing up. | K6; ETA all < 1; windmill spacing; flywheel source capped 12 su for 4 s only after being charged (existing); clamp .25 conservative; energy test (T0) enumerates chains; mech_pump -> mill_wheel net negative (`pump 200 W lifts 50 L/s` returns <300 W only if drop >= 2 blocks: cap wheel flow by *source block*, not pumped water: water from a `mech_pump` counts 0 for the wheel's `flowAround`). |
| R4 | Performance. | Budgets: gas ticks < 0.1 ms/net with 100 pipes, whole steam/air/heat < 0.3 ms/tick for 10 vessels + 500 pipes (BRONZE_PLAN); workshop solve stays BFS capped 512 and runs per tick; providers are called once per network; renderers instanced (rods, pipes, sails) with one draw call per kind; tube packets capped 48; no per-block allocations in tick; scans only on change or player within 16 blocks. Add to `perf.test.ts`. |
| R5 | Burst/scald griefing and surprise death on phone. | Warning 5 s, HUD + sound; scald 6 not lethal; no burst in Peaceful (valve force-opens); burst never chains; never in unloaded chunks (nets in unloaded chunks hold). |
| R6 | Furnace overdraw: many users starve the fire (kettle + plate + still + brewing). | `drawHeat` cap by `availW`; status "furnace is the limit"; hearth heat capacity numbers read from `FURNACE_TIERS` **(verify the Bronze furnace's sustained kW supports one kettle + one vessel port: acceptance check below)**. |
| R7 | Shared-file conflicts (`types.ts`, `gameEvents.ts`, `specRoster.ts`, `package.json`). | T0 lands all contracts first; builders append one line only; rebase before every commit; `.run-lock` for `dist/`/e2e (`team.md`). |
| R8 | Voxel ids (10 bits) near the cap. | Count free ids in T0 (`grep -c` of palette); new blocks append LAST; reuse variant bits (steam pipes/air tubes/thermocouples are one block each with joins by neighbour) - ~40 new blocks: **(verify headroom)**, if short, kettle/rotor/engine share frames. |
| R9 | Name collisions: `boiler`, `steam_engine`, `piston`, `water_wheel`, `kettle_pot` vs `steam_kettle`. | K5; never display "Kettle" alone; Codex names listed in conventions. |
| R10 | Phone: gauge/needle readability, no screen. | Status sentence + goggles; boiler screen only as the generic Structure sheet (already exists for hearths). |
| R11 | Stale doc status (STEAM_PLAN s.8 says nothing exists). | T9 doc pass replaces s.8 with a pointer here; `docs/api/steam.md` is authoritative. |
| R12 | Age gating after W0: `minTier`/`age` literals. | Every new row uses `ageIndexOf('bronze')` and the tier constant from `FurnaceTierSpec`; G2 greps `minTier: 1`. |

---

## 5. Builder tasks (ordered, dependency-correct, disjoint files)

Convention: **a task is Done only after the coordinator re-runs** `npx tsc --noEmit`, `npx vitest run`, and the stream's e2e (`team.md`); builders never certify their own work. Every task's end state: roster/content counts updated, `docs/api/steam.md` (or the area note) section written, no key renamed, old-save fixture loads. Shared append-only files are touched **only** by T0 except one-line roster/package.json merges (rebase first).

### Phase 0 (after W0 lands; one builder, short)
**T0 - Contracts, ledger, seams.** Owns: `src/core/{types,constants,gameEvents,energy}.ts` (+ `energy.test.ts`), `src/content/lube.ts` (moves `LUBE`), `src/workshop/sources.ts` (types only), `src/sim/heat.ts` (`drawHeat`), `src/core/registry.ts` (validation of `HeatSpec/GasSpec/StructureRules`), `src/audio/sfx.ts` names with placeholder recipes, `docs/api/steam.md` skeleton. Also: count free voxel ids; run `drawHeat` refactor over brewing/distill/fluidMachines (`extractW` sites) with tests unchanged.
*Acceptance:* typecheck + full suite green; `energy.test.ts` (efficiency chain < 1, K2 constants); registry rejects a bad `GasSpec`; old-save fixture loads; **no behaviour change** (diff of snapshot tests empty).

### Phase 1 (parallel, 4 builders, disjoint files)

**T1 - Shaft layer and wooden sources (Builder 1).** Owns `src/workshop/{kinetics,workshop,sources}.ts` (+tests), `src/content/{blocksSource,itemsSource,recipesSource,specRosterSource}.ts` (windmill, mill_wheel), `src/render/steam/{windmill,wheel}.ts`, `src/render/textures/steam.ts` (first half), `docs/api/workshop.md` (kinetics section). Does: providers/dynamic loads/`loadFraction`/`driveAt`; retire `GENERATOR_SHAFT` and rewrite its tests; `windmill`, `mill_wheel`; `LUBE` reads `content/lube.ts`; Codex of units.
*Acceptance:* (a) windmill + quern grinds wheat headless (no crank); (b) mill wheel 0 on frozen/pumped water; (c) dynamic load test: loads share spare capacity, line never seizes from dynamic overload; (d) `kinetics.test.ts` and `workshop.test.ts` unchanged except removed generator cases; (e) windmill spacing guard; (f) `e2e-workshop.mjs` unchanged and green.

**T2 - Heat, kettle, rotor, hot plate (Builder 2, part 1).** Owns `src/sim/{heatNet,kettle}.ts`, `src/content/{blocksHeat,itemsHeat,recipesHeat,specRosterHeat}.ts`, `src/render/steam/{rods,kettle,rotor}.ts`, `src/render/textures/steam.ts` (second half, coordinate: separate file `steamHeat.ts`), objectives `bronze_furnace/boil_water/first_motion/grind`.
Depends: T0 (`drawHeat`), T1's `SourceProvider` interface only through T0's types (rotor registers via `Workshop.addSourceProvider` in `game.ts` wiring - one line).
*Acceptance:* kettle boils a pail and rotor reaches 16 rpm / 4 su; dry kettle warps at 20 s; heat conservation (furnace cools by delivered / efficiency); 2%/block; 6 kW cap; burn query; hot plate cooks at delivered temp; perf 500 rods < 0.2 ms; save/load of kettle water.

**T7 - Workshop polish (Builder 3, part 1).** Owns `src/workshop/{logistics,contraption,signals,inspector}.ts`, `src/render/workshop/*`, `src/content/{itemsWorkshopParts,recipesWorkshop,objectivesWorkshop,basinWorkshop}.ts`, `docs/api/workshop.md` (logistics/polish sections). **Does not touch `kinetics.ts`/`workshop.ts`** until T1 is merged; if it needs a hook, T1 adds it first (`Workshop` extension points via small `workshop/ext/*.ts` files).
*Acceptance:* per row of 2.12; `contraption.test.ts`/`logistics.test.ts` green; e2e-workshop extended (skiff ride, spout fills cans).

**T8 - Distillery (Builder 4).** Owns `src/sim/distill*.ts`, `src/core/{chem,distill}.ts`, `src/content/{blocksDistill,itemsDistill,recipesDistill,fluidsDistill,machinesDistill,specRosterDistill}.ts`, `src/render/distill/*`, `src/game/felling.ts` (bar-oil consumer only), `docs/api/distillery.md`, `docs/DISTILLERY_PLAN.md` s.15. Order: items 1,2,3,4 (lubricant can via `content/lube.ts`), 7, 9, 5, 6, then (after T1) stirrer hooks, (after T4/T6) item 8.
*Acceptance:* golden tests for each card (existing fuzz + new cards); `distill:step` event; tank test per fluid; `e2e-distill.mjs`: bottle -> spout -> can -> shaft "oiled 15 min"; Dev Mode lists new items.

### Phase 2 (after T2 and T1 land)

**T3 - Gas net, steam network, beam engine, whistle, valve (Builder 2, part 2).** Owns `src/sim/gasNet.ts`, `src/sim/transport.ts` (family hook, one function), `src/sim/pipeGraph.ts` (family table entries only), `src/content/{blocksSteam,itemsSteam,recipesSteam,specRosterSteam}.ts`, `src/render/steam/{beamEngine,gauge,valve,plume}.ts`.
*Acceptance:* worked example of 1.5 within 2%; two engines vs one (efficiency); valve holds its setting; burst only after 5 s over rating, never with a valve <= rating; pressure sags 0.2%/s; engine idle draw 10% (K7); steam/air never join; networks split/merge on pipe removal; unloaded chunks hold.

**T4 - Structure scan + boiler vessel (Builder 2, part 3, or Builder 1 if idle).** Owns `src/sim/{structureScan,boilerVessel}.ts`, `src/sim/hearthScan.ts` (extraction only), `src/content/{blocksBoiler,...}.ts`, `src/ui/screens/structure/*` (generic Structure tab move), `src/render/steam/boiler.ts`.
Depends on T3 (steam ports). *Acceptance:* hearth tests unchanged and green; vessel forms/unforms for every problem code and size 1x1x2..3x3x4; dry-fire timeline; capacities by size; ghost from planner; e2e: build smallest boiler from ghost -> 2 bar -> beam engine turns a millstone; no valve -> burst with the player 8 blocks away unhurt; with valve holds.

**T6 - Air, pneumatics, chute, vacuum, nozzle (Builder 3, part 2).** Owns `src/sim/{airNet}.ts` (a `GasNet` subclass config), `src/sim/itemNet.ts` (suction flag), `src/game/collectors.ts` (vacuum pump kind), `src/content/{blocksAir,...}.ts`, `src/render/steam/{compressor,tubes,tank}.ts`, Forge gate in the hearth data.
Depends on T3 (gas net) and T4 (hearth structure table). *Acceptance:* compressor stalls at 6 bar; open end leaks 100 L/s; tube send refused < 2 bar; chute moves nothing without a running pump, moves 16 items/0.5 s with one; blast hearth forms only with the nozzle at 2 bar; press/drill charge; save/load of air and packets; `e2e-steam.mjs` (kettle -> axle -> mill; boiler; compressor; chute) desktop + phone.

### Phase 3
**T5 - Forge dynamo + steam dynamo naming + objectives (Builder 1).** Owns dynamo block/recipe, display renames, the age/objective moves (Forge `first_power` after `blast_furnace`), `content/objectivesBronze.ts`. Depends on T1 (dynamic loads) and T3.
*Acceptance:* dynamo produces `ETA.dynamo x shaft W` and slows the line instead of seizing; brown-out; solver: no electricity item obtainable before the Blast hearth (test); Bronze completable with no power; Peaceful completable.

**T9 - Docs and Codex pass.** `docs/api/steam.md` final, STEAM_PLAN/BRONZE_PLAN status boxes pointing here, CONGRUENCE conventions updated (K5/K8), `npm run codex`. Coordinator-owned or a docs session.

### Dependency graph
```
W0 -> T0 -> {T1, T2, T7, T8}   (T7 waits for T1 only if it needs workshop.ts)
T1+T2 -> T3 -> T4 -> T6 ; T3 -> T6 ; T1+T3 -> T5 ; T4,T6 -> T8.item8 ; all -> T9
```
Parallelism: Phase 1 runs 4 builders (T1, T2, T7, T8). Phase 2: Builder 2 continues T3->T4; Builder 3 does T6 after T3 (starts early with the chute/collector half that needs no gas, using a stub air supplier); Builder 1 does T5 after T3; Builder 4 finishes T8.

### Per-task review gate (who certifies)
Independent adversarial review (a session that did not write it) before merge for: T0 (contracts), T3/T4 (safety and burst), anything touching `hearthScan`/`pipeGraph`/save keys. Reviewer checklist: free-energy chains, save of every new entity kind, no key renamed, no voxel id moved, no per-tick allocation, goggles sentence for each new block, `Peaceful` completability.

---

## 6. Owner decisions this dossier needs (defaults chosen)

1. Engine key/name `beam_engine` "Beam Engine" instead of `piston_engine` (default: yes).
2. Legacy Forge `boiler`/`steam_engine` keep their keys; displayed "Furnace Boiler"/"Steam Dynamo" (default: yes; supersedes CONGRUENCE D3/D4 renames).
3. Power scale is deliberately modest (rotor 200 W, engine ~1.8 kW per 10 kW port): steam is a tool, not a generator; the Forge dynamo makes lamps only a few at a time (default: yes; the ledger lets you retune by `ETA` and `HEAT_PORT_W` in one place).
4. Pressure gas model on the pipe graph, no new graph (K4).
5. Burst disabled in Peaceful (valve force-opens) (default: yes).

## 7. Quick map of "who edits which file" (collision table)

| File | Only this task edits it |
|---|---|
| `core/{types,constants,gameEvents,energy}.ts` | T0 (builders: one-line appends after rebase) |
| `workshop/{kinetics,workshop,sources}.ts` | T1 (T5 after T1) |
| `workshop/{logistics,contraption,signals}.ts`, `render/workshop/*` | T7 |
| `sim/{heatNet,kettle,heat}.ts` | T2 (heat.ts: T0 creates) |
| `sim/{gasNet,transport(hook),pipeGraph(family table)}.ts` | T3 |
| `sim/{structureScan,boilerVessel,hearthScan}.ts` | T4 |
| `sim/{airNet,itemNet}.ts`, `game/collectors.ts` | T6 |
| `sim/distill*.ts`, `core/{chem,distill}.ts`, `*Distill.ts`, `render/distill/*` | T8 |
| `content/lube.ts` | T0 creates, T8 appends rows |
| `src/app/game.ts` wiring | one-line additions only, rebase before commit |
