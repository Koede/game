# Mechanics (src/workshop/mech) - API note

Design: `docs/MECHANICS_PLAN.md`. This layer sits on the workshop (`docs/api/workshop.md`): `kinetics.ts#solveNetwork` still decides directions, rpm,
jams and the steady load/capacity; `mech/*` adds the physics and the programmable parts. Everything in `mech/` is pure (no world, no bus) and tested in
`mech/mech.test.ts`; the workshop wiring is tested in `parts.test.ts`, `signals.test.ts`, `mech/bench.test.ts`, `mech/perf.test.ts`.

## Dynamics (`mech/drive.ts`)
- Units: torque **su** (the workshop's stress unit), speed as a factor **w** of the solved rpm (1 = as solved), momentum **M** in su*s.
- `stepDrive(state, { engines, load, pulse?, momentum, brake?, drag? }, dt) -> { w, drive, demand, stalled, energy }`: one implicit step of
  `M dw/dt = drive(w) - demand(w)`; bisection on a monotone function, so it is stable for any dt. w stays in [0, 1] (engines are speed regulated).
  A line that can hold full speed reaches exactly 1 (so exact-rpm checks and recipes that need 16 rpm keep working).
- Engines: `ENGINE_CURVES` `flat`, `steam` and `human` (x1.5 torque at stall: a crank or treadwheel pushes harder when it sticks, so a cranked press lurches
  through its stroke instead of jamming), `spring`. `engineKindOf(partKind)`.
- Momentum: `PART_MOMENTUM` (flywheel 16, treadwheel 1, bearing 2, ...; other parts 0.02), scaled by the square of the part's speed ratio:
  `networkMomentum([{kind, ratio}])`. Default networks have M ~ 0.1, so they snap to their steady state as before.
- Coasting: with no engine the line decays against its load plus `IDLE_DRAG` 1 su + 0.02 su per part. `coastSeconds(M, load, drag, brake)`,
  `rideThrough(M, rated, load, pulseS)`.
- `BRAKE_TORQUE` 24 su per engaged brake; a brake's heat (`brakePower`, `stepHeat`) above 70 % of `HEAT_SEIZE` fades it to 40 %.
- Torque fuses: `throughTorque(order, parent, ownStress)` (sum of a part's own stress and everything downstream in the solve tree),
  `FUSE_RATINGS` `[0 legacy, 6 copper, 12 bronze, 24 iron]`, `stepFuse(state, rating, torque, dt)` snaps after `FUSE_GRACE_S` 0.4 s over rating.
- Whip: `criticalRpm(L) = 160 / L`; `shaftRuns(cells, supports)` finds straight runs of `drive_shaft` split by `pillow_block`s; `whipFactor(L, rpm)` is 0.65
  within 15 % of critical (capacity loss) for runs of 3 or more; `worstWhip`.
- `diagnose(...)` -> `Finding { code, text, fix }[]` (`stall`, `overload`, `ripple`, `whip`, `idle`, `brake`, `ok`); `LoadGraph` ring buffer for the goggles' spark-line.

## Workshop wiring (`workshop.ts`)
- `Workshop.solve` keeps a `NetDyn` per network (keyed by its smallest member key, not saved): it solves the steady state, then steps the dynamics. `NetInfo` gains
  `w`, `momentum`, `whip`, `pulse`, `findings`. A part turns at `rpm x w`; `w < 0.05` = still. `overstressed` = load over capacity and `w < 0.5`.
- Pulses: a `mech_press` / `mech_hammer` with a recipe running adds a load pulse from the slider-crank torque curve (`mech/linkage.ts#strokeLoad`, gain 0.3):
  a flywheel smooths it, a bare crank lurches.
- Parts added: `brake` (Use toggles; a lit signal cell flips it; setting saved), `pillow_block`, `cam_drum` (six preset programs by Use, `DRUM_PRESETS`),
  `logic_gate` (nine modes by Use, `GATE_MODES`), and `shear_pin` now has a material setting (plain / copper 6 / bronze 12 / iron 24 su).
  Old pins load as setting 0 and keep the legacy rule (snap when the whole network is overloaded).
- Cam drum: while turning it advances (`advanceDrum`) and lights the signal cell on its north, east, south, west side for track 0, 1, 2, 3 (`Signals.drive`).
- Logic gate: left cell = A, right cell = B (relative to its facing), output to the cell in front (wire) and read as lit by touching machines. Evaluated with
  `mech/logic.ts` on the previous tick's levels (one tick delay; no hangs from loops). Counter / latch state is not saved (it rebuilds); the mode is.
- Save (`world.persist('workshop')` snapshot): new optional `mech: { v: 1, heat }`; part settings use the existing slot. Missing or bad `mech` = defaults, so every
  old save loads. Network momentum/speed is not saved: a wound motor and its line spin up again within a second or two.

## Pure modules (no wiring yet unless listed)
| Module | Purpose | Wired |
|---|---|---|
| `mech/drum.ts` | `Drum` pegs, `advanceDrum` edges, `follower` lift, save shape, `encoderPulses`, `Spring`, `Escapement` | drum: yes (presets) |
| `mech/logic.ts` | `LogicNet`: and/or/not/xor/cmp/latch/counter/delay/scale, loops cut by a back edge | gate: yes |
| `mech/linkage.ts` | slider-crank pose/rate/`strokeLoad`, rack, scissor lift, pantograph, lever, gantry `stepAxis` | `strokeLoad`: yes; poses are for render |
| `mech/bench.ts` | `mechBenchBlueprint()`, `placeMechBench(world, x, y, z, workshop)` | creative menu |

## Dev Mode bench
Dev Mode creative menu -> **Mech bench** builds a hall four blocks ahead of you: row 0 flywheel + brake + copper fuse + saw/loom load; row 4 seven shafts whipping
at 24 rpm (put a pillow block in the run); row 8 a cam drum lighting three lamps and an AND gate with two levers; row 12 a flywheel press line over a basin of bronze
ingots. Motors are pre-wound (Use a motor to wind it again, 30 s a wind).

## Goggles
`describe()` now adds "at N% speed", "whipping: add a pillow block", "hot: it fades", the fuse material and brake state, drum program, gate mode and counter. The richer
overlay (`NetInfo.findings`, `LoadGraph`) is not drawn yet (plan slice 5).
