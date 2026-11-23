# Mechanics plan - "Drivetrain 2": a modular mechanical kit (Bronze home, Forge and Current depth)

Status: design + first slices built (see "Slices and status"). API: `docs/api/mechanics.md`. Builds on `docs/api/workshop.md`
(crank, shafts, belts, mixer/press/basins, arms, contraptions, signals) and does not replace it: old saves and old pieces keep working.

## 0. Why not "Create with different names"

Create's loop is: source -> shaft network with a stress budget -> machines. The budget is a single number and failure is binary.
Hearthwatt's workshop already copies that loop (`kinetics.ts`: speed flows outward, jam on disagreement, stress vs capacity, stop).
What the owner asked for is a **kit you can tinker with for hours**. Three principles decide every part below:

1. **Orthogonal axes.** Every part touches exactly one of five quantities and the player combines them:
   *speed* (ratio parts), *torque/inertia* (engines, flywheels, brakes, fuses), *time* (drums, escapements, cams), *state* (latches, counters,
   comparators, accumulators), *position* (linkages, rails, cylinders). A "press" is not a recipe machine with a number; it is a **ram (position)
   driven by a crank (time) through a gear train (speed) on an engine with a flywheel (torque)**. Players recombine.
2. **Physics you can feel, not a spreadsheet.** Power is torque x speed and gearing trades one for the other, never power. Loads come in pulses
   (a press stroke is 3x its average), so a flywheel *matters*. Overload does not flip a switch: the line **slows, stalls, heats, shears the weakest link**.
3. **Failures teach and every failure has a fix that is a part.** Seize -> brake/clutch/fuse. Pulsed stall -> flywheel. Whip -> pillow block.
   Runaway -> governor. Jam -> differential. The goggles show the *why* ("press pulse 24 su on 12 su engine; flywheel would carry it").

## 1. The model (pure code in `src/workshop/mech/`)

Units: torque in **su** (stress unit, as the workshop already counts it), speed in **rpm**, power `P = su x rpm` (watts = P x 0.1047 x 50 in the old
generator hook: `GENERATOR_SHAFT.suPerW` stays the bridge). The steady-state solver `kinetics.ts#solveNetwork` is **kept**: it still decides
who turns which way at what rpm, jam, and the steady load (`stress`) and rated torque (`capacity`) of a network. The new layer adds dynamics per network:

```
speed factor w in [0, 1.25]        (1 = the solved rpm; a part turns at rpm x w)
M  (momentum, su*s per unit w)     = M_BASE + sum of part momentum x gear ratio^2   (flywheel dominates; default parts are almost 0)
M dw/dt = T_drive(w) - T_load(w, t) - T_brake - T_drag(w) - T_fuseslip
T_drive = sum over sources of rated torque x curve(w)      (curve per engine kind, see 2.1)
T_load  = steady load x (1 + pulse(t))                     (pulse from cams / strokes, see 3)
```
- With default parts `M` is tiny, so `w` snaps to its steady value in one tick: **a network of today's parts behaves exactly as it does today**
  (load over capacity -> stalls and toasts). Add momentum and the same network now ripples, coasts and rides through pulses.
- Kinetic energy `E = 1/2 M w^2` is the **flywheel store**: charged by a surplus (engine overspeed allowed only up to `W_MAX` 1.25, then a governor or
  the fuse intervenes), spent on pulses and coasts. `Flywheel.coastSeconds(load)` is the number the goggles show.
- **Brake**: engaged (Use, or a lit signal cell) it takes `BRAKE_TORQUE` 24 su: stops a coasting flywheel in a second, holds a lift. Wears (see 2.3).
- **Torque fuse** (generalises the Shear Pin): material by Use - copper 6, bronze 12, iron 24 su. It watches the **torque through its own position**
  (the sum of loads downstream of it in the solve tree). Over rating for 0.4 s it snaps (scrap drops, one toast), and the line downstream stops while the
  upstream engine survives. Setting 0 (old pins) keeps the legacy "snaps when the whole network is overloaded" rule.
- **Whip (critical speed)**: an unsupported straight run of `drive_shaft` of length L has a critical speed `crit(L) = 160 / L` rpm. Running within 15 %
  of it, the network loses 35 % capacity (vibration) and the run hums/animates; a `pillow_block` (a bearing support) splits runs. Teaches "long shaft + fast = bad".
- **Drag and heat** (slice 2): every turning part has friction `drag x w`; lubricant lowers it (`LUBE` stays); heat accumulates in `heat` per part and
  scorches (`seize`) above 100 - the thing a clutch slipping under load produces. Brakes and slipping clutches heat the most.

## 2. Parts catalogue (by system; age = where it is made; code key in `backticks`; `[B]` built now, `[P]` planned)

