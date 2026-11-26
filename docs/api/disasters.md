# Disasters with counterplay

`src/game/disasters.ts` (rules and state), `src/content/disasters.ts` (every number, by difficulty). Three hazards, each
with a condition that prevents it and a telegraph before it lands. Ticked by `GameState` after the simulation;
saved as the optional `WorldSave.disasters` (`{ v: 1, pressure, soot, strikeInS }`; older saves start calm, a damaged block is ignored).

## Difficulty (the world's hard-mode flag)

Harsh is the per-world hard flag the winter module saves at creation (`winter.hard`, docs/api/winter.md): an old save never has it, so Hard in Settings does not make it harsh. Peaceful still comes from `Settings.difficulty`. `peaceful` has no disasters, `normal` is mild (long warnings,
nothing blown up, little damage), `hard` is harsh (short warnings, blasts, fire spreading, strikes burning a run of cables).
The mapping is the `difficulty` callback in `GameState`.

## The three hazards

| Hazard | Builds when | Telegraph | Prevented by |
|---|---|---|---|
| Boiler overpressure | the steam room is at least `riseFill` full while the fire under it is hot (steam nobody uses) | "groaning" toast at 45%, red alarm + hiss at 80%, then it bursts at 100% | a `safety_valve` block within 2 blocks (vents steam, holds pressure under the red), using the steam, or letting the fire die. Normal: the boiler alone is wrecked. Hard: a blast (radius 2) |
| Chimney fire | a lit furnace below `burnOffC` lays soot (smoky fuel x flue factor); at 1.0 and hot enough the flue catches | "darkening" toast at 45%, "FLAMES IN THE FLUE" at 80% | a Brick Chimney stack on the furnace (x0.2 soot) with clear air above it (a ceiling is x2), clean fuel (coal, charcoal, coke), burning hot (soot burns off), or **sweeping**: use a stick on the chimney (`stick_sweeps_flue`). A fire puts the furnace out (hard: it eats nearby woodwork and burns a player within 3 blocks) |
| Storm on exposed wiring | a storm at 0.5+ intensity picks a cable with open sky above it every 90-180 s (hard 35-80 s) | "STATIC ON YOUR WIRING" toast, crackle sounds rising for `warnS` seconds (8 normal, 4 hard) | covering the cable (any solid overhead, even placed during the warning), or a lightning rod: a mast of at least two bronze / riveted plate blocks whose top stands above the cable within 8 blocks. Otherwise 1 cable (hard: 4) burns out and a player within 3 blocks is burned (hard) |

All hazards emit a `toast`, a positioned `sfx` and `disaster:warn { kind, level, x, y, z }` (`watch`, `warning`,
`imminent`, `struck`, `averted`). `Disasters.alerts()` lists the live ones for a HUD.

## Hooks for the other threads

Everything the rules need arrives as probes built in `GameState` (`disasterFurnaces`, `disasterBoilers`, `sim.eachCable`):
- **Steam loop:** `BoilerProbe.fill` is the steam room's fill today; swap it for a real pressure ratio when the loop has
  one. The valve is any block keyed `safety_valve` within `VALVE_REACH`, or pass `DisastersHost.valveNear`.
- **Heat zones:** `FlueProbe.tempC` is the furnace's temperature; a zone model can feed its own.
- **Seasons / hard mode:** `winter.hard` feeds the `difficulty` callback.

Tests: `src/game/disasters.test.ts` (rules), `src/app/disasters.test.ts` (save compatibility), `src/player/toolUses.test.ts` (the sweep).
