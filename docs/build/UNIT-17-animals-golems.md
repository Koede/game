# Unit 17 - Harnessed animals and walking golems

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Design only; the builder writes the code.

**Threads:** T2 (rotation: a harnessed animal is a treadwheel source, 12 rpm / 24 su through `Workshop.standingOn`; a golem at a
crank is a `workshop.crank()` source of 8 su), T6 (creatures and helpers: harness, `clay_golem`, golem setup, every machine touch
through `offer` / `take` / `crank` / `act` and `workshop.logi.peek` / `accept(commit = false)`), T10 (saving: optional `harness`,
`fedS`, `golem` on `SavedMob`; harness index derived), and as a reader T4 (`clay_golem` row, `bandage` and `elixir_*` consumers),
T7 (side goals `harness_animal`, `walk_golem`; research flag `golem_walk`), T8 (status lines), T9 (`golem_step`, `golem_wake`).

Ids this unit DEFINES (SYSTEMS 6.2 row "harness, `clay_golem` mob, golem setup, `standingOn` mob read"): `HARNESS_FEED_S`,
`GOLEM_RANGE`, `GOLEM_SPEED`, the `clay_golem` item / creature / infusion, `CONSTRUCTS` registry list, flags `harnessed_animal`
and `golem_woke`, side goals `harness_animal` and `walk_golem`, `MobManager.standingOn`, `MobManager.harnessTo`,
`MobManager.useOn`, `MobManager.golems`, `MobManager.useGolemHooks`, `MachineActAction.bare?`.

Ids this unit READS: `golem_walk` research flag/entry (Unit 18), `padlock_chest` / `isLocked` and the lock rule in `logi.take`
(Unit 16), `MobManager.callTame` (Unit 16; Unit 17 adds the golem skip line), vault groups behind `logi.accept/take` (Unit 15), `bandage`
and `elixir_<buff>` items (Unit 10), `Workshop.relocate` maps and `MovingView` (Unit 13), side-goal mechanism and the
`Workshop.standingOn` hook documentation (Unit 0).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The treadwheel item description has promised it since the workshop shipped: *"A big wheel to walk in. It turns at 12 rpm and
carries 24 stress units while you or a tame animal stand on top of it."* (`src/content/itemsWorkshopParts.ts`). Today only the
player turns it (`src/app/game.ts` `standingOn` reads `this.state.player.position`). This unit keeps the promise and then goes one
step further into the magic layer.

**The goat on the wheel (Bronze).** You tamed a goat with wheat weeks ago. Now you build a treadwheel beside the millstone, hold a
sheaf of wheat and Use it on the wheel. The goat trots over, steps up, and starts walking in place; the shaft turns at 12 rpm, the
millstone grinds, and you are free to go mine. Every ten minutes you come back with a sheaf of wheat for it. Forget, and you get a
toast - "The goat is hungry and steps off the treadwheel" - and the millstone falls silent. It is the first source of rotation that
works while you are away and costs only farm produce: a living, slightly needy engine, the farm feeding the workshop.

**The clay golem (Forge, magic, optional).** The clay servant has cranked the crank it touches since the magic layer shipped. With
the research `golem_walk` (Unit 18) the servant is infused again with Soul and Drive: it stands up, takes a step, and becomes a
Clay Golem - a squat terracotta figure with two pink Soul-lit eyes and a bronze cog set in its chest. You set it up exactly like a
Mechanical Arm, with the wrench: golem, source, up to four targets, golem again. But where the arm reaches 3 blocks, the golem
WALKS up to 8: it fetches a stack of wheat from the depot, carries it across the room to the millstone, comes back; it cranks the
hand crank on the far wall for half a minute; it works the hand quern with its clay fists. It eats one unit of Spring every 30 s
from a jar within its range. It never empties a padlocked chest. It is slow (2 blocks/s), it is visible, and you can see exactly what it is
doing by looking at it: "Clay Golem - carrying 8 Flour to the Mixer, fed 22 s".

Both helpers are optional (T7): the tech spine never needs them, and they add nothing an arm, a crank or a clockwork motor cannot
already do - they do it with legs, which is the delight.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 T2 - rotation
- A harnessed animal makes `Workshop.standingOn(x, y + 1, z)` true for its wheel, so `sourceFor` (`src/workshop/workshop.ts`
  ~349, `if (p.kind === 'treadwheel') return this.standingOn?.(p.x, p.y + 1, p.z) ? { rpm: 12, capacity: 24 } : null;`) gives
  12 rpm / 24 su, exactly the player's numbers (SYSTEMS 5.2 "harness 12 rpm / 24 su"). No species multiplier: one wheel, one
  number (a stronger boar would be a second multiplier for something T2 owns).
- A golem at a crank calls `workshop.crank(x, y, z)` (default `CRANK_S` 2.5 s) once per second while it cranks, so the crank is a
  normal 16 rpm / 8 su source (`CRANK_RPM`, `CRANK_CAPACITY`). An elixir never changes the crank output.
- Nothing in this unit touches `LUBE`, `BASE_STRESS` or the kinetic solver.

### 2.2 T6 - one machine interface
- Golems touch machines ONLY through `Game.workshop`: `offer`, `take`, `crank`, `act`, and the documented container primitives
  `workshop.logi.peek(x, y, z)` and `workshop.logi.accept(x, y, z, item, n, false)` (dry run). Hand stations are worked through
  `workshop.act({ ..., bare: true })` which reaches the Game's `actHook` (section 4.3.6). The golem code in `src/mobs` never imports
  `src/workshop` or `src/sim`; Game passes a `GolemHooks` object (section 7).
- Golem feeding goes through ONE new public method on `Magic` (`feedConstruct`), the same jar search (`jarsFor`) the servants use.
- Harnessed animals touch nothing but `standingOn`.

### 2.3 Unit 16 - brass horn and padlock chest (aligned with docs/build/UNIT-16-trinkets-cards.md)
- **Horn.** Unit 16 owns `MobManager.callTame(x, y, z, radius, seconds): number` (tame animals within 32 blocks follow for 20 s) and
  already writes the harness skip defensively: `if ((m as { harness?: string }).harness) continue; // Unit 17: harnessed animals stay`.
  Unit 17's `Mob.harness` is `string | null`, so that truthy check works as written. Unit 17 ADDS the golem skip in the same loop:
  `if (m.golem) continue; // Unit 17: golems are not animals` (golems are `tame = true` so they are never retired, which would
  otherwise make the horn call them). A harnessed goat does not abandon its wheel when you blow the horn; the horn is the way back to
  the wheel for a goat that stepped off hungry and wandered (J4 step 2). If `callTame` is not merged yet, Unit 17 leaves a comment
  in `harness.ts` naming this contract.
- **Padlock chest.** Unit 16 adds `isLocked(world, x, y, z): boolean` (`src/workshop/trinkets.ts`, block key `padlock_chest`) and
  makes `Logistics.take/peek` refuse locked cells for every caller except the player's own hand. A padlock chest is "a 27-slot crate
  that machines, pipes and golems may FILL but never EMPTY". Unit 17 follows that rule exactly:
  (a) wrench setup REFUSES a padlock chest as the SOURCE with Unit 16's string
  `"The Padlock Chest is locked - a golem cannot take from it"`; as a carry TARGET it is ALLOWED (a golem may deliver into it);
  (b) at run time a source that has become a padlock chest is skipped (status "the source is locked - wrench it to set another"),
  and the leftover rule never returns a stack to a locked source (it tries other targets, then drops at the golem's feet);
  (c) `GolemHooks.locked(x, y, z)` = Unit 16's `isLocked(world, x, y, z)`, falling back to `blockKey === 'padlock_chest'` if Unit 16
  has not merged. `workshop.take` refusing locked cells is the safety net.

### 2.4 Unit 15 - vault groups
- A golem source or target on ANY cell of a vault group works on the whole group, because Unit 15 makes `logi.peek/accept/take`
  on a member cell act on the group. Unit 17 adds nothing for that.
- Setup dedupe: if `workshop.logi.groupKey?.(x, y, z)` exists (Unit 15, optional), two wrenched cells with the same group key are one
  target ("Already a target: the Item Vault group"). Without it each cell is its own target, which still works (double visits).
- Name in status lines: `GolemHooks.blockName` returns the display name; for a vault group Game may return
  `"Item Vault group"` when `groupKey` exists.

### 2.5 Unit 13 - moving structures
- A treadwheel is a workshop part, so a piston or bearing can move it. `Workshop.relocate(map)` already moves per-block state;
  Game forwards the same map to `MobManager.relocate(map)` (NEW): harness keys and golem source/target cells that appear in the map
  are rewritten, and a harnessed animal is set onto its wheel's new top centre. Unit 13's riders rule (`PlayerPhysics.platform`)
  is for the player; for mobs the pin in section 4.1.5 puts the animal back on the wheel every tick, so no tween is needed for the
  animal itself (the wheel's tween ends where the animal already stands, Unit 13 recomputes on the step's END).
- A golem's home is NOT relocated (it is a floor cell, not a structure block).

### 2.5b Unit 4 - hot items; Unit 13 - riders
- Unit 4 makes every non-pack `Inventory` refuse hot items (`Inventory.accepts` refuses `isHot(item) && !this.holdsHot`) and keeps the
  casting bench out of item endpoints. A golem's carried stack is NOT an `Inventory`, so the rule is enforced at the source: the
  golem never takes a hot item (`GolemHooks.take` / `peek` entries whose item `isHot` are skipped, Game passes Unit 4's `isHot`
  helper into the hook as `hot(item)`). Containers already refuse to hold them, so in practice a golem only meets one if a mod or
  a future path puts one there. Golems never target the casting bench (it is not `canHold`, not a hand station).
- Unit 13's `PlayerPhysics.platform` carries the PLAYER on moving structures. Mobs are not carried by it: a harnessed animal is
  re-pinned to its wheel's new top through `MobManager.relocate` (2.5); a golem standing on a moving platform simply stays put and
  repaths (it is a floor walker; out of scope to ride).

### 2.6 Unit 10 - bandage and elixirs; Unit 18 - research
- Use a `bandage` on a damaged golem: +6 HP at once (the golem is clay; no heal-over-time slot on a mob). Use any item whose key
  starts with `elixir_` and that exists in the registry: the golem works twice as fast for `GOLEM_ELIXIR_S` 300 s (T4 row "golems fed an
  elixir work 2x for 5 min"). Both read item keys only; if Unit 10 has not merged, those Uses simply never happen. Clay (`clay`, an
  Ember block item that already exists) also patches a golem: +2 HP. So repair never depends on Unit 10.
- `golem_walk` (Unit 18, entry title "The Walking Clay") gates the infusion: Unit 18's entry lists `unlocks: { gates: ['clay_golem'],
  flags: ['golem_walk'] }` (Unit 18's NEW optional `unlocks.gates`), so `RESEARCH_GATES` / `craftGateReason` refuse the infusion in
  `startInfusion` with `Research "The Walking Clay" in your notebook first` until it is researched. Before
  Unit 18 merges, `RESEARCH_GATES` has no row for `clay_golem`, so Unit 17 adds a guard (section 4.3.1) that refuses the golem
  infusion unless `hasFlag(research, 'golem_walk')`. Result: the golem is never craftable without the research, and the build stays
  consistent whatever order the units merge in (SYSTEMS 6.3 "a unit reading a flag another unit defines works before the other
  merges").

### 2.7 Unit 0 - foundations
- `Workshop.standingOn` keeps its type `(x, y, z) => boolean`; Unit 0 documents that it includes harnessed mobs and Unit 17 fills it.
- Side goals use Unit 0's `SIDE_OBJECTIVES` mechanism; Unit 17 exports `HELPER_SIDE_GOALS` from a new file.

### 2.8 T4 material web (no new intermediates)
| item | made by | consumed by | age | stack |
|---|---|---|---|---|
| `clay_golem` (item that places a mob) | infusion altar: heart `clay_servant`, pedestals 2 `clay` + 1 `bronze_cog` + 1 `leather`, cost Soul 4 + Drive 2, 30 s (17) | walking helper (17); research `golem_walk` gates it (18) | forge | 1 |

`clay_golem` is an end product (a tool-like placeable), so the two-consumer rule does not apply. It feeds existing consumers: Spring
essentia (a new steady sink beside servants), `bandage` (second consumer after the player), `elixir_*` (second consumer after
drinking), wheat / potato / carrot gain a workshop use through the harness.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (quoted)

- `src/app/game.ts` ~164: `this.workshop.standingOn = (x, y, z) => { const p = this.state.player.position; return
  Math.abs(p.x - (x + 0.5)) < 0.7 && Math.abs(p.z - (z + 0.5)) < 0.7 && p.y > y - 0.2 && p.y < y + 0.4; };` - player only.
- `src/workshop/workshop.ts` 114: `/** True while a player or tame animal stands on the cell above (treadwheel); set by Game. */
  standingOn: ((x, y, z) => boolean) | null = null;` - the comment already promises animals. 349: the treadwheel source line above.
  `src/workshop/signals.ts` 77 reads the same hook for pressure plates (`if (this.host.standingOn()?.(c.x, c.y, c.z)) return true;`).
- `docs/api/workshop.md`: "**Treadwheel**: 12 rpm / 24 su while `standingOn(x, y+1, z)` (Game: the player stands on it; tame
  animals are not read yet)." and the stable machine interface section ("golems and constructs from src/magic use exactly this").
- `src/workshop/logistics.ts`: arm setup `wrench(c, x, y, z)` with toasts `'Wrench the SOURCE block, then up to 4 targets, then the
  arm again'`, `'Source set. Now the targets'`, `` `Target ${n} set` ``, `'Too far from the arm (3 blocks)'`, `` `Arm set: ...` ``;
  constants `ARM_REACH` 3, `ARM_TARGETS` 4, `CELL_CAP` 16; `arm(c, dt)` round-robins targets with `c.rr` and returns what a target
  refused to the source (`if (n < got.count) this.accept(...src, got.item, got.count - n)`). `Logistics.use` routes the wrench only
  when `c.kind === 'mech_arm' || this.configuring`; otherwise a wrench Used on a depot goes to `putOrTake` (it would try to put the
  wrench in) - so golem setup MUST be routed before `workshop.use` (section 4.3.4).
