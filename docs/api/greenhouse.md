# Greenhouses

A greenhouse is any roofed crop whose air is warm. Glass and heat together let crops grow through winter. The rules are in
`src/sim/seasons.ts` (`shelterOf`, `cropScale`), the temperature comes from the heat zones (`docs/api/thermal.md`) through
`src/sim/temperature.ts`, and the simulation asks for it only for roofed crops (`Simulation.cropAirC`).

| Where the crop stands | Shelter | Growth multiplier |
| --- | --- | --- |
| Open sky | `open` | season table (`CROP_SEASON`), halved by falling snow; hard-winter winter: `frozen`, 0 |
| Roofed, air at `GREENHOUSE_WARM_C` (10 °C) or more | `greenhouse` | `max(season, GREENHOUSE_GROWTH)` = spring pace or better, any season, any world |
| Roofed, colder than that | `cold` | season table with no snow; hard-winter winter: `COLD_FRAME_SCALE` (0.35) |
| Roofed, below `FROST_C` (0 °C), hard-winter winter | `frozen` | 0 |

- Light still matters: glass lets daylight in, an opaque roof needs a powered lamp in reach. Water works as before.
- What heats it: anything the heat zones count, such as a lit furnace (warmth 6 and up) or a powered space heater. A torch
  is too small for a glass house. Glass keeps only 12% of heat, so a small house, or one with insulated walls and a glass
  roof, needs less fire.
- Without a temperature (no heat zones) a roofed crop in a hard winter grows at `GREENHOUSE_SCALE` (0.8), the rule from
  before heat mattered.
- `Simulation.cropView` adds `exposed`, `shelter` and `tempC` (roofed crops), and the crosshair label
  (`src/ui/hud/cropText.ts`) says "greenhouse 18 °C", "cold 4 °C: heat it to 10 °C for full pace" or
  "frozen at -3 °C: heat the room to 10 °C".
- The first-winter goal "Raise a greenhouse" (`src/game/winter.ts`) still completes on a crop under glass; its text now
  asks for heat too.
- Tests: `src/sim/greenhouse.test.ts`, `src/ui/hud/cropText.test.ts`. Phone check: `scripts/e2e-greenhouse.mjs`.
