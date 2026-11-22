/**
 * Distillery rig screen (spec S4). S10 registers `createRigScreen` once C7 adds
 * `{ type: 'distill_rig', x, y, z }` to `ScreenRequest`. Until then the request shape is `DistillRigRequest`.
 */
export { createRigScreen } from './rigScreen';
export type { DistillRigRequest } from './rigRequest';
