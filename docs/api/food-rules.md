# Food rules - hunger, eating, tilling and planting (spec 12.1, 12.4 tilling/planting, 12.6 flags)

Behaviour on top of the food foundation (`docs/api/food.md`): the hunger rules and the farming rules live in
`src/game` (DOM-free, node-tested), the controls that use them in `src/player`. Crop GROWTH is the simulation's
(`src/sim/crops.ts`); animals are `src/mobs`. Tests: `npx vitest run src/game src/player src/sim` (hunger 21,
farming rules 11, player farming/eating 16; the scripted playthrough now eats, tills and plants for real).

**No wiring change is needed**: `Survival` owns and ticks the hunger rules, `PlayerState` saves the food bar, and
the `PlayerController` / `Interaction` already in the game do the rest.

## src/game/playerState.ts (additions)
- `food: number` - 0..`MAX_FOOD` (20), starts full. Saved as `PlayerSnapshot.food` (optional in the type: a save
  from before hunger loads with a full bar; nonsense values are clamped, NaN -> full).
- `buffs.wellFedS: number` - seconds of Well-Fed left. Saved; missing in old saves -> 0.
- `sprinting: boolean` - written by the player physics every step (false while dead, Hungry, swimming, or not
  pushing forward). Not saved.
- `eatCooldownS: number` - seconds until the next bite; counted down by the hunger tick. Not saved.
- `get hungry(): boolean` - `food <= HUNGRY_AT` (6). `get wellFed(): boolean`.
- `spendFood(amount: number): void` - takes food (already scaled by the caller); crossing into Hungry emits one
  warning toast ("You are hungry - eat something. You cannot sprint until you do."); it repeats only after the bar
  was above 6 again. Ignored while dead.
- `feed(amount: number): void` - adds food, capped at 20.
- `wearHeldTool(uses: number): boolean` - takes durability from the held tool (the hoe); `wearHeld(block)` now
  delegates to it. True when the tool broke (`tool:broke`, sfx `tool_break`, toast - as before).
- `RESPAWN_MIN_FOOD = 10` - `respawn()` tops the bar up to at least this and ends Well-Fed.

## src/game/hunger.ts
- `FULL_MARGIN = 0.5`; `isFull(player): boolean` - `food >= 19.5` (a HUD showing whole points reads 19.6 as full).
- `foodOf(itemKey): FoodSpec | null`
- `drainFactor(player): number` - 0.5 while Well-Fed, else 1. Applies to the time drain, jumps and mined blocks.
- `foodDrainPerS(player): number` - `1/60` x 2.5 while sprinting x `drainFactor`.
- `exertJump(player): void` - 0.03 food x factor. **The PlayerController calls it for every jump off the ground**
  (not for swimming up).
- `exertMining(player): void` - 0.03 food x factor. **Interaction calls it for every block the player breaks**
  (not for plants that pop off broken soil).
- `type EatRefusal = 'dead' | 'not_food' | 'cooldown' | 'full'`
- `type EatResult = { ok: true; item; hunger; buff: BuffName | null } | { ok: false; reason: EatRefusal; message: string | null }`
- `eatRefusal(player, itemKey): EatRefusal | null` - why eating would be refused now (order: dead, not food,
  cooldown, full; buff foods skip the full check).
