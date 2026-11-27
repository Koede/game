import { describe, expect, it } from 'vitest';
import { GESTURE_DEFAULTS, HOLD_CHARGING, HOLD_MINING, HOLD_NONE, TouchGestures, type LookDelta } from './gestures';

/** Portrait phone: 390 x 844. The stick region is the left half below 40% of the height. */
const phone = (): TouchGestures => {
  const g = new TouchGestures();
  g.setViewport(390, 844);
  return g;
};
const look = (g: TouchGestures): LookDelta => {
  const out = { x: 0, y: 0 };
  g.takeLook(out);
  return out;
};

describe('joystick', () => {
  it('starts where the thumb lands in the lower-left region and reads zero there', () => {
    const g = phone();
    g.down(1, 80, 700, 0, 'world');
    expect(g.stick.active).toBe(true);
    expect(g.stick.originX).toBe(80);
    expect(g.stick.originY).toBe(700);
    expect(g.stick.x).toBe(0);
    expect(g.stick.z).toBe(0);
  });

  it('does not start outside the region (right half or the top band)', () => {
    const g = phone();
    g.down(1, 300, 700, 0, 'world');
    g.down(2, 80, 200, 0, 'world');
    expect(g.stick.active).toBe(false);
  });

  it('pushing up walks forward, right strafes right, length grows to 1 at the rim', () => {
    const g = phone();
    const r = g.stick.radius;
    g.down(1, 100, 700, 0, 'world');
    g.move(1, 100, 700 - r, 10);
    expect(g.stick.z).toBeCloseTo(1, 5);
    expect(g.stick.x).toBeCloseTo(0, 5);
    g.move(1, 100 + r * 0.5, 700, 20);
    expect(g.stick.x).toBeGreaterThan(0.3);
    expect(g.stick.x).toBeLessThan(0.5);
    expect(g.stick.z).toBeCloseTo(0, 5);
  });

  it('has a dead zone around the centre', () => {
    const g = phone();
    const r = g.stick.radius;
    g.down(1, 100, 700, 0, 'world');
    g.move(1, 100 + r * GESTURE_DEFAULTS.deadZone * 0.9, 700, 10);
    expect(g.stick.x).toBe(0);
    g.move(1, 100 + r * (GESTURE_DEFAULTS.deadZone + 0.05), 700, 20);
    expect(g.stick.x).toBeGreaterThan(0);
  });

  it('sprints past ~90% of the radius with hysteresis, and stops on release', () => {
    const g = phone();
    const r = g.stick.radius;
    g.down(1, 100, 700, 0, 'world');
    g.move(1, 100, 700 - r * 0.85, 10);
    expect(g.stick.sprint).toBe(false);
    g.move(1, 100, 700 - r * 0.95, 20);
    expect(g.stick.sprint).toBe(true);
    g.move(1, 100, 700 - r * 0.82, 30);
    expect(g.stick.sprint).toBe(true);
    g.move(1, 100, 700 - r * 0.7, 40);
    expect(g.stick.sprint).toBe(false);
    g.move(1, 100, 700 - r, 50);
    g.up(1, 60);
    expect(g.stick.active).toBe(false);
    expect(g.stick.sprint).toBe(false);
    expect(g.stick.z).toBe(0);
  });

  it('the base follows a thumb dragged past the rim', () => {
    const g = phone();
    const r = g.stick.radius;
    g.down(1, 100, 700, 0, 'world');
    g.move(1, 100 + r * 2, 700, 10);
    expect(g.stick.originX).toBeCloseTo(100 + r, 5);
    expect(Math.hypot(g.stick.knobX, g.stick.knobY)).toBeCloseTo(r, 5);
    // Reversing is immediate: moving back by one radius already crosses the centre.
    g.move(1, 100 + r * 0.5, 700, 20);
    expect(g.stick.x).toBeLessThan(0);
  });
});

