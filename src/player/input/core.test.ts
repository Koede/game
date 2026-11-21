import { describe, expect, it } from 'vitest';
import { DEFAULT_SETTINGS, type Settings } from '../../core/context';
import { InputCore, MOUSE_RAD_PER_PX, TOUCH_RAD_PER_PX, USE_REPEAT_S } from './core';
import { CMD_INVENTORY, CMD_LOG, CMD_NONE, CMD_PAUSE, NO_KEYS, keyAxisX, keyAxisZ, keyCommand, physicalCode, reduceKeys } from './keys';
import { DRAG_MINE_HOLD_MS, DRAG_USE_HOLD_MS, MouseDrag } from './mouseDrag';

const DT = 1 / 60;
const make = (overrides: Partial<Settings> = {}): InputCore => new InputCore({ ...DEFAULT_SETTINGS, ...overrides });

describe('keys', () => {
  it('opposite keys cancel and arrows mirror WASD', () => {
    let m = NO_KEYS;
    m = reduceKeys(m, 'down', 'KeyW');
    m = reduceKeys(m, 'down', 'ArrowDown');
    expect(keyAxisZ(m)).toBe(0);
    m = reduceKeys(m, 'up', 'KeyW');
    expect(keyAxisZ(m)).toBe(-1);
    m = reduceKeys(m, 'down', 'ArrowRight');
    m = reduceKeys(m, 'down', 'KeyA');
    expect(keyAxisX(m)).toBe(0);
    expect(reduceKeys(m, 'down', 'KeyZ')).toBe(m);
  });

  it('maps commands and recovers codes from bare keys', () => {
    expect(keyCommand('KeyE')).toBe(CMD_INVENTORY);
    expect(keyCommand('KeyL')).toBe(CMD_LOG);
    expect(keyCommand('Escape')).toBe(CMD_PAUSE);
    expect(keyCommand('Digit3')).toBe(2);
    expect(keyCommand('Numpad9')).toBe(8);
    expect(keyCommand('Digit0')).toBe(CMD_NONE);
    expect(physicalCode('', 'w')).toBe('KeyW');
    expect(physicalCode('', '7')).toBe('Digit7');
    expect(physicalCode('KeyZ', 'w')).toBe('KeyZ');
  });
});

describe('InputCore movement', () => {
  it('diagonal keyboard movement is normalised', () => {
    const core = make();
    core.keyDown('KeyW');
    core.keyDown('KeyD');
    const i = core.frame(DT, 0, false);
    expect(Math.hypot(i.moveX, i.moveZ)).toBeCloseTo(1, 6);
    expect(i.moveX).toBeGreaterThan(0);
    expect(i.moveZ).toBeGreaterThan(0);
  });

  it('opposite keys cancel', () => {
    const core = make();
    core.keyDown('KeyA');
    core.keyDown('KeyD');
    expect(core.frame(DT, 0, false).moveX).toBe(0);
  });

  it('Space, Shift and the stick sprint are held flags', () => {
    const core = make();
    core.keyDown('Space');
    core.keyDown('ShiftLeft');
    let i = core.frame(DT, 0, false);
    expect(i.jump).toBe(true);
    expect(i.sprint).toBe(true);
    core.keyUp('Space');
    core.keyUp('ShiftLeft');
    i = core.frame(DT, 16, false);
    expect(i.jump).toBe(false);
    expect(i.sprint).toBe(false);
  });

  it('joystick vector reaches the intent', () => {
    const core = make();
    core.touch.setViewport(390, 844);
    const r = core.touch.stick.radius;
    core.touch.down(1, 80, 700, 0, 'world');
    core.touch.move(1, 80, 700 - r, 10);
    const i = core.frame(DT, 16, false);
    expect(i.moveZ).toBeCloseTo(1, 5);
    expect(i.sprint).toBe(true);
  });
});

