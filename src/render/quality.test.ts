import { describe, expect, it } from 'vitest';
import { GRAPHICS_PROFILES, GRAPHICS_QUALITIES, graphicsProfile } from './quality';

describe('graphics quality', () => {
  it('low drops the effects and pulls the fog in; high never does less than normal', () => {
    expect(graphicsProfile('low').fx).toBe(0);
    expect(graphicsProfile('low').fogEnd).toBeLessThan(graphicsProfile('normal').fogEnd);
    expect(graphicsProfile('high').fx).toBeGreaterThanOrEqual(graphicsProfile('normal').fx);
  });
  it('unknown values read as normal and every fog starts before it ends', () => {
    expect(graphicsProfile(undefined)).toBe(GRAPHICS_PROFILES.normal);
    expect(graphicsProfile('ultra')).toBe(GRAPHICS_PROFILES.normal);
    for (const q of GRAPHICS_QUALITIES) {
      const p = GRAPHICS_PROFILES[q];
      expect(p.fogStart).toBeGreaterThan(0);
      expect(p.fogStart).toBeLessThan(1);
      expect(p.fogEnd).toBeGreaterThan(0);
    }
  });
});
