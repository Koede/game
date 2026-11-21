# The Emberbound - data, contracts, art and sounds (spec 19)

War-forged, ember-fueled automatons left over from the age when the Old Works were lit. This pass lays down **every
contract, every number, the six models, the items, recipes, objectives, icons, the ward beacon's faces and eight sounds**.
**No behaviour yet**: nothing spawns, walks, attacks, burns, wards or wears armour against a blow. Section 7 says exactly
what each next engineer builds on it. Everything is green: `npm run typecheck`, `npm test` (115 files, 1350 tests) and
`npm run build`.

## 1. Core contracts (appended; nothing renamed or removed)

### src/core/types.ts
```ts
type ToolKind = 'pickaxe' | 'axe' | 'shovel' | 'hoe' | 'maul';   // a maul counts as bare hands for mining (no block names it)
interface WeaponSpec { damage: number; stunS?: number }            // ItemSpec.weapon: hit damage on any creature; arc maul stuns
interface ArmourSpec { reduction: number; warmthDrainMult?: number } // ItemSpec.armour: worn from the inventory, best of each counts
interface ItemSpec { ...; weapon?: WeaponSpec; armour?: ArmourSpec }

type CreatureAnim = ... | 'legML' | 'legMR' | 'armL' | 'armR';
interface CreaturePart { ...; emissive?: boolean }                 // ember part: full-bright, flares in a wind-up, dark when dormant
interface CreatureSpec { ...; hostile?: HostileSpec }

type HostileAttack = 'melee' | 'dash' | 'bolt' | 'zap' | 'slam';
type SpawnPlace = 'cave' | 'deep' | 'surface' | 'scar' | 'scar_night' | 'peak';
interface HostileHabitat {
  places: Partial<Record<SpawnPlace, number>>;   // spawn weight per place; a spot's weight = the largest of its matched places
  sky?: 'storm_or_moonless';                     // drones: only in a storm or on a (nearly) new moon
  ruin?: 'guard' | 'turret';                     // placed with Old Works ruins by src/world, persistent
  maxLoaded?: number;                            // the colossus: 1
}
interface HostileSpec {
  attack: HostileAttack; damage: number; windupS: number;
  cooldownS: number;      // the attack PERIOD: wind-up start to next wind-up start (> windupS)
  range: number;          // melee/zap reach, bolt range, dash trigger distance, slam radius
  senseRange: number;     // notices the player with line of sight (HOSTILE_SENSE_BLIND without)
  flying?: boolean; stationary?: boolean; shieldFront?: number; knockback?: number;
  burn?: { seconds: number; perS: number };  // bolt only
  wetMult?: number;                          // zap only
  projectileSpeed?: number;                  // bolt only
  dashSpeed?: number;                        // dash only
  habitat: HostileHabitat;
}
type ProjectileKind = 'ember_bolt';
```
The full semantics of each attack, each spawn place and each field are in the doc comments above the types (they are
the contract). In short - **every attack is judged when its wind-up ENDS, against where the player is then**: melee hits
within `range` and a 90-degree front arc; a dash charges at `dashSpeed` towards where the player stood, HOSTILE_DASH_OVERRUN
blocks past it or into a wall, hitting once on contact; a bolt is lobbed at `projectileSpeed` under EMBER_BOLT_GRAVITY,
hits the first solid block or the player, never breaks blocks; a zap hits within `range` with line of sight (x `wetMult`
in water); a slam hits everything within `range`.

**Model conventions** (as the animals', plus): automatons may be bipeds (legFL/legFR), quadrupeds, hexapods (legFL/FR,
legML/MR, legBL/BR), stationary (no animated legs; the sentry's tripod is rigid) or flying (no legs at all; y = 0 is the
bottom of the body - the AI holds it HOSTILE_HOVER_MIN..MAX above the ground). Arms pivot at the shoulder about X: hang
still while walking, RISE through a wind-up (warden's hammer arm `armR`, both of the colossus's). `head` is what aims
(the sentry's whole kiln, the drone's coil). `src/render/mobs/geometry.ts` `PART_GROUP` maps legML with FR/BL, legMR
with FL/BR, and arms to group 0 (rigid) for now.

