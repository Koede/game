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

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

Common facts for every item below: age `ageIndexOf('bronze')` (SYSTEMS T7 gating table: "punch cards, trinkets" are bronze); forge
recipes use the existing `forge(output, inputs, minTempC)` helper of `src/content/recipesWorkshop.ts` (station `furnace`, `kind:
'forge'`, `minTier: 1` with `// W0: 2`, `age: 0` as every other workshop recipe there today - the helper hard-codes it; leave it);
bench recipes use the existing `bench(id, output, inputs)` helper. All costs are <= 2 ingot-equivalents (SYSTEMS 5.3).

### 4.1 Wind Vane - `wind_vane`

| field | value |
|---|---|
| kind | block, a `PART_DEFS` row with `anim: false`, listed in `NON_KINETIC` (so it shows in the Workshop Guide's Parts tab) |
| display name | `Wind Vane` |
| desc (tooltip) | `A brass arrow on a pin. It points where the wind blows from and says how strong it is, and what a wind turbine would make right here.` |
| stack | 16 (every PART_BLOCKS row has `stack: 16`) |
| recipe | `forge('wind_vane', '1 bronze_ingot, 1 copper_ingot, 1 stick', 600)` |
| needs | open sky above it (`openSkyAbove(world, x, y, z)`), like the turbine it advises on |

**Wind direction (NEW, deterministic, shared).** `windDirAt(timeS)` in `src/sim/machines.ts` returns the bearing the wind blows
**from**, radians, clockwise from north (north = -z, east = +x, matching `FACE_VEC`), normalised to `[0, 2pi)`:

```ts
/** Seconds for the prevailing wind to turn once round the compass (6 game days). */
export const WIND_TURN_S = 5400;            // NEW
/** Bearing (radians, clockwise from north = -z) the wind blows FROM at a world time: a slow veer plus a wobble. */
export function windDirAt(timeS: number): number {   // NEW
  const a = 4.4 + (2 * Math.PI * timeS) / WIND_TURN_S + 0.9 * Math.sin(timeS / 233) + 0.25 * Math.sin(timeS / 61 + 0.7);
  return ((a % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
}
```

Reasoning: the start bearing 4.4 rad (about west, 252 deg) makes a new world's first day read "from the west" (the SYSTEMS T8 example
line); a full turn over six days means the vane visibly moves while you watch for a minute (the 233 s wobble is ~0.9 rad, i.e.
a sector change every couple of minutes) yet the prevailing wind is stable for a building session. It is pure on world time, so
it is identical after load and the same for the renderer. No seed term: wind is weather and the weather timetable already
differs per seed; a seed phase can be added later without breaking anything.

**Rain slant follows the vane.** `WeatherFx.update(dt, w, windFrom?: number)` (`src/render/weatherFx.ts`) gains an optional third
argument; when given, `this.windAngle` = the bearing the wind blows TOWARDS converted into the renderer's convention (the builder
reads how `precipitation.ts` uses `windAngle` and writes the conversion as a named helper `towardsAngle(windFrom)` with a unit test
that the slant direction vector equals `(-sin windFrom, +cos windFrom)` in x/z - i.e. away from the source). `Renderer` passes
`windDirAt(clock.worldTimeS)`. When absent (tests, old callers) the old render-time wobble stays.

**Strength.** The vane reads `Simulation.wind` (already `windAt * WEATHER_WIND`): range 0.25 .. 1.5. Words (NEW `WIND_WORDS` in
`src/workshop/trinketText.ts`):

| wind value w | word |
|---|---|
| w < 0.35 | `calm` |
| 0.35 <= w < 0.55 | `light` |
| 0.55 <= w < 0.8 | `fresh` |
| 0.8 <= w <= 1.0 | `strong` |
| w > 1.0 | `gale` (only in storms) |

The number in brackets is `w` rounded to 0.1 (`fresh (0.6)`).

**Compass names** (NEW `compassWord(bearing)`): 8 sectors of 45 deg centred on the points: `north`, `north-east`, `east`,
`south-east`, `south`, `south-west`, `west`, `north-west`.

**Turbine estimate.** NEW `turbineWattsAt(spec: MachineSpec, y: number, wind: number): number` =
`(spec.outputW ?? 0) * wind * clamp((y - p.altitudeBaseY) / p.altitudeSpanY, p.altitudeMin, p.altitudeMax)` - the exact
expression the `windTurbine` behaviour uses today; refactor `windTurbine` to call it (behaviour unchanged, `power.test.ts` stays
green). The vane evaluates it for a turbine standing ON the vane's cell (`y` = vane y), rounded to the nearest 10 W.

**Line (T8):**
- open sky: `Wind Vane - wind from the west, fresh (0.6), turbine 680 W` (57 chars). The turbine fact is `wattsText(W)`: below
  1000 W rounded to 10 W (`680 W`), at or above 1000 W in kW with one decimal (`1.5 kW`). The longest possible line,
  `Wind Vane - wind from the north-west, strong (1.0), turbine 1.5 kW`, is 66 characters - accepted (SYSTEMS 1.3 says "about 60";
  the HUD name line wraps to two lines on narrow portrait, which `setTargetName` already allows).
- under anything solid: `Wind Vane - sheltered, no wind reaches it` (no direction, no estimate; the arrow stands still).

**Read without goggles.** The vane and the weather cock ARE instruments: their line shows in the crosshair for everyone, goggles or
not (unlike the clockface, which stays a goggles reading). See 8, step 9.

**Animation (T9 rule 4).** The arrow is not a block face: the workshop renderer draws a small arrow mesh on top of the block
(reuse the cog-on-top mesh approach of `SPIN_KINDS` in `src/render/workshop/`). Workshop exposes NEW
`WorkshopView.vanes?: VaneView[]`, `interface VaneView { x: number; y: number; z: number; kind: 'wind_vane' | 'weather_cock';
from: number; strength: number; sheltered: boolean }`. The renderer keeps a per-vane displayed angle and eases it toward `from`
(shortest way round) with `1 - exp(-1.5 dt)` plus a flutter of `0.06 * strength * sin(7 t + x)` rad; sheltered vanes do not
move. No allocation per frame (reuse the view objects; T9/6d).

**Sound.** `vane_creak` (whisper 0.3, pitch 0.9-1.1 random) when a vane's displayed 8-point sector changes, at most once per
`VANE_CREAK_MIN_S` 6 s per vane, positioned (only heard within `HEARING_RANGE` 24 anyway). Emitted from `Trinkets.tick` (sim side,
deterministic), not from the renderer.

**Side goal.** Placing the first wind vane completes `read_the_wind` "Read the wind": text
`A Wind Vane on open ground says where the wind comes from and what a turbine would make there. Put one up on high ground.`
(condition `{ type: 'place', block: 'wind_vane', count: 1 }`). SYSTEMS T7 lists it.

### 4.2 Weather Cock - `weather_cock`

| field | value |
|---|---|
| kind | block, `PART_DEFS` row `anim: true` (front `ws_weather_cock_front` / `_on`: the comb glows amber while signalling), `NON_KINETIC`, AND a signal SOURCE (added to `SIGNAL_KINDS` and to the private `SOURCES` set in `signals.ts`) |
| display name | `Weather Cock` |
| desc | `A brass cockerel that feels the weather coming. It signals while rain falls and for two minutes before rain is due: wire it to a piston to close a roof, or to a bell.` |
| stack | 16 |
| recipe | `forge('weather_cock', '1 bronze_plate, 1 copper_ingot, 1 stick', 600)` |
| needs | open sky above (`openSkyAbove`), else it never signals |

**Signal rule.** Constants NEW in `src/workshop/trinkets.ts`:
`WEATHER_COCK_LEAD_S = 120` (signal on this long before rain is due), `WEATHER_COCK_HOLD_S = 30` (stays on this long after the
rain has stopped, so a piston roof does not flap during the 8-90 s blend of a change).

Pure function NEW in `src/workshop/trinketText.ts` (no world, testable):

```ts
export interface CockInput {
  /** The weather now (the live WeatherState). */ w: WeatherState;
  /** Rain or snow soaks this cell now: wetAt(w, biomeAt(x, z), y). */ wetHere: boolean;
  /** Rain or snow would soak this cell in the coming state: wetAt({ ...w, kind: w.next, previous: w.next, blend: 1 }, biome, y). */ wetNext: boolean;
  /** Nothing solid above. */ sky: boolean;
  /** Seconds of hold left (from Trinkets). */ holdS: number;
}
export interface CockReading { on: boolean; text: string }
export function cockReading(c: CockInput): CockReading;
```

| situation (evaluated in this order) | `on` | line |
|---|---|---|
| `!sky` | false | `Weather Cock - under a roof, it cannot feel the sky` |
| `wetHere` and kind is `storm` | true | `Weather Cock - storm, signal on` |
| `wetHere` | true | `Weather Cock - raining, signal on`; `Weather Cock - snowing, signal on` when `CockInput.snow` (see below) |
| `wetNext && w.nextInS <= WEATHER_COCK_LEAD_S` | true | `Weather Cock - rain in about 2 min, signal on` (`< 60 s`: `rain in under a minute, signal on`; storm next: `storm in about 2 min, signal on`) |
| `holdS > 0` | true | `Weather Cock - clearing, signal off in 25 s` |
| `wetNext` (due later) | false | `Weather Cock - dry, rain in about 6 min` |
| otherwise | false | `Weather Cock - dry, no rain coming` |

Minutes: `Math.max(1, Math.round(nextInS / 60))`, so 2 min = 90..149 s. Snow: `WeatherState.precipitation` is the player's
biome, not the cock's, so the word comes from `precipitationFor(w.kind, biomeAt(x, z), y) === 'snow'` (`src/core/weather.ts`),
computed by the Game hook and passed as `CockInput.snow`. Dust (dunes) is never wet: a cock in the dunes
stays off in a dust wind (it is not rain; a drying rack in the dunes needs no roof).

Hold: `Trinkets` keeps `holdS` per cock cell (NOT saved; after a load the hold restarts at 0, harmless): set to
`WEATHER_COCK_HOLD_S` every tick the cock is on for rain/forecast reasons; counts down while those reasons are false.

**Signal wiring.** `Signals` gains an optional host hook NEW `SignalHost.sourceOn?(kind: string, x: number, y: number, z: number):
boolean`; in `tick`, the `on` expression gets `: c.kind === 'weather_cock' ? this.host.sourceOn?.('weather_cock', c.x, c.y, c.z) ??
false`. The Workshop supplies it from `this.trinkets.cockOn(x, y, z)`. The cock is a source at strength 15 exactly like a lever,
so everything already reading signals works: wire, piston (a stopped piston "pulls back", a signalled one "pushes" only via
lever-driven setups as today), clutch flip, bell rings once on the rising edge (existing `rung` logic), signal lamp, lantern
chain (4.6). `Signals.describe` is NOT used for the cock (the trinket line wins; see 8 step 6).

**On/off sound.** On every change of `on`: `vane_creak` at pitch 1.4, volume 0.6 (small tier: a click of the comb) at the cock.
Toast: none (the bell is the alarm; a toast would fire every time weather changes while you are anywhere).

**Animation.** Same arrow as the vane (it is a vane with a cockerel) via `VaneView kind: 'weather_cock'`.

