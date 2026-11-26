import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { Facing, makeVoxel, voxelActive } from '../core/types';
import { settledWorld } from '../npcs/settledWorld';

/** The whole bridge in a real GameState: cranks -> dials -> dynamo -> cable -> lamp. */
describe('dynamo in a running world', () => {
  it('lights a lamp from a shaft line turning 96 rpm, and not from one turning 16', () => {
    const s = settledWorld(11, 'dynamo');
    const p = s.player.position;
    const x0 = Math.floor(p.x) + 3;
    const z0 = Math.floor(p.z) + 3;
    const y = s.world.surfaceY(x0, z0) + 1;
    const put = (x: number, yy: number, z: number, key: string): void => {
      expect(s.world.setVoxel(x, yy, z, makeVoxel(blockId(key), Facing.North), 'player'), key).toBe(true);
    };
    // Flat ground for the build: stone floor.
    for (let dx = -1; dx <= 8; dx++) for (let dz = -1; dz <= 2; dz++) s.world.setVoxel(x0 + dx, y - 1, z0 + dz, makeVoxel(blockId('stone')), 'player');
    put(x0, y, z0, 'hand_crank');
    put(x0, y, z0 + 1, 'hand_crank');
    put(x0 + 1, y, z0, 'dynamo');
    put(x0 + 2, y, z0, 'copper_cable');
    put(x0 + 3, y, z0, 'lamp');
    const turn = (): void => {
      s.workshop.use(x0, y, z0, null, () => undefined);
      s.workshop.use(x0, y, z0 + 1, null, () => undefined);
    };
    for (let i = 0; i < 100; i++) {
      if (i % 40 === 0) turn();
      s.tick();
    }
    // 16 rpm: under the dynamo's 64.
    expect(s.sim.machineView(x0 + 1, y, z0)!.availW).toBe(0);
    expect(voxelActive(s.world.getVoxel(x0 + 3, y, z0))).toBe(false);
    // A ratio dial between the crank and the dynamo: three dials of x2 would be 128; one x3 plus a second x2 is 96.
    s.world.setVoxel(x0 + 1, y, z0, 0, 'player');
    put(x0 + 1, y, z0, 'ratio_dial');
    put(x0 + 2, y, z0, 'ratio_dial');
    put(x0 + 3, y, z0, 'dynamo');
    put(x0 + 4, y, z0, 'copper_cable');
    put(x0 + 5, y, z0, 'lamp');
    for (let i = 0; i < 2; i++) s.workshop.use(x0 + 1, y, z0, null, () => undefined);
    for (let i = 0; i < 3; i++) s.workshop.use(x0 + 2, y, z0, null, () => undefined);
    for (let i = 0; i < 200; i++) {
      if (i % 40 === 0) turn();
      s.tick();
    }
    const view = s.sim.machineView(x0 + 3, y, z0)!;
    expect(view.availW).toBeGreaterThan(1900);
    expect(voxelActive(s.world.getVoxel(x0 + 5, y, z0))).toBe(true);
    s.dispose();
  });
});
