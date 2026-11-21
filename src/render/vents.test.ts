import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { AIR, makeVoxel } from '../core/types';
import { createWorldUniforms } from './materials';
import { Particles } from './particles';
import { FakeWorld } from './testKit';
import { HISS_GAP_S, HISS_MAX_S, HISS_RANGE, SteamVents } from './vents';

function setup() {
  const bus = createBus();
  const world = new FakeWorld(10);
  const particles = new Particles(createWorldUniforms(null), 4096);
  const vents = new SteamVents(bus, world, particles);
  const hisses: { x?: number; y?: number; z?: number }[] = [];
  bus.on('sfx', (e) => {
    if (e.name === 'steam_hiss') hisses.push({ x: e.x, y: e.y, z: e.z });
  });
  const step = (seconds: number, cam: [number, number, number] = [0.5, 12, 0.5]): void => {
    for (let t = 0; t < seconds - 1e-9; t += 0.05) {
      vents.update(0.05, cam[0], cam[1], cam[2]);
      particles.update(0.05, 0, 0);
    }
  };
  return { bus, world, particles, vents, hisses, step };
}

describe('steam vents', () => {
  it('breathe steam from their tops and hiss at the vent, no more often than the gap allows', () => {
    const { world, particles, vents, hisses, step } = setup();
    world.put(3, 10, 2, 'steam_vent');
    world.put(5, 10, 2, 'steam_vent');
    step(HISS_MAX_S * 3);
    expect(vents.count).toBe(2);
    expect(particles.count).toBeGreaterThan(5);
    expect(hisses.length).toBeGreaterThanOrEqual(2);
    for (const h of hisses) {
      expect(h.y).toBe(11);
      expect([3.5, 5.5]).toContain(h.x);
    }
    // Two vents, but never two hisses closer together than the gap: at most one per gap over the run.
    expect(hisses.length).toBeLessThanOrEqual(Math.ceil((HISS_MAX_S * 3) / HISS_GAP_S));
  });

  it('is silent beyond the hiss range but still steams in view, and stops when the top is covered', () => {
    const { bus, world, particles, vents, hisses, step } = setup();
    world.put(HISS_RANGE + 6, 10, 0, 'steam_vent');
    step(HISS_MAX_S * 2);
    expect(vents.count).toBe(1);
    expect(hisses).toHaveLength(0);
    expect(particles.count).toBeGreaterThan(0);
    world.put(HISS_RANGE + 6, 11, 0, 'stone');
    step(1);
    expect(vents.count).toBe(0);
    // A vent broken away is forgotten after its chunk is rescanned.
    world.put(HISS_RANGE + 6, 11, 0, 'air');
    world.setVoxel(HISS_RANGE + 6, 10, 0, AIR);
    bus.emit('block:changed', { x: HISS_RANGE + 6, y: 10, z: 0, from: makeVoxel(blockId('steam_vent')), to: AIR, source: 'player' });
    step(1);
    expect(vents.count).toBe(0);
  });
});
