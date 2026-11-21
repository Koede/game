import { describe, expect, it } from 'vitest';
import { Glows } from './glows';
import { createWorldUniforms } from './materials';
import { ParticleLook, Particles, type ParticleSpec } from './particles';

const spec = (over: Partial<ParticleSpec> = {}): ParticleSpec => ({
  x: 0, y: 10, z: 0, vx: 0, vy: 0, vz: 0, life: 1, size: 0.1, sizeEnd: 0.2,
  r: 1, g: 0, b: 0, r2: 0, g2: 0, b2: 1, alpha: 1, gravity: 0, drag: 0, look: ParticleLook.Chip, fog: 1, ...over,
});

describe('particle pool', () => {
  it('spawns, moves and expires particles, keeping the live ones packed', () => {
    const p = new Particles(createWorldUniforms(null), 16);
    p.spawn(spec({ life: 0.5, vx: 2 }));
    p.spawn(spec({ life: 2 }));
    p.spawn(spec({ life: 0.5 }));
    expect(p.count).toBe(3);
    p.update(0.25, 0, 0);
    expect(p.count).toBe(3);
    const pos = p.points.geometry.getAttribute('position').array as Float32Array;
    expect(pos[0]).toBeCloseTo(0.5, 5);
    p.update(0.3, 0, 0);
    expect(p.count).toBe(1);
    expect(p.points.geometry.drawRange.count).toBe(1);
    p.update(2, 0, 0);
    expect(p.count).toBe(0);
  });

  it('applies gravity and drag, and blends colour and size over its life', () => {
    const p = new Particles(createWorldUniforms(null), 4);
    p.spawn(spec({ gravity: 10, life: 10 }));
    for (let i = 0; i < 10; i++) p.update(0.1, 0, 0);
    const pos = p.points.geometry.getAttribute('position').array as Float32Array;
    expect(pos[1]).toBeLessThan(10 - 4);
    const color = p.points.geometry.getAttribute('aColor').array as Float32Array;
    // After 10% of the life the colour is already half-way (colour moves 5x faster than size).
    expect(color[0]).toBeCloseTo(0.5, 1);
    const size = p.points.geometry.getAttribute('aSize').array as Float32Array;
    expect(size[0]).toBeCloseTo(0.11, 2);
  });

  it('never grows past its capacity', () => {
    const p = new Particles(createWorldUniforms(null), 8);
    for (let i = 0; i < 50; i++) p.spawn(spec({ life: 5 }));
    expect(p.count).toBe(8);
    p.update(0.016, 0, 0);
    expect(p.points.geometry.drawRange.count).toBe(8);
  });

  it('drifts puffs with the wind but not chips', () => {
    const p = new Particles(createWorldUniforms(null), 4);
    p.spawn(spec({ life: 10, look: ParticleLook.Puff }));
    p.spawn(spec({ life: 10, look: ParticleLook.Chip }));
    for (let i = 0; i < 20; i++) p.update(0.1, 1, 0);
    const pos = p.points.geometry.getAttribute('position').array as Float32Array;
    expect(pos[0]).toBeGreaterThan(0.5);
    expect(pos[3]).toBe(0);
  });
});

describe('glows', () => {
  it('lists the halos of one frame and hides when there are none', () => {
    const g = new Glows(2);
    g.begin(0);
    g.add(1, 2, 3, 2, 0.5, 0.2, 0.1);
    g.add(4, 5, 6, 2, 0.5, 0.2, 0.1);
    g.add(7, 8, 9, 2, 0.5, 0.2, 0.1);
    g.end();
    expect(g.points.geometry.drawRange.count).toBe(2);
    expect(g.points.visible).toBe(true);
    g.begin(1);
    g.end();
    expect(g.points.visible).toBe(false);
  });
});