describe('look, tap and hold', () => {
  it('a drag on the world looks, without the slop jump', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.move(1, 252, 300, 5);
    expect(look(g).x).toBe(0);
    g.move(1, 260, 300, 10); // crosses the 4px slop: looking starts here
    g.move(1, 290, 310, 20);
    const d = look(g);
    expect(d.x).toBe(30);
    expect(d.y).toBe(10);
  });

  it('a short still touch is a tap = one use pulse', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.move(1, 253, 302, 50);
    g.up(1, 150);
    expect(g.takeUsePulses()).toBe(1);
    expect(g.takeUsePulses()).toBe(0);
    expect(g.mineHeld).toBe(false);
  });

  it('a tap on the world counts as a world tap, a press of the Use button does not', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.up(1, 100);
    expect(g.takeWorldTaps()).toBe(1);
    expect(g.takeWorldTaps()).toBe(0);
    g.down(2, 300, 600, 200, 'use');
    g.up(2, 300);
    expect(g.takeWorldTaps()).toBe(0);
    expect(g.takeUsePulses()).toBe(2);
  });

  it('a still touch lifted any time before the hold starts is a tap (no dead band)', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.up(1, 270);
    expect(g.takeUsePulses()).toBe(1);
    expect(g.mineHeld).toBe(false);
  });

  it('a stalled frame does not turn a quick tap into a hold', () => {
    const g = phone();
    g.update(-10);
    g.down(1, 250, 300, 0, 'world');
    g.update(400); // the first frame after the touch landed comes late
    expect(g.mineHeld).toBe(false);
    g.up(1, 120); // the lift, queued during the stall, carries its real time
    expect(g.takeUsePulses()).toBe(1);
    expect(g.mineHeld).toBe(false);
  });

  it('a tap that a late frame already promoted is still a tap, and the hold is undone', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.update(10);
    g.update(160);
    g.update(310); // frames ran on while the lift waited in the queue
    expect(g.mineHeld).toBe(true);
    g.up(1, 120);
    expect(g.takeUsePulses()).toBe(1);
    expect(g.mineHeld).toBe(false);
  });

  it('a held still finger becomes a hold on the frame after the threshold', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    for (let t = 16; t < 280; t += 16) g.update(t);
    expect(g.mineHeld).toBe(false);
    g.update(288);
    expect(g.mineHeld).toBe(true);
    g.up(1, 600);
    expect(g.takeUsePulses()).toBe(0);
    expect(g.mineHeld).toBe(false);
  });

  it('a touch that travelled is not a tap', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.move(1, 275, 300, 50);
    g.up(1, 100);
    expect(g.takeUsePulses()).toBe(0);
  });

  it('holding still becomes mining, which continues while the finger drags to look', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.update(100);
    expect(g.mineHeld).toBe(false);
    expect(g.holdPhase).toBe(HOLD_CHARGING);
    g.update(200);
    g.update(GESTURE_DEFAULTS.holdMs + 1);
    expect(g.mineHeld).toBe(true);
    expect(g.holdPhase).toBe(HOLD_MINING);
    g.move(1, 300, 300, 400);
    g.move(1, 320, 300, 420);
    expect(g.mineHeld).toBe(true);
    expect(look(g).x).toBe(20);
    g.up(1, 600);
    expect(g.mineHeld).toBe(false);
    expect(g.takeUsePulses()).toBe(0);
    g.update(700);
    expect(g.holdPhase).toBe(HOLD_NONE);
  });

  it('a drag that started early never turns into mining', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.move(1, 280, 300, 50);
    g.update(1000);
    expect(g.mineHeld).toBe(false);
  });

  it('cancel releases without firing a tap', () => {
    const g = phone();
    g.down(1, 250, 300, 0, 'world');
    g.cancel(1);
    expect(g.takeUsePulses()).toBe(0);
    expect(g.has(1)).toBe(false);
  });
});

describe('buttons and simultaneous pointers', () => {
  it('stick + look + Mine button all work at the same time', () => {
    const g = phone();
    const r = g.stick.radius;
    g.down(1, 80, 700, 0, 'world'); // stick
    g.down(2, 260, 300, 5, 'world'); // look
    g.down(3, 330, 650, 10, 'mine'); // button
    g.move(1, 80, 700 - r, 20);
    g.move(2, 270, 300, 25);
    g.move(2, 300, 290, 30);
    g.update(40);
    expect(g.stick.z).toBeCloseTo(1, 5);
    expect(g.mineHeld).toBe(true);
    const d = look(g);
    expect(d.x).toBe(30);
    expect(d.y).toBe(-10);
    g.up(3, 50);
    expect(g.mineHeld).toBe(false);
    expect(g.stick.active).toBe(true);
  });

  it('a second finger in the stick region looks instead of stealing the stick', () => {
    const g = phone();
    g.down(1, 80, 700, 0, 'world');
    g.down(2, 120, 650, 0, 'world');
    g.move(2, 160, 650, 10);
    g.move(2, 170, 650, 20);
    expect(g.stick.originX).toBe(80);
    expect(look(g).x).toBe(10);
  });

  it('Jump and Use buttons report held; Use pulses once on press', () => {
    const g = phone();
    g.down(1, 350, 700, 0, 'jump');
    g.down(2, 350, 600, 0, 'use');
    expect(g.jumpHeld).toBe(true);
    expect(g.useHeld).toBe(true);
    expect(g.takeUsePulses()).toBe(1);
    g.up(1, 100);
    g.up(2, 100);
    expect(g.jumpHeld).toBe(false);
    expect(g.useHeld).toBe(false);
    expect(g.takeUsePulses()).toBe(0);
  });

  it('a finger resting on Mine can drag to look', () => {
    const g = phone();
    g.down(1, 300, 650, 0, 'mine');
    g.move(1, 315, 650, 10);
    g.move(1, 335, 640, 20);
    expect(look(g).x).toBe(20);
    expect(g.mineHeld).toBe(true);
  });

  it('reset lets go of every finger', () => {
    const g = phone();
    g.down(1, 80, 700, 0, 'world');
    g.down(2, 300, 650, 0, 'mine');
    g.down(3, 350, 700, 0, 'jump');
    g.reset();
    expect(g.stick.active).toBe(false);
    expect(g.mineHeld).toBe(false);
    expect(g.jumpHeld).toBe(false);
  });

  it('one-handed mode puts the stick in the lower part of the chosen side', () => {
    const g = new TouchGestures();
    g.setViewport(390, 844);
    g.handed = 'right';
    expect(g.inStickRegion(300, 700)).toBe(true);
    expect(g.inStickRegion(100, 700)).toBe(false);
    expect(g.inStickRegion(300, 300)).toBe(false);
    g.handed = 'left';
    expect(g.inStickRegion(100, 700)).toBe(true);
    expect(g.inStickRegion(300, 700)).toBe(false);
  });

  it('a landscape viewport moves the stick region up and sizes the stick', () => {
    const g = new TouchGestures();
    g.setViewport(844, 390);
    expect(g.inStickRegion(100, 120)).toBe(true);
    expect(g.inStickRegion(100, 60)).toBe(false);
    expect(g.stick.radius).toBeGreaterThanOrEqual(48);
    expect(g.stick.radius).toBeLessThanOrEqual(66);
  });
});
