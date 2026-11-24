import { describe, expect, it } from 'vitest';
import { NOT_SMOKING, PUFF_FPS, PUFF_LIFE, SMOKE_DURATION, SMOKE_FRAMES, SMOKE_MAX, SmokePool, puffFrame, smokeAt, smokeStart } from './smoke';

describe('smoke schedule', () => {
  it('is deterministic', () => {
    for (const t of [0, 13.5, 61, 200.25, 999]) expect(smokeAt(t, 3)).toEqual(smokeAt(t, 3));
  });
  it('smokes for ~10 s with starts 46-70 s apart', () => {
    for (let k = 0; k < 200; k++) {
      const gap = smokeStart(k + 1, 5) - smokeStart(k, 5);
      expect(gap).toBeGreaterThanOrEqual(46 - 1e-9);
      expect(gap).toBeLessThanOrEqual(70 + 1e-9);
    }
    let on = 0;
    const T = 6000;
    for (let t = 0; t < T; t += 0.25) if (smokeAt(t, 1).smoking) on += 0.25;
    const duty = on / T;
    expect(duty).toBeGreaterThan(0.12);
    expect(duty).toBeLessThan(0.22);
    expect(smokeAt(smokeStart(4, 1) + SMOKE_DURATION + 0.01, 1)).toEqual(NOT_SMOKING);
  });
  it('raises and lowers the cigar at the ends', () => {
    const s = smokeStart(2, 0);
    expect(smokeAt(s + 0.1).raise).toBeLessThan(0.5);
    expect(smokeAt(s + 5).raise).toBe(1);
    expect(smokeAt(s + SMOKE_DURATION - 0.1).raise).toBeLessThan(0.5);
  });
  it('never while dancing, hired, talking or asleep', () => {
    const t = smokeStart(3, 0) + 5;
    expect(smokeAt(t).smoking).toBe(true);
    for (const ctx of [{ dancing: true }, { hired: true }, { talking: true }, { asleep: true }]) expect(smokeAt(t, 0, ctx).smoking).toBe(false);
  });
  it('is quiet before time starts', () => {
    expect(smokeAt(-1).smoking).toBe(false);
    expect(smokeAt(NaN).smoking).toBe(false);
  });
});

describe('smoke pool', () => {
  it('never exceeds its size, with two or three puffs overlapping at different ages', () => {
    const pool = new SmokePool();
    let max = 0;
    for (let i = 0; i < 600; i++) {
      pool.step(1 / 30, true, 0, 1, 0);
      if (i > 60) max = Math.max(max, pool.alive);
    }
    expect(max).toBeLessThanOrEqual(SMOKE_MAX);
    expect(max).toBeGreaterThanOrEqual(2);
    expect(pool.puffs.length).toBe(SMOKE_MAX);
  });
  it('lets the smoke finish after she stops, then empties', () => {
    const pool = new SmokePool();
    for (let i = 0; i < 90; i++) pool.step(1 / 30, true, 0, 1, 0);
    for (let i = 0; i < 30 * (PUFF_LIFE + 1); i++) pool.step(1 / 30, false, 0, 1, 0);
    expect(pool.alive).toBe(0);
  });
  it('puffs rise and play a fixed frame timeline', () => {
    const pool = new SmokePool();
    const p = pool.emit(0, 1, 0);
    for (let i = 0; i < 30; i++) pool.step(1 / 30, false, 0, 0, 0);
    expect(p.y).toBeGreaterThan(1.08);
    expect(puffFrame(0)).toBe(0);
    expect(puffFrame(0.65)).toBe(6);
    expect(puffFrame(PUFF_LIFE - 0.001)).toBe(SMOKE_FRAMES - 1);
    expect(PUFF_LIFE * PUFF_FPS).toBe(SMOKE_FRAMES);
  });
});
