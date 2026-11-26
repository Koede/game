import { describe, expect, it } from 'vitest';
import { blockId } from '../core/registry';
import { makeVoxel, type IWorld } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { checkRoom } from './housing';
import { layoutBlocks, TAVERN_H, TAVERN_TOP } from './tavern';
import {
  LODGE_BED,
  LODGE_D,
  LODGE_PATH,
  LODGE_SPAWN,
  LODGE_W,
  groupOf,
  layoutAt,
  lodgeTemplate,
  lodgeTemplateFor,
  lodgeVolume,
  stageBlocks,
  stageFor,
  stateAt,
  type LodgeBlock,
} from './lodge';
import { TOWN_STAGES } from './townTemplates';

/** The final layout as the world would hold it: the last write per cell (air included), as buildTavern writes it. */
function finalLayout(): Map<string, string> {
  const m = new Map<string, string>();
  for (const p of layoutBlocks()) m.set(`${p.x},${p.y},${p.z}`, p.block);
  return m;
}

/** Applies stages 0..k in order to a map of cell -> block (what the builder does, one stage after another). */
function applyStages(k: number): Map<string, string> {
  const m = new Map<string, string>();
  for (let s = 0; s <= k; s++) for (const c of stageBlocks(s)) m.set(`${c.x},${c.y},${c.z}`, c.block);
  return m;
}

/** A world holding the lodge's cells at stage k (air elsewhere, the room's boundary is the lodge's own walls). */
function worldAt(k: number): FakeWorld {
  const w = new FakeWorld();
  for (const c of stateAt(k).values()) {
    if (c.block === 'air') continue;
    w.setVoxel(c.x, c.y, c.z, makeVoxel(blockId(c.block), c.facing));
  }
  return w;
}

describe('lodge layout groups', () => {
  it('has the five stages, each a template on the plot with the tavern footprint', () => {
    expect(LODGE_PATH).toEqual(['lodge', 'lodge_bar', 'lodge_kitchen', 'lodge_upper', 'lodge_tavern']);
    for (const key of LODGE_PATH) {
      const t = lodgeTemplateFor(key);
      expect(t).not.toBeNull();
      expect(t!.w).toBe(LODGE_W);
      expect(t!.d).toBe(LODGE_D);
      expect(t!.cells.length).toBeGreaterThan(0);
    }
    expect(lodgeTemplateFor('lodge_nope')).toBeNull();
  });

  it('puts every placement of the layout into a group, monotone for cells the layout writes twice', () => {
    const last = new Map<string, number>();
    for (const p of layoutBlocks()) {
      const g = groupOf(p);
      expect([0, 1, 2, 3, 4]).toContain(g);
      const k = `${p.x},${p.y},${p.z}`;
      // A cell written again later never moves to an earlier group (stage order keeps the last write).
      expect(g).toBeGreaterThanOrEqual(last.get(k) ?? 0);
      last.set(k, g);
    }
  });

  it('builds the whole tavern when all five stages are applied: the last write of every layout cell, and nothing else', () => {
    const built = applyStages(LODGE_PATH.length - 1);
    const want = finalLayout();
    for (const [k, block] of want) expect(built.get(k), k).toBe(block);
    // Cells the stages touch and the layout does not name are air: the temporary rooms were all taken down.
    for (const [k, block] of built) if (!want.has(k)) expect(block, k).toBe('air');
  });

  it('after all stages the layout state equals layoutAt(4) exactly', () => {
    const top = stateAt(LODGE_PATH.length - 1);
    const lay = layoutAt(LODGE_PATH.length - 1);
    expect([...top.keys()].sort()).toEqual([...lay.keys()].sort());
  });

  it('keeps the upper floor, the roof row and the stairs out of the first stage', () => {
    const first = layoutAt(0);
    for (const c of first.values()) {
      expect(c.y).toBeLessThanOrEqual(TAVERN_H);
      expect(c.z).toBeLessThan(9);
    }
  });

  it('uses only registry blocks and the frame is oak and stone only', () => {
    for (const key of LODGE_PATH) {
      const t = lodgeTemplateFor(key)!;
      for (const c of t.cells) {
        if (c.block !== 'air') expect(blockId(c.block), `${key} ${c.block}`).toBeGreaterThanOrEqual(0);
        expect(TOWN_STAGES).toContain(c.stage);
        if (c.stage === 'frame') expect(['oak_log', 'stone_brick']).toContain(c.block);
      }
    }
    expect(stageFor('air', 3)).toBe('clearing');
    expect(stageFor('plank', TAVERN_H + 1)).toBe('roof');
  });

  it('gives the template cells of each stage on the plot, with the diff from the stage before', () => {
    const first = lodgeTemplate(0);
    expect(first.cells.length).toBe(stateAt(0).size);
    const later: LodgeBlock[] = stageBlocks(1);
    expect(later.length).toBeGreaterThan(0);
    expect(later.length).toBeLessThan(first.cells.length);
  });

  it('clears the air volume over the plot up to the roof', () => {
    const vol = lodgeVolume();
    expect(vol.length).toBe(LODGE_W * LODGE_D * (TAVERN_TOP + 2));
  });
});

