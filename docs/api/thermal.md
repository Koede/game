# Heat zones and insulation

`src/game/thermal.ts` is the one temperature model. `GameState.thermal.temperatureAt(x, y, z)` gives degrees C; it is also what
the seasons work's `setTemperatureProvider` (src/sim/temperature.ts) answers with, so the hard-winter drain reads rooms and fires.

- **Sources** are what the game already had: a block's `warmth` / `warmthActive` radius, a lit furnace scaled by its `tempC`.
- **Outdoors**: the sky (night, frostfell, rain/snow, season offset `SEASON_OFFSET_C` in src/app/state.ts) plus fires with a clear line.
- **Rooms**: a flood fill that never meets open sky. Rise = `POWER_TO_C * power / (leak + LEAK_FLOOR)`, `leak` = sum over wall faces of
  `1 - insulation` (`INSULATION` table; the new `insulated_wall` keeps 95%, glass 12%). Doors seal. Caves settle at `CAVE_C`.
- **Survival**: a room at or above `COMFORT_C` shuts out the night and frost drain on every difficulty. Hard-winter worlds (flag saved
  by the seasons work) lose warmth below 0 C through `Winter.coldDrain`, which now sees the room's temperature.
- **Heat view**: H or the temperature chip under the vitals. `Thermal.grid()` feeds `src/render/heatView.ts` (one instanced mesh).
- **NPCs**: `NpcHost.temperatureAt`; on cold evenings and nights a person takes the warmest spot the routines already use
  (`src/npcs/warmth.ts`). `warmthDelta(tempC, hard)` is ready to add to a contentment score.
- `window.__hw.temperatureAt(x, y, z)` and `setHeatView(on)` for scripts. `scripts/e2e-heat.mjs` is the phone check.
