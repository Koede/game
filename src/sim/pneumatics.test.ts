import { describe, expect, it } from 'vitest';
import { PNEU_CAPSULE_L, PNEU_CAPSULE_MAX } from '../core/constants';
import { stackMax, type MachineEntity } from './entities';
import { isTubeStation } from './pneumatics';
import { makeKit, type Kit } from './testKit';

/**
 * A crate at x = 0 with a sender on it, a run of `tubes` air tubes along x at y = 5, and a receiver against a second
 * crate at the far end. The network starts at `bar`.
 */
function line(kit: Kit, tubes: number, bar = 3): { from: MachineEntity; to: MachineEntity; end: number } {
  const from = kit.machine('crate', 0, 5, 0);
  kit.world.put(1, 5, 0, 'tube_sender');
  for (let i = 0; i < tubes; i++) kit.world.put(2 + i, 5, 0, 'air_tube');
  const end = 2 + tubes;
  kit.world.put(end, 5, 0, 'tube_receiver');
  const to = kit.machine('crate', end + 1, 5, 0);
  pressurise(kit, 1, 5, 0, bar);
  return { from, to, end };
}

function pressurise(kit: Kit, x: number, y: number, z: number, bar: number): void {
  const net = kit.sim.air.netAt(x, y, z)!;
  net.airL = net.volumeL * bar;
}

const count = (crate: MachineEntity, item: string): number => crate.slots.reduce((n, s) => n + (s?.item === item ? s.count : 0), 0);