- `eat(player, slot = player.selectedSlot): EatResult` - consumes one, `feed(hunger)`, `eatCooldownS = 0.6`,
  emits `player:ate { item, hunger }`, `flag { flag: 'ate' }`, sfx `eat` (at the player's head). A buff food
  (hearth stew) sets `wellFedS = max(left, 360)`, emits `buff:gained { buff: 'well_fed', durationS: 360 }` and a
  good toast. Refusals change and emit nothing; `message` is `'You are full'` for `full`, null otherwise (the caller
  toasts it - Interaction throttles it to once per 8 s).
- `class Hunger` - `new Hunger(player)`; `Survival.hunger` is the game's instance.
  - `tick(dt)` - bite cooldown, drain (priced before the Well-Fed timer ticks down), starvation: at food 0,
    1 damage (cause `'hunger'`) every 6 s, never below 1 health. Nothing while dead.
  - `get foodRate: number` (per second, negative while draining; 0 at an empty bar), `get starving: boolean`,
    `get wellFedTimeLeftS: number`.
  - `canRegenerate(): boolean` (food >= 12), `regenInterval(baseS): number` (halved while Well-Fed),
    `payForRegen(): void` (0.25 food per healed point), `reset()`, `toJSON(): HungerSnapshot { starveS }`, `load(s?)`.

## src/game/survival.ts (changes)
- `readonly hunger: Hunger`, ticked inside `tick(dt)` right after the quiet-time counter.
- Regeneration (spec 3.4) now also needs `hunger.canRegenerate()`; the interval is `hunger.regenInterval(4)`
  (2 s Well-Fed) and every healed point calls `hunger.payForRegen()`.
- `SurvivalSnapshot.starveS?: number` (optional: old saves load with 0). `respawn()` resets the starvation timer.

## src/game/farming.ts
- `TILLABLE = ['grass', 'dirt']` (a test keeps it equal to the solver's `TILLABLE_BLOCKS`; the game never imports the
  solver). `TILL_WEAR = 1`. `CROP_MACHINE = 'crop'`.
- `interface UseTarget { x; y; z; face: Face; px; py; pz; block: BlockDef }` - the player's `RayHit` fits.
- `isHoe(stack: Slot): boolean`; `isCrop(def): boolean` (machine `crop`); `isRipeCrop(def): boolean`.
- `cropStage(def): { crop; stage; stages; ripe } | null` - from `<crop>_<n>` keys (cached per block id).
- `canTill(world, x, y, z, face): boolean` - grass/dirt, the TOP face, the cell above is air, loaded, y < 95.
- `tillResult(def): BlockDef | null` - farmland for grass/dirt, else null.
- `till(world, player, target): boolean` - with a hoe in hand: farmland voxel (source 'player'), hoe wear 1,
  `flag { flag: 'tilled' }`, sfx `till`. False (nothing changed) without a hoe, when dead, or when not tillable.
- `plantedBy(itemKey): BlockDef | null` - the crop an item plants (wheat_seeds -> wheat_0, potato -> potato_0,
  carrot -> carrot_0).
- `placementCell(target): BlockPos` - the hit cell when it is replaceable (not liquid), else across the face. The
  same rule Interaction uses for every placed block.
- `plantCell(world, itemKey, target): BlockPos | null` - where Use would plant this item: it plants a crop, the
  cell is loaded, 1..95, replaceable, not liquid, and stands on a block in the crop's `placeOn` (farmland).
- `plant(world, player, target): BlockPos | null` - plants the HELD item there: one item used, the stage-0 crop
  voxel (source 'player'), `block:placed` (the `plant_seeds` objective counts `wheat_0`), sfx `plant`.
- `isUnsupported(world, x, y, z): boolean` - a `placeOn` block whose block below is no longer allowed.

## src/player (changes)
- `Interaction.use(hit: RayHit | null): UseOutcome` - `UseOutcome` gains `'tilled' | 'planted' | 'ate'`. Order:
  1. a station / machine WITH a screen under the crosshair opens it (crops have no screen);
  2. a held **food** item is eaten - also with nothing under the crosshair (the sky) - unless this Use would plant
     it (`plantCell`), so a potato or carrot aimed at free farmland is planted and eaten anywhere else;
  3. no hit: nothing more; pail / water pail as before;
  4. a **hoe** tills (`till`), with a 0.15 s repeat delay; aimed at grass/dirt but not tillable it explains once per
     8 s ("Till the soil from above: aim at its top" / "Clear the top of the soil before tilling it");
  5. a **planting item** on a valid cell plants (`plant`), with the repeat delay;
  6. else the held block item is placed. Seeds aimed at anything but farmland reach this step and are refused with
     "Wheat Seeds can only be planted on farmland - till grass or dirt with a hoe first".
  Refused bites: `'refused'`, "You are full" toasted at most once per 8 s; the cooldown refuses quietly.
- Breaking: every broken block calls `exertMining`; a ripe crop plays `harvest` instead of `break`; a `placeOn`
  block left standing on nothing (a crop on dug-out farmland, tall grass on dug-out soil) pops at once with its
  drops, its own `block:broken` and sound.
- `Interaction.advise(key, text, cooldownS = 8): void` is public now (the controller uses it).
- `digSound(def)`: cross-shaped blocks (crops, wild plants, grass tufts) rustle (`dig_sand`); crops are no longer
  `dig_metal`. `screenFor(def, ...)` returns null for crops.
- `PlayerPhysics.step`: no sprinting while `player.hungry`; writes `player.sprinting`.
- `PlayerController`: `exertJump` on every jump; a fresh sprint request while Hungry toasts
  "Too hungry to sprint - eat something" (at most every 20 s).
- `digSound`, `screenFor`, `facingTowards` moved to `src/player/blockRules.ts` (re-exported from `interaction.ts`
  and the index, so imports are unchanged), with `toolNeeded` and `placeOnAdvice`.
- `testKit.ts` now exports `StubView` and `Script` (moved out of controller.test.ts).

## For the other food engineers
- **HUD (src/ui)**: read `player.food` (0..20), `player.hungry`, `player.wellFed`, `player.buffs.wellFedS`,
  `survival.hunger.foodRate` / `.starving` / `.wellFedTimeLeftS`. The Hungry crossing toast is already emitted here,
  so the HUD only needs the meter state.
- **Animals (src/mobs)**: feeding a liked item with Use must be decided BEFORE `Interaction.use`, because potato and
  carrot are food and Use would eat them. The ray here only sees blocks; whoever adds animal targeting has to give
  the animal hit priority in the controller.
- **Crops (src/sim)**: tilling sets farmland with source 'player'; planting sets the stage-0 voxel and emits
  `block:placed`; breaking farmland pops the crop above (voxel -> air, `block:broken`), so a crop entity must go
  when its voxel does.

## Verification
- Node: hunger drain (rest, sprint, Well-Fed, jump/mining costs), Hungry toast once per crossing, starvation
  (6 s, stops at 1 health), regen gate and cost, Well-Fed regen x2, respawn top-up, save round trips (old saves),
  every eat refusal, cooldown, stew buff; farming rules; Use with hoe / seeds / potato / food at sky, block, crop and
  furnace; crop screens, dig sounds, harvest sound, popping; physics sprint gate; controller jump cost and hint.
- Playthrough (`src/sim/playthrough.test.ts`): the stand-ins are gone - `eat()`, `till()` and `plant()` are called,
  and the scripted player eats (through `eat`) whenever food drops to 12, from 12 roast chops cooked in the clay
  furnace; it finishes with no damage taken and never Hungry.
- Browser (headless Chromium, the real game built from src/main.ts, scratch harness): on desktop, phone portrait
  and phone landscape with real input (right click / tap on the world / Use button) - tilled three grass cells
  (hoe 64 -> 61), planted wheat twice and a potato (planted, not eaten), an empty-handed Use on a crop opened
  nothing, holding Mine on ripe wheat played `harvest` and gave wheat + seeds, bread eaten while looking at the sky
  (5 -> 11 food, `player:ate`, flag `ate`), a bite on a full bar toasted "You are full", the bar crossing 6 toasted
  the Hungry warning, Shift+W did not sprint while Hungry. Screenshots of the furrows, the sprouts next to a ripe
  wheat and the toasts were reviewed. No console errors.

## Deviations and decisions
- "Full" is 19.5 or more (see `FULL_MARGIN`), not exactly 20.
- Well-Fed halves the time drain and the jump / mining costs; the 0.25 food per regenerated point is not halved.
- Respawning sets food to at least 10 (spec silent; avoids respawning into starvation) and clears Well-Fed.
- Eating a stew while Well-Fed refreshes the buff to 360 s and announces it again.
- Tilling needs air above (spec): tall grass on the soil must be cleared first.
- Breaking a block pops any `placeOn` plant above it (crops, wild plants, tall grass), not only crops.
- The bite cooldown is counted down by the 20 Hz hunger tick (not by frames); while the game is paused nothing is
  eaten anyway.

## Known gaps
- No HUD food meter yet (src/ui is another engineer's): the state is there, nothing draws it.
- `src/game/survival.ts` is 429 lines (above the 350-line aim); the hunger rules were kept in their own file.
- Use on an animal is not handled here (see "Animals" above).