describe('InputCore one-shots', () => {
  it('number keys select a slot for exactly one frame; key repeat does not re-fire', () => {
    const core = make();
    core.keyDown('Digit3');
    expect(core.frame(DT, 0, false).hotbarSlot).toBe(2);
    core.keyDown('Digit3', true);
    expect(core.frame(DT, 16, false).hotbarSlot).toBeNull();
  });

  it('E, L and Escape are edges', () => {
    const core = make();
    core.keyDown('KeyE');
    core.keyDown('KeyL');
    core.keyDown('Escape');
    const i = core.frame(DT, 0, false);
    expect([i.inventory, i.log, i.pause]).toEqual([true, true, true]);
    const j = core.frame(DT, 16, false);
    expect([j.inventory, j.log, j.pause]).toEqual([false, false, false]);
  });

  it('wheel notches step the hotbar one per frame; small trackpad deltas add up', () => {
    const core = make();
    core.wheel(100);
    core.wheel(100);
    expect(core.frame(DT, 0, false).hotbarStep).toBe(1);
    expect(core.frame(DT, 16, false).hotbarStep).toBe(1);
    expect(core.frame(DT, 32, false).hotbarStep).toBe(0);
    core.wheel(-15);
    core.wheel(-15);
    expect(core.frame(DT, 48, false).hotbarStep).toBe(0);
    core.wheel(-15);
    expect(core.frame(DT, 64, false).hotbarStep).toBe(-1);
  });
});

describe('use auto-repeat', () => {
  it('fires on press and again every USE_REPEAT_S while held', () => {
    const core = make();
    core.mouseButton('right', true);
    let fired = 0;
    const frames = Math.round((USE_REPEAT_S * 3.3) / DT); // a little past the third repeat
    for (let f = 0; f < frames; f++) if (core.frame(DT, f * 16, false).use) fired++;
    expect(fired).toBe(4); // press + three repeats
    core.mouseButton('right', false);
    expect(core.frame(DT, 1e4, false).use).toBe(false);
  });

  it('repeats at the rate the controller sets (a hand station\'s stroke rate) and a press always fires at once', () => {
    const core = make();
    core.useRepeatS = 0.4;
    core.mouseButton('right', true);
    let fired = 0;
    for (let f = 0; f < Math.round(1.7 / DT); f++) if (core.frame(DT, f * 16, false).use) fired++;
    expect(fired).toBe(5); // press + repeats at 0.4, 0.8, 1.2, 1.6 s
  });

  it('a world tap fires use once', () => {
    const core = make();
    core.touch.down(1, 300, 300, 0, 'world');
    core.touch.up(1, 80);
    expect(core.frame(DT, 100, false).use).toBe(true);
    expect(core.frame(DT, 116, false).use).toBe(false);
  });
});

describe('place (Shift + Use, the touch Place toggle)', () => {
  it('Shift held turns a Use into a place; Shift alone or a plain Use does not', () => {
    const core = make();
    core.keyDown('ShiftLeft');
    expect(core.frame(DT, 0, false).place).toBe(false);
    core.mouseButton('right', true);
    expect(core.frame(DT, 16, false)).toMatchObject({ use: true, place: true });
    core.mouseButton('right', false);
    core.keyUp('ShiftLeft');
    core.mouseButton('right', true);
    expect(core.frame(DT, 32, false)).toMatchObject({ use: true, place: false });
  });

  it('the armed toggle places on the next Use only, and a screen opening disarms it', () => {
    const core = make();
    core.togglePlace();
    expect(core.placeArmed).toBe(true);
    expect(core.frame(DT, 0, false).place).toBe(false);
    core.touch.down(1, 300, 300, 0, 'world');
    core.touch.up(1, 80);
    expect(core.frame(DT, 100, false)).toMatchObject({ use: true, place: true });
    expect(core.placeArmed).toBe(false);
    core.touch.down(1, 300, 300, 200, 'world');
    core.touch.up(1, 260);
    expect(core.frame(DT, 300, false)).toMatchObject({ use: true, place: false });
    core.togglePlace();
    core.frame(DT, 400, true);
    expect(core.placeArmed).toBe(false);
    core.togglePlace();
    core.togglePlace();
    expect(core.frame(DT, 500, false).place).toBe(false);
  });
});

