# Brewing - world and render (src/world, src/render, src/audio)

BREWING_PLAN section 6 and the audio part of 7. Reads the entities of `docs/api/brewing.md` and the data of
`docs/api/brewing-content.md`. No wiring is needed except the one line of the game loop under "Audio".

## World: the two shapes (src/world/meshCup.ts, blockTables.ts, mesher.ts)

`SHAPE_CODES.cup/bucket` are now the real shapes `SHAPE_CUP` (8) and `SHAPE_BUCKET` (9), both in the cutout batch.
Textures are the cut-out sprites of brew.ts and each box samples the part of the tile it covers.

- **cup** (`cup(...)`): body 5..11 / 16 wide, 0..5/16 tall, no bottom face. Every stage but `clay_cup` adds a stepped,
  inverted drip cone on top: spout 3/16 wide (y 5..7), middle 7/16 (7..9), rim 8/16 (9..10), so the setup is 10/16 tall
  (`CUP_CONE_TOP`) and a ring of the cup's top shows round the spout. Which stage a block is comes from
  `CUP_STAGE[id]` (1 + index in `CUP_STAGES`, built from `cupStageOfBlock(def.key)`).
- **bucket** (`bucket(...)`): a 9/16 body (y 0..7/16), four 1/16 rim walls 10/16 wide up to 8/16, and a water top quad
  at 7.5/16 that samples the whole PY tile. `BUCKET_KIND[id]`: `BUCKET_COLD`, `BUCKET_BOILING` (key ends `_boiling`:
  the water quad carries `LIGHT_FLAG_LIQUID`, so it shimmers like water), `BUCKET_KETTLE` (`KETTLE_BLOCK`: a closed pot
  with shoulder, lid and knob; the voxel's active bit puts the liquid flag on the knob).
- Exports of `meshCup.ts`: `CUP_MIN`, `CUP_MAX`, `CUP_RIM_Y` (5/16), `CUP_CONE_TOP` (10/16), `cup`, `bucket`.
- The drink's liquid is NOT in the chunk mesh (its tint is entity data): see `BrewLiquid`.

## Render

- `src/render/target.ts`: `shapeBounds(shape, key?)` now knows the two shapes. The outline is the tap target, padded
  to `MIN_TARGET` (8/16) on every side: bare cup `[4,0,4]..[12,8,12]` /16 (`key === 'clay_cup'`), cup with cone
  `[4,0,4]..[12,10,12]`, bucket and kettle `[3,0,3]..[13,8,13]`. (Raycast hits are whole-cell, unchanged.)
- `src/render/brewLiquid.ts` `BrewLiquid(world, lightProbe)`: one dynamic mesh, one tinted quad (5.5..10.5/16, a hair
  above the cup rim) for every `brew_cup` entity at stage `brewing` or `done` within 48 blocks (max 64, refilled four
  times a second, lit by the probe). Colour: `itemOrNull(entity.drink).drink.colour`; while `brewing` it fades from clear
  water to the drink by `brewS / BREW_SECONDS`.
- `src/render/brewFx.ts` `BrewFx(world, particles)`, `update(dt, camX, camZ)`, `day`, `activeSources`: a fixed pool of
  48 sources rescanned twice a second, particles from the shared pool. Steam wisps over a `boil_bucket` entity with
  `boiling: true` (4/s), over a `kettle_pot` whose voxel is active (3/s), over a `brew_cup` at stage `done` while
  `steamS > 0` (1.8/s, thinner and smaller). Drips: 1-pixel chips (9/s) falling 0.18 blocks on a ring round the cone's
  spout while the stage is `brewing`, tinted by the drink colour. Nothing is allocated per frame.
- The `Renderer` creates and drives both (`effectSources` counts the brewing sources).

## Audio

`AmbienceState.boil: number` (0..1) and `AmbienceTargets.boil`; the layer `buildBoil` (src/audio/ambienceBoil.ts):
a band-passed pink-noise simmer with two slow, band-passed crackle beds as bubbles; built on first use, level
`boil * 0.22`, gone under water. The game loop that fills the state (`src/app/ambience.ts`, not in this scope) should
set `state.boil = 1 - clamp((distance - 2) / 14)` to the nearest boiling bucket or kettle (entities `boil_bucket`
with `boiling`, `kettle` with an active voxel), else 0. Until it does the layer stays silent and is never built.

## Tests
`src/world/meshCup.test.ts`, `src/render/brewFx.test.ts` (emitters, pooling, liquid), the new case in
`src/render/target.test.ts`, the boil cases in `src/audio/ambience.test.ts`.

## Known gaps
- The ambience state is not filled yet (see Audio).
- Drips fall in the 1.5/16 ring between spout and cup wall: a few pixels on a phone, best seen from above.
