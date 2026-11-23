# Merged multiblock models (`src/render/formed`)

A formed multiblock is drawn as **one model** over its bounding box instead of its individual shell blocks (the way
Immersive Engineering / Oritech structures snap into a single machine). Hearths (Blast 3, Arc 4, Plasma 5, Star 6) use
it today; the boiler vessel (BRONZE_PLAN section 6) and the distillery rigs plug in by registering a kind.

## Pieces

| File | What |
|---|---|
| `src/world/shellHide.ts` | `shellHiding` registry: boxes whose **shell cells** the mesher skips. `set(id, {min, max, keep})`, `clear(id)`, `forChunk(cx, cz)`, `isHiddenShellCell`. Voxel data is untouched (blocks stay targetable, breakable, simulated). |
| `src/world/mesher.ts`, `jobs.ts`, `streamer.ts` | `MeshInput.hidden` / `MeshJob.hidden` carry the boxes that touch a chunk; the streamer re-meshes the chunks a box covers whenever one is set or cleared. Hidden cells emit **no faces** (chunk meshing cost drops with them). |
| `formed/registry.ts` | `formedModel` registry: `register(kind)`, `build(spec)`, `specKey(spec)`. A `FormedKind` has `find` (instances near the camera), `parts` (windows/hatches/... read off the world), `build(spec) -> ModelData`, optional `listen(bus, notify)` for formed/unformed events. |
| `formed/meshBuilder.ts` | Pure triangle builder (`quad`, `tri`, `box`, `prism`, auto-winding) and the material ids `MAT`. |
| `formed/hearthModel.ts` | The hearth builder and kind. |
| `formed/tracker.ts` | `FormedTracker`: the lifecycle, no GPU (scan, confirm, show, hide, rebuild, snap timers). |
| `formed/layer.ts`, `shaders.ts` | `FormedLayer` (one `THREE.Mesh` per structure, owned by `TechLayer`) and the GLSL (procedural brick / plating, heat glow, snap). |

## Adding a kind (boiler, distillery rig)

```ts
formedModel.register({
  kind: 'boiler',
  find(world, x, z, range, out) { /* push FormedInstance { id, kind, tier, min, max, closed, controller, tempC, gold } */ },
  parts(world, inst) { /* FormedPart[]: cell in the model frame, outward normal, kind string */ },
  build(spec) { /* MeshBuilder -> ModelData; spec has tier, size, closed, parts, controller */ },
  listen(bus, n) { /* optional: n.formed(id) on a formed event (starts the snap), n.unformed(id) on unform */ },
});
```

The registration of `hearthKind` happens in `layer.ts`; register other kinds from your own module before the first scan.
`FormedInstance.id` must be stable between scans. Specs are plain data and equal specs build equal models, so a
structure is rebuilt only when `specKey(spec)` changes.

## Hearth model

* **Shell**: one quad per wall cell (so cells holding parts can be cut into bays) with procedural continuous pattern
  by world-model coordinates: running-bond brick (tiers 3-4) or plated casing (5-6); no per-block seams. Vertical edges and top
  edges are chamfered (0.11 block) in the trim colour, with corner triangles; plinth round the foot; an underside quad.
* **Mouth**: the controller cell is left uncovered (the real furnace block shows) and framed by four trim boxes.
* **Parts** (read from the shell blocks; face cells only): window (recessed glass with mullions that glows with the fire),
  item hatch (slot and lip), fluid hatch (blue nozzle), power port (copper/gold stub), blower (louvred housing), electrode
  (graphite rod with collar, standing on the roof). Each sits in a recessed bay with a trim frame.
