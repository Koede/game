import { describe, expect, it } from 'vitest';
import { NightlifeFx, critterParticles } from './nightlifeFx';

describe('nightlife particles', () => {
  it('draws a firefly while it glows, a bat always, an owl as two eyes unless it blinks', () => {
    expect(critterParticles({ kind: 'firefly', x: 1, y: 2, z: 3, glow: 1 }, 0.016)).toHaveLength(1);
    expect(critterParticles({ kind: 'firefly', x: 1, y: 2, z: 3, glow: 0 }, 0.016)).toHaveLength(0);
    expect(critterParticles({ kind: 'bat', x: 0, y: 0, z: 0, glow: 0 }, 0.016)).toHaveLength(1);
    expect(critterParticles({ kind: 'owl', x: 0, y: 0, z: 0, glow: 1 }, 0.016)).toHaveLength(2);
    expect(critterParticles({ kind: 'owl', x: 0, y: 0, z: 0, glow: 0 }, 0.016)).toHaveLength(0);
  });

  it('spawns nothing when paused', () => {
    const got: unknown[] = [];
    const fx = new NightlifeFx((p) => got.push(p));
    fx.update(0, [{ kind: 'bat', x: 0, y: 0, z: 0, glow: 0 }]);
    expect(got).toHaveLength(0);
    fx.update(0.016, [{ kind: 'bat', x: 0, y: 0, z: 0, glow: 0 }]);
    expect(got).toHaveLength(1);
  });
});
