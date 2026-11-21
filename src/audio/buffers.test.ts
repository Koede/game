import { describe, expect, it } from 'vitest';
import { BufferBank, fillCrackle, fillFlicker, fillNightChimes, fillNoise, type NoiseColor } from './buffers';
import { FakeAudioContext } from './fakeAudio';
import { softClip, softClipCurve } from './master';

const stats = (d: Float32Array) => {
  let peak = 0;
  let sum = 0;
  let sq = 0;
  for (const v of d) {
    peak = Math.max(peak, Math.abs(v));
    sum += v;
    sq += v * v;
  }
  return { peak, mean: sum / d.length, rms: Math.sqrt(sq / d.length) };
};

describe('generated buffers', () => {
  it.each(['white', 'pink', 'brown'] as NoiseColor[])('%s noise is loud enough, centred and never clips', (color) => {
    const d = new Float32Array(48000);
    fillNoise(d, color, 5);
    const s = stats(d);
    expect(s.peak).toBeLessThanOrEqual(0.9001);
    expect(s.peak).toBeGreaterThan(0.89);
    expect(Math.abs(s.mean)).toBeLessThan(1e-4);
    expect(s.rms).toBeGreaterThan(0.1);
  });

  it('is reproducible from its seed', () => {
    const a = new Float32Array(4096);
    const b = new Float32Array(4096);
    const c = new Float32Array(4096);
    fillNoise(a, 'pink', 9);
    fillNoise(b, 'pink', 9);
    fillNoise(c, 'pink', 10);
    expect(Array.from(a)).toEqual(Array.from(b));
    expect(Array.from(a)).not.toEqual(Array.from(c));
  });

  it('makes coloured noise darker than white noise', () => {
    // Mean absolute sample-to-sample step, relative to level: small for low-frequency-heavy noise.
    const roughness = (color: NoiseColor) => {
      const d = new Float32Array(48000);
      fillNoise(d, color, 3);
      let step = 0;
      for (let i = 1; i < d.length; i++) step += Math.abs(d[i] - d[i - 1]);
      return step / d.length / stats(d).rms;
    };
    expect(roughness('pink')).toBeLessThan(roughness('white'));
    expect(roughness('brown')).toBeLessThan(roughness('pink') / 2);
  });

  it('loops coloured noise without a jump at the seam', () => {
    const d = new Float32Array(48000);
    fillNoise(d, 'brown', 4);
    let typical = 0;
    for (let i = 1; i < d.length; i++) typical = Math.max(typical, Math.abs(d[i] - d[i - 1]));
    expect(Math.abs(d[0] - d[d.length - 1])).toBeLessThanOrEqual(typical * 1.5);
  });

  it('crackle is mostly silence with sharp pops, and denser when asked', () => {
    const quietShare = (density: number) => {
      const d = new Float32Array(48000 * 4);
      fillCrackle(d, 48000, density, 8);
      const s = stats(d);
      expect(s.peak).toBeLessThanOrEqual(0.9001);
      expect(Math.abs(s.mean)).toBeLessThan(1e-3);
      let quiet = 0;
      for (const v of d) if (Math.abs(v) < 0.01) quiet++;
      return quiet / d.length;
    };
    const sparse = quietShare(6);
    const dense = quietShare(30);
    expect(sparse).toBeGreaterThan(0.9);
    expect(dense).toBeLessThan(sparse);
  });

  it('flicker is a smooth control signal in [-1, 1]', () => {
    const d = new Float32Array(8000 * 4);
    fillFlicker(d, 8000, 5, 2);
    const s = stats(d);
    expect(s.peak).toBeLessThanOrEqual(1.0001);
    expect(s.rms).toBeGreaterThan(0.2);
    let maxStep = Math.abs(d[0] - d[d.length - 1]);
    for (let i = 1; i < d.length; i++) maxStep = Math.max(maxStep, Math.abs(d[i] - d[i - 1]));
    expect(maxStep).toBeLessThan(0.02);
  });

  it('night chimes are sparse, centred and never clip', () => {
    const d = new Float32Array(22050 * 15);
    fillNightChimes(d, 22050, 131);
    const s = stats(d);
    expect(s.peak).toBeLessThanOrEqual(0.9001);
    expect(Math.abs(s.mean)).toBeLessThan(1e-3);
    expect(s.rms).toBeGreaterThan(0.02);
    expect(s.rms).toBeLessThan(0.3);
  });

  it('BufferBank builds each buffer once', () => {
    const ctx = new FakeAudioContext();
    const bank = new BufferBank(ctx);
    expect(bank.noise('white')).toBe(bank.noise('white'));
    expect(bank.noise('pink')).not.toBe(bank.noise('brown'));
    expect(bank.crackle(true)).not.toBe(bank.crackle(false));
    bank.flicker();
    bank.flicker();
    bank.nightChimes();
    bank.nightChimes();
    expect(ctx.buffersCreated).toBe(7);
    expect(stats(bank.crackle(true).getChannelData(0)).peak).toBeGreaterThan(0.5);
  });

  it('BufferBank.warm generates one buffer per call until all exist', () => {
    const ctx = new FakeAudioContext();
    const bank = new BufferBank(ctx);
    const steps: number[] = [];
    let done = false;
    for (let i = 0; i < 12 && !done; i++) {
      done = bank.warm();
      steps.push(ctx.buffersCreated);
    }
    expect(steps).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(bank.warm()).toBe(true);
    bank.noise('pink');
    bank.nightChimes();
    expect(ctx.buffersCreated).toBe(7);
  });
});

describe('soft clipper', () => {
  it('is transparent at normal levels and never reaches full scale', () => {
    expect(softClip(0.3)).toBe(0.3);
    expect(softClip(-0.69)).toBe(-0.69);
    for (const x of [0.8, 1, 1.5, 2, 10, 1000]) {
      expect(softClip(x)).toBeLessThanOrEqual(0.95);
      expect(softClip(-x)).toBeGreaterThanOrEqual(-0.95);
    }
  });

  it('rises monotonically and symmetrically across the whole curve', () => {
    const curve = softClipCurve(513);
    for (let i = 1; i < curve.length; i++) expect(curve[i]).toBeGreaterThanOrEqual(curve[i - 1]);
    for (let i = 0; i < curve.length; i++) expect(curve[i]).toBeCloseTo(-curve[curve.length - 1 - i], 6);
    expect(curve[256]).toBe(0);
    expect(Math.max(...curve)).toBeLessThan(0.98);
  });
});
