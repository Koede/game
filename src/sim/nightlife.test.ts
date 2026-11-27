import { describe, expect, it } from 'vitest';
import { critters, darkOf, type NightEnv } from './nightlife';

const env = (p: Partial<NightEnv> = {}): NightEnv => ({
  seed: 3, dark: 1, raining: false, timeS: 10, biomeAt: () => 'marsh', surfaceY: () => 20, ...p,
});
const count = (e: NightEnv, kind: string): number => critters(e, 0, 0).filter((c) => c.kind === kind).length;

describe('nightlife', () => {
  it('is deterministic and keeps critters near the player', () => {
    expect(critters(env(), 0, 0)).toEqual(critters(env(), 0, 0));
    for (const c of critters(env(), 0, 0)) expect(Math.hypot(c.x, c.z)).toBeLessThan(80);
  });

  it('shows fireflies only when dark and dry, most in the marsh', () => {
    expect(count(env({ dark: 1 }), 'firefly')).toBeGreaterThan(20);
    expect(count(env({ dark: 0.1 }), 'firefly')).toBe(0);
    expect(count(env({ raining: true }), 'firefly')).toBe(0);
    expect(count(env({ biomeAt: () => 'woodland' }), 'firefly')).toBeLessThan(count(env(), 'firefly'));
    expect(count(env({ biomeAt: () => 'dunes' }), 'firefly')).toBe(0);
  });

  it('flies bats at dusk and dawn, not at noon or midnight or in the frostfell', () => {
    const w = { biomeAt: () => 'woodland' as const };
    expect(count(env({ ...w, dark: 0.5 }), 'bat')).toBeGreaterThan(0);
    expect(count(env({ ...w, dark: 0 }), 'bat')).toBe(0);
    expect(count(env({ ...w, dark: 1 }), 'bat')).toBe(0);
    expect(count(env({ biomeAt: () => 'frostfell', dark: 0.5 }), 'bat')).toBe(0);
  });

  it('perches owls in the woodland at deep night only, on top of the ground', () => {
    const w = { biomeAt: () => 'woodland' as const };
    const owls = critters(env({ ...w }), 0, 0).filter((c) => c.kind === 'owl');
    expect(owls.length).toBeGreaterThan(0);
    for (const o of owls) expect(o.y).toBeCloseTo(21.2);
    expect(count(env({ ...w, dark: 0.7 }), 'owl')).toBe(0);
    expect(count(env({ biomeAt: () => 'marsh' }), 'owl')).toBe(0);
  });

  it('skips unloaded columns and maps sunlight to darkness', () => {
    expect(critters(env({ surfaceY: () => -1 }), 0, 0)).toHaveLength(0);
    expect(darkOf(1)).toBe(0);
    expect(darkOf(0.08)).toBeCloseTo(0.92);
  });
});