### 2.1 Sources (engines as modules; all feed a shaft they touch)
| Part | Age | Torque curve | Notes |
|---|---|---|---|
| `hand_crank` [B] | Bronze | constant 8 su @16 | unchanged |
| `treadwheel` [B] | Bronze | constant 24 su @12 | animal/player |
| `clockwork_motor` [B] | Bronze | constant 48 su @24 while wound | **the spring is stored torque**: `Spring` (pure) - winding energy vs rpm, the `escapement` below meters it |
| `water_wheel`, `wind_turbine` [B hook] | Bronze | flat; wind varies with weather | fluid mechanics: head x flow = torque; one wheel per stream block (slice 4) |
| `steam_engine` [B hook] | Bronze/Forge | boost at stall (x1.5), droops above w 1 | `ENGINE_CURVES.steam`: strong at low speed, so a piston starts a loaded press the crank could not |
| `windmill`, `animal_yoke` [P] | Bronze | flat, weather/animal | |
| `tractor_pto` [B] | Current | flat 30 su | |
| `essentia_servo` [P] | Bronze+magic | flat, fed by an aspect tube (`spark`/`motion`) | the artificer hook: attune a part to a power instead of a block |

### 2.2 Transmission (speed axis)
`reverse_box`, `ratio_dial`, `clutch`, `governor`, `worm_gear`, `chain_sprocket`, `belt_pulley`, `differential`, `sequence_gearshift` [all B, unchanged]. New:
| Part | Age | Behaviour |
|---|---|---|
| `planetary_set` [P] | Forge | three-port ratio: sun/ring/carrier - hold one port with a brake and the ratio of the other two changes (`gearMath.planetary`). The reason brakes exist |
| `cvt_cone` [P] | Forge | continuously variable ratio 0.4-2.5 set by a signal level 0-15 (analogue!), loses 8 % power |
| `slip_clutch` [P] | Bronze | transmits at most its rated torque then slips: caps torque instead of breaking; heat = slip x speed |
| `overrunning_clutch` [P] | Bronze | one-way: lets a flywheel keep spinning when the engine stops, or a lift hold against a load |
`gearMath.ts` holds the ratio algebra (`chain`, `planetary`, `differentialSplit`, `cvt`), all pure and tested.

### 2.3 Torque, inertia and safety (the new axis)
`flywheel` [B, now with real momentum], `brake` [B slice 2], `torque_fuse` = upgraded `shear_pin` [B slice 2], `pillow_block` [B slice 2], `torque_gauge` [P]
(a dial block: reads load/capacity and w as an analogue signal 0-15 for logic), `tachometer` [P] (rpm -> signal), `load_cell` [P].

### 2.4 Time: drums, cams, escapements (the "music box" axis) - `drum.ts`
- **Cam drum** `cam_drum` [B slice 2]: a cylinder of 16 steps x 4 tracks. Pegs (set with a punched card, or the UI) close the track at that step. While it turns
  at `rpm`, it advances `16 x rpm/16` steps/s; each track drives a **signal output on one side** (so it fires deployers, arms, clutches, pistons) and optionally a
  **cam follower** (lifts a lever at the peg - position output for linkages). Direction and speed are the program's tempo; a governor makes it metronomic.
- **Escapement** [P]: converts a spring's continuous torque to fixed ticks; paired with the clockwork motor it gives a *timer block* that does not need a player to turn it.
- Existing `sequence_gearshift` + punched card stays: a drum *time-programs speed*, a cam drum *time-programs actions*; both read the same `punched_card` item.

### 2.5 State: mechanical logic - `logic.ts`
Signals are 0-15 (the workshop already has 1-bit lit/unlit with strength 15..1 along wire; `Signals.level` is that analogue value). New sink/source cells
(`signals.ts`, slice 3): `comparator` (a >= b -> 15), `latch` (SR: set/reset inputs from opposite sides, holds), `counter` (counts rising edges; emits at N; wraps), `encoder`
(shaft angle -> 16 pulses/rev) and `and`/`or`/`not`/`xor` as one `gate` block with a Use-cycled mode. `logic.ts` evaluates a small graph deterministically
(no recursion, topological with a cycle guard) so 200 cells stay under 0.2 ms.

### 2.6 Position: linkages and tracks - `linkage.ts`
Pure kinematics the **render system consumes** for part-and-track animation (a crank turns, the rod follows, the slider moves along its track): `sliderCrank`
(position, velocity, *torque ripple*), `rackPinion`, `scissorLift`, `pantograph`, `gantryPose`. Drives `piston` (a real stroke curve instead of a step), the press ram, saws.
The **torque ripple** of a slider-crank (`torqueProfile`) is what the load pulse of section 1 is for: ram strokes demand `1 + 2 sin^2`-shaped pulses.

