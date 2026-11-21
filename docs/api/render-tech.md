# Feature visuals part 2 - transport and hearths in the world (src/render/tech)

Spec 16 (items and fluids moving through pipes) and 17.4 (formed hearths, ghost preview, problem highlight), drawn on
top of the simulation's views: `sim.transportView()` and the networks of `docs/api/transport.md`, the furnace entity's
`hearth` summary of `docs/api/hearth.md`, and the overlay events `'ghost:show'` / `'ghost:clear'` / `'highlight:block'`
of `src/core/gameEvents.ts`. Everything lives in `src/render/tech/`; the Renderer owns one `TechLayer`.

Tests: `npx vitest run src/render/tech` (16: packet paths and extrapolation, item looks, the pipe window mask, pipe
pieces against the mesher, shown fluid level, the heat ramp equal to the UI's, hearth boxes, ghost sight lines, the edge
arrow, the cell light cache, and the transport feed on the real simulation).

## Wiring (done)

```ts
// src/app/game.ts, right after the Renderer is created:
this.renderer.setTransport(simTransportFeed(sim));
```
That is the only line outside src/render. Hearths, ghosts and highlights need nothing: the renderer reads the world's
block entities and listens to the bus.

## Public API

From `src/render` (index.ts):

| export | semantics |
|---|---|
| `Renderer.setTransport(source: TransportSource \| null): void` | where packets and pipe contents come from, asked once per frame; null draws none |
| `simTransportFeed(sim: Simulation): TransportSource` | adapts the simulation: `sim.transportView()` for packets, `sim.transport.items/fluids` for which pipes carry what; one refresh per simulation tick, objects reused |
| `interface TransportSource { frame(): TransportFeed }` | |
| `interface TransportFeed { tick; packets: ArrayLike<PacketFeed>; nets: ArrayLike<PipeNetFeed>; netCount }` | `tick` changes every simulation tick; only the first `netCount` nets are live |
| `interface PacketFeed { item; points: Float32Array; length; along; speed }` | a packet: follow `points` (xyz) for `along` of `length` blocks at `speed` blocks/s |
| `interface PipeNetFeed { family: 'item' \| 'fluid'; fluid; colour; glow; fill; flowing; xs; ys; zs; size }` | a network whose pipes carry something (their active bit); `flowing` = fluid moved within the last second |
| `RenderStats.tech: TechStats` | `{ packets, pipePieces, hearths, ghosts }` drawn last frame |
| `RenderStats.techMs` | CPU milliseconds of the layer's update last frame |

Inside `src/render/tech` (exported for tests and the Renderer): `TechLayer` (`update(dt, time, camera, day, sky, block)`,
`setTransport`, `setScale`, `stats`, `highlight`, `dispose`), `PacketLayer`, `PipeOverlay`, `HearthLights`,
`GhostLayer`, `BlockHighlight`, `CellLight`, and the pure helpers `cumulativeLengths`, `pointAlong`, `packetDistance`,
`itemLook`, `buildPipeMask`, `pipePieces`, `shownLevel` (`FLOWING_LEVEL` 0.6), `heatColor`, `heatGlow`, `HEAT_RAMP`,
`hearthBox`, `hearthOpenTop`, `shellNormal`, `sightTo` (`CLEAR` / `LEAVES_ONLY` / `BLOCKED`), `edgeArrow` (with
`ArrowInsets`). Constants: `PACKET_CAP` 150, `PACKET_RANGE` 64, `PACKET_CUBE` 0.26, `PACKET_ICON` 0.36, `OVERLAY_CAP`
4096 pieces, `OVERLAY_RANGE` 48, `HEARTH_CAP` 16, `HEARTH_RANGE` 160, `SWEEP_S` 1.7, `GHOST_CAP` 512.

Also changed in src/render: `src/render/textures/transport.ts` (bigger sight glasses on the fluid pipes, `pipeWindow`),
`tiles.ts` (`pipeWindowTexel`), `target.ts` (`edgeGeometry` exported), `emitters.ts` (an open-topped hearth's furnace
does not smoke from its own top), `renderer.ts` (the layer, `setTransport`, stats).

## What is drawn

**Items in pipes** (`packets.ts`). One tiny cube (block items with a cube-like shape, textured with the block's faces,
tumbling slowly) or a camera-facing icon (every other item, its atlas icon, alpha-tested) per packet, at
`along + speed x (time since the tick)` along its polyline, clamped to the end. At most 150 drawn, within 64 blocks,
frustum-culled per packet. Lit like the terrain from the light of the pipe cell it is in. Two draws of the same
instances: packets in a glazed bronze chute are drawn after the chunks' blended batch (render order 3), so the glass
in front does not wash them out; packets in a steel conveyor (mostly opaque) are drawn with the opaque geometry and show
through its roller gaps.

**Fluids in pipes** (`pipeOverlay.ts`). The fluid pipe tiles got real sight glasses: the outer 3 texels x 4 rows of
every arm band (a 6-texel window across each joint of a run); the hot pipe has a 2x2 port on each arm. For every pipe
of a carrying network within 48 blocks the overlay repeats the mesher's pipe geometry (core, arms to the neighbours
`PIPE_JOINS` joins, collars at endpoints with the collar's stretched texture mapping) as instanced boxes, offset in
depth, and a 16x16 mask of the tiles' window texels decides where the inside shows:
- the window shows the fluid's colour up to the network's level (`fill`, but a network that streams fluid straight
  through - it holds next to nothing between ticks - shows `FLOWING_LEVEL` 0.6) on the sides of horizontal runs, with a
  brighter line at the surface; vertical runs, tops and bottoms show it whole; streaks drift slowly along the pipe while
  it flows and stand still when it does not;