- `Workshop.offer / take / crank / signal / act` (`workshop.ts` ~537-563). `take` defaults `max = 64`; `logi.take` defaults
  `CELL_CAP`. `act` -> `logi.act` -> `host.act()` (Game's `actHook`) -> `sim.stroke(x, y, z, a.item)`.
- `src/sim/handWork.ts` `stroke(x, y, z, heldKey: string | null)`: with an output waiting and no held item it calls `take(node)`,
  which GIVES the output to the player's pack (`this.d.player.give(...)`). A helper must never trigger that; hence the NEW
  `strokeAsHelper` (section 4.3.6). `view(x, y, z): HandView | null` exists (used to classify hand stations).
- `src/mobs/manager.ts` (499 lines): `feed(id, itemKey)` sets `m.eagerS = MOB_EAGER_S; m.tame = true;` and toasts
  `` `This ${name} is eager: feed another ${name} nearby` ``; `describe(id)` gives `"Goat - 6/8"`; `useHostileHooks(hooks)` is the
  pattern for plugging the game into a layer; `HostileLayer` keeps automatons in their own list with the same ids. No `call` yet
  (Unit 16).
- `src/mobs/brain.ts`: `think(ctx, m, dt)` priorities flee > swim > breed > follow (`ctx.held` in `m.spec.likes`, within
  `MOB_FOLLOW_RANGE` 10) > baby leash > idle cycle; `steer(...)` is module-private; `standCell` / `walkable` / `clearanceOf` from
  `terrain.ts` are the edge guard; "Wander paths are straight lines (no path finding)" (docs/api/mobs.md).
- `src/mobs/types.ts`: `Mob` (with `tame`, `state: MobState`, `hostile: HostileState | null`), `SavedMob` (`tame?` optional - the
  model for optional fields), `MobsSnapshot { version: 1, ... hostiles? }`.
- `src/mobs/persistence.ts`: `saveMobs` / `restoreMobs` (sanitises every field; `creatureOrNull(r?.species)` skips unknown species).
- `src/content/creatures.ts`: `hen` (w 0.45, likes `wheat_seeds`), `goat` (w 0.8, h 1.2, health 8, speed 2.6, likes `wheat`), `boar`
  (w 0.9, h 0.9, health 10, speed 2.8, likes `potato`, `carrot`).
- `src/core/registry.ts`: `CREATURES` (the spawner reads it), `AUTOMATONS` (not spawned by the animal spawner), `creatureOrNull`
  finds both; `validateCreature` refuses `no biomes`.
- `src/magic/magic.ts`: `SERVANT_FEED_S = 30`; `tickServants(dt)` (~923) takes 1 Spring with `this.take(x, y, z, 1, 'spring', 1,
  false)` from jars it touches or tubes to and calls `this.hooks.crank?.(...c)`; `servantText` -> `'Clay Servant - cranking, fed for
  N s'` / `'Clay Servant - idle (needs a hand crank and a jar of Spring it touches or tubes to)'`; `startInfusion` checks
  `this.craftGate(r.id)`; private `take(x, y, z, radius, aspect, n, withVials)`.
- `src/content/recipesMagic.ts` `INFUSIONS`: `infuse('clay_servant', 'clay_servant', 'clay', ['clay', 'clay', 'iron_ingot',
  'glass_vial'], { spring: 8, mind: 8, loam: 8 }, 20)`.
- `src/magic/aspects.ts`: `drive` (compound gale+rift, "force and motion"), `soul` (late, spring+mind, "creatures and servants").
- `src/player/animals.ts`: `AnimalHands.use()` returns `'pass'` unless the held item is `likedByAnimals`; `AnimalTargets` is the
  interface the controller sees (`raycast`, `hit`, `feed`).
- `src/render/mobs/mobRenderer.ts`: one `InstancedMesh` per species, built lazily by `addBatch(spec)`; animates legs, head, arms
  (`armL` / `armR` rise with `flare`), emissive `glow` parts (automatons).

Nothing named harness or golem exists in `src` today (grep confirmed).

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 Harnessed animals

#### 4.1.1 Who can be harnessed
| species | harness? | why |
|---|---|---|
| `goat` | yes | sure-footed, 0.8 wide: fills the wheel |
| `boar` | yes | 0.9 wide, stubborn walker |
| `hen` | no: "A hen is too small to turn the treadwheel" | 0.45 wide, a bird |
| any baby | no: "This goat is too young for the treadwheel" | |
| wild (not `tame`) | no: "Tame the goat first - feed it wheat" | |
| automaton / golem | never (not offered) | |

Rule in code: `HARNESS_MIN_W = 0.75` on `spec.size.w` (adult), plus `m.tame && !m.baby && !m.hostile && !m.golem`. New species
later qualify by size alone.

Both species give the same 12 rpm / 24 su (section 2.1).

#### 4.1.2 Putting an animal on the wheel (two ways, both phone-friendly)
1. **Use the liked item on the treadwheel (primary, deterministic).** Hold wheat (or potato/carrot) and Use it on a `treadwheel`
   block. Game routes this before `workshop.use` (section 4.3.4) to `mobs.harnessTo(x, y, z, item, px, pz)`. The manager picks the
   NEAREST eligible tame adult that likes the item within `HARNESS_CALL_RANGE` 12 blocks of the wheel (any state but dying / flee /
   already harnessed) and gives it the order: it walks to the wheel (straight steer to the wheel's top centre, the existing edge
   guard; hop up one block), state `'harness'` with sub-phase `going`. One item is consumed only when an animal is chosen (it counts
   as the first feeding: `fedS = HARNESS_FEED_S`). Toast (info): "The goat walks to the treadwheel".
   Refusals (toast, item kept):
   - nobody eligible: "No tame goat within 12 blocks of the treadwheel" (the species named is the first species that likes the held
     item; for potato/carrot "boar");
   - wheel occupied by another animal: "The treadwheel already has a goat";
   - no room above the wheel (the 2 cells above not free for the body height): "The treadwheel needs open space on top";
   - only hens like the item (wheat seeds): "A hen is too small to turn the treadwheel".
   If the walking animal is blocked for `HARNESS_GO_S` 8 s without reaching the top (blocked/edge-guard refused), it gives up:
   "The goat cannot reach the treadwheel" and returns to idle; the item is NOT refunded (it ate it), so the toast says
   "The goat ate the wheat but cannot reach the treadwheel".
2. **Lead it on (J4 wording).** A tame eligible animal whose feet cell is directly above a treadwheel (`world.getBlock(floor(x),
   floor(y + 0.01) - 1, floor(z)).key === 'treadwheel'`) and which has been there, not fleeing, for `HARNESS_SETTLE_S` 1.5 s
   becomes harnessed when it is NOT currently following (the player is not holding a liked item within range) but WAS following
   within the last `HARNESS_LED_S` 10 s (`m.ledS`, set to 10 every tick it is in state `follow`, counting down) - i.e. you led it
   with wheat, then put the wheat away (or walked off out of follow range). A tame goat that wanders onto a wheel by itself is NOT
   harnessed (no surprise hunger toasts). `fedS = HARNESS_FEED_S` on harnessing this way too
   (it is fresh from following the food). This check runs every 0.25 s per tame animal (cheap: one block read).

On harnessing (either way): `m.harness = "x,y,z"` (the wheel cell), `m.state = 'harness'`, position snapped to the wheel's top
centre `(x + 0.5, y + 1, z + 0.5)`, yaw set to the wheel's facing (`voxelFacing` of the wheel, walking "forward" along it), flag
`harnessed_animal` emitted (`bus.emit('flag', { flag: 'harnessed_animal' })`, side goal), sfx = the species call (`goat`/`boar`, pitch
1.1, volume 1), toast (good): "The goat is harnessed to the treadwheel - feed it every 10 min".

#### 4.1.3 Feeding rule
- `HARNESS_FEED_S` = 600 s (SYSTEMS 5.2). `fedS` counts down only while the animal's column is loaded (frozen columns freeze it,
  as for all mobs).
- Use a liked item on a harnessed animal: `fedS = HARNESS_FEED_S`, one item used, sfx `eat`, toast (info) "The goat is fed - 10 min
  on the wheel". It does NOT become eager (no breeding on the wheel; take it off to breed). Refused while `fedS > HARNESS_FEED_S - 60`:
  "The goat is not hungry yet (9.2 min)" (item kept; advisory keyed without numbers like the existing feed refusals).
- At `fedS <= 60` once: toast (info) "The goat on the treadwheel is getting hungry (1 min)".
- At `fedS <= 0`: it steps off - unharness (4.1.4) with toast (warn) "The goat is hungry and steps off the treadwheel" (T6 wording)
  and the species call at pitch 0.8.

#### 4.1.4 Taking it off
- Use the `wrench` on a harnessed animal: unharness, toast (info) "The goat is free of the treadwheel".
- Its wheel block is broken or replaced (block key at the harness cell no longer `treadwheel`): unharness silently on the next check,
  then it steps off naturally (it would be standing in the air or in the new block's cell anyway).
- It is hurt (player hit or hazard): `hurt()` unharnesses before the flee (it bolts).
- Hunger (above).
Unharnessing: `m.harness = null`, `m.state = 'idle'`, `stateS = 1`; it is pushed to the first free neighbouring stand cell (N, E, S,
W order, `standCell`) by setting a short wander target there, so it visibly steps off. `fedS` is kept as a number but no longer counts.

#### 4.1.5 While harnessed (behaviour)
- `mind()`: a harnessed animal skips `think()`; `harnessTick(m, dt, ctx)` runs instead: decrement `fedS`, checks of 4.1.3/4.1.4, sets
  `vx = vz = 0`, and pins `x/z` to the wheel's top centre. After `separate()` (crowd push) `move()` re-pins it (the crowd cannot push
  it off). `y` follows physics (it rests on the wheel top).
- Walking in place: every tick while harnessed (it walks whether or not the network is jammed - the animal does not know) its leg
  phase advances: `m.walk += HARNESS_STRIDE * dt` (1.2 blocks/s), `m.speed = 1.2`, so the renderer swings legs at a calm walk while
  the body stays put. Head bob comes free with the walk phase.
- No idle calls changes: it still calls every 8-20 s (life on the farm).
- `standingOn` contribution: `MobManager.standingOn(x, y, z)` returns true when a mob with `harness === "x,y-1,z"` exists, its column
  is loaded, it is alive, and it is in the `harnessed` sub-phase (not `going`). Lookup is O(1) through a derived
  `Map<string, number>` harness index (wheel key -> mob id), rebuilt on load and kept on harness/unharness/remove (T10 rule 5).
