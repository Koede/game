/** Merged multiblock models: the builder, the shell-hiding registry and mesher, and the show / hide lifecycle. */
import { describe, expect, it } from 'vitest';
import { createBus } from '../../core/context';
import { blockId } from '../../core/registry';
import { CHUNK_SIZE, makeVoxel, voxelIndex, type BlockEntity, type ChunkMeshData } from '../../core/types';
import type { ChunkNeighborhood } from '../../world/chunk';
import { meshChunk } from '../../world/mesher';
import { HIDDEN_STRIDE, ShellHiding, isHiddenShellCell } from '../../world/shellHide';
import { FakeWorld } from '../testKit';
import { buildHearthModel, hearthParts } from './hearthModel';
import { MAT } from './meshBuilder';
import { formedModel, specKey, type FormedSpec } from './registry';
import { FormedTracker, SNAP_S, type TrackedModel } from './tracker';
import { hearthKind } from './hearthModel';

formedModel.register(hearthKind);

const spec = (over: Partial<FormedSpec> = {}): FormedSpec => ({
  kind: 'hearth',
  tier: 3,
  size: [5, 5, 5],
  closed: true,
  parts: [],
  controller: { cell: [2, 1, 0], normal: [0, 0, -1] },
  ...over,
});

const mats = (data: Float32Array): Set<number> => {
  const out = new Set<number>();
  for (let i = 3; i < data.length; i += 4) out.add(data[i]);
  return out;
};