describe('look scaling', () => {
  it('applies mouse sensitivity and the pitch sign (mouse up = look up)', () => {
    const core = make({ mouseSensitivity: 2 });
    core.mouseMove(10, -5);
    const i = core.frame(DT, 0, false);
    expect(i.lookYaw).toBeCloseTo(10 * MOUSE_RAD_PER_PX * 2, 9);
    expect(i.lookPitch).toBeCloseTo(5 * MOUSE_RAD_PER_PX * 2, 9);
  });

  it('invertY flips pitch only', () => {
    const core = make({ invertY: true });
    core.mouseMove(10, -5);
    const i = core.frame(DT, 0, false);
    expect(i.lookYaw).toBeGreaterThan(0);
    expect(i.lookPitch).toBeCloseTo(-5 * MOUSE_RAD_PER_PX, 9);
  });

  it('touch look uses touch sensitivity and its smoothing delivers the whole travel', () => {
    const core = make({ touchSensitivity: 0.5 });
    core.touch.down(1, 300, 300, 0, 'world');
    core.touch.move(1, 310, 300, 5);
    core.touch.move(1, 410, 300, 10);
    let yaw = 0;
    for (let f = 0; f < 30; f++) yaw += core.frame(DT, 20 + f * 16, false).lookYaw;
    expect(yaw).toBeCloseTo(100 * TOUCH_RAD_PER_PX * 0.5, 9);
  });

  it('ignores absurd mouse jumps', () => {
    const core = make();
    core.mouseMove(5000, 0);
    expect(core.frame(DT, 0, false).lookYaw).toBe(0);
  });
});

describe('blocked (screen open / paused)', () => {
  it('returns a neutral intent and releases every held control, which stay released afterwards', () => {
    const core = make();
    core.keyDown('KeyW');
    core.keyDown('Space');
    core.mouseButton('left', true);
    core.touch.down(1, 350, 700, 0, 'jump');
    core.mouseMove(50, 0);
    expect(core.frame(DT, 0, false).moveZ).toBe(1);
    core.mouseMove(50, 0);
    core.keyDown('KeyE');
    const b = core.frame(DT, 16, true);
    expect(b).toMatchObject({ moveX: 0, moveZ: 0, lookYaw: 0, jump: false, mine: false, use: false, inventory: false });
    expect(core.isBlocked).toBe(true);
    // Keys pressed while blocked are ignored (the press that closes a screen must not leak into the game).
    expect(core.keyDown('KeyE')).toBe(false);
    const after = core.frame(DT, 32, false);
    expect(after).toMatchObject({ moveZ: 0, jump: false, mine: false, inventory: false, lookYaw: 0 });
    expect(core.touch.jumpHeld).toBe(false);
  });
});

describe('MouseDrag fallback', () => {
  it('a drag looks and does nothing else', () => {
    const d = new MouseDrag();
    d.down('left', 100, 100, 0);
    d.move(103, 100, 10);
    d.move(110, 100, 20); // crosses the slop: looking starts from here
    d.move(147, 110, 30);
    d.update(500);
    const out = { x: 0, y: 0 };
    d.takeLook(out);
    expect(out.x).toBe(37);
    expect(out.y).toBe(10);
    expect(d.mineHeld).toBe(false);
    d.up('left', 600);
    expect(d.takeUsePulses()).toBe(0);
  });

  it('left held still mines, and may then drag to look while mining', () => {
    const d = new MouseDrag();
    d.down('left', 100, 100, 0);
    d.update(DRAG_MINE_HOLD_MS + 1);
    expect(d.mineHeld).toBe(true);
    d.move(150, 100, 200);
    const out = { x: 0, y: 0 };
    d.takeLook(out);
    expect(out.x).toBe(50);
    expect(d.mineHeld).toBe(true);
    d.up('left', 300);
    expect(d.mineHeld).toBe(false);
  });

  it('a right click uses; a right hold uses once and keeps useHeld', () => {
    const d = new MouseDrag();
    d.down('right', 100, 100, 0);
    d.up('right', 50);
    expect(d.takeUsePulses()).toBe(1);
    d.down('right', 100, 100, 100);
    d.update(100 + DRAG_USE_HOLD_MS + 1);
    expect(d.useHeld).toBe(true);
    expect(d.takeUsePulses()).toBe(1);
    d.up('right', 600);
    expect(d.takeUsePulses()).toBe(0);
  });

  it('feeds mining into the core intent', () => {
    const core = make();
    core.drag.down('left', 100, 100, 0);
    expect(core.frame(DT, 50, false).mine).toBe(false);
    expect(core.frame(DT, DRAG_MINE_HOLD_MS + 10, false).mine).toBe(true);
  });
});
