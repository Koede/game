# The Emberbound - what is drawn (spec 19.5) - `src/render/mobs`

The automatons' visuals: glow, flare, arm and body animation, ember bolts with trails, hit sparks, the break-apart,
smoke and sparks on active ones. Everything is in `src/render/mobs` (shader `material.ts`, pure animation `poses.ts`,
the effects `automatonFx.ts` and its helpers). DOM-free parts are unit tested (`npx vitest run src/render/mobs`: 35 tests).
Behaviour, models and events are `docs/api/emberbound-ai.md` / `emberbound-content.md`; this page is only what the
renderer does with them.

## Hooks (what the app calls)

```ts
this.mobRenderer.setBolts(state.mobs.projectiles(alpha));     // NEW, one line in src/app/game.ts (before update)
this.mobRenderer.update(dt, state.mobs.views(alpha));          // unchanged: automatons are in the same list
```
`setBolts(views: readonly BoltView[])` takes `ProjectileView`s structurally (`{ id, x, y, z, vx, vy, vz }`); at most 8
are drawn. Without the call everything else still works and bolts are simply invisible.

No event bus is needed: the renderer watches the views from frame to frame. A wind-up that ends from `flare >= 0.8`
(the `attack` goes back to null) is the release (swing, impact, zap); a rising `flash` is a hit (sparks); a view with
`tip > 0` is the break-apart (drawn as debris, not as a corpse); a bolt id that vanishes is a bolt that ended. An
automaton culled for a frame forgets its previous frame, so nothing fires spuriously when it re-enters view.
`MobRenderView` gained optional `glow`, `flare`, `attack`, `dormant` (src/mobs' `MobView` has them; animals omit them).
`MobScene` gained an optional `canvas` (the Renderer has it) that sizes the sparks.
`MobRenderer.fxStats` -> `{ halos, cubes, particles }` drawn last frame.

## What is drawn

- **Emissive parts** (`CreaturePart.emissive`, `aPart` + `EMISSIVE_FLAG`): the mob shader draws them full-bright
  regardless of light (ember x `glow`), flicker slightly, brighten and whiten with `flare`, cut through fog a little
  further than iron, and when `glow` is 0 (dormant, dead) they are a cold dark cinder lit like the body. An active
  ember also lights its own body a little so the silhouette reads at night. Colour noise is flattened on ember parts.
- **Halos** (`halos.ts`, one additive instanced draw call, 64 max): a soft glow around the main ember part of each
  automaton (bigger and hotter through a wind-up), a second one at its muzzle/coil during a wind-up (cyan for the
  drone), around every bolt, and short flashes (hit, shot, break-apart, impact).
- **Arms and body** (`poses.ts`, the shader's arm groups `armL`/`armR` about their shoulder pivots):
  warden: hammer arm rises to overhead through the wind-up, shield arm lifts a little, hammer comes down in 0.1 s on
  the release, holds, settles back over 0.5 s, with an impact burst (sparks, dust, flash) on the ground ahead; colossus:
  both fists overhead (2.85 rad), slam to the ground with a squash, a ring of sparks and dust; hound: crouches (squash 0.78,
  nose down) while standing through its wind-up, its ribs and exhaust flare, stretches low once the dash runs; drone:
  hovers with a 0.07-block bob, the coil spins up (0.8 -> 22 rad/s) and the body shivers in its wind-up, arc sparks
  crackle from the coil tip, a jagged arc of sparks to the player on the release; sentry: stays on its tripod and only the
  kiln turns (`aCool.y`) towards the player, lifts its mouth and recoils on the shot; mite: rears its head to bite; dormant
  ones slump (head down) and go dark; walkers swing their arms against the legs.
- **Ember bolts** (`bolts.ts`, `cubes.ts`): a full-bright tumbling cube + halo per bolt (8 max, 160 cubes shared with
  debris), a trail of ember chips laid along the path since the last frame (so it is continuous at any frame rate) and
  soot puffs, a muzzle flash and sparks when it appears, a burst where it ends.
- **Hit sparks**: 12 sparks and a small flash at the body's middle when the hurt flash jumps.
- **Break-apart** (`burst.ts`, `debris.ts`): 20-56 tumbling cubes (by height) cut from the model's own boxes in their
  colours, ember parts as glowing pieces that cool; they bounce off the ground and walls, rest, and shrink away
  (2.4-3.6 s), plus 26 sparks, soot, a flash. The dead model is not drawn.
- **Active emitter**: smoke puffs (walkers and turrets, from the vent/chimney/back vent) and ember sparks (drones: arc
  chips) scaled by glow, much faster through a wind-up. Skipped beyond 40 blocks and for culled automatons.

## Files

`material.ts` (shader), `geometry.ts` (EMISSIVE_FLAG, PART_GROUP), `poses.ts` (pure curves), `anchors.ts` (pure: halo,
vent, arc points and break-apart boxes per species), `bolts.ts` (pure tracker), `burst.ts`, `debris.ts` (pure field),
`halos.ts`, `cubes.ts`, `sparks.ts` (particle helpers over `src/render/particles.ts`'s `Particles`, its own pool of 640),
`automatonFx.ts` (orchestration, per-id memory), `mobRenderer.ts` (writes pose, ember and arm attributes per instance).

## Measured

Headless Chromium (software GL, a loaded machine, so only the JS share is meaningful), 390x844, real game, night:
`MobRenderer.update` per call, best of 300 after 30 warm-up calls, with 12-13 real automatons (two of each type) placed in a
field:

| scene | ms per frame |
|---|---|
| 12 hens (animal path, the baseline) | 0.050 |
| 12 automatons idle (halos + smoke/sparks) | 0.090 |
| 12 automatons all mid wind-up (flare 0.8) | 0.172 |
| 12 automatons winding up + 8 bolts flying with trails | 0.101 |

So the extra cost of 12 automatons and 8 bolts is 0.05-0.12 ms of JS per frame, against the 1 ms budget. GPU side: one more
draw call each for halos, cubes and particles (3 + 6 species batches only when present; every species is one instanced call
as before); halos are additive quads (capped 64, each never wider than 0.9 x its distance), particles at most 640 points.
Not measured on a real phone GPU. `renderer.cpuMs` was 3.7 ms/frame in the same run (software GL), not comparable.

Verified by screenshots at 1280x800 and 390x844 (night unless noted): every type close up idle and mid wind-up, warden hammer
swing and impact, colossus slam, drone zap arc, kiln sentry shot and bolts in flight with trail, hound crouch with flared
ribs, break-apart of a warden, hound and colossus, dormant ones in daylight (dark, slumped).

## Known gaps

- The glow halos do not follow a raised arm (the warden's hammer face glows through the shader only).
- Frame rates in the headless harness are 2-4 fps (software GL), so wind-up/release moments were captured with the mob
  tick frozen and the wind-up set through `__hw.app.game`, not by watching a live fight; the live release path is
  covered by the same code (the views are what the real AI produces) and by unit tests.
- Sparks and smoke use `src/render/particles.ts`' own fog handling, not the world's light; at noon they are as bright
  as at night (embers are self-lit, so that reads right; the soot puffs do not darken in the shade).
