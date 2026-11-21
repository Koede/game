# Item and fluid transport (src/sim) - public API

Spec 16.2-16.5 on the data of `docs/api/tech-content.md` and the endpoint interface of `docs/api/hearth.md`: pipe
networks, ports and their settings, item packets, fluid networks, pumps, tanks, the boiler and steam turbine, fluid ports
on the older machines, buckets on fluid blocks, the wrench, the pipe screen's view and the render snapshot.
DOM-free, inside `src/sim`. `npx vitest run src/sim` (19 files, 187 tests).

| file | what |
|---|---|
| `pipeState.ts` | pipe entities (`PipeEntity`), port settings (`PortConfig`, defaults, filter rule, validation), cell keys |
| `pipeNet.ts` | `PipeNet` (one network: pipes, joints, ports, frontier, anchor) and `Port` |
| `pipeGraph.ts` | `PipeGraph`: flood fill where something changed; joints refused for cut / mismatch / hot; caps |
| `itemNet.ts` | `ItemNet`: packets, destinations, reservations, re-route, return, Blocked, the packet cap |
| `fluidNet.ts` | `FluidNet`: one fluid and an amount, pull/push by priority with equal split |
| `transport.ts` | `Transport`: owns the networks, rebuilds, ticks, saves content on anchor entities, active bits, endpoints |
| `transportActions.ts` | wrench, port settings, buckets |
| `transportViews.ts` | `pipeView`, `TransportRenderer` (render snapshot), `fluidAt` |
| `tanks.ts` | stacked tanks: one fluid, one level |
| `fluidMachines.ts` | pump, boiler, steam turbine, still oil runs; their status words |
| `fluidUse.ts` | piped water / fuel / lava helpers for steam engine, electrolyzer, fission pile, combustion engine, geothermal tap |
| `pipeKit.ts` | test fixture (`run`, `netOf`, `until`; import by path) |

## Wiring

Nothing new: `Simulation` owns `transport` and ticks it after the furnaces (pumps and boilers fill first, pipes move
next). `resync()` after `world.load()` also finds the pipe entities again. What the other modules still have to call:

- **Player module** (spec 16.3): with the wrench in hand, Use on a pipe -> `sim.wrench(x, y, z, dir)` where `dir` is the
  `Face` of the pipe the player aims at (an arm towards a block cycles that end, an arm/side towards a pipe parts or
  joins them). With a bucket in hand, Use on a block -> `sim.bucketUse(x, y, z, face, heldKey)`; on `ok` swap the held
  item for `result.held`; when `endpoint` is false the block is not a fluid block - carry on as before (scoop / pour /
  open the screen). Note the priority question: a tank is a machine, so the bucket must be tried before the machine
  screen opens. The player module never imports src/sim today (spec 9); integration must pass these two calls in.
- **UI** (pipe screen, spec 16.3): `sim.pipeView(x, y, z)` and `sim.setPort(x, y, z, dir, change)`. There is no
  `ScreenRequest` for a pipe yet (core contract; append one, e.g. `{ type: 'pipe'; x, y, z }`). Machine screens can show
  `MachineView.fluids` (buffers, rate, tank stack).
- **Renderer**: `sim.transportView()` each frame (one snapshot per tick, its objects reused): packets with their
  polyline, `along` and `speed` (extrapolate `along += speed * timeSinceTick`, clamp to `length`), fluid networks with
  colour, glow, fill and their pipe cells. `sim.pipeFluidAt(x, y, z)` for one pipe.

## Simulation members (new)

