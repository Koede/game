# src/render - public API

Everything drawn in 3D (sky, chunk meshes, target box, particles, the first-person hand) plus the UI's item
icons. `src/render/textures` has its own notes (`docs/api/textures.md`). Import from `src/render` (index.ts).
Imports only core, content (through the registry), game (`clock.sunlightAt`/`NIGHT_SUNLIGHT`) and three.js;
never sim, player or ui. 38 unit tests (`npx vitest run src/render` also runs the 16 of src/render/textures).

## Wiring in main.ts

```ts
import { Renderer, createIconProvider } from './render';

// Create the renderer BEFORE the first world.update(): it builds meshes from 'chunk:meshed' events and
// has no way to ask for chunks that were meshed before it existed.
let renderer: Renderer;
try {
  renderer = new Renderer(app /* #app */, world, bus, clock /* GameClock */, settings);
} catch (err) {
  // Thrown when WebGL2 is unavailable; the message is player-readable. Show the friendly full-screen notice.
}
gameUI.setIconProvider(createIconProvider());
const controller = new PlayerController(..., renderer /* IView */, ...);

// every frame, after controller.update() and world.update():
renderer.render(dt);
```

## Renderer (renderer.ts) - implements `IView`

- `new Renderer(container: HTMLElement, world: IWorld, bus: GameBus, clock: ClockLike, settings: Settings)`
  - Creates a `<canvas class="game-canvas">` and **prepends** it to `container` (the page shell styles it to fill
    `#app`). Throws `Error('Hearthwatt needs WebGL2, which this browser or device does not provide.')` when
    `getContext('webgl2')` fails.
  - Pixel ratio is capped at 2 (desktop) or 1.5 (coarse pointer / touch points). Resizes itself through a
    `ResizeObserver` on `container` (window `resize` as a fallback).
  - Listens to `chunk:meshed`, `chunk:hidden`, `chunk:unloaded` (meshes), `settings:changed` (fov, render
    distance), `block:broken`, `block:mining`, `block:placed`, `furnace:pumped`, `furnace:lit`,
    `furnace:upgraded`, `furnace:ignition`, `item:made`, `machine:job`, `explosion` (effects).
- `interface ClockLike { readonly timeOfDay: number; sunlight(): number }` - `GameClock` satisfies it.
- IView: `setView(x, y, z, yaw, pitch)` (eye position; yaw 0 = north, positive turns left; pitch up),
  `setFov(degrees)`, `setTarget(target | null, mining)` (outline the block; `mining` 0..1 shows one of 8 crack
  stages, -1 none; the coordinates are copied, so the caller may reuse its object), `setHeldItem(itemKey | null)`
  (the hand dips out and comes back with the item), `triggerSwing()`.
- `render(dt: number): void` - one frame (dt in seconds drives water, plants, particles, the hand). Does
  nothing while the context is lost or after `dispose()`. Allocation-free.
- `resize(): void` - matches the drawing buffer to the container (called automatically).
- `stats: RenderStats` (updated in place each frame): `drawCalls`, `triangles` (last frame, world + hand),
  `chunks` (chunks with a mesh), `chunkTriangles` (all chunk meshes, drawn or culled), `particles`,
  `effectSources` (smoking furnaces / steaming machines near the camera), `cpuMs` (CPU time of the last
  `render()`), `pixelRatio`.
- `contextLost: boolean` - true between `webglcontextlost` and `webglcontextrestored` (three.js re-uploads
  every texture and buffer on restore; verified in headless Chromium with `WEBGL_lose_context`).
- `dispose(): void` - removes listeners and the canvas, frees every GPU resource.
- Also public for debugging / harnesses: `canvas`, `gl` (THREE.WebGLRenderer), `scene`, `camera`.

## Icons (icons.ts)

- `createIconProvider(): IconProvider` - `(itemKey) => HTMLCanvasElement | null`, the kit's `IconProvider`
  type. One cached 64x64 canvas per item (null for unknown keys): cube-like block items (cube, slab) as an
  isometric cube (top, front texture on the left face, side on the right; shaded 1 / 0.8 / 0.6 with a dark
  rim), everything else as its 16x16 icon scaled 4x with nearest-neighbour. 2D canvas only, no WebGL.
- `drawIcon(itemKey): HTMLCanvasElement | null` - one uncached icon. `ICON_SIZE = 64`.