### src/core/gameEvents.ts
- `DamageCause += 'automaton' | 'ember'` - an automaton's blow or bolt; the burning a bolt leaves.
- `SfxName += automaton_step | automaton_wake | automaton_windup | automaton_attack | ember_bolt | arc_zap | automaton_hurt | automaton_break`
- Events (automatons also use the animals' `mob:spawned` / `mob:hurt` / `mob:died`):
```ts
'hostile:woke':     { id, species, x, y, z }                       // noticed the player / hit while dormant / night fell
'hostile:dormant':  { id, species, x, y, z }                       // wound down in daylight
'hostile:windup':   { id, species, attack, x, y, z, durationS }    // telegraph starts (flare, sfx, HUD edge arrow)
'hostile:attack':   { id, species, attack, x, y, z }               // released: blow swings, bolt leaves, dash starts, zap arcs
'player:attacked':  { species, attack, amount, x, y, z }           // just before PlayerState.damage(amount, 'automaton');
                                                                   // amount after difficulty, before armour; x,y,z = source
'projectile:fired': { id, kind, species, from, x, y, z, vx, vy, vz }
'projectile:hit':   { id, kind, species, from, x, y, z, target: 'player' | 'block' | 'expired' }
'automaton:salvaged': { id, species, x, y, z, drops: ItemAmount[] }  // player broke it apart; emit with 'mob:died' and
                                                                     // 'flag' FLAG_AUTOMATON_SALVAGED
```

### src/core/context.ts
```ts
interface Settings { ...; difficulty: Difficulty; uiScale: 'normal' | 'large' }   // defaults 'normal', 'normal'
type Difficulty = 'peaceful' | 'normal' | 'hard';  const DIFFICULTIES: readonly Difficulty[];
```
`sanitizeSettings` (src/save/document.ts) reads both and gives settings saved before them the defaults (tested).

### src/core/constants.ts (appended)
| constant | value | meaning |
|---|---|---|
| `HOSTILE_CAP` | peaceful 0, normal 10, hard 15 | hostiles loaded at once (ruin guards count) |
| `HOSTILE_DAMAGE_MULT` | peaceful 0, normal 1, hard 1.25 | on every automaton's damage |
| `HOSTILE_SPAWN_INTERVAL_S` | 2 | one spawn try per interval while under the cap |
| `HOSTILE_SPAWN_MIN_DISTANCE`, `_MAX_DISTANCE` | 24, 40 | horizontal distance of candidate spots, never in view |
| `HOSTILE_SPAWN_LIGHT` | 7 | block light >= this prevents a spawn (torches, lamps, a lit ward beacon) |
| `HOSTILE_NIGHT_SUNLIGHT` | 0.2 | clock sunlight below this = night (spawner; dormant ones wake) |
| `HOSTILE_WIND_DOWN_SUNLIGHT`, `HOSTILE_WIND_DOWN_S` | 0.5, 2 | dawn: open-sky automatons go dormant over 2 s |
| `HOSTILE_DESPAWN_DISTANCE` | 64 | removed beyond (never ruin guards) |
| `HOSTILE_DORMANT_DESPAWN_DISTANCE` | 48 | dormant ones removed beyond |
| `HOSTILE_WARM_ZONE_MIN_C` | = FURNACE_HOT_C (200) | a furnace this hot keeps hostiles out of its warmth radius (block `warmthActive`) |
| `WARD_BEACON_RADIUS` | 32 | also the ward beacon's machine param `radius` (one source) |
| `HOSTILE_SENSE_BLIND`, `HOSTILE_FORGET_S`, `HOSTILE_GIVE_UP_S` | 6, 10, 4 | senses and steering (spec 19.2) |
| `HOSTILE_HOVER_MIN`, `_MAX` | 2, 4 | drones above ground |
| `HOSTILE_DEEP_Y`, `HOSTILE_PEAK_Y` | 20, 48 | place tests ('deep' below, 'peak' at or above: top ~5% of land, measured over 3 seeds) |
| `HOSTILE_MOONLESS_MAX_ILLUMINATION` | 0.15 | moon phases 7, 0, 1 count as moonless |
| `HOSTILE_DASH_OVERRUN` | 2 | blocks a dash runs past the player's spot |
| `EMBER_BOLT_GRAVITY`, `_RADIUS`, `_MAX_S` | 12, 0.2, 4 | bolt physics |
| `RUIN_WARDENS`, `RUIN_SENTRY_CHANCE`, `RUIN_GUARD_LEASH` | [1, 2], 0.5, 12 | ruin guards (spec 19.3) |
| `WEAPON_HIT_COOLDOWN_S` | 0.5 | between hits with a weapon (tools/hands keep MOB_HIT_COOLDOWN_S 0.4) |
| `ARMOUR_CAUSES` | ['automaton'] | causes armour softens (blows and bolt impacts; not burning, cold, falls) |
| `FLAG_AUTOMATON_SALVAGED`, `FLAG_PEACEFUL` | 'automaton_salvaged', 'peaceful' | objective flags (section 4) |

### src/core/registry.ts
```ts
const AUTOMATONS: readonly CreatureSpec[];   // the six, authored order; NOT in CREATURES (the animal spawner reads that)
creature(key) / creatureOrNull(key)           // now find animals AND automatons
```
`validateContent()` also runs `validateAutomaton` and `validateGear` (src/core/hostileValidation.ts, exported for tests):
hostile spec present, likes empty, speed 0 exactly when stationary, not both flying and stationary, damage/windup/range
> 0, cooldownS > windupS, senseRange >= range, attack-only fields on the right attack, bolts that can reach their range
(v^2/g >= range), dash faster than walking, known spawn places, a place weight or a ruin role, stationary types never
spawned in the open; models: walkers have legFL+legFR and paired back/middle legs, flyers and stationary types no walking
legs, a head, at least one emissive part, something at y = 0, height 75-120% of the box. Gear: weapons have damage > 0
and a ToolSpec (durability), mauls have a weapon and speed 1, armour reduction in [0, 1), warmth multiplier in (0, 1],
armour that does something, stack 1. CREATURES may not contain a hostile.

### src/core/hostile.ts (new, pure lookups for the next engineers; tests in hostile.test.ts)
```ts
spawnPlacesAt(f: { skyOpen, y, night, biome }): SpawnPlace[]       // every place a candidate spot matches
placeWeight(spec, places): number                                   // the type's largest weight among them
isMoonless(moonPhase): boolean                                      // phases 7, 0, 1
skyAllows(habitat, { storm, moonPhase }): boolean
pickAutomaton(places, sky, loadedOf: (key) => number, random): CreatureSpec | null   // weighted, honours maxLoaded
hostileCap(d: Difficulty): number;  hostileDamage(spec, d): number
bestArmour(slots: Iterable<{ item } | null>): { reduction, warmthDrainMult }       // 0 / 1 without armour
armouredDamage(amount, cause, worn): number                         // reduced only for ARMOUR_CAUSES
```

## 2. The six automatons (src/content/automatons.ts, read as registry `AUTOMATONS`)
| key | name | hp | speed | box w x h | attack | dmg | wind-up | period | range | extras | group | drops |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| cinder_mite | Cinder Mite | 4 | 3.2 | 0.8 x 0.45 | melee (bite) | 1 | 0.3 | 0.8 | 1.4 | - | 2-4 | scrap_metal 1 @50% |
| forge_warden | Forge Warden | 16 | 2.4 | 0.9 x 2.1 | melee (hammer) | 3 | 0.5 | 1.6 | 2 | shieldFront 0.5 | 1 | scrap 1-3, copper_coil 10%, circuit 4% |
| kiln_sentry | Kiln Sentry | 12 | 0 | 1.0 x 1.3 | bolt | 2 | 0.7 | 3 | 16 | stationary, burn 2 s x 1/s, 14 b/s | 1 | ember_core 1, scrap 1-2 |
| bellows_hound | Bellows Hound | 10 | 4.5 | 0.8 x 1.0 | dash | 4 | 0.8 | 3 | 8 | dashSpeed 12, knockback 8 | 1-2 | scrap 1-2, ember_core 25% |
| arc_drone | Arc Drone | 8 | 3 | 0.8 x 0.8 | zap | 2 | 0.6 | 2.5 | 8 | flying, wetMult 2 | 1 | scrap 1, copper_wire 2 @20%, silicon_wafer 8% |
| slag_colossus | Slag Colossus | 60 | 1.6 | 1.6 x 2.7 | slam | 6 | 1.2 | 4 | 3 | knockback 10 | 1 | superalloy 1, ember_core 3, magnet_ring 30%, scrap 4-8 |
All senseRange 16, biomes all five, likes []. Habitats (`places` weights): mite cave 6, deep 4, surface 4, scar 4;
warden surface 1 + `ruin: 'guard'`; sentry none + `ruin: 'turret'`; hound surface 2, scar 4; drone peak 3 +
`sky: 'storm_or_moonless'`; colossus deep 1, scar_night 1, `maxLoaded: 1`. So: a cave by day gives mites; the deep gives
mites or (1 in 5) the colossus; a night surface mites, hounds, the odd warden; a dark scar cave by day mites and hounds;
peaks at night drones, only in storms or on moonless nights (tested in src/content/emberbound.test.ts).

**Models** (1/16 block, facing north; `emissive` parts in brackets; checked in a three.js preview by day and night,
front, side and back, 1280x800 and 390x844):
- **Cinder Mite**: flat soot carapace on six splayed legs (thigh + shin, hexapod gait groups), rust-rimmed [back vent]
  on top, small head with [two eyes] and bronze mandibles. Low and wide.
- **Forge Warden**: upright soldier taller than the player, bronze torso and chest plate with [chest vent], helmet with
  a rust crest and a [visor slit]; `armL` carries a tall bronze shield with a boss across the left front; `armR` a haft
  and an iron hammer head with a [glowing striking face].
- **Kiln Sentry**: a squat rust-brick kiln on a three-legged iron tripod and base plate; the kiln (`head`) has a framed
  [mouth], [side vents] and a chimney with a [glowing top].
- **Bellows Hound**: long low quadruped; a [glowing bellows core] inside five dark ribs (the glow shows between them from
  the side), chest and haunch plates, rust spine, exhaust tail with a [glowing tip], long head with [eyes] and a [maw]
  that face forward, ear vents.
- **Arc Drone**: hovering iron drum with a copper band, side and back fins, [front lens], [thruster] glow underneath, a
  copper coil with windings (`head`) topped by a blue-white [spark].
- **Slag Colossus**: 2.6 blocks tall, slag torso with dark chest plates around a [molten core], [seams], [back vents], a
  hump, small sunken head with [eyes]; long arms (`armL`/`armR`) with shoulder pads and fists with [glowing knuckles].
Descriptions (CreatureSpec.desc) carry the lore and a fighting hint each.

## 3. Items, block, machine, recipes (src/content/emberbound.ts, recipes.ts)
| item | category | stack | numbers |
|---|---|---|---|
| `scrap_metal` Scrap Metal | material | 99 | smelts into iron_ingot |
| `ember_core` Ember Core | fuel | 16 | FuelSpec 3 MJ, 120 s, 1700 C (hottest early fuel; the burner generator takes it too) |
| `bronze_maul` / `iron_maul` / `steel_maul` / `arc_maul` | tool | 1 | `tool: { kind: 'maul', tier 2/3/4/4, speed 1, durability 192/384/768/1200 }`, `weapon.damage` 5/7/9/12, arc `stunS 1` |
| `plated_coat` Plated Coat | misc | 1 | `armour { reduction 0.25, warmthDrainMult 0.5 }` |
| `steel_cuirass` Steel Cuirass | misc | 1 | `armour { reduction 0.4, warmthDrainMult 0.5 }` |
| `padded_coat` (existing) | misc | 1 | now `armour { reduction 0, warmthDrainMult 0.5 }` |
Block `ward_beacon` (appended last, id after power_port): machine `ward_beacon`, power device, pickaxe, hardness 2, stack
16, not oriented, `lightActive 10` (>= HOSTILE_SPAWN_LIGHT: a lit beacon also keeps spawns off its own spot), textures
side `ward_beacon_side`/`_on`, top `ward_beacon_top`/`_on`, bottom `machine_top`. Machine `ward_beacon`: role consumer,
drawW 500, params `{ radius: WARD_BEACON_RADIUS }`.

Recipes (135 now; furnace share 74%):
- smelt `iron_ingot_scrap`: iron_ingot <- 1 scrap_metal, 1150 C, 10 s, T2 (after `bread` in the crucible list)
- forge T1 `bronze_maul` <- 4 bronze_ingot, 2 stick, 700 C (after `wrench`)
- forge T2 `iron_maul` <- 4 iron_ingot, 2 stick, 1100 | `steel_maul` <- 4 steel_ingot, 2 stick, 1400 | `plated_coat` <- 6 iron_plate,
  1 padded_coat, 1100 | `steel_cuirass` <- 6 steel_plate, 1 padded_coat, 1400 (after `boiler`)
- forge T3 `arc_maul` <- 2 steel_plate, 1 copper_coil, 1 ember_core, 1 battery, 1800 | `ward_beacon` <- 2 ember_core, 1 circuit,
  2 steel_plate, 1 glass, 1500 (after `steam_turbine`)

## 4. Objectives (47 now)
- `forge_maul` "Forge a maul" (make bronze_maul), right after `make_bronze`.
- `salvage_automaton` "Salvage an automaton": `any(flag 'automaton_salvaged', flag 'peaceful')`, right after `bronze_pickaxe`.
- `ward_base` "Ward your base": `any(place ward_beacon, flag 'peaceful')`, right after `make_circuits` (Current Age).
- `reach_1900` text: ember cores under a strong draft reach 1950 C, so "No fuel burns this hot" became "Only ember cores
  under a strong draft burn this hot".
**Flags the game must emit**: `FLAG_AUTOMATON_SALVAGED` ('automaton_salvaged') whenever the player breaks an automaton
apart; `FLAG_PEACEFUL` ('peaceful') whenever a session runs on Peaceful (at start and when the setting changes to it) -
it completes both objectives so Peaceful never stalls the tracker. Once complete they stay complete.

## 5. Progression solver (src/content/progression.ts)
- `solve(maxTier, missing?, options?: { peaceful?: boolean })`; `Progress.hostiles: boolean`.
- On Normal the drops an automaton ALWAYS carries count from the start (source `automaton:<species>`): scrap_metal (warden,
  hound, drone, colossus) and ember_core (sentry, colossus). Chance drops and relics are luck the tree never waits on.
  `isRelic(drop)` = item of a later age than the Ember Age; `AUTOMATON_RELICS` = copper_coil, circuit, silicon_wafer,
  superalloy, magnet_ring (spec 19.4's list, tested).
- Flags: `automaton_salvaged` needs hostiles, `peaceful` needs none.
- Tests: src/content/emberbound.test.ts (15): roster of 19.1, telegraphs (>= 0.3 s, heavier = longer), silhouettes
  (mite low with six legs, warden upright with shield and hammer arms, tripod, long hound with five ribs, legless drone,
  biggest colossus, emissive parts), spawn places per type, drones and the sky, ruin roles and the colossus cap, difficulty
  numbers, mauls/armour/ember core/scrap/ward beacon, objective positions, scrap and cores from the first night, relics
  never from the start, and **Peaceful can be finished** (every objective in order; only arc_maul, iron_ingot_scrap and
  ward_beacon are out of reach). Fixture: src/content/specRosterEmber.ts (merged into specRoster.ts). The main
  content tests still prove every recipe/objective/age with the automatons in.

## 6. Textures and sounds
- **Textures** (src/render/textures/ember.ts; 264 in TEXTURE_NAMES, cap in the content test raised to 320 because the
  atlas splits past the device limit): `item_scrap_metal` (a rust plate with a rivet row, a broken cog, a bolt),
  `item_ember_core` (dark cracked orb, white-hot heart, fire seams, sparks), `item_bronze_maul` / `item_iron_maul` /
  `item_steel_maul` (leather-gripped haft, heavy square head across it - never reads as a pickaxe or axe), `item_arc_maul`
  (dark arc-steel head with an ember core and an arc spark), `item_plated_coat` (the padded coat with riveted iron plates),
  `item_steel_cuirass` (steel breastplate with ridge, lames and padded lining), `ward_beacon_side` / `_on` (caged glass
  column in an old bronze frame with two ember cores - dull coals idle, white-hot lit - copper traces and the power pip),
  `ward_beacon_top` / `_on` (round lens in a bolted collar; lit it burns gold with a bright ring). Reviewed at 10x on dark
  and sky backgrounds beside existing icons, iterated (scrap and cuirass redrawn, beacon cores made readable).
- **Sounds** (src/audio/sfxEmber.ts; 58 patches). Measured in headless Chromium (OfflineAudioContext; loudest 50 ms
  window, full band / phone band 350 Hz-6 kHz, dB):

| sfx | length | full | phone band | role |
|---|---|---|---|---|
| automaton_step | 0.11 s | -26.1 | -29.4 | heavy thud + plate clank, jittered (player step -35) |
| automaton_wake | 0.80 s | -21.2 | -22.8 | gear whirr rising through a filter, ember hiss, a ping |
| automaton_windup | 0.60 s | -16.7 | **-15.8** | the telegraph: bellows inhale + rising hiss + rising whine, swelling to 0.5 s; priority 1; the loudest cue in the phone band of all game sounds measured |
| automaton_attack | 0.36 s | -14.5 | -17.3 | iron thump under a ringing clang, priority 1 |
| ember_bolt | 0.39 s | -19.3 | -22.9 | throaty cough + rising whoosh + crackle |
| arc_zap | 0.22 s | -18.5 | -21.4 | crack, falling whine, angry buzz, second snap |
| automaton_hurt | 0.24 s | -21.1 | -20.4 | clang on plate (player hurt -20.0, dig_metal -22.8) |
| automaton_break | 0.62 s | -13.0 | -17.1 | crash of plates, clang, sub thump, four scrap tinkles, priority 1 (explosion -8.1) |
Measured, not heard by human ears.

## 7. What the next engineers build on this
- **src/mobs - AI and combat** (same manager as the animals; keep a separate hostile list or tag mobs):
  spawning per 19.3 with `spawnPlacesAt` + `pickAutomaton` every HOSTILE_SPAWN_INTERVAL_S below `hostileCap(difficulty)`
  (24-40 blocks, block light < HOSTILE_SPAWN_LIGHT, never sunlit, not in a warm zone, not within WARD_BEACON_RADIUS of an
  ACTIVE ward beacon, not in view); groups from `CreatureSpec.group`; despawn rules; senses; steering with the animal
  physics (flyers hover, stationary ones only turn); warm zones and ward radii avoided; daylight wind-down + `hostile:dormant`
  / `hostile:woke`; the attack state machine per `HostileAttack` (wind-up -> release -> judge) emitting `hostile:windup`,
  `hostile:attack`, `player:attacked` then `PlayerState.damage(hostileDamage x armour, 'automaton')`, knockback, burning
  ticks with cause 'ember', projectiles (`projectile:*`), shield arc, stun; player hits through the existing `hit()` path
  (hitDamage now returns `weapon.damage` for a held weapon - the only change made in src/mobs - but the weapon cooldown
  WEAPON_HIT_COOLDOWN_S and the stun are yours); on a player kill: drops (rollDrops), `automaton:salvaged`, `mob:died`,
  flag FLAG_AUTOMATON_SALVAGED, sfx automaton_break. Sounds: `automaton_step` per footfall (pitch ~0.7 colossus, ~1.4 mite),
  `automaton_wake`, `automaton_windup` - start it `max(0, windupS - 0.5)` s into the wind-up so its swell peaks at the
  release (pitch ~1.3 for the mite, ~0.75 for the colossus), `automaton_attack` / `ember_bolt` / `arc_zap` at release,
  `automaton_hurt` on hits. The species call `callOf` (sfx = species key) must not run for automatons - their keys are not
  SfxNames. On Peaceful: no spawning, existing natural hostiles removed, ruin guards kept in the save but not simulated.
  `__hw.spawnMob('forge_warden')` (src/app/debug.ts) already works through `creature()`, but until then it adds a passive mob.
- **src/world - ruin guards**: when a ruin's chunk first loads (like its crate), `RUIN_WARDENS` forge wardens inside it and,
  on `RUIN_SENTRY_CHANCE` of ruins (seeded), one kiln sentry on top of a wall; hand them to the mob manager (an event or a
  pending list on `World`), saved, never respawned; each remembers its ruin centre for RUIN_GUARD_LEASH.
- **src/game**: difficulty in the session (Settings.difficulty, emit FLAG_PEACEFUL), armour on damage (`bestArmour` +
  `armouredDamage` in PlayerState.damage or Survival), the burning state (ember), "wear by 1" for weapons (exists:
  `wearHeldTool(1)`), remembering the last `player:attacked` species for the death screen. **Done here already**:
  Survival's coat warmth now reads `bestArmour(inventory).warmthDrainMult`, so the plated coat and the cuirass keep the
  padded coat's warmth (COAT_DRAIN_FACTOR was removed; the padded coat's 0.5 is data).
- **src/sim - ward beacon**: a consumer behaviour (like `simpleConsumer`: draw 500 W, active while powered) - today it is
  inert (no draw, never active). Expose active beacons (positions) to the mob manager. Ember cores already burn in the
  furnace and the burner generator.
- **src/render**: emissive parts in the mob shader (full-bright, flare through `hostile:windup`, dark when dormant/dead);
  arm wind-up and slam animation (armL/armR about the shoulder pivot); hover bob for flyers; sentry/drone `head` aiming;
  spark/smoke emitter per active automaton; break-apart debris (`automaton:salvaged`); ember bolts with trails
  (`projectile:fired/hit`); arc zap bolt. The animal draw path already accepts these specs (preview: rigid arms, emissive
  parts drawn like ordinary colours).
- **src/ui**: target name + health for hostiles (mobs.describe), directional damage pulse (`player:attacked` x,z), off-screen
  wind-up edge arrow (`hostile:windup`), death screen naming the species ("Felled by a Forge Warden") - the two generic
  CAUSES lines added in deathScreen.ts are placeholders; Settings: Difficulty (also a New World option) and UI size
  (`uiScale`, review ui-10: larger touch captions and hotbar); "+N damage" / armour lines on item cards.
- **src/player and src/app**: Mine on a hostile = the animal path with the weapon cooldown; wire difficulty into the mob
  manager and the game; save hostiles with the mobs; the playthrough's stand-ins (src/sim/playthrough.test.ts emits
  FLAG_AUTOMATON_SALVAGED and `find`s 3 scrap + 2 ember cores) should be replaced once salvage is real.

