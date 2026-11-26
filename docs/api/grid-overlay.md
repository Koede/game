# Power grid overlay, Grid Meter and Grid Monitor

Files: `src/content/areas/power_grid.ts`, `src/game/gridMeter.ts`, `src/render/tech/gridOverlay.ts`, `src/sim/gridViews.ts`
(`gridCells`, `cableLoad`), `src/sim/power.ts` (losses), `src/render/textures/areas/power_grid.ts`.

- **Grid Meter** (item, forge T1, 2 copper wire + glass + tin ingot). Held, the overlay shows every grid within 24 blocks. Use on a
  cable or machine toasts that network's reading ("Brown-out: 2 kW made, 3 kW wanted - machines run at 66%. 200 W lost.").
- **Grid Monitor** (block `grid_monitor`, id 280+, forge T2, meter + 2 copper cable + glass + 2 copper ingot). A 5 W consumer: its lens
  is lit while its network has power. Its screen is the full network panel (supply, demand, stored, one minute of history, cable load,
  losses, members). Within 12 blocks of a switched-on monitor the overlay shows that monitor's own network without holding the meter.
- **Overlay**: cables are bright cores seen through walls, green under 60% of the weakest cable's rating, amber to red above it, red
  when overloaded and amber-red when browned out. Machines are faint boxes: cyan sources, violet storage, green consumers, red
  consumers that get less than they ask. A grid in trouble pulses. The cells are rebuilt once a tick (`Simulation.gridOverlay`).
- **Losses** (`NetworkStats`): `lossW` is watts lost charging batteries (the round trip), `chokedW` is demand the weakest cable kept from
  getting through, `shortW` is demand left unmet. The network panel prints them as "Losses: ...".
- **Brown-outs** are the existing solver: below 90% satisfaction a network is browned out (alert after 3 s), consumers run at that
  fraction and stop below `BROWNOUT_STALL` (25%). Nothing here changes the solver's numbers, so old saves load with the same grids.
