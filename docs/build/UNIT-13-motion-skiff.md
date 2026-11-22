# Unit 13 - Workshop motion and skiff riding

Status: build spec, written 2026-11-22 against `docs/build/SYSTEMS.md` (binding). Where this file and SYSTEMS.md disagree,
SYSTEMS.md wins; section 14 lists the three places this spec asks the coordinator to amend it.

**Threads:** T2 (visual only: the contraption tween row, "no stress change"), T9 (`skiff_roll`, `piston_slide`,
`bearing_turn` in a NEW `src/audio/sfxWorkshop.ts`; "tweened motion with ease-in-out ... nothing teleports that could be
seen moving"), T10 (optional `ride?` and `moving?` fields in the workshop snapshot; old saves load), T7 (side goal
`ride_skiff` "Ride the skiff", bronze gate), T8 (crosshair lines and refusals in the game's grammar).

Shared ids this unit DEFINES (SYSTEMS 6.2 row "`MovingView`, skiff seat (`Workshop.seatAt`, vehicle manager riding) | 13"):
`MovingView` (filled; the type is Unit 0's, used verbatim), `WorkshopView.moving`, `Workshop.seatAt`, `Workshop.board`,
`Workshop.leave`, `Workshop.ridden`, `VehicleManager` skiff riding, `motionFraction`, flag `rode_skiff`, side goal `ride_skiff`,
event `skiff:boarded`. Shared ids this unit READS: Unit 0's `MovingView` / `WorkshopView.moving` shapes (SYSTEMS 6.5),
the side-goal mechanism (`SIDE_OBJECTIVES`, `objectivesSide.ts`), `SKIFF_STEP_S` 0.2 and seat offset 0.6 (SYSTEMS 5.2).

---------------------------------------------------------------------------------------------------------------------------

## 1. Summary and player fantasy

Today a Hearthwatt contraption is a slideshow. A piston "pushes" a framed depot by making it vanish from one cell and appear in
the next, with a `pipe_clunk`. A bearing's quarter turn is a cut between two pictures. A skiff jumps a block every 0.2 s, and
the player cannot get in it at all. The workshop docs still say it plainly: "Steps are discrete (no tween yet)."

After this unit:

- **A piston glides, then clunks.** The structure slides one block over 0.6 s with an ease-in-out curve and lands on the
  `piston_slide` thud at the end of the travel. A rain roof driven by a weather-cock signal (journey J5) slides over the drying
  racks like a real shutter instead of popping into place. Items lying on a moving depot or belt slide with it, the player
  standing on a lift platform rises with it, smoothly, and steps off at the top.
- **A bearing swings.** The whole platform turns its quarter turn around the bearing's axis over 1.2 s; an arm standing on it
  sweeps through the air, a belt on it carries its flint round the arc.
- **A skiff is a little ore cart you can ride.** Walk up to an empty skiff with an empty hand and Use it: you climb in (seat
  0.6 above the cart's floor), the camera rides 5 blocks a second along the rails, the cart rattles (`skiff_roll`), slows into
  the end of the track, waits two seconds, turns round and takes you back. Hold Brake to stop on a platform, press Go to set off
  again, press Exit to climb out beside the cart. The first ride ticks the side goal "Ride the skiff".

The fantasy is the one the Bronze workshop has been building towards since the first crank: **a machine you made with your
hands moves the world, and you can stand on it.** Nothing in this unit changes what a contraption DOES (stress, steps, what
moves, what blocks) - it changes how it LOOKS and FEELS, and it adds one verb: ride.

Phone first: boarding is a Use tap, riding uses the three existing touch buttons recaptioned (Brake / Exit / Go) exactly like the
tractor recaptions them (Work / Exit / Swap), and the joystick doubles them (forward = go, back = brake).

---------------------------------------------------------------------------------------------------------------------------

## 2. Threads carried and cross-unit contracts

### 2.1 T2 - rotation and stress (visual row)

SYSTEMS T2 table row: `contraption tween | visual | 13 | - | - | no stress change; moving structures look continuous`.
Rules this unit keeps:
- `BASE_STRESS.piston` / `.bearing` (6 su) unchanged; `PISTON_STEP_S` 0.8, `BEARING_STEP_S` 1.5, `SKIFF_STEP_S` 0.2,
  `SKIFF_DWELL_S` 2, `PISTON_MAX` 4, `STRUCTURE_MAX` 48 unchanged (all exported from `src/workshop/contraption.ts`).
- Logic (what moves where, when, refused or not) is decided exactly as today, at the same tick. The tween is a VIEW of a step
  that has already happened (section 4.1). A save made mid-tween therefore saves the finished step (section 5.4).
- The skiff's speed stays 5 blocks/s; a rider does not slow it.

### 2.2 T9 - sound and feel

- New patches in NEW `src/audio/sfxWorkshop.ts` (`WORKSHOP_SFX`), the file T9 assigns to Units 13/14/16. Whichever of the three
  units lands first creates the file and the `sfx.ts` merge line and the test term; the others append rows (section 14).
- Names (SfxName union, `src/core/gameEvents.ts`): `skiff_roll` (T9 list), `piston_slide`, `bearing_turn` (this unit adds the two;
  section 14 asks the coordinator to add them to the T9 list). The old `pipe_clunk` / `step` requests in `contraption.ts` are
  replaced by these.
- Visual vocabulary rule 4: "tweened motion with ease-in-out over the step time (Unit 13); nothing teleports that could be seen
  moving". This spec uses ease-in-out for pistons and bearings over a MOVE time that is 75% / 80% of the step time, so each step
  ends in a short still beat where the clunk lands (argued in 4.2; section 14 asks for the wording to say "within the step time").

### 2.3 T10 - saving

- New saved data: `WorkshopSnapshot.ride?: [number, number, number]` (the cell of the skiff the player sits in) - optional,
  sanitised, missing = on foot. Nothing about a tween is saved (it is a view). Section 7.
- No `SAVE_VERSION` bump; `src/save/document.ts` untouched (the ride lives with the workshop, whose cells it names).

### 2.4 T7 - side goal

`ride_skiff` "Ride the skiff" (SYSTEMS T7 list, owner 13), exported as `WORKSHOP_MOTION_SIDE_GOALS` from NEW
`src/content/objectivesWorkshopMotion.ts` and concatenated by `src/content/objectivesSide.ts` (Unit 0). Gate: bronze
(`ageIndexOf('bronze')`) per the T7 gating table ("skiff riding | bronze"). Flag `rode_skiff` (past tense, SYSTEMS 4).

### 2.5 Contract with Unit 0 (types used verbatim)

Unit 0 adds, in `src/workshop/workshop.ts` (SYSTEMS 6.5, quoted exactly):

```ts
export interface MovingView { cells: [number, number, number, string][]; from: [number, number, number] | null; rot: -1 | 0 | 1;
  pivot: [number, number, number] | null; t0: number; durS: number }
export interface WorkshopView { spin: SpinView[]; swings: SwingView[]; links: LinkView[]; moving: MovingView[] }
```

Meaning, fixed by this unit (the owner of `MovingView`):

| member | meaning |
|---|---|
| `cells` | every cell of the structure AFTER the step: `[x, y, z, key]` where `x,y,z` is the destination cell and `key` is the block key. One extra NEW optional member (below) carries the voxel value for facing. |
| `from` | for a translation (piston push/pull, skiff roll): the vector from the destination BACK to the origin, `[dx, dy, dz]` in blocks (a push east has `from = [-1, 0, 0]`). `null` for a rotation. |
| `rot` | for a bearing: `1` = the step turned clockwise seen from above (right, rpm > 0), `-1` = anticlockwise (left), `0` for a translation. |
| `pivot` | for a rotation: the vertical axis in world units, `[a.x + 0.5, a.y + 1, a.z + 0.5]` (the bearing's top centre); `null` for a translation. |
| `t0` | workshop clock (seconds, `Workshop.clock`) when the step was committed. |
| `durS` | seconds the glide takes (`PISTON_MOVE_S`, `BEARING_MOVE_S`, `SKIFF_STEP_S`). |

Optional members this unit ADDS (allowed by SYSTEMS 6.5 "adds an OPTIONAL member and says so"):

```ts
export interface MovingView {
  /* Unit 0's members, unchanged */
  /** NEW (13): voxel values parallel to `cells` (id + facing + active), so the renderer draws the right faces. */
  voxels?: number[];
  /** NEW (13): 'ease' (ease-in-out), 'in', 'out' or 'linear'; missing = 'ease'. */
  curve?: MotionCurve;
  /** NEW (13): a stable id for the structure's glide (renderer caches, mesh mask owner). */
  id?: number;
}
export interface WorkshopView { /* Unit 0's members */ /** NEW (13): workshop seconds at draw time (clock + step alpha x DT). */ now?: number }
export type MotionCurve = 'ease' | 'in' | 'out' | 'linear'; // NEW (13), exported from contraption.ts
```

If Unit 0 has not merged when this unit is built, this unit adds the two interfaces itself exactly as quoted (and `moving: []`
in `Workshop.view`), and Unit 0's change becomes a no-op on merge. Either way the shapes are identical.

### 2.6 Contract with Unit 15 (vault growth and border belts)

SYSTEMS 6.2: "15 (belts re-run after moves must not fight the tween: 15 recomputes on the step's END)". This unit provides:
- `Workshop.onMoveEnd(fn: (cells: readonly string[]) => void): () => void` (NEW): called once per glide when its `t0 + durS`
  has passed on the workshop clock (a tick-time callback, never from the renderer), with the destination cell keys. Unit 15
  registers its belt hand-off and vault-group recompute there. Steps that were never tweened (far away, section 8.4) call it in
  the same tick as the commit.
- Ground items riding a structure are moved at commit time in data (as today, `commit(..., item)`), and drawn offset during the
  glide (4.4). Unit 15 must read `GroundItem.x/z` as the logical (end) position; it already does.

### 2.7 Contract with Unit 16 / Unit 2 (journey J5)

No API: a lever / weather-cock signal into a piston is today's `gate()`; the roof simply glides. The e2e of Unit 16 may assert
`workshop.view(...).moving.length > 0` right after a signal flips; this unit guarantees that shape.

### 2.8 Contract with Unit 9 (asphalt, tarred plank)

SYSTEMS 6.2 lists 13 as an optional consumer ("skiff hull - optional"). Decision: **not consumed** in this unit (section 13).
The skiff recipe stays `forge('skiff', '2 bronze_plate, 2 plank, 1 bronze_cog', 600)`.

---------------------------------------------------------------------------------------------------------------------------

## 3. Current state in code (quoted)

- `src/workshop/contraption.ts`:
  - Constants: `PISTON_MAX = 4`, `PISTON_STEP_S = 0.8`, `BEARING_STEP_S = 1.5`, `SKIFF_STEP_S = 0.2`, `SKIFF_DWELL_S = 2`,
    `STRUCTURE_MAX = 48`, `CONTRAPTION_KINDS = ['piston', 'bearing', 'skiff']`.
  - `interface ContraptionHost { world; ground; bus; signedRpm(x,y,z); gate(x,y,z); movable(x,y,z); relocate(map); hold(fn) }`.
  - `class Contraptions`: `acts: Map<string, Act>` with `Act { kind; x; y; z; timer; ext }`; `noteBlock`, `relocate`,
    `structure(start, skip)` (BFS, `null` past 48), private `commit(moves, item)` (checks every destination is air or a
    non-solid non-liquid non-machine block, snapshots voxels and loose items, inside `host.hold` clears all origins then writes
    all destinations with turned facings via `CW` / `CCW`, then moves items), `tick(dt)`, private `piston(a)`,
    `bearing(a)`, `skiff(a)`, `describe` ("Piston - pushing, extended 2 of 4", "Bearing - turning right",
    "Skiff - rolling" / "Skiff - waiting at the end of the rail"), `toJSON()` (only extended pistons), `load(raw)`.
  - Sounds: piston `pipe_clunk` pitch 0.7 (push) / 0.55 (pull); bearing `pipe_clunk` 0.9; skiff `step` volume 0.3 per block.
  - Refusals (`toast`, warn, at most one per 3 s via `warned`): "The contraption is too big to push (48 blocks)",
    "Something blocks the piston", "The contraption is too big to turn (48 blocks)", "Something blocks the bearing".
  - The skiff moves ONLY its own cell (no structure), needs `rail` under the next cell and `air` in it; at the end it sets
    `ext = 1`, dwells `SKIFF_DWELL_S`, flips its facing with `FLIP`. A signal gate (`host.gate`) brakes it.
- `src/workshop/workshop.ts`: `class Workshop` owns `contra: Contraptions`, `private clock` (advanced in `tick(dt)` by `dt`,
  0.05 per tick), `holding`, `relocate(map)` re-keys `parts`, `machines`, `cranks`, `wound`, `lube`, `lubeFactor`, `coast`, then
  `logi`, `signals`, `contra`. `view(px, pz, radius = 40): WorkshopView` returns `{ spin, swings, links }` (no `moving` yet).
  `WorkshopSnapshot` has `pist?: unknown`. Hooks set by Game: `standingOn`, `tractors`, `fluidBlock`, `actHook`, `clockText`,
  `generatorWatts`, `extraRpm`. `isMovable(kind)` = frame, kinetic, logistic or signal kinds, never actuators or generators.
- `src/workshop/logistics.ts`: `skiff` is a logistic cell (`LOGI_KINDS`, `TAKES_GROUND`); `accept` treats it like a depot (one
  kind, one stack); `use()` routes `skiff` to `putOrTake` (held item in, empty hand takes the stack).
- `src/content/itemsWorkshopParts.ts`: `PART_DEFS` rows `rail` ("A track of slats. A skiff above a line of rails rolls along it,
  waits at the end and turns round.", `flat: true` -> slab) and `skiff` ("A little ore cart on rails (rails under it). It holds a
  stack that arms and funnels load and unload. A signal cell it touches brakes it while off."), a full oriented cube; both in
  `NON_KINETIC`. Recipes `forge('8 rail', '1 bronze_ingot, 2 stick', 600)`, `forge('skiff', '2 bronze_plate, 2 plank, 1
  bronze_cog', 600)`.
- `src/render/workshop/workshopRenderer.ts`: `WorkshopRenderer` - two `InstancedMesh` (cogs, bars), `MAX = 768`, unlit
  `MeshBasicMaterial`, `update(dt, view)`, `stats = { cogs, bars }`. Nothing draws whole blocks.
- `src/render/groundItems.ts`: `GroundItemRenderer` draws block items as textured lit cubes with one `InstancedMesh` per kind,
  a custom `ShaderMaterial` (atlas + `LIGHT_GLSL` + fog), `LightProbe` sampling, `cubeGeometry(layers, height)` from
  `src/render/heldItem.ts`. This is the model for drawing moving blocks.
- `src/render/chunkMeshes.ts` / `src/world/streamer.ts`: chunk meshes are rebuilt from `MeshJob { cx, cz, chunks }` (the 3x3
  neighbourhood arrays, `Streamer.neighbourhood(chunk)`); `onEdit(..., source)` re-meshes synchronously only for `'player'`;
  sim edits are `urgent` async jobs; `chunk.epoch` orders results.
- `src/vehicles/manager.ts`: `VehicleManager` wraps the intent (`wrapIntentSource`), `driving: Tractor | null`, `enter(t)` /
  `exit()` / private `carry(t)` (position = `seatOf(t)`, zero velocity, `physics.reset()`), `USE_COOLDOWN_S = 0.6`,
  `LOOK_LIMIT = 2.3`, `exitSpot(world, t)` (right, left, behind, ahead, then on top; `boxFree(world, p, 0.3, 1.8)`).
  `drive(intent, dt)` zeroes `moveX/moveZ/lookYaw/jump/sprint/mine/use/place`. `handle(intent, dt)` per frame.
- `src/ui/vehicleHud.ts`: `VehicleHud` recaptions `.hw-touch-btn--mine/--use/--jump .hw-touch-label` to Work / Exit / Swap while
  `status` is non-null; hint text per device (`this.touch()`).
- `src/app/game.ts`: builds `Workshop`, sets `standingOn` (player within 0.7 of the cell centre, feet `y - 0.2 .. y + 0.4`),
  `tractors`; `frame()`: `controller.update(dt)` (intent -> vehicles -> physics -> camera), then `this.step.advance(dt)` ticks
  (`tickOnce` -> `workshop.tick(DT)`), then draws: `this.workshopRenderer.update(dt, this.workshop.view(pp.x, pp.z))`.
  `this.step.alpha` (`src/app/loop.ts`: `acc / step`) is already used for mobs.
- `src/player/physics.ts` / `collision.ts`: `PlayerPhysics.step(dt, input)`, box sweeps `sweepAxis(world, pos, axis, d)` that
  ignore boxes already overlapped; `unstick()`; `reset()`. No notion of a moving floor.
- `scripts/e2e-workshop.mjs`: last real step 'a piston pushes a framed depot, a bearing turns an arm, a skiff shuttles its load
  along rails' (screenshots `9-contraptions`, `10-contraptions-after`).
- Docs: `docs/api/workshop.md` ends "Steps are discrete (no tween yet)."; `docs/OVERHAUL_PLAN.md` status lists "tween animation
  of moving structures, riding a skiff" as still open.

---------------------------------------------------------------------------------------------------------------------------

## 4. Design in detail

### 4.1 The model: commit first, then glide (a view of a finished step)

A step is committed in the tick exactly as today (`Contraptions.commit`): the voxels, the per-block state (`relocate`) and the
loose items are at the DESTINATION from that tick on. Collision, logistics, goggles, saving all see the finished step. What is
new: the commit records a glide, and for `durS` seconds the destination blocks are drawn by the workshop's motion renderer at an
offset that starts at the origin and eases to zero, while the chunk mesh does not draw them.

Why commit first (and not at the end):
1. No game rule changes: every existing contraption test stays green unchanged, and step timing is identical.
2. Saving mid-glide is trivially correct: the save holds the finished step; on load nothing is moving (5.4).
3. Refusals happen at the moment the player sees the structure NOT start moving, which reads right ("Something blocks the
   piston" while nothing moves).
The cost - for 0.6 s the collision box of a moved block is up to one block ahead of its picture - is handled where a player can
feel it: riders (4.5) and bodies in the path (5.1).

### 4.2 Timing curves (constants, `src/workshop/contraption.ts`)

| constant (NEW) | value | why |
|---|---|---|
| `PISTON_MOVE_S` | 0.6 | glide 0.6 s of the 0.8 s step; the 0.2 s still beat is where `piston_slide` thuds - a ratchet you can read |
| `BEARING_MOVE_S` | 1.2 | swing 1.2 s of 1.5 s; same idea; a quarter turn in 1.2 s is 12.5 deg/s peak-ish, calm enough not to make a rider sick |
| `SKIFF_MOVE_S` | = `SKIFF_STEP_S` 0.2 | the cart must cruise: consecutive glides join end to end |
| `MOTION_RADIUS` | 40 | glides are recorded only for structures within 40 blocks (x/z) of the player (the `view()` radius) |
| `MOTION_MAX` | 6 | at most 6 glides alive at once; further steps commit without a glide (they snap, as today) |
| `MOTION_HOLD_MAX_S` | 0.5 | longest the renderer keeps a finished glide drawn while the chunk mesh catches up (4.3) |

Curves (pure, NEW `motionFraction(m: MovingView, now: number): number` in `contraption.ts`, returns 0..1, clamped):
- `u = clamp((now - t0) / durS, 0, 1)`.
- `'ease'` (pistons, bearings): smoothstep `u*u*(3 - 2*u)`.
- `'linear'` (skiff cruising): `u`.
- `'in'` (skiff's first step after standing: start, after the dwell, after a brake release): `u*u`.
- `'out'` (skiff's step INTO the last rail cell, where the next cell has no rail - look-ahead at commit time): `1 - (1-u)*(1-u)`.
- The drawn offset for a translation is `from * (1 - f)` where `f = motionFraction(...)`: at `f = 0` the block is drawn at the
  origin, at `f = 1` at its destination.
- A rotation draws every cell at its destination rotated about `pivot` by `-rot * (1 - f) * 90 deg` (around +Y, clockwise seen
  from above for `rot = 1`), i.e. it starts drawn at its old place and swings into the new one; the block's own faces turn by
  the same angle (the facing was already turned in data).

Why ease-in-out for pistons/bearings and linear for the skiff: a piston and a bearing step and stop; easing makes the stop read as
weight. A skiff's steps are a continuous run at 5 b/s; easing each 0.2 s step would make it lurch five times a second. It eases
only where it really starts and stops (the 'in' / 'out' steps), so a full start-to-stop on a 5-rail track reads: gentle start,
steady roll, gentle arrival, 2 s wait, turn, gentle start back.

### 4.3 Hiding the real voxels while they glide (the mesh mask)

The destination voxels are real and the chunk mesh would draw them at the end position from the first frame. Two parts:

**(a) Pistons and bearings: a mesh mask.** NEW in `src/world/world.ts`:

```ts
/** Cells the chunk mesher draws as air until cleared (moving structures, drawn by the workshop's motion renderer instead). */
setMeshMask(owner: number, cells: readonly [number, number, number][] | null): void;
/** True once every chunk touched by the last setMeshMask(owner, null) has published a mesh built after it. */
maskSettled(owner: number): boolean;
```

- `World` keeps `masks: Map<owner, Set<"x,y,z">>` and per chunk key the masked local indices. `setMeshMask` marks every chunk
  that holds a masked cell (and, as `onEdit` already does, the neighbour across a border cell) dirty `urgent` (never sync).
- `Streamer.neighbourhood(chunk)` (private, `src/world/streamer.ts`): when one of the 9 chunks has masked cells, it passes a COPY
  of that chunk's `Uint16Array` with those cells set to 0 (air). Unmasked chunks pass the live array as today. The copy is made
  only for chunks that have a mask (a 16 x 16 x 256 Uint16Array copy is 128 KB, a few per step at most).
- `setMeshMask(owner, null)` clears and records, per touched chunk, `chunk.epoch` at that moment; `maskSettled` is true when each
  such chunk has `epoch > recorded && !meshing && !dirty` (or is not loaded / not meshed).
- Lighting: a masked cell meshes as air, so light passes through it for those 0.6-1.2 s. Accepted (a soft brightening at most).
- Where the mask is set: by the motion renderer (render layer) through a Game-wired callback, because only the renderer knows a
  glide is being DRAWN. The workshop never touches the world's mesh state. Flow per glide id:
  1. the renderer sees a new `MovingView` id in `view.moving` -> `mask(id, cells)`;
  2. it draws proxies until `motionFraction = 1`;
  3. it calls `mask(id, null)` and keeps drawing the proxies at their destination until `maskSettled(id)` or
     `MOTION_HOLD_MAX_S` 0.5 s has passed, then drops them. No frame shows the structure missing or doubled-and-offset.
- Frame 0 overlap: between step 1 and the masked mesh arriving (one async mesh, typically 1-3 frames) the chunk still shows the
  OLD picture (the structure at the origin) and the proxy is drawn at the origin too (f is near 0): they coincide. Proxies are
  scaled 1.002 to avoid z-fighting.

**(b) The skiff: never in the chunk mesh.** A skiff moves five times a second; masking would re-mesh its chunk 10 times a second.
Instead the `skiff` block is drawn ONLY by the motion renderer, always (still or rolling):
- NEW optional `BlockSpec.meshless?: boolean` (`src/core/types.ts`): the mesher emits no faces for it and treats it as
  transparent for neighbour face culling (like air for culling, solid for everything else). Read in `src/world/blockTables.ts`
  into a NEW table `MESHLESS[id]` (Uint8Array) the mesher checks where it reads `opaque` / emits a cube. The skiff row in
  `PART_BLOCKS` gets `meshless: true` (a one-key special case in the `PART_DEFS.map`: `...(d.key === 'skiff' ? { meshless:
  true } : {})`).
- Collision, raycast (`src/player/raycast.ts` reads solidity, not meshes) and the target outline are unaffected: the skiff is
  still a solid full cube for physics and aim.
- The motion renderer draws every skiff within `MOTION_RADIUS` from a NEW `WorkshopView.skiffs?: SkiffView[]` list
  (`{ x, y, z, voxel, from: [dx,dy,dz] | null, t0, durS, curve }` - the same timing as a MovingView, one cell) so a still skiff
  is a still instance. Skiffs further than 40 blocks are not drawn (a cart is small; fog hides most of that range on phones).
  Section 14 notes this as a visible change for distant skiffs.

### 4.4 Drawing moving blocks (NEW `src/render/workshop/motionRenderer.ts`)

`class MotionRenderer` - the same family as `GroundItemRenderer`:
- One `THREE.InstancedMesh` per distinct voxel value (id + facing + active) seen in a glide or as a skiff, geometry
  `cubeGeometry(layers, height)` from `src/render/heldItem.ts` where `layers[face] = faceLayer(def, face, facing, active)`
  (`src/core/registry.ts`) and `height = def.shape === 'slab' ? 0.5 : 1` (belts, rails, signal wire, plates are slabs).
  Non-cube shapes (pipes, cross plants, stations) are drawn as their cube/slab box - acceptable: only workshop parts and frames
  move, and they are cubes or slabs today.
- The shared `ShaderMaterial` copies `GroundItemRenderer`'s (atlas, `LIGHT_GLSL` lighting from a per-instance `aLight`
  attribute, fog). Light per glide: one `LightProbe` sample at the structure's centre at glide start, eased toward a second
  sample at the destination centre (`k` 0.25 per frame) - a moving roof darkens smoothly as it slides under another roof.
- Geometry cache keyed by voxel value, never disposed during play (bounded by the number of workshop block kinds x 4 facings x
  2 active, in practice < 60); instances grow by doubling like `GroundItemRenderer.grow`.
- Per frame: for each glide in `view.moving` (and each skiff) compute `f = motionFraction(m, view.now)`, the matrix of each cell
  (translate by `from * (1 - f)`; or rotate about `pivot` by `-rot * (1 - f) * PI/2`), write into its kind's instance buffer.
  Zero allocation per frame (reused `Matrix4`, `Quaternion`, `Vector3`).
- Loose items on a moved cell: `GroundItems` gets a NEW optional per-item `slide?: { dx: number; dy: number; dz: number;
  t0: number; durS: number; curve: MotionCurve; rot?: number; px?: number; pz?: number }` set by `commit` (via the item callback)
  and cleared when the glide ends; `GroundItemRenderer.place` adds the same offset/rotation so a flint on a depot slides with
  the depot. Data position is already the destination. The field is not saved (`GroundItems` snapshot ignores it).
- `stats = { glides, blocks, skiffs, held }` (NEW) for tests and the e2e.
- Owned by `Game` like `WorkshopRenderer`: `this.motionRenderer = new MotionRenderer(this.renderer, world, (id, cells) =>
  world.setMeshMask(id, cells), (id) => world.maskSettled(id))`, updated right after `workshopRenderer.update` with the same view.

### 4.5 Riders on pistons and bearings (the player on a lift)

The player standing on a moving structure is carried smoothly. NEW in `src/player/physics.ts`:

```ts
/** A moving floor under the player this frame (a contraption glide), set by Game before the controller runs; null = none. */
export interface PlatformCarry { dx: number; dy: number; dz: number; yawDelta: number; ignore: ReadonlySet<string> }
platform: PlatformCarry | null = null; // on PlayerPhysics
```

- Game computes it each frame from `Workshop.riderCarry(px, py, pz, now, prevNow): PlatformCarry | null` (NEW): the player is a
  rider of a glide when, at glide start, their feet were within 0.05 of the top of an ORIGIN cell of that structure (box
  overlapping it horizontally by more than 0.1). `dx/dy/dz` = drawn offset change of that glide between `prevNow` and `now`;
  for a rotation, the player's feet point is rotated about `pivot` by the angle change and `yawDelta` is that angle (the view
  turns with the platform, like standing on a turntable). `ignore` = the glide's destination cell keys.
- `PlayerPhysics.step`: when `platform` is set, first `pos += (dx, dy, dz)`, `yaw += yawDelta`, then the normal step, but the
  sweeps (`sweepAxis`) and `unstick()` treat cells in `ignore` as passable for the vertical axis, and the player counts as
  `onGround` with `vy = max(vy, 0)` when `dy >= 0` (rising lift) and falls freely otherwise; `fallTop` is reset to the current y
  so a descending lift never deals fall damage. When the glide ends (`platform` becomes null) the destination cells are under
  the feet exactly (the carried total equals the step), so the next normal step stands on them.
- Walking while carried is allowed (the carry adds to it). Jumping off a rising lift works.
- One rider rule: only the player is carried. Mobs and tractors on a moved structure stay where they are logically (mobs are
  re-snapped by their own physics; tractors settle via `settleTractor`). Out of scope to carry them (section 13).

### 4.6 Skiff riding

**Board.** Use with an EMPTY hand on a skiff that holds nothing (`logi.peek(x,y,z)` empty): the player climbs in. Implemented in
`Logistics.use` case `'skiff'`: when `held === null` and the cell's `items` is empty, return the NEW result of
`host.board?.(x, y, z)` (a new optional `LogiHost.board` hook that `Workshop` fills with `this.board`). A skiff that holds a stack
gives it on the first empty-hand Use as today, with the toast `"Took 3 Flint - Use again to climb in"`; the next Use boards.
Held items still go in (`putOrTake`) as today - a full hand never boards. Refusals when boarding:
- no room for a body over the cart (cells `y+1` and `y+2` above the skiff solid): `"No room to sit - clear the two blocks above
  the skiff"`;
- the player is already riding: Use means Exit (4.6 controls), never reaches here;
- Dev Mode flight on: boarding switches flight off (`player.flying = false`) silently.

`Workshop.board(x, y, z): 'worked' | 'refused'` (NEW) sets `ridden = "x,y,z"`, emits `flag` `rode_skiff` (once per world via the
flag set; the tracker dedupes), event `skiff:boarded` `{ x, y, z }` (NEW `GameEvents` entry, `<system>:<verb>`), sfx `place`
pitch 0.8 at the cart, and the toast (desktop / touch wording chosen by the HUD, section 6). `ridden` is re-keyed by
`Contraptions.relocate` (`Workshop.relocate` updates it when the map contains it).

**Ride.** Every frame `VehicleManager.handle` asks the NEW hook `skiffs: SkiffSeatHost | null`:

```ts
export interface SkiffSeat { x: number; y: number; z: number; heading: number; moving: boolean; braked: boolean; waiting: boolean }
export interface SkiffSeatHost {
  /** The seat of the skiff the player sits in at workshop time `now`, or null when not riding. */
  seat(now: number): SkiffSeat | null;
  /** Rider controls this frame: hold brake; go = start now (cuts a dwell short and turns round). */
  control(go: boolean, brake: boolean): void;
  /** Climb out (Workshop.leave). */
  leave(): void;
  /** Workshop seconds the next draw will show (Game: clock + step accumulator + dt, see below). */
  now(): number;
}
```

Game wires `this.vehicles.skiffs = { seat: (n) => this.workshop.seatAt(n), control: (g, b) => this.workshop.rideControl(g, b),
leave: () => this.workshop.leave(), now: () => this.workshop.time + this.step.alpha * DT + this.frameDt }`.

`Workshop.seatAt(now: number): SkiffSeat | null` (NEW; SYSTEMS calls it `seatAt`): for the ridden skiff at cell `(x,y,z)`, the
seat is `(x + 0.5, y + SKIFF_SEAT_Y, z + 0.5)` plus the skiff's current drawn offset (same `motionFraction` as the renderer) -
`SKIFF_SEAT_Y` NEW = 0.6 (SYSTEMS 5.2 "rider seat offset 0.6": the rider's feet are 0.6 above the cart's base, sitting IN it,
so the eye is at `y + 0.6 + PLAYER_EYE 1.62 = y + 2.22`). `heading` = the skiff's facing as a yaw.

Why `now()` = `clock + alpha*DT + dt`: the controller runs BEFORE this frame's ticks; after `step.advance(dt)` the accumulator is
`acc + dt - n*DT` and the clock `clock + n*DT`, so `clock + acc + dt` before the ticks is exactly the `clock' + acc'` the renderer
uses after them (`view.now = workshop.time + this.step.alpha * DT`). Camera and cart are computed for the same instant: no
jitter between the rider and the cart at 5 b/s. (`Workshop.time` is a NEW public getter for the private `clock`; `frameDt` is
the clamped dt Game already has in `frame()`.)

`VehicleManager` riding (NEW private `ride(intent, dt, seat)`, mirrors `drive`):
- Carry: `player.position = seat`, velocity 0, `physics.reset()` (no fall damage on the dip into a lower track), sprint off.
- Look is FREE (no `LOOK_LIMIT`): the rider's yaw is their own; the cart does not steer. When the cart turns round at the end,
  the rider's yaw turns 180 deg with it over the 2 s dwell (eased), so they keep facing the travel direction unless they look away.
- Controls read then zeroed (the controller neither walks, mines, places nor jumps): `go = intent.moveZ > 0.5 || jumpPressed`,
  `brake = intent.moveZ < -0.5 || intent.mine`, `exit = intent.use && cooldown <= 0`.
- Exit: `skiffs.leave()`, then the player is set at `skiffExitSpot` (NEW, the same order as `exitSpot`: right of travel, left,
  behind, ahead at 1.0 block, each at dy 0/+1/-1, `boxFree(world, p, 0.3, 1.8)`; last resort on top of the cart at `y + 1`),
  velocity 0, `physics.reset()`, cooldown `USE_COOLDOWN_S`.
- `VehicleManager.status()` stays tractor-only; a NEW `rideStatus(): { braked: boolean; waiting: boolean; load: string | null }
  | null` feeds the HUD (section 6).

**Skiff behaviour while ridden** (in `Contraptions.skiff(a)`; unchanged when nobody rides):
- `brake` held: the skiff does not start a new step (a step in progress finishes its 0.2 s). Same effect as a signal gate off.
- `go` pressed: while dwelling, skip the rest of `SKIFF_DWELL_S` (turn round now); while braked, nothing extra (releasing brake
  is enough); while rolling, nothing.
- Head room: a step into a cell whose `y+1` or `y+2` is solid is refused like a rail end (dwell, turn round) with the toast once
  per run: `"Too low to ride under - the skiff turns back"`. Without a rider head room is not checked (cargo carts fit under
  anything, as today).
- Speed: 5 blocks/s (`SKIFF_STEP_S` 0.2) with or without rider.

**Camera.** First person only (the game has no third person). Bob: none while riding (the controller's bob reads `walked`,
which is 0 when carried). A small rail rattle: the seat's y gets `SKIFF_RATTLE` NEW 0.015 x sin(distance x 2 PI) while rolling
(one tiny bump per rail cell), 0 when still. FOV unchanged. Set `PlayerController`'s step-up smoothing to 0 on board/exit (the
existing `physics.reset()` path does).

**Multiple skiffs.** Any number can roll; only one is ridden. Two skiffs meeting on one track: the next cell is not `air` (the
other skiff), so each sees a rail end, dwells and turns round (today's rule). A ridden skiff meeting another does the same.

---------------------------------------------------------------------------------------------------------------------------
