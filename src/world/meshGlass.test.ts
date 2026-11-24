import { describe, expect, it } from 'vitest';
import { CHEM, DONE_SUFFIX } from '../core/distill';
import { blockId, BLOCKS } from '../core/registry';
import { makeVoxel, type MeshBatch } from '../core/types';
import { GLASS_JOINS, GLASS_MODEL, SHAPE, SHAPE_GLASS } from './blockTables';
import { GLASS_MODEL_NAMES, GLASS_MODELS, glassModelIndex, glassModelName } from './glassModels';
import { meshChunk } from './mesher';
import { emptyNeighborhood, put } from './testUtil';

const quads = (b: MeshBatch): number => b.indices.length / 6;

function meshOf(cells: [number, number, number, string][]): MeshBatch {
  const chunks = emptyNeighborhood();
  for (const [x, y, z, key] of cells) put(chunks, x, y, z, makeVoxel(blockId(key), 0, false));
  return meshChunk({ cx: 0, cz: 0, chunks }).translucent;
}

describe('glassware models', () => {
  it('gives every glass-shaped block a model, and every model a body inside its cell', () => {
    const glass = BLOCKS.filter((d) => d && d.shape === 'glass');
    expect(glass.length).toBeGreaterThan(0);
    for (const def of glass) {
      expect(glassModelIndex(def.key), def.key).toBeGreaterThan(0);
      expect(SHAPE[blockId(def.key)], def.key).toBe(SHAPE_GLASS);
    }
    for (const [name, model] of Object.entries(GLASS_MODELS)) {
      expect(model.body.length, name).toBeGreaterThan(0);
      for (const box of model.body) {
        const [x0, y0, z0, x1, y1, z1] = box;
        expect(Math.min(x0, y0, z0), name).toBeGreaterThanOrEqual(0);
        expect(Math.max(x1, y1, z1), name).toBeLessThanOrEqual(16);
        expect(x1 > x0 && y1 > y0 && z1 > z0, name).toBe(true);
      }
    }
  });

  it('gives each chemistry piece its own model, done twins included', () => {
    const kinds = Object.values(CHEM);
    expect(new Set(kinds.map((k) => glassModelName(k))).size).toBe(kinds.length);
    for (const k of kinds) expect(glassModelName(k + DONE_SUFFIX), k).toBe(k);
    expect(GLASS_MODEL_NAMES.length).toBe(Object.keys(GLASS_MODELS).length);
  });

  it('gives the furnace-top beakers and vials models, boiling and resin forms included', () => {
    expect(glassModelName('furnace_beaker_boiling')).toBe('beaker');
    expect(glassModelName('furnace_vial')).toBe('vial');
    expect(glassModelName('furnace_sap_resin')).toBe('beaker');
    expect(glassModelName('plank')).toBeNull();
  });

  it('marks every glass block as a joiner and points it at its model', () => {
    const id = blockId(CHEM.tube);
    expect(GLASS_JOINS[id]).toBe(1);
    expect(GLASS_MODEL[id]).toBe(glassModelIndex(CHEM.tube));
    expect(GLASS_JOINS[blockId('plank')]).toBe(0);
  });

  it('shows a joint only where two pieces have ports facing each other', () => {
    const base = quads(meshOf([[5, 40, 5, CHEM.base]]));
    const flask = quads(meshOf([[5, 41, 5, CHEM.flask]]));
    // A flask stands on the burner plate: plate port up meets flask port down, so both grow a joint.
    const stacked = quads(meshOf([[5, 40, 5, CHEM.base], [5, 41, 5, CHEM.flask]]));
    expect(stacked).toBeGreaterThan(base + flask);
    // Side by side the plate has no side ports: no joint, just the two bodies.
    const beside = quads(meshOf([[5, 40, 5, CHEM.base], [6, 40, 5, CHEM.flask]]));
    expect(beside).toBe(base + flask);
  });

  it('two all-port pieces join on every touching side, and loose pieces stay clean', () => {
    const alone = quads(meshOf([[5, 40, 5, CHEM.tube]]));
    const pair = quads(meshOf([[5, 40, 5, CHEM.tube], [6, 40, 5, CHEM.tube]]));
    expect(pair).toBeGreaterThan(2 * alone);
    const far = quads(meshOf([[5, 40, 5, CHEM.tube], [9, 40, 5, CHEM.tube]]));
    expect(far).toBe(2 * alone);
  });

  it('a glass piece beside stone grows no joint', () => {
    const alone = quads(meshOf([[5, 40, 5, CHEM.tube]]));
    const beside = quads(meshOf([[5, 40, 5, CHEM.tube], [6, 40, 5, 'stone']]));
    expect(beside).toBe(alone);
  });

  it('gives the pieces different shapes (no two models share a body)', () => {
    const bodies = Object.values(GLASS_MODELS).map((m) => JSON.stringify(m.body));
    expect(new Set(bodies).size).toBe(bodies.length);
  });
});
