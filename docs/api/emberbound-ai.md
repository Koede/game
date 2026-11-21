# The Emberbound - AI, spawning and combat (spec 19.2-19.3) - `src/mobs` (+ `src/world/ruinGuards.ts`)

The automatons live in the animals' `MobManager` (same ids, raycast, `hit`, `describe`, `views`, save) but in their own
list (`HostileLayer`, src/mobs/hostiles.ts), so the animals' caps, spawner and retiring never see them. DOM-free;
`npx vitest run src/mobs` (36 new tests in `hostileCombat.test.ts` and `hostileWorld.test.ts`; 113 in src/mobs).
Data and numbers are the data pass's (`docs/api/emberbound-content.md`); the player's side (armour, burning, swing
cooldown, death cause, Peaceful flag) is `src/game/combat.ts` (`docs/api/game.md`); safe zones are `src/sim/safeZones.ts`
(`docs/api/sim.md`).

## Wiring (for the integrator: src/app only - nothing else needs changing)

### 1. Session (src/app/state.ts - GameState), where the MobManager is made
```ts
this.mobs = new MobManager(world, bus, this.clock, world.seed, { difficulty: settings.difficulty });
this.mobs.useHostileHooks({
  safeZones: this.sim,                                              // Simulation satisfies SafeZones (isSafe)
  damagePlayer: (amount, cause, x, z, kind) => this.player.combat.takeHit(amount, cause, x, z, kind),
  knockPlayer: (vx, vy, vz) => this.player.combat.knock(vx, vy, vz),
  sky: () => ({ storm: this.weather.state.kind === 'storm', moonPhase: this.clock.moonPhase }),
});
this.player.combat.setDifficulty(settings.difficulty);
// whenever Settings.difficulty changes (pause menu):  this.mobs.setDifficulty(d); this.player.combat.setDifficulty(d);
```
`GameState` does not see the settings today: either pass the difficulty into it, or have the app call
`state.mobs.setDifficulty(settings.difficulty)` and `state.player.combat.setDifficulty(...)` right after creating the
state (before the first tick) and whenever the setting changes.
- Use `takeHit`, NOT `player.damagePlayer`: the automatons already multiply by the difficulty and emit
  `player:attacked` themselves (calling `damagePlayer` would scale twice and emit twice).
- The existing `onDeath` listener (drops into `player.give`) already serves the automatons: their drops come through it
  the moment they break apart.
- Saves: nothing to do. `mobs.toJSON()` now carries `hostiles` (automatons + guarded ruins); `load` restores it and
  older saves (no `hostiles`) load with none. `load` still throws on a malformed snapshot (keep the existing catch).
- Order in `tick`: unchanged (`this.mobs.tick(dt, this.mobPlayer)` after the sim; the automatons tick inside it,
  after the animals).
- Debug: `__hw.spawnMob('forge_warden')` (src/app/debug.ts) now spawns a real, natural automaton through `add`.

### 2. Player (src/player) - already done by the combat engineer
`AnimalHands.strike()` calls `mobs.hit(id, hitDamage(item), x, z, stunOf(item))` - the fifth argument is the arc
maul's stun. Raycast and `describe` ("Forge Warden - 9/16") include automatons.

