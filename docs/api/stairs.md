# Stairs and slanted roofs (src/world/meshStairs.ts, src/core/stairShape.ts, src/content/areas/stairs.ts)

- Blocks: `plank_stairs`, `stone_brick_stairs` (shape `stairs`) and `plank_roof`, `stone_brick_roof` (shape `slope`). Hand recipes: 3 planks
  (or stone brick) make 4. All are oriented: the voxel's Facing is the LOW side, so a block faces the player who placed it and rises away
  from them (Facing.North = low side towards -Z).
- `stairs`: a half-height step over the whole cell plus a half-height riser over the back half (two boxes). `slope`: a wedge from nothing
  at the front edge to a full-height back wall, drawn with custom quads (`meshStairs.ts`). Both are solid, not opaque, and wear the
  plank / stone brick tile.
- Collision (`player/collision.ts`): both shapes are two boxes from `STAIR_BOXES` (front half 0.5 high, back half 1 high); the generic
  `solidHeight` reports 0.5 for them. The auto-step of half a block climbs a flight without jumping. Mobs treat them as full blocks.
- A flight of stairs rises one block per cell: put a stair block on a column of full blocks that is one block taller per cell (the tavern
  staircase, `src/npcs/tavern.ts`); each cell is then two half-steps and the top tread is level with the floor above. Leave the floor above
  open over the climb for head room.
