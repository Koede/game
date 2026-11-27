import { describe, expect, it } from 'vitest';
import { sampleTags } from './settlement';

describe('sampleTags: power and light', () => {
  const at = { x: 0, y: 0, z: 0 };
  it('sees lamps as lights', () => {
    expect(sampleTags((x, y, z) => (x === 3 && y === 0 && z === 0 ? 'lamp' : 'air'), at).has('lights')).toBe(true);
  });
  it('needs two engines for noise, and noise ends the quiet', () => {
    const one = sampleTags((x, y, z) => (x === 3 && y === 0 && z === 0 ? 'steam_engine' : 'air'), at);
    expect(one.has('noise')).toBe(false);
    const two = sampleTags((x, y, z) => (y === 0 && z === 0 && (x === 3 || x === 6) ? 'steam_engine' : 'air'), at);
    expect(two.has('noise')).toBe(true);
  });
});
