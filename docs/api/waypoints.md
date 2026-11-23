# Waypoint stones

Craftable standing stones (furnace forge, 6 stone brick + 2 charcoal + 1 flint) that mark places and let the player
fast travel between visited ones. Optional: no recipe or objective needs it.

- Content: `src/content/areas/world_waypoints.ts` (block `waypoint_stone`), tiles in `src/render/textures/areas/world_waypoints.ts`.
- Rules: `src/sim/waypoints.ts`. `WaypointNetwork` keeps stones (`place/at/remove/rename/visit/nearest`), lists
  `destinations(from)` (visited stones, nearest first, with a `fuel` price from `travelCost(distance)`: 1 charcoal per
  started 64 blocks, 1..8), gives a `landing(stone)` point and round-trips via `toSave()` / `WaypointNetwork.fromSave()`.
- Wired: see docs/api/exploration.md.
  `controller.teleport(...landing)`, and storing `toSave()` in the world save. All of that is a thin layer over the API above.
- Tests: `src/sim/waypoints.test.ts`.
