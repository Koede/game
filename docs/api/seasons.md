# Weather and seasons

Builds on the existing weather (docs/api/weather.md: `src/core/weather.ts`, `src/game/weather.ts`, `src/sim/weather.ts`).

- `src/sim/seasons.ts`: `seasonOf(day)` (6 clock days a season, spring first), `cropScale(season, crop, snowing)`.
  Wheat peaks in summer, carrots and potatoes in autumn, every crop crawls in winter (0.3-0.6); spring is the baseline
  (x1, so day-one growth is unchanged). Snow falling on an exposed crop halves its growth; growth never drops below 0.15
  so a crop never sleeps for good. Wild bushes are unaffected.
- `CropContext.scale` (cropRules.ts) carries the multiplier into `growthRate`; `Simulation.cropScaleAt` supplies it and
  `SimWeather.snowAt` says where snow falls.
- `src/game/weathering.ts` (`GameState.weathering`): toasts the blurb at each turn of the season; an empty `pail` held
  under open sky in steady rain (>= 0.3) becomes a `water_pail` after 20 s. `label()` gives "Day 3 of Autumn" for a HUD.
- Rain already soaked crops (counts as watered) and slows furnaces; storms are in `game/weather.ts`.
- Tests: `src/sim/seasons.test.ts`, `src/game/weathering.test.ts`.