- Pressure plates (`signals.ts` 77 uses the same hook with the plate's own cell): a plate's cell is never the cell above a treadwheel
  with an animal on it (both cannot occupy one cell), so the shared hook cannot misfire. Documented, no code.

#### 4.1.6 Wheel and player together
The player and an animal cannot usefully stand on one 1-block wheel; if both are counted the result is still `true` - one wheel,
12 rpm / 24 su. Two wheels in one network are two sources as today (the solver handles equal speeds).

### 4.2 Constants (all in `src/mobs/constants.ts` unless noted; SCREAMING_SNAKE per SYSTEMS 4)

| constant | value | source |
|---|---|---|
| `HARNESS_FEED_S` | 600 | SYSTEMS 5.2 |
| `HARNESS_MIN_W` | 0.75 | goat 0.8 / boar 0.9 pass, hen 0.45 fails |
| `HARNESS_CALL_RANGE` | 12 | a little beyond `MOB_FOLLOW_RANGE` 10 |
| `HARNESS_SETTLE_S` | 1.5 | lead-on settle time |
| `HARNESS_LED_S` | 10 | lead-on only for an animal that followed the player this recently |
| `HARNESS_GO_S` | 8 | give-up time walking to the wheel |
| `HARNESS_STRIDE` | 1.2 | leg phase blocks/s in place |
| `HARNESS_WARN_S` | 60 | hunger warning |
| `GOLEM_RANGE` | 8 | SYSTEMS 5.2 (Chebyshev x/z from home; `|dy| <= GOLEM_RANGE_Y` 4) |
| `GOLEM_RANGE_Y` | 4 | vertical reach of targets and path box |
| `GOLEM_SPEED` | 2 | blocks/s, SYSTEMS 5.2 (creature spec `speed: 2`) |
| `GOLEM_TARGETS` | 4 | = `ARM_TARGETS` (SYSTEMS T6 "up to 4 targets") |
| `GOLEM_FEED_S` | 30 | = `SERVANT_FEED_S` (1 Spring / 30 s) |
| `GOLEM_VIAL_S` | 120 | a carried Vial of Spring used on it: 4 units x 30 s |
| `GOLEM_ELIXIR_S` | 300 | SYSTEMS T4 "2x for 5 min" |
| `GOLEM_ELIXIR_MULT` | 2 | walk speed and stroke rate |
| `GOLEM_CRANK_S` | 30 | time at one crank before moving to the next target (stays forever if it is the only target) |
| `GOLEM_STATION_S` | 30 | longest stay at one hand station per visit |
| `GOLEM_STROKE_S` | 1.0 | seconds per bare stroke (0.5 with an elixir) |
| `GOLEM_FULL_WAIT_S` | 5 | waits this long at a full target before trying the next |
| `GOLEM_RETRY_S` | 5 | idle retry when nothing can be done |
| `GOLEM_HEALTH` | 20 | creature spec `health` |
| `GOLEM_PATH_NODES` | 1200 | BFS node cap (17 x 17 x 9 box = 2601 cells; real floors far fewer) |
| `GOLEM_SETUP_S` | 60 | wrench setup times out |
| `GOLEM_SETUP_LEAVE` | 24 | setup cancelled when the player is farther from the golem |
| `GOLEM_BANDAGE_HP` | 6 | bandage repair (T4 row) |
| `GOLEM_CLAY_HP` | 2 | clay repair |

### 4.3 The clay golem

#### 4.3.1 Identity, recipe, gate
- Item `clay_golem`, name "Clay Golem", category `'tool'`, `stack: 1`, `age: ageIndexOf('forge')`, desc (T8 voice, names the use
  and the number): "A clay figure with Soul in it. Set it on the ground, wrench it like a Mechanical Arm and it walks up to 8
  blocks to carry, crank or work a station. Eats 1 Spring every 30 s." Icon: terracotta figure, pink eyes, bronze cog (icon
  readability test applies). Lives in `src/content/itemsMagic.ts` beside `clay_servant`.
- Creature `clay_golem` in NEW `src/content/constructs.ts` (`CONSTRUCT_SPECS`), registered in the NEW registry list `CONSTRUCTS`
  (like `AUTOMATONS`: not in `CREATURES`, so the spawner never spawns it; `creatureOrNull('clay_golem')` finds it so saves restore).
  Spec: `name 'Clay Golem'`, `desc`, `biomes: []`, `health: 20`, `speed: 2`, `size: { w: 0.7, h: 1.4 }`, `drops: []` (golem
  drops are decided by the golem layer, 4.3.10), `likes: []`, `group: [1, 1]`, `model` (4.3.2). `validateConstruct` (NEW, beside
  `validateAutomaton`) checks the model like `validateCreature` but allows empty biomes; registry adds
  `for (const c of CREATURES) if (CONSTRUCT_KEYS.has(c.key)) problems.push(...)` style guard "constructs belong in CONSTRUCT_SPECS".