describe('hearth model', () => {
  it('is one valid mesh: indices in range, unit normals, every triangle facing along its normal', () => {
    for (const tier of [3, 4, 5, 6]) {
      for (const closed of [true, false]) {
        const m = buildHearthModel(spec({ tier, closed, parts: [{ cell: [0, 2, 2], normal: [-1, 0, 0], kind: 'window' }] }));
        expect(m.triangles).toBeGreaterThan(100);
        const idx = m.indices;
        for (let i = 0; i < idx.length; i++) expect(idx[i]).toBeLessThan(m.vertexCount);
        let bad = 0;
        for (let t = 0; t < idx.length; t += 3) {
          const p = (k: number): number[] => [m.positions[idx[t + k] * 3], m.positions[idx[t + k] * 3 + 1], m.positions[idx[t + k] * 3 + 2]];
          const a = p(0), b = p(1), c = p(2);
          const e = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
          const f = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
          const cross = [e[1] * f[2] - e[2] * f[1], e[2] * f[0] - e[0] * f[2], e[0] * f[1] - e[1] * f[0]];
          const n = [m.normals[idx[t] * 3], m.normals[idx[t] * 3 + 1], m.normals[idx[t] * 3 + 2]];
          expect(Math.hypot(n[0], n[1], n[2])).toBeCloseTo(1, 4);
          if (cross[0] * n[0] + cross[1] * n[1] + cross[2] * n[2] < -1e-9) bad++;
        }
        expect(bad).toBe(0);
      }
    }
  });

  it('covers the box with continuous plating: the shell reaches every face and the plinth stands proud of the box', () => {
    const m = buildHearthModel(spec());
    expect(m.bounds[0]).toBeLessThan(0);
    expect(m.bounds[3]).toBeGreaterThan(5);
    expect(m.bounds[1]).toBeCloseTo(0, 5);
    // A closed roof stays within a little over the box; an open top rises into a hood.
    expect(m.bounds[4]).toBeLessThan(5.5);
    expect(buildHearthModel(spec({ closed: false })).bounds[4]).toBeGreaterThan(5.4);
  });

  it('leaves the furnace mouth as the real block and frames it', () => {
    const framed = buildHearthModel(spec());
    const none = buildHearthModel(spec({ controller: null }));
    // Without a mouth the controller cell is plated over; with one it is left open (fewer wall quads) but framed.
    expect(framed.triangles).not.toBe(none.triangles);
    const wallQuadsAtMouth = (md: typeof framed): number => {
      let n = 0;
      for (let t = 0; t < md.indices.length; t += 3) {
        let cx = 0, cy = 0, cz = 0;
        for (let k = 0; k < 3; k++) {
          cx += md.positions[md.indices[t + k] * 3] / 3;
          cy += md.positions[md.indices[t + k] * 3 + 1] / 3;
          cz += md.positions[md.indices[t + k] * 3 + 2] / 3;
        }
        if (cz === 0 && cx > 2 && cx < 3 && cy > 1 && cy < 2) n++;
      }
      return n;
    };
    expect(wallQuadsAtMouth(framed)).toBe(0);
    expect(wallQuadsAtMouth(none)).toBeGreaterThan(0);
  });

  it('shows hatches, ports, blowers and glass as inset details and electrodes as rods on the roof', () => {
    const plain = buildHearthModel(spec({ tier: 4 }));
    const kinds = ['window', 'item_hatch', 'fluid_hatch', 'port', 'blower'] as const;
    kinds.forEach((kind, i) => {
      const m = buildHearthModel(spec({ tier: 4, parts: [{ cell: [4, 2, 1 + (i % 3)], normal: [1, 0, 0], kind }] }));
      expect(m.triangles, kind).toBeGreaterThan(plain.triangles);
    });
    const withGlass = buildHearthModel(spec({ parts: [{ cell: [4, 2, 2], normal: [1, 0, 0], kind: 'window' }] }));
    expect(mats(withGlass.data).has(MAT.glass)).toBe(true);
    const rods = buildHearthModel(spec({ tier: 4, parts: [{ cell: [2, 4, 2], normal: [0, 1, 0], kind: 'electrode' }] }));
    expect(rods.bounds[4]).toBeGreaterThan(plain.bounds[4] + 0.5);
    expect(mats(rods.data).has(MAT.glow)).toBe(true);
  });

  it('gives each tier its own art', () => {
    const m = (tier: number) => mats(buildHearthModel(spec({ tier })).data);
    expect(m(3).has(MAT.brick)).toBe(true);
    expect(m(4).has(MAT.metal)).toBe(true); // copper bus rings and crown
    expect(m(5).has(MAT.conduit)).toBe(true); // ring conduits
    expect(m(5).has(MAT.casing)).toBe(true);
    expect(m(6).has(MAT.gold)).toBe(true); // gold trim
    expect(m(3).has(MAT.conduit)).toBe(false);
    const col = (tier: number): number => buildHearthModel(spec({ tier })).data[0];
    expect(new Set([col(3), col(4), col(5)]).size).toBe(3);
  });

  it('stays cheap: a big hearth is a few thousand triangles and one mesh', () => {
    const m = buildHearthModel(spec({ tier: 5, size: [9, 9, 9], controller: { cell: [4, 1, 0], normal: [0, 0, -1] } }));
    expect(m.triangles).toBeLessThan(4000);
  });

  it('keys identical specs identically, whatever the order of their parts', () => {
    const a = spec({ parts: [{ cell: [0, 1, 1], normal: [-1, 0, 0], kind: 'window' }, { cell: [0, 2, 2], normal: [-1, 0, 0], kind: 'blower' }] });
    const b = spec({ parts: [...a.parts].reverse() });
    expect(specKey(a)).toBe(specKey(b));
    expect(specKey(spec({ closed: false }))).not.toBe(specKey(a));
  });
});

describe('formed model registry', () => {
  it('builds with the kind registered and lets another kind plug in', () => {
    expect(formedModel.build(spec()).triangles).toBeGreaterThan(0);
    expect(() => formedModel.build(spec({ kind: 'nope' }))).toThrow(/no kind/);
    formedModel.register({ kind: 'boiler', find: () => undefined, parts: () => [], build: (s) => buildHearthModel({ ...s, kind: 'hearth' }) });
    expect(formedModel.build(spec({ kind: 'boiler' })).triangles).toBeGreaterThan(0);
  });
});

