import { describe, expect, it } from 'vitest';
import { blockOrNull } from '../core/registry';
import { footprintOf, rotateCell, TOWN_STAGES, TOWN_TEMPLATES, townTemplate } from './townTemplates';

describe('town templates', () => {
  const all = Object.values(TOWN_TEMPLATES);

  it('has the five first templates: storage bay, cottage, workshop, well and plaza, lamp post', () => {
    expect(Object.keys(TOWN_TEMPLATES).sort()).toEqual(['cottage', 'lamp_post', 'storage_bay', 'well_plaza', 'workshop']);
    expect(townTemplate('nope')).toBeNull();
    expect(townTemplate('constructor')).toBeNull();
  });

  it('fits a 9 x 9 plot and every stage is non-empty', () => {
    for (const t of all) {
      expect(t.w).toBeLessThanOrEqual(9);
      expect(t.d).toBeLessThanOrEqual(9);
      for (const s of TOWN_STAGES) expect(t.cells.some((c) => c.stage === s), `${t.key} ${s}`).toBe(true);
    }
  });

  it('keeps every cell inside the footprint above the base row, and uses only registry blocks', () => {
    for (const t of all) {
      for (const c of t.cells) {
        if (c.y >= 0) {
          expect(c.x).toBeGreaterThanOrEqual(0);
          expect(c.x).toBeLessThan(t.w);
          expect(c.z).toBeGreaterThanOrEqual(0);
          expect(c.z).toBeLessThan(t.d);
        }
        if (c.block !== 'air') expect(blockOrNull(c.block), `${t.key} ${c.block}`).not.toBeNull();
      }
    }
  });

  it('has a frame made only of oak posts, beams and stone footing', () => {
    for (const t of all) {
      for (const c of t.cells.filter((x) => x.stage === 'frame')) expect(['oak_log', 'stone_brick']).toContain(c.block);
    }
  });

  it('turns cells and facings together: four quarter turns come back to the start', () => {
    const t = townTemplate('cottage')!;
    for (const c of t.cells) {
      let x = c.x;
      let z = c.z;
      let f = c.facing;
      let w = t.w;
      let d = t.d;
      for (let k = 0; k < 4; k++) {
        const r = rotateCell(x, z, w, d, 1, f);
        [w, d] = [d, w];
        x = r.x;
        z = r.z;
        f = r.facing;
      }
      expect({ x, z, facing: f }).toEqual({ x: c.x, z: c.z, facing: c.facing });
    }
    const f = footprintOf(t, 1);
    expect(f).toEqual({ w: t.d, d: t.w });
    const turned = rotateCell(0, 0, t.w, t.d, 1, 2);
    expect(turned.facing).toBe(3);
  });
});
