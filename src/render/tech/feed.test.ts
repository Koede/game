/** The transport feed against the real simulation: packets in flight, and which networks carry what. */
import { describe, expect, it } from 'vitest';
import { Face } from '../../core/types';
import { run } from '../../sim/pipeKit';
import { makeKit } from '../../sim/testKit';
import { simTransportFeed } from './feed';

describe('simTransportFeed', () => {
  it('shows a water line that streams everything straight through as flowing, though its pipes hold nothing', () => {
    const kit = makeKit();
    kit.world.put(0, 4, 0, 'water');
    kit.world.put(1, 4, 0, 'water');
    kit.machine('pump', 0, 5, 0);
    kit.machine('lithium_bank', 0, 6, 0).storedJ = 40e6;
    run(kit.world, 'fluid_pipe', [1, 5, 0], [3, 5, 0]);
    kit.machine('tank', 4, 5, 0);
    kit.run(3);
    const feed = simTransportFeed(kit.sim);
    const f = feed.frame();
    expect(kit.sim.transportView().fluids).toHaveLength(0); // empty at the end of every tick
    expect(f.netCount).toBe(1);
    const net = f.nets[0];
    expect(net).toMatchObject({ family: 'fluid', fluid: 'water', glow: false, flowing: true, size: 3 });
    expect(net.fill).toBeLessThan(0.05);
    expect(net.colour).toBe(0x3a86b4);
    expect(Array.from(net.xs.slice(0, net.size)).sort()).toEqual([1, 2, 3]);
    // Same tick, same object; the next tick refreshes it in place.
    expect(feed.frame()).toBe(f);
    kit.run(0.05);
    expect(feed.frame()).toBe(f);
    expect(f.tick).toBe(kit.sim.transportView().tick);
  });

  it('lists packets with their paths and the item network as carrying, then nothing once it is idle', () => {
    const kit = makeKit();
    kit.machine('crate', 0, 5, 0);
    kit.sim.machineSlots(0, 5, 0)!.add('iron_ore', 8);
    run(kit.world, 'item_pipe', [1, 5, 0], [6, 5, 0]);
    kit.machine('crate', 7, 5, 0);
    kit.sim.wrenchPort(1, 5, 0, Face.NX);
    kit.run(0.5);
    const feed = simTransportFeed(kit.sim);
    let f = feed.frame();
    expect(f.packets.length).toBe(1);
    expect(f.packets[0]).toMatchObject({ item: 'iron_ore', speed: 4 });
    expect(f.packets[0].points.length).toBeGreaterThanOrEqual(6);
    expect(f.netCount).toBe(1);
    expect(f.nets[0]).toMatchObject({ family: 'item', fluid: null, size: 6 });
    kit.run(12);
    f = feed.frame();
    expect(f.packets.length).toBe(0);
    expect(f.netCount).toBe(0);
    expect(kit.sim.machineSlots(7, 5, 0)!.count('iron_ore')).toBe(8);
  });

  it('keeps a full, still line drawn at its fill and names lava as glowing', () => {
    const kit = makeKit();
    const src = kit.machine('tank', 0, 5, 0);
    src.fluidIn = { fluid: 'lava', litres: 4000 };
    run(kit.world, 'hot_fluid_pipe', [1, 5, 0], [4, 5, 0]);
    kit.sim.wrenchPort(1, 5, 0, Face.NX);
    kit.run(2);
    const f = simTransportFeed(kit.sim).frame();
    expect(f.netCount).toBe(1);
    expect(f.nets[0]).toMatchObject({ fluid: 'lava', glow: true, fill: 1, flowing: false });
  });
});