* **Top**: closed -> a raised roof slab (tier 4: copper bus parapet crown; tier 6: gold inlay); open -> a tapering hood /
  chimney collar with a lined opening (the sim's smoke, shimmer and haze still rise from it).
* **Lining**: the inside faces are drawn (visible through windows and over the hood) and glow with the furnace temperature.
* **Per-tier art**: 3 red brick with dark trim; 4 pale refractory brick with copper bus rings and the electrode crown;
  5 dark plasma casing with pulsing teal ring conduits; 6 pale star casing with gold trim and roof inlay.
* **Heat**: `uHeat` (0..1, `heatGlow(tempC)`, 1 for a lit Starhearth) and `uHeatCol` (the heat ramp colour) drive window glass,
  lining, mortar/seam leak and conduit pulse. Read from the furnace entity each frame by the layer.

## Lifecycle

1. Every 0.5 s (and at once on `hearth:formed`) each kind lists its formed instances (<= 24 nearest, 480 blocks).
2. An instance is **confirmed** first: its eight corners and its controller must be solid. A loaded save therefore shows
   its model on the first scan after the walls are loaded; nothing is hidden while a wall is missing.
3. On confirmation: model built, `shellHiding.set(id, ...)`, mesh created. If a `formed` notice was pending the **snap** plays:
   each cell's panels slide in from outside, staggered, over 0.75 s (`uSnap`), then a 0.45 s flash, and a `dig_metal`
   `sfx` (low pitch) at the settle. The sim's own `hearth_formed` sound and the light sweep play as before.
4. A changed spec (tier, parts, open/closed, box) is rebuilt in place (`onRebuild`), the hidden box updated.
5. **Unform**: `hearth:unformed`, a vanished entity, a cleared `entity.hearth` or a missing corner removes the model at
   once and clears the hiding, so the chunks re-mesh with the real blocks (no ghost model). `dispose()` clears everything.

## Cost

One `THREE.Mesh` (one draw call) per structure, ~1.5-3.5k triangles for 5^3..9^3 boxes; no per-frame allocation (a few
uniforms). Chunk meshes get *cheaper*: hidden shell cells emit nothing. `formed.test.ts` covers the builder, the mesher
skip, the lifecycle and a ten-hearth budget (all ten built within 300 ms, a steady scan under 25 ms).

Stats: `RenderStats.tech.formed` = models drawn.

## Part-and-track animation (`src/render/parts`, shared)

Oritech/Create-style moving parts, data-driven and renderer-agnostic. A model is static geometry plus a tree of named rigid
**parts**; each part has a `pivot` and **tracks**. All parts of a model are skinned by index in one draw call
(`aPart` attribute + `uParts[]` mat4 uniform, `PARTS_GLSL` in `parts/track.ts`).

```ts
const b = new MeshBuilder();
b.box(...);                                         // static
const i = b.part('fan', pivot, [{ type: 'spin', axis: [0, 0, 1], rate: 18 }]);   // parent = 4th arg (a part index)
b.box(...); b.endPart();                            // everything between part() and endPart() belongs to the part
const model = b.build(size);                        // model.parts (PartDef[]) + model.partIds (per vertex)
```

| Track | Effect (about the part's pivot) |
|---|---|
| `spin {axis, rate, phase?}` | rotates `rate` rad/s x speed (angle integrated: smooth spin-up, coast-down) |
| `osc {dir, amp, hz, phase?, floor?}` | pistons / pumping arms / bellows; stroke scales with speed (`floor` keeps a minimum) |
| `ramp {dir, amount, ease?}` | slides by `amount` x ease(level): electrodes lowering, arms extending |
| `swing {axis, amount, ease?}` | rotates by `amount` rad x ease(level): lids, doors, levers (`ease: 'back'` clunks open) |
| `scale {axis, amount, ease?}` | stretches about the pivot |

Eases: `linear in out inOut sine back`. Child parts compose on their parent. At most `MAX_PARTS` (24) per model.

**Motion**: `Motion {speed, level, angle, cycles, phase}`; `stepMotion(m, dt, target, timing?)` eases `speed` towards `target`
(0..1: drive it from the machine's real state: rpm / max, temperature, load) with `spinUp` / `coast` time constants
(a flywheel passes a long `coast`), and `level` with `settle`. `phase` is `Phase.Idle / Starting / Running / Stopping`.
`evalParts(parts, motion | motion[], out)` writes slot 0 = identity (static) and slot i + 1 = part i. Pure and node-testable.

To use it outside formed models: build geometry with `MeshBuilder` (or fill `aPart` yourself), add `PARTS_GLSL` to your
vertex shader (`vec3 p = (partMatrix() * vec4(position, 1.0)).xyz;`, rotate the normal with `mat3(partMatrix())`), keep one
`Float32Array(16 * (MAX_PARTS + 1))` per instance as `uParts`, and per frame call `stepMotion` + `evalParts`. See `formed/layer.ts`.

### Hearth parts
Blower: bellows plate pumping + a spinning fan (speed follows the fire); electrode rod lowers while the arc runs; open-top hood has
a damper that swings up when lit; Plasma roof coil and Starhearth gold ring spin (opposite ways); the hearth also has accent strips
under the cornice and a display face above the mouth that go from standby to a running readout (`FormedInstance.active`).
Target speed = `max(0.35, heat glow)` while active (the fire lit / ignited), 0 otherwise.

Not yet converted: the existing workshop / machine renderers (`src/render/workshop`, `src/render/machines`) - they can move onto this
system family by family.
