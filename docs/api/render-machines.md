# Feature visuals part 1 - machines alive, real pipes, cool glows, a bigger atlas

Spec 14 ("MACHINES ALIVE IN THE WORLD"), 16.1 (pipe shape), the cool glow of glowcaps and crystal clusters (spec 14)
and texture capacity past WebGL2's guaranteed 256 array layers. Touches `src/world` (mesher, block tables, lighting
colour) and `src/render` (machine parts, shaders, atlas, held item, target box, the two item-pipe tiles).
No wiring is needed: the Renderer creates and drives everything itself.

Tests: `npx vitest run src/world src/render` (new: `src/world/meshPipe.test.ts` 5, `src/world/coolLight.test.ts` 4,
`src/render/machines/machineParts.test.ts` 8, 3 more in `src/render/atlas.test.ts`, the pipe tile test rewritten).

## 1. Pipes as real geometry (src/world/meshPipe.ts, blockTables.ts)

- Shape `pipe` is its own mesher shape (`SHAPE_PIPE`), no longer the cable stand-in. A pipe is a square core
  (`PIPE_CORE_MIN..PIPE_CORE_MAX`, 4/16..12/16 on every axis) with an arm of the same cross-section towards every
  neighbour it joins; arm ends meeting another pipe are open (the runs are seamless tubes), an arm meeting an
  endpoint ends in a **collar** 1/16 wider on every side and 2/16 deep, flush against the block (its face against
  an opaque endpoint is culled). Collars sample the arm band of the plus tile, so no clear corner texel shows.
- Joins are exactly `registry.pipeJoins`, precomputed: `PIPE_FAMILY[id]` (pipes: `PIPE_ITEM` 1 / `PIPE_FLUID` 2),
  `PIPE_JOINS[id]` (the families a block joins: a pipe its own; an endpoint every family it takes or gives),
  `PIPE_ENDPOINT[id]` (1 for non-pipe endpoints: gets a collar). A pipe of family f grows an arm to n iff
  `PIPE_JOINS[n] & f`. A test checks every (pipe, block) pair against `pipeJoins`. Item and fluid pipes never join.
- **Item pipes are see-through**: both item pipes go in the translucent batch; `pipe_item`'s glass panes are alpha
  132-175 and `pipe_item_fast`'s roller gaps alpha 140 (rims, ribs and collars stay 255; every texel >= 128 so the
  held item's pixel extrusion keeps the glass). The translucent material is double-sided and transparent, which
  three.js draws back faces first, then front faces: the far wall of a tube shows through the near one correctly.
  Fluid pipes stay opaque.
- Exported constants: `PIPE_COLLAR_MIN`, `PIPE_COLLAR_MAX`, `PIPE_COLLAR_DEPTH`; `pipeArms(id, p)` (arm bit mask,
  mesher-internal volume index).
- `src/render/target.ts` `shapeBounds('pipe')` = the core box (the outline hugs the core).

## 2. Cool light (src/world/lighting.ts, meshQuads.ts, src/render/shaders/chunk.ts)

Chosen fix: **a light-colour channel carried by the light flood, written into the spare bits of the per-vertex
flags byte**. Cost: one extra byte array in the lighting pass (each cell takes the colour of the cell that lit it
most, a single store per improvement) and a mix in the vertex shader. No new vertex attribute, no new uniform.

- `LIGHT_HUE[id]` (blockTables): 0 warm firelight, `HUE_CYAN` 1 (glowcap), `HUE_VIOLET` 2 (crystal_cluster).
  The content has no light-colour field, so the two keys are listed in blockTables (`COOL_EMITTERS`).
- `computeLight(chunks, hueOut?: Uint8Array)`: with `hueOut` (LIGHT_VOLUME bytes) also writes each cell's light
  colour. `MeshInput.hue?: Uint8Array` passes it to `meshChunk` (when `light` is given without `hue`, all block
  light counts as firelight; without `light` the mesher computes both). `runJob` passes both.
- Flags byte per vertex (MeshBatch.light[3]): bits 0-2 as before (emissive, sway, liquid); **bit 3
  `LIGHT_FLAG_VIOLET`**, **bits 4-7 the cool share** 0..15 (`LIGHT_COOL_SHIFT` 4, `LIGHT_COOL_MAX` 15) of the
  vertex's block light that comes from cool emitters (weighted over the up-to-4 cells smooth lighting averages).
  Exported from `src/world/mesher.ts`.