**J5 contraption.** Pistons push while their shaft turns and pull back when stopped; a piston touching a signal cell works only
while powered (`Signals.gate`, passed into `Contraptions` as `gate`). The J5 build is therefore: a turning source (crank, clockwork,
water wheel) on a piston whose side touches the wire from the cock, the piston facing a framed roof section over the racks.
Signal on -> the piston extends the roof (up to 4 blocks); signal off -> gated -> it pulls the roof back. The builder confirms in
`src/workshop/contraption.ts` that a gated-off piston RETRACTS. If it instead holds, the documented J5 build uses a clutch in the
piston's shaft line touching the wire (a powered cell flips a clutch: engaged -> released, existing `Signals.flips`), with the clutch
placed so that "released" = piston stopped = roof back. Whichever is true goes in docs/api/workshop.md and the e2e; no new piston
rule is written by this unit.

### 4.3 Spyglass - `spyglass`

| field | value |
|---|---|
| kind | held item, `category: 'tool'`, `icon: 'icon_spyglass'`, no `tool` spec (it mines nothing; it is a plain item that Use acts on) |
| display name | `Spyglass` |
| desc | `A brass tube with two lenses. Use it to look through: four times closer, and it names what you see up to 96 blocks away. Use again to lower it.` |
| stack | 1 |
| recipe | `forge('spyglass', '2 glass, 1 bronze_ingot, 1 leather', 600)` |

**Numbers.** NEW in `src/player/trinketTools.ts`: `SPYGLASS_ZOOM = 4`, `SPYGLASS_RANGE = 96` (blocks), `SPYGLASS_LOOK = 1 /
SPYGLASS_ZOOM` (look sensitivity multiplier while raised). Reasoning: a 70 deg view becomes 17.5 deg, a real 4x glass; the render
distance setting still bounds what is drawn, so 96 blocks (6 chunks) is the naming range - beyond what you can reach (REACH) but
within a typical phone view distance. Look sensitivity scales with the zoom so a thumb-swipe moves the same angle on screen
(otherwise a phone user overshoots wildly).

**Behaviour.**
- Use with the spyglass in the selected slot toggles RAISED. Use never reaches the world while the spyglass is held (pattern of
  `p.collectors.trigger()`): `if (intent.use && this.trinkets.use(nowS)) intent.use = false;`.
- Held-Use repeats (every `USE_REPEAT_S` 0.25 s) must not re-toggle: `HeldTrinkets.use` ignores a Use that arrives within
  `USE_REPEAT_S + 0.1` s of the previous Use intent while the same item stayed selected (it records `lastUseS` on EVERY use intent,
  toggles only when `nowS - lastUseS > 0.35`). A tap toggles; holding the button toggles once.
- Raised: `sprintFov` target becomes `settings.fov / SPYGLASS_ZOOM` (sprint kick ignored); the existing exp ease gives a ~0.3 s
  zoom; `intent.lookYaw/lookPitch` are multiplied by `SPYGLASS_LOOK` before being applied.
- Lowered automatically (no toast) when: the selected item stops being the spyglass (slot change, drop, item gone), a screen opens
  (`ui:opened`), the player dies or respawns, or the player enters a vehicle seat. Never saved: a load starts lowered.
- While raised, the crosshair name is a FAR reading: a ray of `SPYGLASS_RANGE` (reuse `raycast(...)` with maxDist 96 and
  `animals.raycast(..., 96)`): `Goat - 41 blocks` / `Iron Ore - 63 blocks` / `Wind Turbine - 22 blocks`, distance = eye to hit,
  rounded. Nothing hit: `Nothing within 96 blocks`. Nearer than REACH it still uses the far form (consistent, no flicker).
  Mining and placing are impossible while raised (Use is eaten; Mine still mines the block in reach - allowed, harmless).
- HUD overlay: NEW `.hw-spyglass` full-screen div (in the HUD layer, `pointer-events: none`): a black radial vignette leaving a
  circle of `min(vw, vh) * 0.86`, a thin brass ring (`#b08d57`, 2 px) and the crosshair kept. It must not cover the hotbar or the
  touch buttons: it sits UNDER the touch layer (z-index below `root.layers.touch`), and the hotbar stays visible through it at
  70% opacity (set `.hw-hotbar` above the overlay). Fades in/out over 150 ms.
- Sound: `ui_click` pitch 0.7, volume 0.6 on raise, pitch 0.55 on lower (existing sfx; no new name).

### 4.4 Brass Horn - `brass_horn`

| field | value |
|---|---|
| kind | held item, `category: 'tool'`, `icon: 'icon_brass_horn'`, stack 1 |
| display name | `Brass Horn` (SYSTEMS 4 naming list) |
| desc | `A curled horn. Blow it with Use and every tame animal within 32 blocks comes to you and follows for 20 seconds - lead them to a pen or a treadwheel.` |
| recipe | `forge('brass_horn', '1 bronze_plate, 1 bronze_ingot, 1 leather', 600)` |

**Numbers** (NEW in `src/player/trinketTools.ts`; SYSTEMS T6): `HORN_RANGE = 32` blocks (3D distance from the player's feet, and
`|dy| <= 16`), `HORN_FOLLOW_S = 20`, `HORN_COOLDOWN_S = 6`.

**Behaviour.**
- Use with the horn held (same `HeldTrinkets.use` path, same repeat filter as the spyglass) blows it if the cooldown is 0:
  `n = animals.callTame(px, py, pz, HORN_RANGE, HORN_FOLLOW_S)`.
- `MobManager.callTame` (NEW): for each mob in `this.mobs` that is `tame`, not `state === 'dying'`, not harnessed (2.2), loaded,
  within range: set `m.calledS = seconds` (refresh, never shorten: `Math.max`), and set `m.callS = 0.3 + rng() * 0.7` so it
  answers with its own existing voice within a second (the private `call` plays it - no new animal sound). Returns the count.
- `brain.ts` step 4 condition becomes `liked || called`, where `called = (m.calledS ?? 0) > 0`. A called animal follows to the
  same polite stop distance at full species speed and IGNORES `MOB_FOLLOW_RANGE` and the `|dy| < 6` limit while called (it was in
  range when called). `advanceTimers` counts `calledS` down by `dt` (NEW line). Liked-item following keeps working unchanged.
  When a called animal can no longer path (a cliff), the existing `steer` safety (`standCell`) already stops it at the edge.
- Only `m.tame === true` answers: wild animals ignore the horn, babies answer if they are tame, automatons are never tame.
- `calledS` is NOT saved (`toJSON` unchanged): a loaded world forgets a call - 20 s is shorter than any save interval matters.
- Toasts (info): `"2 animals answer the horn"` / `"1 animal answers the horn"` / `"No tame animal within 32 blocks hears you"`.
  On cooldown: `"Catch your breath - 4 s"` (seconds rounded up), kind `info`, no sound.
- Sound: `horn_call` at the player, loud tier volume 1.4 (SYSTEMS T9 rule 2 "horns"), every blow (also when nobody answers).
- Cooldown lives on `HeldTrinkets` (player-level, not saved); it is per player, not per horn.

### 4.5 Padlock Chest - `padlock_chest`

