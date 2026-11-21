import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { embedded, HOP_VELOCITY, stepBody, type Body, type StepInfo } from './physics';
import { FlatWorld } from './testKit';

const body = (x: number, y: number, z: number): Body => ({ x, y, z, vx: 0, vy: 0, vz: 0, onGround: false, inLiquid: false });
const info = (): StepInfo => ({ blocked: false, inLava: false });
const HW = 0.4;
const H = 0.9;

function run(w: FlatWorld, b: Body, seconds: number, vx = 0, vz = 0): StepInfo {
  const i = info();
  for (let t = 0; t < seconds; t += DT) {
    if (vx !== 0) b.vx = vx;
    if (vz !== 0) b.vz = vz;
    stepBody(w, b, HW, H, DT, i);
  }
  return i;
}

describe('animal physics', () => {
  it('falls and rests on the ground', () => {
    const w = new FlatWorld();
    const b = body(0.5, 20, 0.5);
    run(w, b, 2);
    expect(b.y).toBeCloseTo(11, 3);
    expect(b.onGround).toBe(true);
    expect(b.vy).toBe(0);
  });

  it('never tunnels through the ground at terminal speed', () => {
    const w = new FlatWorld();
    const b = body(0.5, 90, 0.5);
    b.vy = -40;
    run(w, b, 4);
    expect(b.y).toBeCloseTo(11, 3);
  });

  it('stops at a wall and reports it', () => {
    const w = new FlatWorld();
    w.fill(3, 11, -2, 3, 12, 2, 'stone');
    const b = body(0.5, 11, 0.5);
    const i = run(w, b, 2, 4);
    expect(b.x).toBeLessThan(3 - HW + 1e-3);
    expect(b.x).toBeGreaterThan(3 - HW - 0.01);
    expect(i.blocked).toBe(true);
  });

  it('a fast body still cannot pass a one-block wall', () => {
    const w = new FlatWorld();
    w.fill(3, 11, -2, 3, 12, 2, 'stone');
    const b = body(0.5, 11, 0.5);
    run(w, b, 1, 30);
    expect(b.x).toBeLessThan(3);
  });

  it('hops onto a one-block step', () => {
    const w = new FlatWorld();
    w.fill(2, 11, -2, 6, 11, 2, 'dirt');
    const b = body(0.5, 11, 0.5);
    const i = info();
    for (let t = 0; t < 2; t += DT) {
      b.vx = 2;
      stepBody(w, b, HW, H, DT, i);
      if (i.blocked && b.onGround) b.vy = HOP_VELOCITY;
    }
    expect(b.y).toBeCloseTo(12, 3);
    expect(b.x).toBeGreaterThan(3);
  });

  it('walks across chunk borders at negative coordinates', () => {
    const w = new FlatWorld();
    const b = body(1.5, 11, -15.5);
    run(w, b, 2, -3, -2);
    expect(b.x).toBeLessThan(-3);
    expect(b.z).toBeLessThan(-18);
    expect(b.y).toBeCloseTo(11, 3);
  });

  it('treats an unloaded chunk column as a wall', () => {
    const w = new FlatWorld();
    w.setLoaded(-1, 0, false);
    const b = body(0.6, 11, 4.5);
    const i = run(w, b, 1, -3);
    expect(b.x).toBeCloseTo(HW, 2);
    expect(i.blocked).toBe(true);
  });

  it('floats in water with its waist near the surface', () => {
    const w = new FlatWorld();
    w.fill(-3, 6, -3, 3, 10, 3, 'water');
    const b = body(0.5, 12, 0.5);
    run(w, b, 4);
    expect(b.inLiquid).toBe(true);
    // Surface is the top of cell 10 (y = 11); the body bobs around there.
    expect(b.y).toBeGreaterThan(10);
    expect(b.y).toBeLessThan(11.2);
  });

  it('reports lava contact', () => {
    const w = new FlatWorld();
    w.put(0, 10, 0, 'lava');
    const b = body(0.5, 11, 0.5);
    const i = run(w, b, 0.5);
    expect(i.inLava).toBe(true);
  });

  it('a body inside a block walks out instead of sticking', () => {
    const w = new FlatWorld();
    w.put(0, 11, 0, 'stone');
    const b = body(0.5, 11, 0.5);
    expect(embedded(w, b, HW, H)).toBe(true);
    run(w, b, 1, 3);
    expect(b.x).toBeGreaterThan(1 + HW - 1e-3);
  });

  it('stands on a slab half a block up', () => {
    const w = new FlatWorld();
    w.put(0, 11, 0, 'solar_panel');
    const b = body(0.5, 13, 0.5);
    run(w, b, 1);
    expect(b.y).toBeCloseTo(11.5, 3);
  });
});
