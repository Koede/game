/**
 * Stand-in for the screen request C7 adds to `ScreenRequest` in `src/core/gameEvents.ts`:
 * `{ type: 'distill_rig', x, y, z }`.
 *
 * This folder does not edit `gameEvents.ts`. S10 registers `createRigScreen` for that type later.
 * S5 emits `ui:open` when a wrench is used on a chemistry block. An empty hand keeps the crosshair
 * toast and does not open this screen.
 */
export interface DistillRigRequest {
  type: 'distill_rig';
  x: number;
  y: number;
  z: number;
}
