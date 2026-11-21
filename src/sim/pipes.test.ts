/** Pipe networks (spec 16.1, 16.3, 16.4): how they are built, joined, parted, capped and remembered. */
import { describe, expect, it } from 'vitest';
import { PIPE_MAX_PIPES, PIPE_MAX_PORTS } from '../core/constants';
import { Face, voxelActive } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import type { FluidNet } from './fluidNet';
import { netOf, run } from './pipeKit';
import { cellKey, isPipeEntity, keyX, keyY, keyZ, stepKey, type PipeEntity } from './pipeState';
import { makeKit } from './testKit';

const pipeEntities = (kit: ReturnType<typeof makeKit>): PipeEntity[] => [...kit.world.entities()].filter(isPipeEntity);

describe('cell keys', () => {
  it('round-trip positions, negative ones too, and step to neighbours without wrapping', () => {
    for (const [x, y, z] of [[0, 0, 0], [-5, 7, 12], [1000, 95, -2000], [-1, 127, -1]]) {
      const k = cellKey(x, y, z);
      expect([keyX(k), keyY(k), keyZ(k)]).toEqual([x, y, z]);
    }
    const k = cellKey(-3, 5, -9);
    expect(stepKey(k, Face.PX)).toBe(cellKey(-2, 5, -9));
    expect(stepKey(k, Face.NZ)).toBe(cellKey(-3, 5, -10));
    expect(stepKey(k, Face.PY)).toBe(cellKey(-3, 6, -9));
    expect(stepKey(cellKey(4, 0, 4), Face.NY)).toBe(-1);
  });
});

