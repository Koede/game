import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FakeWorld } from '../game/fakeWorld';
import {
  ACCEL, BODY_HEIGHT, DRIVE_BURN, IDLE_BURN, MAX_FORWARD, MAX_REVERSE, TANK_S, WORK_BURN, burn, createTractor, driveTractor, forward,
  fromSnapshot, right, seatOf, settleTractor, snapshotOf,
} from './tractor';
import { boxFree, sweepBox } from './collide';

function field(): FakeWorld {
  const world = new FakeWorld(createBus());
  world.fill(-40, 9, -40, 40, 9, 40, 'grass');
  return world;
}

const DT = 1 / 60;
function run(world: FakeWorld, t: ReturnType<typeof createTractor>, throttle: number, steer: number, seconds: number): void {
  for (let i = 0; i < seconds / DT; i++) driveTractor(world, t, { throttle, steer }, DT);
}

describe('tractor driving', () => {
  it('accelerates to its top speed, in the direction it faces (yaw 0 = -Z), and coasts to a stop', () => {
    const world = field();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, t, 1, 0, 3);
    expect(t.speed).toBeCloseTo(MAX_FORWARD, 1);
    expect(t.z).toBeLessThan(0.5 - 8);
    expect(Math.abs(t.x - 0.5)).toBeLessThan(0.01);
    run(world, t, 0, 0, 4);
    expect(t.speed).toBe(0);
  });

  it('reverses slower, and the roll of the wheels follows the direction', () => {
    const world = field();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, t, -1, 0, 3);
    expect(t.speed).toBeCloseTo(-MAX_REVERSE, 1);
    expect(t.z).toBeGreaterThan(0.5);
    expect(t.roll).toBeLessThan(0);
  });

  it('steers right with a positive steer: heading turns clockwise seen from above, and the path curves to the right', () => {
    const world = field();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, t, 1, 1, 2);
    expect(t.yaw).toBeLessThan(-0.5);
    // Driving towards -Z and turning right takes it to +X.
    expect(t.x).toBeGreaterThan(1);
    const left = createTractor(2, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, left, 1, -1, 2);
    expect(left.yaw).toBeGreaterThan(0.5);
    expect(left.x).toBeLessThan(0);
  });

  it('turns (slowly) when standing still but not when out of fuel', () => {
    const world = field();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, t, 0, 1, 1);
    expect(t.yaw).toBeLessThan(0);
    const dry = createTractor(2, 0.5, 10, 0.5, 0, null, 0);
    run(world, dry, 1, 0, 2);
    expect(dry.speed).toBe(0);
    expect(dry.z).toBeCloseTo(0.5, 2);
  });

  it('is stopped by a wall of two blocks and climbs a one block step', () => {
    const world = field();
    world.fill(-3, 10, -10, 3, 11, -10, 'stone');
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(world, t, 1, 0, 6);
    expect(t.z).toBeGreaterThan(-10 + 1 + 0.79); // stopped on this side of the wall, a half-width off it
    expect(t.speed).toBeLessThan(1);

    const step = field();
    step.fill(-3, 10, -30, 3, 10, -10, 'stone'); // a one-block platform
    const s = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    run(step, s, 1, 0, 6);
    expect(s.z).toBeLessThan(-12);
    expect(s.y).toBeCloseTo(11, 1);
    expect(s.onGround).toBe(true);
  });

  it('falls off an edge and lands, and a parked tractor settles when its ground is dug away', () => {
    const world = field();
    world.fill(-40, 5, -40, 40, 5, 40, 'stone');
    for (let x = -3; x <= 3; x++) for (let z = -3; z <= 3; z++) world.setVoxel(x, 9, z, 0);
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    for (let i = 0; i < 120; i++) settleTractor(world, t, DT);
    expect(t.y).toBeCloseTo(6, 2);
    expect(t.onGround).toBe(true);
    expect(t.speed).toBe(0);
  });

  it('burns idle + drive fuel while driving and more while working, and runs dry at zero', () => {
    expect(burn(0, false, 1)).toBeCloseTo(IDLE_BURN);
    expect(burn(1, false, 1)).toBeCloseTo(IDLE_BURN + DRIVE_BURN);
    expect(burn(-0.5, true, 1)).toBeCloseTo(IDLE_BURN + DRIVE_BURN * 0.5 + WORK_BURN);
    const world = field();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, 1);
    run(world, t, 1, 0, 2);
    expect(t.fuel).toBe(0);
    expect(t.speed).toBeLessThan(MAX_FORWARD * 0.6 + ACCEL);
  });

  it('seat, forward and right are consistent with the player convention', () => {
    const t = createTractor(1, 5, 10, 5, 0);
    expect(forward(0).z).toBeCloseTo(-1);
    expect(right(0).x).toBeCloseTo(1);
    expect(forward(Math.PI / 2).x).toBeCloseTo(-1);
    expect(right(Math.PI / 2).z).toBeCloseTo(-1);
    expect(seatOf(t).z).toBeGreaterThan(5); // the driver sits behind the middle
  });

  it('saves and loads, refusing damaged data and clamping the fuel', () => {
    const t = createTractor(7, 1.5, 12, -3, 0.4, 'harvester', 250);
    expect(fromSnapshot(JSON.parse(JSON.stringify(snapshotOf(t))))).toMatchObject({ id: 7, x: 1.5, y: 12, z: -3, yaw: 0.4, attachment: 'harvester', fuel: 250 });
    expect(fromSnapshot(null)).toBeNull();
    expect(fromSnapshot({ id: 1, x: 'a' })).toBeNull();
    expect(fromSnapshot({ ...snapshotOf(t), fuel: 99999 })!.fuel).toBe(TANK_S);
    expect(fromSnapshot({ ...snapshotOf(t), attachment: 'plough' })!.attachment).toBeNull();
  });
});

describe('vehicle collision helpers', () => {
  it('sweeps a wide box flush against a block and reports free space', () => {
    const world = field();
    world.put(5, 10, 0, 'stone');
    const pos = { x: 0.5, y: 10, z: 0.5 };
    const moved = sweepBox(world, pos, 0, 10, 0.8, BODY_HEIGHT);
    expect(pos.x).toBeCloseTo(5 - 0.8, 3);
    expect(moved).toBeCloseTo(5 - 0.8 - 0.5, 3);
    expect(boxFree(world, { x: 0.5, y: 10, z: 0.5 }, 0.8, BODY_HEIGHT)).toBe(true);
    expect(boxFree(world, { x: 5.5, y: 10, z: 0.5 }, 0.8, BODY_HEIGHT)).toBe(false);
  });
});
