# Glassware models

Every piece of glassware is a block of shape `glass` (src/core/types.ts `BlockShape`). Its body comes from a model in
`src/world/glassModels.ts`, drawn by `src/world/meshGlass.ts`.

## Models

- A model is a list of boxes in 1/16ths of a cell (`GLASS_MODELS`). A round flask is stacked boxes that step in and out;
  a beaker is four hollow walls on a base; a column segment is a tall core with rings.
- The chemistry pieces (`CHEM` in src/core/distill.ts) each have their own model. Their `_done` twins share the plain piece's model.
- The furnace-top glass (`furnace_beaker`, `furnace_vial`, the sap and resin forms) uses the `beaker` and `vial` models.

## Curves

Glassware stays blocky, in keeping with the voxel style: flasks, columns, jars, funnels, caps, beakers, tubes and joints are all
boxes. The one curved shape is the condenser coil: a model's optional `coil` is a helix tube (`helixTube` in
`src/world/meshPrimitives.ts`) winding round its glass rod, between its brass end caps. The tube is a circle swept along the
helix, about 3 quads per step and 6 sides round (about 144 quads for three turns). The coil's own vertices stay inside the cell,
and the whole coil piece is held under a vertex budget in `meshGlass.test.ts`. The helix is not a liquid vessel, so
`liquidProfile.ts` does not follow it.

## Joining

Each model names its `ports`: the faces where it can join another piece (a flask has a port down for its burner plate, up for a
column or condenser, and on every side for tubes; a burner plate has only one, up). A joint, a tube with a brass flange ring at the
cell face, appears on a face only when this piece has a port there and the neighbour is glass with a port looking back
(`GLASS_PORTS`). So pieces join where real glass joins, loose pieces stay clean, and a new piece fits the rest as soon as its ports
line up. The tube is 4/16 wide (`TUBE_HALF`) and the flange 6/16 (`FLANGE_HALF`).

## Adding a piece

1. Give the block `shape: 'glass'`, `solid: true` (or `false` for a furnace-top piece) and `translucent: true`.
2. Add a model (boxes and `ports`) to `GLASS_MODELS` under its key, and map any extra keys (done twins, boiling forms) in `MODEL_OF_KEY`.
3. `npm run ids:sync` and `npm run golden:update`.

`src/world/meshGlass.test.ts` checks that every glass-shaped block has a model, every model fits its cell, arms join glass only, and
the coil and each piece stay under the vertex budget. `src/world/meshPrimitives.test.ts` checks the helix tube's counts, bounds
and outward faces.