## Sky model (skyModel.ts) - pure, node-testable

- `computeSky(timeOfDay, sunlight, out: SkyState): SkyState` (allocation-free), `createSkyState()`,
  `sunAngle(t)`, `sunHeight(t)`, `luminance(rgb)`, `NIGHT_SUNLIGHT` (re-exported from src/game/clock).
- `SkyState`: `sunDir`, `moonDir`, `zenith`, `horizon` (= fog colour), `glow` (dusk glow towards the sun),
  `sunColor`, `skyLight` (tint of a fully sky-lit surface: warm white by day, moonlight blue at night),
  `cloud`, `stars` 0..1, `day` 0..1.

## How it draws

- **Atlas** (atlas.ts): one `DataArrayTexture` (sampler2DArray), one 16x16 layer per `TEXTURE_NAMES` entry in
  registry order, nearest magnification, trilinear mipmaps; invisible texels carry the tile's mean colour so
  mipmaps do not darken plant edges. Painted by `src/render/textures` through tiles.ts.
- **Chunk materials** (materials.ts, shaders/chunk.ts): three GLSL ES 3.00 ShaderMaterials sharing one
  uniform set. All lighting is per vertex (`skyRamp(sky) * skyTint` vs `blockRamp(block) * firelight`, the
  larger plus 22% of the smaller, times the baked shade, floored at an ambient 0.035); emissive flag = full
  brightness; sway flag = wind motion of plant tops; liquid flag = shimmer and slow UV drift. Distance fog in
  the sky's horizon colour (plus the dusk glow towards the sun) ends just inside the loaded circle
  (`(renderDistance + 0.5) * 16 - 6`); dense blue fog under water, orange in lava. Firelight flickers gently.
  Cutout discards below alpha 0.4; translucent is blended, double-sided, no depth write.
- **Chunk meshes** (chunkMeshes.ts): up to three meshes per chunk (empty batches get none), 16-bit indices
  when possible, bounding box fitted to the mesh height for frustum culling, render order opaque -> cutout ->
  translucent, geometry disposed on replace / hide / unload.
- **Sky** (sky.ts): dome (gradient, square sun, moon, twinkling stars; below the horizon exactly the fog
  colour so far terrain melts into it; replaced by the fog colour when the camera is submerged) and a layer
  of soft-edged drifting clouds at y 112 that fade with distance (a faint veil at night).
- **Effects**: target.ts (outline made of 12 thin boxes so it reads on phones; pale where it is dark, dark
  where it is bright; fitted to slabs, torches and plants; 8 procedural crack stages), particles.ts (one pooled
  `THREE.Points` draw call, 2048 particles, square chips and soft puffs, swap-remove, partial uploads),
  puffs.ts (recipes), emitters.ts (debris in the block's own colours on mining / breaking / placing; smoke from
  every lit furnace at >= 200 C within 176 blocks, ember-lit at the base, soot above; golden motes instead
  of smoke from an ignited Starhearth; sparks from the furnace mouth on bellows pumps and lighting, at the
  nearest hot furnace when forging, bursts on upgrade and ignition; steam from running steam engines,
  stills, geothermal taps, fission piles, electrolyzers; exhaust from burner generators and combustion
  engines; an explosion burst), glows.ts (an additive halo in front of every hot furnace's mouth, coloured
  by tier, flickering, stronger at night).
- **Held item** (heldItem.ts): its own scene and camera drawn after clearing depth. Cube-like blocks as a
  small textured cube, every other item as its icon extruded into a 1/16-thick pixel slab, an empty hand as
  a sleeve and hand. Swing on `triggerSwing()`, a dip on item change, a small dip on `block:placed`; lit by
  a light probe at the eye; smaller and further in on portrait screens.
- **Light probe** (lightProbe.ts): estimates sky and block light at any point from the voxels (`surfaceY`
  and emitters within 7 blocks) with the same ramps as the shader. Used for the hand, the outline colour,
  debris colours, animals, machine parts and cell lights. The 15-wide cube is read straight from the 1-4 chunk
  voxel arrays it spans (`World.chunkVoxels`, optional on the world: test worlds without it fall back to
  `getVoxel`), with emission from the `EMIT`/`EMIT_ACTIVE` tables and rows skipped once nothing in them can win:
  about 0.013 ms a probe in node (0.1 ms before) and no garbage.

