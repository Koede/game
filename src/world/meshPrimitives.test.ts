import { describe, expect, it } from 'vitest';
import { Builder, lit } from './meshQuads';
import { helixQuads, helixTube, HELIX_SIDES, type Helix } from './meshPrimitives';
import { LIGHT_VOLUME } from './lighting';

const COIL: Helix = { cx: 0.5, cz: 0.5, radius: 0.125, tube: 0.0625, y0: 0.125, y1: 0.875, turns: 3 };

function emit(h: Helix): Builder {
  lit.light = new Uint8Array(LIGHT_VOLUME).fill(255);
  const b = new Builder();
  helixTube(b, 0, 0, 0, 0, 0, h);
  return b;
}

/** Triangles of a builder as [a, b, c] vertex positions (3 numbers each). */
function triangles(b: Builder): number[][][] {
  const out: number[][][] = [];
  for (let i = 0; i < b.count; i += 3) {
    const v = [b.indices[i], b.indices[i + 1], b.indices[i + 2]].map((k) => [b.positions[k * 3], b.positions[k * 3 + 1], b.positions[k * 3 + 2]]);
    out.push(v);
  }
  return out;
}

/** Closest point on the helix centre line to p (sampled densely: test-only accuracy is enough). */
function nearestCentre(h: Helix, p: number[]): number[] {
  let best = [0, 0, 0];
  let bestD = Infinity;
  const n = 4000;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const th = 2 * Math.PI * h.turns * t;
    const c = [h.cx + h.radius * Math.cos(th), h.y0 + (h.y1 - h.y0) * t, h.cz + h.radius * Math.sin(th)];
    const d = (c[0] - p[0]) ** 2 + (c[1] - p[1]) ** 2 + (c[2] - p[2]) ** 2;
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

describe('helix tube primitive', () => {
  it('emits HELIX_SIDES quads per step, four vertices and six indices each', () => {
    const b = emit(COIL);
    const quads = helixQuads(COIL.turns);
    expect(b.verts).toBe(quads * 4);
    expect(b.count).toBe(quads * 6);
    expect(b.count / 3).toBe(2 * quads);
  });

  it('stays inside its cell: every vertex within [0, 1] on all axes', () => {
    const b = emit(COIL);
    for (let i = 0; i < b.verts; i++) {
      for (let a = 0; a < 3; a++) {
        const v = b.positions[i * 3 + a];
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });

  it('winds round the centre line: every vertex is one tube radius from it', () => {
    const b = emit(COIL);
    for (let i = 0; i < b.verts; i += 7) {
      const p = [b.positions[i * 3], b.positions[i * 3 + 1], b.positions[i * 3 + 2]];
      const c = nearestCentre(COIL, p);
      const d = Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]);
      expect(d).toBeCloseTo(COIL.tube, 2);
    }
  });

  it('faces outward: each triangle normal points away from the centre line', () => {
    const tris = triangles(emit(COIL));
    let checked = 0;
    for (let t = 0; t < tris.length; t += 5) {
      const [a, b, c] = tris[t];
      const e1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
      const e2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
      const n = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
      const m = [(a[0] + b[0] + c[0]) / 3, (a[1] + b[1] + c[1]) / 3, (a[2] + b[2] + c[2]) / 3];
      const cen = nearestCentre(COIL, m);
      const out = [m[0] - cen[0], m[1] - cen[1], m[2] - cen[2]];
      const area = Math.hypot(n[0], n[1], n[2]);
      if (area < 1e-9) continue;
      expect(n[0] * out[0] + n[1] * out[1] + n[2] * out[2]).toBeGreaterThan(0);
      checked++;
    }
    expect(checked).toBeGreaterThan(50);
  });

  it('a vertex budget per coil: under 800 vertices at three turns', () => {
    expect(helixQuads(3) * 4).toBeLessThanOrEqual(800);
    expect(emit(COIL).verts).toBeLessThanOrEqual(800);
    expect(HELIX_SIDES).toBeGreaterThanOrEqual(6);
  });
});
