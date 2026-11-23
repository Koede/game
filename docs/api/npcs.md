# The starting tavern and its people (src/npcs, src/render/npcs)

Every NEW world opens inside **the Hearth & Anvil tavern**, built round the spawn point, with three adult pixel-sprite NPCs:
**Mara** (hedge witch, violet hat and dress, gives a Field Notebook), **Rosa** (barkeep behind the bar, auburn ponytail, gives a
Hearth Stew) and **Gruk** (orc smith, green, tusked, gives a wooden pickaxe and axe). Use on one talks: the first time they give their
welcome gift; then each says a hint tied to the current goal once (`NpcDef.byGoal`, keyed by objective id), then rotating lines about the
artificer's road. Lines show as toasts (`Name, title: "..."`). Old worlds are not touched (no tavern, no people).

## Code
- `data.ts`: `NPCS` (id, name, title, sprite, tavern-local position, gift, `byGoal`, `lines`). Add a person there.
- `tavern.ts`: `layoutBlocks()` is the pure 13 x 9 x 5 layout (stone-brick footing, oak corners and beams, plank walls and roof, glass windows,
  door gap in the north wall, plank bar with stools, crate shelves, torches, a clay-furnace fireplace with brick chimney, workbench,
  two tables); `buildTavern(world, ox, oy, oz)` flattens a one-block margin, clears the air above and places it (source `'sim'`).
  `TAVERN_START` = [6, 1, 2]: the world spawn is put on that cell, so a respawn lands in the hall.
- `manager.ts`: `NpcManager` (owned by `GameState.npcs`, saved with `world.persist('npcs')`: tavern origin, greeted, gifted, hints heard).
  `buildStart`, `views()`, `raycast` (box 0.76 x 2.0, reach 3.4, no occlusion by blocks), `talk` (0.8 s cooldown so a held Use does not read the
  script), `speak`, `greet` (the welcome toast, once), `tick`.
- `GameState.create` calls `startInTavern()` (falls back to the old open-view start when the ground is not loaded); the player faces south.
- `PlayerController` option `talk(ox, oy, oz, dx, dy, dz)`: Use on a person consumes the Use (like the collectors).
- `src/render/npcs/sprites.ts` draws the 24 x 40 sprites procedurally (`paintNpc`), `npcRenderer.ts` shows them as camera-facing `THREE.Sprite`s
  (nearest filtering, idle bob, dimmed with the sky: `clock.sunlight()`).

## Tests
`npx vitest run src/npcs` (layout, talk, gifts, save round trip, sprites, a new world opens in the hall) and `node scripts/e2e-tavern.mjs`
(desktop and phone portrait: opens in the tavern, uses each person and checks the gift and the toast; `HW_GPU=1` for the real GPU).

## Ideas for later
Shop/trade with Rosa, a quest board, recruiting Gruk as a smith at the Bronze Furnace, Mara teaching research entries, walking schedules and
night-time seating, more people in the structures session's outposts.
