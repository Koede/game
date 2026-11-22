# Unit 16 - Trinkets and punch cards (build spec)

Status: design spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (the binding shared design). Where this file and
SYSTEMS.md disagree, SYSTEMS.md wins; section 14 lists the three places this spec asks the coordinator to amend it.

**Threads:** T2 (punch cards are the `sequence_gearshift`'s program source; no new kinetic rule, `BASE_STRESS.sequence_gearshift`
stays 1), T4 (eight new items, all end products/tools except the blank card, which has one consumer by design - see 4.7), T6
(`MobManager.callTame` for the brass horn; the `padlock_chest` take rule in `Logistics.take`/`peek` and the item-pipe endpoint),
T8 (wind vane, weather cock, padlock chest, lantern and gearshift card lines; spyglass range line), T9 (`horn_call`,
`vane_creak`, `card_punch` in a new `src/audio/sfxWorkshop.ts`), T10 (optional `WorkshopSnapshot.cards`; nothing else saved).
Also touches T7 (side goal `read_the_wind`, gated bronze like every trinket) and J4 / J5 of section 6b.

Legend for this document: **NEW** = does not exist in the code today and is created by this unit. Everything not marked NEW was
grepped in the tree on 2026-11-22 (see section 14 for the verification list).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

The Bronze workshop is a place of shafts and cogs; this unit gives it its *instruments*. Six small brass-and-glass things that a
tinkerer would hang around a yard, each one cheap (SYSTEMS 5.3: "Trinkets are CHEAP (<= 2 ingots); they exist for delight and
information") and each one with a job that connects to a system that already exists:

| trinket | what it is for | the system it reaches |
|---|---|---|
| Wind Vane | tells you where the wind comes from, how strong it is, and what a wind turbine would make on this very spot | sim wind (`windAt`, `Simulation.wind`), the wind turbine's altitude rule |
| Weather Cock | the same arrow on a roof, but it *signals*: on while it rains and for 2 min before rain is due | weather timetable (`WeatherState.next/nextInS`), the signal layer, pistons, bells - journey J5 |
| Spyglass | zoom x4 and name what you look at up to 96 blocks away, with the distance | the camera (`PlayerController.sprintFov`), the crosshair name |
| Brass Horn | calls your tame animals within 32 blocks to follow you for 20 s | mobs (`brain.ts` follow step), the treadwheel and harness (Unit 17) - journey J4 |
| Padlock Chest | a 27-slot crate that machines, pipes and golems may fill but never empty | workshop logistics, item pipes, golems (Unit 17) |
| Lantern Chain | a lantern hung on a chain from a ceiling; lights 14; a signal can switch it | lighting (`BlockSpec.lightActive`), the signal layer |

And the gearshift's *punch cards*: the `sequence_gearshift` today cycles three fixed programs with Use. Cards make its program a
thing you hold. Three preset cards (Pulse, Swing, Ladder - exactly today's three programs) travel between gearshifts as items;
a blank card slid into a gearshift opens a small editor where you punch your own loop of up to 8 steps (forward, reverse, half,
double, stop; 1-8 s each). It is the closest the workshop gets to programming, and it stays a drum and holes, not a computer.

The fantasy: you stand on the roof of your Bronze-age yard at dusk. The vane creaks round to the west, "fresh (0.6), turbine
680 W" - so the turbine goes up on the ridge, not in the hollow. The weather cock clicks on: rain in about 2 minutes. Down below,
signal wire carries it to a piston that slides a framed roof over the drying racks, and the bell rings once. You raise the
spyglass and see the goat grazing far down the valley - "Goat - 41 blocks". One blast of the horn and it trots up the hill
behind you, onto the treadwheel. Inside, the mixer runs on a card you punched yourself: double for 4 s, stop for 1, reverse for
2. The chest by the door has a padlock: the arm that feeds the furnace can drop ingots into it, but it cannot take your diamonds
out.

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 What this unit DEFINES (SYSTEMS 6.2 row "trinkets, padlock_chest lock rule in logi.take, punch cards, MobManager.call,
windDirAt | 16")

| id / API | kind | file | consumers |
|---|---|---|---|
| `wind_vane`, `weather_cock` | blocks (PART_DEFS rows, NON_KINETIC) | `src/content/itemsWorkshopParts.ts` | J5 (Unit 2 rack story), Unit 19 none |
| `padlock_chest`, `lantern_chain` | blocks | `src/content/itemsTrinkets.ts` **NEW** | Unit 17 golems (skip padlocks as a source), Unit 15 none |
| `spyglass`, `brass_horn` | held items (tools, stack 1) | `src/content/itemsTrinkets.ts` **NEW** | - |
| `punch_card`, `punch_card_pulse`, `punch_card_swing`, `punch_card_ladder` | items (stack 16) | `src/content/itemsTrinkets.ts` **NEW** | the gearshift (this unit) |
| `windDirAt(timeS: number): number` | pure function | `src/sim/machines.ts` (next to `windAt`) **NEW** | wind vane, weather cock, `WeatherFx.windAngle` (rain slant) |
| `turbineWattsAt(spec, y, wind): number` | pure function | `src/sim/machines.ts` **NEW** (the `windTurbine` behaviour is refactored to call it) | wind vane line |
| `isLocked(world, x, y, z): boolean` | pure helper (block key `padlock_chest`) | `src/workshop/trinkets.ts` **NEW** | `Logistics.take/peek`, arm/golem wrench setup, `src/sim/endpoints.ts` |
| `MobManager.callTame(x, y, z, radius, seconds): number` | method | `src/mobs/manager.ts` **NEW** | brass horn; Unit 17 must make harnessed mobs ignore it (one-line check, see 2.3) |
| `Mob.calledS?: number` | transient field (not saved) | `src/mobs/types.ts` **NEW** | `brain.ts` step 4 |
| `KPart.prog?` + `stepsFactor(steps, t)` | kinetics | `src/workshop/kinetics.ts` **NEW** members | gearshift |
| `WorkshopSnapshot.cards?` | optional save field | `src/workshop/workshop.ts` **NEW** | - |
| `WorkshopView.vanes?: VaneView[]` | optional view member (SYSTEMS 6.5 allows an OPTIONAL member) | `src/workshop/workshop.ts` **NEW** | `src/render/workshop/` renderer |
| `ScreenRequest { type: 'gearshift'; x; y; z }` | screen | `src/core/gameEvents.ts` **NEW** member | `src/ui/screens/workshop/cardScreen.ts` **NEW** |
| sfx `horn_call`, `vane_creak`, `card_punch` | sounds | `src/audio/sfxWorkshop.ts` **NEW** (shared with Units 13/14) | - |
| side goal `read_the_wind` | side objective | `WORKSHOP_SIDE_GOALS` in `src/content/objectivesWorkshop.ts` **NEW** export | Unit 0's `SIDE_OBJECTIVES` |

### 2.2 What this unit READS from others

- **Unit 0**: `SIDE_OBJECTIVES` mechanism (`src/content/objectivesSide.ts`) - this unit appends `...WORKSHOP_SIDE_GOALS`. If Unit
  0 has not merged when this unit builds, the export still exists and is wired in the merge (flag/side goals are plain data).
- **Unit 0**: `WorkshopView.moving` (empty by default); this unit adds `vanes?` beside it and never touches `moving`.
- **Unit 2**: the drying rack needs open sky (glass is a roof). Not required for this unit to work; it makes J5 meaningful.
- **Unit 4**: crates and machines refuse hot items (ladles, hot blooms). The padlock chest IS a crate entity (`machine: 'crate'`),
  so it inherits that refusal with no code here. Do not add a second hot-item check.
- **Unit 13**: the piston tween in J5 - not required; the roof simply moves in steps until 13 lands.
- **Unit 17**: harness (`Mob.harness?`). This unit's `callTame` must skip harnessed mobs; since 17 may land after 16, the skip is
  written defensively: `if ((m as { harness?: string }).harness) continue;` with a comment `// Unit 17: harnessed animals stay`.
- Existing: `windAt` (`src/sim/machines.ts`), `Simulation.wind`, `WeatherState` (`next`, `nextInS`, `kind`), `wetAt` and
  `openSkyAbove` (`src/game/weather.ts`), `Signals` (`src/workshop/signals.ts`), `GEARSHIFT_PROGRAMS`/`gearshiftFactor`/`passOn`
  (`src/workshop/kinetics.ts`), `Workshop.use/describe/setting/toJSON/load/relocate` (`src/workshop/workshop.ts`),
  `Logistics.take/peek/wrench` (`src/workshop/logistics.ts`), crate machine (`src/content/tech.ts`, `blocks: ['crate']`),
  `createCrateScreen` (`src/ui/screens/machines/machineScreen.ts`), `PlayerController.sprintFov` (`src/player/controller.ts`
  line ~262), `Collectors.trigger` pattern (`src/game/collectors.ts`), `brain.ts` step 4 follow, `MOB_FOLLOW_RANGE` 10.

### 2.3 Contracts other units must honour (coordinator: copy into their specs if missing)

1. **Unit 17 (golems)**: a golem's wrench setup refuses a `padlock_chest` as its SOURCE with the toast
   `"The Padlock Chest is locked - a golem cannot take from it"`; as a TARGET it is allowed (machines may put things in). Golem
   carrying uses `Workshop.take`, which already refuses locked cells after this unit, so even a golem set up before the chest was
   swapped in gets nothing. SYSTEMS T6 says "Padlocked chests are skipped" - this spec reads that as "skipped as a source".
2. **Unit 17 (harness)**: `callTame` skips mobs with `harness` set (they stay on the wheel). 17 adds nothing for the horn.
3. **Unit 15 (vault groups)**: unaffected; vaults are not lockable.
4. **Units 13/14**: `src/audio/sfxWorkshop.ts` is shared. Whoever lands first creates it with `export const WORKSHOP_SFX` and adds
   it to `sfx.ts` and the `sfx.test.ts` count `72 + MAGIC + DISTILL + WORKSHOP`; later units append keys.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (verified 2026-11-22)

- **Gearshift.** `src/workshop/kinetics.ts`:
  `GEARSHIFT_PROGRAMS = [[[4, 1], [2, 0]], [[3, 1], [1, 0], [3, -1], [1, 0]], [[2, 1], [2, 2], [2, 0.5], [2, 0]]]`
  ("a loop of [seconds, factor] steps (factor 0 = disengaged, -1 = reversed)"); `gearshiftFactor(program, t)` walks the loop on
  world seconds; `passOn` case `'sequence_gearshift'` returns `null` when the factor is 0, else `rpm * f`. `KPart` is
  `{ kind: string; s: number }`. `BASE_STRESS.sequence_gearshift = 1`.
  `src/workshop/workshop.ts`: `CYCLES.sequence_gearshift = GEARSHIFT_PROGRAMS.length` (Use with an empty hand / non-block cycles
  `part.s`); `setting()` returns `` `Gearshift program ${p.s + 1} of ${GEARSHIFT_PROGRAMS.length}` ``; parts are saved as
  `[x, y, z, kind, s?]` in `WorkshopSnapshot.parts`, `s` validated against `CYCLES[kind]`. The part description (PART_DEFS):
  `'A drum that engages, reverses and changes speed on a loop. Use it to pick one of three programs.'` Recipe:
  `forge('sequence_gearshift', '3 bronze_cog, 1 bronze_plate, 1 clockwork_motor', 700)`.
- **Signals.** `src/workshop/signals.ts`: `SIGNAL_KINDS` (6 kinds), private `SOURCES = crank_lever, pressure_plate, metronome`,
  `SIGNAL_RANGE` 15, `METRONOME_PERIOD_S` 4, `BELL_RANGE` 12. `Signals.tick(t)` seeds sources at strength 15; wire loses one per
  block; `gate(x,y,z)` = "true when allowed to work; a machine touching no signal cell is always allowed"; `describe` returns
  `"<Name> - on|off"` etc.; `toJSON` rows `[x, y, z, kind, s]`.
- **Clockface pattern.** `Workshop.clockText: (() => string) | null`, set by `Game` (`src/app/game.ts` ~176); `describe` returns
  `` `Clockface - ${this.clockText?.() ?? 'no sun to read'}` ``. Trinket readers follow exactly this hook pattern.
- **Crosshair.** `Game.showStationName` (`src/app/game.ts` ~432): hand stations, then magic labels, then
  `inspect(this.inspectProbe, ...)` ONLY when `inventory.has(GOGGLES)`, else kinetic parts show their bare name.
- **Wind.** `windAt(timeS, min, max)` in `src/sim/machines.ts`: `0.5 + 0.3 sin(t/97) + 0.2 sin(t/41 + 1.3)` scaled to
  `[min, max]` (turbine params `windMin 0.25`, `windMax 1`); `Simulation.wind = windAt(worldTimeS, ...) * weather.wind`
  (`WEATHER_WIND.storm` 1.5). Turbine watts = `outputW (1500) * ctx.wind * clamp((y - 40) / 40, 0.25, 1)`, zero without
  `openSky`. There is **no wind direction** in the sim; the renderer's `WeatherFx.windAngle = 0.7 + 0.6 * sin(time / 180)` runs on
  render time (not world time, not saved, not deterministic).
- **Weather.** `WeatherState { kind, previous, blend, precipitation, intensity, cloudCover, moonPhase, next, nextInS }`;
  `wetAt(w, biome, y)` and `openSkyAbove(world, x, y, z)` in `src/game/weather.ts`; segments last `WEATHER_MIN_S` 240 to
  `WEATHER_MAX_S` 720 s. The Hearth Log forecast says "Rain within the hour" (`forecast()` in `src/ui/hud/weatherText.ts`).
- **FOV.** `PlayerController.sprintFov(dt, sprinting)`: `target = settings.fov + (sprinting ? SPRINT_FOV_KICK : 0)`, eased with
  `1 - exp(-8 dt)`, `view.setFov(next)` only on change. `SPRINT_FOV_KICK` 8.
- **Held-item Use.** `controller.update`: `if (intent.use && p.collectors.trigger()) intent.use = false;` - the pattern for a held
  tool that acts instead of the world. `intent.use` is true on press and again every `USE_REPEAT_S` 0.25 s while held.
- **Mobs.** `MobManager` has `feed`, `describe`, `tick`; a PRIVATE method `call(m, dt, player)` already exists (it plays the
  animal's own voice). Hence the horn method is named **`callTame`**, not `call` (SYSTEMS T6 text says `call`; see 14).
  `brain.ts` step 4: "The player holds something it likes: follow to a polite distance", gated by `MOB_FOLLOW_RANGE` (10) and
  `|dy| < 6`.
- **Crate.** Block `crate` (`machine: 'crate'`, 27 slots `CRATE_SIZE`), machine spec in `src/content/tech.ts`
  (`blocks: ['crate']`, role `'crate'`); `Logistics.crateAt` recognises `e.kind === 'crate'`; `cratesNear` feeds stations;
  `machineItemEndpoint` in `src/sim/endpoints.ts` gives a crate `slotEndpoint(e, inv, 0, size, 0, size)` (pipes in and out). The
  registry check "machine X: block Y does not point back to it" means a second block may list `machine: 'crate'` if the crate
  spec's `blocks` lists it too.
- **Lights.** `torch` light 13 warmth 2 shape `'torch'`; `magic_light` (Floating Light) light 14; `BlockSpec.lightActive` exists.
- **Nothing** of this unit exists: no trinket key, no card key, no `windDirAt`, no `sfxWorkshop.ts`, no `'gearshift'` screen.
