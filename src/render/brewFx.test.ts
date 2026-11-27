import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { BREW_STEAM_S } from '../core/constants';
import { blockId } from '../core/registry';
import { BREW_FX_RANGE, BREW_SOURCES, BrewFx } from './brewFx';
import { BrewLiquid, LIQUID_CAPACITY } from './brewLiquid';
import { createWorldUniforms } from './materials';
import { Particles } from './particles';
import { FakeWorld } from './testKit';

const bucket = (x: number, boiling: boolean) => ({ kind: 'boil_bucket', x, y: 11, z: 2, heatS: 0, boiling, dryS: 0, container: 'water_pail' });
const cup = (x: number, stage: string, over: Record<string, unknown> = {}) => ({ kind: 'brew_cup', x, y: 11, z: 4, stage, drink: 'light_roast', brewS: 1, steamS: 0, ...over });

function setup() {
  const world = new FakeWorld(10);
  const particles = new Particles(createWorldUniforms(null), 4096);
  const fx = new BrewFx(world, particles);
  const step = (seconds: number, camX = 0): void => {
    for (let t = 0; t < seconds; t += 0.05) {
      fx.update(0.05, camX, 0);
      particles.update(0.05, 0, 0);
    }
  };
  return { world, particles, fx, step };
}

describe('brew emitters', () => {
  it('steams only over a bucket that boils', () => {
    const { world, particles, fx, step } = setup();
    world.put(2, 11, 2, 'furnace_bucket');
    world.setEntity(bucket(2, false));
    step(2);
    expect(fx.activeSources).toBe(0);
    expect(particles.count).toBe(0);
    world.put(2, 11, 2, 'furnace_bucket_boiling');
    world.setEntity(bucket(2, true));
    step(2);
    expect(fx.activeSources).toBe(1);
    expect(particles.count).toBeGreaterThan(4);
  });

  it('steams over a finished cup only while the sim says it is hot, and drips while it brews', () => {
    const { world, particles, fx, step } = setup();
    world.put(3, 11, 4, 'cup_full');
    world.setEntity(cup(3, 'done', { steamS: 0 }));
    step(1);
    expect(fx.activeSources).toBe(0);
    world.setEntity(cup(3, 'done', { steamS: BREW_STEAM_S }));
    step(1.5);
    expect(fx.activeSources).toBe(1);
    expect(particles.count).toBeGreaterThan(0);
    world.setEntity(cup(3, 'loaded'));
    step(1);
    expect(fx.activeSources).toBe(0);
    world.setEntity(cup(3, 'brewing'));
    step(1);
    expect(fx.activeSources).toBe(1);
  });

  it('steams from a kettle only while its voxel is lit (boiling)', () => {
    const { world, particles, fx, step } = setup();
    world.put(5, 11, 5, 'kettle_pot', 0, false);
    world.setEntity({ kind: 'kettle', x: 5, y: 11, z: 5 });
    step(1);
    expect(fx.activeSources).toBe(0);
    world.put(5, 11, 5, 'kettle_pot', 0, true);
    step(1.5);
    expect(fx.activeSources).toBe(1);
    expect(particles.count).toBeGreaterThan(2);
  });

  it('ignores sources out of range', () => {
    const { world, fx, step } = setup();
    world.setEntity(bucket(500, true));
    step(1);
    expect(fx.activeSources).toBe(0);
    step(1, 500 - BREW_FX_RANGE + 2);
    expect(fx.activeSources).toBe(1);
  });

  it('pools: a crowd of brewing blocks caps at the pool and the particle count stays bounded', () => {
    const { world, particles, fx, step } = setup();
    for (let i = 0; i < BREW_SOURCES + 30; i++) world.setEntity({ ...bucket(0, true), x: i % 10, z: Math.floor(i / 10) });
    step(3);
    expect(fx.activeSources).toBe(BREW_SOURCES);
    const settled = particles.count;
    step(20);
    // steady state: rate x life, not growing with time
    expect(particles.count).toBeLessThan(settled * 2 + 50);
    expect(particles.count).toBeLessThan(particles.capacity);
  });
});

describe('brew liquids', () => {
  const colour = (l: BrewLiquid, i: number): THREE.Color => {
    const c = new THREE.Color();
    l.mesh.getColorAt(i, c);
    return c;
  };
  const matrix = (l: BrewLiquid, i: number): THREE.Vector3 => {
    const m = new THREE.Matrix4();
    l.mesh.getMatrixAt(i, m);
    return new THREE.Vector3().setFromMatrixPosition(m);
  };

  it('draws a finished cup\'s drink inside the cup, in the drink item\'s colour; a brewing cup adds its stream', () => {
    const world = new FakeWorld(10);
    const liquid = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(1));
    world.setEntity(cup(3, 'loaded'));
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(0);
    world.setEntity(cup(3, 'done'));
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(1);
    expect(liquid.mesh.count).toBe(1);
    const p = matrix(liquid, 0);
    expect(p.x).toBeCloseTo(3.5);
    expect(p.y).toBeGreaterThan(11);
    expect(p.y).toBeLessThan(11 + 5 / 16);
    // light roast is 0x6b4423
    expect(colour(liquid, 0).r).toBeCloseTo(0x6b / 255);
    world.setEntity(cup(3, 'done', { drink: 'dark_roast' }));
    liquid.update(1, 0, 0);
    expect(colour(liquid, 0).r).toBeCloseTo(0x2c / 255);
    world.setEntity(cup(3, 'brewing', { brewS: 1 }));
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(2);
  });

  it('draws water in buckets and glass on the furnace top, and the kettle only while it boils', () => {
    const world = new FakeWorld(10);
    const liquid = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(1));
    world.setEntity(bucket(2, true));
    world.setEntity({ ...bucket(4, false), container: 'water_beaker' });
    world.put(6, 11, 2, 'kettle_pot', 0, false);
    world.setEntity({ kind: 'kettle', x: 6, y: 11, z: 2, waterL: 1, boiling: false });
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(2);
    world.put(6, 11, 2, 'kettle_pot', 0, true);
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(3);
  });

  it('is lit like its surroundings, rebuilds only a few times a second and never overflows', () => {
    const world = new FakeWorld(10);
    const dark = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(0.25));
    world.setEntity(cup(3, 'done'));
    dark.update(1, 0, 0);
    expect(colour(dark, 0).r).toBeCloseTo((0x6b / 255) * 0.4);
    world.setEntity(cup(5, 'done'));
    dark.update(0.05, 0, 0);
    expect(dark.count).toBe(1);
    for (let i = 0; i < LIQUID_CAPACITY + 20; i++) world.setEntity({ ...cup(0, 'done'), x: i % 10, z: 6 + Math.floor(i / 10) });
    dark.update(1, 0, 0);
    expect(dark.count).toBeLessThanOrEqual(LIQUID_CAPACITY);
    expect(dark.count).toBeGreaterThan(LIQUID_CAPACITY - 2);
    expect(blockId('cup_full')).toBeGreaterThan(0);
  });
});
