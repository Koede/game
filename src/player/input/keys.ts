/**
 * Pure keyboard logic: which keys are held is one integer bit mask, advanced by `reduceKeys`. Keys are
 * identified by KeyboardEvent.code (physical position), so WASD sits in the same place on every layout.
 */

const W = 1;
const UP = 2;
const S = 4;
const DOWN = 8;
const A = 16;
const LEFT = 32;
const D = 64;
const RIGHT = 128;
const SPACE = 256;
const SHIFT_L = 512;
const SHIFT_R = 1024;
const Q = 2048;

const HELD_BITS: Readonly<Record<string, number>> = {
  KeyW: W,
  ArrowUp: UP,
  KeyS: S,
  ArrowDown: DOWN,
  KeyA: A,
  ArrowLeft: LEFT,
  KeyD: D,
  ArrowRight: RIGHT,
  Space: SPACE,
  ShiftLeft: SHIFT_L,
  ShiftRight: SHIFT_R,
  KeyQ: Q,
};

/** No keys held. */
export const NO_KEYS = 0;

/** Returns the held-key mask after `code` went down or up. Unknown keys leave it unchanged. */
export function reduceKeys(mask: number, type: 'down' | 'up', code: string): number {
  const bit = HELD_BITS[code];
  if (bit === undefined) return mask;
  return type === 'down' ? mask | bit : mask & ~bit;
}

/** Strafe axis from the held keys: -1 left, +1 right, 0 when neither or both sides are held. */
export function keyAxisX(mask: number): number {
  return ((mask & (D | RIGHT)) !== 0 ? 1 : 0) - ((mask & (A | LEFT)) !== 0 ? 1 : 0);
}

/** Walk axis from the held keys: +1 forward, -1 back, 0 when neither or both are held. */
export function keyAxisZ(mask: number): number {
  return ((mask & (W | UP)) !== 0 ? 1 : 0) - ((mask & (S | DOWN)) !== 0 ? 1 : 0);
}

export const keyJump = (mask: number): boolean => (mask & SPACE) !== 0;
export const keySprint = (mask: number): boolean => (mask & (SHIFT_L | SHIFT_R)) !== 0;
export const keyDropHeld = (mask: number): boolean => (mask & Q) !== 0;

/** One-shot commands. 0-8 select that hotbar slot. */
export const CMD_NONE = -1;
export const CMD_INVENTORY = 9;
export const CMD_LOG = 10;
export const CMD_PAUSE = 11;
export const CMD_DROP = 12;

/** The one-shot command bound to a key, or CMD_NONE. */
export function keyCommand(code: string): number {
  switch (code) {
    case 'KeyE':
      return CMD_INVENTORY;
    case 'KeyL':
      return CMD_LOG;
    case 'Escape':
      return CMD_PAUSE;
    case 'KeyQ':
      return CMD_DROP;
    default: {
      const digit = DIGIT_KEY.exec(code);
      return digit ? Number(digit[1]) - 1 : CMD_NONE;
    }
  }
}

const DIGIT_KEY = /^(?:Digit|Numpad)([1-9])$/;

/** True when the game reacts to this key (so the page must not also scroll or tab away on it). */
export function isGameKey(code: string): boolean {
  return HELD_BITS[code] !== undefined || keyCommand(code) !== CMD_NONE;
}

const KEY_TO_CODE: Readonly<Record<string, string>> = {
  w: 'KeyW',
  a: 'KeyA',
  s: 'KeyS',
  d: 'KeyD',
  e: 'KeyE',
  l: 'KeyL',
  q: 'KeyQ',
  ' ': 'Space',
  spacebar: 'Space',
  shift: 'ShiftLeft',
  escape: 'Escape',
  esc: 'Escape',
  arrowup: 'ArrowUp',
  arrowdown: 'ArrowDown',
  arrowleft: 'ArrowLeft',
  arrowright: 'ArrowRight',
};

/**
 * The physical key code of a keyboard event. Some virtual and remote keyboards send an empty `code`;
 * for those the character in `key` is mapped back to the key it would be on a QWERTY board.
 */
export function physicalCode(code: string, key: string): string {
  if (code) return code;
  const lower = key.toLowerCase();
  if (lower.length === 1 && lower >= '1' && lower <= '9') return `Digit${lower}`;
  return KEY_TO_CODE[lower] ?? '';
}