## Deviations and decisions
- Weapons: a tool kind `'maul'` (durability, stack 1, hotbar, wear plumbing all work unchanged; like the hoe it never
  matches a block, so it mines like a hand) plus `ItemSpec.weapon` for combat numbers. Tool tiers of mauls are by metal
  (2/3/4/4) and have no mining meaning. Arc maul durability 1200 (the spec gives none).
- Armour: `ItemSpec.armour`; the padded coat got one too (warmth only), and both new armours keep the coat's warmth (the
  spec says so for the plated coat; the cuirass is also built on a padded coat). Armour softens 'automaton' damage only.
- `ward_base` sits after `make_circuits`, not directly after `arc_furnace`: the beacon needs a circuit, and the tests
  forbid an objective consuming what a later objective first teaches.
- Automatons live in `AUTOMATONS`, not `CREATURES`, so the animal spawner (which reads CREATURES) is untouched.
- Spec numbers the table leaves open, chosen here: mite wind-up 0.3 s; warden period 1.6 s, reach 2; sentry bolt speed 14;
  hound period 3, dash trigger 8 blocks, dash speed 12, knockback 8; drone period 2.5; colossus period 4, knockback 10;
  box sizes; group sizes ("groups of 2-4", "alone or in pairs", else 1). "scrap_metal 0-1" is 1 at 50%.
- Peaceful: `HOSTILE_DAMAGE_MULT.peaceful` is 0 (nothing should exist to use it).
- `HOSTILE_DEEP_Y` 20 is the spec's; `HOSTILE_PEAK_Y` 48 and the moonless threshold are mine.

## Known gaps
- No behaviour (by design). Until src/sim adds it the ward beacon draws nothing and never lights.
- Sounds measured, not listened to; the wind-up is one 0.6 s patch for wind-ups of 0.3-1.2 s (see the timing advice).
- Models judged in a three.js preview (lambert + full-bright ember parts) at 1280x800 and 390x844 by day and night, not in
  the game's mob shader (which does not yet know `emissive` or arm groups).
- `src/content/progression.ts` is ~390 lines, over the 350-line aim.
