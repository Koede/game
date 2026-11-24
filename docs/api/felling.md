# Felling trees (axe, falling trunk, fallen log)

A tree you chop down comes down. Axe blows wear its health away at the base; at zero it creaks, then the trunk and crown
topple about the stump under gravity, land, and lie there as a **fallen log** that you cut up one piece per axe cut.
The chainsaw keeps its old instant path (docs/api/chainsaw.md). Plan and owner decisions: `docs/plans/tree-felling.md`.

Code: `src/game/treeBody.ts` (the rigid body, pure), `src/game/treeFell.ts` (rules, pure), `src/game/fallingTrees.ts`
(the world side: chopping, the warning, the fall, the damage sweep, landing), `src/game/fallenLogs.ts` (the saved logs,
cutting, rotting), `src/render/fallingTrees.ts` (drawing both), `src/player/interaction.ts` (`treeChop` hook),
`src/player/controller.ts` (`fallenAim` hook). Tests: `treeBody.test.ts`, `treeFell.test.ts`, `fallingTrees.test.ts`,
`treeDamage.test.ts`, `fallenLogs.test.ts`, `treePolish.test.ts`.

## Chopping the tree

- Only an **axe** (not a chainsaw) fells by hand. A log whose tree has at least `TREE_MIN_TRUNK` (3) logs above its
  base is a tree; anything smaller breaks instantly as before.
- The base is the lowest log of the connected trunk under the crosshair. Health: `treeHealth(trunk) = 4 + trunk`. Each
  blow takes `axePower(tier) = tier + 1`. The axe wears by one per blow (`wearHeld`), and the blow is a `tree_chop` sound.
- At zero health the tree is **warned**: `tree_creak`, a "Timber!" toast, and 0.9 s before it moves.

## The fall

- The direction is the horizontal line from the player through the trunk at the final blow, at any angle
  (`fallDirection`). If the player stands on the trunk, the facing decides.
- The trunk and the crown's leaves leave the world and become one rigid body: a rod hinged at the stump top, one mass
  segment per trunk block, the crown heavier at the top (`rodProfile`). It turns under gravity (`GRAVITY`, the item
  physics constant) from a small tip kick, lets go of the stump when its centre of mass drops below it, falls free, and
  bounces on the ground (restitution 0.2), slides (Coulomb friction 0.6) and rests. Walls stop it and it slides down the
  face. The integration is fixed at 60 Hz (`STEP_S`). It is drawn as one instanced group whose transform is the body's
  pose each frame.
- **The wait rule**: while someone stands in the strike zone (1.1 blocks either side of the fall line) during the first
  0.4 s of the fall, the fall clock holds (`advanceWait`), so the tree waits for them to step out.
- **Damage**: each point of the rod sweeps the world; a creature (the player, an animal) it passes takes one hit,
  `impactDamage(trunk, speed)`: scales with the trunk and with the speed at that point, at least 1, at most 12. Trees
  never damage blocks. The "Tree damage to me" setting (default on) turns the hurt off; the tree still falls.
- **Landing**: the body becomes a fallen log (below); the crown's branch wood (one log per canopy level,
  `CANOPY_LOG_BONUS`) and its leaves drop at the tip; the base becomes a stump block (`oak_stump`, `pine_stump`), which
  is not in the way of the fall and gives a stick or two when chopped. A dust puff and the crash (`tree_fall`) and a
  double buzz on phones mark the landing.
- **Reduce motion** runs the fall at double speed. No camera shake is added.

## The wood

A felled tree gives `woodYield(trunk, canopyLevels) = trunk + canopyLevels` logs: the trunk logs come from the cut pieces
and the canopy levels from the branch wood at landing. Each log gives its normal drops (planks, sticks as today).

## Fallen logs

- A fallen log is a saved entity (`FallenLogs`, saved with the world under `fallenLogs`). Its `length` is the trunk
  blocks left; its pose is the rod's bottom end and angle where the fall ended.
- **Cutting**: aim at it (the look ray meets its axis within 0.5 blocks, `aimFallen`), and mine it with an axe. Each
  completed mining takes one **piece** off the tip: `cutPiece` takes three blocks, the last cut the remainder. The
  piece's logs drop at the tip, and the last cut removes the log. The cut end is drawn rounded (a smaller, paler block).
  A fallen log cannot be used (Use does nothing to it), and without an axe it says so.
- **Auto-buck felled trees** (setting, default off): the log is cut into all its pieces at once on landing.
- **Ageing and rotting**: a log only ages while its chunk is loaded (frozen with its chunk) and while no block entity
  (a machine, a crate) is within 14 blocks. One in-game day (`DAY_LENGTH_S`) of such time and it rots; a toast warns one
  minute before. The tavern is not special-cased, so keep builds away from felled trees if you need them to stay.

## Settings (`src/core/context.ts`, the settings panel)

| Setting | Default | Effect |
|---|---|---|
| `autoBuck` | off | a landed log is cut into pieces at once |
| `treeDamage` | on | a falling tree hurts the player and animals under it |
| `reduceMotion` | from the device | the fall runs at double speed |
| `haptics` | on | the landing is a double buzz on phones |

## Not done

- Saplings: there is no sapling item yet, so a stump cannot be replanted, and stumps do not sprout in forests.
- Fallen logs do not hurt creatures that walk into them; only the falling tree does damage.
- NPCs are not hit by a falling tree (only the player and animals).
- The tavern is not protected from rotting logs by name (only by block entities within 14 blocks).
