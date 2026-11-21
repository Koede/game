import { describe, expect, it } from 'vitest';
import { AUTOMATONS, creature } from '../../core/registry';
import { automatonAnchors, pickPart } from './anchors';
import { BOLT_CAPACITY, BoltTracker, type BoltView } from './bolts';
import { breakApart, piecesFor } from './burst';
import { DebrisField, type PieceDraw } from './debris';

const bolt = (id: number, x: number, y = 5, z = 0): BoltView => ({ id, x, y, z, vx: 14, vy: 0, vz: 0 });

describe('BoltTracker', () => {
  it('marks new bolts, remembers where each was, and reports the ones that ended', () => {
    const t = new BoltTracker();
    t.update([bolt(1, 0), bolt(2, 10)]);
    expect(t.count).toBe(2);
    expect([t.fresh[0], t.fresh[1]]).toEqual([1, 1]);
    expect(t.fromX[0]).toBe(0);
    t.update([bolt(2, 11), bolt(1, 1)]);
    expect([t.fresh[0], t.fresh[1]]).toEqual([0, 0]);
    expect([t.fromX[0], t.fromX[1]]).toEqual([10, 0]);
    expect(t.ended).toBe(0);
    t.update([bolt(1, 2)]);
    expect(t.ended).toBe(1);
    expect(t.endX[0]).toBe(11);
    t.update([]);
    expect(t.ended).toBe(1);
    expect(t.endX[0]).toBe(2);
    t.update([]);
    expect(t.ended).toBe(0);
  });

  it('keeps at most BOLT_CAPACITY bolts', () => {
    const t = new BoltTracker();
    t.update(Array.from({ length: 20 }, (_, i) => bolt(i + 1, i)));
    expect(t.count).toBe(BOLT_CAPACITY);
  });
});

describe('anchors', () => {
  it('finds a glowing halo, a vent and an arc point inside every automaton model', () => {
    for (const s of AUTOMATONS) {
      const a = automatonAnchors(s);
      expect(a.halo.size).toBeGreaterThan(0.4);
      expect(a.halo.r).toBeGreaterThan(0.5);
      const h = s.model.reduce((m, p) => Math.max(m, p.to[1]), 0) / 16;
      for (const p of [a.halo, a.vent, a.arc]) {
        expect(p.y).toBeGreaterThan(0);
        expect(p.y).toBeLessThanOrEqual(h + 1e-6);
      }
      expect(a.boxes.length).toBe(s.model.length * 6);
    }
  });

  it('only walkers and turrets smoke; the drone sparks', () => {
    expect(automatonAnchors(creature('arc_drone')).smokes).toBe(false);
    expect(automatonAnchors(creature('forge_warden')).smokes).toBe(true);
  });

  it('picks parts by weight, covering every part for u across 0..1', () => {
    const a = automatonAnchors(creature('forge_warden'));
    const seen = new Set<number>();
    for (let i = 0; i < 4000; i++) seen.add(pickPart(a, i / 4000));
    expect(seen.size).toBe(creature('forge_warden').model.length);
    expect(pickPart(a, 0)).toBe(0);
    expect(pickPart(a, 0.999999)).toBe(creature('forge_warden').model.length - 1);
  });
});

describe('DebrisField', () => {
  const piece = (x: number) => ({ x, y: 5, z: 0, vx: 1, vy: 4, vz: 0, size: 0.1, r: 1, g: 0.5, b: 0.2, emissive: 1, sky: 0.5, block: 0.2, life: 2 });
  const floor = (_x: number, y: number) => y < 1;

  it('throws pieces that fall, bounce, rest on the floor and expire', () => {
    const f = new DebrisField(8);
    f.spawn(piece(0), 0.5, -0.5);
    expect(f.count).toBe(1);
    let y = 0;
    for (let i = 0; i < 100; i++) f.step(0.02, floor);
    f.forEach((d) => (y = d.y));
    expect(y).toBeGreaterThan(0.9);
    expect(y).toBeLessThan(1.3);
    for (let i = 0; i < 120; i++) f.step(0.02, floor);
    expect(f.count).toBe(0);
  });

  it('reuses the oldest slot when full instead of failing, and cools its embers', () => {
    const f = new DebrisField(4);
    for (let i = 0; i < 10; i++) {
      f.spawn(piece(i), 0, 0);
      f.step(0.01, () => false);
    }
    expect(f.count).toBe(4);
    for (let i = 0; i < 80; i++) f.step(0.02, () => false);
    const seen: PieceDraw[] = [];
    f.forEach((d) => seen.push({ ...d }));
    expect(seen.length).toBeGreaterThan(0);
    for (const d of seen) expect(d.emissive).toBe(0);
  });

  it('does nothing when time stands still', () => {
    const f = new DebrisField(4);
    f.spawn(piece(0), 0, 0);
    f.step(0, floor);
    let y = 0;
    f.forEach((d) => (y = d.y));
    expect(y).toBe(5);
  });
});

describe('breakApart', () => {
  it('cuts pieces from the model boxes in the model colours, with glowing ones from ember parts', () => {
    const spec = creature('forge_warden');
    const a = automatonAnchors(spec);
    const f = new DebrisField(128);
    let seed = 12345;
    const rnd = (): number => {
      seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    breakApart(a, f, 10, 20, 30, 0, 1, 0.3, 0.1, 60, rnd);
    expect(f.count).toBe(60);
    const near = (c: number, shift: number, d: number): boolean => spec.model.some((p) => Math.abs(((p.color >> shift) & 255) / 255 - c) < d);
    let glowing = 0;
    f.forEach((d) => {
      expect(Math.abs(d.x - 10)).toBeLessThan(1.2);
      expect(d.y).toBeGreaterThanOrEqual(20);
      expect(d.y).toBeLessThan(23);
      expect(Math.abs(d.z - 30)).toBeLessThan(1.2);
      // Every piece has the red of one of the model's parts (give or take the +-10% jitter).
      expect(near(d.r, 16, 0.11)).toBe(true);
      if (d.emissive > 0) glowing++;
    });
    expect(glowing).toBeGreaterThan(0);
  });

  it('breaks bigger automatons into more pieces, capped', () => {
    expect(piecesFor(2.56)).toBeGreaterThan(piecesFor(0.45));
    expect(piecesFor(10)).toBe(56);
  });
});
