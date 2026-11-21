import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { Face } from '../core/types';
import { createRayHit, raycast } from './raycast';
import { PatchyWorld } from './testKit';

const hit = createRayHit();

describe('raycast', () => {
  it('reports the entry face and the neighbour across it for every axis direction', () => {
    const world = new PatchyWorld();
    world.put(0, 10, 0, 'stone');
    const cases: Array<[number, number, number, number, number, number, Face, [number, number, number]]> = [
      [-2.5, 10.5, 0.5, 1, 0, 0, Face.NX, [-1, 10, 0]],
      [3.5, 10.5, 0.5, -1, 0, 0, Face.PX, [1, 10, 0]],
      [0.5, 13.5, 0.5, 0, -1, 0, Face.PY, [0, 11, 0]],
      [0.5, 7.5, 0.5, 0, 1, 0, Face.NY, [0, 9, 0]],
      [0.5, 10.5, 3.5, 0, 0, -1, Face.PZ, [0, 10, 1]],
      [0.5, 10.5, -2.5, 0, 0, 1, Face.NZ, [0, 10, -1]],
    ];
    for (const [ox, oy, oz, dx, dy, dz, face, [px, py, pz]] of cases) {
      const r = raycast(world, ox, oy, oz, dx, dy, dz, REACH, false, hit);
      expect(r, `ray from ${ox},${oy},${oz}`).not.toBeNull();
      expect(r).toMatchObject({ x: 0, y: 10, z: 0, face, px, py, pz });
      expect(r!.block.key).toBe('stone');
    }
  });

  it('measures the distance to the entry point and respects reach', () => {
    const world = new PatchyWorld();
    world.put(0, 10, -5, 'stone');
    const r = raycast(world, 0.5, 10.5, 0.5, 0, 0, -1, REACH, false, hit);
    expect(r!.distance).toBeCloseTo(4.5, 9);
    expect(raycast(world, 0.5, 10.5, 1.0, 0, 0, -1, REACH, false, hit)?.distance).toBeCloseTo(5, 9);
    expect(raycast(world, 0.5, 10.5, 1.1, 0, 0, -1, REACH, false, hit)).toBeNull();
  });

  it('works at negative coordinates and on diagonals', () => {
    const world = new PatchyWorld();
    world.put(-7, 3, -9, 'dirt');
    const ox = -4.2;
    const oy = 4.6;
    const oz = -6.3;
    const tx = -6.5;
    const ty = 3.5;
    const tz = -8.5;
    const r = raycast(world, ox, oy, oz, tx - ox, ty - oy, tz - oz, REACH, false, hit);
    expect(r).toMatchObject({ x: -7, y: 3, z: -9 });
    const n = [r!.px - r!.x, r!.py - r!.y, r!.pz - r!.z];
    expect(Math.abs(n[0]) + Math.abs(n[1]) + Math.abs(n[2])).toBe(1);
  });

  it('skips air and liquids unless asked, and targets thin shapes by their whole cell', () => {
    const world = new PatchyWorld();
    world.put(0, 10, -1, 'water');
    world.put(0, 10, -2, 'torch');
    world.put(0, 10, -3, 'stone');
    expect(raycast(world, 0.5, 10.5, 0.5, 0, 0, -1, REACH, false, hit)?.block.key).toBe('torch');
    expect(raycast(world, 0.5, 10.5, 0.5, 0, 0, -1, REACH, true, hit)?.block.key).toBe('water');
    world.put(0, 10, -2, 'tall_grass');
    expect(raycast(world, 0.5, 10.9, 0.5, 0, 0, -1, REACH, false, hit)?.block.key).toBe('tall_grass');
  });

  it('stops at unloaded columns and the bottom of the world', () => {
    const world = new PatchyWorld();
    world.put(0, 10, -3, 'stone');
    world.unload(0, -2);
    expect(raycast(world, 0.5, 10.5, 0.5, 0, 0, -1, REACH, false, hit)).toBeNull();
    expect(raycast(world, 0.5, 2.5, 0.5, 0, -1, 0, REACH, false, hit)).toBeNull();
  });

  it('does not test the cell the eye is in', () => {
    const world = new PatchyWorld();
    world.put(0, 10, 0, 'tall_grass');
    world.put(0, 10, -2, 'stone');
    expect(raycast(world, 0.5, 10.5, 0.5, 0, 0, -1, REACH, false, hit)?.z).toBe(-2);
  });
});
