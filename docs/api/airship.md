# Airship

The late-age way to travel and to find new country. Optional for the furnace story; its two goals open the Atomic Age.

## Getting one

- **Airship** (`airship`, machine, Atomic Age): forged at the Plasma Furnace (tier 5) at 2000 C from
  `1 combustion_engine, 4 superalloy, 16 cloth, 8 cord, 4 aluminum_ingot, 1 circuit`
  (`src/content/areas/airship.ts`, icon in `src/render/textures/areas/airship.ts`).
- Goals, right after *Forge superalloy*: **Take to the skies** (flag `flew_airship`: a powered flight high enough to
  spot from) and **Chart new lands** (flag `charted_lands`: six entries on the sky chart). The solver's rules for both
  flags are in `FLAG_RULES` (`src/content/progression.ts`).

## Using it (`src/vehicles/airshipManager.ts`)

| On foot | |
|---|---|
| Use with the Airship item on the top of a block | moors a ship there (needs a 3 x 3 footprint and 6 blocks of sky) |
| Use on a moored ship with a fuel canister | refuels (`fuelGrade(...).tractor` x 150 s; tank 900 s) |
| Shift/Place + Use on a moored ship | packs it up into the pack (its fuel is lost) |
| Use on a moored ship | climbs aboard |

| Aboard | Keyboard | Phone |
|---|---|---|
| thrust ahead / astern, rudder | W/S, A/D | the stick |
| climb | Space | **Up** (the Jump button) |
| sink | F (or Sneak) | **Down** (the Mine button, or a hold on the world) |
| next place on the chart | R | tap the course button on the HUD |
| step off | Use | **Exit** (the Use button; a stray tap on the world does nothing) |

Stepping off only works within 1.5 blocks of the ground (`STEP_OFF_CLEARANCE`); higher up a toast says to sink first.
Dying aboard drops the pilot off at once.

## Flight (`src/vehicles/airship.ts`)

The envelope holds the ship up by itself: with fuel it hovers where it is left, climbs or sinks at up to 3.5 m/s on
the trim and cruises at up to 11 m/s. An empty tank leaves no thrust, rudder or climb, and the ship sinks at 1.2 m/s
until it touches down; it never falls. It collides with the world on every axis (it does not climb hills like the
tractor) and above `WORLD_HEIGHT` there is nothing to hit; the ceiling is `WORLD_HEIGHT + 36`. A moored ship settles
onto whatever is under it. The collision box is 2.6 x 2.6 x 5.2 blocks.

## The sky chart (`src/vehicles/skyChart.ts`)

- Sight radius grows with height: nothing below y 56, then 4 blocks per block of height, at most 240.
- Once a second aloft, every landmark structure (`squareStructure`), ruin (`squareRuin`, named like the treasure
  maps' ruins, `ruinName` in `src/game/exploration.ts`) and **region** whose middle is in sight goes on the chart
  once, with a toast giving its compass point and distance. Regions are 192-block squares named for the biome at their
  middle (`regionName`: "the Amber Weald", "the Silent Fen"), so long flights keep naming new country.
- The course is one chart entry; the HUD's arrow and text point at it. Coming within 40 blocks reaches an entry and
  moves the course on to the nearest one not yet reached.
- Everything is computed from the world seed, so places far outside the loaded chunks can be spotted.

## Save

World extra `airships`: `{ next, ships: [{ id, x, y, z, yaw, fuel }], chart: { entries, course } }`. A ship saved
aloft comes back unsettled and sinks to the ground. Absent in older saves (no ships, empty chart).

## Rendering and HUD

- `src/render/vehicles/airshipRenderer.ts`: envelope in gores with a red belly band, fins and a swinging rudder,
  rigging, a varnished gondola with brass rails and a bow lamp, and two engine pods whose propellers turn with the
  throttle. Uses the tractor's vehicle shader (`VEHICLE_VERTEX` / `VEHICLE_FRAGMENT`).
- `src/ui/airshipHud.ts`: fuel gauge, altitude, sight radius, chart count and the course button. On portrait phones it
  sits above the joystick and buttons; the Jump / Mine / Use captions read Up / Down / Exit while aboard.

## Checks

- Unit: `src/vehicles/airship.test.ts`.
- Browser: `node scripts/e2e-airship.mjs` (phone portrait by default; `--device=desktop` for keys).
