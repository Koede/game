import { describe, expect, it } from 'vitest';
import { Facing, voxelFacing } from '../core/types';
import { setup } from './parts.test';

describe('contraptions', () => {
  it('a piston pushes a framed structure out with its depot stack, leaves a rod and pulls it back when it stops', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'piston', Facing.East);
    t.put(2, 0, 0, 'contraption_frame');
    t.put(3, 0, 0, 'depot');
    t.shop.offer(3, 0, 0, 'flint', 5);
    t.run(1, [[0, 0, 0]]);
    expect(t.world.getBlock(3, 0, 0).key).toBe('contraption_frame');
    expect(t.world.getBlock(4, 0, 0).key).toBe('depot');
    expect(t.shop.logi.peek(4, 0, 0)[0]).toEqual({ item: 'flint', count: 5 });
    expect(t.world.getBlock(2, 0, 0).key).toBe('contraption_frame'); // the rod
    expect(t.shop.describe(1, 0, 0)).toContain('extended');
    t.run(10); // the crank stops: the piston pulls everything back
    expect(t.world.getBlock(3, 0, 0).key).toBe('depot');
    expect(t.world.getBlock(2, 0, 0).key).toBe('contraption_frame');
    expect(t.world.getBlock(4, 0, 0).key).toBe('air');
    expect(t.shop.logi.peek(3, 0, 0)[0]).toEqual({ item: 'flint', count: 5 });
  });

  it('a piston stops at an obstacle and says so; terrain never moves', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'piston', Facing.East);
    t.put(2, 0, 0, 'contraption_frame');
    t.put(3, 0, 0, 'stone');
    t.run(3, [[0, 0, 0]]);
    expect(t.world.getBlock(2, 0, 0).key).toBe('contraption_frame');
    expect(t.world.getBlock(3, 0, 0).key).toBe('stone');
    expect(t.toasts.some((x) => x.includes('blocked by Stone at 3, 0, 0'))).toBe(true);
  });

  it('a bearing turns a structure a quarter turn, facings with it, left or right with the shaft', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'bearing');
    t.put(1, 1, 0, 'contraption_frame');
    t.put(2, 1, 0, 'mech_arm', Facing.North);
    t.run(1.7, [[0, 0, 0]]);
    expect(t.world.getBlock(2, 1, 0).key).toBe('air');
    expect(t.world.getBlock(1, 1, 1).key).toBe('mech_arm');
    expect(voxelFacing(t.world.getVoxel(1, 1, 1))).toBe(Facing.East);
    expect(t.world.getBlock(1, 1, 0).key).toBe('contraption_frame');
    // A reverse box turns it the other way.
    const u = setup();
    u.put(0, 0, 0, 'hand_crank');
    u.put(1, 0, 0, 'reverse_box');
    u.put(2, 0, 0, 'bearing');
    u.put(2, 1, 0, 'contraption_frame');
    u.put(3, 1, 0, 'contraption_frame');
    u.run(1.7, [[0, 0, 0]]);
    expect(u.world.getBlock(2, 1, -1).key).toBe('contraption_frame');
  });

  it('a belt on a turning platform still carries its items with it and the powered machine on it keeps its state', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'bearing');
    t.put(2, 1, 0, 'conveyor_belt', Facing.North);
    t.put(1, 1, 0, 'contraption_frame');
    t.ground.spawn('flint', 1, 2.5, 1.6, 0.5, { scatter: false });
    t.run(1.7, [[0, 0, 0]]);
    expect(t.world.getBlock(1, 1, 1).key).toBe('conveyor_belt');
    const item = t.ground.items.find((i) => i.item === 'flint');
    expect(item).toBeTruthy();
    expect(Math.floor(item!.x)).toBe(1);
    expect(item!.y).toBeGreaterThan(1.3);
  });

  it('a piston step keeps the voxel on the old cell until the step ends, and reports t halfway', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'piston', Facing.East);
    t.put(2, 0, 0, 'contraption_frame');
    t.shop.crank(0, 0, 0);
    t.shop.tick(0.4);
    expect(t.world.getBlock(2, 0, 0).key).toBe('contraption_frame');
    expect(t.world.getBlock(3, 0, 0).key).toBe('air');
    const mid = t.shop.contra.motions().find((m) => m.from[0] === 2 && m.from[1] === 0 && m.from[2] === 0);
    expect(mid).toBeTruthy();
    expect(mid?.to).toEqual([3, 0, 0]);
    expect(mid?.t).toBeCloseTo(0.5);
    expect(mid?.yaw).toBe(0);
    expect(mid?.pivot).toBeNull();
    t.shop.tick(0.4);
    expect(t.world.getBlock(3, 0, 0).key).toBe('contraption_frame');
    expect(t.world.getBlock(2, 0, 0).key).toBe('contraption_frame');
    expect(t.shop.contra.motions().some((m) => m.t >= 1)).toBe(false);
  });

  it('a bearing step yaws halfway and leaves the voxel on the old cell until the quarter turn commits', () => {
    const t = setup();
    t.put(0, 0, 0, 'hand_crank');
    t.put(1, 0, 0, 'bearing');
    t.put(1, 1, 0, 'contraption_frame');
    t.put(2, 1, 0, 'mech_arm', Facing.North);
    t.run(0.75, [[0, 0, 0]]);
    expect(t.world.getBlock(2, 1, 0).key).toBe('mech_arm');
    expect(t.world.getBlock(1, 1, 1).key).toBe('air');
    const mid = t.shop.contra.motions().find((m) => m.kind === 'mech_arm');
    expect(mid?.from).toEqual([2, 1, 0]);
    expect(mid?.to).toEqual([1, 1, 1]);
    expect(mid?.t).toBeCloseTo(0.5);
    expect(mid?.yaw).toBeCloseTo(Math.PI / 4);
    expect(mid?.pivot).toEqual([1, 0, 0]);
    t.run(0.75, [[0, 0, 0]]);
    expect(t.world.getBlock(2, 1, 0).key).toBe('air');
    expect(t.world.getBlock(1, 1, 1).key).toBe('mech_arm');
    expect(voxelFacing(t.world.getVoxel(1, 1, 1))).toBe(Facing.East);
  });

  it('a skiff step is halfway along the rail at 0.1 s and the voxel commits at 0.2 s', () => {
    const t = setup();
    for (let x = 0; x <= 3; x++) t.put(x, -1, 0, 'rail');
    t.put(1, 0, 0, 'skiff', Facing.East);
    t.run(0.1);
    expect(t.world.getBlock(1, 0, 0).key).toBe('skiff');
    expect(t.world.getBlock(2, 0, 0).key).toBe('air');
    const mid = t.shop.contra.motions().find((m) => m.kind === 'skiff');
    expect(mid?.from).toEqual([1, 0, 0]);
    expect(mid?.to).toEqual([2, 0, 0]);
    expect(mid?.t).toBeCloseTo(0.5);
    t.run(0.1);
    expect(t.world.getBlock(2, 0, 0).key).toBe('skiff');
    expect(t.world.getBlock(1, 0, 0).key).toBe('air');
  });

  it('a skiff rolls along rails, waits at the end, turns round and carries its stack', () => {
    const t = setup();
    for (let x = 0; x <= 4; x++) t.put(x, -1, 0, 'rail');
    t.put(1, 0, 0, 'skiff', Facing.East);
    t.shop.offer(1, 0, 0, 'flint', 3);
    t.run(1.5);
    expect(t.world.getBlock(4, 0, 0).key).toBe('skiff');
    expect(t.shop.logi.peek(4, 0, 0)[0]).toEqual({ item: 'flint', count: 3 });
    t.run(3);
    expect(t.world.getBlock(4, 0, 0).key).not.toBe('skiff');
    const at = [0, 1, 2, 3, 4].find((x) => t.world.getBlock(x, 0, 0).key === 'skiff');
    expect(at).toBeDefined();
    expect(t.shop.describe(at as number, 0, 0)).toContain('Skiff');
  });
});