- Infusion row appended to `INFUSIONS` (`src/content/recipesMagic.ts`):
  `infuse('clay_golem', 'clay_golem', 'clay_servant', ['clay', 'clay', 'bronze_cog', 'leather'], { soul: 4, drive: 2 }, 30)`.
  Reasoning: the servant is the heart (SYSTEMS T4: "clay_servant + 4 soul + 2 drive"); the pedestals give it more body (2 clay),
  a heart-cog that turns (bronze_cog, the Bronze workshop's part) and a leather strap for carrying. The essentia cost is small in
  units because Soul is a late aspect (Unit 18's `late_draw` or late-block overrides) and is the real gate. 30 s draws.
- Gate: Unit 18's `golem_walk` entry lists `unlocks.gates: ['clay_golem']`. Unit 17's guard in `Magic.startInfusion`, right after the
  existing `craftGate` check: `if (r.id === 'clay_golem' && !hasFlag(this.research, 'golem_walk')) { this.advise(GOLEM_GATE_TEXT);
  return 'refused'; }` with `GOLEM_GATE_TEXT = 'Research "The Walking Clay" in your notebook first'` (if Unit 18's entry title differs,
  the craftGate message already wins because it runs first once the entry exists; the guard text only shows before Unit 18 merges).
- Codex/progression: the solver reads `INFUSIONS` already, so `clay_golem` counts as obtainable once its heart and pedestals are.
  `gates.test.ts` must still prove magic optional.

#### 4.3.2 Model (CreatureSpec boxes, 1/16 block, facing -Z, feet centre origin)
A squat, broad-shouldered terracotta figure, readable on a phone at 10 blocks: wider than tall-looking, two stubby legs, long
hanging arms with fists, a blocky head with two pink Soul eyes, a bronze cog on the chest. Palette: `CLAY = 0xb8734f`,
`CLAY_DARK = 0x8f5439` (legs, fists, seams), `CLAY_LIGHT = 0xcf8f69` (face plate), `COG = 0x7d6544` (bronze, matches automatons'
BRONZE), `SOUL = 0xff9ad0` (the `soul` aspect colour `#ff9ad0`, emissive).

| part | anim | from | to | colour | notes |
|---|---|---|---|---|---|
| legL / legR | `legFL` / `legFR` (biped uses the front pair, like the hen) | [-4.5, 0, -1.5] / [1.5, 0, -1.5] | [-1.5, 8, 1.5] / [4.5, 8, 1.5] | CLAY_DARK | pivot top centre |
| hips | none | [-5, 7, -2.5] | [5, 9, 2.5] | CLAY_DARK | |
| body | none | [-5.5, 9, -3] | [5.5, 18, 3] | CLAY | |
| cog | none | [-2, 12, -3.5] | [2, 16, -3] | COG | chest plate |
| cogHub | none, `emissive` | [-0.75, 13.25, -3.75] | [0.75, 14.75, -3.5] | SOUL | glows with `glow` |
| armL / armR | `armL` / `armR` (pivot [±7, 17, 0]) | [-8.5, 7, -1.5] / [5.5, 7, -1.5] | [-5.5, 18, 1.5] / [8.5, 18, 1.5] | CLAY | rise with `flare` |
| fistL / fistR | same as arm | [-8.75, 5, -1.75] / [5.25, 5, -1.75] | [-5.25, 7.5, 1.75] / [8.75, 7.5, 1.75] | CLAY_DARK | |
| head | `head` (pivot [0, 18, 0]) | [-3, 18, -3] | [3, 23, 3] | CLAY | |
| face | `head` | [-2.5, 19, -3.25] | [2.5, 22, -3] | CLAY_LIGHT | |
| eyeL / eyeR | `head`, `emissive` | [-2, 20.25, -3.4] / [1, 20.25, -3.4] | [-1, 21.25, -3.25] / [2, 21.25, -3.25] | SOUL | |
| brow | `head` | [-3, 22, -3.5] | [3, 23, -3] | CLAY_DARK | |

Height 23/16 = 1.44 (spec `h: 1.4`), width 17/16 including arms (collision `w: 0.7` = body). The builder may nudge numbers so
`forwardReach` and the shader groups behave; the silhouette above is the brief. Animation (no shader change):
- legs swing with the walk phase (existing);
- `flare` (MobView, already read for arms) = working pulse: cranking `0.5 + 0.5 sin(2 pi t / 1.25)` (arms circle), stroking a hand
  station `abs(sin(pi t / GOLEM_STROKE_S))` (fists rise and fall once per stroke), carrying 0.35 (arms forward holding), else 0;
- `glow` = 1 fed and working, 0.6 fed and idle, 0.15 hungry (eyes dim) - visible state at a glance (T8, T9.4 amber/green/red is for
  blocks; pink Soul light is the golem's own vocabulary);
- `head` lowered (`m.head` -> 1) while hungry (it slumps).
- Carried stack: shown as an item cube between the fists. Game adds one display per carrying golem to the magic renderer's existing
  pedestal/altar item renderer list (`MagicRenderer` "items on pedestals and altars through a second GroundItemRenderer"), at
  `(x + 0.45 sin-forward, y + 0.7, z ...)` in front of the chest, read from `MobManager.golems.carryViews()` (NEW, reused array).
  If that wiring proves awkward, the fallback (acceptable) is no cube and arms at 0.35 flare; the status line still says it.

#### 4.3.3 Setting one down
- Use `clay_golem` on the TOP face of a solid block whose two cells above are free (`!solid && !liquid`) and inside a loaded column:
  `mobs.golems.add(x + 0.5, y + 1, z + 0.5, yawFacingPlayer)` -> a Mob of spec `clay_golem` with `tame = true` (never retired) and
  `golem = freshGolem(home = [x, y + 1, z])`. The item is consumed. Toast (info): "Clay Golem set down - wrench it, then a source,
  then up to 4 targets, then it again". sfx `golem_wake` (small 0.6). It starts "not set".
- Refusals: not the top face, no room: "Set the golem on open ground with room above it". Routed in Game's `beforeUse` before
  `magic.use` (the item is not a block, so nothing else would place it).

#### 4.3.4 Wrench setup, step by step (mirrors `Logistics.wrench`)
Routing (in `game.ts` `interaction.beforeUse`, FIRST, before `this.workshop.use`):
```ts
if (hit && held?.item === 'wrench' && this.state.mobs.golems.configuring() !== null) return this.state.mobs.golems.wrenchBlock(hit.x, hit.y, hit.z);
if (hit && held && this.world.getBlock(hit.x, hit.y, hit.z).key === 'treadwheel' && likedByAnimals(held.item)) { ...harnessTo... }
```
Wrench on the golem itself arrives through `AnimalHands.use()` -> `MobManager.useOn(id, 'wrench')` (section 4.4).

1. **Wrench the golem.** If no golem is configuring: this golem starts listening. Its `home` becomes its current feet cell
   (`floor(x), floor(y + 0.01), floor(z)`) - so moving a golem means: pick it up (4.3.10) or let it stand where you want and
   re-wrench. `src = null`, `targets = []`, carried stack kept. Toast: "Wrench the SOURCE block, then up to 4 targets, then the golem
   again". Its eyes pulse (glow 1 / 0.4 at 2 Hz) while listening. sfx `golem_wake` pitch 1.2.
   If ANOTHER golem is configuring: that one is finished first (as if wrenched again) and this one starts; toast as above.
2. **Wrench blocks** (each within `GOLEM_RANGE` 8 of home in x and z, and within 4 in y). The block is classified by
   `GolemHooks.targetKind(x, y, z)`:
   - `'crank'`: `hand_crank` part.
   - `'carry'`: a container the workshop can hold items in - `Workshop.canHold(x, y, z)` (NEW, 4.5): a logistic cell of kind depot,
     basin, funnel, chute, deployer, item_vault, skiff or item_drain, a crate block entity, or a mechanical twin station with a
     machine buffer (millstone, saw, stamp mill, loom: `offer` feeds them via `twinAccept`). Includes vault groups (Unit 15) and,
     after Unit 0, reaction vessels if `canHold` reports them (Unit 0's `Distillery.offerItem/takeItem` via logi).
   - `'work'`: a hand station (NEW pass-through `Simulation.handView(x, y, z) !== null` over the private `hand: HandWork`'s
     existing `view(x, y, z)`: chopping block, quern, stone anvil, mortar, clay table, loom, drying rack, trough).
   - `null`: refused "A golem cannot work that - pick a crank, a container or a hand station".
   Order rule: the FIRST wrenched `'carry'` block becomes the SOURCE ("Source set: Depot. Now the targets"); every later block, and
   any crank or station, becomes the next target ("Target 1: Hand Crank - it will crank", "Target 2: Mixer - it will carry",
   "Target 3: Hand Quern - it will work it"). A `'carry'` block wrenched after the source is a carry target. A golem may have no
   source (a crank-only or work-only golem). To make a station or crank the "first" thing and still have a source, wrench the source
   first.
   Refusals (toast, setup continues): "Too far from the golem's home (8 blocks)"; as source only: "The Padlock Chest is locked - a golem cannot take from it";
   "Already a target" (same cell or same vault group, or the source again); "The golem knows 4 targets - wrench it again to finish".
3. **Wrench the golem again.** Done. Toast: "Golem set: source Depot, 3 targets" / "Golem set: no source, 1 target" / with zero
   targets "Golem set: nothing to do - wrench it again to start over". Flag-free; the first finished task wakes it (4.3.8).
- Setup is cancelled (toast "Golem setup cancelled") after `GOLEM_SETUP_S` 60 s without a wrench, when the player is more than
  `GOLEM_SETUP_LEAVE` 24 blocks away, or when the golem dies. Cancelled = the golem keeps whatever was set so far (like the arm,
  which keeps partial settings), so a half-finished setup still works.
- The arm's own configuring (`Logistics.configuring`) is independent; while a golem is configuring, the wrench goes to the golem
  (routing above). Finish the golem to wrench an arm.

#### 4.3.5 Work loop (the golem's tasks)
The golem cycles its targets in order with a round-robin index `rr` (like the arm's `c.rr`), choosing the next target that has
something to do. Per target kind:

**Crank target.** Walk to a stand cell beside the crank (4.3.7). Then every 1 s: `hooks.crank(x, y, z)` (refreshes the crank's
2.5 s window, so the network sees a continuous source). Stay `GOLEM_CRANK_S` 30 s, then go to the next target that has work; if the
crank is its only target, or no other target has work, it keeps cranking. Status "cranking the Hand Crank".

**Carry target.** If the golem carries nothing: needs a source. Walk to the source; at it, look at `hooks.peek(src)` and pick the
first entry whose item the target will take: `room = hooks.room(target, item, min(count, stackLimit(item)))` (dry `accept`). Take
`hooks.take(src, item, room)` - at most ONE stack (`stackLimit`, up to 64: SYSTEMS 5.2 "carries one stack"). Walk to the target;
`n = hooks.offer(target, item, count)`; the rest stays carried. Leftover rule (conservation, T3 rule 1 for items): try the other
carry targets in order (walking to each), then walk back and `offer` it to the source; if even the source refuses (or is gone),
drop it as a ground item at the golem's feet with `hooks.drop(item, count, x, y, z)` (Game: `player.ground.spawn`). Items never
vanish.
If the source has nothing any target takes: status "waiting for items at the Depot", retry every `GOLEM_RETRY_S`.
If the target's room is 0 when the golem arrives (filled meanwhile): wait `GOLEM_FULL_WAIT_S` 5 s re-checking each second
("waiting: the Mixer is full"), then the leftover rule.

**Work target (hand station).** Walk beside it. Loop every `GOLEM_STROKE_S` (0.5 s with an elixir) for at most `GOLEM_STATION_S`:
1. `r = hooks.work(x, y, z, null)` - a bare stroke (`act({ item: '', target, face, mode: 'strike', bare: true })`, 4.3.6).
   `'stroked'` -> keep going (arms fall: sfx comes from the station's own stroke event as for a player/deployer).
2. On `false` (nothing to work / needs more input / output waiting): if the golem carries items, `hooks.work(x, y, z, carry.item)`
   inserts ONE (`'inserted'`, carry count - 1) and the loop continues; if the station refuses the item, stop.
3. If not carrying and the golem has a source: fetch - at the source take ONE stack of the first item the station accepted last time
   (`target.want`, remembered per target, not saved), or, with no `want`, the first item in the source; walk back; continue. An item
   the station refuses is carried back (leftover rule) and the source's next kind is tried on the next visit (`skip` set per visit).
4. Output waiting (the stroke helper refuses with `'output'`): the golem does NOT take the output (that is the player's or an
   arm's job; a golem never takes from a hand station); status "the Hand Quern's output is waiting", move on.
Status "working the Hand Quern".

**Choosing.** A crank target always has work. A carry target has work when the golem carries something it takes, or the source
has something it takes. A work target has work when the golem has something to insert or the station strokes (tried on arrival).
With nothing to do anywhere: walk home, stand, status "idle - nothing to carry", retry every 5 s. The golem never stands on a
target block or the source block.

**First task** finished (first `offer` > 0, first crank second, first `'stroked'` or `'inserted'`): flag `golem_woke` once per
world (side goal "Wake a golem"; emitted every time is harmless, the tracker de-dupes, but the layer keeps a `woke` boolean per
golem to avoid bus noise).

#### 4.3.6 How a golem works a hand station (T6, through `act`)
- `MachineActAction` gains OPTIONAL `bare?: boolean` (SYSTEMS 6.5 allows optional members): "an empty-handed stroke by a helper".
- Game's `actHook` (game.ts ~181) becomes:
  ```ts
  this.workshop.actHook = (a) => {
    const [x, y, z] = a.target;
    const r = a.bare ? this.state.sim.strokeAsHelper(x, y, z) : this.state.sim.stroke(x, y, z, a.item);
    if (!r.ok) return a.bare ? false : null;     // bare acts never fall back to placing/breaking
    return r.did === 'insert' ? 'consumed' : 'used';
  };
  ```
- NEW `HandWork.strokeAsHelper(x, y, z): StrokeResult`: like `stroke(x, y, z, null)` but returns `{ ok: false, reason: 'output' }`
  when `e.slots[1]` is set instead of calling `take(node)` (which would give the output to the player's pack), and refuses timed
  stations (`def.timed`: they work by themselves). Pass-through `Simulation.strokeAsHelper`.
- `GolemHooks.work(x, y, z, item)` in Game: `item === null` -> `workshop.act({ item: '', target: [x, y, z], face: Facing.North,
  mode: 'strike', bare: true })` -> `'used'` maps to `'stroked'`; with an item -> `workshop.act({ item, target, face, mode: 'use' })`
  -> `'consumed'` maps to `'inserted'`; anything else `false`.

#### 4.3.7 Movement and paths (`src/mobs/golemPath.ts`, NEW)
The mobs have no path finding; a golem needs it (it walks round a workbench to reach a depot). Small, bounded BFS:
- Grid: columns `(cx, cz)` within `home ± (GOLEM_RANGE + 1)` in x and z, stand heights within `home.y ± GOLEM_RANGE_Y`.
- Node = a stand cell `(x, fy, z)` where the golem's feet can rest (solid or slab below, `clearanceOf(1.4)` = 2 free cells,
  no liquid, no hazard margin) - the existing `standCell(world, x, z, fy, clearance)` from `terrain.ts` answers "where would I stand
  in column x,z coming from height fy", including one-block step ups and drops up to `MOB_MAX_DROP` 2.
- Edges: 4 neighbours (no diagonals: no corner cutting through 1-wide gaps). Unloaded columns are walls (`standCell` already refuses).
- Goal: any stand cell horizontally adjacent (4-neighbour) to the target block with `|fy - targetY| <= 1` (`fy` = feet y; a target at
  head height or one below is in arm's reach), or for "home", the home cell itself.
- BFS from the golem's current stand cell, capped at `GOLEM_PATH_NODES` 1200 visited; returns a flat `number[]` of cells or null.
  Recomputed: on every new goal, when `m.blocked` (physics hit a wall) for > 1 s, and when the next waypoint's column changes
  (a block placed/broken there) - checked cheaply by re-validating the next 2 waypoints with `standCell` each 0.5 s.
- Following: steer to the next waypoint's centre at `GOLEM_SPEED` (x2 with an elixir) using the brain's steering (export `steer`
  from `brain.ts` as a NEW named export, unchanged), arrive within 0.25, advance. Hops come from `steer`.
- The golem never leaves the box: if it finds itself outside (knocked, fell), it paths home; if home is unreachable for 30 s it
  stops: status "lost - wrench it to set a new home".
- No path to a target: status "cannot reach the Mixer, path blocked", advisory toast once per target per 30 s "The golem cannot
  reach the Mixer", then the next target. No path to the source: same with "the Depot".
- Footsteps: sfx `golem_step` every 1 block walked, whisper 0.3, pitch 0.9-1.1 (T9 loudness tier "whisper"); silent when still.

#### 4.3.8 Feeding
- `fedS` counts down only while the golem is doing something (walking to a task, carrying, cranking, working); idle at home with
  nothing to do it does not eat (T9.3 spirit: idle is silent and free).
- When `fedS <= 0` and it has work: `hooks.feed(home)` = NEW `Magic.feedConstruct(x, y, z, GOLEM_RANGE)` -> takes 1 Spring from a
  jar within 8 blocks of HOME or joined by tubes to one (`this.take(x, y, z, radius, 'spring', 1, false) > 0`) -> `fedS = 30`.
  (SYSTEMS T6: "Fed like a servant (1 Spring per 30 s from a jar in its range or tubed)".)
- Use a Vial of Spring (`vial_spring`) on the golem: `fedS += GOLEM_VIAL_S` 120 (capped at 600), the empty `glass_vial` back,
  toast "The golem drinks the Spring - fed 2 min". The phone-first way to wake a hungry golem with no jar yet.
- Hungry (no Spring): it stops where it is (keeping its stack), sits/slumps, eyes dim; status "hungry, needs Spring in a jar within
  8 blocks"; advisory toast once per 60 s if the player is within 24 blocks: "The Clay Golem is hungry - fill a jar of Spring near it".
  Retries the jar every 5 s.

#### 4.3.9 Elixir
Use an item `elixir_*` on the golem: `boostS = 300`; walking speed x2 (4 blocks/s), stroke interval x0.5. Cranks unchanged (a crank
is 16 rpm / 8 su however fast it is turned - T2 owns that number), Spring use unchanged. The glass vial comes back (`glass_vial`;
elixirs are bottled in glass vials, T3 rule 4). Toast "The golem drinks the elixir - twice as fast for 5 min". A second elixir
refreshes to 300 s, never adds (T5 "refreshes and never shortens"). Status suffix ", x2 for 4.2 min" on the goggles line.

#### 4.3.10 Hurt, repair, picking up, death
- The golem is hit like an animal (`MobManager.hit`): flash, small knockback (x0.5), `mob_hurt` at pitch 0.7, but it does NOT flee
  (a golem is not afraid) and carries on. No natural healing (`life.ts` skips the heal clock for golems).
- Repair: Use `bandage` (+6 HP) or `clay` (+2 HP) on it; toast "The golem is patched - 14/20"; at full HP refused "The golem is not
  damaged".
- **Picking it up = hitting it to 0 HP as the player.** At 0 HP from a player hit it FOLDS UP: it drops the `clay_golem` item (its
  settings forgotten) plus its carried stack as ground items at its feet; toast (info) "The Clay Golem folds up - pick it up". This
  is deliberate and gentle: a player who wants to move it whacks it a few times with a hand (20 HP / 1 per hit ~ 8 s with the 0.4 s
  cooldown; an axe ~2 s). The describe line says how: when the crosshair is on a full-health golem nobody set yet, "Clay Golem - not set, wrench it
  to give it work" and the goggles line adds "Hit it to fold it up".
- At 0 HP from the WORLD (lava, cactus, falling below y -8): it crumbles - drops 4 `clay` and its carried stack (lava destroys
  ground items as usual); toast (warn) "The Clay Golem crumbled in the heat" (lava/contact) or none for the void. The infusion is
  lost; this is the only way to lose one. Golems path around hazards (the edge guard refuses hazard columns), so this only happens
  if the player builds lava into its path or knocks it in.
- Automatons attack only the player (`ctx.hurtPlayer` in `attacks.ts`); golems are ignored by them. No combat is added (SYSTEMS 1.1).
- Death goes through the manager's existing tip-over (`state 'dying'`, `MOB_DEATH_S`) and `onDeath` listeners; GameState already
  drops `MobDeath.drops` as ground items at the body (`player.dropAll`). The golem layer sets `pendingDrops` itself (bypassing
  `rollDrops(spec.drops)`), so the cause rule above applies.

#### 4.3.11 Chunk unload, save/load mid-task
- A golem in an unloaded column is frozen (like every mob); its timers do not run. Its targets may be in loaded or unloaded
  columns: a target in an unloaded column is treated as unreachable (`standCell` refuses unloaded columns) until loaded.
- Saved: home, src, targets (cells + kind), rr, fedS, boostS, carried stack, health, position. NOT saved: path, current task phase,
  setup-in-progress, `want`. After load it re-chooses its task from `rr`; carrying a stack it first tries to deliver it (carry
  targets in order, then the source).

### 4.4 `MobManager.useOn` - every Use on a mob that is not plain feeding
`useOn(id, item): UseOnResult | null` (NEW). Called by `AnimalHands.use()` BEFORE the `likedByAnimals` check; `null` = not handled,
fall through to the existing flow (feed or pass).

| target | held | result |
|---|---|---|
| golem | `wrench` | start / finish setup (4.3.4); consume 0 |
| golem | `vial_spring` | feed 120 s; consume 1, give `glass_vial` |
| golem | `elixir_*` | boost 300 s; consume 1, give `glass_vial` |
| golem | `bandage` / `clay` | repair 6 / 2 HP; consume 1 (refused at full HP) |
| golem | anything else | refused advisory "A golem takes a wrench, Spring, an elixir, a bandage or clay" only if the item is a liked animal food (otherwise `null`: Use acts as if no golem were there) |
| harnessed animal | `wrench` | unharness; consume 0 |
| harnessed animal | liked item | harness feeding (4.1.3); consume 1 |
| any other animal | `wrench` | `null` |
| anything | other | `null` |

```ts
export type UseOnResult = { ok: true; consume: number; give?: ItemAmount } | { ok: false; reason: string };
```

### 4.5 New small APIs outside `src/mobs`
- `Workshop.canHold(x, y, z): boolean` (NEW): true when `logi.cells` has a container kind at the cell (depot, basin, funnel, chute,
  deployer, item_vault, skiff, item_drain), a crate entity is there, or the cell is a mechanical twin with a machine buffer
  (`this.machines.has(key)`). Uses only Workshop-internal state (it is a Workshop method; T6 "no helper reads private state" is kept
  because the golem asks through a hook).
- `Magic.feedConstruct(x, y, z, radius): boolean` (NEW, public): one unit of Spring from jars within `radius` or tubed.
- `HandWork.strokeAsHelper` + `Simulation.strokeAsHelper` (NEW, 4.3.6).
- `MachineActAction.bare?: boolean` (NEW optional member).

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules: edge cases and messages

Every message below is the exact string (T8: sentence case, a full sentence that says the fix, numbers with units, no exclamation
marks). `kind` is the toast kind (`info` / `warn` / `good`). "Advisory" = `Interaction.advise`-style rate limit (once per subject per
30 s, keyed without numbers).

### 5.1 Harness
| situation | what happens | message |
|---|---|---|
| Use wheat on a treadwheel, tame goat within 12 | goat walks to the wheel, 1 wheat used | "The goat walks to the treadwheel" (info) |
| it arrives and settles | harnessed, flag `harnessed_animal` | "The goat is harnessed to the treadwheel - feed it every 10 min" (good) |
| no eligible animal | nothing used | "No tame goat within 12 blocks of the treadwheel" (advisory) |
| only hens like the item | nothing used | "A hen is too small to turn the treadwheel" (advisory) |
| wheel already has an animal | nothing used | "The treadwheel already has a goat" (advisory) |
| no room on top of the wheel | nothing used | "The treadwheel needs open space on top" (advisory) |
| the walker is blocked 8 s | back to idle; the item is eaten | "The goat ate the wheat but cannot reach the treadwheel" (info) |
| led on with food, food put away, 1.5 s on the wheel | harnessed (same toast) | as above |
| wild animal on a wheel | nothing (not tame) | none |
| baby on a wheel / Use with a baby nearest | babies are never chosen | "This goat is too young for the treadwheel" only when the ONLY candidate is a baby |
| feed a harnessed animal, `fedS <= 540` | `fedS = 600`, sfx `eat` | "The goat is fed - 10 min on the wheel" (info) |
| feed a harnessed animal, `fedS > 540` | refused, item kept | "The goat is not hungry yet (9.2 min)" (advisory) |
| `fedS` reaches 60 s | once | "The goat on the treadwheel is getting hungry (1 min)" (info) |
| `fedS` reaches 0 (animal unfed) | steps off; shaft stops unless the player stands on it | "The goat is hungry and steps off the treadwheel" (warn) |
| wrench on a harnessed animal | steps off | "The goat is free of the treadwheel" (info) |
| wheel broken / replaced / turned into another block | steps off on the next 0.25 s check, no toast (the player did it) | none |
| wheel moved by a piston/bearing (Unit 13) | harness key follows the relocate map; the animal is re-pinned on the new top | none |
| animal hurt (player or lava) | unharnessed, then flees as today | none (the hurt flash says it) |
| network jams or overstresses | nothing changes for the animal (it keeps walking; the workshop's own toast reports the jam) | workshop's existing toast |
| chunk unloads | frozen with its column; `standingOn` false while unloaded; resumes on load | none |
| save and load while harnessed | restored harnessed with its `fedS`; harness index rebuilt; if the wheel is gone at load, unharnessed on the first loaded check | none |
| horn blown (Unit 16) | harnessed animals and golems ignore `callTame` | none |
| player holds wheat near a harnessed goat | it does NOT follow (harness overrides follow) | none |
| two goats led onto one wheel | the first to settle is harnessed; the second cannot stand there (cell occupied) and the crowd push keeps it off | none |

### 5.2 Golem
| situation | what happens | status line / message |
|---|---|---|
| infusion without research | refused | "Research \"The Walking Clay\" in your notebook first" (Unit 18's entry title once it exists) |
| Use `clay_golem` on open ground | golem set down | "Clay Golem set down - wrench it, then a source, then up to 4 targets, then it again" |
| no room / not the top face | refused | "Set the golem on open ground with room above it" |
| wrench the golem | listening | "Wrench the SOURCE block, then up to 4 targets, then the golem again" |
| wrench a container first | source | "Source set: Depot. Now the targets" |
| wrench a crank / container / station | target n | "Target 1: Hand Crank - it will crank" / "Target 2: Mixer - it will carry" / "Target 3: Hand Quern - it will work it" |
| too far | refused | "Too far from the golem's home (8 blocks)" |
| padlock chest wrenched as the source | refused (as a target it is allowed) | "The Padlock Chest is locked - a golem cannot take from it" |
| same cell / vault group again | refused | "Already a target" |
| fifth target | refused | "The golem knows 4 targets - wrench it again to finish" |
| not workable | refused | "A golem cannot work that - pick a crank, a container or a hand station" |
| wrench the golem again | done | "Golem set: source Depot, 3 targets" / "Golem set: no source, 1 target" / "Golem set: nothing to do - wrench it again to start over" |
| 60 s idle / player 24 blocks off | setup ends, keeps what was set | "Golem setup cancelled" |
| target removed (block broken) | target dropped at its next visit | "The golem forgot target 2: the Depot is gone" (info, once) |
| source removed | carry targets idle | status "no source, wrench it to set one" |
| target full | waits 5 s, then other targets, then back to the source | status "waiting: the Mixer is full" |
| source empty / nothing any target takes | idle at home, retry 5 s | status "waiting for items at the Depot" |
| source becomes a padlock chest | carry targets idle; stacks are never returned into it | status "the source is locked - wrench it to set another" |
| path blocked | next target; retry later | status "cannot reach the Mixer, path blocked"; advisory "The golem cannot reach the Mixer" |
| pushed out of its range | paths home | status "walking home" |
| home unreachable 30 s | stops | status "lost - wrench it to set a new home" |
| unfed, no Spring in reach | stops where it is, keeps its stack | status "hungry, needs Spring in a jar within 8 blocks"; advisory "The Clay Golem is hungry - fill a jar of Spring near it" |
| vial of Spring used on it | fed 120 s | "The golem drinks the Spring - fed 2 min" |
| elixir used on it | x2 for 300 s | "The golem drinks the elixir - twice as fast for 5 min" |
| bandage / clay on a damaged golem | +6 / +2 HP | "The golem is patched - 14/20" |
| bandage / clay at full HP | refused | "The golem is not damaged" |
| player hits it to 0 HP | folds: drops `clay_golem` + carried stack | "The Clay Golem folds up - pick it up" |
| lava / cactus to 0 HP | crumbles: 4 clay + carried stack | "The Clay Golem crumbled in the heat" (warn) |
| station output waiting | moves on; never takes it | status "the Hand Quern's output is waiting" |
| station refuses the carried item | carried back to the source | none |
| hand station is timed (drying rack, trough) | strokes refused; inserts still work | status "the Drying Rack works by itself" |
| chunk with the golem unloads | frozen | none |
| chunk with a target unloads | target unreachable until loaded | status "cannot reach the Mixer, path blocked" |
| save/load mid-carry | the stack is saved; delivered after load | none |
| contraption moves a target/source block | cells rewritten through `MobManager.relocate(map)` | none |
| two golems share a source | each takes its own stack; `take` is atomic per call | none |
| golem and arm share a depot | both use `logi`, which is the single owner of the depot's items | none |
| golem stands on a pressure plate | plates read `standingOn` (player + harness only); golems do not press plates (they are not "standing on" anything for the workshop) | none |

### 5.3 Conservation
- Items: every take is followed by an offer of the same count to some container, or a ground spawn; nothing else changes counts.
  A golem's carried stack is part of the save. Test 9.3.6 fuzzes this.
- Spring: one unit per 30 s of work, from jars only (never from the player's pack automatically).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Crosshair lines (T8; `MobManager.describe(id)`, shown by `GameUI.setTargetName`)
Animal (harnessed): `"Goat - harnessed to the treadwheel, fed 6.5 min"` (T6 example); under 60 s: `"Goat - harnessed to the
treadwheel, fed 40 s, hungry soon"`; walking to the wheel: `"Goat - walking to the treadwheel"`; hurt suffix when below max health:
`", 6/8"`. Unharnessed animals keep today's `"Goat - 6/8"`.

Golem (first fact = what it does; then numbers; max ~60 characters):
- `"Clay Golem - not set, wrench it to give it work"`
- `"Clay Golem - listening, wrench a source and targets"`
- `"Clay Golem - fetching from the Depot, fed 22 s"`
- `"Clay Golem - carrying 8 Flour to the Mixer, fed 22 s"` (T6 example)
- `"Clay Golem - cranking the Hand Crank, fed 1.5 min"`
- `"Clay Golem - working the Hand Quern, fed 22 s"`
- `"Clay Golem - waiting: the Mixer is full"`, `"Clay Golem - waiting for items at the Depot"`
- `"Clay Golem - cannot reach the Mixer, path blocked"`
- `"Clay Golem - hungry, needs Spring in a jar within 8 blocks"`
- `"Clay Golem - idle - nothing to carry"`, `"Clay Golem - walking home"`, `"Clay Golem - lost, wrench it to set a new home"`
- damaged suffix `", 14/20"` appended when health < 20 and the line stays <= 64 characters (else dropped).
Time format per T8: `22 s` under 60, `1.5 min` (one decimal) under 60 min. Counts are integers. Names are `ItemSpec.name` /
`BlockSpec.name`, Title Case. A helper `formatFed(s)` lives in `src/mobs/helperText.ts` (pure, tested).

### 6.2 Goggles second line (`inspector.ts` path: Game appends when the player carries Engineer's Goggles and targets a mob)
- Golem: `"Home 12,64,-3, source Depot, 3 targets, x2 for 4.2 min"` (the boost part only while boosted); not set:
  `"Hit it to fold it up and carry it"`.
- Harnessed animal: `"Turns the treadwheel: 12 rpm, 24 su"`.
NEW `MobManager.describeMore(id): string | null` returns this second line; Game shows it under the crosshair name only with goggles
(same mechanism the workshop kinetic line uses; if the HUD has a single name line, Game joins with " | " on desktop and shows only
the first line on narrow portrait - SYSTEMS 1.3 "longer facts go in the screen").

### 6.3 Phone flow (every step is Use / Mine on what you look at; no drag, no long-press, no screen)
1. Harness: select wheat in the hotbar (44 px), look at the treadwheel, tap Use. Feed: look at the goat on the wheel, tap Use. Free
   it: wrench, look at the goat, tap Use.
2. Golem: altar infusion as today. Select the golem item, look at the floor, tap Use. Select the wrench; tap Use on the golem, on the
   depot, on the mixer, on the golem. Every tap answers with a toast naming what was set ("Target 2: Mixer - it will carry").
3. Pick it up: Mine on it (hold Mine; hits repeat on the cooldown).
No new screen: the setup has at most 6 taps and each answer fits a toast (SYSTEMS 1.3: a screen only above three options of a
choice). Toasts are the existing toast component (44 px floors from Unit 3 apply).

### 6.4 Sounds (T9)
| name | set | when | volume | notes |
|---|---|---|---|---|
| `golem_step` | `sfxMagic.ts` | every 1 block a golem walks | 0.3 whisper | dull clay thud: low sine 90 Hz + short noise burst, 60 ms; pitch jitter 0.9-1.1. SYSTEMS T9 lists it under Unit 19 "(17 may use)": Unit 17 ADDS it if Unit 19 has not; whichever merges second keeps one patch |
| `golem_wake` | `sfxMagic.ts` | golem set down, setup start/finish, first task | 0.6 small | rising glassy two-note (Soul): 440 -> 660 Hz triangle with the `scan_chime` shimmer, 0.35 s |
| species call (`goat`, `boar`) | existing | harnessed (pitch 1.1), steps off hungry (0.8) | 1 | reuse |
| `eat` | existing | harness feed | existing | reuse |
| `mob_hurt` | existing | golem hit (pitch 0.7) | existing | reuse |
| crank / station strokes | existing | the crank and stations play their own sounds when worked | existing | no new sound |
Both new names go in the `SfxName` union (`src/core/gameEvents.ts`); `sfx.test.ts` counts `72 + Object.keys(MAGIC_SFX).length`, so
adding them to `MAGIC_SFX` keeps the expression right. Idle golems and harnessed animals make no added loop.

### 6.5 Animation summary
Harnessed: legs at a calm walk in place (`walk` advancing 1.2/s), body pinned, facing along the wheel; the wheel spins as today (the
workshop renderer's `SPIN_KINDS` includes `treadwheel`). Golem: walk cycle with legs; arms rise and fall while working (`flare`),
eyes and chest hub glow with fed state (`glow`), head slumps when hungry, carried item cube between the fists, red hurt flash
(existing), tip-over and fade on death (existing). Nothing teleports that could be seen moving (T9.4): setting down spawns at the
tapped spot, the golem walks everywhere.

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 Types (TypeScript sketches; final names as written here)
```ts
// src/mobs/types.ts (additions)
export type MobState = 'idle' | 'wander' | 'graze' | 'flee' | 'follow' | 'breed' | 'swim' | 'dying' | 'harness';
export interface Mob {
  /* existing ... */
  /** Wheel cell "x,y,z" while walking to or standing on a treadwheel (Unit 17); null otherwise. */
  harness: string | null;
  /** True once on the wheel (false while still walking to it). */
  harnessed: boolean;
  /** Seconds of harness feeding left (only counts while harnessed and loaded). */
  fedS: number;
  /** Seconds on a wheel cell while led there (lead-on settle), and while walking to one (give-up). */
  harnessS: number;
  /** Seconds since it last followed the player, counting down from HARNESS_LED_S (lead-on needs > 0). Not saved. */
  ledS: number;
  /** A clay golem's mind; null for animals and automatons. */
  golem: GolemState | null;
}
export interface SavedMob {
  /* existing ... */
  /** Unit 17: absent = not harnessed. "x,y,z" of the treadwheel. Only saved when harnessed (not while walking to it). */
  harness?: string;
  /** Unit 17: harness feeding left, 0..HARNESS_FEED_S. */
  fedS?: number;
  /** Unit 17: present only for clay golems. */
  golem?: SavedGolem;
}

// src/mobs/golemTypes.ts (NEW)
export type GolemTaskKind = 'crank' | 'carry' | 'work';
export interface GolemTarget { x: number; y: number; z: number; kind: GolemTaskKind; want: string | null }
export type GolemPhase = 'unset' | 'idle' | 'toSource' | 'toTarget' | 'cranking' | 'working' | 'waiting' | 'home' | 'hungry' | 'lost';
export interface GolemState {
  home: [number, number, number];
  src: [number, number, number] | null;
  targets: GolemTarget[];          // <= GOLEM_TARGETS
  rr: number;
  fedS: number;
  boostS: number;
  carry: { item: string; count: number } | null;
  phase: GolemPhase;
  goal: number;                    // index into targets, -1 source, -2 home
  path: number[];                  // flat x,y,z stand cells
  pathI: number;
  timerS: number;                  // time in the current phase (crank/station stay, full wait, retry)
  blockedS: number;
  stepAcc: number;                 // blocks walked since the last golem_step
  note: string;                    // the status fact for describe(), e.g. 'carrying 8 Flour to the Mixer'
  woke: boolean;                   // first task done (flag sent)
  advisedAt: Record<string, number>; // advisory rate limits, not saved
}
export interface SavedGolem {
  home: [number, number, number];
  src: [number, number, number] | null;
  targets: [number, number, number, GolemTaskKind][];
  rr: number;
  fedS: number;
  boostS: number;
  carry: { item: string; count: number } | null;
}
export interface GolemHooks {
  blockKey(x: number, y: number, z: number): string;
  blockName(x: number, y: number, z: number): string;
  targetKind(x: number, y: number, z: number): GolemTaskKind | null;
  locked(x: number, y: number, z: number): boolean;
  groupKey?(x: number, y: number, z: number): string | null;              // Unit 15 vault groups, optional
  peek(x: number, y: number, z: number): { item: string; count: number }[];
  room(x: number, y: number, z: number, item: string, n: number): number;   // logi.accept(..., false)
  offer(x: number, y: number, z: number, item: string, n: number): number;  // workshop.offer
  take(x: number, y: number, z: number, item: string | null, max: number): { item: string; count: number } | null; // workshop.take
  crank(x: number, y: number, z: number): boolean;                           // workshop.crank
  work(x: number, y: number, z: number, item: string | null): 'stroked' | 'inserted' | false; // workshop.act
  feed(x: number, y: number, z: number, radius: number): boolean;           // magic.feedConstruct
  drop(item: string, count: number, x: number, y: number, z: number): void;  // ground.spawn
  stackLimit(item: string): number;
  hot(item: string): boolean;                                                // Unit 4 isHot; golems never carry hot items
  itemName(item: string): string;
}

// src/mobs/manager.ts (public additions)
class MobManager {
  standingOn(x: number, y: number, z: number): boolean;
  harnessTo(x: number, y: number, z: number, item: string, px: number, pz: number): FeedResult;
  useOn(id: number, item: string): UseOnResult | null;
  describeMore(id: number): string | null;
  relocate(map: ReadonlyMap<string, [number, number, number]>): void;
  useGolemHooks(hooks: GolemHooks): void;
  get golems(): GolemLayer;   // configuring(): number | null; wrenchBlock(x,y,z): 'worked' | 'refused'; add(x,y,z,yaw): Mob; carryViews(): readonly CarryView[]
}

// src/workshop/logistics.ts
export interface MachineActAction { item: string; target: [number, number, number]; face: Facing; mode: 'auto' | 'use' | 'strike' | 'place' | 'mine'; bare?: boolean }

// src/player/animals.ts
export interface AnimalTargets { /* existing */ useOn?(id: number, item: string): UseOnResult | null }
```

### 7.2 Sanitising on load (`restoreMobs`, T10 rule 1)
- `harness`: string matching `/^-?\d+,-?\d+,-?\d+$/` and the species qualifies (adult, tame, `size.w >= HARNESS_MIN_W`); else dropped.
  `fedS`: finite, clamped `[0, HARNESS_FEED_S]`; missing with a harness -> `HARNESS_FEED_S` (generous). Restored harnessed animals get
  `state = 'harness'`, `harnessed = true`, position pinned at the first tick. Two animals claiming one wheel: the lower id keeps it.
- `golem`: only kept when `species === 'clay_golem'`; a golem without a valid `golem` record gets a fresh one with `home` = its feet
  cell. `home` 3 integers; `src` null or 3 integers within range of home (else null); `targets` up to 4 entries of 3 integers + a known
  kind, within range (others dropped); `rr` integer mod targets length; `fedS` clamp `[0, 600]`; `boostS` clamp `[0, 300]`; `carry`
  kept only for a known item (`itemOrNull`) with an integer count `1..stackLimit` (a bad carry is dropped - logged as lost is
  acceptable for corrupted data only).
- Unknown extra fields ignored. A mob of species `clay_golem` in a save from a build without Unit 17 cannot exist.

### 7.3 Old saves and existing servants
- Old saves: no `harness`/`fedS`/`golem` fields -> every animal unharnessed, exactly today's behaviour (test 9.3.8).
- `MobsSnapshot.version` stays 1 (all additions optional; no `SAVE_VERSION` bump, T10 rule 3).
- Existing clay servants are blocks owned by `Magic` (`servants` map, `world.persist('magic')`) and are untouched: they keep cranking
  what they touch. A servant ITEM in the pack is the heart of the golem infusion; a placed servant can be mined back to its item
  (existing block drop) and infused. The magic goal "Set a clay servant to work" is unchanged.
- Harness index and golem configuring state are derived / transient (T10 rule 5).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves tests green)

1. **Constants and types.** `src/mobs/constants.ts`: the harness and golem constants of 4.2 (the golem ones exported, `GOLEM_FEED_S`
   imported from nothing - a literal 30 with a comment "= SERVANT_FEED_S in src/magic/magic.ts" to keep `src/mobs` free of magic
   imports). `src/mobs/types.ts`: `Mob` fields, `SavedMob` optional fields, `MobState` `'harness'`, `UseOnResult`. `src/mobs/mob.ts`
   `createMob`: `harness: null, harnessed: false, fedS: 0, harnessS: 0, ledS: 0, golem: null`. NEW `src/mobs/golemTypes.ts`.
2. **Harness core** - NEW `src/mobs/harness.ts` (pure-ish, takes `world` and the mob):
   - `harnessRefusal(m: Mob | undefined): string | null` (species, baby, tame);
   - `wheelBelow(world, m): string | null` (key of a treadwheel under the feet);
   - `wheelTop(key): { x, y, z }`, `freeTop(world, key, h): boolean`;
   - `harnessTick(ctx: HarnessCtx, m: Mob, dt: number): void` (going: steer with the exported brain `steer`; harnessed: feed timer,
     wheel check, pin, walk phase; events through `ctx.toast` / `ctx.sfx` / `ctx.flag`);
   - `stepOffCell(world, key, m): [number, number] | null`.
   `brain.ts`: export `steer` (and `brake`) unchanged; in `think()` nothing changes (the manager never calls `think` for harnessed or
   golem mobs). Lead-on check (`settleCheck`) every 0.25 s in `harness.ts`, called from the manager for tame eligible animals.
3. **Manager wiring for the harness** (`src/mobs/manager.ts`; keep it lean by delegating):
   - private `harnessIndex = new Map<string, number>()`; `standingOn(x, y, z)`; `harnessTo(...)`; `unharness(m, why)`;
   - `mind()`: `if (m.golem) { this.golemLayer.mind(m, dt); return; } if (m.harness) { harnessTick(...); return; }` after
     `advanceTimers`; `move()`: re-pin harnessed mobs after `separate`;
   - `hurt()`: `if (m.harness) this.unharness(m, 'hurt')` first; for golems: no flee (`m.fleeS = 0` after), knockback halved in `hit`;
   - `feed()`: harnessed -> harness feeding branch (4.1.3) instead of eagerness;
   - `remove()`: drop from `harnessIndex`;
   - `load()`: rebuild `harnessIndex` (lower id wins).
   `src/mobs/life.ts` `advanceTimers`: skip healing for golems; golems never age (they are never babies).
4. **Persistence** (`src/mobs/persistence.ts`): write `harness`/`fedS` only for harnessed mobs and `golem` only for golems
   (`saveGolem`), restore with the sanitising of 7.2 (`restoreGolem` in NEW `src/mobs/golemRecords.ts`, like `hostileRecords.ts`).
5. **Game wiring for the harness** (`src/app/game.ts`):
   ```ts
   this.workshop.standingOn = (x, y, z) => playerOnWheel(this.state.player.position, x, y, z) || this.state.mobs.standingOn(x, y, z);
   ```
   (extract today's lambda body as a local `playerOnWheel` helper in game.ts); in `beforeUse`, the treadwheel + liked item route
   (4.3.4) calling `mobs.harnessTo(hit.x, hit.y, hit.z, held.item, p.x, p.z)`: ok -> `player.consumeHeld(1)`, `'worked'`; refused ->
   advisory toast, `'refused'`. `likedByAnimals` is exported from `src/player/animals.ts` already.
   Workshop relocate: where Game learns of contraption moves (the `relocate` host callback already passed in `Workshop`), also call
   `this.state.mobs.relocate(map)` - add an optional `onRelocate?: (map) => void` field on `Workshop` set by Game, invoked at the end
   of `Workshop.relocate(map)`.
6. **Player hands** (`src/player/animals.ts`): `AnimalTargets.useOn?`; in `AnimalHands.use()` before the `likedByAnimals` check:
   ```ts
   const r = held ? this.animals.useOn?.(this.target, held.item) ?? null : null;
   if (r) { if (!r.ok) { this.advisor.advise(`mob:${r.reason.replace(/\d+/g, '')}`, r.reason); return 'refused'; }
            if (r.consume > 0) this.player.consumeHeld(r.consume); if (r.give) this.player.give(r.give.item, r.give.count);
            this.swing.triggerSwing(); return 'fed'; }
   ```
7. **Content: the golem.** NEW `src/content/constructs.ts` (`CONSTRUCT_SPECS = [CLAY_GOLEM]`, model of 4.3.2); `src/core/registry.ts`:
   `CONSTRUCTS`, add to `creaturesByKey`, `validateConstruct`; `src/content/itemsMagic.ts`: `clay_golem` item; `src/content/recipesMagic.ts`:
   the infusion row; icon in `src/render/textures/iconsMagic.ts`; `specRosterMagic.ts`: the new key and infusion count.
8. **Golem path** - NEW `src/mobs/golemPath.ts`: `findPath(world, from: [x, y, z], goal: GoalTest, box: Box, clearance: number,
   cap = GOLEM_PATH_NODES): number[] | null`, `adjacentGoal(tx, ty, tz): GoalTest`, `homeGoal(hx, hy, hz)`, `boxAround(home)`;
   reuse `standCell`, `clearanceOf` (`terrain.ts`). Typed arrays for the visited set (box <= 19 x 19 x 9), no allocation per tick
   beyond the result.
9. **Golem layer** - NEW `src/mobs/golems.ts` (`class GolemLayer`, kept under ~350 lines; text in NEW `src/mobs/helperText.ts`):
   `add(x, y, z, yaw)`, `mind(m, dt)` (the work loop 4.3.5 as a small phase machine), `useOn(m, item)` (the golem rows of 4.4),
   `wrench(m)`, `wrenchBlock(x, y, z)`, `configuring()`, `cancelSetup(why)`, `describe(m)`, `describeMore(m)`, `relocate(map)`,
   `carryViews()`, `deathDrops(m, cause)`; hooks through `useHooks(h: GolemHooks)` (no hooks = golems stand idle, "not set"; tests use
   a fake). Setup timeout and distance checks run in `mind()` of the configuring golem with the player position from the brain
   context. Feeding/boost timers in `mind()`. Footstep sfx via `bus.emit('sfx', { name: 'golem_step', x, y, z, volume: 0.3, pitch })`.
10. **Magic** (`src/magic/magic.ts`): `feedConstruct(x, y, z, radius): boolean` (public, wraps the private `take`); the `golem_walk`
    guard in `startInfusion`. Export `GOLEM_GATE_TEXT`.
11. **Workshop** (`src/workshop/workshop.ts`, `logistics.ts`): `MachineActAction.bare?`; `Workshop.canHold(x, y, z)`; `onRelocate?`.
    `src/sim/handWork.ts` `strokeAsHelper`; `src/sim/simulation.ts` pass-throughs `strokeAsHelper(x, y, z)` and
    `handView(x, y, z)`. Game `actHook` per 4.3.6.
12. **Game wiring for golems** (`src/app/game.ts`): `state.mobs.useGolemHooks({...})` right after the workshop and magic exist,
    mapping each hook to `this.workshop` / `this.workshop.logi` / `this.magic` / `world` / `player.ground` (`targetKind` uses
    `this.workshop.canHold`, `world.getBlock(...).key === 'hand_crank'`, and the NEW `this.state.sim.handView(x, y, z)` -
    `Simulation.hand` is private, so step 11 adds the pass-through); in `beforeUse`: the golem
    wrench route first (4.3.4), then the `clay_golem` set-down (top face, `mobs.golems.add`, consume 1). Crosshair: where Game calls
    `ui.setTargetName(mobs.describe(id))`, append `describeMore` when goggles are carried. Carry cubes into the magic renderer's
    display list each frame from `mobs.golems.carryViews()`.
13. **Unit 16 seam**: in `MobManager.callTame` (if present) add the golem skip line of 2.3 (the harness skip is Unit 16's); if
    `callTame` is not there yet, leave a comment in `harness.ts` naming the contract. `GolemHooks.locked` uses `isLocked` when present.
14. **Sounds**: `golem_step`, `golem_wake` patches in `src/audio/sfxMagic.ts`; names in `SfxName`.
15. **Side goals**: NEW `src/content/objectivesHelpers.ts` exporting `HELPER_SIDE_GOALS` (two `ObjectiveSpec`s, condition `flag`
    `harnessed_animal` / `golem_woke`, titles "Put an animal to work" / "Wake a golem", texts: "Use wheat on a treadwheel with a
    tame goat nearby: it walks the wheel at 12 rpm. Feed it every 10 min." / "Infuse a Clay Golem, wrench it to a source and a
    target, and give it a jar of Spring within 8 blocks.", no item reward or a small one per Unit 0's reward field: 4 `wheat` / 1
    `vial_spring`); concatenated in `src/content/objectivesSide.ts`.
16. **Render** (`src/render/mobs/`): nothing generic needed - `addBatch` builds the golem's mesh from its spec on first sight. Check
    `PART_GROUP` covers `armL`/`armR` (it does for automatons) and that `MobView.glow/flare` reach golems: `views.ts` `fillViews`
    currently fills `glow`/`flare` from `m.hostile`; add a branch: `m.golem ? golemGlow(m) / golemFlare(m, t)` (pure helpers in
    `golems.ts`). Harnessed animals need nothing (walk phase drives legs).
17. **Docs** (section 11).

Helpers to reuse (do not rewrite): `standCell`, `walkable`, `clearanceOf` (terrain.ts), `steer`/`brake` (brain.ts, exported),
`halfWidth`/`bodyHeight`, `yawTowards`, `stackLimit` (game/inventory), `jarsFor` (via `Magic.take`), `formatFed` new but tiny,
`Interaction.advise` semantics via `AnimalHands.advisor`, `voxelFacing`, `itemOrNull`, `creatureOrNull`.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest; co-located; SYSTEMS 6c)

### 9.1 `src/mobs/harness.test.ts` (NEW; fixtures from `herd.test.ts` / `testKit.ts`: a flat world, `MobManager` with
`naturalSpawning: false`, a fake player)
1. "a tame goat harnessed by Use on a treadwheel walks there and counts for standingOn": treadwheel block at (0, 10, 0), tame goat at
   (5.5, 11, 0.5); `harnessTo(0, 10, 0, 'wheat', 6, 0)` -> ok; tick 4 s; `m.harnessed === true`, `standingOn(0, 11, 0) === true`,
   `standingOn(1, 11, 0) === false`.
2. "a hen is refused, a baby is refused, a wild goat is refused" (exact strings of 5.1).
3. "nobody in range" -> `"No tame goat within 12 blocks of the treadwheel"` with the goat at 13 blocks.
4. "a second animal is refused while the wheel is taken" -> `"The treadwheel already has a goat"`.
5. "it steps off hungry after 600 s and toasts once": collect `toast` events; after 540 s one "getting hungry (1 min)"; after 600 s
   `"The goat is hungry and steps off the treadwheel"`, `m.harness === null`, `standingOn` false, the goat stands on a neighbour
   cell within 2 s.
6. "feeding refreshes to 600 s and does not make it eager"; refused at `fedS > 540` with `"The goat is not hungry yet (9.2 min)"`
   pattern `/not hungry yet \(\d+(\.\d)? min\)/`.
7. "lead-on: a tame goat led onto the wheel, then the food put away, is harnessed after 1.5 s; while the player holds wheat it is not; a tame goat that never followed and wanders onto the wheel is not".
8. "breaking the wheel frees it"; "a hit frees it and it flees"; "the crowd push cannot move a harnessed goat" (two goats shoved
   against it for 5 s: x/z unchanged within 1e-6).
9. "frozen column: fedS does not count and standingOn is false while unloaded" (testKit world with an unloaded column toggle).
10. "brain: holding wheat does not pull a harnessed goat off".

### 9.2 `src/mobs/golemPath.test.ts` (NEW)
1. Straight line on flat ground: path length = Manhattan distance + 1.
2. Around a wall: a 5-long wall between golem and goal -> a path that goes round; no waypoint inside the wall.
3. One-block step up and a 2-block drop are walked; a 3-block drop and water are refused (returns null when only those lead there).
4. Lava margin: never a waypoint beside lava.
5. Box: a goal outside `home ± 9` -> null; node cap respected (a maze over the cap returns null, never hangs).
6. Unloaded column is a wall.

### 9.3 `src/mobs/golems.test.ts` (NEW; a fake `GolemHooks` over a map of fake containers - depot with `{ wheat: 20 }`, target with
room 16 - and a fake magic `feed` with a counter of Spring units)
1. "setup like an arm": wrench golem -> listening toast; `wrenchBlock(depot)` -> "Source set: Depot. Now the targets";
   `wrenchBlock(mixer)` -> "Target 1: Mixer - it will carry"; `useOn(id, 'wrench')` -> "Golem set: source Depot, 1 target".
2. Refusals: 9 blocks away -> "Too far from the golem's home (8 blocks)"; `padlock_chest` as source -> "The Padlock Chest is locked - a golem cannot take from it", as a target -> accepted;
   fifth target; duplicate; unknown block.
3. "carries one stack per trip at 2 blocks/s": depot 6 blocks from the target; after one trip the target has 16 (its room), the
   depot 4; with the golem starting beside the depot, the time from the take to the offer is between 6 / 2 = 3 s and 4.5 s (path
   + arrival easing).
4. "elixir doubles the pace": same trip with `useOn(id, 'elixir_swift')` takes < 0.65 x the time; `boostS` 300 then 0 after 300 s;
   cranking output unchanged.
5. "cranks: crank() is called at least once per 1.1 s while at the crank and fed" (hook call log), and "moves on after 30 s when
   another target has work".
6. "conservation fuzz": 200 random seconds with random target fullness, source refills and a target removed mid-carry; total items
   (containers + carried + dropped) constant at every tick.
7. "eats 1 Spring per 30 s of work and none while idle": 95 s of work -> 4 units (one at start, then at 30, 60, 90); 95 s idle with
   nothing to do -> 0.
8. "hungry: stops and keeps its stack; vial of Spring wakes it" (`useOn(id, 'vial_spring')` -> consume 1, give `glass_vial`).
9. "target removed: forgotten with a toast at its next visit"; "target full: waits 5 s then returns the stack to the source".
10. "work target: inserts one at a time, strokes bare, never takes the output" (fake work hook: returns false with `'output'`).
11. "player hit to 0 folds it into the clay_golem item plus its carried stack; lava crumbles it to 4 clay plus the stack" (death
    listener drops).
12. "bandage +6, clay +2, refused at full health".
13. "describe lines" exact strings for each phase of 6.1 (with `formatFed`: 22 -> "22 s", 90 -> "1.5 min").
14. "first task emits the golem_woke flag once".

### 9.4 `src/mobs/persistence.test.ts` (extend)
1. Round trip a harnessed goat (`harness`, `fedS`) and a golem with targets, rr, boost and a carried stack through JSON.
2. Sanitising: bad harness string, `fedS` 9999 -> 600, golem target out of range dropped, carry of an unknown item dropped, a
   harness on a hen dropped.
3. **Old save**: a snapshot without any of the new fields loads; every animal `harness === null`, `golem === null` (T10 rule 1).
4. Two animals claiming one wheel: lower id keeps it.

### 9.5 Other tests
- `src/workshop/parts.test.ts`: existing "a treadwheel turns while something stands on it" stays; add "standingOn from a harnessed
  animal turns the wheel at 12 rpm / 24 su" with `t.shop.standingOn = (x, y, z) => mobs.standingOn(x, y, z)` against a real
  `MobManager` on the fake world (or a stub returning true for the cell - the unit point is the 12/24 numbers).
- `src/workshop/logistics.test.ts`: `canHold` true for depot/basin/vault/crate/mech twin, false for a hand crank and air;
  `act({ bare: true })` never places or breaks (returns false with no hook).
- `src/sim/handWork` test (existing file for hand stations): `strokeAsHelper` refuses with `'output'` and leaves the pack and the
  output untouched; works a loaded quern stroke like `stroke(..., null)`.
- `src/magic/magic.test.ts` (runtime): `feedConstruct` takes 1 Spring from a jar 8 blocks away and from a tubed jar, none from 9;
  the golem infusion is refused without `golem_walk` and starts with it (set the flag on the research state directly).
- `src/player/animals.test.ts` (or the controller test that covers feeding): `useOn` wins over `feed`; `give` reaches the pack.
- Content: `specRosterMagic.ts` lists `clay_golem` (item) and the 5th infusion; `content.test.ts` progression still completes;
  `gates.test.ts` still proves magic optional; registry test: `CONSTRUCTS` has `clay_golem`, not in `CREATURES`, the spawner's
  species list never contains it; icon readability test covers the new icon; `sfx.test.ts` passes with the two new names.
- Side goals: `objectivesSide` test - emitting `flag` `harnessed_animal` completes "Put an animal to work" out of order.
- Render: `mobRenderer.test.ts` builds a batch for `clay_golem` (geometry groups include arms and emissive eyes).

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E steps (real inputs; `window.__hw` only for setup and reading state; `--device=desktop`, no `HW_GPU`; screenshots to
`test-results/e2e-workshop/` and `test-results/e2e-magic/`)

### 10.1 `scripts/e2e-workshop.mjs` - `step('a tame goat walks the treadwheel', ...)`
1. Setup via `window.__hw`: flat pad near the player (the script already builds a crank + millstone line at `P.x0, P.gy, P.z0`);
   place a `treadwheel` joined by a `drive_shaft` to a `mech_millstone`; `state.mobs.add(creature('goat'), spot 4 blocks away)` and set
   `tame = true`; put 4 `wheat` in the hotbar slot 1 and select it; aim the camera at the treadwheel (existing `aimAt` helper of the
   script, or set yaw/pitch through `__hw`).
2. Real input: press Use (mouse right / the script's `use()` helper) once.
3. Wait (poll `__hw`) up to 10 s for the goat's `harnessed === true`; assert `workshop.netAt(wheel)` rpm 12 and the millstone line
   reads "12 rpm" in `workshop.describe(millstone)`; assert the toast "The goat is harnessed to the treadwheel - feed it every 10 min"
   appeared (toast DOM text). Screenshot `goat-on-wheel.png` (the goat stands on the wheel, legs mid-swing).
4. Aim at the goat; assert the crosshair label text starts with "Goat - harnessed to the treadwheel, fed".
5. Set `fedS = 1` through `__hw`, tick 2 s: toast "The goat is hungry and steps off the treadwheel"; rpm 0. Screenshot
   `goat-stepped-off.png`.

### 10.2 `scripts/e2e-magic.mjs` - `step('a clay golem carries from a depot to a depot', ...)`
1. Setup: grant research flag `golem_walk` (set on `magic` research state through `__hw`), give 1 `clay_golem`, 1 `wrench`; build on
   flat ground: depot A with 20 `wheat` at home + (4, 0, 0) and empty depot B at home + (-4, 0, 1) behind a 3-block wall segment (so
   the path must go round); an `essentia_jar` with 8 Spring 3 blocks from home.
2. Real input: select the golem item, aim at the floor cell, Use -> assert a mob of species `clay_golem` exists; toast "Clay Golem set
   down - wrench it, then a source, then up to 4 targets, then it again".
3. Select the wrench; Use on the golem; Use on depot A; Use on depot B; Use on the golem -> toasts in order, last "Golem set: source
   Depot, 1 target". (Aiming at a mob: the script's camera helper targets its centre.)
4. Poll up to 20 s: depot B holds 20 wheat (or 16 then 4 after a second trip - assert total 20 in A + B + carried), the jar lost >= 1
   unit. Screenshot `golem-carrying.png` mid-trip (poll until `golem.carry !== null` and it is between the depots) and `golem-done.png`.
5. Crosshair on the golem while carrying: label matches `/^Clay Golem - carrying \d+ Wheat to the Depot, fed \d+ s$/`.
6. Infusion sub-step (optional if the script already covers infusions): with `golem_walk` unset, put `clay_servant` on the altar and the
   4 pedestal items, Use the rod -> toast "Research \"The Walking Clay\" in your notebook first" (or Unit 18's title).
Run: `node scripts/e2e-workshop.mjs --device=desktop` and `node scripts/e2e-magic.mjs --device=desktop` (also `--device=phonePortrait`
for the toasts only - no new screen, so phone runs are a smoke check that toasts fit at 390 px).

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)
- `docs/api/workshop.md`: Treadwheel line -> "12 rpm / 24 su while `standingOn(x, y+1, z)` (Game: the player, or a harnessed tame
  animal - `MobManager.standingOn`)"; machine interface: `act` `bare?` and golems as callers; `Workshop.canHold`, `onRelocate`.
- `docs/api/mobs.md`: a "Harness (Unit 17)" and a "Clay golems (Unit 17)" section: API additions (`standingOn`, `harnessTo`,
  `useOn`, `describeMore`, `relocate`, `useGolemHooks`, `golems`), saved fields, path finding (golems only; animals still walk
  straight), the "Known gaps" line about path finding updated.
- `docs/api/magic.md`: `clay_golem` infusion, `feedConstruct`, the `golem_walk` guard; "Known limits / next": remove "golems that walk".
- `docs/api/handwork` doc if one lists `HandWork` methods: `strokeAsHelper`.
- Codex: nothing by hand (recipe extraction picks up the infusion); if `scripts/codex/progression.json` needs a node, add it under a
  heading "Unit 17".
- Never `docs/WHATS_LEFT.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist
- [ ] A tame goat or boar Used onto a treadwheel with its liked item walks there and turns the wheel at 12 rpm / 24 su; a hen,
      a baby and a wild animal are refused with the strings of 5.1.
- [ ] Led on with food and left: harnessed within 1.5 s of the food being put away.
- [ ] Unfed for 600 s it steps off with "The goat is hungry and steps off the treadwheel"; one warning at 60 s; feeding refreshes.
- [ ] Wrench frees it; a broken wheel frees it; a hit frees it; the horn (Unit 16) does not pull it off.
- [ ] Crosshair: "Goat - harnessed to the treadwheel, fed 6.5 min" style.
- [ ] `clay_golem` infusion exists, is refused without `golem_walk`, works with it; the golem item sets down on open ground.
- [ ] Wrench setup: golem, source, up to 4 targets within 8 blocks, golem; every refusal string of 5.2; a padlock chest refused as source, accepted as target.
- [ ] A golem carries one stack per trip at 2 blocks/s round a wall; cranks a hand crank (network shows 16 rpm / 8 su); works a
      loaded hand quern without ever taking its output.
- [ ] 1 Spring per 30 s of work from a jar within 8 blocks or tubed; none while idle; hungry status and recovery with a vial.
- [ ] Elixir: x2 walk and stroke rate for 300 s, crank unchanged; bandage +6, clay +2.
- [ ] Player hits fold it into the item (+ carried stack); lava crumbles it (4 clay + stack).
- [ ] Save/load mid-carry keeps the stack and settings; old saves load with no harness/golem; harness index rebuilt.
- [ ] Items conserved (fuzz test); no new screen; every toast/line fits ~60 characters at 390 px.
- [ ] Side goals "Put an animal to work" and "Wake a golem" complete from flags.
- [ ] Sounds `golem_step` (0.3) and `golem_wake` (0.6) only while things happen; `sfx.test.ts` green.
- [ ] `npx vitest run` green (incl. content, gates, progression), `npm run typecheck`/lint clean, e2e steps 10.1/10.2 pass on desktop.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope
- Path finding for ordinary animals (they still wander in straight lines).
- Golems pulling levers (`signal`), mining, placing blocks, fighting, following the player, riding skiffs, or taking from hand-station
  outputs. (`signal` stays available for a later unit; the deployer covers placing/mining.)
- More golem tiers (iron golem), golem programming beyond 4 targets, a setup screen.
- Harnessing to anything but the treadwheel (no ploughs, carts, water wheels); species-specific wheel output.
- Animal hunger outside the harness (animals in the field never starve).
- Changes to clay servants (they stay blocks that crank what they touch).
- Multiplayer considerations.

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator
1. **Unit 16 seam (horn):** Unit 16's `callTame` already skips `harness` defensively; Unit 17 adds `if (m.golem) continue;`.
   Padlock: golems may fill but never empty a padlock chest (Unit 16 rule), so it is refused only as a golem SOURCE. Unit 16's padlock is detected by block key `padlock_chest`; if 16 adds a per-chest
   lock toggle, expose `logi.isLocked?(x, y, z)` and Unit 17's `locked` hook uses it.
2. **Unit 18 seam (gate):** aligned with UNIT-18: entry `golem_walk` "The Walking Clay", `unlocks.gates: ['clay_golem']`, flag
   `golem_walk`. Unit 17's infusion id must be exactly `clay_golem`; its pre-merge guard text equals Unit 18's gate message.
3. **Unit 19 seam (sound):** `golem_step` is listed under Unit 19 in SYSTEMS T9 ("17 may use"); Unit 17 adds it with `golem_wake`
   in `sfxMagic.ts`. If 19 lands first with `golem_step`, 17 keeps 19's patch.
4. **Unit 15 seam (vaults):** optional `logi.groupKey?(x, y, z)` lets golem setup dedupe a group; without it everything still works.
5. **Unit 13 seam (moving wheels):** Unit 17 adds `Workshop.onRelocate?` (called at the end of `Workshop.relocate`) so mobs follow
   moved wheels/targets. If Unit 13 already adds a relocate listener, reuse it.
5b. **Unit 4 / 13 seams:** golems skip hot items (Unit 4 `isHot`, via the `hot` hook); mobs are not riders of Unit 13's
   `PlayerPhysics.platform` - harnessed animals follow their wheel through `MobManager.relocate`.
6. **Unit 10 seam:** bandage and `elixir_*` are read by key; nothing breaks before Unit 10. Elixirs are assumed to be in glass vials
   (the vial is given back).
7. **New registry list `CONSTRUCTS`** (beside `AUTOMATONS`) and `validateConstruct`: small edit to `src/core/registry.ts`, which
   other units may also touch (append-only).
8. **SYSTEMS.md deltas to merge** (argued here): T6 golem targets classified as crank / carry / work with the first carry block as the
   source and an optional source; golem infusion pedestals `2 clay, 1 bronze_cog, 1 leather`, 30 s; `GOLEM_ELIXIR_S` 300 does not
   change crank output; picking a golem up = hitting it to 0 HP (folds, no loss); clay patches a golem +2 HP besides the bandage.
9. **manager.ts size:** already 499 lines; the plan delegates to `harness.ts`, `golems.ts`, `golemPath.ts`, `golemRecords.ts`,
   `helperText.ts` so manager.ts grows by ~60 lines of wiring.
10. Owner open question SYSTEMS 8.2 ("golems and automation") is assumed "yes" as defaulted there.
