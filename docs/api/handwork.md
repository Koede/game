# Handwork sim (src/sim/handWork.ts) - the Ember Age hand stations

Contract for the front-end (player use priority, HUD target name, render impulses). Design: `docs/EMBER_PLAN.md`
sections 2 and 5. Content (blocks, recipes, tools): `docs/api/handwork-content.md` (the data engineer). No power,
no machine screen: the world interaction is the interface. Hand stations are NOT machine nodes (like crops and
brewing blocks): `Simulation.entityCount` does not count them, `machineView` returns null for them.

## Entities

One saved entity per station block, `kind: 'hand'` (the machine kind every hand station block carries; the station is the
block at x,y,z, whose key is also the recipes' `station`). Plain JSON, stored in the world:

```ts
interface HandEntity extends BlockEntity {
  kind: 'hand';
  slots: Slot[];            // [0] input, [1] output
  progress: number;         // strokes done (stroke stations) or seconds done (timed stations)
  recipe: string | null;    // id of the recipe in progress
  hotS: number;             // seconds of hot-work window left (0 = cold; stone anvil)
  made?: string | null;     // recipe id of the output waiting (for 'item:made' at the take)
}
```
Created from `block:changed` when the block has `handStation` (and machine 'hand'); removed with the block (contents
into the pack, the rest spilled; nothing when blocks are exploding). A loaded game resumes mid-work: strokes, timers and
the hot window are all fields of the entity; damaged fields are repaired on load. `sim.entityCount` does not count them.
Casting bench and alloy pot are NOT handled here (casting engineer).

## Action

```ts
sim.stroke(x: number, y: number, z: number, heldKey: string | null): StrokeResult
type StrokeResult =
  | { ok: true;  did: 'insert' | 'stroke' | 'take' | 'done' | 'return'; done?: boolean }   // done: this stroke finished the job
  | { ok: false; reason: string }
```
`heldKey` is the key of the item in the player's hand ('' or null: empty hand). One call = one Use on the block
(a tap, or one repeat of a held Use; the front end repeats at `HandView.strokesPerS`). Order of decisions:

1. Output waiting and the hand is empty: the output goes into the pack (`did: 'take'`; pack full: refuse
   "Your pack is full"). Output waiting and anything else in hand: refuse "Take the <output name> first".
2. Hand holds an ingredient of a recipe of this station: the stack (up to the stack limit; a timed station takes 8)
   moves from the selected hotbar slot into slot 0 (`did: 'insert'`). When several recipes start from the same item
   (the anvil: 1 copper ingot -> wire, 2 -> plate) each Use loads ONE, and the loaded count picks the job (the first
   recipe it can pay for; work already begun stays on its recipe). A different item than the loaded one: refuse
   "Busy with <name>". Not an ingredient (and not the station's tool): "<Station> cannot work <item name>".
3. No recipe matches what is loaded: refuse "Nothing to work" (empty) or "Needs <n> <name>" (not enough).
4. Stroke stations: `progress += 2` (STROKE_TOOL_MULT / STROKE_HOT_MULT, never both) when the held item is the station's tool (`handStation.tool` kind, matched on
   the item's `tool.kind`) or the hot-work window is open, else `+1`; food -0.01 (never below 0, never refused for
   hunger; `HAND_STROKE_FOOD`); emits `hand:stroke` and the station's `strokeSound` as `sfx` (pitch jitter); when `progress >= strokes` the inputs are consumed, the output set, `hand:done`
   emitted, `did: 'done'`. Timed stations (drying rack, tanning trough) take no strokes: a Use on them only
   inserts or takes; refusing a stroke says "<Station> works by itself - wait".
5. Empty hand and nothing to take: the same stroke as 4 (bare hands count x1).

`sim.handReturn(x, y, z): StrokeResult` - empty hand puts the loaded input back into the pack (a mistake, or to
take the wheat out of the quern); refuses when the output is waiting or nothing is loaded.

Hot work (stone anvil): `sim.openHotWindow(x, y, z)` opens a 20 s window (`HOT_WORK_S`) on every hot-capable
station (`handStation.hot`) within 6 blocks of x,y,z. The sim opens it itself when the player takes a crucible's
output through the furnace actions (`furnace:output` hook, wired by whoever owns the furnace screen if the sim
cannot see it); inside the window strokes count double and the station's label says "(hot)".

## Views (HUD target name, work bar)

```ts
sim.handView(x, y, z): HandView | null
interface HandView {
  x: number; y: number; z: number;
  station: string;          // block key
  name: string;             // "Hand Quern"
  /** The aiming line, ready to show: "Hand Quern - wheat 3/6 strokes", "Drying Rack - tea leaves 41/60 s",
   *  "Hand Quern - flour ready", "Hand Quern - empty", "Drying Rack - waiting for sun", "... - raining". */
  label: string;
  state: 'empty' | 'loaded' | 'working' | 'waiting' | 'ready';  // waiting: timed station blocked (night, roof, rain)
  waitReason: string | null;           // "Needs open sky", "Needs daylight", "Rain - drying starts over"
  input: Slot; output: Slot;
  recipe: string | null;
  progress: number;         // strokes or seconds done
  needed: number;           // strokes or seconds needed (0 when no recipe)
  fraction: number;         // 0..1 for the work bar
  timed: boolean;
  hot: boolean;             // hot-work window open
  strokesPerS: number;      // repeat rate for held Use
  tool: ToolKind | null;    // the tool that doubles strokes
}
sim.handCount: number       // stations tracked (diagnostic)
```
`handView` is cheap (no world scans; the rack's sky/rain facts are cached like a crop's).

## Events (already in GameEvents)

```ts
'hand:stroke': { x, y, z, station: string, progress: number, needed: number, double: boolean }
   // every counted stroke; render: bounce the station's moving part. Sound goes out as an 'sfx' event.
'hand:done':   { x, y, z, station: string, output: string, count: number }   // output appeared (timed stations too)
'hand:taken':  { x, y, z, station: string, item: string, count: number }     // the player took the output
'item:made':   { item, count, station, recipeId }                            // at the take, for objectives
```
Flags (via `flagOnce`): `hand_<station key>` on the first finished job of each station (`hand_hand_quern`).

## Timed stations

Drying Rack and Tanning Trough have recipes without `strokes` (`timeS` instead). A Use only inserts (up to 8 items) or
takes; the whole batch converts together after `timeS` (adding more mid-way shares the clock). The rack
(`handStation.sky`) runs only with open sky above AND daylight (`sunlight >= MIN_SUNLIGHT`); night or a roof pauses it
("Needs daylight" / "Needs open sky"); rain falling on an exposed rack (`weather.wetAt`, a column with nothing solid or
liquid above) zeroes `progress`. A glass roof keeps the rain off but also shows "open sky" only if it is not opaque:
glass lets the light in, so the rack still runs under glass. The trough runs anywhere. Facts (sky, rain exposure) are
cached per station and refreshed on `block:changed` in its column, like crops. Only stations with a clock running
(timed work with input, or a hot window) are visited per tick.

## Content dependencies

All content is read in `src/sim/handRules.ts` (the one adapter): blocks with `handStation` and machine `hand`,
recipes with `station = <block key>` and `strokes` (stroke) or `timeS` (timed). Tests inject fake rules.
