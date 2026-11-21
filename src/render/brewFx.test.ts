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

describe('cup liquid', () => {
  const positions = (l: BrewLiquid): Float32Array => (l.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array as Float32Array;
  const colours = (l: BrewLiquid): Float32Array => (l.mesh.geometry.getAttribute('color') as THREE.BufferAttribute).array as Float32Array;

  it('draws one quad per brewing or finished cup, at the rim, tinted by the drink item', () => {
    const world = new FakeWorld(10);
    const liquid = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(1));
    world.setEntity(cup(3, 'loaded'));
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(0);
    world.setEntity(cup(3, 'done'));
    liquid.update(1, 0, 0);
    expect(liquid.count).toBe(1);
    const y = positions(liquid)[1];
    expect(y).toBeGreaterThan(11 + 5 / 16);
    expect(y).toBeLessThan(11 + 6 / 16);
    // light roast is 0x6b4423
    expect(colours(liquid)[0]).toBeCloseTo(0x6b / 255);
    expect(colours(liquid)[2]).toBeCloseTo(0x23 / 255);
    world.setEntity(cup(3, 'done', { drink: 'dark_roast' }));
    liquid.update(1, 0, 0);
    expect(colours(liquid)[0]).toBeCloseTo(0x2c / 255);
  });

  it('starts as clear water while brewing and darkens as the drink comes through', () => {
    const world = new FakeWorld(10);
    const liquid = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(1));
    world.setEntity(cup(3, 'brewing', { brewS: 0 }));
    liquid.update(1, 0, 0);
    const start = colours(liquid)[0];
    world.setEntity(cup(3, 'brewing', { brewS: 3.9 }));
    liquid.update(1, 0, 0);
    expect(colours(liquid)[0]).toBeLessThan(start - 0.2);
  });

  it('is lit like its surroundings and never overflows its buffer', () => {
    const world = new FakeWorld(10);
    const dark = new BrewLiquid(world, (_x, _y, _z, out) => out.fill(0.25));
    world.setEntity(cup(3, 'done'));
    dark.update(1, 0, 0);
    expect(colours(dark)[0]).toBeCloseTo((0x6b / 255) * 0.25);
    for (let i = 0; i < LIQUID_CAPACITY + 20; i++) world.setEntity({ ...cup(0, 'done'), x: i, z: 40 });
    dark.update(1, 0, 0);
    expect(dark.count).toBe(LIQUID_CAPACITY);
    expect(blockId('cup_full')).toBeGreaterThan(0);
  });
});
