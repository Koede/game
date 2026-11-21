# Ground items, the drop key and collectors

Items are real entities in the world. Anything that gives items spawns `GroundItem`s instead of filling the pack:
broken blocks, picked bushes, dead animals, a broken machine's contents, a returned bucket the pack had no room for,
and the player's own drop key. DOM-free and node-testable (`npx vitest run src/game/groundItems src/game/collectors`).

## src/game/groundItems.ts
- `class GroundItems` - owned by PlayerState as `player.ground`; ticked by `Survival.tick` (so it runs on the 20 Hz tick, also
  while dead); saved in `PlayerSnapshot.ground` (optional: older saves load with none).
  - `items: GroundItem[]` `{ id, item, count, durability?, x, y, z, vx, vy, vz, age, delayS, onGround, homing, pulled, phase }`; `version` bumps on any add/merge/removal.
  - `spawn(item, count, x, y, z, opts?)` - splits above one stack into several entities; `opts`: `durability`, `vx/vy/vz`, `delayS` (default `DROP_DELAY_S` 0.5), `scatter` (default true: small random offset and hop). `spawnSlot`, `near`, `count(item)`, `drain(player)` (give everything that fits, wherever it lies: tests/debug), `clear`.
  - `tick(dt, world, player, collectors = [])`: falling (gravity 22, terminal 24, slab and liquid aware, frozen over unloaded chunks, lifted out of a block placed on it), resting, merging (same item, no wear, within `MERGE_RADIUS` 0.9, both at rest, every 0.5 s), despawn at `DESPAWN_S` 300, pickup.
  - Pickup: a ready item (`delayS` 0) within `PICKUP_RADIUS` 1.4 of the BODY (a vertical segment feet..head, so an item one block down still counts) while the pack has room flies to the player at `HOMING_SPEED` 9 and is taken inside `TAKE_RADIUS` 0.5 via `player.give` (emits `item:gained`, sfx `pickup`). What does not fit stays; a full pack leaves everything lying. Nothing is picked up while dead.
  - Cap `MAX_GROUND_ITEMS` 256: past it the oldest entity is merged into the nearest same-kind stack with room, else removed.
  - `toJSON()/load()` - unknown items, bad numbers and anything past the cap are dropped on load.
- `PlayerState`: `drop(item, count, durability?, at?)`, `dropAll(stacks, at?)` (the spawn calls for "something gave items"), `dropSlot(slot, count)` and `dropHeld(all)` (thrown forward from the eye with `THROWN_DELAY_S` 2 so it is not instantly re-collected).
- Wiring done: `Interaction.breakBlock/pick/popUnsupported` (`player.dropAll` at the block), `GameState.mobs.onDeath` (animal drops), `Spills.add/release` in src/sim (a broken machine's contents, and what the pack could not take: they drop as ground items; only what the capped list has no room for still goes into a crate, toast "Pack and ground are full - the rest is left in a crate"). The chainsaw's felled logs: call `player.dropAll(...)` / `player.ground.spawn(...)` instead of `player.give`.
- Things that are not "drops" still use `player.give` (crafting results, rewards, a bucket swapped in the hand, hand-station returns).

## Drop key
- Intent gained `drop` (edge, one frame) and `dropAll`. `Q` drops one of the held item; `Shift+Q`, or holding Q past `DROP_HOLD_S` 0.5, the rest of the stack once. The controller calls `player.dropHeld(intent.dropAll)`.
- Inventory screens (`SlotController`, src/ui/screens/slots.ts): `Q` while the pointer is over a slot of the player's pack drops one of it (Shift+Q or key repeat: all). `slots.dropper` is set by GameUI for the player's pack only (crates cannot be dropped from).
- Touch: picking a stack in the inventory shows the carry bar with `Drop` (one, or the whole stack when it is 1) and `Drop all`; a long-press (right-click on a mouse) on a hotbar slot drops that slot's whole stack. Hints in the workbench/inventory footer mention both.

## src/game/collectors.ts - the shared pull mechanism
`CollectorDef { item, radius, pull, burstS, power: PowerSource, sound?, soundEveryS? }` in `COLLECTORS` (by item key). `PowerSource` is
`{ kind: 'wear', perS }` (durability of the held stack), `{ kind: 'free' }` or `{ kind: 'electric', watts, supply(joules): boolean }`.
`player.collectors` (class `Collectors`): `trigger()` (Use with a collector in hand; arms it for `burstS`, holding Use keeps it armed; false when the
hand holds none so Use falls through), `tick(dt)` (draws power, returns the `ActiveCollector[]` for `GroundItems.tick`), `running`, `stop()`.
The controller calls `trigger()` before any other use of the Use intent.

**Electromagnet (Current Age, future - not built):** add one `COLLECTORS` entry, e.g. `{ item: 'electromagnet', radius: 12, pull: 14, burstS: 3, power: { kind: 'electric', watts: 400, supply } }`
with `supply` drawing from the player's battery/grid (a `drawJoules` hook in src/sim), plus its item, recipe and icon. If it should only pull metal, add an optional
`accepts(item)` filter to `CollectorDef` and `ActiveCollector` and test it in `GroundItems.tick`. Nothing else changes.

## Hand Vacuum Pump (`hand_vacuum`)
- Item in `src/content/itemsGround.ts` (`GROUND_ITEMS`), icon `item_hand_vacuum` (`src/render/textures/iconsGround.ts`), stack 1, `wear` 480 (new `ItemSpec.wear`: uses of a non-tool item; `fullDurability` reads it, so slots show a wear bar and the card shows "Suction left").
- Collector: radius 9, pull 11 blocks/s, one Use runs 2.5 s, 1 wear per second of suction, sound `steam_hiss` every 0.55 s plus `machine_on` on start.
- Recipe: Clay Furnace forge at 800 C: 4 bronze plate, 2 leather, 1 bellows, 2 copper plate. **Gate:** the code still has five tiers and ages; the Bronze Furnace (tier 2 after BRONZE_PLAN W0) does not exist, so the pump is made at the tier-1 furnace from Ember crafts and documented as a Bronze Age tool. After W0 move it to `forge(2, 'hand_vacuum', ...)` and set `age: 1` in `itemsGround.ts`. No objective yet (a "Gather from afar" goal fits after the Bronze Furnace goals).
- It is NOT the machine `vacuum_pump` of BRONZE_PLAN 5.4 (the air user on a chute network); the key is `hand_vacuum` so both can exist.

## src/render/groundItems.ts
`GroundItemRenderer(renderer, world)`; `update(dt, items, pulling)` each frame. One `InstancedMesh` (one draw call) per item kind: a small cube for block items, an extruded pixel sprite for the rest (shared with the held item), spinning and gently bobbing, stacks of 2+ / 16+ show 2 / 3 copies, lit like the terrain (light probed a few items per frame, eased), distance-fogged and skipped beyond the fog. Pulled items glow; while a collector runs, three cyan rings close in on the view centre. `drawn`, `instances` for stats. Created and drawn by `Game` (src/app/game.ts).

## Tests and checks
`src/game/groundItems.test.ts`, `collectors.test.ts`, `src/player/input/drop.test.ts`, `src/render/groundItems.test.ts`; the existing tests of drops were updated (`player.ground.drain(player)` where they read the pack after a break). Browser check: `node scripts/build.mjs --out=<dir>` then `node scripts/e2e-ground.mjs --out=<dir> --device=desktop|phonePortrait --shots=<dir>` (items resting, pick-up, Q / long-press / Drop button, pump pulling; `HW_GPU=1` for the real GPU).