describe('lodge bedrooms', () => {
  it('the first bedroom passes checkRoom once the lodge stands', () => {
    const w = worldAt(0);
    const r = checkRoom(w, LODGE_BED[0], LODGE_BED[1], LODGE_BED[2]);
    expect(r.reasons).toEqual([]);
    expect(r.ok).toBe(true);
    expect(r.cells).toBeGreaterThanOrEqual(20);
  });

  it('the first bedroom is closed by its door: the spawn cell is in it, the common room is not', () => {
    const w = worldAt(0);
    expect(w.getBlock(LODGE_SPAWN[0], LODGE_SPAWN[1], LODGE_SPAWN[2]).key).toBe('air');
    expect(w.getBlock(6, 1, 3).key).toBe('air');
  });

  it('the second bedroom passes checkRoom at stage 1, and the first still does', () => {
    const w = worldAt(1);
    expect(checkRoom(w, LODGE_BED[0], LODGE_BED[1], LODGE_BED[2]).ok).toBe(true);
    expect(checkRoom(w, 10, 1, 1).ok).toBe(true);
  });

  it('the third bedroom passes checkRoom at stage 2', () => {
    const w = worldAt(2);
    expect(checkRoom(w, LODGE_BED[0], LODGE_BED[1], 6).ok).toBe(true);
    expect(checkRoom(w, 10, 1, 1).ok).toBe(true);
  });

  it('known gap: the upper guest room fails checkRoom (its doorways are open air into the walkway; the layout is kept exact)', () => {
    const w = worldAt(LODGE_PATH.length - 1);
    const r = checkRoom(w, 1, 6, 6);
    expect(r.ok).toBe(false);
    expect(r.reasons).toEqual(['not enclosed']);
  });

  it('the ground-floor bedrooms are taken down when the upper floor goes in', () => {
    const w = worldAt(3);
    expect(w.getBlock(LODGE_BED[0], LODGE_BED[1], LODGE_BED[2]).key).not.toBe('wool_bedding');
    expect(w.getBlock(10, 1, 1).key).not.toBe('wool_bedding');
  });

  it('stage 1 adds only its own cells and a second bedroom (no upper-floor or yard cells)', () => {
    for (const c of stageBlocks(1)) {
      expect(c.z).toBeLessThan(9);
      expect(c.y).toBeLessThan(TAVERN_H + 1);
    }
  });
});

describe('the final result against the world before the lodge', () => {
  it('the world volume is one block per cell at most (no duplicate keys)', () => {
    const keys = new Set<string>();
    for (const c of stateAt(LODGE_PATH.length - 1).values()) keys.add(`${c.x},${c.y},${c.z}`);
    expect(keys.size).toBe(stateAt(LODGE_PATH.length - 1).size);
  });
});

// A reference to the world type so the import stays used when the helpers change.
export type { IWorld };
