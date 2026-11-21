# src/game - public API

Game rules that are not machines. DOM-free, runs in node. Import from `src/game` (index re-exports everything
below); the test fixture `FakeWorld` is imported by path from `src/game/fakeWorld`. Never imports `src/world`
(only `IWorld`). 71 unit tests, `npx vitest run src/game`.

Hunger (`hunger.ts`), farming rules (`farming.ts`) and the food fields of `PlayerState` are documented in `docs/api/food-rules.md`.

## inventory.ts
- `type AcceptRule = (item: string, slot: number) => boolean`; `interface InventoryOptions { accept?: AcceptRule; takeOnly?: boolean }`
- `stackLimit(item: string): number` - most of this item one slot holds (tools always 1; unknown items 99).
- `fullDurability(item: string): number | undefined` - uses of a fresh tool; undefined for non-tools.
- `makeStack(item: string, count: number, durability?: number): ItemStack`, `cloneStack(stack: ItemStack): ItemStack`
- `canMerge(a: ItemStack, b: ItemStack): boolean` - same stackable item, neither carries durability.
- `class Inventory`
  - `new Inventory(sizeOrSlots: number | Slot[], options?: InventoryOptions)` - a number allocates; an array is ADOPTED (no copy, written through to).
  - `static over(slots: Slot[], options?): Inventory` - wraps an existing array (a machine's slots on its block entity). `JSON.stringify(slots)` is the saved state.
  - `static fromJSON(snapshot: readonly Slot[], options?): Inventory`
  - `readonly slots: Slot[]`; `accept: AcceptRule | null`; `takeOnly: boolean`; `get size(): number`
  - `get(slot): Slot`; `set(slot, stack: Slot): void` - raw write, ignores accept/take-only.
  - `accepts(item: string, slot: number): boolean` - take-only and accept rule (not room).
  - `add(item: string, count = 1, durability?: number, start = 0, end = size): number` - existing stacks first, then empty slots, within `[start, end)`; returns the LEFTOVER count.
  - `remove(item: string, count = 1): number` - last slots first; returns how many were removed.
  - `removeAt(slot: number, count = Infinity): ItemStack | null` - takes from one slot; durability travels along.
  - `count(item): number`; `has(item, count = 1): boolean`; `space(item): number` (how many more fit)
  - `canFit(items: ItemAmount | readonly ItemAmount[]): boolean` - all of them at the same time.
  - `firstEmpty(): number` (-1 when full); `isEmpty(): boolean`; `clear(): void`; `clone(): Inventory` (detached, no listeners)
  - `onChange(fn: () => void): () => void` - fires for changes made through this object; `notifyChanged(): void` - call after writing `slots` directly; `batch<T>(fn: () => T): T` - one notification for many operations.
  - `toJSON(): Slot[]`; `load(snapshot: readonly Slot[]): void` - in place; unknown items dropped, counts and durability clamped.

## transfer.ts (slot-to-slot operations between any two inventories, or within one)
All honour the destination's accept rule and take-only flag and keep tool durability. Each returns the number of items that left the source slot.
- `transfer(from, fromSlot, to, toSlot, count = Infinity): number` - into an empty slot or onto the same item; never swaps.
- `moveStack(from, fromSlot, to, toSlot): number` - the primary click: drop, merge what fits, else swap.
- `moveHalf(...)`: half rounded up; `moveOne(...)`: one item; `mergeSlots(...)`: only tops up a stack of the same item.
- `swapSlots(from, fromSlot, to, toSlot): boolean` - both sides must accept what they receive.
- `quickMove(from, fromSlot, to, start = 0, end = to.size): number` - shift-click: wherever it fits, existing stacks first; with a range it also does hotbar <-> backpack inside one inventory.

## crafting.ts
- `interface CraftRecipe { inputs; output; byproducts? }` (RecipeDef fits); `type ItemTally = ReadonlyMap<string, number>`
- `interface IngredientStatus { item; need; have; ok }`; `interface Availability { ok: boolean; ingredients: IngredientStatus[] }`
- `type CraftResult = { ok: true; made: ItemAmount[] } | { ok: false; reason: string; missing: ItemAmount[] }`
- `HAND_RECIPES`, `WORKBENCH_RECIPES: readonly RecipeDef[]`
- `mergeAmounts(list: readonly ItemAmount[], times = 1): ItemAmount[]`; `tally(sources: readonly Inventory[]): Map<string, number>`
- `ingredientStatus(inputs: readonly ItemAmount[], sources: readonly Inventory[] | ItemTally, times = 1): Availability` - for any ingredient list (furnace upgrade costs).
- `availability(recipe: CraftRecipe, sources: readonly Inventory[] | ItemTally, times = 1): Availability`
- `takeIngredients(inputs: readonly ItemAmount[], sources: readonly Inventory[], times = 1): boolean` - atomic; sources in priority order. THE function the simulation calls for forge/upgrade ingredients.
- `craft(recipe: CraftRecipe, sources: readonly Inventory[], destination: Inventory, times = 1): CraftResult` - atomic; refuses with `reason` ("Missing ...", "No room for ...").
- `maxCraftable(recipe, sources, destination?, limit = Infinity, counts?: ItemTally): number`
- `craftByPlayer(player: PlayerState, recipe: RecipeDef, options?: { crates?: readonly Inventory[]; times?: number; sfx?: SfxName | null }): CraftResult` - player inventory first then crates, output to the player; emits `item:made` per output and the sound (default `craft`; the furnace passes `forge`).

## mining.ts (pure, spec 3.6)
- `UNDER_TIER_SLOWDOWN = 3`; `toolOf(held: Slot): ToolSpec | null`; `toolMatches(block: BlockDef, held: Slot): boolean`
- `effectiveTier(block, held): number` - 0 for hands, non-tools and the wrong tool kind.
- `canMine(block): boolean` (hardness >= 0); `canHarvest(block, held): boolean` - breaking yields drops.
- `miningTime(block: BlockDef, held: Slot, wellWarmed: boolean): number` - seconds; Infinity when unbreakable.
- `rollDrops(block, rng: () => number): ItemAmount[]`; `harvest(block, held, rng): ItemAmount[]` - drops or `[]` below tier.
- `wear(block, held): number` - 1 for a matching tool, else 0.

## clock.ts (spec 3.5)
- `NIGHT_SUNLIGHT = 0.08`, `START_TIME_OF_DAY = 0.05`, `WAKE_TIME_OF_DAY = 0.025`; `interface ClockSnapshot { timeOfDay; day }`
- `phaseAt(timeOfDay): DayPhase` - dawn [0, .05), day [.05, .59), dusk [.59, .64), night [.64, 1); `sunlightAt(timeOfDay): number`
- `class GameClock` - `new GameClock(bus: GameBus | null = null, timeOfDay = START_TIME_OF_DAY)`; fields `timeOfDay`, `day` (1-based);
  `get phase`, `get isNight`, `get worldTimeS`, `sunlight(): number`, `sunAngle(): number` (0 sunrise, PI sunset),
  `tick(dt): void`, `skipToDawn(): number` (seconds skipped), `setTimeOfDay(t): void`, `toJSON(): ClockSnapshot`, `load(s): void`. Emits `time:phase` on changes only.

## playerState.ts
- `interface BlockPos { x; y; z }`, `PlayerBuffs { wellWarmedS }`, `PlayerStats { made; placed; broken: Record<string, number>; deaths }`, `PlayerSnapshot`
- `class PlayerState` - `new PlayerState(bus: GameBus, spawn: Vec3 = { x: 0.5, y: 64, z: 0.5 })`
  - State: `position` (centre of the FEET), `velocity`, `yaw`, `pitch`, `onGround`, `inWater`, `headInWater` (the physics writes these three), `health`, `warmth`, `air`, `inventory` (36 slots, 0-8 hotbar), `selectedSlot`, `home: BlockPos | null`, `spawn`, `buffs`, `stats`, `dead`, `deathCause`, `sinceDamageS`, `extraRadiation`, `bus`.
  - `extraRadiation`: the simulation ADDS dose to it every tick a non-block source is active (overheating fission pile); Survival consumes and zeroes it each tick.
  - `get eyeY`, `get wellWarmed`, `viewDir(out: Vec3): Vec3`, `heldStack(): Slot`, `selectSlot(slot)` (emits `hotbar:selected`), `consumeHeld(count = 1): Slot`
  - `wearHeld(block: BlockDef): boolean` - applies tool wear; true when the tool broke (emits `tool:broke`, sfx, toast).
  - `give(item, count = 1, durability?): number` - emits `item:gained`; toasts a warning and returns what did not fit.
  - `setHome(x, y, z)`; `damage(amount, cause: DamageCause)` (emits `player:damage`, `player:death`, sfx hurt/death); `heal(amount)`
  - `respawn(homeIsHot: boolean, at: Vec3 = spawn)` - low level; normally call `Survival.respawn()`.
  - `addQuietTime(dt)`, `toJSON(): PlayerSnapshot`, `load(s)`, `dispose()`.
  - Listens to `item:made`, `block:placed`, `block:broken` and keeps `stats` from the first moment. The inventory's changes emit `inventory:changed`.

## survival.ts (spec 3.4)
- `type WarmthTrend = 'warming' | 'cooling' | 'steady'`; `type BiomeLookup = (x: number, z: number) => BiomeKey`; `interface SurvivalSnapshot`
- Constants: `SCAN_INTERVAL_S 0.5`, `RADIATION_RANGE 4`, `RADIATION_SAFE_DOSE 1`, `RADIATION_DAMAGE_INTERVAL_S 2`, `SHIELD_SUIT_FACTOR 0.1`, `COAT_DRAIN_FACTOR 0.5`, `WELL_WARMED_DRAIN_FACTOR 0.5`, `REGEN_INTERVAL_S 4`, `REGEN_QUIET_S 8`, `REGEN_MIN_WARMTH 50`, `AIR_REFILL_PER_S 5`.
- `fallDamage(distance: number): number` - floor(distance - 3.5), at least 0.
- `findStandingSpot(world: IWorld, pos: BlockPos): Vec3` - feet position beside a block (two free cells on solid ground within 2 blocks, levels 0/+1/-1), else on top of it.
- `class Survival` - `new Survival(world: IWorld, player: PlayerState, clock: GameClock, biomeAt: BiomeLookup)`
  - `tick(dt): void` - call on the 20 Hz tick. Does nothing while the player is dead.
  - `applyFall(distance: number): number` - the physics calls this on landing; returns the damage dealt (0 in water).
  - `respawn(): void` - beside the home furnace if it still exists, else the world spawn; full health and warmth when it is hot, half otherwise; inventory kept.
  - `homeIsHot(): boolean`
  - HUD: `get trend: WarmthTrend`, `get warmthRate: number` (per second), `get inHeat: boolean`, `get radiationDose: number` (after the suit), `get buffTimeLeftS: number`, `get warmUpProgress: number` (0..1 towards Well-Warmed).
  - `toJSON(): SurvivalSnapshot`, `load(s)`.
  - Emits `buff:gained`, `flag` `well_warmed` and a toast when the buff is earned.

## objectives.ts (spec 2.7)
- `interface SimQuery { maxFurnaceTempC(): number; maxFurnaceTier(): number; generationW(): number; storedJ(): number }`; `NO_SIM_QUERY` (all zero)
- `interface ObjectiveProgress { current; target; fraction; text }`, `ObjectivePeaks { tempC; tier; generationW; storedJ }`, `ObjectivesSnapshot`
- `CHECK_INTERVAL_S = 0.25`; `formatWatts(w): string` ("500 W", "2 kW", "1.5 MW"); `formatJoules(j): string`
- `class ObjectiveTracker` - `new ObjectiveTracker(bus: GameBus, player: PlayerState, query: SimQuery = NO_SIM_QUERY)`
  - `setQuery(query)`, `tick(dt)` (checks every 0.25 s), `check()` (now; cascades through every objective already satisfied)
  - `get current: ObjectiveSpec | null`, `get allDone`, `get completed: ObjectiveSpec[]`, `get upcoming: ObjectiveSpec[]`, `get age: number`
  - `isComplete(id)`, `hasFlag(flag)`, `progress(): ObjectiveProgress | null` (current objective), `progressOf(condition): ObjectiveProgress`
  - `toJSON(): ObjectivesSnapshot`, `load(s)` (silent), `dispose()`.
  - On completion: rewards via `player.give`, `objective:completed`, toast "Done: <title>", sfx `objective`. On a new age: `age:advanced`, sfx `age`, toast.

## fakeWorld.ts (test fixture, not in the index)
- `class FakeWorld implements IWorld` - `new FakeWorld(bus?: GameBus | null)`; everything is air until set, always loaded;
  extras `put(x, y, z, blockKey, active = false)` and `fill(x0, y0, z0, x1, y1, z1, blockKey)`. `src/sim` tests can reuse it.

## Wiring notes for integration
- Per 20 Hz tick: `clock.tick(dt)`, simulation, `survival.tick(dt)`, `objectives.tick(dt)`.
- Save: `player.toJSON()`, `clock.toJSON()`, `survival.toJSON()`, `objectives.toJSON()`. Load the player BEFORE the tracker (the tracker reads `player.stats`).
- On `player:death` show the death screen; its button calls `survival.respawn()`.
- `player.home` must be set by whoever places/opens a furnace (`player.setHome`).

## Decisions where the spec is silent or ambiguous
- Warmth inside a heat radius is a flat +4/s; the night/frost/water drains do not apply there.
- Frostfell drain is ADDED to the night drain (night in frostfell: 0.3 + 0.6 = 0.9/s; day 0.2/s). "Mild day" = no drain at all applies (+0.5/s).
- Day/night for warmth is `clock.isNight` (dusk counts as day).
- Well-Warmed: the 8 s must be continuous. Staying by the furnace keeps the buff topped up at 300 s without re-announcing; `buff:gained` and the flag fire only when the buff starts from zero.
- Heat distance is Euclidean from the block centre to the centre of the player's body (feet + 0.9).
- Breath refills in 3 s at the surface. Lava damage is dealt 1 point at a time (4 hits per second). Fall damage rounds down.
- Objective conditions on simulation values use the highest value EVER sampled (so `reach_800` completes at once if bronze was already forged at 800 C); the HUD text shows that peak, not the live value.
- Rewards that do not fit are kept (saved) and handed over quietly once there is room, instead of being lost.
- Furnace tier for the age also counts `block:placed` of a furnace block and `furnace:upgraded`, not only the query.
- `skipToDawn` lands at 0.025 (mid-dawn), not at 0.

## Known gaps
- `survival.ts` is 415 lines (above the 350-line aim); not split.
- No rule here for placing blocks, the pail, or "blocks cannot be placed inside the player": that is `src/player` (spec 7.3).
- Rest (`rest()` in spec 3.1) belongs to the simulation; this module only provides `clock.skipToDawn()`.
- Heat and radiation sources are rescanned every 0.5 s around the player (11x11x11 cells): a torch placed right now warms up to half a second later. Radiating blocks more than 5 cells from where the last scan was centred are not seen until the next scan.
- `gather_logs` is any-of(4 oak, 4 pine) in content, so 2 oak + 2 pine does not complete it (a content decision; the tracker shows the better of the two counts).
- Not exercised against the real `World` or the real simulation yet - only against `FakeWorld` and scripted events.