| field | value |
|---|---|
| kind | block with `machine: 'crate'` (a crate entity: 27 slots, same screen layout, same Unit 4 hot-item refusal); appended to the crate MachineSpec `blocks: ['crate', 'padlock_chest']` in `src/content/tech.ts` |
| display name | `Padlock Chest` |
| desc | `A crate with a bronze padlock. Machines, pipes and golems may put things in, but only your own hand takes anything out.` |
| stack | 16 |
| hardness / tool | 3 / `axe` (a little tougher than a crate's 2) |
| recipe | `forge('padlock_chest', '1 crate, 1 bronze_ingot, 1 copper_ingot', 600)` |
| textures | `all: 'padlock_chest'` side, `top: 'padlock_chest_top'` (NEW block textures: the crate's planks with bronze straps and a padlock on every side) |

**The rule (one sentence, for docs and the guide):** *anything may put things in; only a player's hand takes them out.* Reasoning:
SYSTEMS T6 says "keeps machines and golems out" and "`logi.take` refuses a locked container for every caller except the player's
own hand". A chest that refused deliveries too would just be a crate with fewer uses; as a letterbox it gives a real design job:
the arm that empties every crate it can reach for the furnace line can drop finished ingots into the padlock chest and never take
the diamonds back out.

| caller | put in | take out |
|---|---|---|
| player hand (screen, quick move) | yes | yes |
| player crafting at a furnace/workbench within `STATION_CRATE_RADIUS` (`stationSources` -> `cratesNear`) | - | **yes** (it is the player's own hand crafting; the crate screen's note already promises it) |
| `Logistics.accept` (arm, funnel, chute, belt end, golem, vacuum collector, skiff unload) | yes | - |
| `Logistics.take` / `peek` (arm source, funnel/chute pulling from behind, golem source, deployer stocking) | - | **no**: `take` returns `null`, `peek` returns `[]` |
| machine output push into touching crates (`src/sim/crates.ts`) | yes | - |
| item pipes (`machineItemEndpoint` in `src/sim/endpoints.ts`) | yes | **no**: endpoint `slotEndpoint(e, inv, 0, size, 0, 0)` for a locked cell |
| electromagnet / hand vacuum | n/a (they pull ground items) | n/a |

Implementation: NEW `isLocked(world: IWorld, x, y, z): boolean` in `src/workshop/trinkets.ts` = `world.getBlock(x, y, z).key ===
'padlock_chest'`. Called at the top of the crate branch of `Logistics.take` and `Logistics.peek`, and in `Logistics.wrench` when a
locked cell is chosen as an arm SOURCE. The sim side (`machineItemEndpoint` in `src/sim/endpoints.ts`) must not import
`src/workshop`: it checks the block at the entity's position through the registry
(`world.getBlock(e.x, e.y, e.z).key === 'padlock_chest'`, with `world` reached the way the endpoint host already reaches it; if the
host has no world, add an optional `EndpointHost.blockKeyAt?(x, y, z): string`).

Arm wrench (existing `Logistics.wrench`): choosing a padlock chest as the SOURCE refuses with toast (warn)
`"The Padlock Chest is locked - an arm cannot take from it"`; choosing it as a target is fine.

Screen: `createCrateScreen` reads the block at `(x, y, z)` (`ctx.world.getBlock(x, y, z)`): title, heading and slot label become the
block's name (`Padlock Chest`), and the note becomes
`Only your hand takes things out. Machines, pipes and golems may put things in. Furnaces and workbenches within 4 blocks still borrow from it.`
(the `4` is `STATION_CRATE_RADIUS`, interpolated as today).

Crosshair (goggles, via `inspect` -> machine probe -> existing `machineView`): leave as the crate's; additionally the trinket
reader (8 step 9) gives everyone `Padlock Chest - locked, 12 of 27 slots used` (count of non-null slots / `slots.length`).

No keys, no owners: Hearthwatt is single-player; the padlock is against machines, not people. Breaking it drops its contents
exactly like a crate (it is one).

### 4.6 Lantern Chain - `lantern_chain`

| field | value |
|---|---|
| kind | block, `shape: 'torch'`, `solid: false`, `opaque: false`, textures `all: 'lantern_chain'` (NEW: a chain link column with a small glazed lantern in the lower half, cut-out sprite) |
| display name | `Lantern Chain` |
| desc | `A glazed lantern on a bronze chain. It hangs from a block above and lights the room below it. Touching a signal, it lights only while the signal is on.` |
| stack | 16 |
| light | `light: 0`, `lightActive: 14` (lit = the voxel's active bit; 14 = the Floating Light's level, one above a torch's 13: a hanging lantern is the workshop's ceiling light) |
| warmth | 0 (it is glazed and small; warmth stays the hearth's and the torch's - T1) |
| hardness | 0.3, no tool, drops itself |
| recipe | `forge('2 lantern_chain', '1 bronze_ingot, 1 glass, 1 torch', 600)` |

**Rules.**
- Placement: only against the underside of a solid block or under another `lantern_chain` (support above). Refusal toast:
  `"A lantern chain hangs from a block above it"`. Placement is the interaction layer's job: add NEW
  `BlockSpec.hangs?: true` (optional field, documented in `src/core/types.ts`), read by `Interaction` placement code (the same
  place that refuses other bad placements) - builder: grep the torch/`placeOn` placement check in `src/player/interaction.ts` and
  add one clause; if a generic `placeOn` list suffices (it lists blocks it may stand ON), it does not, because hanging needs the
  block ABOVE: hence the new field.
- Support lost: when the block above a lantern chain becomes air or non-solid (`block:changed`), the chain drops as an item; a
  column of chains falls link by link in the same tick (the Trinkets module walks down while the cell below is `lantern_chain`).
- Lit: `Trinkets.tick` sets the active bit to `signals.gate(x, y, z)` (true when touching no signal cell, or when a touching cell is
  powered), writing the voxel only on change (`withActive`, as `Workshop.showActive` does). So a plain chain is always lit; wire it
  to a lever for a light switch, or to the weather cock so the yard lamps come on when the rain does. A newly placed chain is
  lit within one workshop tick (50 ms).
- Line (crosshair, everyone): `Lantern Chain - lit` / `Lantern Chain - dark, the signal is off`.

### 4.7 Punch cards - `punch_card`, `punch_card_pulse`, `punch_card_swing`, `punch_card_ladder`

| key | name | desc | recipe | icon |
|---|---|---|---|---|
| `punch_card` | `Blank Punch Card` | `A stiff card of cloth. Slide it into a Sequenced Gearshift and punch your own program of up to 8 steps.` | `bench('punch_card', '2 punch_card', '1 cloth, 1 flint')` (SYSTEMS T4) | `icon_punch_card` |
| `punch_card_pulse` | `Pulse Card` | `A punched card for a Sequenced Gearshift: on for 4 s, off for 2.` | `bench('punch_card_pulse', 'punch_card_pulse', '1 punch_card, 1 flint')` | `icon_punch_card_pulse` |
| `punch_card_swing` | `Swing Card` | `A punched card for a Sequenced Gearshift: forward 3 s, pause, back 3 s, pause.` | `bench('punch_card_swing', 'punch_card_swing', '1 punch_card, 1 flint')` | `icon_punch_card_swing` |
| `punch_card_ladder` | `Ladder Card` | `A punched card for a Sequenced Gearshift: equal, double, half and off, 2 s each.` | `bench('punch_card_ladder', 'punch_card_ladder', '1 punch_card, 1 flint')` | `icon_punch_card_ladder` |

All: `category: 'misc'`, stack 16 (SYSTEMS T4 "cards 16"), age bronze. The workbench recipes make presets visible to the progression
solver and the Codex; the in-world way is the gearshift screen's punch buttons (below) - both exist, the screen is the fun one.
Flint "punches the holes" (fiction for the recipe), consistent with the blank's own recipe.

**Programs.** Presets are exactly `GEARSHIFT_PROGRAMS[0..2]` (pulse = 0, swing = 1, ladder = 2); NEW
`PRESET_CARDS: Record<string, number> = { punch_card_pulse: 0, punch_card_swing: 1, punch_card_ladder: 2 }` in
`src/workshop/kinetics.ts`. Custom programs use the same `[seconds, factor][]` shape:

| limit | value | constant (NEW, `src/workshop/kinetics.ts`) |
|---|---|---|
| steps | 1..8 | `CARD_MAX_STEPS = 8` |
| seconds per step | integer 1..8 | `CARD_MAX_STEP_S = 8` |
| factors | `-2, -1, -0.5, 0, 0.5, 1, 2` | `CARD_FACTORS = [-2, -1, -0.5, 0, 0.5, 1, 2] as const` |
| loop length | at most 64 s (8 x 8), at least 1 s | derived |

Words for factors (NEW `FACTOR_WORDS`, used in screen and lines): `2 -> 'double'`, `1 -> 'forward'`, `0.5 -> 'half'`,
`0 -> 'stop'`, `-0.5 -> 'half back'`, `-1 -> 'reverse'`, `-2 -> 'double back'`. Chips show glyphs + word:
`▶▶ double`, `▶ forward`, `▷ half`, `■ stop`, `◁ half back`, `◀ reverse`, `◀◀ double back`.

Encoding for save (NEW `encodeCard(steps): string` / `decodeCard(s: unknown): [number, number][] | null` in
`src/workshop/kinetics.ts`): `"<s>:<f>,<s>:<f>,..."`, e.g. swing = `"3:1,1:0,3:-1,1:0"`. `decodeCard` returns `null` for a non-string
or when no valid step remains; it drops steps whose seconds are not an integer in 1..8 or whose factor is not in `CARD_FACTORS`, and
truncates to 8 steps. A 64 s loop with factor 2 can reach `rpm * 2` - that is the ratio dial's x2, already in the game; a ratio dial
x3 after it reaches x6 as today. Nothing new for stress (`BASE_STRESS` per part scales with |rpm| as always).

**Kinetics change (minimal).** `KPart` gains `prog?: readonly (readonly [number, number])[]`. NEW
`stepsFactor(steps, t)` holds the loop walk that `gearshiftFactor` has today; `gearshiftFactor(program, t)` becomes
`stepsFactor(GEARSHIFT_PROGRAMS[clamped], t)` (same results; `kinetics.test.ts` stays green). `passOn`'s gearshift case uses
`part.prog ? stepsFactor(part.prog, t) : gearshiftFactor(part.s, t)`. Every gearshift loops on the shared world clock (`t` =
`Workshop.clock`), so two gearshifts with the same card run in step - a feature for the player (sync two presses).

**The card slot (per gearshift, per-block state).** `Workshop` gets NEW `private readonly cards = new Map<string, CardSlot>()`,
`interface CardSlot { item: string; prog?: [number, number][] }`; `item` is one of the four card keys; `prog` exists only for a
custom card (`item === 'punch_card'` with a punched program). A blank with no `prog` = "blank, not yet punched": the gearshift
then passes NOTHING (factor 0 throughout: an unpunched card has no holes), line fact `blank card - punch it`.

Interactions on a `sequence_gearshift` (in `Workshop.use`, before the `CYCLES` branch):

| hand | card in the drum | result |
|---|---|---|
| a card item | none | the card goes in (`takeHeld(1)`); preset -> runs at once; blank -> opens the gearshift screen. Toast `Card in: Swing` / for a blank, the screen opens instead. Sound `card_punch` pitch 0.8, small. |
| a card item | some card | swap: the old card comes out into the pack (or drops at the block when the pack is full, `ground.spawn`), the new one goes in. A custom card comes out as a blank (`punch_card`) - toast `Card swapped - the old card was smoothed flat` |
| empty / non-block item | none | cycle the built-in programs as today (back-compatible; toast `Gearshift program 2 of 3`) |
| empty / non-block item | some card | opens the gearshift screen (`ui:open { screen: { type: 'gearshift', x, y, z } }`) - returns `'screen'`-like `'worked'` |
| a block item | any | not ours (placing against it as today) |

Why a custom card comes out blank: `ItemStack` has no per-stack metadata (SYSTEMS 2 "Facts", T10 rule 4, anti-pattern "Per-stack
metadata smuggled in"). The program therefore lives on the gearshift block, and the card that carries it is the drum's. Taking it
out "smooths the card flat" - stiff cloth, the holes close. Presets keep their identity because their key IS their program, so they
travel freely. This makes the economy honest: a preset is a portable recipe-made item; your own program is a property of a
machine you built. (Copying a custom program between drums is out of scope - section 13.)

Breaking a gearshift drops its card (preset item, or `punch_card` for a blank/custom) next to the 1 gearshift item.

**Lines.**
- `setting()` for a gearshift with a card: preset `Swing card`, custom `own card, 4 steps, 8 s loop`, blank `blank card - punch it`.
  Without a card: unchanged `Gearshift program 2 of 3`.
- `describe()` adds the current step for any running card or program: `step 3 of 4: reverse`. Full goggles example:
  `Sequenced Gearshift - right 16 rpm, load 1/8 su, Swing card, step 3 of 4: reverse` (77 chars). This is a goggles-only
  machine line, which may wrap to two HUD lines exactly like today's long machine lines (SYSTEMS T8 "a second goggles line may
  carry kinetic facts"); it stays one string from `describe`.
  NEW pure helper `stepAt(steps, t): { index: number; factor: number; leftS: number }` in kinetics.ts drives it.

**PART_DEFS desc change** for `sequence_gearshift`: `'A drum that engages, reverses and changes speed on a loop. Use it to pick one of three programs, or slide in a punch card: a preset, or a blank you punch yourself.'`

### 4.8 The gearshift screen (card editor) - `ScreenRequest { type: 'gearshift'; x; y; z }`

A screen is justified (SYSTEMS 1.3: "a screen only when a choice has more than three options (the rig screen, the punch-card
editor)"). File NEW `src/ui/screens/workshop/cardScreen.ts`, registered in `Game` beside `'workshop'`:
`this.ui.registerScreen('gearshift', (req, ctx) => createCardScreen(req, ctx, this.workshop.cardHost()))`.

The screen talks to the workshop only through a small NEW host interface (the UI does not import the Workshop class):

```ts
export interface CardHost {
  /** The card in the gearshift at x,y,z, or null (screen closes when the gearshift is gone). */
  card(x: number, y: number, z: number): { item: string; prog: [number, number][] | null } | null;
  /** Punches a custom program into the blank/custom card in that drum. False if no card or the program is invalid. */
  punch(x: number, y: number, z: number, prog: [number, number][]): boolean;
  /** Turns the blank card in that drum into a preset card item (the drum keeps it, now a preset). */
  punchPreset(x: number, y: number, z: number, preset: 'punch_card_pulse' | 'punch_card_swing' | 'punch_card_ladder'): boolean;
  /** Takes the card out into the player's pack (custom -> blank). Returns the item key given, or null. */
  takeOut(x: number, y: number, z: number): string | null;
  /** World seconds now (the playhead), and whether the gearshift is turning. */
  clock(): number;
  turning(x: number, y: number, z: number): boolean;
}
```

**Layout - phone portrait (390 x 844), `Window({ size: 'md', fit: 'tall' })`, one column:**

```
+--------------------------------------+
| Punch Card              [x]          |  <- Window title; subtitle "Sequenced Gearshift"
|--------------------------------------|
|  Own card - 4 steps, 8 s loop        |  <- summary line (aria-live)
|  [||||||||  ##  ||||||  ##      ]    |  <- the card strip: 1 cell per second, colour per factor,
|        ^ playhead (live)             |     punched-hole art; 24 px tall, not interactive
|--------------------------------------|
|  1  [ ▶ forward     ]  [-] 3 s [+] [✕]|  <- each row 44 px: number, factor chip (tap cycles
|  2  [ ■ stop        ]  [-] 1 s [+] [✕]|     through CARD_FACTORS order forward, double,
|  3  [ ◀ reverse     ]  [-] 3 s [+] [✕]|     half, stop, half back, reverse, double back),
|  4  [ ■ stop        ]  [-] 1 s [+] [✕]|     Stepper 1..8 s, remove (disabled at 1 step)
|  [ + Add step ]                      |  <- adds `▶ forward 4 s`; disabled at 8 steps: "8 steps is all a card holds"
|--------------------------------------|
|  [   Punch card   ]                  |  <- primary, 44 px, full width
|  Presets:  [Pulse] [Swing] [Ladder]  |  <- 3 chips 44 px; shown only when the card is blank/custom
|  [ Take the card out ]               |  <- secondary
+--------------------------------------+
```

**Phone landscape (844 x 390):** the same column inside the window body, which scrolls (`fit: 'tall'` already scrolls); the
strip and summary stay pinned at the top of the body (`position: sticky`), so editing row 7 still shows the playhead. All targets
44 px; the row is `number 24 px | chip flex | stepper 132 px | remove 44 px` = fits 358 px (390 - 2 x 16 gutters).

**Desktop:** the same layout at `size: 'md'`; keys: none required (all buttons are focusable and work with Enter/Space, as the
kit's buttons do).

**States and strings.**
- Title `Punch Card`, subtitle `Sequenced Gearshift`.
- Summary: preset `Swing card - 4 steps, 8 s loop`; custom `Own card - 4 steps, 8 s loop`; blank
  `Blank card - punch your program`; unsaved edits add ` (not punched yet)`.
- A preset card in the drum shows its steps READ-ONLY (rows without chips/steppers, plain text `3 s  ▶ forward`) and the note
  `A preset card cannot be re-punched. Take it out and slide in a blank to make your own.`; buttons: only `Take the card out`.
- A blank opens with one default row `▶ forward 4 s` (editing starts from something that turns).
- `Punch card`: calls `host.punch`; sound `card_punch` (small 0.6); toast `Card punched: 4 steps, 8 s loop`. Invalid (cannot
  happen through the UI, but guarded): toast `That program does not fit on a card`.
- Program of only `stop` steps: punch allowed, toast `Card punched - it never engages, every step is stop` (kind `warn`).
- Presets chips: `Pulse` / `Swing` / `Ladder`, each with the preset's summary as its title/aria-label
  (`Pulse: on 4 s, off 2 s`). Tap: `host.punchPreset`, toast `Card punched: Pulse`, sound `card_punch`. The screen re-renders
  read-only (it is now a preset).
- `Take the card out`: `host.takeOut`; toast `Card taken out` (preset) / `Card taken out and smoothed flat - it is blank again`
  (custom); pack full -> it drops at the gearshift with toast `Your pack is full - the card dropped by the gearshift`; screen
  closes.
- Strip colours (CSS tokens, both themes): forward/half green-amber `#d9a441`, double `#f0c060`, stop transparent with a
  dashed outline, reverse family blue `#4a9fe0` (the workshop guide's fluid blue). The playhead (2 px white line) moves at
  `host.clock()` mod loop length, refreshed by the screen's `refresh()` (GameUI calls it per frame); hidden when the gearshift is
  not turning (`host.turning`), with the strip dimmed to 60% and the caption `still - turn the shaft to see it run`.
- Refresh closes the screen if `host.card(...)` returns null (gearshift broken / card removed elsewhere).
- Unsaved edits are discarded on close (no prompt; the player presses Punch). Document in the summary text ` (not punched yet)`.

The editor never changes the running program until `Punch card` is pressed (no half-edited programs running a press).

### 4.9 Material web (T4 rows; replaces the two SYSTEMS rows for cards and trinkets)

| item | made by | consumed by | age | stack |
|---|---|---|---|---|
| `punch_card` | workbench: 1 cloth + 1 flint -> 2 | sequence gearshift program (custom); the 3 preset recipes | bronze | 16 |
| `punch_card_pulse/swing/ladder` | workbench: 1 punch_card + 1 flint; or punched at the gearshift screen | sequence gearshift program | bronze | 16 |
| `wind_vane`, `weather_cock`, `padlock_chest`, `lantern_chain` | forge 600 C (T1 furnace) | the player (end products; SYSTEMS T4 rule: trinkets need no second consumer) | bronze | 16 |
| `spyglass`, `brass_horn` | forge 600 C | the player | bronze | 1 |

Inputs are all existing items with producers at or before Bronze: `bronze_ingot`, `bronze_plate`, `copper_ingot`, `glass`, `stick`,
`leather`, `cloth`, `flint`, `crate`, `torch`. No new intermediate is created, so no dead end is possible.

---------------------------------------------------------------------------------------------------------------------------

## 5. Behaviour and rules (edge cases and messages)

1. **Vane/cock under a roof later.** A block placed above a vane makes it `sheltered` on the next tick (the reading recomputes
   `openSkyAbove` every `TRINKET_SCAN_S` 0.5 s per trinket - not every tick; cache per cell, invalidated by `block:changed` in the
   column above via `Workshop.noteBlock` -> `trinkets.noteColumn(x, z)`). A sheltered cock turns its signal off at once (no hold:
   it cannot feel the sky) and creaks.
2. **Vane in a storm.** Strength above 1.0 reads `gale (1.4)`; the turbine estimate may exceed 1500 W (the turbine itself may
   pass its rated output in a storm - weather.md "may pass the rated output"); the vane reports what the turbine would do.
3. **Weather override.** `__hw.setWeather('rain')` holds rain 12 min; `nextInS` is then the end of the override; the cock reads
   it like natural weather (it is the same `WeatherState`).
4. **First night.** Segments before the first dawn are dry, so a cock built on night 1 reads `dry, no rain coming` or
   `dry, rain in about N min` - truthful.
5. **Cock and the biome.** In the frostfell snow counts as wet (`wetAt` is true for snow above the threshold), so the cock signals
   and the line says `snowing`; in the dunes a dust wind never signals.
6. **Several cocks** each compute their own reading (positions can differ in biome and sky); they share the weather state.
7. **Spyglass in a vehicle / swimming.** Raising while seated in the tractor or skiff is refused with
   toast `Not while riding` (a moving camera at 17 deg makes people sick); in water it works.
8. **Spyglass and dev flight / Dev Mode creative.** Works the same.
9. **Spyglass with FOV setting change while raised.** Target is recomputed from `settings.fov` every frame, so a settings change
   applies through the zoom.
10. **Horn with no animals loaded** (chunks far away unloaded): only loaded mobs hear (`world.isLoaded(m.x, m.z)`); toast says none.
11. **Horn while an animal is mid-breed** (`state === 'breed'`): brain step order already handles breed before step 4; it breeds
    first, then follows if still called.
12. **Called animal and a liked item held** - both true; one follow behaviour; no double speed.
13. **Padlock chest next to a funnel facing into it**: the funnel pushes in (accept) - allowed; a funnel BEHIND it (pulling out)
    gets nothing: its `take` returns null, it stays idle and silent (no toast spam; the funnel line reads as today).
14. **Arm set up with a crate source, then the crate replaced by a padlock chest**: the saved source stays; `take` returns null;
    the arm idles; its line already says what it is doing (`Mechanical Arm - waiting for items` or the existing equivalent).
15. **Item pipe from a padlock chest**: the pipe screen shows the chest as an endpoint that only accepts; no extraction.
16. **Unit 4 hot items**: a hot ladle/bloom offered to the padlock chest is refused by the crate rule; nothing here.
17. **Lantern chain under glass / leaves**: support needs `solid` above (glass is solid; leaves are solid in this game if
    `BlockSpec.solid` says so - the rule is the field, not a list).
18. **Lantern chain moved by a piston/bearing**: it is NOT movable (`Workshop.isMovable` is unchanged: only frames and workshop
    parts). A contraption leaving a chain unsupported drops it (rule 4.6).
19. **Wind vane / weather cock on a contraption**: they ARE workshop parts (PART_DEFS), so `isMovable` returns true via
    `SIGNAL_KINDS` (the cock); the vane is neither kinetic, logistic nor a signal, so `isMovable` gains `|| kind === 'wind_vane'`, and `Workshop.relocate` calls
    `this.trinkets.relocate(map)` so hold timers and creak timers follow. A vane on a turning bearing reads the wind like any vane.
20. **Gearshift with a card, then Use with an empty hand during a jam**: opens the screen as usual; editing does not clear the jam.
21. **Gearshift saved with a card whose item key no longer exists** (content removed) - `load` drops the row; the gearshift runs
    its dial program.
22. **Card program changes mid-loop**: the new program applies from the next tick, phase from the world clock (no reset of
    `t`); the loop position may jump to the middle of a step - acceptable and not worth a message.
23. **Gearshift reached through a contraption move**: `cards` re-keyed in `relocate` like `wound`.
24. **Two players**: single-player game; not applicable.

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 Every string (T8 / SYSTEMS 1.4 voice)

Crosshair lines (everyone, no goggles needed):
- `Wind Vane - wind from the west, fresh (0.6), turbine 680 W`
- `Wind Vane - wind from the north-west, gale (1.4), turbine 1.6 kW`
- `Wind Vane - sheltered, no wind reaches it`
- `Weather Cock - raining, signal on` / `Weather Cock - snowing, signal on` / `Weather Cock - storm, signal on`
- `Weather Cock - rain in about 2 min, signal on` / `Weather Cock - rain in under a minute, signal on` /
  `Weather Cock - storm in about 1 min, signal on`
- `Weather Cock - clearing, signal off in 25 s`
- `Weather Cock - dry, rain in about 6 min` / `Weather Cock - dry, no rain coming`
- `Weather Cock - under a roof, it cannot feel the sky`
- `Padlock Chest - locked, 12 of 27 slots used`
- `Lantern Chain - lit` / `Lantern Chain - dark, the signal is off`
- spyglass raised: `Goat - 41 blocks`, `Iron Ore - 63 blocks`, `Nothing within 96 blocks`

Goggles lines (gearshift): `Sequenced Gearshift - right 16 rpm, load 1/8 su, Swing card, step 3 of 4: reverse`;
`..., own card, 5 steps, 14 s loop, step 1 of 5: double`; `..., blank card - punch it`; no card: unchanged.

Toasts:
| when | text | kind |
|---|---|---|
| card into empty drum | `Card in: Swing` (preset) | info |
| card swap | `Card swapped: Ladder in` / custom out: `Card swapped - the old card was smoothed flat` | info |
| punch | `Card punched: 4 steps, 8 s loop` / `Card punched: Pulse` | good |
| stop-only punch | `Card punched - it never engages, every step is stop` | warn |
| take out | `Card taken out` / `Card taken out and smoothed flat - it is blank again` | info |
| pack full on take out | `Your pack is full - the card dropped by the gearshift` | info |
| horn | `2 animals answer the horn` / `1 animal answers the horn` / `No tame animal within 32 blocks hears you` | info |
| horn cooldown | `Catch your breath - 4 s` | info |
| spyglass while riding | `Not while riding` | info |
| arm source refused | `The Padlock Chest is locked - an arm cannot take from it` | warn |
| lantern placement | `A lantern chain hangs from a block above it` | info |
| side goal | `Side goal: Read the wind` (Unit 0's mechanism) | good |

Workshop Guide: the Rules tab gains one line (append to `RULES` in `workshopScreen.ts`):
`Cards: slide a preset card (Pulse, Swing, Ladder) into a Sequenced Gearshift, or a blank one and punch your own loop of up to 8 steps. A Weather Cock is a signal source that turns on before rain.`
The Parts tab lists the vane and cock automatically (they are PART_DEFS rows); their `BASE_STRESS` is absent, so no load line.

### 6.2 Sounds (T9) - `src/audio/sfxWorkshop.ts` NEW

| name | tier / volume | when | patch idea (synth, `sfxKit` helpers as in `sfxBrew.ts`) |
|---|---|---|---|
| `horn_call` | loud 1.4 | every horn blow | two detuned saw oscillators through a low-pass ~1.2 kHz, pitch glide 180 -> 220 Hz over 0.15 s, held 0.9 s, slow release 0.4 s; a second, softer overtone at 2x; total ~1.4 s |
| `vane_creak` | whisper 0.3 (cock on/off: 0.6 at pitch 1.4) | sector change (max once / 6 s / vane); cock signal change | short filtered-noise burst with a resonant band-pass sweep 900 -> 600 Hz, 0.25 s, a little tremolo for the "squeak" |
| `card_punch` | small 0.6 | card in, punch, preset punch | three quick clicks (noise bursts, 8 ms each, 40 ms apart) and a soft low thump - a ticket punch |

Add the three names to the `SfxName` union (`src/core/gameEvents.ts`), the set to `src/audio/sfx.ts`'s merge, and the set's length
to the `sfx.test.ts` expression. Idle is silent (T9 rule 3): no loop sounds anywhere in this unit.

### 6.3 Particles / animation
- Vane and cock arrows: eased turning + flutter (4.1). Cock comb front texture lit (`_on`) while signalling (active bit, set by
  `Workshop.showActive` from `signals.states()` - it is a signal cell, so this happens with no new code once it is in
  `SIGNAL_KINDS` and its source `on` is in `litCells`).
- Lantern chain: no particles (a still lantern); light via the active bit.
- Spyglass: the overlay fade (150 ms) and the FOV ease.
- Horn: no particles; animals answer with their own voices (existing calls).
- Gearshift: no change to its spinning cog; the card is visible as nothing in the world (out of scope: a card sticking out).

### 6.4 Textures (procedural, readable, 16x16)
- Block faces: `ws_wind_vane_front` (a brass arrow on dark machine side), `ws_weather_cock_front`, `ws_weather_cock_front_on`
  (comb lit amber), `padlock_chest`, `padlock_chest_top`, `lantern_chain` (cut-out). The vane and cock as PART_DEFS use the
  generated part-front path of `src/render/textures/iconsWorkshopParts.ts`; its `STATIC` set lists the
  non-animated part fronts (`'clockface'` is in it): add `'wind_vane'` to `STATIC`; `weather_cock` is animated (two
  fronts).
- Icons: `icon_spyglass`, `icon_brass_horn`, `icon_punch_card`, `icon_punch_card_pulse`, `icon_punch_card_swing`,
  `icon_punch_card_ladder` (the four cards share a cream card with a clipped corner; the presets differ by their hole pattern and a
  coloured stripe: pulse amber, swing blue, ladder green - readable at 16 px and distinct by pattern, not only colour).
- All pass the texture readability test (SYSTEMS 6c).

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

### 7.1 TypeScript sketches

```ts
// src/content/itemsTrinkets.ts  NEW
import type { BlockSpec, ItemSpec } from '../core/types';
import { ageIndexOf } from '../magic/ageMap';
const BRONZE = ageIndexOf('bronze');
export const TRINKET_ITEMS: ItemSpec[] = [
  { key: 'spyglass', name: 'Spyglass', category: 'tool', age: BRONZE, stack: 1, icon: 'icon_spyglass', desc: '...' },
  { key: 'brass_horn', name: 'Brass Horn', category: 'tool', age: BRONZE, stack: 1, icon: 'icon_brass_horn', desc: '...' },
  { key: 'punch_card', name: 'Blank Punch Card', category: 'misc', age: BRONZE, stack: 16, icon: 'icon_punch_card', desc: '...' },
  // punch_card_pulse / _swing / _ladder likewise
];
export const TRINKET_BLOCKS: BlockSpec[] = [
  { key: 'padlock_chest', name: 'Padlock Chest', category: 'machine', age: BRONZE, machine: 'crate', hardness: 3, tool: 'axe',
    stack: 16, textures: { all: 'padlock_chest', top: 'padlock_chest_top' }, desc: '...' },
  { key: 'lantern_chain', name: 'Lantern Chain', category: 'block', age: BRONZE, shape: 'torch', solid: false, opaque: false,
    hardness: 0.3, light: 0, lightActive: 14, hangs: true, stack: 16, textures: { all: 'lantern_chain' }, desc: '...' },
];
// Register both lists where PART_ITEMS / PART_BLOCKS are registered (src/content/index.ts / items.ts / blocks.ts:
// grep for PART_BLOCKS and append beside it - APPEND, never insert, so block ids of saves stay stable: SYSTEMS 2).

// src/core/types.ts  (optional member, NEW)
interface BlockSpec { /* existing */ /** Must hang from a solid block or a block of the same key above (lantern chain). */ hangs?: boolean }

// src/workshop/kinetics.ts  (NEW members)
export interface KPart { kind: string; s: number; prog?: readonly (readonly [number, number])[] }
export const CARD_MAX_STEPS = 8;
export const CARD_MAX_STEP_S = 8;
export const CARD_FACTORS = [-2, -1, -0.5, 0, 0.5, 1, 2] as const;
export const PRESET_CARDS: Readonly<Record<string, number>> = { punch_card_pulse: 0, punch_card_swing: 1, punch_card_ladder: 2 };
export const CARD_KEYS: ReadonlySet<string> = new Set(['punch_card', ...Object.keys(PRESET_CARDS)]);
export function stepsFactor(steps: readonly (readonly [number, number])[], t: number): number;
export function stepAt(steps: readonly (readonly [number, number])[], t: number): { index: number; factor: number; leftS: number };
export function encodeCard(steps: readonly (readonly [number, number])[]): string;
export function decodeCard(raw: unknown): [number, number][] | null;
export function validCard(steps: readonly (readonly [number, number])[]): boolean;

// src/workshop/workshop.ts  (NEW members)
export interface WorkshopSnapshot { /* existing */ cards?: ([number, number, number, string] | [number, number, number, string, string])[] }
export interface VaneView { x: number; y: number; z: number; kind: 'wind_vane' | 'weather_cock'; from: number; strength: number; sheltered: boolean }
export interface WorkshopView { /* existing incl. Unit 0's moving */ vanes?: VaneView[] }
class Workshop {
  readonly trinkets: Trinkets;                                         // NEW
  /** Wind now: bearing FROM (radians) and Simulation.wind; set by Game. */
  wind: (() => { from: number; strength: number }) | null = null;      // NEW
  /** Weather reading inputs for a cell; set by Game. */
  weatherAt: ((x: number, y: number, z: number) => { w: WeatherState; wetHere: boolean; wetNext: boolean; snow: boolean }) | null = null; // NEW
  /** Watts a wind turbine standing at height y would make in this wind; set by Game (turbineWattsAt). */
  turbineW: ((y: number, wind: number) => number) | null = null;       // NEW
  cardHost(): CardHost;                                                 // NEW (for the screen)
}

// src/workshop/trinkets.ts  NEW - DOM-free, owned by Workshop
export const TRINKET_KINDS: ReadonlySet<string>;        // cells Trinkets tracks: wind_vane, weather_cock, lantern_chain
export const TRINKET_READ: ReadonlySet<string>;         // read without goggles: + padlock_chest
export const WEATHER_COCK_LEAD_S = 120;
export const WEATHER_COCK_HOLD_S = 30;
export const VANE_CREAK_MIN_S = 6;
export const TRINKET_SCAN_S = 0.5;
export function isLocked(world: IWorld, x: number, y: number, z: number): boolean;
export class Trinkets {
  constructor(host: { world: IWorld; bus: GameBus; ground: GroundItems; workshop: TrinketWorkshopView });
  noteBlock(x: number, y: number, z: number, kind: string): void;   // tracks vane/cock/lantern cells; drops unsupported chains
  tick(dt: number): void;                                         // readings every TRINKET_SCAN_S; lantern active bits; creaks
  cockOn(x: number, y: number, z: number): boolean;               // for Signals.sourceOn
  describe(x: number, y: number, z: number): string | null;       // the crosshair lines of 6.1 (vane, cock, lantern, padlock)
  vanes(): VaneView[];                                            // reused array
  relocate(map: ReadonlyMap<string, [number, number, number]>): void;
  verify(): void;
}

// src/workshop/trinketText.ts  NEW - pure
export const WIND_WORDS: readonly [number, string][];   // [upper bound exclusive, word], last = gale
export function windWord(w: number): string;
export function compassWord(fromRad: number): string;
export function vaneLine(r: { from: number; strength: number; sheltered: boolean; turbineW: number }): string;
export interface CockInput { w: WeatherState; wetHere: boolean; wetNext: boolean; snow: boolean; sky: boolean; holdS: number }
export function cockReading(c: CockInput): { on: boolean; reason: 'sky' | 'wet' | 'forecast' | 'hold' | 'dry'; text: string };
export function wattsText(w: number): string;          // "680 W" / "1.5 kW"

// src/player/trinketTools.ts  NEW - player-level held trinkets (pattern of game/collectors.ts)
export const SPYGLASS_ZOOM = 4, SPYGLASS_RANGE = 96, SPYGLASS_LOOK = 1 / 4;
export const HORN_RANGE = 32, HORN_FOLLOW_S = 20, HORN_COOLDOWN_S = 6;
export class HeldTrinkets {
  constructor(player: PlayerState, bus: GameBus, animals: { callTame?(x: number, y: number, z: number, r: number, s: number): number } | null);
  readonly raised: boolean;                           // spyglass up
  use(nowS: number, riding: boolean): boolean;        // true = consumed the Use (spyglass or horn held)
  tick(dt: number): void;                             // cooldown; lowers when the held item is no longer the spyglass
  lower(): void;
}

// src/mobs/types.ts
interface Mob { /* existing */ /** Seconds left of following the player after a brass horn (not saved). */ calledS?: number }
// src/mobs/manager.ts
callTame(x: number, y: number, z: number, radius: number, seconds: number): number;   // NEW
// src/player/animals.ts
interface AnimalTargets { /* existing */ callTame?(x: number, y: number, z: number, radius: number, seconds: number): number }

// src/core/gameEvents.ts
type ScreenRequest = /* existing */ | { type: 'gearshift'; x: number; y: number; z: number };
type SfxName = /* existing */ | 'horn_call' | 'vane_creak' | 'card_punch';
```

### 7.2 Save (T10)

- **`WorkshopSnapshot.cards?`** (optional): rows `[x, y, z, cardItem]` or `[x, y, z, 'punch_card', encodedProgram]`. Written only
  when the map is non-empty. `load` sanitises: integers for x/y/z, the row's part must be a loaded `sequence_gearshift` in
  `this.parts`, `cardItem` must be in `CARD_KEYS`; for `punch_card` the 5th element goes through `decodeCard` (null -> blank, no
  `prog`); a preset row with a 5th element ignores it. Bad rows are skipped silently (like `machines`).
- `verify()` drops card rows whose gearshift block is gone (and spawns nothing - the block's breaking already dropped the card
  through `noteBlock`; a block gone while unloaded is the world's own business, as with machine buffers).
- `relocate` re-keys `cards`.
- **Nothing else is saved**: vane/cock readings and hold timers are derived; lantern lit state is the voxel's active bit (already
  saved with block edits) and recomputed every tick; spyglass raised, horn cooldown and `Mob.calledS` are transient by design.
  The padlock chest's contents are the crate entity's (existing machine save).
- **Old saves**: no `cards` -> every gearshift runs its saved dial program (`s` in `parts`), exactly as today. New block keys are
  appended, never inserted (block edits are saved by key anyway). Test: load a snapshot without `cards` (section 9).
- No `SAVE_VERSION` bump (T10 rule 3).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered; each step leaves `npm test` green)

1. **Content keys.** `src/content/itemsWorkshopParts.ts`: append two `PART_DEFS` rows (`wind_vane` `anim: false`,
   `weather_cock` `anim: true`) at the END of the array; add both to `NON_KINETIC`; update the `sequence_gearshift` desc (4.7).
   NEW `src/content/itemsTrinkets.ts` (7.1) and register `TRINKET_ITEMS`/`TRINKET_BLOCKS` beside `PART_ITEMS`/`PART_BLOCKS`
   (append). `src/content/tech.ts`: crate `blocks: ['crate', 'padlock_chest']`. `src/core/types.ts`: `BlockSpec.hangs?`.
2. **Recipes.** `src/content/recipesWorkshop.ts`: append, after `engineer_goggles`, a comment `// Trinkets and punch cards (Unit 16).`
   and the 10 recipes: `forge('wind_vane', ...)`, `forge('weather_cock', ...)`, `forge('spyglass', ...)`, `forge('brass_horn', ...)`,
   `forge('padlock_chest', ...)`, `forge('2 lantern_chain', ...)`, `bench('punch_card', '2 punch_card', '1 cloth, 1 flint')`,
   `bench('punch_card_pulse', 'punch_card_pulse', '1 punch_card, 1 flint')`, `..._swing`, `..._ladder` (exact inputs in 4.x).
3. **Textures.** `src/render/textures/iconsWorkshopParts.ts`: the two part fronts (`wind_vane` into `STATIC`), the padlock and
   lantern block textures, the six icons (6.4). Wherever block textures for non-part blocks are generated for workshop content,
   follow the file's own pattern (grep `ws_hopper_top` generation).
4. **Roster.** `src/content/specRosterWorkshop.ts`: `blocks` += `'wind_vane', 'weather_cock', 'padlock_chest', 'lantern_chain'`;
   `items` += `'spyglass', 'brass_horn', 'punch_card', 'punch_card_pulse', 'punch_card_swing', 'punch_card_ladder'`; recipe strings
   in the roster's format, e.g. `'wind_vane: 1 wind_vane <- 1 bronze_ingot, 1 copper_ingot, 1 stick @600 T1'`,
   `'punch_card: 2 punch_card <- 1 cloth, 1 flint'` under `workbench`; `textures` += the exact number of textures step 3 adds
   (expected 3 part fronts + 3 block textures + 6 icons = 12 -> 105; the builder counts what is actually generated and updates the
   comment above the number). `machines` roster for crate is unchanged (`['crate', { slots: 27 }]`).
5. **Kinetics.** `src/workshop/kinetics.ts`: `KPart.prog?`, `stepsFactor`, `stepAt`, card constants, `encodeCard/decodeCard/
   validCard`, `PRESET_CARDS`, `CARD_KEYS`; `gearshiftFactor` delegates to `stepsFactor`; `passOn` uses `prog`.
6. **Signals.** `src/workshop/signals.ts`: `'weather_cock'` into `SIGNAL_KINDS` and `SOURCES`; `SignalHost.sourceOn?`; the `on`
   expression in `tick`; `describe` skips `weather_cock` (returns null so the trinket line is used; order in `Workshop.describe`
   makes `trinkets.describe` come first anyway).
7. **Trinkets module.** NEW `src/workshop/trinketText.ts` (pure) and `src/workshop/trinkets.ts` (7.1). `Trinkets` keeps
   `Map<string, { kind; x; y; z; sky: boolean; skyAt: number; holdS: number; on: boolean; sector: number; creakS: number }>`
   for vanes/cocks and a `Set` of lantern cells. `tick(dt)`: count timers; every `TRINKET_SCAN_S` refresh `sky` with
   `openSkyAbove` (import from `src/game/weather.ts` - allowed: workshop already imports `../game/groundItems`); compute vane
   reading from `workshop.wind()` + `turbineW(y, strength)`; cock from `workshop.weatherAt(x,y,z)` + `cockReading`; emit
   `vane_creak` per 4.1/4.2; lanterns: active bit = `signals.gate(x, y, z)`, write only on change. `noteBlock`: register/unregister
   cells; for any changed cell, if the cell below is a `lantern_chain` and the changed cell is no longer solid (and not a chain),
   break the chain column (`world.setVoxel(.., 0, 'sim')`, `ground.spawn('lantern_chain', 1, ...)` per link).
8. **Workshop wiring.** `src/workshop/workshop.ts`:
   - construct `this.trinkets` after `signals`; pass `sourceOn: (k, x, y, z) => k === 'weather_cock' && this.trinkets.cockOn(x, y, z)`
     into the `Signals` host;
   - `noteBlock` -> `this.trinkets.noteBlock(x, y, z, kind)` (also for the gearshift: when a `sequence_gearshift` cell stops being
     one and `cards` has it, spawn the card item: preset key, or `punch_card` for blank/custom, then delete the row);
   - `tick` -> `this.trinkets.tick(dt)` after `this.signals.tick(this.clock)`;
   - `use`: the card branch (4.7 table) placed BEFORE the `CYCLES` branch; empty hand + card -> `this.bus.emit('ui:open', { screen:
     { type: 'gearshift', x, y, z } })` and return `'worked'`;
   - `solve` -> the `part(k)` callback returns `{ kind, s, prog }` when `cards` holds a program for `k` (preset: `prog` =
     `GEARSHIFT_PROGRAMS[PRESET_CARDS[item]]`; blank without program: `prog = [[1, 0]]`, i.e. never engages);
   - `setting()` and `describe()` per 4.7, using `stepAt(prog, this.clock)`;
   - `describe`: at the top, `const t = this.trinkets.describe(x, y, z); if (t) return t;`;
   - `view()` sets `out.vanes = this.trinkets.vanes()` (only when non-empty);
   - `toJSON/load/verify/relocate` for `cards` (7.2) and `this.trinkets.relocate(map)` / `verify()`;
   - `isMovable`: `|| kind === 'wind_vane'` (the cock is already movable through `SIGNAL_KINDS`);
   - `cardHost()` implementing `CardHost` (4.8); `punch` validates with `validCard` and sets `cards.get(k).prog`; `takeOut` gives
     the item through a NEW optional hook `giveToPlayer: ((item: string, n: number) => number) | null` set by Game
     (`player.inventory.add`), falling back to `ground.spawn` at the gearshift for the remainder.
9. **Game wiring** (`src/app/game.ts`, next to `clockText`):
   - `workshop.wind = () => ({ from: windDirAt(clock.worldTimeS), strength: this.state.sim.wind })`;
   - `workshop.turbineW = (y, w) => turbineWattsAt(machine('wind_turbine'), y, w)`;
   - `workshop.weatherAt = (x, y, z) => { const w = state.weather.state; const b = world.biomeAt(x, z); return { w, wetHere:
     wetAt(w, b, y), wetNext: wetAt({ ...w, kind: w.next, previous: w.next, blend: 1 }, b, y), snow: precipitationFor(w.kind, b, y)
     === 'snow' }; }` - avoid the object spread per call by keeping one scratch `WeatherState` object in the closure (the cock is
     read every 0.5 s per cock; fine either way, but no per-frame allocation in render paths);
   - `workshop.giveToPlayer = (item, n) => player.inventory.add(item, n)` (returns the number added - check `Inventory.add`'s
     return shape and adapt);
   - register the `'gearshift'` screen;
   - `showStationName`: before the goggles branch, `else if (hit && TRINKET_READ.has(hit.block.key) && (label =
     this.workshop.describe(hit.x, hit.y, hit.z)) !== null) { /* trinkets read without goggles */ }` where NEW
     `TRINKET_READ = new Set(['wind_vane', 'weather_cock', 'padlock_chest', 'lantern_chain'])` (export from `trinkets.ts`);
   - spyglass far label: when `this.controller.trinkets.raised`, the label is `this.controller.farLabel()` (below) and wins over
     everything else.
10. **Sim helpers.** `src/sim/machines.ts`: `windDirAt`, `WIND_TURN_S`, `turbineWattsAt` (+ `windTurbine` refactor). Padlock in
   `src/sim/endpoints.ts` `machineItemEndpoint`: if the entity is a crate and the voxel at its position is the `padlock_chest`
   block, return `slotEndpoint(e, inv, 0, size, 0, 0)`. Use the registry (`blockOrNull`) or the world voxel id via the existing
   `EndpointHost`; do NOT import `src/workshop` into `src/sim`. `cratesNear` is unchanged (stations borrow, 4.5).
11. **Logistics.** `src/workshop/logistics.ts`: `take` and `peek` - in the crate branch, `if (isLocked(this.host.world, x, y, z))
   return null` / `return []`; `wrench`: when the chosen SOURCE `isLocked`, toast and return `'refused'` without changing the
   setup.
12. **Mobs.** `src/mobs/types.ts` `calledS?`; `src/mobs/manager.ts` `callTame`; `advanceTimers` in `src/mobs/life.ts`
   counts `calledS` down; step 4 condition `liked || called`, range/dy checks skipped when `called`.
   `src/player/animals.ts` `AnimalTargets.callTame?`.
13. **Player.** NEW `src/player/trinketTools.ts` `HeldTrinkets`. `src/player/controller.ts`:
   - `readonly trinkets: HeldTrinkets` constructed with `options.animals ?? null`;
   - in `update`, right after the collectors line: `if (intent.use && this.trinkets.use(this.time, riding)) intent.use = false;`
     (`this.time` = a NEW accumulated seconds counter; `riding` from the existing vehicle wrapper - `wrapIntentSource` knows; if
     the controller cannot see it, add `PlayerControllerOptions.riding?: () => boolean`);
   - look scaling: when `this.trinkets.raised`, multiply `intent.lookYaw` / `intent.lookPitch` by `SPYGLASS_LOOK` before applying;
   - `sprintFov`: `target = this.trinkets.raised ? this.settings.fov / SPYGLASS_ZOOM : this.settings.fov + (sprinting ? SPRINT_FOV_KICK : 0)`;
   - `ui:opened`, `player:respawn` and death -> `this.trinkets.lower()`; `updateView` held-key change -> `lower()` when the new key
     is not `spyglass`;
   - NEW `farLabel(): string` - one `raycast(world, eye, dir, SPYGLASS_RANGE, false, this.farHit)` (a second reused `RayHit`), and
     `animals.raycast(..., SPYGLASS_RANGE)`; nearest wins; text per 6.1. Called by Game only while raised (once per frame at
     most, and Game's `showStationName` already de-duplicates by label).
14. **HUD overlay.** `src/ui/hud/`: NEW `spyglass.ts` (a div toggled by a `HudDeps.spyglass?: () => boolean` probe, or by a bus
   event `'spyglass:raised' { raised }` - prefer the probe: no new event type) with the CSS of 4.3.
15. **Screen.** NEW `src/ui/screens/workshop/cardText.ts` (pure: `cardSummary(item, prog)`, `factorChip(f)`, `nextFactor(f)`,
   `stripCells(prog)`, `playheadAt(prog, t)`) and `cardScreen.ts` (`createCardScreen(req, ctx, host)`), using `Window`, `h`,
   `Stepper` from `src/ui/screens/stepper.ts`. `ScreenRequest` member in `src/core/gameEvents.ts`.
16. **Audio.** NEW or appended `src/audio/sfxWorkshop.ts` (`WORKSHOP_SFX`), merge in `src/audio/sfx.ts`, `SfxName` names,
   `sfx.test.ts` count.
17. **Render.** `src/render/workshop/` renderer: vane arrows from `view.vanes` (4.1); `src/render/weatherFx.ts` optional
   `windFrom` argument + `towardsAngle` helper; `Renderer` passes `windDirAt(clock.worldTimeS)`.
18. **Objectives.** `src/content/objectivesWorkshop.ts`: `export const WORKSHOP_SIDE_GOALS: ObjectiveSpec[] = [goal('read_the_wind',
   'Read the wind', { type: 'place', block: 'wind_vane', count: 1 }, '<text of 4.1>')]`; Unit 0's `objectivesSide.ts` spreads it.
   NOT added to `WORKSHOP_OBJECTIVES` (6d: no side goal in the sequential track). Roster `objectives` unchanged.
19. **Guide text.** Append the Rules line (6.1) to `RULES` in `src/ui/screens/workshop/workshopScreen.ts`.
20. **Docs** (section 11) and **e2e** (section 10).

Helpers to reuse, not rewrite: `openSkyAbove`, `wetAt`, `precipitationFor`, `windAt`, `raycast`, `Stepper`, `Window`, `h`,
`withActive`/`voxelActive`, `ground.spawn`, `goal()` in objectivesWorkshop.ts, `forge()`/`bench()` in recipesWorkshop.ts, the
`Collectors.trigger` shape, `Logistics.wrench`'s toast style.

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest, co-located)

**`src/workshop/kinetics.test.ts`** (append):
1. `stepsFactor` equals `gearshiftFactor` for each preset at t = 0, 0.5, 3.9, 4, 5.9, 6, 13 (and negative t).
2. `stepAt([[3, 1], [1, 0], [3, -1], [1, 0]], 4.5)` -> `{ index: 2, factor: -1, leftS: 2.5 }`.
3. `passOn({ kind: 'sequence_gearshift', s: 0, prog: [[2, 2], [2, -0.5]] }, 16, 1)` = 32; at t 3 = -8; a `[[1, 0]]` prog -> null.
4. `encodeCard(GEARSHIFT_PROGRAMS[1])` = `'3:1,1:0,3:-1,1:0'`; `decodeCard` round-trips every preset.
5. `decodeCard` sanitises: `'9:1,2:3,0:1,2:x,2:-2'` -> `[[2, -2]]`; 9 valid steps -> 8; `''`, `42`, `null`, `'abc'` -> null.
6. `validCard` false for 0 steps, 9 steps, seconds 0 or 9 or 1.5, factor 3; true for 8 x `[8, 2]` (64 s).
7. solveNetwork: crank -> gearshift with `prog [[1, 2]]` -> millstone runs at 32 rpm; stress of the millstone part = `4 * 0.5`.

**`src/workshop/trinketText.test.ts`** NEW:
8. `windWord`: 0.25 calm, 0.35 light, 0.6 fresh, 0.8 strong, 1.0 strong, 1.4 gale.
9. `compassWord`: 0 north, pi/4 north-east, pi east, 3pi/2 west, 2pi - 0.1 north, 22.4 deg north, 22.6 deg north-east.
10. `vaneLine` exact strings: `{ from: 3pi/2, strength: 0.6, sheltered: false, turbineW: 680 }` ->
    `'Wind Vane - wind from the west, fresh (0.6), turbine 680 W'`; turbineW 1520 -> `turbine 1.5 kW`; sheltered ->
    `'Wind Vane - sheltered, no wind reaches it'`. Every produced line for a grid of inputs is <= 66 chars.
11. `cockReading` - one case per table row of 4.2, exact `text` and `on`, including: `nextInS` 119 -> `rain in about 2 min, signal
    on`; 121 -> `dry, rain in about 2 min`, off; 45 -> `rain in under a minute`; storm next -> `storm in about ...`; hold 25 ->
    `clearing, signal off in 25 s`; `sky: false` beats `wetHere: true`; `snow: true` -> `snowing`.
12. `wattsText`: 0 -> `0 W`, 684 -> `680 W`, 994 -> `990 W`, 996 -> `1.0 kW` (round to 10 W first; 1000 W or more -> kW with one
    decimal), 1520 -> `1.5 kW`.

**`src/workshop/trinkets.test.ts`** NEW (use `setup()` from `src/workshop/parts.test.ts` - export it if it is not exported, or the
existing fake-world helpers there):
13. A weather cock with `weatherAt` stubbed to rain powers a wire 3 blocks long and a signal lamp at its end is lit
    (`describe` of the lamp contains `on`); with stub dry and `nextInS` 600 the lamp is off.
14. Hold: rain stub on, tick 1 s, stub dry: the cock stays on for 30 s (on at 29.5, off at 30.5).
15. Cock under a block: off, line `under a roof`.
16. Wind vane line uses the `wind` and `turbineW` stubs; `vane_creak` is emitted once when the sector changes and not again
    within 6 s (count `sfx` events on the bus).
17. Lantern chain: plain -> active bit on after one tick; a lever-wire touching it, lever off -> dark, lever on -> lit.
18. Lantern support: two chains hanging under a stone; remove the stone -> both cells air and 2 `lantern_chain` ground items.
19. `isLocked` true only for `padlock_chest`.

**`src/workshop/logistics.test.ts`** (append):
20. A padlock chest entity holding 5 iron: `logi.take(...)` null, `logi.peek(...)` `[]`, `logi.accept(..., 'stick', 3)` = 3.
21. Arm wrench: choosing the padlock chest as source -> `'refused'` and a warn toast with the exact text; as a target -> accepted.
22. Conservation: an arm moving from a crate to a padlock chest for 60 s - items in crate + chest + arm = constant.

**`src/workshop/workshop.test.ts`** (append):
23. Use a `punch_card_swing` on a gearshift: the card leaves the hand (takeHeld(1)), `describe` shows `Swing card`; Use a
    `punch_card_pulse`: swap - the swing card is given back (`giveToPlayer` stub called with `punch_card_swing`).
24. Empty-hand Use on a gearshift with a card emits `ui:open { type: 'gearshift' }`; without a card it cycles (toast
    `Gearshift program 2 of 3`) - the old behaviour.
25. `cardHost().punch(x, y, z, [[2, 2], [1, 0]])` on a blank -> true; the net beyond runs at 32 rpm during the first 2 s of the
    loop; invalid program -> false and nothing changes.
26. `takeOut` of a custom card gives `punch_card` and the gearshift goes back to its dial program.
27. Breaking a gearshift with a preset card spawns that card item; with a custom card spawns `punch_card`.
28. Save round trip: preset and custom cards survive `toJSON` -> `load`; a snapshot with no `cards` loads with dial programs; a
    damaged row (`[1, 2, 3, 'not_a_card']`, `[1, 2, 3, 'punch_card', 'zz']`) is skipped / becomes blank.
29. `relocate` moves a card with its gearshift.

**`src/mobs/manager.test.ts`** or the herd fixtures in `src/mobs/herd.test.ts` (append):
30. Two tame goats at 20 and 40 blocks and one wild goat at 10: `callTame(..., 32, 20)` returns 1 and only the near tame goat has
    `calledS` 20; after ticking 10 s with the player 15 blocks away and holding nothing, the called goat has moved closer
    (distance decreased by > 5 blocks); after 21 s it no longer follows (state not `follow`).
31. A mob with `harness` set is skipped.

**`src/player/trinketTools.test.ts`** NEW (use `src/player/testKit.ts`):
32. Use with spyglass toggles `raised`; uses at 0.25 s spacing (a held button) toggle once; a use 0.5 s after the last toggles back.
33. Raised -> the controller's fov becomes `settings.fov / 4` within 1 s (use `controller.test.ts`'s view stub); slot change
    lowers and restores `settings.fov`.
34. Look scale: with raised, a `lookYaw` of 0.4 turns the yaw by 0.1.
35. Horn: `use` calls `callTame` with (feet position, 32, 20); a second use within 6 s does not call and toasts
    `Catch your breath - N s`.
36. Riding: spyglass `use(.., riding = true)` toasts `Not while riding` and does not raise.

**`src/sim/machines.test.ts`** or `power.test.ts` (append):
37. `windDirAt` is deterministic, in `[0, 2pi)`, and changes by less than 0.05 rad over 1 s; at t = 0 `compassWord` is `west`.
38. `turbineWattsAt(machine('wind_turbine'), 60, 1)` = 750 (1500 x 1 x clamp(20/40)) and the turbine behaviour test still passes.

**`src/render/weatherFx.test.ts`** (append): 39. with `windFrom` given, the slant points away from the source (4.1).

**`src/ui/screens/workshop/cardText.test.ts`** NEW: 40. `cardSummary` strings of 4.8; `nextFactor` cycles in the order forward ->
double -> half -> stop -> half back -> reverse -> double back -> forward; `stripCells` length = loop seconds.

**Content tests.** `specRosterWorkshop.ts` updated (step 4) so `content.test.ts` roster equality passes; recipe count follows;
`content.test.ts` progression still completes (no trinket is on the spine; the solver must also find every new item obtainable);
`gates.test.ts` untouched; texture readability test passes for the 12 new textures; `src/audio/sfx.test.ts` count includes
`WORKSHOP_SFX`; the registry check accepts `padlock_chest` pointing to `crate`.

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E - `scripts/e2e-workshop.mjs` (run `node scripts/e2e-workshop.mjs --device=desktop`; for the card screen also
`--device=phonePortrait`; no `HW_GPU`)

Add three named steps before `'no page errors'`, in the file's style (`d.hw` for setup/reading, real input for actions,
`d.shot` screenshots into `test-results/e2e-workshop/`). Coordinates relative to `P.x0/P.gy/P.z0` in a free strip (e.g.
`x0 + 12`); the builder checks the yard has room.

**Step A - `'a weather cock signals rain to a lamp and a vane reads the wind'`**
1. Setup (`__hw`): stone pillars `(x, gy..gy+1, z)` and `(x, gy..gy+1, z+2)`; a `weather_cock` at `(x, gy+2, z)`, `signal_wire`
   at `(x+1, gy+2, z)` resting on a stone at `(x+1, gy+1, z)`, a `signal_lamp` at `(x+2, gy+2, z)` on a stone; a `wind_vane` at
   `(x, gy+2, z+2)`; nothing above any of them; `__hw.setWeather('clear')`; `__hw.tick(2)`.
2. Assert: `workshop.describe` of the lamp contains `off`; of the cock matches `/^Weather Cock - dry/`.
3. `__hw.setWeather('rain')` (instant), tick 1 s. Assert lamp `on`, cock line `Weather Cock - raining, signal on`.
4. Real input: `teleport` 3 blocks from the vane, `lookAt` the vane, WITHOUT goggles in the pack; read the crosshair text from the
   HUD DOM (the target-name element `ui.setTargetName` writes) and assert it matches
   `/^Wind Vane - wind from the [a-z-]+, (calm|light|fresh|strong|gale) \(\d\.\d\), turbine/`. Screenshot `9-vane-cock`.
5. `setWeather('auto')` at the end.

**Step B - `'a punched card drives a mixer forward and back; the spyglass and horn work'`**
1. Setup: crank -> `sequence_gearshift` -> shaft -> `millstone` (any consumer whose `describe` shows signed rpm) in a line.
   `give` the player 1 `punch_card` (via the existing `__hw` give helper or inventory add), select it.
2. Real input: `lookAt` the gearshift, `d.use()`: the card goes in and the card screen opens (`page.waitForSelector('.hw-card')`).
3. Real input in the screen: click the first row's factor chip once (forward -> double), click `+ Add step`, click the new row's
   chip until it reads `reverse` (forward -> ... -> reverse = 5 taps), click `Punch card`. Screenshot `10-card-editor`
   (desktop) - and in the `--device=phonePortrait` run, the same steps with taps; assert every button's bounding box is >= 44 px
   tall and the window fits 390 px wide with no horizontal scroll.
4. Close (Escape). Crank for 10 s in 0.5 s ticks (`w.crank` as the existing steps do) and sample the millstone's `describe` each
   tick: assert one sample matches `/(left|right) 32 rpm/` and another `/(left|right) 16 rpm/` with the OTHER direction word
   (program: double 4 s, then reverse 4 s - both new rows default to 4 s, so both phases occur within any 10 s window).
5. Spyglass: give + select `spyglass`, `d.use()`; assert `renderer`'s fov (via `__hw.state()` or `app.game.renderer` camera fov)
   is within 1 deg of `settings.fov / 4` after 1 s; the `.hw-spyglass` overlay is visible; screenshot `11-spyglass`; `d.use()`
   again -> fov back.
6. Horn: spawn a tame goat 20 blocks away (`__hw` mob spawn helper with `tame = true`; if none exists, add `__hw.spawnMob(kind,
   x, y, z, tame)` to the dev hooks - a dev-only hook is allowed), give + select `brass_horn`, `d.use()`; assert the toast
   `1 animal answers the horn` appears; tick 8 s; assert the goat is closer than 12 blocks.

**Step C - `'a padlock chest takes from an arm but gives nothing back'`**
1. Setup: a crate with 8 `stick` -> `mech_arm` -> a padlock chest (arm wrench setup through `workshop.use` with a held wrench, as
   the existing arm step does), crank on the arm.
2. Tick 10 s cranking: assert the padlock chest holds 8 sticks (`__hw` machine slots read) and the crate 0.
3. Re-wire a second arm from the padlock chest to a depot: assert the wrench step toasts
   `The Padlock Chest is locked - an arm cannot take from it` and the depot stays empty after 10 s.
4. Real input: look at the padlock chest, `d.use()` empty-handed: the crate screen opens with heading `Padlock Chest`; screenshot
   `12-padlock`; Escape.

The final `'no page errors'` step stays last and must pass.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/workshop.md`: "what exists" gains the trinkets (vane, cock as a signal source with its timing, padlock rule table,
  lantern chain), punch cards (presets, limits, encoding, the card slot table, the screen), `windDirAt`/`turbineWattsAt`, the new
  hooks on `Workshop` (`wind`, `weatherAt`, `turbineW`, `giveToPlayer`, `cardHost`, `trinkets`), `WorkshopSnapshot.cards`,
  `WorkshopView.vanes`, and which J5 contraption works (piston gated, or clutch flipped - 4.2).
- `docs/api/weather.md`: the weather cock reads `next`/`nextInS`/`wetAt`; wind now has a direction (`windDirAt`) that the rain
  slant follows.
- `docs/api/mobs.md`: `callTame`, `Mob.calledS`, brain step 4 change.
- `docs/api/player.md`: spyglass (zoom, look scale, far label, auto-lower rules), horn, `HeldTrinkets`.
- `docs/api/sim.md`: `windDirAt`, `WIND_TURN_S`, `turbineWattsAt`; padlock endpoint (in only).
- `docs/api/audio.md`: `sfxWorkshop.ts` names (`horn_call`, `vane_creak`, `card_punch`).
- `docs/api/content.md` (or the workshop content doc): new keys and recipes.
- Never `docs/WHATS_LEFT.md` (coordinator). Do not edit `docs/build/SYSTEMS.md` (coordinator merges section 14).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] 4 blocks + 6 items exist with the exact names, descs, stacks, ages (`ageIndexOf('bronze')`) and recipes of section 4; all in
      `specRosterWorkshop.ts`; content tests green.
- [ ] A wind vane under open sky shows `Wind Vane - wind from the <compass>, <word> (<n.n>), turbine <W>` in the crosshair
      WITHOUT goggles; under a roof `sheltered`; the arrow turns smoothly and creaks at most every 6 s.
- [ ] `windDirAt` is deterministic on world time; the rain slant follows it.
- [ ] A weather cock signals while wet and from 120 s before rain is due, holds 30 s after, never under a roof; a wired lamp
      lights and a bell rings once; the cock's comb glows while on.
- [ ] J5 contraption (cock -> wire -> gated piston or flipped clutch -> framed roof) is built in the e2e or documented with the
      working variant in workshop.md.
- [ ] Spyglass: Use toggles x4 zoom with look scaled 1/4; held Use toggles once; lowers on slot change / screen / death; far label
      to 96 blocks; overlay never covers hotbar or touch buttons; refused while riding.
- [ ] Brass horn: calls tame, non-harnessed, loaded animals within 32 blocks for 20 s, 6 s cooldown, exact toasts, `horn_call`
      at 1.4.
- [ ] Padlock chest: arms, funnels, chutes, golems (via `take`) and pipes never take out; deliveries in work; player screen and
      station borrowing work; arm source refusal toast; heading reads `Padlock Chest`.
- [ ] Lantern chain: lights 14 when unsignalled or signalled-on, dark when its signal is off; hangs only; falls when unsupported.
- [ ] Cards: preset cards run their programs; swap returns the old card; a blank opens the editor; punched programs (<= 8 steps,
      1-8 s, 7 factors) run; custom cards come out blank; cards drop when the gearshift breaks; no card = old dial behaviour.
- [ ] Card editor usable at 390 x 844 and 844 x 390, all targets >= 44 px, no horizontal scroll, playhead live.
- [ ] Save: `cards` round-trips; old saves load; damaged rows are skipped; nothing else new is saved.
- [ ] Sounds: three new names in `SfxName`, `WORKSHOP_SFX`, `sfx.test.ts` count; no idle loops.
- [ ] Side goal `read_the_wind` completes on placing a wind vane (with Unit 0's mechanism).
- [ ] `npm test` green; `npm run typecheck`/build green; e2e-workshop desktop green with screenshots 9-12; phonePortrait run of
      step B green.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Copying a custom program to another card or gearshift (a "card press" or wrench copy). A later unit can add a
  `punch_card_copy` flow; this spec keeps programs on the drum because stacks carry no metadata.
- Cards for anything but the `sequence_gearshift` (metronome rhythms, arm schedules). SYSTEMS T4: "one consumer is enough".
- A visible card sticking out of the gearshift model.
- Keys, owners or multiplayer locks for the padlock chest; a lockable vault (Unit 15's vault groups stay open).
- Seeded wind direction per world; wind direction affecting turbine output (turbines stay omnidirectional; the vane advises on
  strength and height, the direction is information and drives the rain slant).
- Spyglass on a tripod / mounted telescope block; zoom levels other than x4.
- Horn calling wild animals, scaring hostiles, or summoning golems (golems are set up with the wrench - Unit 17).
- Lantern fuel, lantern warmth, a chain you climb.
- Weather cock forecasts longer than the timetable's next change (it reads `next` only, like the Hearth Log).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **Name clash: `MobManager.call` already exists (private, plays an animal's voice).** This spec names the horn method
   `callTame(x, y, z, radius, seconds)`. Please change SYSTEMS T6 and 6.2 from `MobManager.call` to `MobManager.callTame`.
2. **Padlock rule = letterbox.** "Anything may put things in; only a player's hand takes them out" (4.5). SYSTEMS T6 "Padlocked
   chests are skipped" should read "skipped as a source" so Unit 17 refuses a padlock chest only as a golem SOURCE (2.3).
3. **T4 row for punch cards:** presets also get workbench recipes (`1 punch_card + 1 flint`) so the progression solver and the
   Codex see them; the gearshift screen can punch a blank into a preset too. Custom programs live on the gearshift block
   (`WorkshopSnapshot.cards`), and a custom card comes out blank. Please amend the T4 row's "made by" text accordingly.
4. `WorkshopView.vanes?` is a new OPTIONAL member next to Unit 0's `moving` (SYSTEMS 6.5 allows optional members).
5. `src/audio/sfxWorkshop.ts` is shared with Units 13 and 14: first to land creates it (2.3 item 4).
6. `BlockSpec.hangs?` is a new optional field (lantern chain); nobody else needs it.
7. Unit 4's hot-item refusal covers the padlock chest automatically (it is a crate entity). No rig legend letters are used by this
   unit.
8. Verified existing (grepped 2026-11-22): `PART_DEFS`, `NON_KINETIC`, `PART_ITEMS`, `PART_BLOCKS`, `WORKSHOP_RECIPES`,
   `WORKSHOP_SPEC` (`textures: 93`), `WORKSHOP_OBJECTIVES`, `goal()`, `GEARSHIFT_PROGRAMS`, `gearshiftFactor`, `passOn`, `KPart`,
   `BASE_STRESS`, `solveNetwork`, `CYCLES`, `Workshop.use/describe/setting/toJSON/load/verify/relocate/noteBlock/isMovable/
   clockText/standingOn/fluidBlock`, `WorkshopSnapshot`, `WorkshopView`, `SIGNAL_KINDS`, `SIGNAL_RANGE`, `Signals.gate/near/
   flips/describe/tick`, `SignalHost`, `BELL_RANGE`, `Logistics.take/peek/accept/wrench/crateAt`, `windAt`, `Simulation.wind`,
   `WEATHER_WIND`, `WeatherState.next/nextInS`, `wetAt`, `openSkyAbove`, `precipitationFor`, `WeatherFx.windAngle`,
   `SPRINT_FOV_KICK`, `sprintFov`, `USE_REPEAT_S`, `Collectors.trigger`, `MOB_FOLLOW_RANGE`, `MobManager.feed/tick`,
   `AnimalTargets`, `crate` block/machine (`CRATE_SIZE` 27, `STATION_CRATE_RADIUS`), `cratesNear`, `machineItemEndpoint`,
   `createCrateScreen`, `ScreenRequest`, `SfxName`, `ScreenContext.world`, `Stepper`, `Window`, `torch` (light 13),
   `magic_light` (light 14), `BlockSpec.lightActive`, `ageIndexOf`, `RULES` in workshopScreen.ts, `STATIC` in
   iconsWorkshopParts.ts. Everything else named in this file is marked NEW.
