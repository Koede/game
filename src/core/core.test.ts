import { describe, expect, it, vi } from 'vitest';
import { EventBus } from './events';
import { Noise, hash32, hashFloat, mod, mulberry32, seedFromString, smoothstep } from './math';
import { Facing, makeVoxel, voxelActive, voxelFacing, voxelId, voxelIndex, voxelVariant, withActive, withId } from './types';

describe('math', () => {
  it('hashes deterministically into range', () => {
    expect(hash32(1, 2, 3)).toBe(hash32(1, 2, 3));
    expect(hash32(1, 2, 3)).not.toBe(hash32(3, 2, 1));
    for (let i = 0; i < 1000; i++) {
      const f = hashFloat(i, -i, i * 7);
      expect(f).toBeGreaterThanOrEqual(0);
      expect(f).toBeLessThan(1);
    }
  });

  it('spreads hashFloat roughly uniformly', () => {
    let sum = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) sum += hashFloat(i, 99);
    expect(sum / n).toBeGreaterThan(0.48);
    expect(sum / n).toBeLessThan(0.52);
  });

  it('seeds the PRNG reproducibly', () => {
    const a = mulberry32(42);
    const b = mulberry32(42);
    const c = mulberry32(43);
    const seqA = [a(), a(), a()];
    expect([b(), b(), b()]).toEqual(seqA);
    expect([c(), c(), c()]).not.toEqual(seqA);
    expect(seedFromString('hearth')).toBe(seedFromString('hearth'));
    expect(seedFromString('hearth')).not.toBe(seedFromString('watt'));
  });

  it('floors modulo for negatives', () => {
    expect(mod(-1, 16)).toBe(15);
    expect(mod(-16, 16)).toBe(0);
    expect(mod(17, 16)).toBe(1);
    expect(smoothstep(0, 1, -1)).toBe(0);
    expect(smoothstep(0, 1, 2)).toBe(1);
  });

  it('produces bounded, seed-dependent, continuous noise', () => {
    const n1 = new Noise(7);
    const n2 = new Noise(7);
    const n3 = new Noise(8);
    let differs = false;
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0; i < 4000; i++) {
      const x = (i % 63) * 0.173 - 5;
      const y = Math.floor(i / 63) * 0.211 - 5;
      const a = n1.noise2(x, y);
      expect(a).toBe(n2.noise2(x, y));
      if (a !== n3.noise2(x, y)) differs = true;
      const b = n1.noise3(x, y, i * 0.05);
      for (const v of [a, b, n1.fbm2(x, y), n1.fbm3(x, y, 1.5)]) {
        expect(Math.abs(v)).toBeLessThanOrEqual(1.05);
        min = Math.min(min, v);
        max = Math.max(max, v);
      }
      expect(Math.abs(n1.noise2(x + 0.001, y) - a)).toBeLessThan(0.01);
    }
    expect(differs).toBe(true);
    expect(min).toBeLessThan(-0.5);
    expect(max).toBeGreaterThan(0.5);
  });
});

describe('voxel encoding', () => {
  it('packs and unpacks every field independently', () => {
    const v = makeVoxel(777, Facing.West, true, 5);
    expect(voxelId(v)).toBe(777);
    expect(voxelFacing(v)).toBe(Facing.West);
    expect(voxelActive(v)).toBe(true);
    expect(voxelVariant(v)).toBe(5);
    expect(v).toBeLessThan(65536);
    const off = withActive(v, false);
    expect(voxelActive(off)).toBe(false);
    expect(voxelId(off)).toBe(777);
    expect(voxelFacing(off)).toBe(Facing.West);
    const swapped = withId(v, 12);
    expect(voxelId(swapped)).toBe(12);
    expect(voxelFacing(swapped)).toBe(Facing.West);
    expect(voxelActive(swapped)).toBe(true);
    expect(voxelVariant(swapped)).toBe(5);
  });

  it('indexes a chunk without collisions', () => {
    expect(voxelIndex(0, 0, 0)).toBe(0);
    expect(voxelIndex(15, 0, 0)).toBe(15);
    expect(voxelIndex(0, 0, 1)).toBe(16);
    expect(voxelIndex(0, 1, 0)).toBe(256);
    expect(voxelIndex(15, 95, 15)).toBe(16 * 16 * 96 - 1);
  });
});

describe('EventBus', () => {
  interface Events {
    ping: { n: number };
    pong: Record<string, never>;
  }

  it('delivers, unsubscribes and supports once', () => {
    const bus = new EventBus<Events>();
    const seen: number[] = [];
    const off = bus.on('ping', (p) => seen.push(p.n));
    bus.once('ping', (p) => seen.push(p.n * 10));
    bus.emit('ping', { n: 1 });
    bus.emit('ping', { n: 2 });
    off();
    bus.emit('ping', { n: 3 });
    expect(seen).toEqual([1, 10, 2]);
  });

  it('isolates a throwing listener from the others', () => {
    const bus = new EventBus<Events>();
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    let reached = false;
    bus.on('pong', () => {
      throw new Error('boom');
    });
    bus.on('pong', () => {
      reached = true;
    });
    expect(() => bus.emit('pong', {})).not.toThrow();
    expect(reached).toBe(true);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('lets a listener unsubscribe itself while being called', () => {
    const bus = new EventBus<Events>();
    let calls = 0;
    const off = bus.on('ping', () => {
      calls++;
      off();
    });
    bus.on('ping', () => {
      calls++;
    });
    bus.emit('ping', { n: 0 });
    bus.emit('ping', { n: 0 });
    expect(calls).toBe(3);
  });
});
