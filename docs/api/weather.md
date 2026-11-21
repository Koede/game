# Day, night and weather (spec 15) - the weather feature end to end

A seeded, saved weather system that every part of the game reads: the sky and the ground darken and grey under
cloud, rain / snow / blown dust fall around the camera and stop under roofs, the ground looks wet after rain,
storms flash lightning with thunder delayed by distance, the moon goes through its phases and lights each night
accordingly, stars turn; solar panels, wind turbines, exposed furnaces, crops and the player's warmth all feel it;
the HUD dial shows the weather and tonight's moon, and the Hearth Log reads the forecast.

Contracts it builds on (all pre-existing, unchanged): `WeatherState` (src/core/types.ts), the `WEATHER_*` / moon /
lightning constants (src/core/constants.ts), the lookups in src/core/weather.ts, events `weather:changed` /
`weather:lightning`, sfx `thunder`, `AmbienceState.rain / storm / sheltered` and their audio layers
(docs/api/world-content.md). Nothing was added to src/core or src/audio.

Tests: `npx vitest run src/game/weather.test.ts src/game/clock.test.ts src/game/survival.test.ts src/sim/weather.test.ts src/render/weather.test.ts src/ui/hud/weatherText.test.ts src/app` (16 + 2 + 3 + 9 + 8 + 5 new tests, plus 2 in src/app).

## The model - src/game/weather.ts, src/game/weatherSchedule.ts (DOM-free)

```ts
// weatherSchedule.ts
interface WeatherSegment { index; kind: WeatherKind; startS; lengthS; blendS }
const WEATHER_KINDS: readonly WeatherKind[]          // ['clear', 'cloudy', 'rain', 'storm'] (draw order)
drawWeather(r: number): WeatherKind                  // r in [0,1) -> a state by WEATHER_CHANCE
drawDryWeather(r: number): WeatherKind               // r in [0,1) -> clear or cloudy, in WEATHER_CHANCE proportion
const DRY_UNTIL_S = DAY_LENGTH_S                     // segments starting before the first dawn are always dry
class WeatherSchedule {
  constructor(seed: number)
  segment(index: number): WeatherSegment             // generated on demand and kept; segment 0 is always clear
  at(timeS: number): WeatherSegment                  // segment holding world time timeS (cursor walks forward; back = restart)
  previousKind(seg): WeatherKind                     // the state a segment changes from
  nextChange(seg, kind): WeatherSegment              // first later segment whose state differs from kind
}
```
Segment i: kind `drawWeather(hashFloat(seed, i, 1))` (`drawDryWeather` of the same number when the segment starts
before `DRY_UNTIL_S`, world time 900 s = the first dawn: night 1 never rains, review gc-1), length `WEATHER_MIN_S + hashFloat(seed, i, 2) * (MAX - MIN)`,
blend `WEATHER_BLEND_MIN_S + hashFloat(seed, i, 3) * (MAX - MIN)` - exactly the schedule world-content suggested.
Drawing the current state again extends it (no blend, no event).

```ts
// weather.ts
type WeatherBiomeLookup = (x: number, z: number) => BiomeKey
interface ForcedWeather { kind; previous; startS; blendS; untilS }
interface WeatherSnapshot { state: WeatherState; forced: ForcedWeather | null; flashes: number; nextFlashS: number }
FORCED_WEATHER_S = 720, FORCED_BLEND_S = 8, RELEASE_BLEND_S = 30, PRECIP_FADE_S = 2, BIOME_SAMPLE_S = 0.5, LIGHTNING_FROM = 0.5

createWeatherState(): WeatherState                   // clear, settled, full moon
fallingKind(w): WeatherKind                          // the wet one of kind/previous (rain keeps falling while it clears)
skyIntensity(w): number                              // weatherValue(WEATHER_INTENSITY, w), before any local fade
stormLevel(w): number                                // 0..1 how much storm the sky holds (lightning, gusts)
wetAt(w, biome, y): boolean                          // isWet(precipitationFor(fallingKind(w), biome, y), skyIntensity(w))
openSkyAbove(world: IWorld, x, y, z): boolean        // nothing solid or liquid above the cell (plants, torches, cables let rain through)
isWeatherSnapshot(v: unknown): v is WeatherSnapshot  // structural check for saves

class Weather {
  constructor(seed: number, bus: GameBus | null, biomeAt: WeatherBiomeLookup)
  readonly state: WeatherState                       // ONE live object, mutated in place: hand it to readers once
  readonly schedule: WeatherSchedule
  get override(): Readonly<ForcedWeather> | null     // the debug override, if active
  get biomeHere(): BiomeKey                          // biome at the player as last sampled
  update(dt, timeS, day, place: {x, y, z}): void     // timeS = GameClock.worldTimeS, day = GameClock.day (1-based), place = player feet; dt 0 settles fades
  force(kind, timeS, instant = false): void          // hold `kind` for FORCED_WEATHER_S (eased in over 8 s, or at once)
  release(): void                                    // end the override now; the timetable eases back in over 30 s
  toJSON(): WeatherSnapshot; load(s: WeatherSnapshot): void
}
```
- `state.kind / previous / blend` from the timetable at `timeS` (blend smoothstep-eased), `next` = the next DIFFERENT
  state, `nextInS` = seconds until it begins (to the end of an override while one holds).
