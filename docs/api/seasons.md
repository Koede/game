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

## Seasons in the picture
- `src/render/seasonTint.ts`: `seasonTints(day)` gives the colour oak leaves and grass lean towards (target of unit luminance plus an amount),
  easing from one season's middle to the next; summer is the unchanged baseline, spring fresher, autumn orange and straw, winter dull and pale.
  The chunk shader (`uLeafTint`, `uGrassTint`) keeps each texel's brightness and pulls its hue; each leaf clump turns at its own pace.
  Pines stay green. `leafFall(day)` is 0..1 and drives `SeasonFx` (`src/render/seasonFx.ts`): loose leaves drift from the underside of
  oak crowns near the player through autumn and the first days of winter.
- Phone check: `scripts/e2e-seasons.mjs` (a small oak photographed in each season).
- The HUD dial's day text takes the season's colour (`data-season` on `.hw-dial`) with the season and day in its tooltip and aria label; the
  Hearth Log header reads "Day 16 · Autumn, day 4 of 6" (`seasonLine`, src/sim/seasons.ts).
