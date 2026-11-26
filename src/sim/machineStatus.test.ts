import { describe, expect, it } from 'vitest';
import { MachineStatus, STATUS_KEYS, parseStatusTexture, statusTextureName, voxelStatus, withStatus } from '../core/machineStatus';
import { BLOCKS, block, faceLayer, textureLayer } from '../core/registry';
import { Face, Facing, makeVoxel, voxelActive } from '../core/types';
import { FACE_LAYER, faceSlot } from '../world/blockTables';
import { paintTexture } from '../render/textures';
import { makeKit } from './testKit';

describe('machine status voxel bits', () => {
  it('stores the status in bits 13-15 without touching id, facing or the active flag', () => {
    const v = makeVoxel(7, Facing.East, true, 0);
    for (const s of [0, 1, 2, 3, 4]) {
      const w = withStatus(v, s);
      expect(voxelStatus(w)).toBe(s);
      expect(w & 0x1fff).toBe(v & 0x1fff);
      expect(withStatus(w, 0)).toBe(v);
    }
  });
  it('names and parses derived textures both ways', () => {
    expect(statusTextureName('crusher_front', MachineStatus.None)).toBe('crusher_front');
    for (let s = 1; s < STATUS_KEYS.length; s++) expect(parseStatusTexture(statusTextureName('crusher_front', s))).toEqual({ base: 'crusher_front', status: s });
    expect(parseStatusTexture('crusher_front')).toBeNull();
  });
});

describe('status textures', () => {
  it('are derived from the off texture: same pixels outside the badge, different inside, all distinct', () => {
    const base = paintTexture('crusher_front');
    const seen = new Set<string>([base.join()]);
    for (let s = 1; s < STATUS_KEYS.length; s++) {
      const px = paintTexture(statusTextureName('crusher_front', s));
      expect(px.length).toBe(base.length);
      expect(px).not.toEqual(base);
      seen.add(px.join());
    }
    expect(seen.size).toBe(STATUS_KEYS.length);
  });
  it('the mesher tables pick them for opted-in blocks and leave other blocks alone', () => {
    const crusher = block('crusher');
    for (let s = 1; s < STATUS_KEYS.length; s++) {
      const want = textureLayer(statusTextureName('crusher_front', s));
      const v = withStatus(makeVoxel(crusher.id, Facing.North, false), s);
      expect(FACE_LAYER[faceSlot(v) + Face.NZ]).toBe(want);
      expect(faceLayer(crusher, Face.NZ, Facing.North, false, s)).toBe(want);
      // Sides stay the shared casing.
      expect(FACE_LAYER[faceSlot(v) + Face.PX]).toBe(crusher.layers[Face.PX]);
    }
    // Status 0 is the plain off face, and running ignores a stale status.
    expect(FACE_LAYER[faceSlot(makeVoxel(crusher.id, Facing.North, false)) + Face.NZ]).toBe(crusher.layers[Face.NZ]);
    // A block that has not opted in (water level lives in the same bits) reads the same faces whatever the bits say.
    const stone = block('stone');
    expect(stone.layersStatus.length).toBe(0 + 1);
    expect(FACE_LAYER[faceSlot(withStatus(makeVoxel(stone.id), 2)) + Face.PY]).toBe(FACE_LAYER[faceSlot(makeVoxel(stone.id)) + Face.PY]);
  });
  it('every machine built from the shared factories opts in', () => {
    const machines = BLOCKS.filter((b) => b.machine && b.oriented && b.power === 'device' && b.layersActive[Face.NZ] !== b.layers[Face.NZ]);
    expect(machines.length).toBeGreaterThan(10);
    for (const b of machines.filter((m) => m.layersStatus.length > 1)) expect(b.layersStatus[MachineStatus.Starved]![Face.NZ]).not.toBe(b.layers[Face.NZ]);
  });
});

describe('machines report their status on the block', () => {
  const stateAt = (kit: ReturnType<typeof makeKit>, x: number, y: number, z: number) => {
    const v = kit.world.getVoxel(x, y, z);
    return { active: voxelActive(v), status: voxelStatus(v) };
  };
  it('a switched-on crusher with no power is starved after a second, idle when switched off, and clears at once when it runs', () => {
    const kit = makeKit();
    const m = kit.machine('crusher', 0, 5, 0);
    kit.sim.machineSlots(0, 5, 0)!.add('copper_ore', 4);
    kit.run(0.5);
    expect(stateAt(kit, 0, 5, 0)).toEqual({ active: false, status: MachineStatus.None });
    kit.run(1.5);
    expect(stateAt(kit, 0, 5, 0)).toEqual({ active: false, status: MachineStatus.Starved });
    m.on = false;
    kit.run(2);
    expect(stateAt(kit, 0, 5, 0)).toEqual({ active: false, status: MachineStatus.None });
  });
  it('a crusher whose output slot is full shows full, and a running one shows neither', () => {
    const kit = makeKit();
    kit.machine('crusher', 0, 5, 0);
    const bankM = kit.machine('lithium_bank', 1, 5, 0);
    bankM.storedJ = 1e9;
    const slots = kit.sim.machineSlots(0, 5, 0)!;
    slots.add('copper_ore', 1);
    kit.run(1);
    expect(stateAt(kit, 0, 5, 0).status).toBe(MachineStatus.None);
    const e = kit.sim.machineAt(0, 5, 0)!;
    e.slots[1] = { item: 'copper_dust', count: 99 };
    slots.add('copper_ore', 4);
    kit.run(2.5);
    expect(stateAt(kit, 0, 5, 0)).toEqual({ active: false, status: MachineStatus.Full });
  });
});
