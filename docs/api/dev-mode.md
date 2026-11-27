# Dev Mode - src/core/gameMode.ts, src/ui/screens/creative, plus small hooks in state, player, title and HUD

A second way to play a world: the Creative menu with every item, no damage, no hunger, no wear, free placing and
flight. It is chosen once, on the title screen, when the world is created, and it lives in the save. Survival saves
and survival play are untouched. Tests: `npx vitest run src/app/devMode.test.ts src/ui/screens/creative`. Browser:
`node scripts/e2e-dev.mjs` (desktop, phone portrait, phone landscape; `HW_GPU=1` for the real GPU), also the last
step of `npm run e2e`.

## The mode flag
```ts
type GameMode = 'survival' | 'dev'                 // src/core/gameMode.ts
parseGameMode(raw: unknown): GameMode              // anything but 'dev' is survival
modeLabel(mode): 'Survival' | 'Dev Mode'
WorldSave.mode?: GameMode                          // src/save/document.ts, optional
GameState.create(seed, seedText, { mode?: GameMode, ... })   // a new world; only the title's choice passes 'dev'
GameState.restore(save)                            // takes save.mode (missing = survival)
GameState.mode: GameMode                           // readonly; sets player.dev
```
- Survival worlds never write `mode` (the save stays byte-identical to before); dev worlds write `mode: 'dev'`.
- `normalizeDocument` drops any `mode` other than `'dev'`, so a damaged value reads as survival.
- A world can be switched at any time: Pause > Settings > Game > **Dev Mode** (a switch; same switch turns it off). `GameState.setMode(mode)` flips `player.dev`, ends flight, resets free placing, toasts, and the next save writes or drops `mode`. The HUD's DEV chip follows `player.dev`. The title screen's Settings has no switch (no world is open).
- `window.__hw.newWorld(seed, mode)` and `__hw.state().gameMode` exist for tests.

## Title screen
A `Mode` row (`Segmented`: Survival | Dev, `.hw-title__mode`) between the seed field and Difficulty, with a one-line
hint. It resets to Survival every time the title is built, so a dev world can only come from an explicit choice.
`TitleScreen`'s `onNewWorld(seed, mode)` gets the mode; `TitleScreenOptions.savedMode` / `setHasSave(has, savedMode)`
put "Dev Mode world" / "Survival world" under the Continue label. The pause menu's subtitle says the same
("Dev Mode world"). Seed entry is unchanged and works with both modes. Checked at 390x844, 844x390 and 1280x800.

## Dev rules (what `player.dev` changes)
| Rule | Where |
| --- | --- |
| No damage of any kind (falls, lava, cold, drowning, hunger, automatons, burning) | `PlayerState.damage` returns early |
| No starving, freezing or drowning: health, food, warmth and air are held full each tick; the dead are revived | `GameState.devUpkeep` (after survival and objectives) |
| Tools never wear | `PlayerState.wearHeldTool` returns false |
| Placing a block does not use it up (menu switch "Free placing", default on, `player.devFreePlace`) | `Interaction.use` |
| Flight (`player.flying`): double-tap Jump (within 0.35 s) or the menu switch "Flight". No gravity; Jump rises, sprint (Shift) descends; horizontal speed x1.8 | `PlayerController.devFlight`, `PlayerPhysics.step` |
Objectives and achievements keep running as in survival. Free placing and flight are session settings (not saved).
Only blocks placed by `Interaction.use` are free; other things that consume the held item (buckets, seeds, vehicles)
behave as in survival.

## Creative menu
`{ type: 'creative' }` is a `ScreenRequest` (src/core/gameEvents.ts); GameUI registers `createCreativeScreen`
(src/ui/screens/creative/creativeScreen.ts), which returns null outside dev mode. Open it with:
- `E` / the inventory key, and the touch backpack button: in a dev world the controller opens `creative` instead of
  `inventory` (the hand-crafting screen is not needed there);
- the always-visible `DEV Items` HUD button (`.hw-devchip`, 44 px; hidden while a screen is open). With a mouse the
  pointer is locked during play, so on desktop use `E`; the button is for touch.

Contents: search box (name, key and description, every word must match), tabs with counts, the grid of every item,
an info line (name and description, for touch where there is no tooltip; hover cards on desktop), the player's own
pack and hotbar (the normal `InventoryPanel` and slot controller: pick, move, half, quick move all work), and:
- tap / click: one item into the pack; Shift-click, right-click, long-press, or the `Full stacks` switch: a full stack;
- drag an item onto a pack or hotbar slot (desktop): puts it there, replacing what was in it;
- `Trash`: removes the picked pack stack; `Clear pack` (hold): empties the whole pack;
- `Free placing` and `Flight` switches.
Phones: portrait shows the item list first (fixed height) and the pack and switches below (the screen scrolls);
landscape keeps the pack on the left and the list on the right.

### Catalogue (src/ui/screens/creative/catalogue.ts, DOM-free, unit-tested)
```ts
CREATIVE_TABS: { id: 'all'|'block'|'material'|'tool'|'food'|'machine'|'fuel'|'misc'; label; categories: ItemCategory[] }[]
buildCatalogue(items = ITEMS): CatalogueEntry[]      // every registry item once, in registry order
tabOfCategory(category): tab id                      // block; resource+material+component -> Materials; tool; food; machine; fuel; misc
filterCatalogue(entries, tab, query): CatalogueEntry[]
tabCounts(entries, query): Record<tab, number>
grantItem(inventory, key, full): number              // returns what did not fit; tools arrive with full durability
clearSlot(inventory, index): boolean
```
A new item added to the registry appears in the menu without any change here.

## Known gaps
- Free placing is not saved, and flight resets on every start.
- No creative items tab ordering beyond registry order; no favourites.
- The HUD button cannot be clicked while the desktop pointer is locked (use `E`).
