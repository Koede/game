/** Item transport (spec 16.2-16.4): packets, destinations, reservations, re-routing, returning, blocking, the cap. */
import { describe, expect, it } from 'vitest';
import { PIPE_MAX_PACKETS } from '../core/constants';
import { Face } from '../core/types';
import { makeKit, type Kit } from './testKit';
import type { ItemNet } from './itemNet';
import { netOf, run, until } from './pipeKit';
import { isPipeEntity } from './pipeState';

/** A crate (slots) at a position. */
const crate = (kit: Kit, x: number, y: number, z: number) => {
  kit.machine('crate', x, y, z);
  return kit.sim.machineSlots(x, y, z)!;
};

/** Source crate at x=0, pipes x=1..n, destination crate at x=n+1 (all at y=5, z=0). The source end pulls. */
function line(n: number, block = 'item_pipe') {
  const kit = makeKit();
  const src = crate(kit, 0, 5, 0);
  run(kit.world, block, [1, 5, 0], [n, 5, 0]);
  const dst = crate(kit, n + 1, 5, 0);
  return { kit, src, dst };
}

describe('item pipes', () => {
  it('a pulling end sends up to 4 items every 2 s that travel 4 blocks a second', () => {
    const { kit, src, dst } = line(5);
    src.add('coal', 64);
    const toasts = kit.record('toast');
    expect(kit.sim.wrenchPort(1, 5, 0, Face.NX)).toEqual({ ok: true, did: 'port', mode: 'pull' });
    expect(toasts.at(-1)?.text).toBe('Pulling from Crate');
    kit.run(1.2); // 5 blocks at 4 blocks/s: 1.25 s (it left at the end of the first tick)
    expect(dst.count('coal')).toBe(0);
    expect(src.count('coal')).toBe(60);
    const snap = kit.sim.transportView();
    expect(snap.packets).toHaveLength(1);
    expect(snap.packets[0]).toMatchObject({ item: 'coal', count: 4, length: 5, speed: 4, blocked: false });
    expect(snap.packets[0].along).toBeCloseTo(4.6, 5);
    expect(Array.from(snap.packets[0].points.slice(0, 3))).toEqual([1, 5.5, 0.5]); // starts at the crate's face
    expect(kit.sim.transportView()).toBe(snap); // one snapshot per tick
    kit.run(0.1);
    expect(dst.count('coal')).toBe(4);
    kit.run(8.65); // pulls at 0, 2, 4, 6, 8 s; the fifth arrives at 9.25 s
    expect(dst.count('coal')).toBe(20);
    const view = kit.sim.pipeView(3, 5, 0)!;
    expect(view.ports.map((p) => [p.name, p.mode, p.status, p.rate])).toEqual([
      ['Crate', 'pull', 'Moving 4 every 2 s', '4 every 2 s'],
      ['Crate', 'push', 'Receiving Coal', '4 every 2 s'],
    ]);
  });

  it('the steel conveyor moves 16 every half second at 10 blocks a second', () => {
    const { kit, src, dst } = line(10, 'fast_item_pipe');
    src.add('iron_ore', 99);
    src.add('iron_ore', 99);
    kit.sim.wrenchPort(1, 5, 0, Face.NX);
    kit.run(1.1); // 10 blocks at 10 blocks/s: arrivals at 1.0 s (16), then every 0.5 s
    expect(dst.count('iron_ore')).toBe(16);
    kit.run(1);
    expect(dst.count('iron_ore')).toBe(48);
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('Moving 16 every 0.5 s');
  });

  it('reserves room at the destination so packets on their way never overfill it', () => {
    const { kit, src, dst } = line(8);
    for (let i = 0; i < 26; i++) dst.add('stone', 99);
    dst.add('coal', 93); // room for 6 coal
    src.add('coal', 40);
    kit.sim.wrenchPort(1, 5, 0, Face.NX);
    kit.run(2.5); // the first packet (4) is still on its way when the second pull (2) fires
    expect(src.count('coal')).toBe(34);
    kit.run(10);
    expect(dst.count('coal')).toBe(99);
    expect(src.count('coal')).toBe(34);
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('Destination full');
  });

  it('says why a pulling end is idle: nothing to pull, no destination', () => {
    const { kit, src } = line(3);
    kit.sim.wrenchPort(1, 5, 0, Face.NX);
    kit.run(0.5);
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('Nothing to pull');
    kit.sim.setPort(3, 5, 0, Face.PX, { filter: ['iron_ore'], filterMode: 'allow' });
    src.add('coal', 5);
    kit.run(2);
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('No destination');
    kit.sim.setPort(3, 5, 0, Face.PX, { mode: 'off' });
    kit.run(2);
    expect(kit.sim.pipeView(1, 5, 0)!.ports.map((p) => p.status)).toEqual(['No destination', 'Off']);
  });

  /** Source crate at x=0, a steel conveyor x=1..9, crates below it at x=3 (near), 6 and 9 (far); the source pulls. */
  function fan(setup: (kit: Kit) => void, stock: Array<[string, number]> = [['coal', 396], ['iron_ore', 396]]) {
    const kit = makeKit();
    const src = crate(kit, 0, 5, 0);
    run(kit.world, 'fast_item_pipe', [1, 5, 0], [9, 5, 0]);
    const outs = [crate(kit, 3, 4, 0), crate(kit, 6, 4, 0), crate(kit, 9, 4, 0)];
    for (const [item, n] of stock) src.add(item, n);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    setup(kit);
    kit.run(6);
    return outs.map((c) => [c.count('coal'), c.count('iron_ore')]);
  }

  it('sends to the nearest destination by path length', () => {
    const got = fan(() => {});
    expect(got[0][0] + got[0][1]).toBeGreaterThan(100);
    expect(got.slice(1)).toEqual([[0, 0], [0, 0]]);
  });

  it('serves a higher priority first, however far', () => {
    const got = fan((kit) => kit.sim.setPort(9, 5, 0, Face.NY, { priority: 1 }));
    expect(got.slice(0, 2)).toEqual([[0, 0], [0, 0]]);
    expect(got[2][0] + got[2][1]).toBeGreaterThan(100);
  });

  it('takes turns between destinations of one priority when the source says round', () => {
    const got = fan((kit) => kit.sim.setPort(1, 5, 0, Face.NX, { distribution: 'round' }));
    const each = got.map(([c, i]) => c + i);
    expect(Math.max(...each) - Math.min(...each)).toBeLessThanOrEqual(16);
    expect(Math.min(...each)).toBeGreaterThan(30);
  });

  it('lets a filter allow only some items, or keep some out', () => {
    const got = fan((kit) => {
      kit.sim.setPort(3, 5, 0, Face.NY, { filter: ['iron_ore'], filterMode: 'allow' });
      kit.sim.setPort(6, 5, 0, Face.NY, { filter: ['coal'], filterMode: 'deny' });
    }, [['iron_ore', 32], ['coal', 99]]);
    expect(got[0]).toEqual([0, 32]); // the near crate allows iron ore only
    expect(got[1]).toEqual([0, 0]); // the middle one denies coal, and iron ore has a nearer home
    expect(got[2][0]).toBeGreaterThan(0); // coal goes past both
    expect(got[2][1]).toBe(0);
  });

  it('never sends items back into the block they came from', () => {
    const kit = makeKit();
    const box = crate(kit, 0, 5, 0);
    run(kit.world, 'item_pipe', [1, 5, 0], [1, 5, 2]);
    run(kit.world, 'item_pipe', [0, 5, 2], [0, 5, 1]); // a second end into the same crate, from the south
    box.add('coal', 20);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(4);
    expect(box.count('coal')).toBe(20);
    expect(kit.sim.pipeView(1, 5, 0)!.ports.find((p) => p.mode === 'pull')!.status).toBe('No destination');
  });

  it('re-routes a packet whose destination filled up meanwhile, else sends it home', () => {
    const kit = makeKit();
    const src = crate(kit, 0, 5, 0);
    run(kit.world, 'item_pipe', [1, 5, 0], [8, 5, 0]);
    const near = crate(kit, 4, 4, 0);
    const far = crate(kit, 9, 5, 0);
    src.add('coal', 4);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(0.1);
    for (let i = 0; i < 27; i++) near.add('stone', 99); // the player fills it while the packet is on its way
    kit.run(3);
    expect(far.count('coal')).toBe(4);
    // Nowhere else to go: back to the crate it came from.
    src.add('coal', 4);
    kit.run(1);
    far.clear();
    for (let i = 0; i < 27; i++) far.add('stone', 99);
    kit.run(6);
    expect(src.count('coal')).toBe(4);
    expect((netOf(kit, 1, 5, 0) as ItemNet).packets.length).toBeLessThanOrEqual(1);
  });

  it('a packet nobody takes waits at its end ("Blocked") and goes on once there is room', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    f.crucibleOut[0] = { item: 'copper_ingot', count: 3 };
    run(kit.world, 'item_pipe', [1, 5, 0], [6, 5, 0]);
    const box = crate(kit, 7, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(0.1);
    for (let i = 0; i < 27; i++) box.add('stone', 99);
    kit.run(4); // home it goes - and a furnace takes no ingots in
    const view = kit.sim.pipeView(1, 5, 0)!;
    expect(view.ports[0]).toMatchObject({ name: 'Clay Furnace', status: 'Blocked', blocked: 1 });
    expect(kit.sim.transportView().packets[0]).toMatchObject({ item: 'copper_ingot', count: 3, blocked: true });
    kit.sim.machineSlots(7, 5, 0)!.removeAt(0, 99);
    kit.run(3);
    expect(box.count('copper_ingot')).toBe(3);
    expect((netOf(kit, 1, 5, 0) as ItemNet).packets).toHaveLength(0);
  });

  it('pauses pulling at PIPE_MAX_PACKETS packets in flight', () => {
    const { kit, src } = line(600, 'fast_item_pipe');
    for (let i = 0; i < 10; i++) src.add('iron_ore', 99);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(30); // 60 s of travel: the cap is reached first
    const net = netOf(kit, 1, 5, 0) as ItemNet;
    expect(net.packets).toHaveLength(PIPE_MAX_PACKETS);
    expect(kit.sim.pipeView(1, 5, 0)!.ports[0].status).toBe('Pipes are full - waiting');
    expect(kit.sim.pipeView(1, 5, 0)!.network.warnings).toContain('Pipes are full - pulling waits');
    const inFlight = net.packets.reduce((n, p) => n + p.rec.count, 0);
    expect(src.count('iron_ore') + inFlight).toBe(990);
    kit.run(5);
    expect(net.packets).toHaveLength(PIPE_MAX_PACKETS);
  });

  it('feeds a furnace by its smart sides and takes only finished metal out', () => {
    const kit = makeKit();
    const f = kit.furnace(0, 5, 0);
    const supply = crate(kit, 3, 5, 0);
    run(kit.world, 'item_pipe', [1, 5, 0], [2, 5, 0]);
    supply.add('copper_ore', 8);
    supply.add('oak_log', 6);
    supply.add('clay', 4);
    supply.add('stick', 2);
    kit.sim.setPort(2, 5, 0, Face.PX, { mode: 'pull' });
    kit.run(12);
    expect(f.crucibleIn[0]).toEqual({ item: 'copper_ore', count: 8 }); // smeltable: the crucible
    expect(f.fuel[0]).toEqual({ item: 'oak_log', count: 6 }); // logs smelt too, but no crucible holds logs: fuel
    expect(f.fuel.slice(1).every((s) => s === null)).toBe(true);
    expect(supply.count('clay')).toBe(4); // the one crucible holds copper ore: nowhere for clay
    // The firebox takes the sticks too once there is room (one fuel slot: it is full of logs, so they wait).
    expect(supply.count('stick')).toBe(2);
    // A second run on the furnace's top pulls only finished products out.
    const out = crate(kit, 0, 7, 0);
    kit.world.put(0, 6, 0, 'item_pipe');
    kit.sim.setPort(0, 6, 0, Face.NY, { mode: 'pull' });
    f.crucibleOut[0] = { item: 'copper_ingot', count: 5 };
    kit.run(4);
    expect(out.count('copper_ingot')).toBe(5);
    expect(out.count('copper_ore') + out.count('oak_log')).toBe(0);
    expect(f.fuel[0]?.item).toBe('oak_log');
  });
});

