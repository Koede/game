# Glassware models

Every piece of glassware is a block of shape `glass` (src/core/types.ts `BlockShape`). Its body comes from a model in
`src/world/glassModels.ts`, drawn by `src/world/meshGlass.ts`.

## Models

- A model is a list of boxes in 1/16ths of a cell (`GLASS_MODELS`). A round flask is stacked boxes that step in and out;
  a beaker is four hollow walls on a base; a column segment is a tall core with rings.
- The chemistry pieces (`CHEM` in src/core/distill.ts) each have their own model. Their `_done` twins share the plain piece's model.
- The furnace-top glass (`furnace_beaker`, `furnace_vial`, the sap and resin forms) uses the `beaker` and `vial` models.

## Joining

Every glass piece sends a tube arm (`TUBE_HALF` = 2/16 either side of the centre, so 4/16 wide) towards each of its six neighbours
that is glass (`GLASS_JOINS`). Arms run from the middle of the cell to the face, so two touching pieces share one tube, and any
glass piece fits any other without a table of pairs.

## Adding a piece

1. Give the block `shape: 'glass'`, `solid: true` (or `false` for a furnace-top piece) and `translucent: true`.
2. Add a model to `GLASS_MODELS` under its key, and map any extra keys (done twins, boiling forms) in `MODEL_OF_KEY`.
3. `npm run ids:sync` and `npm run golden:update`.

`src/world/meshGlass.test.ts` checks that every glass-shaped block has a model, every model fits its cell, and arms join glass only.
