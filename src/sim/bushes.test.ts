import { describe, expect, it } from 'vitest';
import { blockId, blockOf, machine } from '../core/registry';
import { makeVoxel } from '../core/types';
import { makeKit } from './testKit';

const REGROW_S = machine('berry_bush').params!.regrowS;

describe('berry bushes', () => {
  it('a picked bush fruits again after regrowS, anywhere, at any hour, and is never a machine', () => {
    const kit = makeKit();
    const placed = kit.record('machine:placed');
    const grew = kit.record('crop:grew');
    const sfx = kit.record('sfx');
    kit.clock.setTimeOfDay(0.8); // night, nothing underneath, a stone roof
    kit.world.put(0, 6, 0, 'stone');
    kit.world.setVoxel(0, 1, 0, makeVoxel(blockId('berry_bush_bare')), 'player');
    expect(kit.world.getEntity(0, 1, 0)).toEqual({ kind: 'berry_bush', x: 0, y: 1, z: 0, growS: 0 });
    expect(kit.sim).toMatchObject({ cropCount: 1, entityCount: 0 });
    expect(kit.sim.machineAt(0, 1, 0)).toBeNull();
    expect(kit.sim.machineView(0, 1, 0)).toBeNull();
    expect(kit.sim.cropView(0, 1, 0)).toMatchObject({ crop: 'berry_bush', ripe: false, rate: 1, status: 'Fruiting again', ripeInS: REGROW_S });
    kit.run(REGROW_S - 1);
    expect(blockOf(kit.world.getVoxel(0, 1, 0)).key).toBe('berry_bush_bare');
    kit.run(1.05);
    expect(blockOf(kit.world.getVoxel(0, 1, 0)).key).toBe('berry_bush');
    expect(grew).toEqual([{ x: 0, y: 1, z: 0, stage: 1, ripe: true }]);
    expect(kit.sim.cropView(0, 1, 0)).toMatchObject({ ripe: true, status: 'Ripe' });
    expect(kit.sim.cropsAwake).toBe(0);
    expect(placed).toEqual([]);
    expect(sfx.every((s) => s.name === 'pickup')).toBe(true); // at most the ripening chime
  });

  it('picking leaves the bare bush with the same entity, which starts over', () => {
    const kit = makeKit();
    kit.world.put(0, 1, 0, 'berry_bush_bare');
    kit.run(REGROW_S + 1);
    const e = kit.world.getEntity(0, 1, 0);
    expect(blockOf(kit.world.getVoxel(0, 1, 0)).key).toBe('berry_bush');
    kit.world.setVoxel(0, 1, 0, makeVoxel(blockId('berry_bush_bare')), 'player'); // picked (harvestLeaves)
    expect(kit.world.getEntity(0, 1, 0)).toBe(e);
    kit.run(REGROW_S / 2);
    expect(kit.sim.cropView(0, 1, 0)!.progress).toBeCloseTo(0.5, 2);
    // Dug up: forgotten, nothing given back by the simulation.
    kit.world.setVoxel(0, 1, 0, 0, 'player');
    expect(kit.world.getEntity(0, 1, 0)).toBeUndefined();
    expect(kit.sim.cropCount).toBe(0);
    expect(kit.player.inventory.isEmpty()).toBe(true);
  });

  it('a wild bush picked for the first time grows an entity then', () => {
    const kit = makeKit();
    kit.world.put(0, 1, 0, 'berry_bush');
    kit.world.setVoxel(0, 1, 0, makeVoxel(blockId('berry_bush_bare')), 'player');
    expect(kit.world.getEntity(0, 1, 0)).toMatchObject({ kind: 'berry_bush', growS: 0 });
  });

  it('adopts a bush saved as a machine before bushes regrew', () => {
    const kit = makeKit();
    kit.world.setEntity({ kind: 'berry_bush', x: 2, y: 1, z: 2, on: true, slots: [] });
    kit.world.put(2, 1, 2, 'berry_bush_bare');
    kit.sim.resync();
    expect(kit.sim.machineAt(2, 1, 2)).toBeNull();
    kit.run(REGROW_S + 1);
    expect(blockOf(kit.world.getVoxel(2, 1, 2)).key).toBe('berry_bush');
  });
});