describe('shell hiding', () => {
  it('hides every surface cell of a box but the kept one, and nothing inside or outside', () => {
    const boxes = [10, 5, 10, 14, 9, 14, 12, 6, 10];
    expect(boxes.length).toBe(HIDDEN_STRIDE);
    expect(isHiddenShellCell(boxes, 10, 7, 12)).toBe(true);
    expect(isHiddenShellCell(boxes, 12, 9, 12)).toBe(true); // ceiling
    expect(isHiddenShellCell(boxes, 12, 6, 10)).toBe(false); // the controller
    expect(isHiddenShellCell(boxes, 12, 7, 12)).toBe(false); // interior
    expect(isHiddenShellCell(boxes, 9, 7, 12)).toBe(false); // outside
  });

  it('hands each chunk only the boxes that touch it and notifies on every change', () => {
    const h = new ShellHiding();
    const seen: string[] = [];
    h.onChange((min, max) => seen.push(`${min}|${max}`));
    h.set('a', { min: [30, 5, 3], max: [34, 9, 7], keep: [32, 6, 3] });
    expect(h.forChunk(1, 0)).toBeDefined(); // x 30..34 spans chunks 1 and 2
    expect(h.forChunk(2, 0)).toBeDefined();
    expect(h.forChunk(0, 0)).toBeUndefined();
    expect(h.forChunk(1, 1)).toBeUndefined();
    h.clear('a');
    expect(h.forChunk(1, 0)).toBeUndefined();
    expect(seen).toHaveLength(2);
    h.clear('a');
    expect(seen).toHaveLength(2);
  });

  it('makes the mesher skip the hidden shell faces', () => {
    const stone = blockId('stone');
    const centre = new Uint16Array(CHUNK_SIZE * 256 * CHUNK_SIZE);
    for (let y = 40; y < 45; y++) for (let z = 4; z < 9; z++) for (let x = 4; x < 9; x++) centre[voxelIndex(x, y, z)] = makeVoxel(stone);
    const chunks: ChunkNeighborhood = [null, null, null, null, centre, null, null, null, null];
    const count = (m: ChunkMeshData): number => m.opaque.indices.length / 6;
    const full = count(meshChunk({ cx: 0, cz: 0, chunks }));
    expect(full).toBe(6 * 25); // the cube's six sides
    const hidden = count(meshChunk({ cx: 0, cz: 0, chunks, hidden: [4, 40, 4, 8, 44, 8, 6, 41, 4] }));
    expect(hidden).toBe(1); // only the kept cell's outward face
    // A box in another chunk leaves this one untouched.
    expect(count(meshChunk({ cx: 0, cz: 0, chunks, hidden: [] }))).toBe(full);
  });
});

// ---- lifecycle ---------------------------------------------------------------------------------------------------

interface Rig {
  world: FakeWorld;
  bus: ReturnType<typeof createBus>;
  hiding: ShellHiding;
  tracker: FormedTracker;
  log: string[];
  entity: BlockEntity;
  models: Map<string, TrackedModel>;
}

const BOX_MIN = [10, 11, 10] as const;

function rig(opts: { x?: number; open?: boolean; glass?: boolean } = {}): Rig {
  const world = new FakeWorld(10);
  const bus = createBus();
  const hiding = new ShellHiding();
  const log: string[] = [];
  const ox = opts.x ?? 0;
  const min: [number, number, number] = [BOX_MIN[0] + ox, BOX_MIN[1], BOX_MIN[2]];
  const max: [number, number, number] = [min[0] + 4, min[1] + 4, min[2] + 4];
  for (let y = min[1]; y <= max[1]; y++) {
    for (let z = min[2]; z <= max[2]; z++) {
      for (let x = min[0]; x <= max[0]; x++) {
        const shell = x === min[0] || x === max[0] || y === min[1] || z === min[2] || z === max[2] || (y === max[1] && !opts.open);
        if (shell) world.put(x, y, z, 'stone');
      }
    }
  }
  if (opts.glass) world.put(max[0], min[1] + 2, min[2] + 2, 'glass');
  world.put(min[0] + 2, min[1] + 1, min[2], 'furnace_arc');
  const entity = { kind: 'furnace', x: min[0] + 2, y: min[1] + 1, z: min[2], tempC: 900, hearth: { tier: 3, min, max, closed: !opts.open } } as unknown as BlockEntity;
  world.setEntity(entity);
  let tracker!: FormedTracker;
  const hooks = {
    onAdd: (t: TrackedModel) => log.push(`add ${t.id}`),
    onRebuild: (t: TrackedModel) => log.push(`rebuild ${t.id}`),
    onRemove: (id: string) => log.push(`remove ${id}`),
    onSettle: (t: TrackedModel) => log.push(`settle ${t.id}`),
  };
  tracker = new FormedTracker(world, bus, hooks, hiding);
  return { world, bus, hiding, tracker, log, entity, models: tracker.models };
}