> TODO (app wiring): `state.mobs.projectiles(alpha)` is not handed to the renderer yet - `docs/api/emberbound-render.md`
> (the render engineer's hook) does not exist; connect it in src/app/game.ts once it does.

### 3. Renderer (src/render - for the render engineer; nothing to wire beyond this)
```ts
this.mobRenderer.update(dt, state.mobs.views(alpha));     // already wired: automatons are in the same list
state.mobs.projectiles(alpha)                              // ember bolts in flight (draw them + trails)
```
`MobView` gained `glow` (0 dark .. 1 lit, eased, 0 for animals and dead automatons), `flare` (0..1 wind-up progress,
1 while a dash runs), `attack` (the attack telegraphed or running, else null) and `dormant`. Effects hang off the
events below (`hostile:windup`, `hostile:attack`, `automaton:salvaged`, `projectile:fired/hit`). A broken automaton
is a corpse for CORPSE_FADE_S with `tip` = 1 and `fade` 0..1 (draw debris instead of a tip-over).

## Public API (src/mobs, `import ... from '../mobs'`)
```ts
class MobManager {
  // new or changed for spec 19:
  constructor(world, bus, clock, seed, options?: MobManagerOptions)   // options.difficulty?: Difficulty (default 'normal')
  hit(id: number, damage: number, fromX: number, fromZ: number, stunS = 0): HitResult
      // automaton: shield arm (shieldFront within 90 deg of its facing, not while stunned), knockback by bulk
      // (KNOCK_H x min(1, 8 / health); sentries none), wakes and turns on the player, stays awake 30 s in daylight,
      // stunS > 0 stuns (wind-up/dash broken off); refused for MOB_HIT_COOLDOWN_S. At 0 health it breaks apart AT
      // ONCE: sfx automaton_break, 'mob:died', 'automaton:salvaged' + 'flag' FLAG_AUTOMATON_SALVAGED, death listeners.
  raycast(...)           // nearest animal OR automaton
  describe(id)           // "Slag Colossus - 41/60"
  views(alpha)           // animals then automatons (see MobView above)
  projectiles(alpha): readonly ProjectileView[]               // { id, kind, x, y, z, vx, vy, vz, ageS } reused
  useHostileHooks(hooks: HostileHooks): void                  // replaces earlier hooks
  setDifficulty(d: Difficulty): void                          // Peaceful: natural automatons and bolts removed at once
  get hostiles(): HostileLayer                                // read-only use (tests, debug)
  add(spec, spot, baby?)  // an automaton spec goes to the hostile layer as a natural automaton
  options.naturalSpawning === false also turns off the automatons' night spawning (ruin guards still appear)
}
interface SafeZones { isSafe(x: number, y: number, z: number): boolean }       // src/sim's Simulation fits
type DamagePlayer = (amount: number, cause: DamageCause, sourceX: number, sourceZ: number, kind: string) => void
      // amount after difficulty, before armour; cause 'automaton'; kind = species key. 'player:attacked' came first
      // (its `attack` 'bolt' = the kiln sentry: src/game burns the player from the species' hostile.burn).
type KnockPlayer = (vx: number, vy: number, vz: number) => void               // ADD this velocity to the player's
interface HostileHooks { safeZones?; damagePlayer?; knockPlayer?; sky?: () => SkyFacts }   // all optional
class HostileLayer {    // mobs.hostiles
  readonly all: readonly Mob[]; readonly active: readonly Mob[]; readonly loadedCount: number
  readonly projectiles: Projectiles; readonly guarded: Set<string>; naturalSpawning: boolean
  add(spec, x, y, z, yaw, role: HostileRole, ruin: string, home: {x, y, z}): Mob
  guardRuin(plan: RuinGuardPlan): boolean;  hit(m, damage, fromX, fromZ, stunS?): HitResult
}
Mob.hostile: HostileState | null   // role 'natural'|'guard'|'turret', mode 'dormant'|'roam'|'chase'|'windup'|'dash'|
                                   // 'return'|'retreat', home, aware, unseenS, glow, stunS, hover...
MobsSnapshot.hostiles?: HostilesSnapshot  // { guarded: string[]; spawnS; mobs: SavedHostile[] }
SavedHostile { id, species, x, y, z, yaw, health, role, home: [x, y, z], ruin, dormant, hover }
```
`src/world/ruinGuards.ts` (pure): `ruinGuardPlan(seed, site: RuinSite): RuinGuardPlan`, `ruinGuardPlans(seed, cx, cz)`;
`RuinGuardPlan { key ("x0,z0"), x, z (room centre), floor, x0, z0, x1, z1 (bounds incl. fallen stones), wardens: {x, z}[]
(RUIN_WARDENS cells inside the room, never the crate, door or furnace cell), sentry: {x, z}[] (wall cells, corners
first; empty on 1 - RUIN_SENTRY_CHANCE of ruins) }`.

### Events emitted
`mob:spawned` (every automaton made, also ruin guards), `hostile:woke` (noticed the player, hit while dormant, night
fell on a dormant one), `hostile:dormant`, `hostile:windup` (`durationS` = windupS), `hostile:attack` (release, every
attack, landed or not), `player:attacked` (just before `damagePlayer`), `projectile:fired`, `projectile:hit`
(`target` 'player' / 'block' / 'expired' - also when a bolt flies into a safe zone), `mob:hurt`, `mob:died`,
`automaton:salvaged`, `flag` FLAG_AUTOMATON_SALVAGED. Sounds (`sfx`, positioned): automaton_step per stride within
24 blocks (pitch 1.35 mite, 0.72 colossus, +-6%), automaton_wake, automaton_windup started `windupS - 0.5` s into the
wind-up (so the 0.6 s patch swells into the release), automaton_attack (melee/slam/dash release), ember_bolt,
arc_zap, automaton_hurt, automaton_break. Animal calls never run for automatons.

## Behaviour as built
- **Senses** (4 Hz, staggered): line of sight (DDA voxel walk; opaque blocks stop eyes, glass does not) within
  `senseRange` 16 or anything within HOSTILE_SENSE_BLIND 6; forgets HOSTILE_FORGET_S 10 s after last sensing; while
  aware but unsighted it walks to where the player was last sensed.
- **Attacks** (`attacks.ts`): a wind-up starts once the period (`cooldownS`, counted from the last wind-up start) has
  passed, the player is sensed, not in a safe zone and in position: melee edge gap <= 0.85 x range; slam centre
  <= 0.8 x range; dash 1.5..range on the ground; bolt / zap within range of the muzzle (all need sight). The automaton
  stands still through the wind-up (melee turns at 2.5 rad/s, slam not at all, the rest aim fully) and the release is
  judged against the player THEN: melee edge gap <= range, feet level and within 45 degrees of its facing; slam within
  range + 0.3; zap within range with no SOLID block between (x wetMult with the player's feet or waist in water); dash
  runs at dashSpeed towards where the player is at the release, HOSTILE_DASH_OVERRUN past, stops at walls, edges and safe
  zones, hits once on contact; bolt is lobbed from 0.2 in front of the kiln on the low arc that lands on the player
  (`aimLob`; 45 degrees when out of reach). Damage = `hostileDamage(spec, difficulty)` x the wet multiplier. Knockback
  `hostile.knockback` (default 3) + 4 up, along the blow (slams outward, dashes along the charge).
- **Ember bolts** (`projectiles.ts`): EMBER_BOLT_GRAVITY, sub-steps <= 0.25 block, hit the player's box (+radius) or
  the first solid cell (slabs by height; unloaded = solid), never break anything, expire after EMBER_BOLT_MAX_S or in a
  safe zone. Not saved (they live <= 4 s).
- **Moving** (`hostileMove.ts`): walkers steer straight at the target with the animals' edge guard (`standCell`: hop one
  block, no liquid - automatons do not swim, see deviations - no drop > 2, no lava/cactus) and the animal physics;
  blocked counted, HOSTILE_GIVE_UP_S 4 s -> roam 3-6 s away from the target, then try again. Flyers hold a hover height
  2-4 (fixed per drone) above the ground below, no gravity, swept per axis; a dormant drone drops to the ground.
  Stationary sentries never move (velocity forced to 0), only turn. Walkers push apart (the animals' `separate`).
- **Safe zones**: a stride (or flight) that would enter a zone it is not in halts at the edge and turns away (roams
  away 3-5 s); one caught inside (a furnace lit, a beacon powered) walks out by the nearest probed direction and does
  nothing else; nobody starts an attack on a player inside a zone, and a melee/slam/zap/dash released at a player who
  stepped into one misses.
- **Daylight**: sunlight >= HOSTILE_WIND_DOWN_SUNLIGHT and open sky over it (checked at each look): natural automatons
  stop (a wind-up is broken off), glow dims over HOSTILE_WIND_DOWN_S, then `dormant` ('hostile:dormant'): no moving,
  attacking or sensing, normal damage; hit -> awake and aware for 30 s of daylight; sunlight < HOSTILE_NIGHT_SUNLIGHT ->
  wake. Under a roof they keep going by day.
- **Ruin guards** (`guards.ts`): when every chunk of a ruin's bounds is loaded (checked on each `chunk:loaded` and in a
  once-a-second sweep of 4 chunks around the player), its plan's wardens stand on the first floor with room at
  floor + 1..4 and the sentry on the first wall cell with a floor at least 2 above the ruin floor (corners first);
  the ruin key goes into `guarded` (saved) whether or not every guard found room, so nothing is ever created twice or
  respawned. Guards are created on Peaceful too (kept in the save, neither simulated, drawn nor hittable) so switching
  to Normal later finds them. Guards ('guard') never wind down, notice the player only within RUIN_GUARD_LEASH + range
  of the ruin centre, and walk home (mode 'return', to half the leash) once beyond the leash. Turrets never wind down;
  by day they watch only the ruin itself (player within RUIN_GUARD_LEASH of the centre), at night their full range.
- **Spawning** (`hostileSpawner.ts`): every HOSTILE_SPAWN_INTERVAL_S below `hostileCap(difficulty)` (living automatons in
  loaded chunks, guards included): a random column 24-40 blocks away, a random floor of it within 24 blocks of the
  player's height (surface, overhangs, caves), which must have a solid non-hazard floor and 2 (then the type's) open
  cells, no open sky by day, estimated block light < HOSTILE_SPAWN_LIGHT (brightest emitter minus Manhattan distance,
  walls ignored - errs on the dark side being safe), not safe, not in view (inside a 75-degree half-angle cone around the
  view yaw with a clear line from the eye). Type by `spawnPlacesAt` + `pickAutomaton` (sky hook for drones,
  maxLoaded for the colossus); group `CreatureSpec.group`, members within 2 blocks under the same rules, clipped to
  the cap. Flyers start HOSTILE_HOVER_MIN up.
