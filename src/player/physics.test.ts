import { describe, expect, it } from 'vitest';
import { GRAVITY, JUMP_VELOCITY, MAX_HEALTH, SPRINT_SPEED, WALK_SPEED } from '../core/constants';
import { createBus } from '../core/context';
import { PlayerPhysics, STEP_HEIGHT } from './physics';
import { flatWorld, idle, makePlayer, PatchyWorld } from './testKit';
import { WATER_FALLING, WATER_SOURCE, flowingWater } from '../world/water';

const DT = 1 / 60;

function run(physics: PlayerPhysics, seconds: number, input = idle()): void {
  for (let t = 0; t < seconds; t += DT) physics.step(DT, input);
}

describe('ground', () => {
  it('rests on the floor without sinking or jittering', () => {
    const world = flatWorld();
    const player = makePlayer(createBus(), 0.5, 10, 0.5);
    const physics = new PlayerPhysics(world, player);
    run(physics, 2);
    expect(player.position.y).toBeCloseTo(10, 6);
    expect(player.onGround).toBe(true);
    expect(player.velocity.y).toBe(0);
  });

  it('falls onto the floor from above', () => {
    const world = flatWorld();
    const player = makePlayer(createBus(), 0.5, 12.5, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    run(physics, 2);
    expect(player.position.y).toBeCloseTo(10, 6);
    expect(player.onGround).toBe(true);
    expect(player.health).toBe(MAX_HEALTH); // 2.5 blocks is a safe fall
  });

  it('walks forward (yaw 0 = north = -Z) at walking speed, and faster when sprinting', () => {
    const world = flatWorld();
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 1, { moveX: 0, moveZ: 1, jump: false, sprint: false });
    expect(player.position.z).toBeLessThan(-3);
    expect(Math.abs(player.position.x - 0.5)).toBeLessThan(1e-6);
    expect(-player.velocity.z).toBeCloseTo(WALK_SPEED, 1);
    run(physics, 0.6, { moveX: 0, moveZ: 1, jump: false, sprint: true });
    expect(-player.velocity.z).toBeCloseTo(SPRINT_SPEED, 1);
    expect(physics.result.sprinting).toBe(true);
  });

  it('strafes right towards +X when facing north, and turns with yaw', () => {
    const world = flatWorld();
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 0.5, { moveX: 1, moveZ: 0, jump: false, sprint: false });
    expect(player.position.x).toBeGreaterThan(1.5);
    // Yaw +90 degrees turns left: forward is now west (-X).
    player.yaw = Math.PI / 2;
    const x = player.position.x;
    run(physics, 0.5, { moveX: 0, moveZ: 1, jump: false, sprint: false });
    expect(player.position.x).toBeLessThan(x - 1);
  });

  it('jumps about 1.3 blocks high', () => {
    const world = flatWorld();
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    physics.step(DT, { moveX: 0, moveZ: 0, jump: true, sprint: false });
    expect(physics.result.jumped).toBe(true);
    let top = 0;
    for (let i = 0; i < 90; i++) {
      physics.step(DT, idle());
      top = Math.max(top, player.position.y);
    }
    const expected = (JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY);
    expect(top - 10).toBeGreaterThan(expected - 0.15);
    expect(top - 10).toBeLessThan(expected + 0.05);
    expect(player.position.y).toBeCloseTo(10, 6);
  });
});

describe('walls and ceilings', () => {
  it('a wall stops the player flush against it', () => {
    const world = flatWorld();
    world.fill(-5, 10, -3, 5, 12, -3, 'stone'); // wall whose south face is at z = -2
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 2, { moveX: 0, moveZ: 1, jump: false, sprint: true });
    expect(player.position.z).toBeCloseTo(-2 + 0.3, 6);
    expect(player.velocity.z).toBe(0);
  });

  it('slides along a wall when moving diagonally', () => {
    const world = flatWorld();
    world.fill(-12, 10, -3, 12, 12, -3, 'stone');
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 1.5, { moveX: 0.7, moveZ: 0.7, jump: false, sprint: false });
    expect(player.position.z).toBeCloseTo(-1.7, 6);
    expect(player.position.x).toBeGreaterThan(3);
  });

  it('cannot walk up a full block without jumping, but can jump onto it', () => {
    const world = flatWorld();
    world.fill(-5, 10, -10, 5, 10, -3, 'stone');
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 1, { moveX: 0, moveZ: 1, jump: false, sprint: false });
    expect(player.position.y).toBeCloseTo(10, 6);
    run(physics, 0.4, { moveX: 0, moveZ: 1, jump: true, sprint: false });
    run(physics, 1, { moveX: 0, moveZ: 1, jump: false, sprint: false });
    expect(player.position.y).toBeCloseTo(11, 6);
    expect(player.position.z).toBeLessThan(-2.3);
  });

  it('a ceiling stops a jump', () => {
    const world = flatWorld();
    world.put(0, 12, 0, 'stone'); // ceiling 2 blocks above the floor: head room 0.2
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    physics.step(DT, { moveX: 0, moveZ: 0, jump: true, sprint: false });
    let top = 0;
    for (let i = 0; i < 60; i++) {
      physics.step(DT, idle());
      top = Math.max(top, player.position.y);
    }
    expect(top).toBeLessThanOrEqual(12 - 1.8 + 1e-6);
    expect(top).toBeGreaterThan(10.1);
  });

  it('steps onto a slab while walking, with the climb reported for the camera', () => {
    const world = flatWorld();
    world.fill(-5, 10, -6, 5, 10, -3, 'solar_panel'); // slabs: top at 10.5
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    let climbed = 0;
    for (let i = 0; i < 90; i++) climbed += physics.step(DT, { moveX: 0, moveZ: 1, jump: false, sprint: false }).steppedUp;
    expect(player.position.y).toBeCloseTo(10.5, 6);
    expect(player.position.z).toBeLessThan(-3);
    expect(climbed).toBeCloseTo(0.5, 2);
    expect(STEP_HEIGHT).toBeLessThan(1);
  });
});