| member | semantics |
|---|---|
| `readonly transport: Transport` | the networks (read `items`, `fluids`, `netAt(x, y, z)`; tests and tools) |
| `pipeView(x, y, z): PipeView \| null` | the pipe screen of the pipe there (null: no pipe) |
| `wrench(x, y, z, dir: Face): WrenchResult` | arm towards an endpoint: `wrenchPort`; towards a pipe: `wrenchJoint`; else refuses |
| `wrenchPort(x, y, z, dir): WrenchResult` | push -> pull -> off -> push; toast "Pulling from Blast Furnace" / "Pushing into Crate" / "Closed to Crate", sfx `pipe_clunk` |
| `wrenchJoint(x, y, z, dir): WrenchResult` | parts the pipe from its neighbour pipe that way, or joins them again ("Pipes parted" / "Pipes joined" / "The pipes hold different fluids - they stay apart"), sfx `pipe_clunk` |
| `setPort(x, y, z, dir, change: PortChange): ActionResult` | the pipe screen's settings; refuses with "Priority goes from -2 to 2", "A filter holds at most 5 entries", "\"x\" is not an item" / "... not a fluid", "Nothing to connect to on that side", "That is not a pipe" |
| `bucketUse(x, y, z, face: Face, heldKey: string): BucketResult` | 1000 L into or out of a tank (stack) or fluid endpoint; sfx `splash` / `scoop_lava` |
| `transportView(): TransportRender` | render snapshot (below) |
| `pipeFluidAt(x, y, z): { fluid, fill, litres } \| null` | the fluid of the pipe's network and its fill 0..1 |

```ts
type WrenchResult = { ok: true; did: 'port'; mode: PortMode } | { ok: true; did: 'joint'; joined: boolean } | { ok: false; reason: string };
type BucketResult = { ok: true; held: string; fluid: FluidKey; litres: number } | { ok: false; reason: string; endpoint: boolean };
interface PortChange { mode?: 'push' | 'pull' | 'off'; distribution?: 'nearest' | 'round'; filter?: string[]; filterMode?: 'allow' | 'deny'; priority?: number }
```
Bucket refusals: "That is not a bucket", "Use it on a tank or a machine that takes fluids" (endpoint false), "The hearth
is not formed", "The Tank is full", "Not enough room for a bucketful", "The Tank holds lava", "The Steam Engine does not
take lava", "The Tank holds nothing to scoop", "A bucket takes 1000 L - it holds 400 L", "Lava needs a bronze bucket",
"A bronze bucket is kept for lava", "A bucket cannot carry crude oil".

### PipeView
`{ x, y, z, block, name, family: 'item' | 'fluid', network: PipeNetView, ports: PortView[], joints: JointView[] }`
- `PortView`: `{ x, y, z, dir` (pipe and the Face towards the block) `, ex, ey, ez, block, name, icon` (item key for the
  icon) `, mode, distribution, filter, filterMode, priority, status, moving, blocked` (packets waiting there) `, inert`
  (beyond a cap) `, rate` ("4 every 2 s" / "200 L/s") `, distance }` - every port of the network, nearest first.
- Status words. Item pull: "Moving 4 every 2 s", "No destination", "Destination full", "Nothing to pull", "Pipes are
  full - waiting", "Waiting"; item push: "Receiving Copper Ore" (3 s after a delivery), "Ready", "Destination full";
  both: "Blocked", "Off", "Not connected", "The hearth is not formed" (a hatch of no formed hearth), "Network too long"
  (inert). Fluid pull: "Moving 200 L/s", "Too hot for this pipe", "The pipes hold Water", "Filter blocks Lava",
  "No destination", "Destination full", "Nothing to pull"; fluid push: "Moving 200 L/s", "Destination full", "Does not
  take Steam", "Filter blocks Water", "Waiting for fluid".
- `PipeNetView`: `{ id, family, pipes, inertPipes, ports, inertPorts, hot, fluid` (held, or flowing through right now)
  `, fluidName, litres, capacityL, fill, packets, items, maxPackets, warnings }`; warnings: "Network too long - 1024 of
  1064 pipes work", "Too many ends - 6 do nothing", "Pipes are full - pulling waits", "Touches pipes holding another fluid".
