# Handwork front end (EMBER_PLAN 2 and 5) - player, world shapes, render, UI

What the player SEES and DOES at the Ember hand stations. Data: `docs/api/handwork-content.md`; strokes: `docs/api/handwork.md`;
casting: `docs/api/casting.md`. Nothing here moves power. Tests: `npx vitest run src/player src/world/stationShapes.test.ts
src/render/handwork`; browser check: `node scripts/e2e-handwork.mjs` (desktop and phone portrait; also last in `npm run e2e`).

## Use priority (src/player/handTools.ts, interaction.ts)

`Interaction.use` order: held building block placed (Shift / Place toggle, or against a screen block) -> brewing
(`brewTools.ts`) -> **hand work (`handTools.ts`)** -> pipes -> screens -> bushes, drink, eat, buckets, hoe, plant, place.

```ts
interface HandHands {                       // src/sim's Simulation fits it structurally; passed as PlayerControllerOptions.hands
  stroke(x, y, z, heldKey: string | null): HandResult;          // handwork.md: insert / stroke / take / done
  handReturn(x, y, z): HandResult;                              // empty hand: the loaded input back to the pack
  pourCrucible(x, y, z, slot, heldKey: string | null): PourResult;   // casting.md
  furnaceView(x, y, z): { crucibles: readonly { index: number; moltenS: number }[] } | null;
}
class HandTools { constructor(host: HandToolsHost, hands: HandHands | null); use(hit: RayHit, forceReturn: boolean): 'worked' | 'poured' | 'refused' | null }
useRepeatFor(def: BlockDef | null): number    // seconds between repeats of a held Use aimed at def
```
- A block with `handStation` takes the tap. One Use = one `sim.stroke`; the hand swings; a refusal is toasted with the sim's
  sentence (`advise`, once per 8 s per sentence) and ends the tap. The sim decides insert / take / stroke.
- What goes to the sim as the held key: an ingredient of a recipe at that station, or the station's tool (matched on
  `ItemSpec.tool.kind === handStation.tool`). **Any other non-block item is a bare hand** (heldKey null), so a pickaxe in hand
  strokes with bare hands instead of being refused. **A block that is not an ingredient is not handled** (null): it is placed
  beside the station as usual (a log IS an ingredient of the chopping block, so it loads).
- Shift + Use (or Place, then Use on a phone) with an **empty hand** -> `handReturn` (take back what you loaded).
- A fired mould (`ItemSpec.mould`) in hand aimed at a furnace where some crucible has `moltenS > 0` pours the first molten
  crucible (`pourCrucible`, the cast goes to the pack, sim events as casting.md) without opening the screen. With nothing
  molten the furnace screen opens as before.
- `screenFor` returns null for role `hand` machines (no screen for stations).
- **Hold-to-repeat**: `IntentSource.setUseRepeat?(seconds)` (new, optional; `InputManager` and `InputCore.useRepeatS`
  implement it). The controller sets `useRepeatFor(aimed block)` before every `input.frame`, so a held Use strikes at
  `1 / handStation.strokesPerS` (chopping 0.25 s, quern 0.33, anvil 0.4, loom 0.5) and at `USE_REPEAT_S` (0.25) elsewhere.
  A tap always fires at once; only the repeats follow the rate. A completed job followed by a held Use takes the output
  and goes on with the next load.
- Mining a station (hold Mine) breaks it and the sim hands the contents to the pack.

## World shapes (src/world/stationShapes.ts, meshStation.ts, blockTables.ts)

The content declares the stations as `cube` (chopping block, anvil, clay table, loom, drying rack, casting bench) and `slab`
(quern, mortar, trough, alloy pot) blocks. `STATION_BOXES` (keyed by block key, boxes in sixteenths in the north-facing frame)
makes the mesher draw them as several small boxes instead: stump, bedstone, anvil (block, waist, face, horn), mortar bowl,
table, loom frame with warp sheet, rack posts and poles, trough, bench, alloy pot. East / South / West facings turn the boxes
(`turnBox`); each face keeps the texture of the face it lands on, so the loom's front texture follows its facing.
- `blockTables.STATION[id]` = 1 + index in the table (0 for every other block). Station blocks get `OPAQUE`/`MERGES` 0 and
  `LIGHT_CLASS` clear: they hide no neighbour's face and cast no shadow. Collision, the raycast and Use still treat the whole
  cell (cube: full height, slab: half), which is easier to hit with a thumb.
