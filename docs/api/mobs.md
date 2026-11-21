# Animals - src/mobs (behaviour) and src/render/mobs (models)

Spec 12.5. `src/mobs` is DOM-free (node-tested, 60 tests); it imports only core (and, in tests, src/world).
`src/render/mobs` draws the animals with three.js (6 node tests plus headless-Chromium screenshots). Nothing is
wired into the game yet: **the integrator does the steps in "Wiring" below** (src/app, src/player, src/ui are
other engineers' files). `npx vitest run src/mobs src/render/mobs`.

## Wiring (for the integrator)

### 1. Session (src/app/state.ts - GameState)
```ts
import { MobManager, mobPlayerOf, type MobsSnapshot } from '../mobs';
// after the clock and the player exist (biomeAt and spawnPoint are read from the World itself):
this.mobs = new MobManager(world, bus, this.clock, world.seed);
if (save?.mobs) this.mobs.load(save.mobs);          // WorldSave gains `mobs?: MobsSnapshot` (old saves: omit -> fresh)
this.mobPlayer = mobPlayerOf(this.player);          // live adapter: position, yaw, held item
this.mobs.onDeath((d) => { for (const s of d.drops) this.player.give(s.item, s.count); });
// tick(dt): clock -> sim -> this.mobs.tick(dt, this.mobPlayer) -> survival -> objectives
// toSave(): { ..., mobs: this.mobs.toJSON() }      dispose(): this.mobs.dispose()
```
`load()` throws on a malformed snapshot (like `World.load`): catch it and start the animals fresh rather than
refusing the save. Creating the manager after `ensureLoadedAround` is fine: a once-a-second sweep rolls every
loaded column within 7 chunks of the player that the `chunk:loaded` events did not cover.

### 2. Frame (src/app/game.ts - Game)
```ts
import { MobRenderer } from '../render/mobs';
this.mobRenderer = new MobRenderer(this.renderer, state.world);   // right after the Renderer
// frame: controller -> fixed ticks -> world.update -> ...
this.mobRenderer.update(paused ? 0 : dt, state.mobs.views(paused ? 1 : this.step.alpha));
this.renderer.render(dt);                                        // after mobRenderer.update
// dispose: this.mobRenderer.dispose() before this.renderer.dispose()
```
`views(alpha)` interpolates between the last two ticks (`FixedStep.alpha`); its array and objects are reused.

### 3. Player (src/player - Mine / Use with the crosshair on an animal)
Every frame, cast against the animals as well as the blocks, from the eye along the view (`player.viewDir`):
```ts
import { hitDamage } from '../mobs';
const mob = mobs.raycast(eyeX, eyeY, eyeZ, dirX, dirY, dirZ, REACH);   // { id, distance } | null (reused object)
const onMob = mob !== null && (blockHit === null || mob.distance < blockHit.distance);
```
- While `onMob`: no block target (`view.setTarget(null, -1)`), no block mining, HUD target name
  `mobs.describe(mob.id)` ("Goat - 6/8", "Young Hen - 4/4").
- Mine held on an animal: `const r = mobs.hit(mob.id, hitDamage(player.heldStack()?.item ?? null), player.position.x, player.position.z)`.
  The manager refuses (`{ ok: false, reason: 'cooldown' }`) for `MOB_HIT_COOLDOWN_S` after a hit, so calling it
  every frame while Mine is held hits every 0.4 s. On `r.ok`: `view.triggerSwing()` and wear a held tool by 1
  (PlayerState only has `wearHeld(block)`: the player/game engineer needs a "wear by 1" helper). Damage rule
  (`hitDamage`): hand or non-tool 1, axe tier + 2, pickaxe / shovel tier + 1, hoe 1.
- Use on an animal: `const f = mobs.feed(mob.id, heldItem)`. `f.ok` -> `player.consumeHeld(1)`, swing (the
  manager plays sfx `eat`). Not ok -> toast `f.reason` ("Goats eat wheat", "This hen is too young", "This boar is
  not ready yet (212 s)", "This goat is already keen") when the held item is something some animal likes;
  otherwise fall through to the normal Use (eat the food, place the block) as if no animal were there.
- Drops arrive through `onDeath` (step 1) MOB_DEATH_S after the killing blow; nothing to do in the player module.

### 4. HUD (src/ui)
The HUD's crosshair label only knows blocks (`GameUI.setTarget(block, mining)`); it needs a way to show
`mobs.describe(id)` while an animal is targeted (e.g. a `setTargetName(text | null)`), per spec 12.8.

### 5. Audio
Nothing to wire: every sound goes through the `'sfx'` event with a position - the species call (`hen` / `goat` /
`boar`, the creature key) every 8-20 s within 32 blocks of the player (babies pitched up), `mob_hurt` on every
hit, the call at a low pitch when one dies, the call at a high pitch on a birth, and `eat` when fed.

### Events emitted
`mob:spawned {id, species}` (chunk roll, spawn guarantee, keep-alive, birth - not on load), `mob:hurt {id, species,
health}` (player hits and hazards), `mob:died {id, species}` (MOB_DEATH_S after the killing blow), `toast` (warn)
"Too many animals here for another one" when a birth hits the cap, `sfx` as above.

## src/mobs - public API (`import ... from '../mobs'`)

```ts
class MobManager {
  constructor(world: IWorld, bus: GameBus, clock: MobClock, seed: number, options?: MobManagerOptions)
  readonly world: IWorld; readonly seed: number; readonly biomeAt: BiomeLookup; readonly rng: () => number
  tick(dt: number, player: MobPlayer): void          // one 20 Hz step: spawning, AI, physics, hazards, calls, deaths
  raycast(ox, oy, oz, dx, dy, dz, maxDist): MobRayHit | null   // nearest living animal box (dir need not be unit)
  hit(id: number, damage: number, fromX: number, fromZ: number): HitResult
  feed(id: number, itemKey: string): FeedResult      // ok -> eager MOB_EAGER_S; the caller consumes the item
  describe(id: number): string                       // HUD name + health, '' for unknown / dying
  onDeath(fn: (d: MobDeath) => void): () => void     // after the tip-over; drops only for player kills of adults
  views(alpha: number): readonly MobView[]           // interpolated render views of the loaded animals (reused)
  get all(): readonly Mob[]; get loaded(): readonly Mob[]; get(id): Mob | undefined
  room(count: number): boolean                       // `count` more fit under MOB_LOADED_CAP and MOB_STORED_CAP
  add(spec: CreatureSpec, spot: { x, y, z, yaw }, baby?: boolean): Mob   // spawn directly (debug, tests); no cap check
  toJSON(): MobsSnapshot; load(s: MobsSnapshot): void   // load throws on malformed / newer snapshots, changes nothing
  get spawning(): Spawner                            // rolled set, guaranteed flag, keep-alive timer (tests, debug)
  dispose(): void
}
interface MobManagerOptions {
  biomeAt?: (x, z) => BiomeKey                       // default world.biomeAt (World has it), else 'woodland'
  spawn?: { x, y, z } | null                         // default world.spawnPoint(); null = no spawn guarantee
  naturalSpawning?: boolean                          // false: no rolls / guarantee / keep-alive (tests, harnesses)
}
interface MobPlayer { x; y; z; yaw; heldItem(): string | null }
interface MobClock { readonly timeOfDay: number; sunlight(): number }      // GameClock fits
mobPlayerOf(player: { position, yaw, heldStack() }): MobPlayer             // live adapter for PlayerState
hitDamage(heldItem: string | null): number; rollDrops(drops: Drop[], rng): ItemAmount[]
type HitResult = { ok: true; health: number; killed: boolean } | { ok: false; reason: 'missing' | 'dead' | 'cooldown' }
type FeedResult = { ok: true } | { ok: false; reason: string }
interface MobRayHit { id: number; distance: number }
interface MobDeath { id; species; x; y; z; cause: 'player' | 'world'; drops: ItemAmount[] }
interface MobView { id; spec; x; y; z; yaw; scale; walk; stride; head; flash; tip; fade; onGround; eager }
interface MobsSnapshot { version: 1; nextId; rolled: number[] /* flat cx,cz pairs */; guaranteed; keepAliveS; mobs: SavedMob[] }
interface SavedMob { id; species; x; y; z; yaw; health; baby; ageS; eagerS; cooldownS }
```
`Mob` (read only) carries the live state: position, velocity, yaw, health, baby, ageS, `state` (`'idle' | 'wander' |
'graze' | 'flee' | 'follow' | 'breed' | 'swim' | 'dying'`), eagerS, cooldownS, fleeS, hurtS, onGround, inLiquid...
Constants (src/mobs/constants.ts): `CORPSE_FADE_S 0.5`, `FLASH_S 0.3`, `CALL_RANGE 32`, `VOID_Y -8`, `KNOCK_H 5`,
`KNOCK_V 4.5`; `TARGET_MARGIN 0.08` (targets.ts). Every spec number is a `MOB_*` constant in src/core/constants.ts.

### Behaviour (brain.ts), in priority order each tick
1. **flee** - hurt: runs directly away from the player (from a hazard: away from that cell) at 1.6x speed for
   MOB_FLEE_S, veering up to 135 degrees around walls, drops and water.
2. **swim** - in a liquid: floats (buoyancy keeps the waist at the surface), swims to the nearest dry bank within
   10 blocks and climbs out.
3. **breed** - eager adult off cooldown: pairs with the nearest eager adult of its species within MOB_BREED_RADIUS,
   both walk together, and after MOB_BREED_S side by side a baby appears between them; both lose eagerness and
   rest MOB_BREED_COOLDOWN_S. Babies grow up after MOB_GROW_UP_S.
4. **follow** - the player within MOB_FOLLOW_RANGE (and 6 blocks of height) holds a liked item: walks up to
   MOB_FOLLOW_DISTANCE and faces the player.
5. a **baby** more than 5 blocks from the nearest adult of its kind trots back to it.
6. the calm cycle: **idle** (slow look-arounds) / **graze** (head down, nibbling) / **wander** (a target within
   MOB_WANDER_RADIUS whose straight path `walkable()` accepts), with random durations.
Every stride on land is edge-guarded (`standCell`): never into liquid, never down more than MOB_MAX_DROP, never
into an unloaded column, also mid-hop; a one-block step is hopped. Lava (any `contactDamage` block touching the
body) hurts per second like the player, with no drops. Animals below y -8 are removed.

### Physics (physics.ts)
AABB (w x w, h; babies x MOB_BABY_SCALE) swept per axis in sub-steps <= 0.45 blocks (no tunnelling), gravity
GRAVITY, slabs half height, unloaded columns and y < 0 solid, cells already overlapped ignored (a block placed into
an animal lets it walk out; it is also lifted while embedded), low air control so knockback carries.

### Spawning (spawning.ts, spawner.ts)
- First load of a chunk column (event or sweep): `hashFloat(seed, cx, cz) < MOB_CHUNK_SPAWN_CHANCE` -> one group of
  a species whose biomes include the chunk's biome, anchored inside the chunk on open natural ground (grass, dirt,
  snow, sand, gravel, basalt, peat with only plants above), members within 3 blocks and inside the same chunk.
  Pure function of seed and terrain: the same animals whatever order chunks load in (tested on real terrain).
- Spawn guarantee: once every column within MOB_SPAWN_GUARANTEE_RADIUS of world spawn is loaded, adds a hen group
  and/or another species' group there if the rolls left none (tested on 3 seeds with real worldgen).
- Keep-alive: during daytime (sunlight >= 0.5), fewer than MOB_KEEPALIVE_MIN_ADULTS adults within
  MOB_KEEPALIVE_RADIUS for MOB_KEEPALIVE_AFTER_S seconds -> one group 24-56 blocks away, outside a 120-degree cone
  around the view direction. Night time neither counts nor resets.
- Caps: no roll, keep-alive group or birth beyond MOB_LOADED_CAP animals in loaded columns or MOB_STORED_CAP in all.

### Measured
40 animals on real terrain (node, one goat-luring player nearby): **0.15-0.18 ms per tick**. Headless Chromium
(software GL), 40-53 animals around spawn: MobManager + MobRenderer.update 0.1-0.3 ms per frame.

## src/render/mobs - public API (`import ... from '../render/mobs'`)

```ts
class MobRenderer {
  constructor(view: MobScene, world: IWorld)          // MobScene = { scene, camera, uniforms } - the Renderer fits
  update(dt: number, mobs: readonly MobRenderView[]): void   // before Renderer.render(dt); MobView fits MobRenderView
  drawn: number                                       // instances drawn last update (after culling)
  dispose(): void
}
buildSpeciesGeometry(spec: CreatureSpec): SpeciesGeometry      // { geometry, legHeight, height, radius }
PART_GROUP; MOB_DRAW_CAPACITY = 64; PROBES_PER_FRAME = 2; FRESH_PROBES = 6
```
- **Renderer hook (the one edit outside my directories):** `Renderer.uniforms` (the shared world uniforms: sky
  tint, firelight, ambient, fog, time) changed from private to public readonly, so the animals are lit and fogged
  exactly like the terrain. Nothing else in src/render changed.
- One `InstancedMesh` per species (3 draw calls for any number of animals) plus one instanced draw call of blob
  shadows. The geometry is the species' CreatureSpec boxes (24 vertices per box) with per-vertex colour, pivot and
  animation group; the vertex shader swings legs in diagonal pairs (the hen's two legs in opposition) with the
  distance walked, lowers the head while grazing (with a nibble) and nods it in step, scales babies' heads 1.35x
  and shrinks their horns and tusks to nubs, applies the instance matrix (position, yaw, MOB_BABY_SCALE, tip-over
  onto a side lifted to rest on the ground), shades faces like the terrain (top 1, bottom 0.5, N/S 0.8, E/W 0.65
  from the world normal) and lights them with the terrain's own ramps from sky / block light probed at the animal
  (`LightProbe`, 2 animals per frame round-robin plus up to 6 new ones, eased). The fragment shader adds per-pixel
  colour noise (1/16-block texels, offset per box), the red hurt flash (a multiplied tint that keeps the
  shading), a dithered fade for corpses, and the world fog. Eager animals pulse a little brighter.
- Culling per animal: frustum sphere test and the fog distance. No per-frame allocation (attributes are written
  in place with partial uploads).

## Verification
- Node: terrain probes (steps, drops, liquids, unloaded columns, negative coordinates, diagonal squeeze, spawn
  ground, shores), physics (rest, no tunnelling at terminal speed, walls, hops, chunk borders at negative
  coordinates, unloaded walls, floating, hazards, embedded, slabs), behaviour (idle/graze/wander cycle, 15 minutes
  beside a pond and a 4-deep pit without getting wet or falling, flee speed/duration/veering, follow distance and
  range, feed refusals, breeding and growing up, eagerness wearing off, knockback, cooldown, death timing and drops
  table, babies drop nothing, lava deaths, the void, swimming ashore, frozen chunks resuming, call intervals and
  range, raycast incl. negative coordinates, describe), spawning (roll rate, biome species, order independence on
  real terrain, no re-roll, the guarantee on 3 seeds, keep-alive timing / distance / view cone / night / caps),
  save/load round trip through JSON, malformed snapshots, hit damage table, the performance budget.
  Renderer: geometry groups and pivots, culling, instance transforms (yaw, baby scale, tip-over lift), light and
  animation attributes, no growth per frame, dispose.
- Headless Chromium with a scratch harness (real World + Renderer + MobManager + MobRenderer around spawn, seed
  1234567): close-ups of every species with its young by day and at dusk, hurt flash / grazing / tip-over /
  fade states, a live herd from 20 blocks by day and at dusk, a goat following a player holding wheat, animals
  by torchlight at night - at 1280x800 and 390x844. Reviewed and iterated (flash tint, shadow strength, noise
  contrast, young animals' horn nubs and bigger heads).

## Deviations from the spec
- Spawn ground includes dirt, gravel, basalt and peat as well as grass / snow / sand: the Scar has no grass, so
  boars could otherwise never spawn there.
- Wandering uses 55% of the species speed; following and breeding the full speed; swimming 60%.
- A dying animal is a non-targetable corpse for MOB_DEATH_S (tip-over) plus 0.5 s (fade) before it is removed;
  'mob:died' and the drops come at MOB_DEATH_S as specified.
- Hazard (lava) deaths and babies give no drops. Animals take no fall damage.
- `hit` takes the damage from the caller; `hitDamage(item)` implements the spec's table.
- Babies have the adult's health.

## Known gaps
- Not wired into the game (src/app, src/player, src/ui belong to other engineers): see Wiring.
- PlayerState has no "wear the held tool by 1" helper for hits (wearHeld needs a block).
- The HUD cannot show an animal's name yet (needs a target-name hook).
- A chunk rolled while the stored cap (300) is full never gets its group later; keep-alive spawns still top up the
  area around the player.
- Animal behaviour state (current target, timers) is not saved, only what the spec lists; after loading each
  animal starts idle.
- Wander paths are straight lines (no path finding); an animal behind a wall simply picks another target.
- `manager.ts` is ~385 lines, a little over the 350-line aim.