- Shader: `blockTint(flags)` mixes the firelight colour towards `COOL_CYAN` (0.36, 0.84, 1.0) or `COOL_VIOLET`
  (0.72, 0.5, 1.0) by the share; `lightColorTinted(sky, block, tint)` (in `LIGHT_GLSL`; `lightColor` is unchanged
  for the mob shader). Cool light does not flicker.
- Glowcaps and crystal clusters themselves are drawn full-bright (`GLOWS[id]`: cross blocks that emit light).
- (Resolved) The light probe now reports the cool share (`LightProbe.cool/violet/tint`): the held item and particle
  debris take the cyan / violet glow (docs/api/integration.md, pass 2). Machine parts and animals still use firelight.

## 3. Texture capacity (src/render/atlas.ts)

- `createAtlas(maxLayers = Infinity): Atlas` - the Renderer passes `gl.getParameter(MAX_ARRAY_TEXTURE_LAYERS)`.
  Past the limit the tiles go into a **second array texture**: `Atlas { texture, texture2: DataArrayTexture | null,
  split, data, layers }`, `split` = first layer of page 2 (= `layers` with one page).
- `atlasSplit(layers, maxLayers): number` (throws past two pages: 512 layers on a 256-layer device),
  `GUARANTEED_LAYERS` 256, `MAX_ATLAS_PAGES` 2.
- `ATLAS_GLSL` (fragment code): `atlasTexel(uv, layer)`. Compiled plain (`texture(uAtlas, ...)`, exactly as before)
  unless the material defines `ATLAS_SPLIT` (`atlasDefines(atlas)`), then it picks the page per primitive and
  samples with `textureGrad` using derivatives taken outside the branch. Uniforms `uAtlas`, `uAtlas2`,
  `uAtlasSplit` (`atlasUniforms(atlas)`, also members of `WorldUniforms`; `createWorldUniforms(atlas, atlas2 = null,
  split = 0)`). Used by the chunk materials, the held item (`new HeldItem(uniforms: AtlasUniforms | null)`) and the
  machine parts.
- Verified in the real game with `getParameter` patched to report 128 layers: identical frames (pipes, casings,
  hatches and the held pipe all live on page 2 then). The content test still caps the registry at 256 - that cap
  (src/content) can be raised now.

## 4. Machines alive (src/render/machines/)

`MachineParts` (created by the Renderer, added to its scene, `update(dt, camera)` each frame before drawing):

```ts
class MachineParts {
  constructor(world: IWorld, uniforms: WorldUniforms)
  readonly group: THREE.Group
  drawn: number            // instances drawn last frame
  readonly tracked: number // animated machines within MACHINE_RANGE
  update(dt: number, camera: THREE.PerspectiveCamera): void
  dispose(): void
}
MACHINE_DRAW_CAPACITY = 128 (per kind) ; MACHINE_RANGE = 96 ; SCAN_INTERVAL_S = 0.5 ; FRESH_PROBES = 8 ; REPROBE_FRAMES = 3
MACHINE_ANIMS: readonly MachineAnim[]   // per kind: build(), speed(entity, active), extent?, centerY, radius, probeY, shake?, byWater?
placeMatrix(m: Float32Array, x, y, z, yaw): void
```
`RenderStats` gained `machines` (instances drawn) and `machinesMs` (CPU time of the update).

- Twice a second it scans `world.entities()` (like the emitters) for the six animated kinds within 96 blocks whose
  block is loaded and still there, keeping one record per machine (instance matrix from position and facing, target
  speed, drill extent). Every frame: ease each speed towards its target (spin-up and coasting, ~1 s), advance the
  angle, cull by fog distance and frustum sphere, write instance matrix + `aState` (angle, extent, sky, block light)
  of the visible ones. **One instanced draw call per kind in view**; nothing is allocated per frame.