- **Despawn** (once a second): natural ones beyond HOSTILE_DESPAWN_DISTANCE (64), dormant ones beyond 48 (frozen ones
  in unloaded chunks too). Guards and turrets never. Lava hurts them like animals (cause world: no drops); below y -8
  they are removed.
- **Peaceful**: `setDifficulty('peaceful')` removes every natural automaton and bolt; nothing spawns or ticks.

## Measured
Node, real terrain (seed 20251121 around spawn): 40 animals + 12 automatons (10 placed + the spawn ruin's 2 guards,
all awake and fighting a player who walks a circle) + 8 bolts: **0.42-0.65 ms per tick** (best of three 200-tick
rounds; the hostile layer alone ~0.15 ms, bolts ~0.001 ms, the ruin sweep ~0.1-0.2 ms once a second). Tested in
`hostileWorld.test.ts` against 0.8 ms.

Headless Chromium (scratch harness: real World + Renderer + MobRenderer, seed 1234567, a flat meadow found near
spawn, 1280x800 and 390x844): a pack of seven types placed 8-15 blocks ahead at night - the warden walks up to the
player and squares up, the colossus closes slowly, the drone hovers and zaps (2, then 2), the hound crouches and its
dash hits (4); with a 6-block safe zone around the player every one stopped 7-12 blocks out and nothing attacked; at
dawn every natural one went dormant while two ruin wardens and a ruin sentry kept watch. Screenshots reviewed (the
models are still drawn without glow or arm animation: render work).