describe('pipe networks', () => {
  it('flood-fills touching pipes of one family; item and fluid pipes never join', () => {
    const kit = makeKit();
    run(kit.world, 'item_pipe', [0, 5, 0], [9, 5, 0]);
    run(kit.world, 'fast_item_pipe', [10, 5, 0], [12, 5, 0]);
    run(kit.world, 'fluid_pipe', [0, 6, 0], [9, 6, 0]);
    const items = netOf(kit, 0, 5, 0);
    expect(items.family).toBe('item');
    expect(items.size).toBe(13);
    expect(netOf(kit, 12, 5, 0)).toBe(items);
    const fluids = netOf(kit, 3, 6, 0);
    expect(fluids.family).toBe('fluid');
    expect(fluids.size).toBe(10);
    expect((fluids as FluidNet).capacity).toBe(2500);
    expect(kit.sim.transport.items).toHaveLength(1);
    expect(kit.sim.transport.fluids).toHaveLength(1);
  });

  it('finds ports where a pipe touches an endpoint of its family, with the default modes', () => {
    const kit = makeKit();
    kit.machine('crate', 0, 5, 0);
    run(kit.world, 'item_pipe', [1, 5, 0], [3, 5, 0]);
    kit.furnace(4, 5, 0);
    kit.machine('bore_rig', 2, 6, 0);
    kit.machine('lamp', 2, 4, 0); // no slots: not an item endpoint
    const net = netOf(kit, 1, 5, 0);
    expect(net.ports.map((p) => [p.block.key, p.cfg.mode])).toEqual([
      ['crate', 'push'],
      ['bore_rig', 'pull'], // a block that only gives starts pulling
      ['furnace_clay', 'push'],
    ]);
    kit.machine('pump', 0, 8, 0);
    kit.machine('tank', 2, 8, 0);
    kit.world.put(1, 8, 0, 'fluid_pipe');
    kit.machine('crate', 1, 9, 0); // not a fluid endpoint
    expect(netOf(kit, 1, 8, 0).ports.map((p) => [p.block.key, p.cfg.mode])).toEqual([['tank', 'push'], ['pump', 'pull']]);
  });

  it('rebuilds only when pipes or endpoints come and go, splitting and merging networks', () => {
    const kit = makeKit();
    run(kit.world, 'item_pipe', [0, 5, 0], [8, 5, 0]);
    const whole = netOf(kit, 0, 5, 0);
    kit.world.put(20, 5, 20, 'stone');
    kit.world.put(1, 6, 0, 'dirt');
    kit.run(1);
    expect(netOf(kit, 0, 5, 0)).toBe(whole); // other blocks never rebuild
    kit.world.setVoxel(4, 5, 0, 0);
    const west = netOf(kit, 0, 5, 0);
    const east = netOf(kit, 8, 5, 0);
    expect(west).not.toBe(east);
    expect([west.size, east.size]).toEqual([4, 4]);
    kit.world.put(4, 5, 0, 'fast_item_pipe');
    expect(netOf(kit, 0, 5, 0)).toBe(netOf(kit, 8, 5, 0));
    expect(netOf(kit, 0, 5, 0).size).toBe(9);
  });

  it('the wrench parts and joins two pipes, and the parting is saved on the pipes', () => {
    const kit = makeKit();
    run(kit.world, 'item_pipe', [0, 5, 0], [5, 5, 0]);
    const toasts = kit.record('toast');
    const sfx = kit.record('sfx');
    expect(kit.sim.wrenchJoint(2, 5, 0, Face.PX)).toEqual({ ok: true, did: 'joint', joined: false });
    expect(netOf(kit, 0, 5, 0)).not.toBe(netOf(kit, 5, 5, 0));
    expect(netOf(kit, 2, 5, 0).joints).toMatchObject([{ x: 2, y: 5, z: 0, dir: Face.PX, reason: 'cut' }]);
    expect(pipeEntities(kit).map((e) => [e.x, e.cut])).toEqual(expect.arrayContaining([[2, 1 << Face.PX], [3, 1 << Face.NX]]));
    expect(toasts.at(-1)?.text).toBe('Pipes parted');
    expect(sfx.at(-1)).toMatchObject({ name: 'pipe_clunk', x: 2, y: 5, z: 0 });
    expect(kit.sim.wrench(3, 5, 0, Face.NX)).toEqual({ ok: true, did: 'joint', joined: true });
    expect(netOf(kit, 0, 5, 0)).toBe(netOf(kit, 5, 5, 0));
    expect(toasts.at(-1)?.text).toBe('Pipes joined');
    expect(pipeEntities(kit)).toEqual([]); // nothing left to remember
    expect(kit.sim.wrenchJoint(2, 5, 0, Face.PY)).toEqual({ ok: false, reason: 'No pipe to join on that side' });
    expect(kit.sim.wrench(2, 6, 0, Face.PX)).toEqual({ ok: false, reason: 'That is not a pipe' });
  });

  it('refuses to join two fluid networks holding different fluids, and joins them once one runs dry', () => {
    const kit = makeKit();
    run(kit.world, 'hot_fluid_pipe', [0, 5, 0], [3, 5, 0]);
    run(kit.world, 'hot_fluid_pipe', [5, 5, 0], [8, 5, 0]);
    const water = netOf(kit, 0, 5, 0) as FluidNet;
    const lava = netOf(kit, 8, 5, 0) as FluidNet;
    water.store.fluid = 'water';
    water.store.litres = 300;
    lava.store.fluid = 'lava';
    lava.store.litres = 500;
    kit.world.put(4, 5, 0, 'hot_fluid_pipe');
    const a = netOf(kit, 0, 5, 0) as FluidNet;
    const b = netOf(kit, 8, 5, 0) as FluidNet;
    expect(a).not.toBe(b);
    expect([a, b]).toContain(netOf(kit, 4, 5, 0)); // the new pipe joined one side; the other joint stays open
    expect(a.store).toEqual({ fluid: 'water', litres: 300 });
    expect(b.store).toEqual({ fluid: 'lava', litres: 500 });
    expect(a.joints).toMatchObject([{ reason: 'mismatch' }]);
    expect(b.joints).toMatchObject([{ reason: 'mismatch' }]);
    expect(kit.sim.pipeView(4, 5, 0)!.joints[0].text).toBe('The pipes hold different fluids');
    expect(kit.sim.pipeView(4, 5, 0)!.network.warnings).toContain('Touches pipes holding another fluid');
    // Drained dry (a pulling tank empties it), the water side forgets its fluid and the joint closes.
    kit.machine('tank', 0, 6, 0);
    expect(kit.sim.setPort(0, 5, 0, Face.PY, { mode: 'push' })).toEqual({ ok: true });
    kit.run(2.5);
    const merged = netOf(kit, 0, 5, 0) as FluidNet;
    expect(merged).toBe(netOf(kit, 8, 5, 0));
    expect(merged.store.fluid).toBe('lava');
  });

  it('a hot fluid never reaches a cold pipe: the joint stays open with "Too hot for this pipe"', () => {
    const kit = makeKit();
    run(kit.world, 'hot_fluid_pipe', [0, 5, 0], [3, 5, 0]);
    const hot = netOf(kit, 0, 5, 0) as FluidNet;
    hot.store.fluid = 'lava';
    hot.store.litres = 800;
    kit.world.put(4, 5, 0, 'fluid_pipe');
    expect(netOf(kit, 4, 5, 0)).not.toBe(netOf(kit, 3, 5, 0));
    expect(netOf(kit, 3, 5, 0).joints).toMatchObject([{ reason: 'hot' }]);
    expect(kit.sim.pipeView(4, 5, 0)!.joints[0]).toMatchObject({ reason: 'hot', text: 'Too hot for this pipe' });
    expect((netOf(kit, 0, 5, 0) as FluidNet).store).toEqual({ fluid: 'lava', litres: 800 });
  });

  it('caps a network at PIPE_MAX_PIPES pipes and PIPE_MAX_PORTS ports; the rest is inert and says so', () => {
    const kit = makeKit();
    const n = PIPE_MAX_PIPES + 40;
    run(kit.world, 'item_pipe', [0, 5, 0], [n - 1, 5, 0]);
    for (let x = 0; x < PIPE_MAX_PORTS + 6; x++) kit.machine('crate', x * 2, 6, 0);
    const net = netOf(kit, 0, 5, 0);
    expect(net.size).toBe(PIPE_MAX_PIPES);
    expect(net.overflow).toHaveLength(40);
    expect(net.ports).toHaveLength(PIPE_MAX_PORTS);
    expect(net.extraPorts).toHaveLength(6);
    const view = kit.sim.pipeView(0, 5, 0)!;
    expect(view.network.warnings).toEqual([`Network too long - ${PIPE_MAX_PIPES} of ${n} pipes work`, 'Too many ends - 6 do nothing']);
    expect(view.ports.filter((p) => p.inert).every((p) => p.status === 'Network too long')).toBe(true);
    expect(kit.sim.transport.netAt(n - 1, 5, 0)).toBe(net); // inert pipes still belong to the run
  });

  it('keeps settings only where a pipe touches an endpoint, and anchors each network with ports on one pipe entity', () => {
    const kit = makeKit();
    kit.machine('crate', 0, 5, 0);
    run(kit.world, 'item_pipe', [1, 5, 0], [4, 5, 0]);
    kit.sim.transport.refresh();
    expect(pipeEntities(kit)).toHaveLength(1); // the anchor (it holds the packets in flight)
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull', priority: 2, filter: ['coal'], filterMode: 'allow' })).toEqual({ ok: true });
    const holder = pipeEntities(kit).find((e) => e.ports)!;
    expect(holder).toMatchObject({ x: 1, y: 5, z: 0 });
    expect(holder.ports![Face.NX]).toEqual({ mode: 'pull', distribution: 'nearest', filter: ['coal'], filterMode: 'allow', priority: 2 });
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { priority: 3 })).toEqual({ ok: false, reason: 'Priority goes from -2 to 2' });
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { filter: ['a', 'b', 'c', 'd', 'e', 'f'] })).toEqual({ ok: false, reason: 'A filter holds at most 5 entries' });
    expect(kit.sim.setPort(1, 5, 0, Face.NX, { filter: ['nonsense'] })).toEqual({ ok: false, reason: '"nonsense" is not an item' });
    expect(kit.sim.setPort(2, 5, 0, Face.PZ, { mode: 'pull' })).toEqual({ ok: false, reason: 'Nothing to connect to on that side' });
    // The crate goes: its port's settings go with it, and with no port and nothing inside, no entity is left.
    kit.world.setVoxel(0, 5, 0, 0);
    kit.run(0.1);
    expect(pipeEntities(kit)).toEqual([]);
    // Breaking a pipe that held settings drops its entity.
    kit.machine('crate', 0, 5, 0);
    kit.sim.setPort(1, 5, 0, Face.NX, { mode: 'off' });
    kit.world.setVoxel(1, 5, 0, 0);
    kit.run(0.1);
    expect(kit.world.getEntity(1, 5, 0)).toBeUndefined();
  });

  it('marks a network\'s pipes active while it carries something', () => {
    const kit = makeKit();
    kit.machine('pump', 0, 5, 0);
    kit.world.put(0, 4, 0, 'water');
    kit.world.put(1, 4, 0, 'water');
    run(kit.world, 'fluid_pipe', [1, 5, 0], [4, 5, 0]);
    kit.machine('tank', 5, 5, 0);
    expect(voxelActive(kit.world.getVoxel(2, 5, 0))).toBe(false);
    // The pump has no power: nothing moves, nothing lights.
    kit.run(1);
    expect(voxelActive(kit.world.getVoxel(2, 5, 0))).toBe(false);
    kit.machine('solar_panel', 0, 6, 0);
    kit.run(2);
    for (let x = 1; x <= 4; x++) expect(voxelActive(kit.world.getVoxel(x, 5, 0))).toBe(true);
  });
});

