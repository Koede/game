# Casting (src/sim/casting.ts + the furnace screen) - public API

Design: `docs/EMBER_PLAN.md` sections 2 and 5. Data (moulds, metals, items, recipes): `docs/api/handwork-content.md`
(`src/content/mouldsHand.ts`). Hand stations: `docs/api/handwork.md`.

## How it behaves

- A finished smelt of a CAST metal (`castMetalOfIngot(output) !== null`: copper, tin, bronze) does NOT put an ingot in
  `crucibleOut`. The metal sits MOLTEN in the crucible: `crucibleMelt[i] = { item: '<metal>_ingot', count: units }`,
  `crucibleMoltenS[i] = MOLTEN_WINDOW_S` (20, restarted by every further smelt into the same pool).
  Iron and up smelt to ingots at once, as before. `item:made` for the smelt is NOT emitted for cast metals (the ingot
  does not exist yet); the pour emits it.
- Pour into a fired mould: `table MOULDS[mould].casts[metal]`, `units` ingots per pour (ingot mould 1, pickaxe 3, axe 3,
  shovel 1, hoe 2, maul 4). One call pours every cast the pool covers (`floor(count/units)`), limited by the mould's
  pours left and by room in the pack for the result. The cast items go straight to the pack. Each cast wears the mould
  by 1 (`stack.durability`, absent = MOULD_POURS = 40; the most worn stack is used first); at 0 it breaks (`tool:broke`).
- Not poured in time: the pool cools into BLOOMS in `crucibleOut` (`copper_bloom`, ...), 1:1; a bloom is smelted again
  (`<metal>_ingot_bloom` recipes) and is molten again. A crucible whose pool or blooms are another metal does not start
  a smelt (`crucibleBlock` = 'output'). Pool and blooms together never exceed one stack.
- Alloy pot (item `alloy_pot`, set in a crucible slot; accepted by the crucible input rule): pour cold copper and tin
  INGOTS from the pack into it (`pourCrucible(..., 'copper_ingot' | 'tin_ingot')`, up to 6 copper and 2 tin). With 3
  copper + 1 tin inside and the furnace at >= 800 C (recipe `bronze_ingot_alloy`.minTempC), after 8 s (its `timeS`;
  progress is the crucible's progress meter) the pot makes 4 MOLTEN bronze in its crucible, which pours like any pool.
  DEVIATION from handwork-content.md section 4: the pot is not the `alloy_pot` BLOCK touching a furnace (the Ember
  clay furnace has ONE crucible, and nothing else routes Use on that block); the block, its recipe and the
  `alloy_pot` station stay in the data but nothing runs them.
- Not built: the Casting Bench pouring into set moulds, and hot work with molten items taken by hand (the Stone Anvil
  `hotS` window): a pool cannot be taken out by hand, only poured.

## Entity (FurnaceEntity, saved with it; src/sim/sanitize.ts repairs old and bad saves)

`crucibleMelt: Slot[]`, `crucibleMoltenS: number[]`, `crucibleMix: [copper, tin][]` - parallel to `crucibleIn`.

## Simulation action

`sim.pourCrucible(x, y, z, slot, heldKey: string | null): ActionResult` (`{ ok: true } | { ok: false, reason }`)

- `heldKey` a fired mould key from the pack (`'ingot_mould'`, ...): pour crucible `slot`. The player module may pass the
  key of the item in the hand; the UI passes the mould it picked. Reasons: "There is no such crucible", "Nothing molten
  there", "It has gone cold - smelt the bloom again", "Hold a fired mould to pour into", "The Axe Mould does not take
  Copper Ingot", "Needs 3 molten Bronze Ingot - there is 2", "You have no Hoe Mould", "Your pack is full".
- `heldKey` `'copper_ingot'` / `'tin_ingot'`: pour that ingot from the pack into the alloy pot in crucible `slot`
  ("Set an alloy pot in this crucible first", "You have no Tin Ingot", "The pot has all the copper it takes - it needs tin").
- Events: `'cast:poured' { x,y,z, mould, metal, item, count, at: 'furnace' }`, `'item:made' { item, count, station:
  'furnace', recipeId: 'cast:<mould>' }`, sfx `pour`, flag `first_pour` once, `'tool:broke'`. Cooling toasts a warning.

## Views and helpers

- `CrucibleView` gained `melt: Slot`, `moltenS: number`, `mix: [copper, tin] | null` (an alloy pot is in it); `status`
  reads "Molten Copper Ingot - pour it in 14 s" while a pool waits, and the pot's states ("Alloy pot: 3 copper, 0 tin -
  needs 3 copper and 1 tin", "Alloying bronze (3 copper, 1 tin)"). `progress` / `secondsLeft` / `active` describe the
  pot's alloying too.
- `src/sim/casting.ts`: `ALLOY_POT`, `POT_COPPER_MAX`, `POT_TIN_MAX`, `pourOptions(e, i, packSlots): PourOption[]` (moulds in
  the pack that take the pool: `{ mould, name, makes, units, casts, poursLeft }`), `moltenLeft`, `hasPot`, `potBlock`.
- `game/inventory.ts`: `fullDurability` also reads `ItemSpec.mould.pours`, and a mould never stacks (stack 1).

## Furnace screen

The SMELT tab's crucible row glows (orange pulse) while it holds molten metal, shows "Molten ...", the countdown bar
(20 s, draining) and a "Pour into a mould" row: one button per mould in the pack that takes the metal ("Ingot Mould -
4 casts", "Pickaxe Mould - makes Bronze Pickaxe Head"), or a hint ("Fire a mould at the furnace to pour into: ...") when
there is none. An alloy pot crucible shows "Add copper / Add tin" buttons. Helpers in `castText.ts` (DOM-free, tested).