## Deviations from the spec
- Automatons never step into liquid (the edge guard refuses it; ember machines keep out of water). One knocked in
  floats like an animal and steers to the player/shore with its normal stride. "Swim" in 19.2 is not implemented.
- The player is safe from new attacks inside a safe zone (and blows released at a player who just stepped in miss);
  bolts already flying fizzle out when they enter a zone. The spec only says they never enter it.
- Kiln sentries by day watch only their ruin (RUIN_GUARD_LEASH), not their full 16-block range.
- Hit cooldown on automatons stays MOB_HIT_COOLDOWN_S (0.4 s); the maul's 0.5 s is the player's own swing timer
  (src/game), as the combat engineer built it.
- A broken automaton breaks apart at once (drops and events at the killing blow), not after MOB_DEATH_S.
- Spawn light is an estimate from emitters (walls ignored), since baked light lives only in meshes.
- "Not in view" is the horizontal view cone (75 degrees each side) plus a line-of-sight check; pitch is ignored.

## Known gaps
- No path finding (by design: 19.2). Automatons walk around low obstacles only by giving up and roaming.
- Behaviour state (awareness, wind-ups) is not saved; after loading every automaton is awake-unaware or dormant.
- `src/mobs/manager.ts` is ~500 lines and `hostiles.ts` ~380 (over the 350-line aim); `hostileBrain.ts` ~365.
- Render, HUD and audio effects of the events are other modules' work (glow/flare/arm poses, bolts, debris, damage
  direction, off-screen wind-up arrow).