describe('pipes and the saved world', () => {
  it('port settings and parted joints come back with a loaded save', () => {
    const a = makeKit();
    a.machine('crate', 0, 5, 0);
    run(a.world, 'item_pipe', [1, 5, 0], [6, 5, 0]);
    a.sim.setPort(1, 5, 0, Face.NX, { mode: 'pull', distribution: 'round', filter: ['coal'], filterMode: 'allow', priority: -1 });
    a.sim.wrenchJoint(3, 5, 0, Face.PX);
    const saved = JSON.parse(JSON.stringify([...a.world.entities()]));

    const b = makeKit();
    b.world.put(0, 5, 0, 'crate');
    run(b.world, 'item_pipe', [1, 5, 0], [6, 5, 0]);
    for (const e of [...b.world.entities()]) b.world.removeEntity(e.x, e.y, e.z);
    for (const e of saved) b.world.setEntity(e);
    b.sim.resync();
    const view = b.sim.pipeView(1, 5, 0)!;
    expect(view.ports[0]).toMatchObject({ mode: 'pull', distribution: 'round', filter: ['coal'], filterMode: 'allow', priority: -1 });
    expect(view.network.pipes).toBe(3);
    expect(view.joints).toMatchObject([{ x: 3, dir: Face.PX, reason: 'cut' }]);
  });

  it('finds saved networks when their chunks load, and grows a network into a chunk that loads later', () => {
    /** A fake world whose chunk column x >= 16 is not loaded until `ready`. */
    class Partial extends FakeWorld {
      ready = false;
      override isLoaded(...at: number[]): boolean {
        return this.ready || (at[0] ?? 0) < 16;
      }
      override getVoxel(x: number, y: number, z: number): number {
        return this.isLoaded(x) ? super.getVoxel(x, y, z) : 0;
      }
    }
    const a = makeKit();
    const t = a.machine('tank', 20, 5, 0);
    t.fluidIn = { fluid: 'water', litres: 8000 };
    run(a.world, 'fluid_pipe', [10, 5, 0], [19, 5, 0]);
    a.sim.setPort(19, 5, 0, Face.PX, { mode: 'pull' });
    a.run(15); // the pipes fill to 2500 L and nobody takes it
    expect((netOf(a, 10, 5, 0) as FluidNet).store).toEqual({ fluid: 'water', litres: 2500 });
    const saved = JSON.parse(JSON.stringify([...a.world.entities()]));
    const anchor = saved.find(isPipeEntity);
    expect(anchor).toMatchObject({ store: { fluid: 'water', litres: 2500 } });

    let world: Partial | null = null;
    const b = makeKit((bus) => (world = new Partial(bus)));
    const w = world as unknown as Partial;
    w.ready = true;
    b.world.put(20, 5, 0, 'tank');
    run(b.world, 'fluid_pipe', [10, 5, 0], [19, 5, 0]);
    for (const e of [...b.world.entities()]) b.world.removeEntity(e.x, e.y, e.z);
    for (const e of saved) b.world.setEntity(e);
    w.ready = false;
    b.sim.resync();
    // Only x < 16 is loaded: the part found so far keeps all the water (it cannot know how much was further on)...
    const part = netOf(b, 10, 5, 0) as FluidNet;
    expect(part.size).toBe(6);
    expect(part.store).toEqual({ fluid: 'water', litres: 2500 });
    expect(part.ports).toEqual([]);
    // ...and when the rest arrives, it is one network with all its water again.
    w.ready = true;
    b.bus.emit('chunk:loaded', { cx: 1, cz: 0 });
    const net = netOf(b, 10, 5, 0) as FluidNet;
    expect(net.size).toBe(10);
    expect(net.store).toEqual({ fluid: 'water', litres: 2500 });
    expect(net.ports.map((p) => p.cfg.mode)).toEqual(['pull']);
  });
});
