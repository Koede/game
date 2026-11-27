import { describe, expect, it } from 'vitest';
import { blockOf, machine } from '../core/registry';
import { MachineStatus, voxelStatus } from '../core/machineStatus';
import type { MachineEntity } from './entities';
import { makeKit, type Kit } from './testKit';

function bank(kit: Kit, x: number, y: number, z: number): MachineEntity {
  const b = kit.machine('lithium_bank', x, y, z);
  b.storedJ = machine('lithium_bank').capacityJ!;
  return b;
}

const count = (slots: MachineEntity['slots'], item: string): number => slots.reduce((n, s) => n + (s && s.item === item ? s.count : 0), 0);

describe('drill rig', () => {
  it('drills out the 3 by 3 shaft beneath it, layer by layer, blunting its bit', () => {
    const kit = makeKit();
    kit.world.put(0, 0, 0, 'corestone');
    kit.world.fill(-1, 3, -1, 1, 4, 1, 'stone');
    kit.world.put(1, 4, 1, 'coal_ore');
    const rig = kit.machine('drill_rig', 0, 6, 0);
    bank(kit, 1, 6, 0);
    rig.slots[0] = { item: 'drill_bit', count: 1 };
    kit.run(2.9);
    expect(count(rig.slots, 'rubble')).toBe(0);
    kit.run(0.2);
    expect(count(rig.slots, 'rubble')).toBe(1);
    expect(rig.slots[0]?.durability).toBe(63);
    // The whole top layer goes before the one below it.
    kit.run(3 * 8 + 0.5);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) expect(kit.world.getVoxel(dx, 4, dz)).toBe(0);
    expect(blockOf(kit.world.getVoxel(0, 3, 0)).key).toBe('stone');
    expect(rig.depthY).toBe(4);
    expect(count(rig.slots, 'coal')).toBeGreaterThanOrEqual(1);
    expect(kit.sim.machineView(0, 6, 0)!.status).toMatch(/^Drilling at depth 4 - bit 55 of 64 left$/);
    kit.run(3 * 9 + 0.5);
    for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) expect(kit.world.getVoxel(dx, 3, dz)).toBe(0);
    kit.run(4);
    expect(rig.halted).toBe('Reached corestone');
    expect(rig.demandW).toBe(0);
  });

  it('will not run without a bit, takes a fresh one from a touching crate, and only takes bits by hand', () => {
    const kit = makeKit();
    kit.world.fill(-1, 1, -1, 1, 4, 1, 'stone');
    const rig = kit.machine('drill_rig', 0, 6, 0);
    bank(kit, 1, 6, 0);
    kit.run(2);
    expect(rig.halted).toBe('Needs a drill bit');
    expect(rig.demandW).toBe(0);
    expect(kit.sim.machineView(0, 6, 0)!.status).toBe('Needs a drill bit');
    expect(voxelStatus(kit.world.getVoxel(0, 6, 0))).toBe(MachineStatus.Starved);
    const slots = kit.sim.machineSlots(0, 6, 0)!;
    expect(slots.accepts('drill_bit', 0)).toBe(true);
    expect(slots.accepts('steel_drill_bit', 0)).toBe(true);
    expect(slots.accepts('rubble', 0)).toBe(false);
    expect(slots.accepts('drill_bit', 1)).toBe(false);

    // A nearly blunt bit, and a spare in a crate on top.
    rig.slots[0] = { item: 'drill_bit', count: 1, durability: 1 };
    const crate = kit.machine('crate', 0, 7, 0);
    crate.slots[0] = { item: 'steel_drill_bit', count: 1 };
    kit.run(4.2);
    expect(rig.slots[0]?.item).toBe('steel_drill_bit');
    expect(count(crate.slots, 'steel_drill_bit')).toBe(0);
    expect(count(crate.slots, 'rubble')).toBe(1);
    // Steel cuts 1.5 times as fast: a block every 2 s.
    kit.run(1.1);
    expect(rig.slots[0]?.durability).toBe(199);
  });

  it('leaves what its bit cannot cut and stops when the centre column reaches it', () => {
    const kit = makeKit();
    kit.world.fill(-1, 3, -1, 1, 3, 1, 'stone');
    kit.world.put(1, 3, 0, 'pitchblende');
    kit.world.put(0, 2, 0, 'pitchblende');
    const rig = kit.machine('drill_rig', 0, 5, 0);
    bank(kit, 1, 5, 0);
    rig.slots[0] = { item: 'steel_drill_bit', count: 1 };
    kit.run(2 * 8 + 2);
    expect(blockOf(kit.world.getVoxel(1, 3, 0)).key).toBe('pitchblende');
    expect(count(rig.slots, 'rubble')).toBe(8);
    expect(rig.halted).toBe('Pitchblende is too hard for this bit');
  });

  it('pauses when the buffer is full and wears like the other machines', () => {
    const kit = makeKit();
    kit.world.fill(-1, 1, -1, 1, 3, 1, 'stone');
    const rig = kit.machine('drill_rig', 0, 5, 0);
    bank(kit, 1, 5, 0);
    rig.slots[0] = { item: 'steel_drill_bit', count: 1 };
    for (let i = 1; i < 10; i++) rig.slots[i] = { item: 'plank', count: 99 };
    kit.run(4);
    expect(kit.sim.machineView(0, 5, 0)!.status).toBe('Buffer full');
    expect(rig.demandW).toBe(0);
    rig.slots[3] = null;
    kit.run(2.5);
    expect(count(rig.slots, 'rubble')).toBe(1);
    expect(kit.sim.machineView(0, 5, 0)!.wear).toBeGreaterThan(0);
  });
});
