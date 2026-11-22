# The tractor (Current Age)

A drivable farm vehicle with swappable attachments. Same age and reasoning as the chainsaw (docs/api/chainsaw.md): it is a
combustion engine on wheels, fed by Fuel Canisters from the Still; `age: 3`, forged at the Arc Furnace (tier 4, since BRONZE_PLAN W0).

Code: `src/vehicles/` (`tractor.ts` body and physics, `collide.ts` sweeps, `tractorWork.ts` attachments, `manager.ts` controls,
saving and the intent wrapper), `src/render/vehicles/tractorRenderer.ts` (model), `src/ui/vehicleHud.ts` (HUD, touch captions),
`src/audio/sfxVehicle.ts` (`engine`, `engine_start`), `src/content/itemsVehicle.ts`, `src/app/game.ts` (wiring), `src/world/world.ts`
(`persist` / `extra`). Tests: `src/vehicles/*.test.ts`; browser check: `node scripts/e2e-vehicles.mjs` (HW_GPU=1 for the GPU).

## Items and recipes (Arc Furnace)

| item | recipe | note |
|---|---|---|
| `tractor` | 2 chassis, 4 steel plate, 3 copper coil, 1 circuit, 4 iron plate (1400 C) | stack 1; Use on the ground sets it down |
| `tractor_tiller` | 1 chassis, 4 iron plate, 2 steel plate (1200 C) | |
| `tractor_harvester` | 1 chassis, 4 steel plate, 2 copper coil (1300 C) | |

Objective `drive_tractor` ("Take a tractor out", flag `drove_tractor`, age 3).

## Controls

| | desktop | phone |
|---|---|---|
| set down | Use with the Tractor item on the top of a block | tap / Use |
| refuel | Use with a Fuel Canister on it (+150 s, 600 s tank) | same |
| fit an attachment | Use with the attachment item on it (the old one returns to the pack) | same |
| pick up | Shift + Use on it (item and attachment come back) | Place toggle + Use |
| board | Use on it with anything else in hand | tap it |
| drive | W/S throttle, A/D steer | joystick (forward/back = throttle, sideways = steer) |
| **work the attachment** | **F** (hold repeats every 0.4 s), or Mine | **Work** button (the Mine button, recaptioned) |
| swap attachment | R, or Jump | **Swap** (the Jump button) |
| get off | Use | **Exit** (the Use button) |

While driving, the touch Mine / Use / Jump buttons are recaptioned Work / Exit / Swap (`VehicleHud`), so the phone needs no
extra buttons and no new gesture code. Look turns the head (+-130 degrees), not the machine.

## How it plugs in

`wrapIntentSource(inputManager, vehicles)` sits between the input and the PlayerController, so `controller.ts` is untouched.
On foot it consumes a Use that is meant for a tractor (aim ray vs the tractor's box, nearer than any block). Driving, it zeroes
move/look/jump/mine/use/place in the Intent and carries the player: position = the seat, yaw = heading + head turn, velocity 0,
`physics.reset()` every frame (no fall damage from the ride). Death gets the driver off.

## Rules

- Physics (`driveTractor`): speed to 5.5 m/s forward, 2.2 reverse, accel 5, brake 9, drag 2.4; steering 1.35 rad/s at full lock
  (35 % standing still); a 1.6 x 1.6 x 1.5 box swept against voxels, climbs 1-block steps, stops at taller walls, falls with gravity.
  Yaw uses the player's convention (0 faces -Z, positive turns left).
- Fuel: tank 600 tank-seconds; burn 0.2/s idle, +0.8/s at full throttle, +0.6/s while working. Empty: no throttle (coasts to a
  stop), no work, a warning toast; low-fuel toast at 12 %.
- Tiller (`tillSwath`): the swath is 3 blocks wide, from 0.5 behind the middle to 2.5 ahead. Each grass/dirt column whose top is
  tillable (`tillResult`, `canTill` from `src/game/farming.ts`) becomes farmland; tall grass and flowers on it are cleared first
  (their drops spawn as ground items); stone, water and crops are left alone. Emits `flag tilled` and sfx `till`.
- Harvester (`harvestSwath`): every RIPE crop (`isRipeCrop`) in the swath is cut like a hand harvest: its drop table goes to the pack
  (overflow to the ground at the tractor), one seed of the harvest replants stage 0 (the crop block's stage-0 drop is the seed),
  `block:broken` and sfx `harvest` are emitted. Young crops stay. `src/sim/crops.ts` follows the block changes as for hand
  farming (entity created on the replant, removed on the cut), nothing is called directly.
- HUD: fuel gauge, fitted tool, the keys (touch: the recaptioned buttons) above the hotbar while driving; toasts on boarding.
- Sound: `engine_start` on boarding, a chug repeated every 0.42 s idle .. 0.17 s flat out with rising pitch.
- Model: green blocky tractor, cab frame with seat and wheel, exhaust, lamps, big rear and small front wheels that roll and steer,
  a tiller drum and a reaping header with reel that spin while working; lit with the terrain's light ramps and fog (probed light).

## Saving

`World.persist('vehicles', () => manager.toJSON())` stores `{ next, tractors: [{ id, x, y, z, yaw, fuel, attachment }] }` under
`WorldSnapshot.extras.vehicles`; `Game` reads `world.extra('vehicles')` back with `manager.load`. Nobody is driving after a load
(the player stands where they saved); damaged or missing data means no tractors, never a refused world. Tractors only move or
fall while their chunk is loaded.

## API (src/vehicles)

```ts
class VehicleManager { tractors; driving; place(x, y, z, yaw, attachment?, fuel?); aim(...); enter(t); exit(); mount(t, kind);
  refuel(t); pickUp(t); cycleAttachment(); work(); handle(intent, dt): Intent; views(): TractorView[]; status(): DriveStatus | null;
  setWorkKey(down); pressSwapKey(); bindPhysics(p); toJSON(); load(data) }
wrapIntentSource(source, vehicles); driveTractor(world, t, input, dt, working?); tillSwath / harvestSwath / workSwath(ctx, t); swathCells(t)
```
