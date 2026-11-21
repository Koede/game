# Bronze workshop (src/workshop) - API note

Design: `docs/OVERHAUL_PLAN.md` part A (Create-style, adapted). The planned shaft core of STEAM_PLAN (axles, cogs,
mechGraph/mech) is NOT built; this module is a self-contained kinetic layer that it can feed later through `extraRpm`.

## Content (`src/content/itemsWorkshop.ts`, `recipesWorkshop.ts`, fixture `specRosterWorkshop.ts`)
Blocks: `hand_crank`, `drive_shaft`, `conveyor_belt` (slab, oriented), `mech_saw` (chopping_block recipes, full blade yield),
`mech_millstone` (hand_quern), `mech_mortar` "Stamp Mill" (mortar, with its bonus chance), `mech_loom` (loom). Item:
`engineer_goggles`. All age `ageIndexOf('bronze')` (= 0 until BRONZE_PLAN W0). Faces/icon: `src/render/textures/iconsWorkshop.ts`.

## Runtime (`workshop.ts`, class `Workshop`, owned by `Game`, saved with `world.persist('workshop')`)
- Parts join on all six sides into networks (BFS each tick, capped 512). A network turns at `CRANK_RPM` 16 while a crank in it
  was Used in the last `CRANK_S` 2.5 s (holding Use repeats). Capacity `CRANK_CAPACITY` 8 su per turning crank; `STRESS`:
  belt 0.25, saw/millstone/mortar 4, loom 2. Over capacity: overstressed, stops, one toast.
- The voxel ACTIVE bit mirrors turning (faces `*_on`).
- Belts move ground items lying on them away from the side they were laid from (`-facing`), `BELT_SPEED` 1 block/s at 16 rpm,
  centred on the belt. At the end a mechanical station in front takes the items in; any other solid block stops them.
- Stations take items lying on their top or put in by Use (held stack, up to `MACHINE_BUFFER` 16), work one stroke recipe in
  `strokes x STROKE_S` (0.5 s) at 16 rpm and drop the output out of their front as ground items. Broken: contents dropped.
- `use(x,y,z, held, takeHeld)` (called first in `Interaction.beforeUse`; a held block is never eaten: null so it is placed),
  `tick(dt)`, `netAt`, `describe(x,y,z)` ("Millstone - 16 rpm, load 4.25/8 su, Flour 40%, holds 2 Wheat"), `toJSON/load`,
  `verify()` (drops saved parts whose block is gone; Game calls it every 200 ticks), `extraRpm` hook.
- `inspector.ts`: `inspect(probe, x,y,z)` for Engineer's Goggles (carried anywhere in the pack): workshop part, else furnace heat
  and fire, else machine status and watts. Game shows it as the crosshair name.

## Tests and checks
`src/workshop/workshop.test.ts` (belt carries and stops, belt into millstone, top intake + Use, overstress, held block, save);
`node scripts/e2e-workshop.mjs [--no-build] [--device=...]`, chained in `npm run e2e`.
