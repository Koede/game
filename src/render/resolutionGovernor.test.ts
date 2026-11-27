import { describe, expect, it } from 'vitest';
import { ResolutionGovernor } from './resolutionGovernor';

const run = (g: ResolutionGovernor, ms: number, frames: number): number => {
  let changes = 0;
  for (let i = 0; i < frames; i++) if (g.frame(ms)) changes++;
  return changes;
};

describe('ResolutionGovernor', () => {
  it('stays at full scale when frames are fast', () => {
    const g = new ResolutionGovernor();
    expect(run(g, 16.7, 2000)).toBe(0);
    expect(g.scale).toBe(1);
  });
  it('drops on sustained slow frames and never below the floor', () => {
    const g = new ResolutionGovernor();
    run(g, 45, 90);
    expect(g.scale).toBeLessThan(1);
    run(g, 45, 90 * 30);
    expect(g.scale).toBe(0.6);
  });
  it('recovers slowly once frames are fast again', () => {
    const g = new ResolutionGovernor();
    run(g, 45, 180);
    const low = g.scale;
    run(g, 16.7, 90 * 3);
    expect(g.scale).toBe(low);
    run(g, 16.7, 90 * 60);
    expect(g.scale).toBe(1);
  });
  it('ignores pauses and a single hitch', () => {
    const g = new ResolutionGovernor();
    for (let i = 0; i < 1000; i++) g.frame(i % 50 === 0 ? 600 : 16.7);
    expect(g.scale).toBe(1);
    run(g, 30, 85);
    g.frame(2000);
    g.frame(0);
    expect(g.scale).toBe(1);
  });
  it('does not flap on a mid-range device (slow but within the band)', () => {
    const g = new ResolutionGovernor();
    expect(run(g, 22, 90 * 50)).toBe(0);
  });
});