- `stationBounds(key)` (used by `render/target.ts` `shapeBounds`) hugs the outline to the boxes; the quern and mortar reach up
  to their moving part (`PART_TOP`).
- To add a station shape: one entry in `STATION_BOXES`; to animate it, one `HandAnim` in `render/handwork/handModels.ts`.
  The casting bench and alloy pot have shapes but no animation (their entities are the casting engineer's).

## Render (src/render/handwork/)

`HandParts(world, uniforms, bus, particles)` (created and updated by the Renderer, group in its scene) draws the moving
parts through the machine-parts layer: the same `ModelBuilder`, shader (`machines/material.ts`, new motion code
`Motion.Pulse` = move along local Y by the instance's `extent` x stroke), light probe and instancing. **Nothing runs at a
speed; every pose is a function of what just happened**:
- `hand:stroke` (record made on the spot) bumps the record's `strokes`, resets `since`, sets `frac = progress / needed`;
  `hand:done` clears `frac` and puffs. Twice a second it rescans `world.entities()` of kind `hand` within 64 blocks for what
  is loaded and the work fraction (`slots[0]` input, `slots[1]` output, `recipe`, `progress`), and forgets stations whose
  block is gone.
- Parts per station: **quern** runner stone + peg turns 30 degrees per stroke (`HandAnim.turn`, eased at 14/s);
  **anvil** hammer lifts and strikes (visible 0.55 s after a stroke) + an impact flash plate; **chopping block** axe swing +
  the log lying on the stump as two halves that open with the work (`frac`) and twitch on each stroke (hidden when the input
  is empty); **loom** shuttle crosses once per stroke (`turn` = pi) + cloth rising out of the floor with `frac`; **mortar**
  pestle lifts and drops; **clay table** clay lump (when loaded) + smoothing stick; **drying rack** bundles hung from the pole
  (green leaves / hide / dried goods by what is on the rack) swaying; **trough** water and the hide in it.
- Particles on strokes (`HandFx`): sparks off the anvil (more when the stroke counted double), wood chips at the chopping
  block, flour / ore dust at quern and mortar; a soft puff on `hand:done`.
- `HAND_DRAW_CAPACITY` 64 instances per part, `HAND_RANGE` 64 blocks; one draw call per part in view, nothing allocated per
  frame. `PartDef.visible/pose` and `HandAnim` are the extension points (`HAND_ANIMS`).
- The molten glow of a crucible is drawn by the furnace screen (casting engineer, `castText.ts`, `furnaceTabs.css`); the world
  furnace block is unchanged.

## UI (src/ui/hud, src/ui/menus/howto.ts, src/app)

- `UISimQuery.handView(x, y, z): { label: string; fraction: number } | null` (Simulation's `handView` fits). The crosshair
  name under a hand station is the sim's `label` ("Hand Quern - wheat 3/6 strokes", "Drying Rack - waiting for sun"), refreshed
  at once on `hand:stroke` / `hand:done` / `hand:taken` for the aimed station (not only on the 0.125 s slow tick). The
  crosshair's **ring fills with the work** (`fraction`) while a station is aimed and nothing is being mined.
- How to Play: a "Working by hand" card (`HANDWORK`) between "Building big" and "Tea and coffee"; the Use lines of both control
  lists mention strokes, and the Shift / Place line says an empty hand takes back what you loaded.
- `src/app/game.ts`: `hands: sim` passed to `PlayerController` (one word).

## Notes, deviations, known gaps

- Handwork entities keep `[input, output]` in `slots` (not `input` / `output` as handwork.md's text says); the render reads
  `slots` first and falls back to the named fields.
- The aiming line says "copper ingot 0/6 strokes" for the anvil's wire recipe and the sim picks plate vs wire by how many
  ingots were loaded (each Use loads one); the label does not name the recipe. A sim / label question, not a front-end one.
- Parts are drawn only within 64 blocks and 64 instances per part; beyond that the quern shows its bedstone without the runner.
- A tool stroke that counted double plays the same animation (sparks only grow). The anvil flash is a tinted plate, not
  emissive: the machine shader has no glow.
- Hot work from molten metal taken by hand is not built (casting.md); the Casting Bench does pour into set moulds now; no mould
  is drawn on the bench.
- First-run coach marks ("Drag here to look around") can sit on the portrait tap point and eat the first taps in a scripted run.
