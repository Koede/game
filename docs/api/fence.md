# Fence (src/world/meshFence.ts, src/content/areas/fence.ts)

- Block `fence` (shape `fence`): a slim square post (6/16 to 10/16 of the cell) that grows an arm to each of its six neighbours that is
  another fence or an opaque cube (`FENCE_JOINS` in `blockTables.ts`). A row of fences is one rail; one fence under a roof joins up into it.
- Solid (full-cell collision), not opaque (it hides no faces and blocks no light), drawn in the opaque batch with the plank tile (no new
  texture). Hand recipe: 2 plank + 2 stick -> 4 fence.
- The tavern uses it for the balcony railing and for rafters under the roof and across the hall (`src/npcs/tavern.ts`).
