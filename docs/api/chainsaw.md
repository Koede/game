# The chainsaw (Current Age)

A handheld tool that fells a whole tree. **Mine** on a log with it in hand removes that log and the connected trunk
above it in one cut; the logs go into the pack, the saw burns fuel and wears nothing else. Code: `src/game/felling.ts`
(rules), `src/content/itemsVehicle.ts` (item and numbers), `src/player/interaction.ts` (two hooks), `src/audio/sfxVehicle.ts`,
`src/render/textures/iconsVehicle.ts`. Tests: `src/game/felling.test.ts`, `src/content/vehicleContent.test.ts`.

## Which age, and why

**Current Age** (PROGRESSION "Age 3 - Current"; `age: 2` and forged at furnace tier 3 in today's five-age numbering, the
six-age renumbering (BRONZE_PLAN W0) bumps both like every other `age:`/`minTier`).

- It needs an *engine*. The only engine in the game that runs on a liquid fuel is the Combustion Engine, forged at the
  Arc Furnace, and the only liquid fuel is the **Fuel Canister** from the Still (Current). A chainsaw is that engine on
  a handle, so it belongs where the engine and its fuel do.
- Not Ember: the age is manual handwork with no machines (owner decision, docs/LOCAL_HANDOFF.md section 2); the Chopping
  Block and the axe are the Ember answer to trees.
- Not Bronze/Forge: steam devices drive shafts and are not portable, there is no fuel to carry before the Still, and
  Forge is about iron and heavy factory machines. (A pneumatic saw on an air tank would suit Bronze if the owner wants
  one earlier; it would be a second item, not a change to this one.)

Recipe (Arc Furnace, 1300 C): `1 chassis, 2 steel_plate, 1 copper_coil, 1 circuit`. Objective `fell_tree` ("Fell a
tree", flag `felled_tree`, age 2) sits right after Ward your base.

## Rules

- `tool: { kind: 'axe', tier: 3, speed: 9, durability: 241, fell: { maxLogs: 48, fuelPerLog: 2, canisterFuel: 120 } }`.
  `ToolSpec.fell` (src/core/types.ts) marks a chainsaw. **The stack's `durability` is its fuel tank**: 241 = a full
  tank of 240 units + the 1 that means empty (durability never reaches 0, so the saw is never destroyed).
- Felling (`fellTree(world, player, x, y, z, rng)`): the log under the crosshair plus every log of the same kind joined
  to it face-, edge- or corner-wise (boughs count), **from that height up**, nearest first, at most
  `min(maxLogs, floor(fuel / fuelPerLog))` = 48 logs. Logs below the cut (the stump) stay. Other woods touching it and
  detached logs stay. Each log is a `'player'` edit with `'block:broken'` (the "gather logs" objectives count them) and
  the drops go to the pack. A full tank is 120 logs: about two broad oaks or twenty ordinary trees.
- Leaves of the felled tree decay by themselves afterwards (docs/api/leaf-decay.md): the saw wakes them like any log
  removal.
- Fuel: `refuelChainsaw(player)`: **hold a Fuel Canister and press Use** (anywhere, no target needed); it fills the
  emptiest saw in the pack by `canisterFuel` (120, never past full) and uses one canister only when it adds something.
  The saw's durability bar in the hotbar and inventory is its fuel gauge.
- Out of fuel (durability 1): `toolMatches` says no, so it mines like bare hands, and a toast says how to refill.
- Wear: none beyond the fuel (the brief's "fuel/wear" is one number).
- Sound: `saw_cut` (the chain) with `tree_fall` for trunks of 2+ logs, both in `src/audio/sfxVehicle.ts`.
- Flag `felled_tree` (FLAG_FELLED_TREE) for a tree of >= 3 logs.
- Held model: the first-person hand extrudes the `item_chainsaw` icon like every tool (src/render/heldItem.ts); the icon is
  in the existing pixel style (orange housing, rear handle, steel bar with teeth).

## API (src/game/felling.ts)

```ts
SAW_FUEL_ITEM = 'fuel_canister';  LOG_BLOCKS = ['oak_log', 'pine_log'];  TREE_MIN_LOGS = 3
isChainsaw(stack), sawOf(stack): ToolSpec | null, sawFuel(stack), sawCapacity(stack), canFell(stack), isLog(def)
trunkAbove(world, x, y, z, cap): LogCell[]
fellTree(world, player, x, y, z, rng): FellResult | null   // { logs, drops, fuel, more }
refuelChainsaw(player): 'refuelled' | 'full' | 'no-saw' | 'no-fuel'
```
`Interaction.breakBlock` calls `fellTree` first (null = break normally); `Interaction.use` calls `refuelChainsaw` when a
Fuel Canister is held (`UseOutcome` gains `'fuelled'`).
