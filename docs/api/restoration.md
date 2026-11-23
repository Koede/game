# Ruined old-age machines

- Blocks (`src/content/areas/world_ruined.ts`): `ruined_machine` (placed by `old_factory` at local (6,0,8) and `chem_lab` at
  (5,0,6) in `src/world/structureDefs.ts`; a natural block, drops iron ore / wire) and `repaired_machine`.
- `src/game/restoration.ts` (`GameState.restoration`, saved as `restoration`): Use on a ruined machine. Its job is a pure
  function of (seed, position) over `REPAIR_JOBS` (six research-gated recipes: vis_rod, essentia_tube, arcane_workbench,
  rune_desk, iron_rod, infusion_altar), each with a parts list (copper, bronze/iron plate, coil, glass, leather). Missing parts: a
  toast names them. With them in the pack they are taken, the block becomes `repaired_machine` and the recipe is learned.
- The unlock overrides the research gate: `setCraftGate(restoration.gate(magic.craftGate))` in `src/app/game.ts`. Research
  still unlocks every recipe the normal way, so the game stays finishable without any machine.
- Tests: `src/game/restoration.test.ts`; the structure palette test allows the machine block.
