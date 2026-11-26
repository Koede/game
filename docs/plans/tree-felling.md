# Tree felling, Valheim style

## Goal

A tree you chop down should come down: it tips over, crashes to the ground, can hurt what is under it, and lies there as a log you cut into
pieces. Cutting trees becomes a small physical event instead of a block that vanishes.

## Is it fun? (honest take)

Yes for the fall, risky for the aftermath.
- **Fun:** the creak, the warning shout, choosing which way it falls, the crash, a mob flattened. Dropping a tree on a pig is a story.
- **Tedious if careless:** a log you must hack into ten pieces by hand, every tree, every time. Valheim gets away with it because the
  pieces are big and the wood is the whole economy; on a phone, repeated taps feel like a chore fast.
- So: make the fall the star, make cutting the log up quick (few taps, big pieces, satisfying chunks), and keep a "quick" option.

## What exists

- `src/game/felling.ts`: the chainsaw fells the connected trunk (up to `maxLogs`) and everything drops at once.
- Leaves decay (`leafDrops.ts`), trees are generated as log and leaf blocks (`oak_log`, `pine_log`, hardness 2, tool axe).
- Ground items (physics at 20 Hz, now drawn eased) and the drop/pickup rules; mobs and the player can take damage from attacks.

## Design

### 1. The trunk tips over (the big moment)
- Chopping the base of a tree with an axe wears a "tree health" (more hits for thicker or taller trees). At zero the tree begins to fall in
  the direction you were facing when you struck the last blow (or away from you).
- The trunk and canopy above the cut become one **falling tree**: a rigid group of the existing log and leaf voxels, rotating about a hinge
  at the stump over about 1.2 seconds with a creak and a shout cue, then slamming down. Rendering uses a dedicated instanced group (the
  voxel blocks removed from the world at the start, drawn as a rotating mesh), not world blocks.
- **Warning:** a short creak and a leaf shake just before it goes, plus a faint ground marker in the fall direction on phones.
- **Landing:** it comes to rest along the ground in the fall direction, stopped early by walls, other trees or steep terrain.

### 2. It can hurt
- While falling, the swept volume damages entities it touches (the player, mobs, animals, NPCs): damage scales with the tree's size and
  fall speed near the end; a small tree stuns, a big one kills a pig. It never damages blocks (no flattening your house); it just lands on
  them and rests.
- The player's own safety: the tree never starts to fall onto a spot the player stands within the first 0.4 seconds (it waits), and there is
  a setting "tree damage to me" (on by default, off for a relaxed mode).

### 3. Logs you cut into pieces
- The landed tree becomes a **fallen log**: a long entity (not blocks), with a piece count by trunk length.
- Cut it with an axe: each hit slices off one piece, which pops out as normal log items (and sticks/leaves from the canopy as small drops).
  The big pieces are fast to cut (1 or 2 hits each); an axe with Bounty or a saw makes it quicker.
- The chainsaw fells and **bucks the whole log in one pass** (its Current Age payoff), keeping the old instant behaviour.
- Leaves: the canopy bits drop leaves, sticks and sometimes apples/seeds when the tree lands; the rest decays as today.

### 4. Stumps and regrowth
- A stump block stays (breakable with a shovel/axe for a stick), and a sapling can be replanted; stumps can slowly sprout in a forest biome.

### 5. Edge cases
- Chunks unload while a tree is falling or a log lies there: logs are saved as entities and wait frozen until the chunk is back.
- A fallen log lies for a long time before despawning (a day), and warns before it goes; it never despawns inside a tavern or near the
  player's builds.
- Trees with several trunks or odd shapes: use the connected log mass above the cut and fall as one group.
- Performance: only one or two falling trees at a time; logs are a handful of entities; the falling group is one instanced draw.

## Phases (each shippable on its own)

1. **The fall:** tree health on the axe, the falling-tree group animation with creak and landing, then it simply turns into the same drops as
   today (so nothing new to chop yet). Plus the tests for hinge motion and landing.
2. **The fallen log as an entity:** replaces the instant drops: lies on the ground, saved/loaded, cut into pieces with an axe.
3. **Damage and safety:** swept-volume damage, the wait-if-player-is-under rule, the setting.
4. **Canopy drops and stumps:** leaves, sticks, apples, sapling replanting, stump block.
5. **Polish:** sounds, dust at landing, camera shake-free impact cue, quick-mode setting and haptics.

## Tests

Pure motion (hinge angle over time, landing distance by height); the sweep hit test (player inside the swept volume takes damage, outside
does not; waits when the player stands under it); log piece counting and cutting; save/load of a fallen log across chunk unload;
chainsaw still fells in one pass; e2e: chop a tree down, watch it land, cut the log, pick up the pieces.

## Risks

- Real physics is unnecessary: a scripted hinge fall with simple collision gets 95% of the feel at a fraction of the cost and risk.
- Voxel-to-entity conversion of a whole tree (hundreds of blocks) must be fast: group them into a few instanced meshes by block kind.
- Griefing yourself: keep the no-block-damage rule and the safety wait; offer the relaxed setting.
- Tedium: big pieces, few hits, a quick mode that bucks the log instantly on landing, and the chainsaw as the late-game skip.

## Open questions

1. Should the tree fall toward where you stand when you finish it (more dangerous, more fun), or away (safer)? My vote: away by default,
   with a shout so you can steer it by the side you hit from.
2. Damage to the player on by default? (I'd say yes, but light, and off in a relaxed mode.)
3. Do you want the quick mode (auto-buck on landing) at launch or only the chainsaw?

## Shipped

All five phases are in (commits 4527147 to ee9110a). The behaviour and the numbers are in `docs/api/felling.md`.

- Phase 1, the fall: axe health on the base, a warning, then a rigid body that pivots on the stump, falls under gravity,
  bounces and rests. Changed to this from the scripted hinge, at the owner's request.
- Phase 2, the fallen log: a saved entity, cut one piece per axe cut, rotting after a day of loaded time.
- Phase 3, damage: a sweep along the moving body, the 0.4 s wait rule, and the "Tree damage to me" setting.
- Phase 4, canopy and stumps: branch wood and leaves on landing, a stump block left behind. Saplings (R7): leaves and
  fallen-log cuts drop them, a planted one grows into a tree, and some stumps sprout one after three days
  (docs/api/felling.md "Saplings and regrowth"). Stumps sprout in any biome, not only forests.
- Phase 5, polish: creak, chop and crash sounds, landing dust, a double buzz on phones, reduce motion (double speed).
- Also: Auto-buck (default off) and the wood yield (trunk logs plus a bonus per canopy level).