- `precipitation` at the player: `precipitationFor(fallingKind, biome at the player, player y)`; when it changes
  underfoot (walking from dunes to woodland) the old one fades out and the new one in over `PRECIP_FADE_S`.
  `intensity` = `skyIntensity * fade` (0 when nothing falls). `cloudCover` = WEATHER_CLOUD_COVER eased.
- `moonPhase` = `moonPhase(day - 1)`: tonight's moon, changes at sunrise; day 1 is full, day 5 new.
- Emits `weather:changed { kind, previous }` once when `kind` changes (not on load, not for a repeated draw).
- Storms: while `stormLevel >= 0.5`, a flash every LIGHTNING_MIN_S..MAX_S (seeded per flash index) at
  LIGHTNING_MIN..MAX_DIST (biased near: `min + r^2 * range`), random bearing; emits `weather:lightning`, then after
  `distance / SOUND_SPEED` s the `sfx thunder` with world-content's volume/pitch rule, never positioned. Thunder
  overdue by more than 10 s (time jumped, e.g. a rested night) is dropped.
- Time going backwards under an override (debug clock changes) keeps the override, already settled.

### Night light follows the moon - src/game/clock.ts (changed)
- `sunlightAt(timeOfDay, night = NIGHT_SUNLIGHT, lastNight = night)` - the dawn ramp starts from `lastNight`.
- `nightSunlight(day): number` = `nightLight(moonPhase(day - 1))` (0.04 new .. 0.12 full).
- `GameClock.sunlight()` now uses tonight's level (and last night's for the dawn ramp); `GameClock.moonPhase` getter.
  `NIGHT_SUNLIGHT` (0.08) stays as the average for code that wants one number. Solar panels need > 0.15, so moonlight
  never powers them; crops need 0.3, so nothing gameplay-relevant changes at night beyond brightness.

### Rain chill - src/game/survival.ts (changed)
- `survival.weather: WeatherState | null` (set by GameState), `survival.wet: boolean` (rain or snow is soaking the
  player as of the last tick).
- `WARMTH_DRAIN_WET` (0.3/s) is added to the drain when `isWet(state.precipitation, state.intensity)` and
  `openSkyAbove` at the player's head (sampled with the 0.5 s scan). Inside a heat radius the flat +4/s still wins;
  the padded coat and Well-Warmed halve it like every other drain. Dust and drizzle (< 0.25) never chill.

## Gameplay - src/sim/weather.ts + hooks

