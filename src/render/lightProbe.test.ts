import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { CHUNK_SIZE, CHUNK_VOLUME, makeVoxel, voxelIndex, type Voxel } from '../core/types';
import { blockRamp, lightColor, LightProbe, skyRamp } from './lightProbe';
import { COOL_CYAN } from './shaders/chunk';
import { FakeWorld } from './testKit';

const WHITE = [1, 1, 1];
const WARM = [1, 0.7, 0.4];

describe('light ramps', () => {
  it('map full light to full brightness and fall off monotonically', () => {
    expect(skyRamp(1)).toBeCloseTo(1, 6);
    for (let l = 0; l < 15; l++) {
      expect(skyRamp(l / 15)).toBeLessThan(skyRamp((l + 1) / 15));
      expect(blockRamp(l / 15)).toBeLessThan(blockRamp((l + 1) / 15));
    }
    // Each sky level is roughly 0.8x the next one up: a cave mouth darkens fast but never to nothing.
    expect(skyRamp(14 / 15) / skyRamp(1)).toBeGreaterThan(0.75);
    expect(skyRamp(14 / 15) / skyRamp(1)).toBeLessThan(0.85);
    expect(skyRamp(0)).toBeGreaterThan(0.02);
  });

  it('lets a lit clay furnace (light 11) outshine moonlight two blocks away', () => {
    const moon = luminance(lightColor(1, 0, [0.23, 0.29, 0.45], WARM, 0.035, new Float32Array(3)));
    const fire = luminance(lightColor(0, 9 / 15, [0, 0, 0], WARM, 0.035, new Float32Array(3)));
    expect(fire).toBeGreaterThan(moon * 1.5);
  });

  it('never goes below the ambient floor and combines sky and block light without double-counting', () => {
    const out = new Float32Array(3);
    lightColor(0, 0, WHITE, WARM, 0.05, out);
    expect([...out].every((c) => Math.abs(c - 0.05) < 1e-6)).toBe(true);
    lightColor(1, 1, WHITE, WARM, 0, out);
    // max + 22% of the weaker one, per channel
    expect(out[0]).toBeCloseTo(Math.max(1, blockRamp(1)) + 0.22 * Math.min(1, blockRamp(1)), 5);
  });
});

describe('LightProbe', () => {
  it('reads full sky light in the open and none deep underground', () => {
    const world = new FakeWorld(10);
    const probe = new LightProbe(world);
    probe.probe(0.5, 12, 0.5);
    expect(probe.sky).toBe(1);
    expect(probe.block).toBe(0);
    probe.probe(0.5, 2, 0.5);
    expect(probe.sky).toBe(0);
  });

  it('finds the brightest emitter nearby, one level less per block (Manhattan distance)', () => {
    const world = new FakeWorld(10);
    world.put(3, 11, 0, 'torch');
    const probe = new LightProbe(world);
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.block * 15).toBeCloseTo(13 - 3, 6);
    world.put(0, 11, 1, 'furnace_clay', 0, true);
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.block * 15).toBeCloseTo(11 - 1, 6);
    world.put(0, 11, 1, 'furnace_clay', 0, false);
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.block * 15).toBeCloseTo(10, 6);
  });

  it('knows how much of the light is a cool glow: cyan by a glowcap, violet by crystals, warm when a torch outshines them', () => {
    const world = new FakeWorld(10);
    world.put(1, 11, 0, 'glowcap');
    const probe = new LightProbe(world);
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.cool).toBe(1);
    expect(probe.violet).toBe(false);
    const tint = probe.tint(WARM, new Float32Array(3));
    expect([...tint].map((v) => Math.round(v * 100) / 100)).toEqual([...COOL_CYAN].map((v) => Math.round(v * 100) / 100));
    world.put(-1, 11, 0, 'torch');
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.cool).toBeLessThan(0.3);
    expect(probe.block * 15).toBeCloseTo(12, 6);
    world.put(-1, 11, 0, 'air');
    world.put(1, 11, 0, 'crystal_cluster');
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.violet).toBe(true);
    expect(probe.cool).toBe(1);
  });

  it('lets sky light leak in sideways under a roof', () => {
    const world = new FakeWorld(10);
    for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) world.put(x, 14, z, 'plank');
    const probe = new LightProbe(world);
    probe.probe(0.5, 11.5, 0.5);
    expect(probe.sky).toBeGreaterThan(0.5);
    expect(probe.sky).toBeLessThan(1);
  });
});

describe('LightProbe on chunk voxel arrays', () => {
  it('matches the per-voxel scan exactly, across chunk borders, below and above the world, and next to unloaded chunks', () => {
    const chunked = new ChunkedWorld();
    const plain = new FakeWorld(-1);
    let seed = 7;
    const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const emitters = ['torch', 'glowcap', 'crystal_cluster', 'furnace_clay', 'plank'];
    for (let i = 0; i < 400; i++) {
      const x = Math.floor(rnd() * 64) - 32;
      const y = Math.floor(rnd() * 96);
      const z = Math.floor(rnd() * 64) - 32;
      const v = makeVoxel(blockId(emitters[i % emitters.length]), 0, rnd() < 0.5);
      if (chunked.set(x, y, z, v)) plain.setVoxel(x, y, z, v);
    }
    const a = new LightProbe(chunked);
    const b = new LightProbe(plain);
    for (let i = 0; i < 600; i++) {
      const x = rnd() * 70 - 35;
      const y = i % 10 === 0 ? 0.5 : i % 10 === 1 ? 95.5 : rnd() * 96;
      const z = rnd() * 70 - 35;
      a.probe(x, y, z);
      b.probe(x, y, z);
      expect([a.block, a.cool, a.violet]).toEqual([b.block, b.cool, b.violet]);
    }
  });
});

/** Voxels held per chunk like the real World; chunks with cx = 1 are never loaded (chunkVoxels gives null). */
class ChunkedWorld extends FakeWorld {
  private readonly chunks = new Map<string, Uint16Array>();
  constructor() {
    super(-1);
  }
  chunkVoxels(cx: number, cz: number): Uint16Array | null {
    if (cx === 1) return null;
    const k = `${cx},${cz}`;
    let c = this.chunks.get(k);
    if (!c) this.chunks.set(k, (c = new Uint16Array(CHUNK_VOLUME)));
    return c;
  }
  /** Stores a voxel; false (nothing stored) inside an unloaded chunk. */
  set(x: number, y: number, z: number, v: Voxel): boolean {
    const c = this.chunkVoxels(Math.floor(x / CHUNK_SIZE), Math.floor(z / CHUNK_SIZE));
    if (!c) return false;
    c[voxelIndex(x & 15, y, z & 15)] = v;
    return true;
  }
}

function luminance(c: ArrayLike<number>): number {
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
