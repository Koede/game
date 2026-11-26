# Air (BRONZE_PLAN 4.4, 5.3)

## Blocks (`src/content/blocksAir.ts`, `BlockSpec.air`)
| key | role | volume | notes |
|---|---|---|---|
| air_tube | tube | 50 L | shape `pipe`, family bit `PIPE_AIR` in the mesher tables; arms to every air block |
| air_tank | tank | 4000 L | |
| air_compressor | source | 50 L | 2 L/s per rpm from 32 rpm, nothing at 6 bar |
| blast_nozzle | user | 20 L | hearth face part; 2 bar, 20 L/s while the hearth burns; counts as 2 tuyeres |

Recipes are `forge(2, ...)` at the Bronze Furnace (tube 800 C, tank and compressor 900 C, nozzle 1100 C). Air blocks have no `pipe` spec and no
machine: item and fluid pipes never join them and they never join item or fluid pipes.

## Network (`src/sim/airNet.ts`, `Simulation.air`)
- Every touching air block joins one network; `bar = airL / volumeL`, at most 6. Floods run on place/remove only, and keep the pressure each part had.
- A tube run that ends in open air (one joined arm, the cell across is not solid and not a member) leaks `100 x bar / 6` L/s.
- `feed(x, y, z, dt)` takes a user's litres when its network holds the minimum pressure. `HearthSet.tick` asks for every nozzle of a lit furnace.
- Saved as one `air` entity per network at its lowest cell; `resync` floods again from them (columns not loaded yet wait).
- The shaft is not built yet: `AirHost.shaftRpm(x, y, z)` is the seam the steam work plugs into. Until then a Use on a compressor works the piston by
  hand (`crank`, 26 L a stroke, 0.4 s apart); a Use on any air block toasts its pressure (event `air:use`).

## Blast hearth rule
`HearthStructureSpec.requiredParts` (tier 3: `{ blast_nozzle: 1 }`), problem code `parts` ("Needs 1 more Blast Nozzle in a wall"), a `parts` row in
the structure checklist. `FurnaceEntity.legacyHearth` (set by save migration rev 3 -> 4 on every furnace of tier 3 or more) exempts old hearths.