```ts
type SimBiomeLookup = (x: number, z: number) => BiomeKey
class SimWeather {                         // sim.weather
  solar: number; wind: number              // this tick's WEATHER_SOLAR / WEATHER_WIND multipliers (eased)
  get soaks(): boolean                     // strong enough rain/snow falls somewhere this tick
  use(weather: WeatherState | null, biomeAt: SimBiomeLookup | null): void
  update(): void                           // once per tick (Simulation.tick calls it)
  wetAt(x, y, z): boolean                  // rain/snow soaks an exposed block there (biomes cached per column)
  furnaceLoss(node: SimNode): number       // FURNACE_WET_LOSS_MULT when its column is open and wet, else 1
}
Simulation.useWeather(weather: WeatherState | null, biomeAt: SimBiomeLookup | null): void   // GameState calls it
Simulation.solar: number                   // part of SimContext now
FurnaceView.rainChilled: boolean           // + targetC accounts for the extra loss; status gets " - rain chills it, build a roof"
```
- Solar panel: `outputW * sunlight * ctx.solar` (threshold still on raw sunlight). Wind turbine: `ctx.wind` already
  includes `WEATHER_WIND` (1.5x in a storm, may pass the rated output - as the constant's doc says).
- Furnace: `applyFurnace(node, ctx, dt, lossMult = 1)` multiplies `lossWPerC` by `sim.weather.furnaceLoss(node)`.
  Furnaces now get `openSky` in surroundings.ts (`SKY` gained 'furnace': a block placed anywhere above re-checks it).
- Crops: `CropContext.wetAt` (null when nothing soaks); `isHydrated = water in reach || (rain-exposed && wetAt)`. A
  crop caches `rain` (nothing solid/liquid above) separately from `sky` (nothing opaque above): a glass roof lets the
  daylight in and keeps the rain off. `CropField.tick(dt, sunlight, wetAt?)`, `view(..., wetAt?)`.

## Render - src/render

```ts
Renderer.setWeather(weather: WeatherState | null): void   // pass the live state once; lightning comes from 'weather:lightning'
ClockLike.day?: number                                    // turns the star field (GameClock has it)
RenderStats.precipitation: number                         // particles drawn last frame
RenderStats.weatherMs: number                             // CPU ms of the weather part of render() (roof mask included)
WorldUniforms.uWet                                        // how soaked sky-exposed surfaces look, 0..1
```
- skyModel.ts: `computeSky(t, sunlight, out, night = NIGHT_SUNLIGHT)`; `applyWeather(out, SkyWeather)` (pure,
  allocation-free) greys and darkens dome, fog and daylight with cover (WEATHER_DAYLIGHT by day), sets the moonlit
  floor by phase (x0.75 new .. x1.25 full, less under cloud), hides stars and dusk glow under cloud, hazes the
  horizon sand-coloured in dust and pale in snow, adds the lightning flash. `SkyState` gained `cover`, `storm`, `flash`.
- weatherFx.ts: `WeatherFx` turns the state into per-frame numbers: sky inputs, `nightLevel`, precipitation and
  amount, `wet` (soaks in 12 s, dries in 90 s, rain only), wind angle, flash envelope (`flashEnvelope(age)`: strike +
  second strobe, 0.9 s) and bolt (bearing, alpha, seed, closeness).
- sky.ts: pixel-disc moon (12 cells) drawn in its phase with an upright terminator and a faint earthshine side;
  stars are round dots in a field turning about the pole (STAR_TURNS_PER_DAY); sun and moon veiled by cover; a
  jagged bolt hangs from the cloud base at the flash's bearing; clouds sample a second, finer octave on a 4-block
  grid (stepped edges), thicken with cover into one grey deck, darken underneath and drift faster in storms.
- precipitation.ts: `PrecipitationLayer` - one instanced draw call (5000 desktop / 3200 touch particles in the
  pool, `intensity` draws that share; snow x1.6), motion entirely in the vertex shader (a box of drops wrapping
  around the camera, so particles keep their place as you walk). Rain: streaks along the slanted fall; snow:
  swaying round flakes; dust: flat wisps blowing along the wind, box centred 2.5 below the eye. Nearest 1.2 blocks
  culled, edge of the box faded. Lit by the sky light (flash included).
- rainMask.ts: `RainMask` + `rainTop(world, x, z)` - a 64x64 toroidal height map of where rain stops (first solid or
  liquid block from the top) around the camera, uploaded as a texture; the particle shader hides every particle
  below its column's height. Moving re-measures only the entering strips; `block:changed` and `chunk:meshed` queue
  their columns; 256 columns per frame at most.
- chunk shader: `uWet` darkens fully sky-lit, non-emissive, non-liquid surfaces up to 20% and adds a sky-coloured
  fresnel sheen on up-facing ones (derivative normal in a uniform branch). Fog closes in by up to 30% in rain/snow
  and 55% in a dust wind.

## Audio feed - src/app/ambience.ts
`new AmbienceProbe(world, player, clock, weather?: WeatherState | null)`: `rain` = intensity while precipitation is
'rain' (snow is silent), `storm` = dust intensity in a dust wind else `stormLevel`, `sheltered` = `!openSkyAbove`
at the eye (4 Hz). The layers and the thunder patch were already in src/audio.

## UI - src/ui
- `GameUIDeps.weather?: () => WeatherState | null`, `ScreenContext.weather: WeatherState | null`,
  `HudDeps.weather?: () => WeatherState | null` (all optional; nothing breaks without them).
- `DayDial.update(timeOfDay, day, weather = null)`: weather glyph in the middle of the face (cloud; rain drops; snow
  flakes; storm cloud with a bolt; dust streaks; nothing when clear), the sky half greys with the weather, at night
  the body is tonight's moon in its phase, and by day the "night in" countdown shows tonight's moon (with craters
  so a full moon reads as a moon). Aria label / title name the weather and tonight's moon.
- `src/ui/hud/weatherText.ts` (pure): `weatherGlyph(w)`, `weatherWord(g)`, `moonName(phase)`,
  `moonPath(phase, cx, cy, r)` (SVG path of the lit part), `forecast(w): { line, when }` - "Rain within the hour"
  when the next state is rain or a storm (", a storm is brewing" for a storm), "Clearing within the hour", "The rain
  will grow into a storm", "Clouds gathering - but no rain yet", "Clear skies ahead"; `when` = "Change in about N min".
- status.ts also exports `weatherIcon(glyph, size)` and `moonArt(phase, size)`.
- `HearthLogView(objectives, weather?: () => WeatherState | null)`: a forecast card under the current goal (glyph,
  "The sky: Rain", the forecast line, "Change in about 4 min · Tonight: <moon> full moon"). The standalone log
  and the furnace's LOG tab both pass it (one-line change in furnaceScreen.ts).

## Wiring - src/app
- `GameState.weather: Weather` - created with `(world.seed, bus, world.biomeAt)`, loaded from `save.weather` when it
  passes `isWeatherSnapshot` (a missing or damaged one is ignored: the sky follows from seed and time), updated
  once before anything reads it. Tick order: clock -> **weather** -> sim -> survival -> objectives.
  `sim.useWeather(weather.state, biomeAt)`, `survival.weather = weather.state`.
- `WorldSave.weather?: WeatherSnapshot` (optional; old saves load; isWorldSave does not require it).
- `Game`: `renderer.setWeather(state.weather.state)`, GameUI `weather: () => state.weather.state`,
  `new AmbienceProbe(world, player, clock, state.weather.state)`.
- `window.__hw.setWeather(kind: 'clear' | 'cloudy' | 'rain' | 'storm' | 'auto', instant = true)` (holds it 12 min;
  'auto' hands back to the timetable), `__hw.setDay(day)` (the moon follows), `__hw.state().weather` (the state plus
  `forced`).

## Verified in the real game (headless Chromium, SwiftShader, seed 1234)
Screenshots at 1280x800 and 390x844 (touch) of: clear noon, sunset, full-moon night, new-moon night, waning moon
rising, cloudy, rain in woodland, storm by day and by night each with a lightning flash, snow in the frostfell,
dust in the dunes, rain stopping under a plank roof (the ambience reported `sheltered: true`, survival `wet: false`
with warmth rising), the Hearth Log forecast card, and the HUD dial in each (cropped at 4x on the phone). Iterated on
them: pixel-disc moon with an upright terminator, round turning stars, stepped cloud edges with a finer octave, a
toned-down flash so the bolt reads, denser rain and snow, sand wisps instead of blobs, and a brighter moonlit floor
after the first phone pass showed new-moon and storm nights too dark to read.

Cost (rain particles < 1 ms per frame):
- CPU: `fx + uniforms` 0.002-0.005 ms per frame; roof mask 0.02-0.04 ms per block the camera crosses (one strip of
  64 columns; a sprint crosses ~0.1 block per frame), `RenderStats.weatherMs` reads 0.0-0.1 ms (the page clock is
  coarsened to 0.1 ms).
- GPU, only measurable here in software rendering (whole frames 36-80 ms on the CPU): median frame clear / rain /
  storm = 35.7 / 37.6 / 39.0 ms at 390x844 (3200 particles in a storm), 78.2 / 81.0 / 84.4 ms at 1280x800 (5000).
  That is ~5% of a software frame; a phone GPU draws the whole frame in a few ms, so the particles (one draw call,
  12.8k vertices, thin alpha quads with the nearest culled) should stay far below 1 ms there - not measured on a
  real device.

## Deviations from the spec
- Rendered night brightness by moon phase spans x0.75 (new) .. x1.25 (full) of the moonlit floor, not the 1:3 of
  the gameplay night light (0.04..0.12, which the clock does use): a new-moon night at 1:3 was unreadable on a phone.
- Snow also waters crops and chills furnaces (as `isWet` in core already defines); dust never does.
- Rain stops per column (a roof height map), not only by a sky-light test at the camera: you see rain fall past an
  open doorway while standing dry inside. The audio `sheltered` flag is the camera test.
- The forecast line also covers clearing / worsening / staying fair, and adds a rough time; "Rain within the hour"
  shows whenever the next state is rain or storm regardless of how far off it is (the game hour is 37.5 s).
- A storm in the frostfell is a blizzard: gusts (storm level) with silent snow; in the dunes the dust wind drives
  the gusts.
- `weather:lightning` is emitted by the model (src/game), the renderer only listens; lightning never strikes.

## Known gaps
- No splashes where drops land, no snow cover building up on the ground, no puddles.
- Clouds are one flat layer; a heavy sky is a flat grey deck, not volumetric.
- The wet sheen uses screen-space derivatives (top faces only); on very distant terrain it can shimmer slightly.
- The roof mask treats any solid block as a roof, so rain stops on top of leaves (and nothing drips through).
- Real-phone GPU cost is an estimate (see above). Sounds (rain bed, gusts, thunder) were measured by their own
  engineer, never listened to.
- An override from `__hw.setWeather` is saved like natural weather (it is part of the snapshot).
