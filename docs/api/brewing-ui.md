# Brewing - player, HUD and app wiring (src/player, src/ui, src/app) - API

Design: `docs/BREWING_PLAN.md` 5, 7 and 11. The simulation is `docs/api/brewing.md`, the buffs `docs/api/brewing-buffs.md`,
the data `docs/api/brewing-content.md`.

## Use priority (src/player/interaction.ts, `Interaction.use`)

1. Animal under the crosshair with a liked item (`AnimalHands`, decided in the controller before any block).
2. (a held building block with Shift / the Place toggle, or aimed at a screen block off its front, is placed - unchanged)
3. NEW brewing blocks: `BrewTools.use` - the block's machine has role `brew` (cup stages, `furnace_bucket*`), or it is a
   `kettle` and the hand holds an empty container: `sim.brewUse(x, y, z, heldKey)`.
4. NEW a water container (`CONTAINER_BLOCKS` key) aimed at the TOP face of a block whose cell above is a furnace top
   (`sim.isFurnaceTop`): `sim.placeContainer` sets the bucket block; no water source is poured.
5. Wrench and bucket on pipes or tanks (`PipeTools`), then station and machine screens (`screenFor`).
6. NEW a held item with `ItemSpec.drink`: `drink(player)` (src/game); a refusal (the cooldown) is quiet.
7. Food, a bush, hoe, planting, bucket pouring, placing.

Brewing blocks have no screen: `screenFor` returns null for machine role `brew`.

```ts
// src/player/brewTools.ts
type BrewResult = { ok: true; consume: boolean; give?: string; giveDurability?: number; toast?: string } | { ok: false; reason: string }
interface BrewHands { brewUse(x,y,z, heldKey: string | null): BrewResult; placeContainer(x,y,z, heldKey): BrewResult; isFurnaceTop(x,y,z): boolean }
class BrewTools { use(hit: RayHit): 'brewed' | 'placed' | 'refused' | null; placeContainer(hit: RayHit): same }
// src/player/controller.ts   PlayerControllerOptions.brew?: BrewHands   (src/app passes the Simulation: `brew: sim`)
// src/player/interaction.ts  Interaction(..., transport, brew)  UseOutcome gains 'drank' | 'brewed'
```
Applying a result: `consume` takes one held item; `give` goes into the same slot when it emptied, else the first free slot
(a full pack spills with the usual toast); `giveDurability` is written on the stack (`Inventory.add` keeps durability only for
tools, so brewTools writes the slot itself). `reason` is toasted once per 8 s per sentence and ends the tap (no placing, no
eating). One step per `PLACE_COOLDOWN_S` (0.15 s) so a held button never reads one tap twice. `Interaction` also passes
`player.buffs.miningMult` to `miningTime` (Vigor).

## HUD (src/ui/hud)

- `drinkBuffs.ts` (DOM-free): `drinkChips(buffs): DrinkChip[]` (running drinks, tea first: name, `m:ss`, glyph, family, title
  "Swift: Walk, sprint and swim 20% faster"), `DRINK_GLYPHS` (spring up, hearthkept home, mending heart, swift bolt, vigor pick,
  lasting hourglass; none shares the flame or the bowl), `chipDensity(n)`: `full` alone, `compact` from two (glyph + time, name in
  the title on phones), `tight` from four (no names, smaller gaps).
- `vitals.ts`: six drink pills after Burning / Well-Warmed / Well-Fed in the same row; tea chips are green, coffee chips amber
  (`.hw-buff[data-family]` in hud.css). New glyphs in `kit/icons.ts`: `pick`, `hourglass`, `cup`.
- Target name: `UISimQuery.brewView(x,y,z): { text } | null` (the Simulation fits); `Hud.targetLabel` shows `text`
  ("Cup with drip cone - add tea or ground coffee", "Brewing 3 s", "Coffee - take it", "Water Bucket - 8 s to the boil"),
  refreshed on the HUD's slow tick so countdowns move.

## Text (src/ui/screens/food.ts)

`foodLine` / `foodRows` / `productBadges` now cover drinks and ingredients: a cup reads "Swift 3 min" (rows Drink, Effect,
Warms +10 warmth for Black Tea), an ingredient "Brews Light Roast" (rows Brews, Effect), a recipe that makes either gets the
badge. `drinkText(spec)`, `brewsText(item)` exported. The Kitchen chip (furnace Forge and Smelt tabs) also gathers the tea and
coffee chain (leaves, cherries, beans, ingredients, drinks, clay cup, drip cone, kettle pot): no extra Drinks chip, because
phones already scroll the chip bar. The hotbar name flash and the carry bar use `foodLine`, so a held cup says what it gives.

## How to Play (src/ui/menus/howto.ts)

`BREWING`: a "Tea and coffee" card of five steps (find and plant, dry / roast / grind, boil on the furnace top, cup + cone +
ingredient + boiling bucket, take and drink). Wording uses "Use" so it fits keyboard and touch.

## Gaps

- No "next step" hint from the HELD item on the target name (the name is the state only; refused steps toast the sim's sentence).
- A boiling pail given to a full pack spills without its seconds left.
