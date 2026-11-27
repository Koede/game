# Steam: the small loop and the sealed boiler

Code: `src/sim/boilers.ts` (the vessel), `src/sim/brewing.ts` (the kettle), `src/workshop/workshop.ts` (`steam_rotor` source),
content in `src/content/areas/steam_loop.ts`. Plan: `docs/BRONZE_PLAN.md`, `docs/advice/tech-spine.md` (K1 to K8).

## Numbers (final; they win over the plan tables)

| Thing | Value |
|---|---|
| Steam Rotor | workshop source, 16 rpm, 4 stress units (200 W), piston-style torque curve |
| Copper Steam Kettle | the brewing kettle machine on a furnace top; open steam, no pressure; 4000 L water; with a working rotor on it: 3.3 kW from the furnace and 2 L/s of water, then dry = no steam |
| Boiler | closed shell of `boiler_plate` / `boiler_gauge_glass` / `safety_valve`, 2 to 100 empty cells inside, 9 blocks at most each way |
| Heat | each furnace under a floor plate of the vessel gives 10 kW while it is at least 150 C (three furnaces at most) |
| Steam | 6 L/s per kW; 0.1 L water per L steam; sag 0.2 %/s |
| Pressure | bar = steam litres / (1000 L per cell) |
| Water | 2000 L per cell, a bucket pours 1000 L (Use on the gauge glass) |
| Rotor on the shell | needs 2 bar (stops under 1.5), draws 12 L/s while its shaft line has work |
| Safety valve | in the shell; Use cycles 2, 4, 6, 8 bar; vents `(bar - set) x volume`, at most 400 L/s |
| Rating and burst | 8 bar; a warning toast and hiss from 7 bar; above 8 bar for 5 s the shell is destroyed |

## Reading pressure from other systems

`Simulation.boilerPressures()` returns `{ x, y, z, bar, fill, valve }` for every formed boiler: `fill` is bar over the rating
(0 to 1 and above) and `valve` says a `safety_valve` is in the shell. The disasters over-pressure hazard (PR #26,
`BoilerProbe.fill`) can read `fill` instead of the legacy boiler's steam room.

## Shaft power

K6 is done: `GENERATOR_SHAFT` and `Workshop.generatorWatts` are gone. Water wheels, wind turbines and the old steam engine make
watts only and no longer join shaft networks. The only shaft sources are cranks, the clockwork motor, the treadwheel, a tractor and
the steam rotor.

## Ports, pipes and the beam engine

Wall parts (part of the shell): `heat_port` takes 10 kW from a furnace touching it on the outside; `water_port` takes 20 L/s from water
touching it (and Use pours a full bucket in); `steam_port` joins the `steam_pipe` run touching it. Pipes (100 L of steam room each) and
`beam_engine` blocks touching that run, up to 200, are the vessel's line and share its pressure. The beam engine is a workshop source:
needs 2 bar, 16 rpm per bar up to 96, 6 stress units, draws 10 L/s per bar (10 % while its shaft line has no load).

## Water wheels (decision for the integration thread)

`water_wheel`, `wind_turbine` and `steam_engine` are watts-only blocks since K6 (see above). The plan's water source for shafts is a
NEW block, the mill wheel (K5, 6 su per side, 300 W, `mill_wheel`), which is not built here. Water power PR #19 should either add the
mill wheel as a `sourceFor` provider in `workshop.ts` (like `steam_rotor`: a `Workshop` hook that returns `{ rpm, capacity }`) or, if
it wants the old wheels to turn shafts, restore a small bridge in `sourceFor` for `water_wheel` only. Nothing else here depends on it.

## Not built yet

Mill wheel and windmill, scald damage from a burst (PR #26 adds it from `boilerPressures()`), the steam tank, and the energy ledger test (K3).

## Windmill, steam tank and the ledger

- `windmill` (forge: 6 plank, 2 cloth, drive shaft, bronze cog) is a shaft source that needs no fuel. It wants open sky (nothing solid in the 24 blocks above) and no other windmill within 5 blocks; the lower key keeps its wind. It turns at 8 + 16 x wind rpm and carries 100 to 400 W (`windmillW`), plus a small altitude bonus.
- `steam_tank` (6 bronze plate, steam pipe) is a line cell holding 8000 L of steam, so a tank on the line smooths pressure swings.
- `src/core/energy.ts` is the single ledger (W = su x rpm x 3.125; steam 167 J/L; 0.1 L water per L steam; every efficiency below 1). Beam engine output derives from it: about 3 su at 2 bar, 6 su at 6 bar. `src/core/energy.test.ts` checks that no source gives more shaft power than its heat in times its efficiency.