## Measured (headless Chromium, SwiftShader software GL, seed 1234567, spawn)

| viewport | render distance | view | draw calls | triangles drawn | chunk meshes (all tris) | render() CPU median | frame interval |
|---|---|---|---|---|---|---|---|
| 1280x800 | 4 | high, looking over | 64 | 88k | 69 (236k) | 0.8 ms | 57 ms |
| 1280x800 | 4 | ground | 71 | 115k | 69 (236k) | 0.8 ms | 56 ms |
| 1280x800 | 6 | high | 117 | 175k | 137 (457k) | 1.1 ms | 68 ms |
| 1280x800 | 6 | ground | 120 | 199k | 137 (457k) | 1.0 ms | 68 ms |
| 390x844 @1.5 | 4 | high / ground | 39 / 45 | 52k / 78k | 69 | 0.6 / 0.5 ms | 36 / 34 ms |
| 390x844 @1.5 | 6 | high / ground | 65 / 69 | 94k / 127k | 137 | 0.9 / 0.7 ms | 47 / 42 ms |

Frame intervals are software rendering on a CPU (not representative of a phone GPU); CPU time spent in
`render()` is about 1 ms. Draw calls stay well under the 250 budget at 6 chunks (frustum culling, empty
batches skipped; the busiest scenes seen were ~150 with a base, particles and halos). Every brief scene
was screenshotted at 1280x800 and 390x844 and reviewed: daytime vista, dusk, night, torch-lit cave, a lit
clay furnace at night with smoke (close and from 45 blocks away, also by day), lake shore, under water,
each biome, a wall of every block (inactive by day and active at night), held items and swing, target
outline with cracks, effects (bellows sparks, debris, steam, exhaust, explosion), the icon sheet.

## Deviations from the spec

- Lighting is `max(skyRamp(sky) * skyTint, blockRamp(block) * firelight) + 0.22 * min(...)` rather than
  `max(sky * sunlight, block)`: the sky tint (from `computeSky`) carries the time of day and keeps a moonlit
  floor (night outdoors is dim blue, never black on a phone); multiplying by the clock's raw 0.08 night
  sunlight would make every night pitch black.
- Extra: additive halos at furnace mouths, gentle firelight flicker, a sky veil under water.
- The ignited Starhearth emits golden motes instead of smoke (it burns no fuel).
- `setTarget` takes progress 0..1 (the IView contract) and maps it to 8 crack stages itself.
- The renderer reads the game clock through a two-member `ClockLike` interface, not the GameClock class.

## Known gaps

- Transparent sorting is per chunk mesh (three.js sorts objects, not faces): two panes of glass in the same
  chunk can blend in the wrong order from some angles. Water is a single layer and looks right.
- The light probe used for the hand and particle colours is an estimate (open-column test plus emitters within
  7 blocks); the hand can be a little brighter or darker than the terrain at the same spot.
- Torches and lava have no particles (only furnaces and machines with block entities emit).
- No catch-up API for chunks meshed before the Renderer was created (create it first, see Wiring).
- Frame times were only measured in headless software rendering; real-phone GPU timing is untested.

## Later additions (feature visuals, see docs/api/render-machines.md)
- `src/render/machines`: animated machine parts (`MachineParts`, created by the Renderer); `RenderStats.machines`,
  `machinesMs`.
- Atlas split over two array textures past `MAX_ARRAY_TEXTURE_LAYERS` (`createAtlas(maxLayers)`, `ATLAS_GLSL`,
  `atlasDefines`, uniforms `uAtlas2` / `uAtlasSplit`); `new HeldItem(uniforms)` now takes the atlas uniforms.
- Cool block light (cyan glowcaps, violet crystals) through the chunk flags byte: `blockTint`, `lightColorTinted`.
- `shapeBounds('pipe')` is the pipe core.

## Weather (spec 15)
The weather feature changed this module: see `docs/api/weather.md` for what was added and why.

## Transport and hearths in the world (spec 16, 17.4)
`src/render/tech/` (feature visuals part 2): items and fluids in pipes, formed-hearth glow, ghost preview, problem
highlight. New on the Renderer: `setTransport(source)` (`simTransportFeed(sim)`), `RenderStats.tech` / `techMs`. See
`docs/api/render-tech.md`.