describe('pneumatic tubes', () => {
  it('shoots a capsule a second from the sender crate to the receiver crate, for air', () => {
    const kit = makeKit();
    const { from, to } = line(kit, 6, 3);
    from.slots[0] = { item: 'stone', count: 40 };
    const before = kit.sim.air.netAt(1, 5, 0)!.airL;
    kit.run(1.05);
    // One capsule fired: a stack of at most PNEU_CAPSULE_MAX left, and paid for in air.
    expect(count(from, 'stone')).toBe(40 - PNEU_CAPSULE_MAX);
    expect(kit.sim.air.netAt(1, 5, 0)!.airL).toBeCloseTo(before - PNEU_CAPSULE_L, 3);
    expect(count(to, 'stone')).toBe(0); // still on its way
    kit.run(1);
    expect(count(to, 'stone')).toBe(PNEU_CAPSULE_MAX);
    kit.run(2);
    expect(count(from, 'stone')).toBe(0);
    expect(count(to, 'stone')).toBe(40);
    expect(kit.sim.pneumatics.delivered).toBe(3);
  });

  it('does nothing below 1 bar, and says so', () => {
    const kit = makeKit();
    const { from, to, end } = line(kit, 3, 0.5);
    from.slots[0] = { item: 'stone', count: 5 };
    kit.run(3);
    expect(count(from, 'stone')).toBe(5);
    expect(count(to, 'stone')).toBe(0);
    const toasts = kit.record('toast');
    kit.bus.emit('air:use', { x: 1, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toBe('Pneumatic Sender: Needs 1 bar - has 0.5');
    kit.bus.emit('air:use', { x: end, y: 5, z: 0 });
    expect(toasts.at(-1)!.text).toBe('Pneumatic Receiver: Waiting for capsules - 0.5 bar');
  });

  it('says when a station has no crate, and when a sender has no receiver', () => {
    const kit = makeKit();
    kit.world.put(0, 5, 0, 'tube_sender');
    kit.world.put(1, 5, 0, 'air_tube');
    kit.world.put(2, 5, 0, 'air_tank');
    pressurise(kit, 0, 5, 0, 2);
    expect(kit.sim.stationView(0, 5, 0)!.status).toBe('Place it against a crate');
    kit.machine('crate', 0, 6, 0);
    expect(kit.sim.stationView(0, 5, 0)!.status).toBe('No receiver on this network - 2 bar');
    expect(kit.sim.stationView(1, 5, 0)).toBeNull();
  });

  it('sends an item to the receiver whose crate already holds it, else the nearest with room', () => {
    const kit = makeKit();
    // Sender at x = 1 on a tube along x; receivers below the tube at x = 3 (near) and x = 8 (far), crates below them.
    const from = kit.machine('crate', 0, 5, 0);
    kit.world.put(1, 5, 0, 'tube_sender');
    for (let x = 2; x <= 9; x++) kit.world.put(x, 5, 0, 'air_tube');
    kit.world.put(3, 4, 0, 'tube_receiver');
    kit.world.put(8, 4, 0, 'tube_receiver');
    const near = kit.machine('crate', 3, 3, 0);
    const far = kit.machine('crate', 8, 3, 0);
    kit.world.put(10, 5, 0, 'air_tank'); // caps the run
    pressurise(kit, 1, 5, 0, 4);
    far.slots[0] = { item: 'coal', count: 1 };
    from.slots[0] = { item: 'coal', count: 10 };
    from.slots[1] = { item: 'stone', count: 10 };
    kit.run(4);
    expect(count(far, 'coal')).toBe(11);
    expect(count(near, 'stone')).toBe(10);
    expect(count(near, 'coal')).toBe(0);
  });

  it('never promises more room than a crate has: the rest stays in the sender crate', () => {
    const kit = makeKit();
    const { from, to } = line(kit, 2, 5);
    for (let i = 0; i < to.slots.length; i++) to.slots[i] = { item: 'dirt', count: stackMax('dirt') };
    const max = stackMax('stone');
    to.slots[0] = { item: 'stone', count: max - 4 }; // room for 4 stone
    from.slots[0] = { item: 'stone', count: 30 };
    kit.run(5);
    expect(count(to, 'stone')).toBe(max);
    expect(count(from, 'stone')).toBe(26);
    expect(kit.sim.pneumatics.fired).toBe(1);
  });

  it('never sends a capsule back into the crate it came from', () => {
    const kit = makeKit();
    const crate = kit.machine('crate', 0, 5, 0);
    kit.world.put(1, 5, 0, 'tube_sender');
    kit.world.put(0, 5, 1, 'tube_receiver'); // the same crate
    kit.world.put(1, 5, 1, 'air_tube');
    kit.world.put(2, 5, 1, 'air_tank');
    pressurise(kit, 1, 5, 0, 3);
    crate.slots[0] = { item: 'stone', count: 5 };
    kit.run(3);
    expect(kit.sim.pneumatics.fired).toBe(0);
  });

  it('keeps capsules on their way across a save, and the air saved off the stations', () => {
    const kit = makeKit();
    const { from, to, end } = line(kit, 30, 3);
    from.slots[0] = { item: 'stone', count: 8 };
    kit.run(1.05);
    expect(count(from, 'stone')).toBe(0);
    const station = kit.world.getEntity(end, 5, 0);
    expect(isTubeStation(station) && station.inbound).toHaveLength(1);
    kit.sim.air.save();
    for (const e of kit.world.entities()) if (e.kind === 'air') expect(kit.world.getBlock(e.x, e.y, e.z).air?.role).not.toBe('station');
    // The world is loaded again: the simulation follows its entities from scratch.
    kit.sim.resync();
    kit.run(3);
    expect(count(to, 'stone')).toBe(8);
  });

  it('spills what was on its way when the receiver is broken', () => {
    const kit = makeKit();
    const { from, end } = line(kit, 30, 3);
    from.slots[0] = { item: 'stone', count: 8 };
    kit.run(1.05);
    kit.world.put(end, 5, 0, 'air');
    expect(kit.world.getEntity(end, 5, 0)).toBeUndefined();
    kit.run(0.5);
    expect(kit.sim.pneumatics.delivered).toBe(0);
    expect([...kit.world.entities()].some((e) => e.kind === 'tube_station')).toBe(false);
  });
});
