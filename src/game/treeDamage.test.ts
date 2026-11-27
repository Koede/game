import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { block } from '../core/registry';
import { FakeWorld } from './fakeWorld';
import { FallingTrees, type TreeVictims } from './fallingTrees';
import { PlayerState } from './playerState';
import { WAIT_S, advanceWait, impactDamage } from './treeFell';

/** A grass floor at y = 9 and an oak of 5 logs (base at y = 10). The player chops from the west, so it falls east. */
function grove(options: { treeDamage?: boolean; victims?: TreeVictims } = {}) {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-12, 9, -12, 12, 9, 12, 'grass');
  world.fill(0, 10, 0, 0, 14, 0, 'oak_log');
  const player = new PlayerState(bus, { x: -4.5, y: 10, z: 0.5 });
  player.inventory.set(player.selectedSlot, { item: 'steel_axe', count: 1, durability: 700 });
  const trees = new FallingTrees(world, player, bus, {
    rng: () => 0.5,
    treeDamage: () => options.treeDamage ?? true,
    victims: options.victims,
  });
  const hit = { x: 0, y: 10, z: 0, block: block('oak_log'), voxel: 0, face: 0 } as never;
  for (let n = 0; n < 50 && trees.trees().length === 0; n++) trees.chop(hit);
  return { world, player, trees, bus };
}

/** Ticks until the tree has its warning over and is falling (phase 'falling'). */
function untilFalling(t: ReturnType<typeof grove>): void {
  for (let n = 0; n < 600 && t.trees.trees()[0]?.phase !== 'falling'; n++) t.trees.tick(1 / 60);
}

/** Ticks until the tree has landed (or `seconds` pass). */
function untilLanded(t: ReturnType<typeof grove>, seconds = 20): void {
  for (let n = 0; n < seconds * 60 && t.trees.trees().length > 0; n++) t.trees.tick(1 / 60);
}

describe('the falling tree hurts what is under it', () => {
  it('waits while the player stands under it in the first 0.4 s: the body does not move', () => {
    const t = grove();
    t.player.position.x = 3.5; // on the fall line, before the warning ends: the tree will wait for them
    untilFalling(t);
    for (let n = 0; n < 20; n++) t.trees.tick(1 / 60); // 1/3 s with the player under it
    const tree = t.trees.trees()[0];
    expect(tree).toBeDefined();
    expect(tree.body.t).toBeCloseTo(0, 9);
    expect(tree.clock).toBeCloseTo(0, 9);
  });

  it('a player who steps under it after the first 0.4 s is hit when it lands on them', () => {
    const t = grove();
    untilFalling(t);
    t.player.position.x = -2.5; // behind the stump, out of the zone: the fall runs
    for (let n = 0; n < 60; n++) t.trees.tick(1 / 60);
    expect(t.trees.trees()[0].clock).toBeGreaterThan(WAIT_S);
    t.player.position.x = 3.5;
    const before = t.player.health;
    untilLanded(t);
    expect(t.player.health).toBeLessThan(before);
    expect(t.player.health).toBeGreaterThan(0);
  });

  it('a player well to the side is not hurt, and the tree still lands', () => {
    const t = grove();
    untilFalling(t);
    t.player.position.z = 9.5;
    const before = t.player.health;
    untilLanded(t);
    expect(t.player.health).toBe(before);
    expect(t.trees.logs()).toHaveLength(1);
  });

  it('with tree damage turned off nothing is hurt, but the tree still falls', () => {
    const t = grove({ treeDamage: false });
    untilFalling(t);
    t.player.position.x = -2.5;
    for (let n = 0; n < 60; n++) t.trees.tick(1 / 60);
    t.player.position.x = 3.5;
    const before = t.player.health;
    untilLanded(t);
    expect(t.player.health).toBe(before);
    expect(t.trees.logs()).toHaveLength(1);
  });

  it('creatures under the tree are hit once each', () => {
    const hits: Array<{ id: number; damage: number }> = [];
    const mob = { id: 7, x: 3.5, y: 10, z: 0.5 };
    const victims: TreeVictims = {
      get all() {
        return [mob];
      },
      hit(id, damage) {
        hits.push({ id, damage });
        return null;
      },
    };
    const t = grove({ victims });
    untilFalling(t);
    untilLanded(t);
    expect(hits.filter((h) => h.id === 7)).toHaveLength(1);
    expect(hits[0].damage).toBeGreaterThanOrEqual(1);
  });
});

describe('the wait and the damage rules, pure', () => {
  it('the clock holds only in the first WAIT_S with someone in the zone', () => {
    expect(advanceWait(0.1, 0.1, true)).toBe(0.1);
    expect(advanceWait(WAIT_S, 0.1, true)).toBeGreaterThan(WAIT_S);
  });

  it('damage is at least 1 and grows with the speed at the hit', () => {
    expect(impactDamage(5, 0)).toBeGreaterThanOrEqual(1);
    expect(impactDamage(5, 20)).toBeGreaterThanOrEqual(impactDamage(5, 2));
  });
});
