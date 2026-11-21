import { describe, expect, it } from 'vitest';
import { GRAVITY, HUNGRY_AT, JUMP_VELOCITY, MAX_HEALTH, SPRING_JUMP_MULT, SPRINT_SPEED, SWIFT_SPEED_MULT, SWIM_SPEED, WALK_SPEED } from '../core/constants';
import { createBus } from '../core/context';
import { springFallAllowance } from '../game';
import { PlayerPhysics } from './physics';
import { flatWorld, idle, makePlayer, type PatchyWorld } from './testKit';

const DT = 1 / 60;
const FORWARD = { moveX: 0, moveZ: 1, jump: false, sprint: false };

function run(physics: PlayerPhysics, seconds: number, input = idle()): void {
  for (let t = 0; t < seconds; t += DT) physics.step(DT, input);
}

/** Highest height gained by one jump from the floor (feet at y 10). */
function apexOf(buff: 'spring' | null): { apex: number; health: number } {
  const player = makePlayer(createBus(), 0.5, 10, 0.5);
  if (buff) player.buffs.grant(buff, 1000);
  const physics = new PlayerPhysics(flatWorld(), player);
  run(physics, 0.2);
  let apex = 0;
  physics.step(DT, { ...idle(), jump: true });
  for (let i = 0; i < 120; i++) {
    physics.step(DT, idle());
    apex = Math.max(apex, player.position.y - 10);
  }
  expect(player.onGround).toBe(true);
  return { apex, health: player.health };
}

describe('Spring', () => {
  it('jumps (1.35)^2 times as high, and the normal jump is unchanged', () => {
    const plain = apexOf(null).apex;
    expect(plain).toBeCloseTo((JUMP_VELOCITY * JUMP_VELOCITY) / (2 * GRAVITY), 1);
    const spring = apexOf('spring').apex;
    expect(spring / plain).toBeCloseTo(SPRING_JUMP_MULT * SPRING_JUMP_MULT, 1);
    expect(spring).toBeGreaterThan(plain + 0.9);
  });

  it('never hurts on flat ground, jump after jump', () => {
    const player = makePlayer(createBus(), 0.5, 10, 0.5);
    player.buffs.grant('spring', 1000);
    const physics = new PlayerPhysics(flatWorld(), player);
    for (let jumps = 0; jumps < 6; jumps++) run(physics, 1, { ...idle(), jump: true });
    expect(player.health).toBe(MAX_HEALTH);
  });

  it('adds (mult^2 - 1) x the normal jump height to the safe fall', () => {
    const extra = springFallAllowance(SPRING_JUMP_MULT);
    expect(extra).toBeCloseTo((SPRING_JUMP_MULT ** 2 - 1) * 1.2933, 3);
    expect(springFallAllowance(1)).toBe(0);
    const land = (fromY: number, spring: boolean): number => {
      const player = makePlayer(createBus(), 0.5, fromY, 0.5);
      player.onGround = false;
      if (spring) player.buffs.grant('spring', 1000);
      const physics = new PlayerPhysics(flatWorld(), player);
      run(physics, 3);
      return MAX_HEALTH - player.health;
    };
    // A 4.5 block fall is 1 damage; with Spring it falls inside the safe height.
    expect(land(14.5, false)).toBe(1);
    expect(land(14.5, true)).toBe(0);
    // Past the allowance it hurts again, but less than without it.
    expect(land(20, false)).toBe(6);
    expect(land(20, true)).toBe(5);
  });

  it('keeps the allowance for the fall it boosted when the drink runs out mid-air', () => {
    const player = makePlayer(createBus(), 0.5, 14.5, 0.5);
    player.onGround = false;
    player.buffs.grant('spring', 0.1);
    const physics = new PlayerPhysics(flatWorld(), player);
    physics.step(DT, idle());
    player.buffs.tick(1);
    expect(player.buffs.has('spring')).toBe(false);
    run(physics, 3);
    expect(player.health).toBe(MAX_HEALTH);
  });
});

describe('Swift', () => {
  it('walks and sprints 1.2 times as fast', () => {
    const player = makePlayer();
    player.buffs.grant('swift', 1000);
    const physics = new PlayerPhysics(flatWorld(), player);
    run(physics, 1, FORWARD);
    expect(-player.velocity.z).toBeCloseTo(WALK_SPEED * SWIFT_SPEED_MULT, 1);
    run(physics, 0.6, { ...FORWARD, sprint: true });
    expect(-player.velocity.z).toBeCloseTo(SPRINT_SPEED * SWIFT_SPEED_MULT, 1);
  });

  it('swims 1.2 times as fast', () => {
    const swim = (swift: boolean): number => {
      const world: PatchyWorld = flatWorld();
      world.fill(-12, 10, -12, 12, 14, 12, 'water');
      const player = makePlayer(createBus(), 0.5, 12, 0.5);
      if (swift) player.buffs.grant('swift', 1000);
      const physics = new PlayerPhysics(world, player);
      run(physics, 1.5, FORWARD);
      return Math.hypot(player.velocity.x, player.velocity.z);
    };
    const plain = swim(false);
    expect(plain).toBeCloseTo(SWIM_SPEED, 0);
    expect(swim(true) / plain).toBeCloseTo(SWIFT_SPEED_MULT, 1);
  });

  it('does not let a Hungry player sprint', () => {
    const player = makePlayer();
    player.buffs.grant('swift', 1000);
    player.food = HUNGRY_AT;
    const physics = new PlayerPhysics(flatWorld(), player);
    run(physics, 1.5, { ...FORWARD, sprint: true });
    expect(physics.result.sprinting).toBe(false);
    expect(-player.velocity.z).toBeCloseTo(WALK_SPEED * SWIFT_SPEED_MULT, 1);
  });

  it('is not slower or faster for the other drinks', () => {
    const player = makePlayer();
    player.buffs.grant('vigor', 1000);
    player.buffs.grant('spring', 1000);
    const physics = new PlayerPhysics(flatWorld(), player);
    run(physics, 1, FORWARD);
    expect(-player.velocity.z).toBeCloseTo(WALK_SPEED, 1);
  });
});
