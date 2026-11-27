# Plumbing and irrigation (Bronze Age)

Code: `src/sim/waterNet.ts` (the network), content in `src/content/areas/plumbing.ts`, textures in
`src/render/textures/areas/plumbing.ts`, spray droplets in `src/render/emitters.ts` (`'water:spray'`). Tests:
`src/sim/waterNet.test.ts`; phone check: `node scripts/e2e-plumbing.mjs [--no-build] [--device=phonePortrait]`.

## Blocks

| Block | Role | Holds | What it does |
|---|---|---|---|
| Copper Water Pipe (`water_pipe`) | pipe | 25 L | Joins every plumbing block and boiler Water Port it touches. Pipe-shaped, its own family (never joins Forge fluid pipes or air tubes). |
| Hand Pump (`hand_pump`) | pump | 20 L | Must touch still water. Use = one stroke, 40 L (0.35 s between strokes). A workshop shaft beside it pumps 0.5 L/s per rpm (a 16 rpm steam rotor: 8 L/s). |
| Cistern (`cistern`) | cistern | 2000 L | Storage. Open to the sky (nothing solid or liquid above), it catches 2 L/s of rain while it rains on it. |
| Sprinkler (`sprinkler`) | sprinkler | 10 L | Pipe-shaped brass rose. While its line holds water it uses 0.5 L/s, shows its wet texture (voxel active flag) and throws droplets; every crop within 4 blocks across and 0 to 3 blocks below counts as watered, roofed or not. |
| Water Port (`water_port`, steam loop) | port | 0 | A sealed boiler's Water Port with a water pipe on the outside fills from the line at up to 20 L/s (the same rate as water touching it). |

Recipes are furnace forge jobs at the Bronze Furnace (tier 2): 8 pipes from 2 copper ingots; a hand pump from 3 copper,
1 bronze, 2 plank and a pipe; a cistern from 6 plank, 2 copper and a pipe; 2 sprinklers from 1 bronze and 2 pipes.

## Rules

- A network keeps one number, `waterL`, at most the sum of its members' `volumeL`. Floods run on block changes only.
- A pump drawing from water with two sources beside it (`refillsAsSource`) never runs it dry; a lone source block is
  removed after every 1000 L, like the Forge pump.
- Saved as one `water` entity per network at its lowest plumbing cell; `Simulation.resync()` restores it.
- Crops: `CropContext.irrigated` (set from `WaterNets.irrigated`) is the third way to be hydrated, next to water in reach
  and rain (`isHydrated` in `src/sim/cropRules.ts`).

## API

- `Simulation.water: WaterNets` — `netAt`, `view`, `stroke`, `draw`, `irrigated`, `isSpraying`, `sprayingAt`.
- `Simulation.waterView(x, y, z): WaterView | null` — `{ block, name, role, waterL, capL, status }`.
- Events: `'water:use'` (a Use on a plumbing block: the sim strokes a pump and toasts the line), `'water:spray'`
  (twice a second per spraying sprinkler, for the renderer).
- Debug: `window.__hw.plumbing(x, y, z)` → `{ status, waterL, hydrated }`.