describe('falling', () => {
  it('does not tunnel through a one-block floor in a 60 m fall, and takes fall damage', () => {
    const bus = createBus();
    const world = flatWorld(bus);
    const player = makePlayer(bus, 0.5, 70, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    let landed = 0;
    for (let i = 0; i < 600 && landed === 0; i++) landed = physics.step(DT, idle()).landedFrom;
    expect(player.position.y).toBeCloseTo(10, 6);
    expect(landed).toBeCloseTo(60, 6);
    expect(player.dead).toBe(true);
    expect(player.deathCause).toBe('fall');
  });

  it('still lands exactly with huge time steps', () => {
    const world = flatWorld();
    const player = makePlayer(createBus(), 0.5, 80, 0.5);
    player.onGround = false;
    player.velocity.y = -60;
    const physics = new PlayerPhysics(world, player);
    for (let i = 0; i < 30; i++) physics.step(0.1, idle());
    expect(player.position.y).toBeCloseTo(10, 6);
  });

  it('a 5-block fall deals floor(5 - 3.5) = 1 damage', () => {
    const world = flatWorld();
    const player = makePlayer(createBus(), 0.5, 15, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    run(physics, 2);
    expect(player.health).toBe(MAX_HEALTH - 1);
  });

  it('water breaks a fall', () => {
    const world = flatWorld();
    world.fill(-2, 10, -2, 2, 12, 2, 'water');
    const player = makePlayer(createBus(), 0.5, 40, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    run(physics, 5);
    expect(player.health).toBe(MAX_HEALTH);
  });

  it('unloaded columns are solid: no falling into terrain that has not loaded', () => {
    const world = new PatchyWorld();
    world.unload(0, 0);
    const player = makePlayer(createBus(), 0.5, 30, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    run(physics, 3);
    expect(player.position.y).toBeCloseTo(30, 3);
  });

  it('cannot walk into an unloaded column', () => {
    const world = flatWorld();
    for (let x = -12; x <= 12; x++) world.unload(x, -3);
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    run(physics, 2, { moveX: 0, moveZ: 1, jump: false, sprint: false });
    expect(player.position.z).toBeCloseTo(-2 + 0.3, 6);
  });

  it('out of the world returns to the spawn', () => {
    const world = flatWorld();
    const player = makePlayer(createBus(), 3.5, 10, 3.5);
    const physics = new PlayerPhysics(world, player);
    player.position.y = -50;
    physics.step(DT, idle());
    expect(physics.result.fellOut).toBe(true);
    expect(player.position).toMatchObject({ x: 3.5, y: 10, z: 3.5 });
  });

  it('a block appearing inside the player lifts it out', () => {
    const world = flatWorld();
    const player = makePlayer();
    const physics = new PlayerPhysics(world, player);
    world.put(0, 10, 0, 'stone');
    physics.step(DT, idle());
    expect(player.position.y).toBeCloseTo(11, 6);
  });
});

describe('swimming', () => {
  function pool(): PatchyWorld {
    const world = flatWorld();
    world.fill(-12, 10, -12, 12, 14, 12, 'water'); // 5 deep, surface at 15
    return world;
  }

  it('sinks slowly in water and marks the player wet', () => {
    const world = pool();
    const player = makePlayer(createBus(), 0.5, 13, 0.5);
    player.onGround = false;
    const physics = new PlayerPhysics(world, player);
    physics.step(DT, idle());
    expect(physics.result.enteredWater).toBe(true);
    run(physics, 0.5);
    expect(player.inWater).toBe(true);
    expect(player.headInWater).toBe(true);
    expect(player.velocity.y).toBeGreaterThan(-2.5);
    expect(player.velocity.y).toBeLessThan(0);
  });

  it('Space rises towards the surface; swimming is slower than walking', () => {
    const world = pool();
    const player = makePlayer(createBus(), 0.5, 10, 0.5);
    const physics = new PlayerPhysics(world, player);
    run(physics, 1.5, { moveX: 0, moveZ: 0, jump: true, sprint: false });
    expect(player.position.y).toBeGreaterThan(13.5);
    run(physics, 1, { moveX: 0, moveZ: 1, jump: false, sprint: true });
    expect(Math.hypot(player.velocity.x, player.velocity.z)).toBeLessThan(WALK_SPEED);
    expect(physics.result.sprinting).toBe(false);
  });

  it('pushing into a bank while swimming up climbs out', () => {
    const world = flatWorld();
    world.fill(-12, 10, -1, 12, 11, 12, 'water'); // pool surface at 12
    world.fill(-12, 10, -12, 12, 11, -2, 'stone'); // bank: top at 12
    const player = makePlayer(createBus(), 0.5, 10, 0.5);
    const physics = new PlayerPhysics(world, player);
    run(physics, 4, { moveX: 0, moveZ: 1, jump: true, sprint: false });
    expect(player.position.z).toBeLessThan(-2);
    expect(player.position.y).toBeGreaterThanOrEqual(12 - 1e-6);
  });
});

describe('currents (spec 18.4)', () => {
  it('flowing water carries a player standing in it along the flow, weaker water less', () => {
    const world = flatWorld();
    // A stream running east along z = 0: level 1 at x 0, weaker further on, a source upstream.
    world.setVoxel(-1, 10, 0, WATER_SOURCE);
    for (let x = 0; x <= 6; x++) world.setVoxel(x, 10, 0, flowingWater(x + 1));
    const player = makePlayer(createBus(), 0.5, 10, 0.5);
    const physics = new PlayerPhysics(world, player);
    run(physics, 0.5);
    expect(player.velocity.x).toBeGreaterThan(1);
    expect(Math.abs(player.velocity.z)).toBeLessThan(0.05);
    expect(player.position.x).toBeGreaterThan(0.8);
    const fast = player.velocity.x;
    player.position.x = 5.5;
    run(physics, 0.5);
    expect(player.velocity.x).toBeGreaterThan(0);
    expect(player.velocity.x).toBeLessThan(fast / 2);
    // Still water (a lake of sources) pushes nobody.
    const lake = flatWorld();
    lake.fill(-3, 10, -3, 3, 10, 3, 'water');
    const swimmer = makePlayer(createBus(), 0.5, 10, 0.5);
    const still = new PlayerPhysics(lake, swimmer);
    run(still, 1);
    expect(Math.hypot(swimmer.position.x - 0.5, swimmer.position.z - 0.5)).toBeLessThan(1e-6);
  });

  it('a waterfall pushes a swimmer down, though swimming up still climbs it', () => {
    const world = flatWorld();
    for (let y = 10; y <= 20; y++) world.setVoxel(0, y, 0, WATER_FALLING);
    const calm = flatWorld();
    calm.fill(0, 10, 0, 0, 20, 0, 'water');
    const a = makePlayer(createBus(), 0.5, 15, 0.5);
    const b = makePlayer(createBus(), 0.5, 15, 0.5);
    a.onGround = b.onGround = false;
    const fall = new PlayerPhysics(world, a);
    const pool = new PlayerPhysics(calm, b);
    run(fall, 0.5);
    run(pool, 0.5);
    expect(a.position.y).toBeLessThan(b.position.y - 0.5);
    const up = { moveX: 0, moveZ: 0, jump: true, sprint: false };
    const y0 = a.position.y;
    run(fall, 1, up);
    expect(a.position.y).toBeGreaterThan(y0 + 0.5);
  });
});

describe('jump assist in the physics', () => {
  it('lets a jump pressed just after walking off an edge work, unless assist is off', () => {
    for (const assist of [true, false]) {
      const world = new PatchyWorld(null);
      world.fill(-4, 9, 0, 4, 9, 4, 'stone');
      const player = makePlayer(createBus(), 0.5, 10, 0.5);
      const physics = new PlayerPhysics(world, player);
      physics.assist = assist;
      let jumped = false;
      for (let i = 0; i < 60 && !jumped; i++) {
        const stepped = physics.step(1 / 60, { moveX: 0, moveZ: 1, jump: false, sprint: false });
        if (!player.onGround && player.position.z < -0.3) {
          const r = physics.step(1 / 60, { moveX: 0, moveZ: 1, jump: true, sprint: false });
          jumped = r.jumped;
          break;
        }
        void stepped;
      }
      expect(jumped).toBe(assist);
    }
  });
});
