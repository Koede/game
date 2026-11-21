# Handwork sim (src/sim/handWork.ts) - the Ember Age hand stations

Contract for the front-end (player use priority, HUD target name, render impulses). Design: `docs/EMBER_PLAN.md`
sections 2 and 5. Content (blocks, recipes, tools): `docs/api/handwork-content.md` (the data engineer). No power,
no machine screen: the world interaction is the interface. Hand stations are NOT machine nodes (like crops and
brewing blocks): `Simulation.entityCount` does not count them, `machineView` returns null for them.

## Entities

One saved entity per station block, `kind: 'hand'` (plain JSON, stored in the world):

```ts
interface HandEntity extends BlockEntity {
  kind: 'hand';
  station: string;          // block key of the station ('hand_quern', 'drying_rack', ...)
  input: Slot;              // what is loaded (one item kind)
  input2: Slot;             // second ingredient of two-input recipes (berry blend), else null
  output: Slot;             // finished work waiting to be taken
  progress: number;         // strokes done (stroke stations) or seconds done (timed stations)
  recipe: string | null;    // id of the recipe in progress, null when idle
  hotS: number;             // seconds of hot-work window left (0 = cold)
  wetS: number;             // timed stations: seconds the rack was rained on since the last reset (display only)
}
```
Created from `block:changed` when the block has `handStation`; removed (contents handed to the pack, overflow
to the spill crates) when the block goes. A loaded save resumes mid-work: strokes, timers and the hot window are
all fields of the entity.

## Action

```ts
sim.stroke(x: number, y: number, z: number, heldKey: string | null): StrokeResult
type StrokeResult =
  | { ok: true;  did: 'insert' | 'stroke' | 'take' | 'done'; done?: boolean }   // done: this stroke finished the job
  | { ok: false; reason: string }
```
`heldKey` is the key of the item in the player's hand ('' or null: empty hand). One call = one Use on the block
(a tap, or one repeat of a held Use; the front end repeats at `HandView.strokesPerS`). Order of decisions:

1. Output waiting and the hand is empty: the output goes into the pack (`did: 'take'`; pack full: refuse
   "Your pack is full"). Output waiting and anything else in hand: refuse "Take the <output name> first".
2. Hand holds an item that is an ingredient of a recipe of this station and fits the loaded input: the stack
   (up to the station's limit, 16) moves from the selected hotbar slot into `input`/`input2` (`did: 'insert'`).
   Not an ingredient and the station is a stroke station: refuse "<Station> cannot work <item name>".
3. No recipe matches what is loaded: refuse "Nothing to work" (empty) or "Needs <n> <name>" (not enough).
4. Stroke stations: `progress += 2` when the held item is the station's tool (`handStation.tool` kind, matched on
   the item's `tool.kind`) or the hot-work window is open, else `+1`; food -0.01 (never below 0, never refused for
   hunger); emits `hand:stroke`; when `progress >= strokes` the inputs are consumed, the output set, `hand:done`
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
  input: Slot; input2: Slot; output: Slot;
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

## Events (GameEvents, appended in src/core/gameEvents.ts)

```ts
'hand:stroke': { x, y, z, station: string, progress: number, needed: number, double: boolean }
   // every counted stroke; render: bounce the station's moving part, sfx is emitted by the sim ('sfx' event)
'hand:done':   { x, y, z, station: string, output: string, count: number }   // output appeared
'hand:taken':  { x, y, z, station: string, item: string, count: number }     // the player took the output
```
Sound: the sim emits `sfx` with the station's `strokeSound` (from the content contract) at the block, pitch
jitter left to the audio module. Flags (via `flagOnce`): `hand_<station key>` on the first finished job of each
station (e.g. `hand_hand_quern`), for the objectives engineer.

## Timed stations

Drying Rack and Tanning Trough have recipes without `strokes` and with `timeS`. A rack recipe runs only with
open sky above the rack AND daylight (`sunlight >= MIN_SUNLIGHT`); a roof or night pauses it ("waiting");
rain falling on it (`weather.wetAt` with a rain-exposed column) RESETS `progress` to 0 once per rain
episode. The trough soaks 60 s anywhere (no sky rule) and its output (soaked hide) goes to the rack. Facts
(sky, rain exposure) are cached per station and refreshed on `block:changed` in the column, like crops.

## Dependencies on the content contract

Read through `src/sim/handRules.ts` (one adapter, so a contract change touches one file): `handStation` on the
block (`strokesPerS`, `tool`, `strokeSound`, `hot`, `sky`), recipes with `station = <block key>` and `strokes`
(or `timeS` for the timed ones). See `docs/api/handwork-content.md` when it lands.
