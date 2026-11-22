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
- Not in the tree yet (verified 2026-11-22 by grep): `MovingView`, `WorkshopView.moving` and `src/content/objectivesSide.ts`
  (all Unit 0), `src/audio/sfxWorkshop.ts` (first of Units 13/14/16). Everything else quoted in this section exists as named.
- Marking convention below: every function, field, constant, file or string not listed in this section is NEW in this unit
  (or, for the two Unit 0 shapes, Unit 0's).

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
- `PlayerPhysics.step`: when `platform` is set, first `pos += (dx, dy, dz)`, `yaw += yawDelta`; then the horizontal part of
  the normal step runs (walking on the platform works; horizontal sweeps already ignore boxes the body overlaps), but the
  VERTICAL part is skipped: `vy = 0`, `onGround = true`, no gravity, no vertical sweep, no `unstick()` against cells in
  `ignore`, and `fallTop` is set to the current y (a descending lift never deals fall damage). A jump cancels the carry for the
  rest of that glide (the player leaves the platform and normal physics resumes at once). When the glide ends (`platform` becomes null) the destination cells are under
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
- Dev Mode flight on: boarding switches flight off silently (the controller's Dev Mode flight flag).

`Workshop.board(x, y, z): 'worked' | 'refused'` (NEW) sets `ridden = "x,y,z"`, emits event `skiff:boarded` `{ x, y, z }` (NEW `GameEvents` entry, `<system>:<verb>`), sfx `place`
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

## 5. Behaviour and rules, edge cases

### 5.1 Blocked steps and bodies in the path

- **Blocked by blocks** (terrain, crate, another actuator, a solid non-movable): refused exactly as today, nothing glides, the
  same toasts ("Something blocks the piston", "Something blocks the bearing"). The piston/bearing tries again next step.
- **The player in the path.** NEW host hook `ContraptionHost.bodyIn?(x, y, z): boolean` (Workshop forwards its NEW public hook
  `bodyIn: ((x, y, z) => boolean) | null`, Game: `boxIntersectsCell(player.position, x, y, z)` from `src/player/collision.ts`,
  false while the player rides a skiff). `commit` refuses when any destination cell that is not also an origin cell overlaps the
  player's body, EXCEPT when the player is a rider of this very structure (4.5: their feet stand on an origin cell; a lift
  rising under them is not "in the path"). Toasts (same `warned` throttle):
  - piston: `"You are in the way of the piston"`;
  - bearing: `"You are in the way of the bearing"`;
  - skiff (rider-less cart meets the player standing on the track): the cart treats it as a rail end and turns back, no toast.
- **Mid-glide obstruction cannot happen**: the step was committed with its destination free; a block placed into a destination
  cell during the glide is impossible (it is occupied in data). A player walking INTO a gliding block collides with its
  destination box (up to one block ahead of the picture for <= 0.6 s). Accepted; the glide is short and the destination is where
  it is going.
- **Pulling back** (piston unpowered): the frame rod cell is cleared first (as today) and the rest glides back; if refused, the
  rod is restored (as today) and nothing glides.

### 5.2 Rail end, broken rail, broken skiff

- **Rail end** (next cell has no `rail` under it, or is not `air`): the last step uses curve `'out'`; the cart dwells 2 s, flips
  (`FLIP`) and starts back with curve `'in'`. A rider's view turns with it (4.6). The first time a RIDDEN cart reaches a rail end
  and starts its dwell, the workshop emits `flag` `rode_skiff` (the side goal "Ride the skiff": board AND ride to the end).
- **Rail mined under a rolling cart**: next step sees no rail -> rail end, as above. The cart never leaves the track.
- **Rail mined under the cart's own cell**: the cart stays (blocks do not fall in Hearthwatt); it simply cannot step until a
  rail is under the next cell. Goggles: `"Skiff - no rail ahead, waiting"` (NEW wording, replaces "waiting at the end of the
  rail" only in this case).
- **Skiff broken while ridden** (the rider cannot mine it - Mine is Brake while riding - but a `mech_drill` or `deployer`
  facing the track can break it as it passes): `Workshop.noteBlock` sees the `ridden` cell no longer a skiff -> `leave()`
  without moving the player; normal physics resumes from the seat (a 0.6 block drop onto the rail, no damage), toast
  `"The skiff broke - you climbed out"`.
  Its stack drops (existing logistics break rule) and the skiff item drops (normal block drops).
- **Player dies while riding**: `VehicleManager.handle` already exits a tractor when `player.dead`; it does the same for the
  skiff (`skiffs.leave()`).
- **Ridden skiff unloaded** (chunk streams out - only possible by teleport): `seatAt` returns null when `!world.isLoaded`; the
  manager leaves the ride, player placed at the last seat.

### 5.3 Chunk boundaries

- Structures may straddle chunks; the mesh mask touches every chunk that holds a masked cell plus border neighbours (4.3). The
  proxies are in world space, unaffected by chunk borders.
- A glide into a chunk that is not loaded cannot happen: `world.getBlock` of an unloaded cell is not air (the world returns
  solid/unknown there - `commit` refuses, as today).
- A skiff rolling across a chunk border costs nothing extra (meshless, no remesh).

### 5.4 Save and load mid-move

- Saved: the finished step (the voxels are already at the destination), the extended piston count (`pist`, as today), the
  ridden cell `ride?: [x, y, z]` (NEW). NOT saved: glides, rider carry, ground-item `slide`, the skiff's dwell timer and
  `ext` (as today).
- Load: no glides exist; everything is drawn at rest (no animation of history). If `ride` names a cell that is a skiff after
  `verify()`, the player is re-seated: `Workshop.load` sets `ridden`, and on the first frame `VehicleManager` sees a seat and
  carries the player to it (the saved player position is the seat already, within 0.1). If the cell is not a skiff, `ride` is
  dropped and the player stands where they were saved.
- Masks are not saved; `World.setMeshMask` state is cleared on `World` load (a new streamer).

### 5.5 Performance limits and far structures

- Glides are recorded only within `MOTION_RADIUS` 40 of the player and at most `MOTION_MAX` 6 at once (oldest-first slots; a 7th
  concurrent step snaps). A structure that snaps still calls `onMoveEnd` in the same tick.
- At most `STRUCTURE_MAX` 48 cells per glide -> at most 288 proxy cubes drawn; plus skiffs (cap 32 drawn, nearest first).
- Each piston/bearing glide costs two async chunk meshes per touched chunk (mask on, mask off). Worst case a piston on a
  0.8 s cycle touching 2 chunks: 5 meshes/s. Unit test asserts `setMeshMask` is called exactly twice per glide.

### 5.6 Messages (complete list, T8)

| when | text | kind |
|---|---|---|
| player in a piston's path | `You are in the way of the piston` | warn |
| player in a bearing's path | `You are in the way of the bearing` | warn |
| empty-hand Use on a loaded skiff | `Took 3 Flint - Use again to climb in` (count + item name) | info |
| board, desktop | `W or Space go, S or hold Mine brake, Use to get off` | info |
| board, touch | `Go sets off, hold Brake to stop, Exit gets off` | info |
| no head room to board | `No room to sit - clear the two blocks above the skiff` | info |
| low ceiling while riding | `Too low to ride under - the skiff turns back` | info (once per ride) |
| skiff broken under the rider | `The skiff broke - you climbed out` | warn |
| side goal (Unit 0 mechanism) | `Side goal: Ride the skiff` | (tracker) |

Crosshair / goggles lines (`Contraptions.describe`, <= 60 chars):

| state | line |
|---|---|
| piston pushing, mid-glide | `Piston - pushing, extended 2 of 4` (unchanged) |
| bearing | `Bearing - turning right` (unchanged) |
| skiff rolling, empty | `Skiff - rolling east, empty` |
| skiff rolling with load | `Skiff - rolling east, 3 Flint` |
| skiff at the end | `Skiff - waiting at the end of the rail, 3 Flint` |
| skiff braked by a signal | `Skiff - braked by the signal` |
| skiff ridden, braked | `Skiff - you hold the brake` |
| skiff no rail ahead | `Skiff - no rail ahead, waiting` |
| empty skiff, idle hint suffix (only when not ridden and empty) | `Skiff - waiting at the end of the rail, empty - Use to ride` |

Compass words: `north` / `east` / `south` / `west` from the facing (`Facing`).

---------------------------------------------------------------------------------------------------------------------------

## 6. UI and feedback

### 6.1 HUD while riding (`src/ui/vehicleHud.ts`)

`VehicleHud.update(status)` gains a second input: `updateRide(ride: { braked: boolean; waiting: boolean; load: string | null } |
null)` (NEW), called by Game every frame with `this.vehicles.rideStatus()`. While riding:
- The same panel `.hw-vehicle` shows one row: `Skiff` + state chip (`rolling` / `braked` / `turning round`) + load (`3 Flint` or
  nothing), and the hint line:
  - touch: `Go: set off. Hold Brake: stop. Exit: get off.`
  - desktop: `W or Space go, S or hold Mine brake, Use get off`
- Touch captions (NEW `RIDE_CAPTIONS`, same mechanism as `CAPTIONS`): `.hw-touch-btn--mine` -> `Brake`, `.hw-touch-btn--use` ->
  `Exit`, `.hw-touch-btn--jump` -> `Go`. Restored on exit. The buttons are the existing 44 px+ touch buttons; nothing new is
  added to the layout (works at 390 px portrait and 844 x 390 landscape by construction).
- No fuel gauge for the skiff (`.hw-vehicle-gauge` hidden while riding).

### 6.2 Sounds (T9; NEW `src/audio/sfxWorkshop.ts`)

| name | when | volume tier | patch sketch |
|---|---|---|---|
| `skiff_roll` | each skiff step while rolling, at the cart (replaces `step` 0.3) | whisper 0.3 (0.45 while ridden, it is under you) | short wood-on-iron knock: `noise('brown', lp(600), 0.06, 0.08)` + `tone('triangle', 140, 0.05, 0.05, { freqEnd: 110 })`, `jitter: 2`; pitch 0.9-1.1 alternating per cell so the rhythm reads as wheels over rail joints |
| `piston_slide` | at the END of a piston glide (t0 + `PISTON_MOVE_S`), pitch 0.7 push / 0.55 pull | normal 1 | a soft wooden scrape during (low noise 0.5 s, `a: 0.2`) ending in a thud `tone('sine', 70, 0.15, 0.4, { freqEnd: 45 })`; it is ONE request at glide start with the thud at `at: 0.55` so the thud lands on the stop |
| `bearing_turn` | at glide start of a bearing step, pitch 0.9 | normal 1 | geared ratchet: 6 short clicks over 1.1 s `tone('square', 900, 0.01, 0.02, { at: i * 0.18, filter: lp(2000) })` + a low groan `tone('sawtooth', 55, 1.1, 0.15, { filter: lp(300) })` |

`place` (existing) at pitch 0.8 for boarding and 0.7 for climbing out. No loop: the roll is per step, so a still cart is silent
(T9 rule 3). The skiff's dwell is silent; the turn round plays `bearing_turn` at pitch 1.4, volume 0.3 (a small swivel).

`src/audio/sfx.test.ts` expression becomes `72 + Object.keys(MAGIC_SFX).length + Object.keys(WORKSHOP_SFX).length` (plus DISTILL
when Unit 12 lands; whichever lands second edits the sum, section 14).

### 6.3 Particles

- Piston glide end: 4 dust puffs (existing `src/render/puffs.ts` style, wood-brown) at the leading face of the structure's
  front cells, at most 8 per step. Bearing: none (the swing is the show).
- Skiff: 1 tiny spark (`0xffc070`, 0.15 s) from under the cart at each rail joint while ridden only, at most 2 alive (keeps phone
  cost near zero). Both through the renderer's existing particle helper; caps per T9 "particles at most 24 per emitter".

### 6.4 Docs/Guide text

- `PART_DEFS` desc updates (exact):
  - `skiff`: `'A little ore cart on rails (rails under it). It rolls 5 blocks a second, holds a stack that arms and funnels load and unload, and an empty one carries you: Use it with an empty hand to climb in. A signal cell it touches brakes it while off.'`
  - `piston`: unchanged text.
  - `rail`: `'A track of slats. A skiff above a line of rails rolls along it, slows into the end, waits and turns round.'`
- Workshop Guide (Rules tab, `src/ui/screens/workshop/workshopScreen.ts`): add one rule line: `Ride a skiff: Use an empty skiff
  with an empty hand. Go sets off, Brake stops, Exit (Use) gets off.`

---------------------------------------------------------------------------------------------------------------------------

## 7. Data and save

```ts
// src/workshop/contraption.ts (NEW exports)
export const PISTON_MOVE_S = 0.6;
export const BEARING_MOVE_S = 1.2;
export const SKIFF_SEAT_Y = 0.6;
export const SKIFF_RATTLE = 0.015;
export const MOTION_RADIUS = 40;
export const MOTION_MAX = 6;
export const MOTION_HOLD_MAX_S = 0.5;
export type MotionCurve = 'ease' | 'in' | 'out' | 'linear';
export function motionFraction(m: { t0: number; durS: number; curve?: MotionCurve }, now: number): number;
/** Drawn offset of a point that ended at (x, y, z) in glide m at time now (translation or rotation about pivot). */
export function motionPoint(m: MovingView, x: number, y: number, z: number, now: number, out: { x: number; y: number; z: number }): void;

// ContraptionHost additions (all optional so existing test fixtures compile)
interface ContraptionHost {
  /* existing */
  now?(): number;                                  // workshop clock (Workshop passes () => this.clock)
  near?(x: number, z: number): boolean;            // within MOTION_RADIUS of the player (Workshop: playerXZ hook)
  bodyIn?(x: number, y: number, z: number): boolean;
  bodyOn?(x: number, y: number, z: number): boolean; // the player's feet stand on the top of this cell (rider rule, 4.5)
  rider?(): { ridden: string | null; brake: boolean; go: boolean; headroom: boolean };
}

// Contraptions additions
class Contraptions {
  readonly glides: MovingView[];                   // alive glides (with voxels, curve, id), pruned in tick when t0 + durS < now
  skiffViews(px: number, pz: number, radius: number): SkiffView[];
  /** Glide ends due this tick -> callbacks (Unit 15). */
  onEnd: ((cells: readonly string[]) => void)[];
}

// src/workshop/workshop.ts
export interface SkiffView { x: number; y: number; z: number; voxel: number; from: [number, number, number] | null; t0: number; durS: number; curve: MotionCurve }
export interface WorkshopSnapshot { /* existing */ ride?: [number, number, number] }
class Workshop {
  get time(): number;                              // NEW: the private clock
  ridden: string | null;                           // NEW: "x,y,z" of the skiff the player sits in
  bodyIn: ((x: number, y: number, z: number) => boolean) | null; // NEW, Game
  playerXZ: (() => [number, number]) | null;       // NEW, Game (MOTION_RADIUS test)
  board(x: number, y: number, z: number): 'worked' | 'refused';
  leave(): void;
  rideControl(go: boolean, brake: boolean): void;
  seatAt(now: number): SkiffSeat | null;
  riderCarry(px: number, py: number, pz: number, now: number, prevNow: number): PlatformCarry | null;
  onMoveEnd(fn: (cells: readonly string[]) => void): () => void;
  view(px: number, pz: number, radius?: number, now?: number): WorkshopView; // fills moving, skiffs, now
}
```

Sanitising `ride` in `Workshop.load`: accept only an array of 3 integers; keep it pending until `verify()` (chunks in) confirms
the block is `skiff`, else drop it. `toJSON` writes `ride` only while `ridden !== null`.

Old saves: no `ride` -> on foot. No `moving` is ever saved. `pist` unchanged. Test: load a snapshot without `ride`.

No item, recipe, fluid or block id is added. `skiff` gains `meshless: true` (a spec field, not an id). No T4 row is needed (no
new material).

---------------------------------------------------------------------------------------------------------------------------

## 8. Implementation plan (ordered)

1. **Types** (skip if Unit 0 merged): `MovingView`, `WorkshopView.moving` in `src/workshop/workshop.ts` exactly as SYSTEMS 6.5;
   `view()` returns `moving: []`. Add the optional members of 2.5 and `SkiffView`, `WorkshopSnapshot.ride?`.
2. **Pure motion helpers** in `src/workshop/contraption.ts`: constants (section 7), `motionFraction`, `motionPoint`. Unit tests
   first (section 9 a).
3. **Record glides in `Contraptions.commit`**: add a parameter `glide: { from: [n,n,n] | null; rot: -1|0|1; pivot: [n,n,n] | null;
   durS: number; curve: MotionCurve } | null`. After a successful commit, when `host.near?.(ax, az) !== false` and fewer than
   `MOTION_MAX` glides live, push `{ cells, voxels, from, rot, pivot, t0: host.now?.() ?? 0, durS, curve, id: ++this.glideSeq }`.
   Set each moved ground item's `slide` (4.4). `piston()` passes `from = [-dx, 0, -dz]` (push) / `[dx, 0, dz]` (pull), `durS =
   PISTON_MOVE_S`, `'ease'`; `bearing()` passes `rot = cw ? 1 : -1`, `pivot = [a.x + 0.5, a.y + 1, a.z + 0.5]`, `BEARING_MOVE_S`;
   `skiff()` passes its translation and curve: `'in'` when the previous call did not step (`a.ext` just reset or a brake/gate
   just released: keep a NEW `Act.rolled` boolean), `'out'` when the cell after `next` has no rail, else `'linear'`.
   `tick()` prunes glides whose `t0 + durS <= now` and calls `onEnd` callbacks with their cell keys.
4. **Sounds**: replace `pipe_clunk`/`step` requests with `piston_slide` / `bearing_turn` / `skiff_roll` (section 6.2); add
   `src/audio/sfxWorkshop.ts`, the `SfxName` entries in `src/core/gameEvents.ts`, the merge in `src/audio/sfx.ts`, the test sum.
5. **Bodies in the path**: `bodyIn` check in `commit` (5.1), rider exemption via `riderCarry`'s start rule (store, per glide, the
   `riderAtStart` boolean computed in commit from `host.bodyOn?` = feet on an origin top; Workshop gives it from Game's player).
6. **Skiff riding in the workshop**: `Workshop.board/leave/rideControl/seatAt/ridden`, `relocate` re-keys `ridden`,
   `noteBlock` drops it when the block is gone (5.2), `Logistics.use` skiff empty-hand board via NEW `LogiHost.board?`, head
   room check, describe lines (5.6), save `ride`.
7. **VehicleManager**: `skiffs: SkiffSeatHost | null` field; in `handle`, after the tractor branch: `const seat =
   this.skiffs?.seat(this.skiffs.now())`; if seat -> `ride(intent, dt, seat)` (4.6); `rideStatus()`; `skiffExitSpot`. Dead player
   -> leave.
8. **Physics carry**: `PlayerPhysics.platform` (4.5); Game sets it each frame before `controller.update(dt)` from
   `workshop.riderCarry(...)` using `now = workshop.time + step.alpha*DT + dt` and the previous frame's `now`.
9. **World mesh mask**: `World.setMeshMask`, `World.maskSettled`, `Streamer.neighbourhood` copy-with-zeros (4.3 a). Unit
   tests in `src/world/world.test.ts` / streamer.
10. **Meshless skiff**: `BlockSpec.meshless?` (`src/core/types.ts`), `MESHLESS` table in `src/world/blockTables.ts`, mesher skip
    + culling, `skiff` row. Mesher test.
11. **MotionRenderer** (`src/render/workshop/motionRenderer.ts`, 4.4) + `GroundItemRenderer.place` slide offset; Game creates,
    updates (`this.motionRenderer.update(dt, view)` with `view = this.workshop.view(pp.x, pp.z, 40, this.workshop.time +
    this.step.alpha * DT)` - one view object shared with `workshopRenderer`), disposes.
12. **HUD**: `VehicleHud.updateRide`, `RIDE_CAPTIONS`; Game calls it.
13. **Side goal**: `src/content/objectivesWorkshopMotion.ts` with `WORKSHOP_MOTION_SIDE_GOALS = [{ id: 'ride_skiff', title: 'Ride
    the skiff', text: 'Use an empty skiff with an empty hand to climb in, and ride it to the end of the rails.', flag:
    'rode_skiff', age: ageIndexOf('bronze') }]` (shape per Unit 0's `ObjectiveSpec`; reward: none, or what Unit 0's side goals
    use by default), concatenated in `objectivesSide.ts`; `FLAG_RODE_SKIFF = 'rode_skiff'` in `src/core/constants.ts` beside
    `FLAG_DROVE_TRACTOR`.
14. **Text**: `PART_DEFS` desc, Guide rule line, docs (section 11).
15. **E2E** (section 10).

Helpers to reuse (do not re-implement): `cubeGeometry` (`src/render/heldItem.ts`), `faceLayer` (`src/core/registry.ts`),
`LightProbe` (`src/render/lightProbe.ts`), `LIGHT_GLSL`, `ATLAS_GLSL`, `atlasDefines`, `boxFree` (`src/vehicles/collide.ts`),
`boxIntersectsCell` (`src/player/collision.ts`), `USE_COOLDOWN_S`, the `CAPTIONS` swap in `VehicleHud`, `FLIP`/`DELTA` in
`contraption.ts`, `setup()` from `src/workshop/parts.test.ts`.

**Performance budget.** MotionRenderer: <= 1 draw call per distinct voxel kind on screen (typically 3-8), <= 300 instances, zero
allocation per frame (the existing `groundItems.test.ts` style allocation check is copied). Mesh masks: <= 2 async meshes per
touched chunk per glide. CPU per tick for glide bookkeeping: O(glides) <= 6. Skiffs: no chunk meshing ever. Target: no frame time
change measurable on the e2e desktop run (`renderer.stats` triangles drop by the skiff faces, instances rise by <= 300).

---------------------------------------------------------------------------------------------------------------------------

## 9. Tests (vitest)

`src/workshop/contraption.test.ts` (extend, using `setup()`; the fixture's `bus` and `shop`):

a. `motionFraction is smoothstep for ease, u for linear, u^2 for in, 1-(1-u)^2 for out, clamped to 0..1` (pure; values at u =
   0, 0.25, 0.5, 1, and before t0 / after t0 + durS).
b. `a piston push records one glide with from = minus the push, ease, PISTON_MOVE_S, and the voxels already at the destination`:
   run the existing piston setup 1 s; `shop.view(0, 0).moving.length === 1`; `from` deep-equals `[-1, 0, 0]`; `cells` include
   the depot at x 4; `world.getBlock(4,0,0).key === 'depot'` (logic unchanged).
c. `mid-glide the drawn offset is fractional`: with `now = t0 + 0.3`, `motionPoint` of the depot cell gives x in (3.2, 3.8)
   (strictly between origin 3 and destination 4) - the "fractional offset" assertion.
d. `glides end: pruned after t0 + durS and onMoveEnd fires once with the cell keys` (register via `shop.onMoveEnd`).
e. `a bearing step records rot 1 for right, -1 for left, the pivot at the bearing's top centre`.
f. `the skiff's first step eases in, its middle steps are linear, the step into the last rail cell eases out` (5 rails).
g. `no glide is recorded far from the player`: set `shop.playerXZ = () => [100, 100]`; step; `moving.length === 0`, the move
   still happened, `onMoveEnd` fired in the same tick.
h. `at most MOTION_MAX glides live at once`.
i. `the player in a piston's path refuses the step with "You are in the way of the piston"`: `shop.bodyIn = (x,y,z) => x === 4
   && y === 0 && z === 0`; depot stays at x 3.
j. `a player standing on a rising lift is not in the way` (piston facing up under a frame; bodyIn true for the cell above the
   frame; feet-on-origin rule) - the frame moves up; `riderCarry` returns `dy > 0` mid-glide and the sum of `dy` over the glide
   equals 1 within 1e-6.
k. `ground items on a moved depot get a slide equal to the glide and keep their data at the destination` (existing item test +
   `slide.dx === -1`).
l. `existing contraption tests pass unchanged` (no edits to the four current cases).

`src/workshop/skiffRide.test.ts` (NEW):

m. `empty hand Use on an empty skiff boards; on a loaded skiff it hands the stack first with "Took 3 Flint - Use again to climb
   in"` (call `shop.use(x,y,z,null,take)` twice; `shop.ridden` set after the second); riding to the rail end emits flag
   `rode_skiff` exactly once (bus `flag` listener).
n. `a held item still goes into the skiff and never boards`.
o. `boarding refuses without head room` (stone at y+2; toast text exact).
p. `seatAt follows the cart smoothly`: ride 5 rails; sample `seatAt(now)` every 0.01 s of workshop time; x is monotonic while
   rolling, never jumps more than 0.06 between samples, y === skiff y + 0.6 (+ rattle within 0.015).
q. `brake holds the cart; go cuts the dwell short and turns round`.
r. `a ridden cart turns back under a low ceiling with "Too low to ride under - the skiff turns back" (once)`; an empty cart
   passes under the same ceiling.
s. `breaking the ridden skiff ends the ride with "The skiff broke - you climbed out"`.
t. `ride is saved and restored; an old snapshot without ride loads on foot; a ride naming a non-skiff cell is dropped after
   verify()`.
u. `describe lines`: rolling east with 3 Flint -> `Skiff - rolling east, 3 Flint`; each <= 60 chars.

`src/vehicles/manager.test.ts` (extend): a fake `SkiffSeatHost`:
v. `riding carries the player to the seat, zeroes move/mine/use/jump, keeps look free`.
w. `stick forward = go, stick back or Mine = brake, Use after the cooldown = leave and the player stands at a free spot beside
   the cart`.
x. `a dead rider leaves the skiff`.

`src/player/physics.test.ts` (extend):
y. `a platform carry moves the player with the floor and deals no fall damage on a descending lift`.
z. `without a platform nothing changes` (existing tests).

`src/world/world.test.ts` / `src/world/streamer` (extend):
aa. `setMeshMask meshes masked cells as air and maskSettled turns true after the unmasked mesh publishes` (run jobs on the main
    thread fallback; read the mesh's vertex count with and without the mask).
bb. `a meshless block emits no faces and does not cull its neighbours' faces` (`src/world/mesher.test.ts`).

`src/render/workshop/motionRenderer.test.ts` (NEW, with `src/render/testKit.ts`):
cc. `draws one instance per moving cell at the fractional offset and calls mask(id, cells) once and mask(id, null) once`.
dd. `holds finished glides until maskSettled or 0.5 s`.
ee. `no allocation per frame in steady state` (copy the groundItems pattern).

`src/audio/sfx.test.ts`: the count expression including `WORKSHOP_SFX` (section 6.2). `src/content` tests: the side goal exists
in `SIDE_OBJECTIVES`; `content.test.ts` progression unchanged (riding gates nothing).

---------------------------------------------------------------------------------------------------------------------------

## 10. E2E (`scripts/e2e-workshop.mjs`)

Add two named steps after 'a piston pushes a framed depot, a bearing turns an arm, a skiff shuttles its load along rails', and
run `node scripts/e2e-workshop.mjs --device=desktop` (no `HW_GPU`) and `--device=phonePortrait` (the HUD captions are UI).

**Step 'a piston glides: mid-move the depot is drawn between its cells'**
1. `window.__hw` set-up: clear a strip `x0-3..x0+4`, `z0+8..z0+12` (stone floor at `gy-1`, air above, like the first set-up step), place `hand_crank` at `(x0+4, gy, z0+9)`, `piston` facing west (3) at
   `(x0+3, ..)`, `contraption_frame` at `x0+2`, `depot` at `x0+1` with 4 flint; teleport the player 4 blocks south, `lookAt` the
   depot.
2. Real input: `d.selectEmptyHand()`, `d.approach({ x: P.x0 + 4, y: P.gy, z: P.z0 + 9 })` then `d.use()` on the crank.
3. Poll up to 3 s (`waitFor`) for `window.__hw.app.game.workshop.view(px, pz).moving.length > 0`; then read
   `window.__hw.app.game.motionRenderer.stats.blocks > 0` and the drawn x of the depot instance via a NEW debug read
   `motionRenderer.probe(x, y, z)` (returns the drawn centre of the proxy whose destination is that cell, or null). The depot glides
   west from `x0+1` to `x0`: assert the probe's x is strictly between `x0 + 0.55` and `x0 + 1.45` (fractional: mid-glide). Screenshot
   `11-piston-mid-glide`.
4. After 1 s: `moving` empty or a new glide; the chunk mesh shows the depot (no hold left: `stats.held === 0` within 1 s).

**Step 'board the skiff with Use and ride it to the end of the rails'**
1. Set-up: 6 rails at `(x0-2 .. x0+3, gy-1, z0+11)`, `skiff` facing east at `(x0-2, gy, z0+11)`, empty. Teleport beside it, look
   at it.
2. Real input: `d.selectEmptyHand()`, `d.approach({ x: P.x0 - 2, y: P.gy, z: P.z0 + 11 })`, `d.use()`.
3. Assert `window.__hw.app.game.workshop.ridden !== null` and the HUD panel `.hw-vehicle--on` exists with text containing
   `Skiff`; on phonePortrait the use button label reads `Exit` and the jump button `Go`. Screenshot `12-skiff-boarded`.
4. `d.settle(600)` (real frames, no `tick`): read player x twice 150 ms apart: it increased, and `Math.abs(player.y - (gy +
   0.6)) < 0.05` (the seat). Screenshot `13-skiff-riding`.
5. Wait (real time, up to 3 s) until the cart is at `x0+3` and `describe` says `waiting at the end`; the player x is within 0.1
   of `x0 + 3.5`.
6. Exit with real input: `d.use()` (after the 0.6 s cooldown). Assert `ridden === null`, the player stands on the floor beside
   the cart (`player.y` within 0.05 of `gy`), side goal `ride_skiff` done (`objectives.side()` entry `done`). Screenshot
   `14-skiff-off`.

The existing 'no page errors' step stays last.

---------------------------------------------------------------------------------------------------------------------------

## 11. Docs to update (same PR)

- `docs/api/workshop.md`: replace "Steps are discrete (no tween yet)." with a "Motion" paragraph: commit-then-glide, curves and
  constants, `MovingView` member meanings (2.5 table), `onMoveEnd`, mesh mask, meshless skiff, riding controls table (desktop /
  phone), rider carry on lifts, the new strings, `ride?` in the snapshot.
- `docs/api/tractor.md`: a short "Skiff riding" section (the manager also carries skiff riders; controls table; HUD captions
  Brake / Exit / Go).
- `docs/api/player.md` (PlayerPhysics section): `platform: PlatformCarry | null`.
- `docs/api/render-machines.md` or `docs/api/render.md`: `MotionRenderer`, `World.setMeshMask` / `maskSettled`,
  `BlockSpec.meshless`.
- `docs/api/audio.md`: `sfxWorkshop.ts` and the three names.
- `docs/OVERHAUL_PLAN.md` status paragraph: move "tween animation of moving structures, riding a skiff" from "still open" to done.
- Never `docs/WHATS_LEFT.md`, never `docs/build/SYSTEMS.md` (coordinator).

---------------------------------------------------------------------------------------------------------------------------

## 12. Acceptance checklist

- [ ] Every existing test in `src/workshop/contraption.test.ts` passes unedited; step timing unchanged.
- [ ] `Workshop.view(...).moving` holds one `MovingView` per live glide with the 2.5 meanings; empty at rest and after load.
- [ ] Mid-glide a moved block is drawn at a fractional position (unit c, e2e step 3); the chunk mesh never shows it doubled or
      missing (mask on/off exactly once per glide; hold <= 0.5 s).
- [ ] Bearing platforms swing about the bearing's top centre; facings and loose items turn with them.
- [ ] Items on moving depots/belts slide with them; their data positions equal today's.
- [ ] A player on a piston lift rises/falls smoothly, no fall damage, no pop; a player in the path refuses the step with the
      exact text.
- [ ] Empty-hand Use on an empty skiff boards; loaded skiff gives its stack first with the exact toast; held items never board.
- [ ] Riding: seat 0.6 above the cart, 5 blocks/s, smooth (unit p), free look, Brake/Go/Exit on desktop and phone, captions
      restored on exit.
- [ ] Rail end: eases out, waits 2 s, turns (rider's view turns), eases in. Low ceiling turns a ridden cart back with the toast.
- [ ] Skiff broken / player dead / chunk gone ends the ride safely.
- [ ] Save mid-glide loads with blocks at rest at the destination; save while riding reloads seated; old saves load.
- [ ] `skiff_roll`, `piston_slide`, `bearing_turn` exist, follow T9 tiers, nothing loops, idle is silent; `sfx.test.ts` green.
- [ ] Side goal "Ride the skiff" completes on the first boarding+ride and toasts "Side goal: Ride the skiff".
- [ ] `npx vitest run` green; `npx tsc --noEmit` clean; `node scripts/e2e-workshop.mjs --device=desktop` and
      `--device=phonePortrait` green with screenshots 11-14 in `test-results/e2e-workshop/`.
- [ ] Docs of section 11 updated.

---------------------------------------------------------------------------------------------------------------------------

## 13. Out of scope

- Carrying mobs, tractors or other skiffs on moving structures (they keep today's behaviour).
- Pistons pushing non-movable blocks, sticky behaviour, longer strokes than `PISTON_MAX`, contraptions larger than 48.
- Skiff steering, junctions/switches, slopes (rails stay flat, one y), powered/boosted rails, speed control beyond go/brake.
- Riding anything but a skiff (no riding pistons as "elevator entities" - a lift is standing on a platform, 4.5).
- Tarred-plank skiff hull (Unit 9 optional consumer; not taken).
- Collision against the drawn (in-between) position of a gliding block: collision stays on the committed destination.
- Third-person camera, motion-sickness settings (none exist; the bearing rider carry can be switched off by a constant
  `CARRY_YAW` NEW = true if the owner asks).
- Belt border hand-off and vault regrouping after moves (Unit 15, via `onMoveEnd`).

---------------------------------------------------------------------------------------------------------------------------

## 14. Notes for the coordinator

1. **T9 wording.** Please change T9 rule 4 to "tweened motion with ease-in-out within the step time (Unit 13: pistons glide
   0.6 of 0.8 s, bearings 1.2 of 1.5 s, skiffs linear end to end with eased start/stop)" and add `piston_slide`, `bearing_turn`
   beside `skiff_roll` in the T9 `sfxWorkshop.ts` list.
2. **`sfxWorkshop.ts` ownership.** Units 13, 14, 16 all add to it. Rule: the first to merge creates the file, the `sfx.ts`
   spread and the `sfx.test.ts` term `Object.keys(WORKSHOP_SFX).length`; later units append rows only.
3. **Optional members added to Unit 0's shapes** (allowed by 6.5): `MovingView.voxels?`, `.curve?`, `.id?`;
   `WorkshopView.now?`, `.skiffs?`. Please record them in SYSTEMS 6.5.
4. **New cross-system hooks outside the workshop**: `World.setMeshMask/maskSettled` (+ `Streamer.neighbourhood` copy),
   `BlockSpec.meshless?` (mesher table), `PlayerPhysics.platform`, `GroundItem.slide?`. All optional/default-off; no other unit
   needs them, but Unit 15's reviewers should know `onMoveEnd` is the moment to recompute.
5. **Visible change**: skiffs beyond 40 blocks are not drawn (meshless). If the owner dislikes it, raise `MOTION_RADIUS` for
   skiffs only (instances are cheap).
6. **Interaction order**: boarding goes through `Workshop.use` -> `Logistics.use` (called first in `Interaction.beforeUse`), so no
   change to the vehicle manager's on-foot aim code is needed; while riding the manager takes Use (exit) before the controller.
7. SYSTEMS 5.2 "skiff | 5 blocks/s (`SKIFF_STEP_S` 0.2), rider seat offset 0.6" is used verbatim (`SKIFF_SEAT_Y` 0.6).
