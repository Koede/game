/**
 * C7's distillery rig screen on `ui:open`: `{ type: 'distill_rig', x, y, z }` from `ScreenRequest`
 * in `src/core/gameEvents.ts`. S10 registers `createRigScreen` for it. S5 emits the event when a wrench
 * is used on a chemistry block. An empty hand keeps the crosshair toast and does not open this screen.
 */
import type { ScreenRequest } from '../../../core/gameEvents';

export type DistillRigRequest = Extract<ScreenRequest, { type: 'distill_rig' }>;
