# Tool quality and repair

`src/game/toolQuality.ts` (+ `quality` on `ItemStack`, `maxDurabilityOf` in `inventory.ts`).

- A tool stack may carry `quality: 1` (Fine, x1.25 durability) or `2` (Masterwork, x1.6). Plain tools have none. It travels
  with the stack through `Inventory.add(..., quality)`, `transfer`, `removeAt`, `cloneStack`, and is kept by save load
  (`sanitize` clamps durability to the quality's maximum).
- `craftByPlayer` rolls `rollQuality(Math.random())` for a single tool craft (20% fine, 5% masterwork); `craft(..., quality)`
  stamps it. `rollQuality(roll, skill)` widens the odds up to double.
- Repair: use a worn tool on any anvil (`HandTools.station`): `repairTool(stack, sources)` consumes the tool's material
  (`REPAIR_MATERIALS`: planks, flint, bronze/iron/steel ingots), each unit restoring 25% of its best durability.
- `wearFraction`, `qualityLabel` for UI. Nothing in content changed.
