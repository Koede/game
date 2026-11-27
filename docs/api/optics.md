# Glass and optics

Glass ground into lenses, a hand spyglass, a tripod telescope, the lighthouse lamp, and the old lighthouses on the shores.

## Content (`src/content/areas/optics.ts`)

| Key | What | Recipe (furnace forge) |
| --- | --- | --- |
| `lens` | Ground Lens, a material | 1 glass, 1 sand @ 600 C, tier 1 |
| `spyglass` | Hand tool, 4x zoom | 2 lens, 2 bronze_ingot, 1 leather @ 700 C, tier 2 |
| `telescope` | Block on a tripod, 10x zoom, reads the stars | 3 lens, 3 bronze_ingot, 3 stick @ 700 C, tier 2 |
| `lighthouse_lamp` | Machine block, burns coal/charcoal/coke | 4 lens, 4 bronze_ingot, 2 glass, 1 coal @ 800 C, tier 2 |

The telescope and the lamp are drawn as station shapes (`src/world/stationShapes.ts`), so they hide no neighbour's faces.

## Looking through the glass (`src/game/optics.ts`)

- **Spyglass:** Use it held to raise it, Use again (or put it away) to lower it. The camera's field of view is divided by `ZOOM`
  and looking turns that many times slower (`PlayerController.zoom`). Opening any screen lowers it.
- **Telescope:** Use it with an empty hand (or any item that is not a block) to look through it. Walking more than
  `TELESCOPE_LEASH` blocks away or Use again steps back. At night, with nothing opaque overhead, raising it toasts a sky
  reading: the weather now and its next change (`skyReading`, from `WeatherState.next` / `nextInS`), and raises the
  `read_the_stars` flag.
- **Spotting:** while raised, the generated structure (`landmarksNear`, any `squareStructure` within `SPOT_RANGE`) nearest the
  middle of the view, within `SPOT_CONE`, held for `SPOT_HOLD_S`, is spotted once: a toast with name, distance and compass
  direction, a Hearth Log line (`town:note`), and the `spotted_landmark` flag. Spotted keys save under the world extra `optics`.
- **HUD:** `src/ui/opticsHud.ts` draws the eyepiece, reticle and the caption from the `optics:view` event.
- **Fog:** while the view is narrow (fov under 60% of the setting) the renderer pushes the fog start out to 82% of the
  loaded edge, so the spyglass shows what is loaded clearly instead of haze.

## The lighthouse lamp

- Behaviour `lighthouseLamp` (`src/sim/machines.ts`): not on any network; while switched on it burns `lampW` (1700 W: coal
  lasts about eight minutes) from its one fuel slot, and is lit (active, light 15) while anything burns.
- Lit, it is a safe zone of `params.radius` (28) blocks (`src/sim/safeZones.ts`): no automaton spawns or walks inside.
- **On a shore** (`src/world/coast.ts` `isLighthouse`: at least `LIGHTHOUSE_MIN_HEIGHT` above `WATER_TOP` and `COAST_SHARE` of
  64 samples round it at the height of open water are water), its first lit second raises `lighthouse_lit`: a toast and a
  Hearth Log line.
- **Beam** (`src/render/beams.ts`): every lit lamp within `BEAM_RANGE` turns a ring of two brass-framed lenses, each throwing an
  additive cone that fades along its length; faint by day. A shore lamp's beam is long (`BEAM_LENGTH`), an inland lamp's short.
  Past 72 blocks only the beams are drawn (the tower is in the fog).

## Old lighthouses (`src/world/lighthouses.ts`)

A 7x7 banded tower: a door on the north side, a plank spiral stair round a centre post (step `i` at local y `i`), a gallery at
`GALLERY_Y`, and a glass lantern room whose plinth (`PLINTH_Y`) has its top free for a lamp. The crate by the door rolls the
`lighthouse` table (`src/content/lootStructures.ts`): a lighthouse lamp, lenses, coal, sometimes a spyglass.

A lighthouse is **not** in `STRUCTURE_DEFS`: `squareStructure` only tries one (`LIGHTHOUSE_CHANCE`, up to 32 spots) in a grid square
that has no other structure, so existing worlds keep every structure they had. A site needs dry, level ground at most
`SHORE_MAX_HEIGHT` over the water with open water within 8-12 blocks on enough sides (`lighthouseFloor`), away from spawn, the
Scar and the ruins. Expect a few per 1300 x 1300 blocks.

## Checks

- Unit: `src/game/optics.test.ts`, `src/sim/lighthouseLamp.test.ts`, `src/world/lighthouses.test.ts`.
- Phone e2e: `node scripts/e2e-optics.mjs [--no-build] [--device=phonePortrait]` finds a real lighthouse, lights it, spots it
  through the spyglass and reads the stars with a telescope (screenshots in `test-results/e2e-optics`).
