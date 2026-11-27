import { describe, expect, it } from 'vitest';
import { block } from '../core/registry';
import type { ParticleSpec } from './particles';
import { SeasonFx } from './seasonFx';

const oak = block('oak_leaves');
const air = block('air');
const world = {
  isLoaded: () => true,
  surfaceY: () => 10,
  getBlock: (_x: number, y: number) => (y === 14 || y === 15 ? oak : air),
};
let s = 1;
const rng = (): number => { s = (s * 16807) % 2147483647; return s / 2147483647; };

describe('SeasonFx', () => {
  it('sheds leaves from the underside of a crown when leaves are falling', () => {
    const got: ParticleSpec[] = [];
    const fx = new SeasonFx(world, (p) => got.push(p), rng);
    for (let i = 0; i < 60; i++) fx.update(0.05, 1, 0, 10, 0);
    expect(got.length).toBeGreaterThan(5);
    for (const p of got) { expect(p.y).toBeCloseTo(13.95, 5); expect(p.r).toBeGreaterThan(p.b); }
  });

  it('sheds nothing out of season or while paused', () => {
    const got: ParticleSpec[] = [];
    const fx = new SeasonFx(world, (p) => got.push(p), rng);
    for (let i = 0; i < 60; i++) fx.update(0.05, 0, 0, 10, 0);
    fx.update(0, 1, 0, 10, 0);
    expect(got).toHaveLength(0);
  });
});
