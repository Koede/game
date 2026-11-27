# Winter prep

Builds on seasons (docs/api/seasons.md) and the cold rules (`src/game/survival.ts`, `src/game/cold.ts`).

- **Every world:** rivers and lakes freeze from day 2 of winter (open water with water or ground under it becomes `ice`)
  and thaw in spring. Only ice this module froze thaws: it was edited by the sim and has water below, so the frostfell's
  natural ice stays. `Winter` scans `FREEZE_BUDGET` columns a tick within `FREEZE_RADIUS` of the player.
- **Hard-winter worlds:** a world created on Hard difficulty. `Winter.hard` is saved with the world (`winter` extra);
  a save without it (every older world) is never hard, whatever the Settings difficulty says, so an old save meets no
  sudden winter. Normal worlds keep today's gentle winter.
  - Cold: out in the cold (`temperatureAt` < 0) the player loses `-t * WINTER_DRAIN_PER_C` warmth a second extra
    (cause `frost`), building up over the first days of the first winter. Roofs and fires work as ever.
  - Crops: `cropScale(season, crop, snowing, hardWinter, exposed, tempC)`: an exposed crop is frozen (0) in winter; one under a
    roof grows by the air temperature: heated to 10 °C it is a greenhouse at full pace (docs/api/greenhouse.md).
  - Goal track (`Winter.goals()`, `activeGoal()` shown on the HUD goal plate through the first autumn and winter):
    stockpile fuel (`FUEL_TARGET_S` burn-seconds in the pack and nearby crates), raise a greenhouse (a crop under glass),
    live to the thaw. Toasts announce autumn, winter and the thaw.
- **Temperature API** (`src/sim/temperature.ts`): `temperatureAt(query)` is a seasonal stub (season, night, snow,
  shelter). The heat-zones work plugs in with `setTemperatureProvider(fn)`; the provider returns degrees C or null.
- Tests: `src/game/winter.test.ts`, `src/sim/temperature.test.ts`, `src/sim/seasons.test.ts`, `tests/winter-save.test.ts`.