- lava (and any `glow` fluid) is full-bright and flickers - a hot pipe at night is a row of orange ports;
- the carrying bit: a faint wash of the fluid's colour over the whole pipe (warmer for lava), and warmer glass on an
  item pipe with packets in it.
One draw call; instances are rewritten once per simulation tick (or when the camera moves 4 blocks), never per frame.
Each network's boxes are built once (keyed by the network's position arrays) and rebuilt after pipe-related block
changes.

**Formed hearths** (`hearths.ts`, `hearthShaders.ts`). Twice a second the block entities are scanned for furnaces whose
`hearth` summary is formed (tier >= 2), within 160 blocks; each frame reads their live `tempC`. Nothing shows below
~150 C; `heatGlow` ramps the strength to full by ~800 C; colours follow the heat ramp (`HEAT_RAMP`, the stops of
`src/ui/kit/format.ts`, a test keeps them equal; an ignited Starhearth burns gold).
- Molten pool: an emissive quad on the interior floor - crusted dark slag with glowing seams while merely hot, a
  churning melt with deep-orange troughs, near-white crests and drifting bright skins as it climbs the ramp; flickers.
- Chamber glow: the interior box's back faces (additive, inset from the walls) - the inner walls glow, brightest at the
  melt, stronger in a closed chamber. Seen through an open top or any glass in the shell.
- Halos (a `Glows` of its own): over an open top and just outside each window (up to 6), stronger at night.
- Open top: smoke puffs rising over the opening (3 + 0.9 x area a second while lit; the controller's own smoke is then
  off) and heat shimmer (an additive camera-facing column of wavering streaks).
- Formation: on `'hearth:formed'` a bright band climbs the shell's outside (seams catch it) over 1.7 s.

**Ghost preview** (`ghosts.ts`). `'ghost:show' { key, cells }` replaces the preview of that key; `'ghost:clear'`
removes one key or all. Missing cells: translucent blue cubes a little smaller than a block with a faint image of the
block that belongs there; wrong cells: red-tinted, hatched cubes just outside the block that is in the way (`air` wanted
= clutter inside). Brighter edges, a slow breathing pulse, self-lit (reads at night). Depth-tested; a second pass
without the depth test draws, at 45%, only the ghosts that just leaves stand in front of (sight lines walked through the
voxels, 8 a frame, only after the camera moved). Two draw calls while a preview is up.

**Problem highlight** (`highlight.ts`). `'highlight:block' { x, y, z, seconds }`: a thick red outline and faint red
fill, pulsing, drawn through everything, fading out over the last 0.6 s; a new highlight replaces the old one, and a
`'hearth:formed'` whose shell (plus one block round it) holds the marked block cuts it to that 0.6 s fade - the problem
is solved, so no red marker stays on the finished shell. While the
block is off-screen a red arrow (a 40 px DOM element inserted right after the canvas, under the UI root) sits where the
line from the screen centre towards the block leaves a rectangle kept clear of the HUD (top 40 px + 8%, bottom 70 px +
14%, sides 30 px + 4%) and points at it; for a block behind the camera it sits on the left or right edge - the way to
turn.

## Measured

Real built game, headless Chromium (SwiftShader software GL, a container shared with other engineers), a busy scene: two
item lines with 4 pulling crates into a Blast hearth's hatch and a crate, two water lines, a riser, a lava line, a Blast
hearth (open top) and an Arc hearth (closed, 2 windows) at 1250 C, a 56-cell Plasma ghost: ~150 overlay pieces, 2-4
packets in view. `techMs` median **0.2 ms**, p90 0.3 ms (390x844) / 0.5-0.8 ms (1280x800, ~6 fps software rendering);
rare single-frame spikes of 2-8 ms on desktop came from GC or the shared CPU (the per-part maxima moved between runs).
Draw calls added: packets 1-2, overlay 1, hearths up to 5, ghosts 2, highlight 2 - only while there is something to show.
Per frame nothing is allocated (instance arrays are preallocated; network boxes and packet path lengths are built once
per network / path).

Screenshots reviewed at 1280x800 and 390x844 (scratch, not in the repo): a busy ore line into a hearth hatch (by day,
close and wide), water and lava lines into tanks (day, close, night), a water riser, a formed Blast hearth with an open
top at night (pool, glow, smoke, halo) and through its west window, an Arc hearth through its window at night, its
interior, the formation sweep, a Plasma ghost from above, close and through a hedge of leaves, the highlight on screen
and its edge arrow for a block behind the camera (desktop and phone).

## Deviations and decisions

- Fluid level: a network streaming fluid through (empty at every tick's end) shows a running stream at 0.6, not 0.
- Packets in glass chutes are drawn after the glass (crisp, a touch of the glass's tint) rather than behind it at
  60% glass: behind the glass they were invisible on a phone. They draw over the chute's thin bronze ribs.
- "The hearth lights its surroundings": by halos (additive light over the opening and outside windows) and the chamber
  glow, not by real block light on the terrain (that is the world's light flood; the shell blocks emit what the content
  says).
- The highlight outline shows through walls (a problem block is often inside or behind the shell).
- The interior haze, shimmer and halos are additive: by day they are subtle, at night strong.

## Known gaps

- The formed shell's glowing-seam tiles do not brighten with temperature (a static `_on` tile; the chunk shader has no
  per-block temperature).
- Heat shimmer is a drawn effect (wavering light streaks), not a refraction of what is behind it.
- Flow direction is not known to the renderer: streaks drift the same way along an axis whichever way the fluid runs.
- A packet shows one item whatever its count.
- Packets beyond the 150 cap (or networks beyond 4096 boxes) are simply not drawn; the first ones in the snapshot win.
- The edge arrow can sit under a screen that is open (the UI root is above it), which is intended.
- Timing only measured on software GL in a shared container; no real phone.
