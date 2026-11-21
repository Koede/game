/** Public API of the input layer. */
export { InputManager, type InputManagerOptions } from './inputManager';
export { InputCore, MOUSE_RAD_PER_PX, TOUCH_RAD_PER_PX, TOUCH_SMOOTH_S, USE_REPEAT_S } from './core';
export { createIntent, clearIntent, type Intent } from './intent';
export {
  TouchGestures,
  GESTURE_DEFAULTS,
  HOLD_NONE,
  HOLD_CHARGING,
  HOLD_MINING,
  type GestureConfig,
  type LookDelta,
  type StickState,
  type TouchTarget,
} from './gestures';
export { MouseDrag, DRAG_SLOP_PX, DRAG_MINE_HOLD_MS, DRAG_USE_HOLD_MS, type DragButton } from './mouseDrag';
export { reduceKeys, keyAxisX, keyAxisZ, keyJump, keySprint, keyCommand, isGameKey, physicalCode, NO_KEYS } from './keys';
export { TouchOverlay, type TouchButton } from './touchOverlay';
export { TOUCH_CSS } from './touchStyles';