### 2.7 Hydraulics and pneumatics (between steam and air) - `hydraulics.ts`
A discrete pressure circuit solver on the same graph idea: **pump** (turns shaft torque into pressure x flow), **accumulator** (stores volume at pressure: the hydraulic
flywheel), **relief valve**, **check valve**, **directional valve** (signal-controlled), **cylinder** (area -> force, stroke -> volume), **motor** (back to a shaft).
`step(circuit, dt)` returns pressures, cylinder positions, and pump load (su). A cylinder with 4x the area of the pump piston trades speed for force - the same
ratio lesson as gears, learned a second way. Bronze: leather/steam "pneumatic" (low pressure, bellows, lossy), Forge: oil hydraulics (distillery residue as fluid).

### 2.8 Item handling and tool heads (existing + slice 4)
Belts, funnels, chutes, depots, arms, vault, deployer, vacuum are [B]. New: `sorter` (filter list, three outputs), `splitter`/`merger` (even split, priority), arms with **programmable stops**
(drum-driven), and the **modular frame + tool head** machine: `machine_frame` + heads (`saw_head`, `drill_head`, `press_head`, `hammer_head`, `mixer_head`, `deployer_head`) so a
player builds a custom machine on a frame and the heads read position (linkage) and pulses (cam). The pre-made stations stay as presets of this, not replaced.

### 2.9 Failure modes that teach (all in `drive.ts`, surfaced by goggles + bell)
seize (overload, brake locked) / shear (fuse, whip at 2x) / stall ripple (pulse > torque, no flywheel) / whip (long shaft) / runaway (no governor, `W_MAX`) / overheat (slip) / jam (kept).
`diagnose(netState)` returns ordered `Finding {code, text, fix}` the goggles read.

## 3. Cross-system ties (each is one hook, listed so streams know where)
- **Distillery**: pumps and stirrers read shaft torque as `su`; residue = lube (kept) and **hydraulic oil** (slice 4).
- **Furnace bellows**: a cam-driven bellows (position output) feeds the furnace air; the old hand bellows becomes the first rung.
- **Crops/farming**: reaper heads on a gantry, a cam drum for planting rows, water wheels from irrigation streams.
- **Magic**: an aspect-attuned part (`motion` aspect) turns torque into essentia flow and vice versa; artificer golems use the machine interface unchanged.
- **Structures**: mills, mine hoists and workshops generate with a pre-built drivetrain the player can read and repair (a ruin teaches the kit).

## 4. Goggles stress UI (a game in itself)
Overlay lists per network: sources (torque curve marker), load bar with **pulse peaks**, momentum (flywheel store seconds), weakest link (fuse rating margin), findings
with fixes. A rolling `LoadGraph` (pure ring buffer, 120 samples of load/capacity/w) feeds a spark-line; ties to `diagnose`. Slice 5.

## 5. Ages
- **Bronze** (the home): cranks, shafts, gear parts, clockwork, flywheel, brake, fuse, pillow block, cam drum, counter/latch/comparator, pneumatic cylinder, tool-head frame.
- **Forge** (iron, oil): planetary set, CVT, slip clutch, hydraulic pump/accumulator/cylinder, sorters, steel gantry.
- **Current**: dynamo bridge, electric servo, tractor PTO, analogue sensors that feed wires. The rotational layer stays; electricity is a different system with a **bridge** (generator/motor blocks).

## 6. Slices and status
1. `[done]` Pure core with tests: `mech/drive.ts` (momentum dynamics, engines, brake, fuse, whip, diagnose, perf), `mech/gearMath.ts`.
2. `[done]` `mech/drum.ts`, `mech/logic.ts`, `mech/linkage.ts`, `mech/hydraulics.ts` with tests; perf test for 200 parts.
3. `[next]` Wire `drive.ts` into `Workshop.solve` (momentum, brake, fuse ratings, whip), persist `mech` extras with migration; flywheel real energy; content blocks
   `brake`, `pillow_block`, `cam_drum`; goggles lines.
4. `[next]` Logic cells in `signals.ts`; hydraulic blocks; tool-head frames; sorters.
5. `[next]` Goggles overlay + load graph UI; render consumption of `linkage.ts` poses through the shared part-and-track system in `src/render` (owned by the render session).
6. `[next]` Dev Mode bench structure (a test hall: every engine, a flywheel press line, a cam-drum sorter, a hydraulic lift).

## 7. Saves
`world.persist('workshop')` extras get one new optional key `mech` (`v: 1`): per-part `{ heat, setting }` and per-network momentum is **not saved** (rebuilt from parts; w starts at 1
for turning nets). Missing key or bad shape = defaults, so every old save loads. New settings on old parts default to the old behaviour (fuse setting 0 = legacy pin, momentum 0 = legacy instant).

## 8. Performance
Budget: 200 parts, one network of 200 with 6 loads: `solve + stepDrive` under 0.5 ms median on the dev machine; one network step is O(parts) with no allocation in the
inner loop beyond the already-built solve tree. `mech/perf.test.ts` guards a loose 20 ms ceiling for 200 networks of 200 parts x 20 ticks (CI-safe).