- Motion runs in the vertex shader (material.ts): per-vertex assembly pivot/axis/motion code - spin, slide
  (`sin(angle + phase) * stroke`), stretch (drill string scaled to the extent), follow (the bit carried to the end).
  Lit like the terrain: sky/block light probed at the machine (8 fresh probes per frame, one re-probe every 3 frames
  round-robin), the terrain's ramps, sky tint, firelight, face shading from the moved normal, fog. Textured from the
  atlas (`concrete` tinted as painted metal, `plank` / `oak_log_side` for the wheel), one block = one tile.
- The parts (model frame: block bottom centre, front = -Z, all built from boxes in models.ts):
  | kind | parts | speed |
  |---|---|---|
  | wind_turbine | mast, nacelle, 3-blade rotor 2.8 across (red tips) facing out of the front, hub 2.47 above the block | 3.4 rad/s x availW / outputW (to x1.5 in storms) |
  | water_wheel | wheel 1.8 across with two rims, spokes and 8 paddles; axle across the block top on two bearings; the lower paddles dip into the water. Turned so the wheel runs through the water around it (by the water neighbours, not the facing) | 1.5 x availW / outputW (shared flow slows crowded wheels) |
  | steam_engine | flywheel with crank pin on the right flank (model +X), piston rod sliding out of a copper cylinder in step with the pin (tested) | 7 x availW / 2000 |
  | steam_turbine | 8-blade rotor spinning just proud of the front, static shroud | 14 x availW / 8000 |
  | bore_rig | derrick with turning kelly and gear on top; drill string down the bored shaft to a fluted bit inside the last block mined (`depthY`); shakes while running | 6 x (0.35 + 0.65 f) while active |
  | pump | cylinder on top with a gently bobbing rod | 3.2 x (0.35 + 0.65 f) while active |
  Generators follow `availW` (what they could deliver: a turbine in the wind spins with nothing drawing on it);
  without the field they fall back to the voxel's active flag. Steam puffs and exhaust stay with the emitters.
- Measured: node, 50 machines in view: 0.21 ms per update (scans and probes included, FakeWorld). Headless Chromium
  (software GL, a loaded machine), 50 machines in view: `machinesMs` median 0.1 ms, p90 0.2 ms, max 6 ms (a rare
  frame; the machine was shared with other engineers' browsers). Every machine kind adds one draw call when in view.

## 5. Verification (real game, `__hw`, headless Chromium, 1280x800 and 390x844)

Reviewed screenshots of: a pipe yard (crate -> item pipe with a T to a second crate and a climb through a steel
conveyor to a clay furnace; tank -> fluid pipe T up to a second tank, hot pipe on to a steam turbine; pump; an item
pipe running beside fluid pipes without joining), a close-up of the glass tubes and collars, a wind farm of six
turbines, a steam engine on a lit clay furnace at night (flywheel, rod, smoke, firelight), a water wheel at a lake
shore, a bore rig from above and its drill string and bit seen from a pit dug beside the shaft, glowcaps and crystal
clusters in a sealed cave (cyan pools, faint violet around the crystals), 50 mixed machines at once, and the atlas
split. Rotor angles were read back over time to confirm the animation runs.

## Deviations

- `lighting.ts`, `jobs.ts` (world) were touched for the light colour - outside the brief's two files, unavoidable
  for cool light that actually lights the cave rather than only the plant.
- The mesher's quad machinery moved to `src/world/meshQuads.ts` (mesher.ts was over 350 lines); behaviour unchanged.
- Pipe arms have the core's cross-section (the core contract says core and arms span PIPE_CORE_MIN..MAX); the
  collar is the only wider part.
- The pipe active bit ("carrying something") is not drawn yet: no tint, no moving items (part 2 of the feature
  visuals; the glazed item pipes are ready to show items inside).
- The steam engine's flywheel always sits on its model +X flank (the left side seen from the front); placed against
  water or a wall on that side it is hidden.

## Known gaps

- Wrench-parted joints (sim state) are not visible to the mesher: a parted joint still draws its arm.
- Translucent sorting is per chunk mesh: two glass tubes overlapping from the camera's view can blend in the wrong
  order (the same limit as glass panes).
- The light probe for the hand and particles ignores light colour (the hand is warm-lit next to a glowcap).
- Formed-hearth visuals (seam glow at night, molten pool, light sweep, ghost preview) and items/fluids moving in
  pipes are not part of this pass.
- Timing only measured on software GL in a shared container; no real phone.
