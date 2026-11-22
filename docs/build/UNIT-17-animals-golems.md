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

Ids this unit READS: `golem_walk` research flag/entry (Unit 18), `padlock_chest` block key and the lock rule in `logi.take`
(Unit 16), `MobManager.call` (Unit 16; Unit 17 adds one skip line), vault groups behind `logi.accept/take` (Unit 15), `bandage`
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
from a jar within its range. It ignores padlocked chests. It is slow (2 blocks/s), it is visible, and you can see exactly what it is
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

### 2.3 Unit 16 - brass horn and padlock chest
- **Horn.** Unit 16 owns `MobManager.call(x, y, z, radius, seconds)` (tame animals within 32 blocks follow for 20 s). Contract:
  `call` SKIPS mobs with `harness !== null` and every golem (`m.golem !== null`). A harnessed goat does not abandon its wheel when
  you blow the horn; a golem is not an animal. Whichever unit merges second adds the line
  `if (m.harness !== null || m.golem !== null) continue;` at the top of `call`'s loop. Unit 17 owns harness behaviour; the
  horn is the way back to the wheel for a goat that stepped off hungry and wandered (J4 step 2).
- **Padlock chest.** Unit 16 makes `logi.take` refuse a locked container for every caller except the player's own hand. Unit 17
  adds the golem side: (a) the wrench setup REFUSES a `padlock_chest` as source or target ("A padlocked chest keeps golems out");
  (b) at run time a source or target whose block key has become `padlock_chest` is SKIPPED (status "skipping the padlocked chest")
  and never offered to or taken from, even though `offer` would technically accept. Detection is the block key through
  `GolemHooks.locked(x, y, z)` = `blockKey === 'padlock_chest'`; if Unit 16 exposes a richer `logi.isLocked?(x, y, z)`, Game uses it
  instead (one line in the hook).

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

### 2.6 Unit 10 - bandage and elixirs; Unit 18 - research
- Use a `bandage` on a damaged golem: +6 HP at once (the golem is clay; no heal-over-time slot on a mob). Use any item whose key
  starts with `elixir_` and that exists in the registry: the golem works twice as fast for `GOLEM_ELIXIR_S` 300 s (T4 row "golems fed an
  elixir work 2x for 5 min"). Both read item keys only; if Unit 10 has not merged, those Uses simply never happen. Clay (`clay`, an
  Ember block item that already exists) also patches a golem: +2 HP. So repair never depends on Unit 10.
- `golem_walk` (Unit 18) gates the infusion: Unit 18's entry lists `unlocks: { recipes: ['clay_golem'], flags: ['golem_walk'] }`,
  so the existing `RESEARCH_GATES` / `craftGateReason` path refuses the infusion in `startInfusion` until it is researched. Before
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
   becomes harnessed when it is NOT currently following (the player is not holding a liked item within range) - i.e. you led it
   with wheat, then put the wheat away (or walked off out of follow range). `fedS = HARNESS_FEED_S` on harnessing this way too
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
- Walking in place: when the wheel is actually turning (`ctx.wheelTurning(x, y, z)` - NOT needed; simpler and always true while
  harnessed and fed) its leg phase advances: `m.walk += HARNESS_STRIDE * dt` (1.2 blocks/s), `m.speed = 1.2`, so the renderer swings
  legs at a calm walk while the body stays put. Head bob comes free with the walk phase.
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
- Gate: Unit 18's `golem_walk` entry unlocks `recipes: ['clay_golem']`. Unit 17's guard in `Magic.startInfusion`, right after the
  existing `craftGate` check: `if (r.id === 'clay_golem' && !hasFlag(this.research, 'golem_walk')) { this.advise(GOLEM_GATE_TEXT);
  return 'refused'; }` with `GOLEM_GATE_TEXT = 'Research "The Walking Golem" in your notebook first'` (if Unit 18's entry title differs,
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
   - `'work'`: a hand station (`sim.hand.view(x, y, z) !== null`: chopping block, quern, stone anvil, mortar, clay table, loom,
     drying rack, trough).
   - `null`: refused "A golem cannot work that - pick a crank, a container or a hand station".
   Order rule: the FIRST wrenched `'carry'` block becomes the SOURCE ("Source set: Depot. Now the targets"); every later block, and
   any crank or station, becomes the next target ("Target 1: Hand Crank - it will crank", "Target 2: Mixer - it will carry",
   "Target 3: Hand Quern - it will work it"). A `'carry'` block wrenched after the source is a carry target. A golem may have no
   source (a crank-only or work-only golem). To make a station or crank the "first" thing and still have a source, wrench the source
   first.
   Refusals (toast, setup continues): "Too far from the golem's home (8 blocks)"; "A padlocked chest keeps golems out";
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
carry targets in order (walking to each), then walk back and `offer` it to the source; if even the source refuses, drop it as a
ground item at the golem's feet through the death-drop style `bus` path is NOT used - instead `hooks.drop(item, count, x, y, z)`
(Game: `player.ground.spawn`). Items never vanish.
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
