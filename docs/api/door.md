# Wooden door (src/core/doorShape.ts, src/world/meshDoor.ts, src/content/areas/doors.ts)

- Block `wooden_door` (shape `door`, oriented, solid, not opaque, axe to break). Hand recipe: 4 plank + 2 stick -> 1 door.
- Two cells tall, because the player is 1.8 high and cannot pass a one-cell opening. The bottom half is the placed block (variant 0);
  the top half is the same block id with variant `DOOR_TOP` (1), sitting in the cell above. Placing needs the cell above free and clear
  of the player (`Interaction.placeBlock`). Breaking either half clears the other with no second drop (`clearDoorPartner`).
- Use on either half toggles the active bit on both halves (`Interaction.swingDoor`). Active = open.
- Closed: solid. Collision (`player/collision.ts`) uses a thin box across the facing axis (6/16 to 10/16 of the cell, full height), so
  the player stops at the panel. Open: no collision box, so the player walks through.
- Drawn by `meshDoor.ts`: a plank panel thin across the facing axis; closed, the bottom half has a small handle on the front side;
  open, the panel lies against one edge of the cell.
- Housing: `DOOR_KEYS` in `npcs/housing.ts` holds `wooden_door`, so a room with a door is no longer "needs a door".
- Not done: mobs and NPC pathing still treat a door as a full solid block, open or shut.