- `JointView`: `{ x, y, z, dir, reason: 'cut' | 'mismatch' | 'hot', text }` ("Parted with the wrench", "The pipes hold
  different fluids", "Too hot for this pipe").

### TransportRender
`{ tick, packets: PacketRender[], fluids: FluidRender[] }` - the same object within one tick.
- `PacketRender`: `{ item, count, points: Float32Array` (xyz world vertices: the face it left from or the pipe centre it
  restarted at, every pipe centre, the face it is heading for) `, length, along, speed, blocked }`.
- `FluidRender` (non-empty networks only): `{ fluid, colour, glow, fill, litres, capacityL, cells: Int32Array }` (xyz
  triples of its pipes).

### MachineView additions
`fluids: { input, output, capacityL, rateL, stack } | null` for every machine with fluid ports (copies of the buffers;
`rateL` = litres a second pumped / boiled / used last tick; tanks: `stack` = `{ tanks, fluid, litres, capacityL }` and
the status "22,000 of 48,000 L (3 tanks)" / "Empty (2 tanks)"). New status words: pump "Pumping water - 200 L/s"
("(the pool shrinks)" on lava/oil), "Must touch water, lava or oil", "Full - connect a pipe that pulls", "Still holds
lava"; boiler "Boiling 400 L of steam a second", "Must sit on top of a furnace", "The furnace is too cold", "Needs water
- pipe it in", "Steam is not being used"; turbine "No steam - pipe it in through a hot pipe"; still "Refining crude oil
- 40%", "Needs 500 L of crude oil", "Fuel is full - pipe it out" (`progress` follows the oil run).

## Rules as built

**Networks (16.4).** Flood fill over touching pipes of one family, only when a pipe or an endpoint (`isItemEndpoint` /
`isFluidEndpoint`) is placed or removed (or a wrench parts/joins, or a chunk the network could not see into loads): the
networks at and around the changed cell are dissolved and flooded again; everything else is untouched. A network takes
the first 1024 pipes (`PIPE_MAX_PIPES`) and 64 ports (`PIPE_MAX_PORTS`) it finds; the rest of the run is inert and says
"Network too long". Unloading a chunk never rebuilds (pipes there cannot change); a build that met an unloaded chunk
rebuilds when it loads. Pipes in unloaded chunks are found again through the pipe entities in them.

**Ports (16.3).** A pipe end touching an endpoint of its family. Settings `{ mode, distribution, filter (<= 5 keys),
filterMode, priority -2..2 }`; an empty filter lets everything through. Defaults: `push`, except against a block that
only gives (pump, bore rig): `pull`. Settings are saved on the pipe's entity only once changed (`ports[dir]`), and
dropped when the endpoint goes.

**Items.** A pulling end fires every `1 / ratePerS` s (bronze chute 2 s, steel conveyor 0.5 s): it takes the first stack
of its block that passes its filter AND has a destination: pushing ends whose filter takes it, with room after what is
already reserved there, never the block it came from (compared by the endpoint's entity, so a hearth's two hatches are
one block). Highest priority first; then nearest by path length or, for a `round` source, the next in turn. It takes
`min(batch, stack, room)`, reserves that room and sends a packet along the shortest path; travel is a timer (each
segment at the slower of its two pipes' speed). On arrival the items go in; the rest re-routes to the next destination,
else goes home; if home refuses too (a furnace takes no ingots back) it waits at its end, "Blocked", and tries again
every second. At 48 packets (`PIPE_MAX_PACKETS`) pulling pauses. Furnaces through pipes use the smart sides of
hearth.md (ore to crucibles, fuel to the firebox, only finished products out).

**Fluids.** A network holds one fluid and an amount up to 250 L per pipe. Each tick pulling ends drain up to `ratePerS
x dt` (iron 200 L/s, hot 1000 L/s) - refusing a hot fluid unless every pipe is hot ("Too hot for this pipe"), another
fluid than the one held, or what the filter blocks - then pushing ends are filled by priority, equally within a
priority (whoever needs less leaves the rest to the others), never straight back into a block it was pulled from this
tick. An empty network forgets its fluid. Joining two networks holding different fluids, or a hot fluid to a cold pipe,
is refused: the joint stays open (`joints`, warning); when such a network runs dry it is rebuilt so the joint can close.

**Saving.** Pipe entities (`kind: 'pipe'`) hold `ports`, `cut` (bit per Face) and, on one pipe per network with ports
or content (its anchor), the content: `store: { fluid, litres }` (the network's live object) or `packets:
SavedPacket[]` (`{ item, count, durability?, from: [x,y,z,dir], to: [x,y,z,dir], back? }`). On load every packet is
delivered at once at its destination (re-routed / sent home / Blocked like any arrival); fluid amounts are kept (a
network found only partly before its chunks load keeps the whole amount until they do). A rebuilt network shares the
old content by pipe count; packets keep their destination from the pipe they are in; packets in a pipe that was broken
go into the block they were heading for, else home, else to the player.

**Active bit.** Every pipe of a network that carries something has its voxel's active bit: fluid networks while they
hold or move fluid (1 s hold), item networks while packets travel (2 s hold). Written only on change.

**Pumps.** 50 W consumer touching water, lava or oil (the one its buffer already holds first). Fills its 1000 L buffer
at 200 L/s x satisfaction. Water touching at least 2 connected water blocks is endless; anything else (lava, oil, a lone
water block) loses one block per 1000 L - the farthest of at most 32 blocks a breadth-first search finds.

**Tanks.** 16 000 L each; a column of touching tanks holding the same fluid (or none) is one stack: one fluid, one
level, filled bottom up and drained top down whether a pipe or a bucket reaches it through any of its tanks.

**Boiler.** On a furnace or any block of a formed hearth's shell (like the steam engine). Steam/s = clamp(1 x (T - 200),
0, 800), limited by its water (1 L -> 10 L steam) and by room in its 1000 L steam buffer; 20 J of heat per litre goes
into the furnace's `extractW`. Unused steam fills up and the boiler stops - so it only cools the fire for steam
actually used. **Steam turbine**: `8000 W x min(1, steam / (800 L/s x dt))`, load-following, uses steam for the power
drawn (8 kW from 800 L/s = 16 kW of fire heat: better than the steam engine's 3:1).

**Older machines.** Steam engine: piped water at 10 L/s replaces the water beside it. Electrolyzer and fission pile:
piped water at 100 L/s counts as touching water / cooled (used while it runs / reacts). Combustion engine: piped
refined fuel when its slot is empty, 1000 L = one canister's 2.4 MJ. Still: between item jobs (items go first), 500 L
of crude oil -> 400 L of fuel per 20 s run at 2 kW. Geothermal tap: piped lava runs it at 6 kW; 1000 L lasts 600 s at
full output and covers only what lava blocks do not. Fluid hatch: the formed hearth burns 1000 L as a lava bucket (no
bucket back) - hearth.md.

## Verification
- `pipes.test.ts` (12): keys, flood fill and families, ports and default modes, rebuild only on pipe/endpoint changes,
  split and merge, wrench joints saved and pruned, fluid mismatch refused and closing once dry, hot refusal, both caps
  with warnings, settings saved only where needed, anchors, active bits, settings and joints across a save, chunk-load
  discovery with the content kept.
- `itemPipes.test.ts` (17): rates and travel times of both item pipes, the render snapshot, reservations, every idle
  status, nearest / priority / round-robin / allow and deny filters, never its own block, re-route, return home, Blocked
  then delivered, the 48 cap, furnace smart sides and output, item hatch formed/unformed, save/load delivery, broken
  pipes (destination, then player), rebuild in flight.
- `fluidPipes.test.ts` (12): endless water at 200 L/s, lava and oil used up farthest first, pump statuses, cold pipe vs
  lava, one fluid per network, priority with equal split, filters, capacity, "No destination", render fills, empty
  forgets, content across a save, stacked tanks, buckets (every refusal), lava bucket into a hearth's fluid hatch.
- `fluidMachines.test.ts` (9): boiler formula and heat draw, stop when steam is unused, turbine output and load
  following, steam engine / electrolyzer / fission pile on piped water, combustion engine fuel energy, still oil runs
  and item priority, geothermal piped lava.
- `transportPerf.test.ts` (real World): 20 networks x 200 pipes, ~47 packets each at the cap: **0.016-0.020 ms per
  transport tick** (budget 0.5); a 1000-pipe network (a 100 x 10 sheet) rebuilt after a pipe is placed or broken:
  **~2.2-2.7 ms per rebuild** including the block events (budget 5).
- `playthrough.test.ts`: from the Blast hearth on, two item hatches swapped into the walls, 90 iron ore piped in from a
  crate and the ingots piped out into a crate beside the furnace; at the Arc hearth a pump in a roof pool feeds the
  steam engine (piped water) and a boiler whose steam runs a turbine through a hot pipe (the wrench sets the boiler end
  to pull); the Plasma hearth swallows the north hatch, a second east hatch takes over (wrench parts the two lines);
  330 copper ore piped through at the Star age. Every objective in order, `game:won` at ~179 game minutes.
- Real built game in headless Chromium (desktop 1280x800 and phone 390x844, through `window.__hw`): a crate -> 7 bronze
  chutes -> crate line ("Moving 4 every 2 s", items arriving) and a pump on a pool with a solar panel -> iron pipes ->
  two stacked tanks ("Pumping water - 200 L/s", "1,210 of 32,000 L (2 tanks)", pipes active); no console errors.

## Deviations from the spec, and decisions
- **Pump drains the farthest block first** (of at most 32 found), not the nearest: draining the nearest cuts the pool off
  from the pump after one block. A lone water block is not endless (the spec's ">= 2 blocks").
- **Default mode** is `pull` against blocks that only give (pump, bore rig) - push could never do anything there.
- Fluid never goes straight back into a block it was pulled from in the same tick (a tank stack with two pipes on it
  would otherwise feed itself half its flow).
- A packet that arrived at a full destination with nothing else to take it goes home even if home is a furnace that
  refuses it; then it is Blocked at the furnace end and retries every second (it never spills).
- Network view `fluid` also names a fluid flowing straight through (a network that passes everything on holds 0 L).
- The boiler takes heat per litre of steam made, and stops when its steam is not used; "draws heat like a heat engine".
- Pipes in chunks that unload keep working as part of their network (like machines, spec 5); a network found only
  partly (its other chunks not loaded yet) may hold more than its capacity until they load.
- Breaking a tank, pump, boiler or machine loses the fluid in it (a fluid cannot go into the pack).
- Wrench and buckets do not check the held item (the player module decides when to call them).

## Known gaps
- **Not drawn yet**: moving items and fluid fill (renderer: `transportView()`); the pipe screen (UI: `pipeView`,
  `setPort`, a pipe `ScreenRequest`); wrench and bucket use from the player module (`wrench`, `bucketUse`). (Wrench and buckets: done in integration
  pass 3, `docs/api/integration.md`; pipe screen: `docs/api/ui-tech.md`.)
- Rebuild cost is linear in the dissolved networks: ~2.5 ms for 1000 pipes in node, so maybe 5-10 ms on a slow phone
  for the very largest network (player-paced: one rebuild per placed or broken pipe).
- Reservations are per block and item: two different items reserving the last empty slot of a crate can both be sent;
  the second re-routes on arrival.
- `src/sim/simulation.ts` is 621 lines (aim 350) - the facade gained the transport members; `playthrough.test.ts` 691.
