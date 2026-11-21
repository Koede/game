# src/audio - public API (from its engineer)

Import everything from `src/audio` (`src/audio/index.ts`).

### What main.ts needs

```ts
class AudioEngine {
  constructor(bus: GameBus, settings: Settings, options?: AudioEngineOptions)
  resume(): void
  setListener(x: number, y: number, z: number, yaw: number): void
  setAmbience(state: AmbienceState): void
  play(request: SfxRequest): void
  dispose(): void
  readonly running: boolean
  readonly activeVoices: number
}
```

- `constructor` — subscribes to `'sfx'`, `'settings:changed'` and `'game:paused'`. Creates no AudioContext; nothing can throw. `settings` is kept by reference and `settings.volume` is re-read on `'settings:changed'`.
- `resume()` — call from a user gesture, ideally on every `pointerdown` / `keydown` / `touchstart`. Creates the context on first call and resumes it if suspended; idempotent. If AudioContext is missing or construction throws, the engine is a permanent silent no-op.
- `setListener(x, y, z, yaw)` — ear position for positioned one-shots. Yaw in radians, 0 = looking north (-Z), positive = turning left (the camera's rotation about +Y).
- `setAmbience(state)` — call every frame. No allocation; re-targets parameters at most every 40 ms and only when a value changed. The first 7 calls after `resume()` only pre-generate sample buffers, one per call.
- `play(request)` — what an `'sfx'` bus event does; `SfxRequest = GameEvents['sfx']` (`{ name, x?, y?, z?, volume?, pitch? }`). Positioned only when x, y and z are all given. `volume` 0..2, `pitch` is a frequency multiplier clamped to 0.25..4.
- `dispose()` — stops everything, closes the context, unsubscribes from the bus.
- `running` — true once a context exists and is in state `'running'`.
- `activeVoices` — number of one-shots currently sounding.

```ts
interface AmbienceState {
  furnaceHeat: number;      // 0 (cold, silent) .. 1 (hottest)
  furnaceDistance: number;  // blocks to the nearest furnace; full level within 1.5, silent past 21.5
  furnaceElectric: boolean; // electrically heated: arc hum, quieter crackle
  machineHum: number;       // 0..1 running machinery nearby
  wind: number;             // 0..1 altitude / openness
  night: boolean;
  underwater: boolean;      // listener's head is under water
  cold: number;             // 0..1, adds a thin whistle to the wind
  ignition: number;         // 0 = not igniting, else Starhearth progress 0..1
}
createAmbienceState(): AmbienceState   // all-silent state; keep one and mutate it each frame
```

```ts
interface AudioEngineOptions {
  createContext?: () => RealtimeCtxLike | null;  // default: globalThis.AudioContext ?? webkitAudioContext
  random?: () => number;                          // default: Math.random
}
```

Constants: `MAX_VOICES = 24`, `REPEAT_GUARD_S = 0.03`, `HEARING_RANGE = 24`.

### Sound definitions and building blocks (tests, tools)

- `SFX: Readonly<Record<SfxName, Patch>>` — every one-shot as a declarative patch.
- `SFX_NAMES: SfxName[]` — all 37 names.
- `patchDuration(patch: Patch): number` — seconds until the patch is silent.
- `playPatch(ctx: AudioCtxLike, bank: BufferBank, patch: Patch, out: NodeLike, opts: PlayOptions): PlayedPatch` — builds and schedules a patch. `PlayOptions = { when, gain, pitch, random }`; `PlayedPatch = { end, sources }`.
- Types: `Patch`, `Layer`, `ToneLayer`, `NoiseLayer`, `PlayOptions`, `PlayedPatch`, `AudioCtxLike`, `RealtimeCtxLike`, `MasterChain`.
- `class BufferBank(ctx)` — lazily generated buffers: `noise(color)`, `crackle(dense)`, `flicker()`, `nightChimes()`, and `warm(): boolean` (builds one buffer per call, true when all exist).
- `createMasterChain(ctx, destination?): MasterChain` — `{ master, world, ui, muffle, dispose() }`.
- `class Ambience(ctx, bank, out, muffle)` — `update(state, now)`, `dispose()`.

Not exported from the index: `src/audio/fakeAudio.ts` (`FakeAudioContext`, the recording fake for tests).

## Deviations
- AudioEngine's constructor takes an optional third argument `options` ({ createContext, random }) so tests and the offline harness can inject a context; `new AudioEngine(bus, settings)` works as specified.
- Which sounds count as UI (still played while paused, never positioned or muffled) was my call: ui_click, ui_open, ui_close and error. Every other sound requested during pause is dropped, not queued.
- Yaw direction is not defined in the spec beyond '0 looks north (-Z)'. I assumed the three.js convention (positive yaw turns left, i.e. camera.rotation.y). If src/player uses the opposite sign, stereo panning will be mirrored; pass -yaw to setListener in that case.
- Night ambience is sparse glassy pentatonic chimes, not wildlife, because the game has no creatures.
- settings.volume is applied squared (perceptual slider curve) times a 0.7 master trim.
- Fire and arc are also reduced to 35% while underwater (on top of the world-bus low-pass), so diving next to the furnace gets quieter, not louder.
- The master chain has a 28 Hz high-pass (DC and sub-bass removal) and a WaveShaper soft clipper after the compressor, in addition to the requested master gain and compressor.
- After resume(), the first 7 setAmbience calls only generate sample buffers (one per frame) before any ambience layer is built, to avoid a single long hitch.
- No core contract was changed; nothing was appended to gameEvents.ts or constants.ts.

## Known gaps
- The listen-check is by measurement only (peak, RMS, duration, DC, band energies, spectral centroid) in headless Chromium. No human has heard the sounds, so 'pleasant and recognisable' is a design judgement that still needs ears.
- Sounds requested before the AudioContext reaches state 'running' are dropped, so a sound fired in the very same gesture that first calls resume() can be silent. main.ts should call engine.resume() on the earliest gesture events (pointerdown / touchstart / keydown), not on click.
- Chromium's DynamicsCompressor ramps its gain up over roughly the first 100 ms after the context starts, so the very first sound after unlocking audio is quieter than normal.
- The furnace ambience is not panned: AmbienceState carries only a distance to the furnace, not a direction. Positioned one-shots have distance attenuation and stereo pan only (no occlusion, no vertical cue).
- On browsers without createStereoPanner everything falls back to centred mono.
- The 'phone speaker' rebalance is based on a crude 350 Hz-6 kHz energy measure, not on a real device. step (0.003), ui_click (0.005) and error (0.005) are deliberately quiet and may be faint on a phone at low volume.
- src/audio/engine.test.ts is 399 lines, over the 350-line aim (test file only).
- The engine does not suspend the AudioContext when volume is 0 or the tab is hidden; at volume 0 it creates no sources if the ambience was never built, but an already-built ambience keeps running silently.

## Later additions
Spec sections 13-15 (buckets and lava, the richer world, weather) added keys, sounds, ambience fields and textures here: see `docs/api/world-content.md`.

## The Emberbound (spec 19)
Eight automaton sounds (`src/audio/sfxEmber.ts`), measured against the existing ones: see `docs/api/emberbound-content.md` section 6.
