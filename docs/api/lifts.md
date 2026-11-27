# Bridges, lifts and elevators

Ways across cliffs and down mineshafts, driven by the workshop's shafts (steam engine, beam engine, mill wheel, windmill, wound
clockwork motor, a hand crank while held).

Code: content `src/content/areas/lifts.ts`, textures `src/render/textures/areas/lifts.ts`, cages `src/workshop/lifts.ts`
(`Lifts`, owned by `GameState.lifts`, saved as `lifts`), drawbridges `src/workshop/drawbridge.ts` (`Drawbridges`, owned by
`Workshop.bridges`, saved as `drawbridges`), part list `src/workshop/liftParts.ts`, model `src/render/workshop/liftRenderer.ts`,
ride HUD `src/ui/liftHud.ts`. Tests: `src/workshop/lifts.test.ts`; browser check: `node scripts/e2e-lifts.mjs [--device=desktop]`
(phone portrait by default).

## Blocks and recipes

| block | age | recipe | stress |
|---|---|---|---|
| `lift_winch` Lift Winch | Bronze | Bronze Furnace 600 C: 2 bronze plate, 1 bronze cog, 1 drive shaft, 2 cord, 4 plank | 4 su |
| `elevator_winch` Steam Elevator | Forge | Blast Furnace 1000 C: 4 iron plate, 2 iron axle, 1 bronze cog, 1 lift winch | 8 su |
| `drawbridge` Drawbridge | Bronze | Bronze Furnace 600 C: 2 bronze plate, 1 bronze cog, 1 drive shaft, 6 bridge deck | 4 su |
| `bridge_deck` Bridge Deck | any | by hand: 3 plank, 1 fiber -> 6 | - |

All three machines are kinetic workshop parts (`LIFT_PARTS`): they join shaft networks like any other part and show the
running / jammed / starved faces. The deck is an oriented plank slab.

## Lifts and elevators

- **Where the cage hangs.** A winch stands at the lip of a shaft or a cliff. Its cage hangs in the open column beside it: the
  side away from where you stood to place it first, then the other sides (free at the winch's level and the one below).
- **Travel.** From the winch's own level (the cage floor flush with the ground round the hole) down to the shaft floor, or to
  the end of the rope: lift 40 blocks, elevator 160.
- **Landings.** A level where a cell round the column (diagonals too, never the winch) has a floor and two free cells over it:
  the ground round the top, a tunnel or a ledge off the shaft. The shaft floor is a landing too.
- **Speed.** Lift 2.5 blocks/s at 16 rpm (at most 6, eases at 5 b/s^2); elevator 5 blocks/s at 16 rpm (at most 12, 10 b/s^2).
  A block set into the shaft stops the cage short of it.
- **No power.** The brake holds an empty cage. With a rider between landings it lets them down at 1 block/s to the landing
  below, so nobody is stuck when the engine stops. A toast says the winch is not turning.
- **Controls.** Tap the cage, its rope or the winch: from beside the cage you board and it sets off for the next landing (down
  if there is one, else up); from anywhere else it is called to the landing nearest your feet. Walking into a waiting cage
  boards it without setting off. Riding, the player is carried (look stays free): Up = Jump / W / stick forward, Down =
  Mine / S / stick back, Exit = Use (a stray tap on the world shows a hint instead). The touch Mine / Use / Jump buttons read
  Down / Exit / Up while riding. Exit puts you on the landing cell most in front of you (straight sides first), or on the
  shaft floor; between landings or while moving it refuses with a toast.
- **HUD.** "Lift 6 down - 1 up, 1 down", "no power" when the winch is still, and the keys for the device.
- **Model.** A timber headframe over the shaft top with a sheave that turns with the rope, the rope (chain) to the cage; the lift
  is an open plank platform with rails, the elevator an iron cage with barred sides, a roof and a lamp. Lit like the terrain
  (dark down a mine), probed where the cage is.
- **Goggles.** "Lift Winch - right 24 rpm, load 2.67/48 su, cage 6 down, 3 landings, 12 deep".

## Drawbridges

- While its network turns, a drawbridge runs `bridge_deck` slabs out at its own level across the gap ahead of you as you placed
  it (opposite its front), one every `0.35 x 16 / rpm` s (0.1 to 1.2 s), up to 16 or until a solid block. Air, replaceable
  plants and liquids are laid over; what was there is kept and put back when the deck is lifted (water stays water).
- Use it to set out or in (saved). A signal cell touching it decides instead: lit = out, unlit = in. Still, it holds.
- Lifting takes back only its own planks; one somebody broke or built over stays as it is.

## Saving

`world.persist('lifts')`: `{ v: 1, lifts: [[x, y, z, kind, floor], ...] }` (a cage in motion saves its target). Nobody rides after a
load. `world.persist('drawbridges')`: `{ v: 1, bridges: [{ x, y, z, under: Voxel[], out }] }`. Damaged entries are dropped; a missing
key means none.
