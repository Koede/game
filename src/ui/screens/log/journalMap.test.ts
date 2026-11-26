import { describe, expect, it } from 'vitest';
import { Journal } from '../../../game/journal';
import { mapFrame, paintMap, placeMarkers } from './journalMap';

describe('paintMap', () => {
  it('paints seen ground green-ish, unseen dark, and the player bright', () => {
    const j = new Journal(() => 1);
    j.explore(0, 0);
    j.explore(40, 0);
    const size = 32;
    const out = new Uint8ClampedArray(size * size * 4);
    const { blocksPerPx } = paintMap(j, 40, 0, size, () => 64, out);
    expect(blocksPerPx).toBeGreaterThanOrEqual(1);
    let seen = 0;
    let dark = 0;
    for (let i = 0; i < out.length; i += 4) out[i + 1] > 100 ? seen++ : out[i + 1] < 30 && dark++;
    expect(seen).toBeGreaterThan(0);
    expect(dark).toBeGreaterThan(seen);
    expect(out.every((_, i) => i % 4 !== 3 || out[i] === 255)).toBe(true);
  });
});

describe('map markers', () => {
  const journal = (): Journal => {
    const j = new Journal(() => 1);
    j.explore(0, 0);
    j.explore(40, 0);
    return j;
  };

  it('places a marker at its world position in the frame paintMap uses', () => {
    const j = journal();
    const size = 32;
    const f = mapFrame(j, 0, 0, size);
    const [m] = placeMarkers(f, size, [{ kind: 'waypoint', x: 20, z: 0 }]);
    expect(m).toEqual({ kind: 'waypoint', i: Math.round((20 - f.x0) / f.blocksPerPx), j: Math.round((0 - f.z0) / f.blocksPerPx), edge: false });
  });

  it('pulls an off-map marker in to the border, toward it', () => {
    const size = 32;
    const f = mapFrame(journal(), 0, 0, size);
    const [east, north] = placeMarkers(f, size, [{ kind: 'treasure', x: 100000, z: 0 }, { kind: 'waypoint', x: 0, z: -100000 }]);
    expect(east).toMatchObject({ i: size - 2, edge: true });
    expect(north).toMatchObject({ j: 1, edge: true });
  });

  it('paints waypoints blue and treasure red, under the player cross', () => {
    const j = journal();
    const size = 32;
    const out = new Uint8ClampedArray(size * size * 4);
    const f = mapFrame(j, 40, 0, size);
    paintMap(j, 40, 0, size, () => 64, out, [{ kind: 'waypoint', x: 0, z: 0 }, { kind: 'treasure', x: 20, z: 8 }]);
    const [w, t] = placeMarkers(f, size, [{ kind: 'waypoint', x: 0, z: 0 }, { kind: 'treasure', x: 20, z: 8 }]);
    const px = (i: number, k: number): number[] => [...out.slice((k * size + i) * 4, (k * size + i) * 4 + 3)];
    expect(px(w.i, w.j)).toEqual([120, 200, 255]);
    expect(px(t.i + 1, t.j + 1)).toEqual([235, 70, 50]);
  });
});
