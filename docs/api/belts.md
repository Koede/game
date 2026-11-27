# Belt lanes and underground runs

`src/game/belts.ts` - a pure simulation, not yet placed by blocks.

- `BeltGrid.set(x, y, z, cell)`: `belt {dir}`, `sorter {dir, filter, side, deny?}` (matching items leave by the side, the rest go
  straight), `tunnel_in` / `tunnel_out` (items jump under up to 8 cells, same direction), `sink {inv}`, `source {dir, inv, item?, everyS}`.
- Each belt cell holds one item moving 2 cells/s and waits when the next cell is full, so lanes back up behind a full sink.
  `items()` gives every riding item with an interpolated position for drawing; `delivered` counts arrivals by item.
- Status (audit 2026-11-27): still orphaned, no caller outside tests; decide between wiring it or deleting it.
- Not done: block types and textures for belts, a renderer, saving the grid, and bridging to the existing item pipes (docs/api/transport.md).
