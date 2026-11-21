import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { blockId } from '../core/registry';
import { makeVoxel } from '../core/types';
import { Emitters } from './emitters';
import { Glows } from './glows';
import { createWorldUniforms } from './materials';
import { Particles } from './particles';
import { FakeWorld } from './testKit';

function setup() {
  const bus = createBus();
  const world = new FakeWorld(10);
  const particles = new Particles(createWorldUniforms(null), 4096);
  const glows = new Glows();
  const emitters = new Emitters(bus, world, particles, () => 1);
  const step = (seconds: number, cam = [0, 12, 0]): void => {
    for (let t = 0; t < seconds; t += 0.05) {
      emitters.update(0.05, cam[0], cam[1], cam[2], glows, t);
      particles.update(0.05, 0, 0);
    }
  };
  return { bus, world, particles, glows, emitters, step };
}

const furnace = (over: Record<string, unknown> = {}) => ({ kind: 'furnace', x: 2, y: 11, z: 2, tier: 1, tempC: 700, lit: true, draft: 0, ignited: false, ...over });

describe('emitters', () => {
  it('smokes and glows above a hot, lit furnace', () => {
    const { world, particles, glows, emitters, step } = setup();
    world.put(2, 11, 2, 'furnace_clay', 2, true);
    world.setEntity(furnace());
    step(2);
    expect(emitters.activeSources).toBe(1);
    expect(particles.count).toBeGreaterThan(6);
    expect(glows.points.geometry.drawRange.count).toBe(1);
  });

  it('keeps a cold furnace quiet, and an electrically heated one glows without smoke', () => {
    const { world, particles, glows, emitters, step } = setup();
    world.put(2, 11, 2, 'furnace_arc', 2, false);
    world.setEntity(furnace({ tier: 3, tempC: 20, lit: false }));
    step(2);
    expect(emitters.activeSources).toBe(0);
    expect(particles.count).toBe(0);
    world.setEntity(furnace({ tier: 3, tempC: 1500, lit: false }));
    step(2);
    expect(emitters.activeSources).toBe(1);
    expect(particles.count).toBe(0);
    expect(glows.points.geometry.drawRange.count).toBe(1);
  });

  it('only smokes furnaces within range of the camera', () => {
    const { world, emitters, step } = setup();
    world.setEntity(furnace({ x: 500 }));
    step(1);
    expect(emitters.activeSources).toBe(0);
    step(1, [450, 12, 0]);
    expect(emitters.activeSources).toBe(1);
  });

  it('steams from running steam machines only', () => {
    const { world, particles, emitters, step } = setup();
    world.put(4, 11, 4, 'steam_engine', 0, false);
    world.setEntity({ kind: 'steam_engine', x: 4, y: 11, z: 4 });
    step(1);
    expect(emitters.activeSources).toBe(0);
    world.put(4, 11, 4, 'steam_engine', 0, true);
    step(2);
    expect(emitters.activeSources).toBe(1);
    expect(particles.count).toBeGreaterThan(2);
  });

  it('bursts debris, sparks and smoke on events', () => {
    const { bus, world, particles } = setup();
    bus.emit('block:broken', { x: 0, y: 11, z: 0, voxel: makeVoxel(blockId('stone')) });
    const debris = particles.count;
    expect(debris).toBeGreaterThan(10);
    bus.emit('block:broken', { x: 0, y: 11, z: 0, voxel: 0 });
    expect(particles.count).toBe(debris);
    world.put(2, 11, 2, 'furnace_clay', 1, true);
    bus.emit('furnace:pumped', { x: 2, y: 11, z: 2, draft: 1 });
    expect(particles.count).toBeGreaterThan(debris + 20);
    const before = particles.count;
    bus.emit('explosion', { x: 0, y: 12, z: 0, radius: 3 });
    expect(particles.count).toBeGreaterThan(before + 150);
  });

  it('stops listening when disposed', () => {
    const { bus, particles, emitters } = setup();
    emitters.dispose();
    bus.emit('explosion', { x: 0, y: 12, z: 0, radius: 3 });
    expect(particles.count).toBe(0);
  });
});