const id = (r: Rig): string => `hearth:${r.entity.x},${r.entity.y},${r.entity.z}`;

describe('formed model lifecycle', () => {
  it('shows a formed hearth after its first scan: model made, shell hidden, controller kept', () => {
    const r = rig();
    expect(r.models.size).toBe(0);
    r.tracker.update(0.016, 12, 12);
    expect(r.log).toEqual([`add ${id(r)}`]);
    const box = r.hiding.get(id(r))!;
    expect(box.min).toEqual([10, 11, 10]);
    expect(box.keep).toEqual([12, 12, 10]);
    // A loaded save shows it without a snap.
    expect(FormedTracker.snapOf(r.models.get(id(r))!)).toEqual({ snap: 1, flash: 0 });
  });

  it('waits for the walls: nothing is hidden while a corner is missing, and it shows once the corner stands', () => {
    const r = rig();
    r.world.put(10, 11, 10, 'air');
    r.tracker.update(0.016, 12, 12);
    expect(r.models.size).toBe(0);
    expect(r.hiding.size).toBe(0);
    r.world.put(10, 11, 10, 'stone');
    r.tracker.update(0.6, 12, 12);
    expect(r.models.size).toBe(1);
    expect(r.hiding.size).toBe(1);
  });

  it('snaps in when announced formed, settles with a flash, and then rests', () => {
    const r = rig();
    r.bus.emit('hearth:formed', { x: r.entity.x, y: r.entity.y, z: r.entity.z, tier: 3, min: [10, 11, 10], max: [14, 15, 14] });
    r.tracker.update(0.016, 12, 12);
    const t = r.models.get(id(r))!;
    expect(t.snapT).toBeLessThan(0.1);
    expect(FormedTracker.snapOf(t).snap).toBeLessThan(0.2);
    r.tracker.update(SNAP_S, 12, 12);
    expect(r.log).toContain(`settle ${id(r)}`);
    expect(FormedTracker.snapOf(t).flash).toBeGreaterThan(0.5);
    r.tracker.update(1, 12, 12);
    expect(FormedTracker.snapOf(t)).toEqual({ snap: 1, flash: 0 });
  });

  it('takes the model down at once when the hearth comes apart, and shows the blocks again', () => {
    const r = rig();
    r.tracker.update(0.016, 12, 12);
    r.bus.emit('hearth:unformed', { x: r.entity.x, y: r.entity.y, z: r.entity.z });
    expect(r.log).toEqual([`add ${id(r)}`, `remove ${id(r)}`]);
    expect(r.hiding.size).toBe(0);
    expect(r.models.size).toBe(0);
    // The sim has cleared the summary: the next scan does not bring a ghost back.
    r.entity.hearth = null;
    r.tracker.update(1, 12, 12);
    expect(r.models.size).toBe(0);
    expect(r.log).toHaveLength(2);
  });

  it('also catches a hearth that vanished without a notice (entity removed, or a wall block gone)', () => {
    const r = rig();
    r.tracker.update(0.016, 12, 12);
    r.world.put(14, 15, 14, 'air'); // a corner knocked out
    r.tracker.update(0.6, 12, 12);
    expect(r.models.size).toBe(0);
    expect(r.hiding.size).toBe(0);
    const r2 = rig();
    r2.tracker.update(0.016, 12, 12);
    r2.world.removeEntity(r2.entity.x, r2.entity.y, r2.entity.z);
    r2.tracker.update(0.6, 12, 12);
    expect(r2.models.size).toBe(0);
    expect(r2.hiding.size).toBe(0);
  });

  it('rebuilds in place when the spec changes (a window set into the shell, the top closed)', () => {
    const r = rig();
    r.tracker.update(0.016, 12, 12);
    const first = r.models.get(id(r))!.model;
    r.world.put(14, 13, 12, 'glass');
    r.tracker.update(0.6, 12, 12);
    expect(r.log).toEqual([`add ${id(r)}`, `rebuild ${id(r)}`]);
    expect(r.models.get(id(r))!.model).not.toBe(first);
    expect(r.models.get(id(r))!.model.triangles).toBeGreaterThan(first.triangles);
    expect(r.hiding.size).toBe(1);
    r.tracker.update(0.6, 12, 12);
    expect(r.log).toHaveLength(2); // unchanged: no rebuild
  });

  it('reads parts off the shell blocks, only on face cells', () => {
    const r = rig({ glass: true });
    r.world.put(10, 12, 12, 'item_hatch'); // a face cell of the west wall
    r.world.put(10, 15, 10, 'glass'); // a corner: an edge, ignored
    const parts = hearthParts(r.world, { min: [10, 11, 10], max: [14, 15, 14], closed: true });
    expect(parts.map((p) => p.kind).sort()).toEqual(['item_hatch', 'window']);
    expect(parts.find((p) => p.kind === 'window')!.normal).toEqual([1, 0, 0]);
  });

  it('frees everything on dispose', () => {
    const r = rig();
    r.tracker.update(0.016, 12, 12);
    r.tracker.dispose();
    expect(r.hiding.size).toBe(0);
    expect(r.log.at(-1)).toBe(`remove ${id(r)}`);
  });

  it('models ten hearths with one mesh each, quickly', () => {
    const world = new FakeWorld(10);
    const hiding = new ShellHiding();
    const bus = createBus();
    for (let h = 0; h < 10; h++) {
      const min: [number, number, number] = [10 + h * 8, 11, 10];
      const max: [number, number, number] = [min[0] + 6, min[1] + 6, min[2] + 6];
      for (let y = min[1]; y <= max[1]; y++) for (let z = min[2]; z <= max[2]; z++) for (let x = min[0]; x <= max[0]; x++) {
        if (x === min[0] || x === max[0] || y === min[1] || y === max[1] || z === min[2] || z === max[2]) world.put(x, y, z, 'stone');
      }
      world.put(min[0] + 3, min[1] + 1, min[2], 'furnace_arc');
      world.setEntity({ kind: 'furnace', x: min[0] + 3, y: min[1] + 1, z: min[2], tempC: 1100, hearth: { tier: 3 + (h % 4), min, max, closed: h % 2 === 0 } } as unknown as BlockEntity);
    }
    let adds = 0;
    const tracker = new FormedTracker(world, bus, { onAdd: () => adds++, onRebuild: () => undefined, onRemove: () => undefined }, hiding);
    const t0 = performance.now();
    tracker.update(0.016, 40, 12);
    const ms = performance.now() - t0;
    expect(adds).toBe(10);
    expect(hiding.size).toBe(10);
    let tris = 0;
    for (const m of tracker.models.values()) tris += m.model.triangles;
    expect(tris).toBeLessThan(10 * 4000);
    expect(ms).toBeLessThan(300);
    // A steady scan with nothing changed rebuilds nothing.
    const t1 = performance.now();
    for (let i = 0; i < 20; i++) tracker.scan();
    expect((performance.now() - t1) / 20).toBeLessThan(25);
    expect(adds).toBe(10);
  });
});
