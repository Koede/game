import { describe, expect, it } from 'vitest';
import { ARRIVE_DIST, GIVE_UP_S, MAX_WALK_S, TURN_RATE, TapMove, projectPoint, tapDirection } from './tapMove';

const DT = 1 / 60;

describe('tapDirection', () => {
  it('the screen centre is the view direction', () => {
    const d = tapDirection(0, 0, 16 / 9, 72, 0.7, 0.2, { x: 0, y: 0, z: 0 });
    expect(d.x).toBeCloseTo(-Math.sin(0.7) * Math.cos(0.2));
    expect(d.y).toBeCloseTo(Math.sin(0.2));
    expect(d.z).toBeCloseTo(-Math.cos(0.7) * Math.cos(0.2));
  });

  it('looking north (yaw 0), the right of the screen points east and the top points up', () => {
    const right = tapDirection(1, 0, 1, 90, 0, 0, { x: 0, y: 0, z: 0 });
    expect(right.x).toBeGreaterThan(0.6);
    expect(right.z).toBeLessThan(0);
    const up = tapDirection(0, 1, 1, 90, 0, 0, { x: 0, y: 0, z: 0 });
    expect(up.y).toBeGreaterThan(0.6);
    expect(Math.hypot(up.x, up.y, up.z)).toBeCloseTo(1);
  });

  it('the screen edge sits half the field of view off the centre', () => {
    const d = tapDirection(0, -1, 1, 80, 0, 0, { x: 0, y: 0, z: 0 });
    expect(Math.atan2(-d.y, -d.z) * (180 / Math.PI)).toBeCloseTo(40, 1);
  });

  it('turning the view left moves a right-hand tap with it', () => {
    const d = tapDirection(1, 0, 1, 90, Math.PI / 2, 0, { x: 0, y: 0, z: 0 });
    expect(d.z).toBeLessThan(-0.6); // facing west, the right of the screen is north (-Z)
  });
});

describe('projectPoint', () => {
  it('is the inverse of tapDirection', () => {
    for (const [nx, ny, yaw, pitch] of [[0, 0, 0, 0], [0.5, -0.4, 1.2, 0.3], [-0.8, 0.6, -2.5, -0.2]]) {
      const d = tapDirection(nx, ny, 0.5, 72, yaw, pitch, { x: 0, y: 0, z: 0 });
      const p = projectPoint(d.x * 7, d.y * 7, d.z * 7, 0.5, 72, yaw, pitch, { x: 0, y: 0 });
      expect(p?.x).toBeCloseTo(nx);
      expect(p?.y).toBeCloseTo(ny);
    }
  });

  it('hides points behind the camera or off the screen', () => {
    expect(projectPoint(0, 0, 5, 1, 72, 0, 0, { x: 0, y: 0 })).toBeNull(); // south, looking north
    expect(projectPoint(20, 0, -2, 1, 72, 0, 0, { x: 0, y: 0 })).toBeNull(); // far to the right
  });
});

describe('TapMove', () => {
  /** Walks the steering at 4 blocks/s along the body's facing; returns the steps taken. */
  function walk(tm: TapMove, start: { x: number; z: number; yaw: number }, blockedAt = -Infinity) {
    const p = { ...start };
    let steps = 0;
    for (; steps < 60 * 40; steps++) {
      const s = tm.steer(p.x, p.z, p.yaw, DT, false);
      if (!s) break;
      p.yaw = s.yaw;
      if (s.moveZ > 0 && p.z > blockedAt) {
        p.x += -Math.sin(p.yaw) * 4 * DT;
        p.z += -Math.cos(p.yaw) * 4 * DT;
      }
    }
    return { p, steps };
  }

  it('does nothing without a goal', () => {
    expect(new TapMove().steer(0, 0, 0, DT, false)).toBeNull();
  });

  it('turns toward the goal, walks there and stops on arrival', () => {
    const tm = new TapMove();
    tm.set(5.5, -8.5); // north and east of the start
    const { p, steps } = walk(tm, { x: 0.5, z: 0.5, yaw: 2 });
    expect(tm.active).toBe(false);
    expect(Math.hypot(p.x - 5.5, p.z + 8.5)).toBeLessThan(ARRIVE_DIST + 0.1);
    expect(steps).toBeLessThan(60 * 6);
  });

  it('turns on the spot before walking when the goal is behind', () => {
    const tm = new TapMove();
    tm.set(0.5, 10.5); // south; yaw 0 faces north
    const s = tm.steer(0.5, 0.5, 0, DT, false)!;
    expect(s.moveZ).toBe(0);
    expect(Math.abs(s.yaw)).toBeLessThanOrEqual(TURN_RATE * DT + 1e-9);
  });

  it('manual input ends the walk at once', () => {
    const tm = new TapMove();
    tm.set(9.5, 0.5);
    expect(tm.steer(0.5, 0.5, 0, DT, true)).toBeNull();
    expect(tm.active).toBe(false);
  });

  it('hops when stuck, then gives up', () => {
    const tm = new TapMove();
    tm.set(0.5, -9.5);
    let hopped = false;
    let t = 0;
    for (; t < 5; t += DT) {
      const s = tm.steer(0.5, 0.5, 0, DT, false); // never moves: a wall
      if (!s) break;
      hopped ||= s.jump;
    }
    expect(hopped).toBe(true);
    expect(t).toBeGreaterThan(GIVE_UP_S - 0.1);
    expect(t).toBeLessThan(GIVE_UP_S + 0.3);
  });

  it('a walk never outlasts MAX_WALK_S', () => {
    const tm = new TapMove();
    tm.set(0.5, -999.5);
    let t = 0;
    let x = 0.5;
    let z = 0.5;
    for (; t < MAX_WALK_S + 5; t += DT) {
      const s = tm.steer(x, z, 0, DT, false);
      if (!s) break;
      z -= 0.5 * DT; // slow but steady progress, so only the timeout can end it
    }
    expect(Math.abs(t - MAX_WALK_S)).toBeLessThan(0.1);
    void x;
  });
});