describe('item pipes and hearths', () => {
  it('an item hatch stands for its formed hearth and says so when the hearth is not formed', () => {
    const kit = makeKit();
    kit.furnace(0, 5, 0, 'furnace_blast'); // faces north: the hearth's inside is the cell south of it, (0, 5, 1)
    kit.formed(0, 5, 0);
    kit.world.put(1, 5, 1, 'item_hatch'); // swapped for the east wall's brick within one tick: the hearth stays formed
    kit.sim.validateHearths();
    expect(kit.sim.furnaceView(0, 5, 0)!.hearth.formed).toBe(true);
    kit.world.put(2, 5, 1, 'item_pipe');
    const supply = crate(kit, 3, 5, 1);
    supply.add('iron_ore', 20);
    supply.add('coal', 10);
    kit.sim.setPort(2, 5, 1, Face.PX, { mode: 'pull' });
    kit.run(20);
    const e = kit.sim.furnaceAt(0, 5, 0)!;
    expect(e.crucibleIn.reduce((n, s) => n + (s?.item === 'iron_ore' ? s.count : 0), 0)).toBe(20);
    expect(e.fuel[0]).toEqual({ item: 'coal', count: 10 });
    // A hole in the floor: the hatch is no endpoint until the hearth stands again.
    kit.world.setVoxel(0, 4, 1, 0);
    supply.add('iron_ore', 4);
    kit.run(2.5);
    expect(kit.sim.pipeView(2, 5, 1)!.ports.find((p) => p.block === 'item_hatch')!.status).toBe('The hearth is not formed');
    expect(supply.count('iron_ore')).toBe(4);
    kit.world.put(0, 4, 1, 'brick');
    kit.run(2.5);
    expect(supply.count('iron_ore')).toBe(0);
  });
});

