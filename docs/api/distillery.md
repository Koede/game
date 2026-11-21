# Glass distillery - API (first playable slice)

Design and the full plan: `docs/DISTILLERY_PLAN.md`. This note is what exists in code and how to use it.
Tests: `npx vitest run src/core/chem.test.ts src/sim/distill src/render/distill src/game/distillFuel.test.ts`
(35 tests). Browser: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-distill.mjs --out=<dir>` (desktop and
phone portrait; chained last in `npm run e2e`).

## Files

| file | what |
|---|---|
| `src/core/chem.ts` | the mixture model: components, bubble point, vapour enrichment, grades (`nameOf` / `expand`), column trays and cuts |
| `src/core/distill.ts` | module kinds (`CHEM`), the four states and their look, setpoints, rates, `CHEM_CONTAINERS`, `FUEL_GRADES` |
| `src/content/{blocks,items,machines,fluids,recipes}Distill.ts` | 13 blocks (10 kinds + 3 `_done` twins), 12 items, 10 machine specs (role `chem`), 11 fluids, forge recipes and process cards |
| `src/sim/distillScan.ts` | `scanRig(world, x, y, z)`: modules, stills, liquid edges, seals, jackets, problems |
| `src/sim/distill.ts` | `Distillery`: entities, rigs, the 4 Hz step, block states |
| `src/sim/distillActions.ts` | `chemUse`, `chemView`, `chemPortEndpoint` |
| `src/render/distill/distillFx.ts` | liquids, bubbles, drips, tube streams and column bands (2 draw calls) |
| `src/render/textures/distill.ts` | module tiles (frame, emblem, state lamp and rim) and container icons |
| `src/sim/distillKit.ts` | test fixture: `buildRig(rigString)`, `feed(card, flask)`, `runUntil` |
| `scripts/e2e-distill.mjs` | the browser check |

## Contracts

- **Mixtures** (`Mix`): litres per `Component`. Every move goes through `pour` / `take` / `add`; litres leave a buffer
  only as litres another buffer took. Fuzz-tested (60 random rigs, 2000 steps).
- **Grades**: `nameOf(mix)` is the first grade in `GRADES` the mixture meets (best first), else `'slop'`;
  `expand(fluid, L)` is the grade's own composition, which meets it. Round trips never gain purity.
- **Fluids**: `FluidKey` gained `sap syrup sugar_wash low_wines spirit fuel_ethanol gasoline kerosene diesel residue slop`.
  `crude_oil`, `gasoline`, `kerosene`, `diesel` and `residue` have `bucket: { full: '<x>_canister', empty: 'empty_canister' }`,
  so tanks, pumps and `bucketUse` handle canisters like buckets (1000 L).
- **MachineRole** gained `'chem'`. Chem blocks are never machine nodes: `Simulation.onBlockChanged` routes them to
  `Distillery.place/remove` (before brewing), `resync` tracks entities whose kind is a chem kind.
- **Entity** (saved as JSON): `{ kind: <module kind>, x, y, z, mix, state, setC? (base), ran?, recvS?, flow?, band?, tempC? }`.
  Rigs are derived and never saved.
- **State on the block** (plan 2.1): `idle` plain/off, `working` plain/active, `done` `_done`/off, `blocked` `_done`/active
  (flask, vessel, receiver). Base, segments, condensers, tubes and jackets use the active bit for working. Tiles: dark /
  amber / green / red lamp and rim.
- **Events**: `sfx machine_done` (pitch 1.4) and a `toast` "Distilling run finished" or "Fermenting done: ..." when a flask
  or vessel goes working -> done; `sfx pipe_clunk` on becoming blocked; flags `distilled`, `fermented` (`flagOnce`).
- **Heat**: a still base holds its flask at `min(setC, furnace below, 450)`; boiling draws `400 J/L` into the furnace's
  `extractW` (20 L/s -> 8 kW).

## Simulation calls

```ts
sim.distill: Distillery                       // entities: entityAt, all(), litres(), rigAt(x,y,z), step(dt), baseTemp(base)
sim.chemUse(x, y, z, heldKey): ChemResult | null   // null = not a chemistry action (the tap carries on)
sim.brewView(x, y, z)                         // now BrewView | ChemView | null; ChemView.text is the crosshair line
sim.fluidEndpoint(x, y, z, face)              // a chem_port: touching a flask/vessel = inlet, a receiver = outlet
```

`chemUse` table: empty hand on a base cycles `STILL_SETPOINTS` (78 92 97 130 200 260 350 420); empty hand elsewhere
toasts the view line; a full container (`CHEM_CONTAINERS`) pours into a flask, vessel, receiver or (water only) jacket if
the whole container fits; an empty container takes the named contents of a flask, vessel, receiver or condenser when
there is a full container's worth and that container can hold that fluid (beakers: 250 L alcohols and syrups; canisters:
1000 L oils and slop; pails: water). Every refusal is a sentence. The player module reaches it through `BrewTools`
(role `chem` -> `BrewHands.chemUse`).

## Rig rules (what the scan derives)

Still = flask on a still base; column = segments straight up; head = condenser on top; side draw = condenser beside a
segment (height h). Liquid pours down and sideways, never up; a flask or vessel takes from the side only through a
glass tube; edges both ends can pour along share levels. Airlock cap on a vessel = sealed; a cooling jacket with water
touching a condenser = x3 condensing and a 30 C head. Problems: `no_base no_condenser drips_nowhere too_tall
loose_segment shared_condenser too_many` (shown in the crosshair line of the module they name).

## Process cards (Codex)

`PROCESS_CARDS` in `recipesDistill.ts` are RecipeSpecs at a module station (role `chem`, energy 0) with a `rig` string,
so the Codex lists them through `RECIPES` with no script change. The solver (`progression.ts chemReady`) runs one when
every block of its rig is owned and, with a base, a furnace reaches its setting. `distillProcess.test.ts` builds each rig
and checks it makes at least the card's outputs. Cards: distil_syrup (130 C), ferment_wash, distil_low_wines (97 C),
distil_spirit (92 C), refine_crude (350 C, 3 segments), rectify_spirit (2 segments), refine_crude_short (2 segments:
gasoline and kerosene come over as slop).

## Engines

`FUEL_GRADES`: `fuel_canister` 1/1, `gasoline_canister` saw 1.3 / tractor 1.2, `diesel_canister` tractor 1.5 (a chainsaw
refuses it), `fuel_ethanol_beaker` 0.25 / 0.2. `felling.ts isSawFuel / refuelChainsaw` and `vehicles/manager.ts refuel`
read it and hand the empty container back.

## Ages

Ember (furnace tier 1): base, flask, condenser, receiver, tube, vessel, airlock; syrup, wash, low wines, spirit.
Forge (tier 2): column segment, jacket, port, canisters; crude refining, fuel ethanol. Gated by the recipes' `minTier`
and items' `age` only, so the six-age refactor moves them by editing those fields.