describe('packets and the world', () => {
  it('packets in flight are saved on the network\'s pipe entity and delivered on load', () => {
    const a = line(12);
    a.src.add('coal', 12);
    a.kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    a.kit.run(4.5); // three packets left, none arrived yet (12 blocks: 3 s each)
    expect(a.dst.count('coal')).toBe(4);
    const saved = JSON.parse(JSON.stringify([...a.kit.world.entities()]));
    const anchor = saved.find(isPipeEntity);
    expect(anchor.packets).toHaveLength(2);
    expect(anchor.packets[0]).toEqual({ item: 'coal', count: 4, from: [1, 5, 0, Face.NX], to: [12, 5, 0, Face.PX] });

    const b = makeKit();
    for (let x = 1; x <= 12; x++) b.world.put(x, 5, 0, 'item_pipe');
    b.world.put(0, 5, 0, 'crate');
    b.world.put(13, 5, 0, 'crate');
    for (const e of [...b.world.entities()]) b.world.removeEntity(e.x, e.y, e.z);
    for (const e of saved) b.world.setEntity(e);
    b.sim.resync();
    b.sim.tick(0.05);
    b.sim.tick(0.05);
    expect(b.sim.machineSlots(13, 5, 0)!.count('coal')).toBe(12);
    expect(b.sim.machineSlots(0, 5, 0)!.count('coal')).toBe(0);
  });

  it('items in a pipe that is broken go where they were headed (else home, else to the player)', () => {
    const { kit, src, dst } = line(10);
    src.add('coal', 4);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(1.5); // about 6 blocks along
    const net = netOf(kit, 1, 5, 0) as ItemNet;
    kit.world.setVoxel(net.xs[net.packets[0].here], 5, 0, 0);
    kit.run(0.1);
    expect(dst.count('coal')).toBe(4);
    // With both ends gone too, the player gets them.
    const two = line(10);
    two.src.add('coal', 4);
    two.kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    two.kit.run(1);
    two.kit.world.setVoxel(11, 5, 0, 0);
    two.kit.world.setVoxel(0, 5, 0, 0);
    const n2 = netOf(two.kit, 3, 5, 0) as ItemNet;
    two.kit.world.setVoxel(n2.xs[n2.packets[0].here], 5, 0, 0);
    two.kit.run(0.1);
    expect(two.kit.player.inventory.count('coal')).toBe(4);
  });

  it('packets keep going when the network changes elsewhere', () => {
    const { kit, src, dst } = line(10);
    src.add('coal', 4);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull' });
    kit.run(1);
    kit.world.put(5, 6, 0, 'item_pipe'); // a branch: the network is rebuilt
    kit.run(2);
    expect(dst.count('coal')).toBe(4);
    until(kit, 'nothing in flight', () => (netOf(kit, 1, 5, 0) as ItemNet).packets.length === 0, 5);
  });
});
