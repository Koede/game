import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import { FLAG_DROVE_TRACTOR } from '../core/constants';
import { FakeWorld } from '../game/fakeWorld';
import { PlayerState } from '../game';
import { createIntent, type Intent } from '../player/input/intent';
import { CANISTER_S, TANK_S, createTractor } from './tractor';
import { VehicleManager, USE_COOLDOWN_S, wrapIntentSource } from './manager';
import { harvestSwath, swathCells, tillSwath, workSwath } from './tractorWork';
import { block } from '../core/registry';
import { makeVoxel, voxelId } from '../core/types';

function rig() {
  const bus = createBus();
  const world = new FakeWorld(bus);
  world.fill(-30, 9, -30, 30, 9, 30, 'grass');
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 8.5 });
  player.yaw = 0;
  player.pitch = 0;
  const flags: string[] = [];
  const toasts: string[] = [];
  const sfx: string[] = [];
  bus.on('flag', (e) => flags.push(e.flag));
  bus.on('toast', (e) => toasts.push(e.text));
  bus.on('sfx', (e) => sfx.push(e.name));
  let n = 0.37;
  const rng = (): number => (n = (n * 9301 + 49297) % 233280) / 233280;
  const vehicles = new VehicleManager({ world, bus, player, rng });
  const hold = (item: string, count = 1): void => player.inventory.set(player.selectedSlot, { item, count });
  const count = (item: string): number => player.inventory.slots.reduce((a, s) => a + (s?.item === item ? s.count : 0), 0);
  const intent = (patch: Partial<Intent> = {}): Intent => Object.assign(createIntent(), patch);
  return { bus, world, player, vehicles, flags, toasts, sfx, hold, count, intent };
}

describe('tractor attachments', () => {
  it('the tiller turns the grass and dirt of the swath into farmland and clears plants, leaving stone and water alone', () => {
    const r = rig();
    const t = createTractor(1, 0.5, 10, 0.5, 0, 'tiller', TANK_S);
    r.world.put(0, 10, -1, 'tall_grass');
    r.world.put(1, 9, -2, 'dirt');
    r.world.put(-1, 9, -1, 'stone');
    r.world.put(0, 9, -2, 'water');
    const cells = swathCells(t);
    expect(cells.length).toBeGreaterThan(12);
    const result = tillSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t);
    expect(result.count).toBeGreaterThan(10);
    expect(r.world.getBlock(0, 9, -1).key).toBe('farmland');
    expect(r.world.getBlock(0, 10, -1).key).toBe('air'); // the tall grass went
    expect(r.world.getBlock(1, 9, -2).key).toBe('farmland');
    expect(r.world.getBlock(-1, 9, -1).key).toBe('stone');
    expect(r.world.getBlock(0, 9, -2).key).toBe('water');
    // Beside the swath nothing changed.
    expect(r.world.getBlock(10, 9, 0).key).toBe('grass');
    expect(r.flags).toContain('tilled');
    expect(r.sfx).toContain('till');
    // A second pass finds nothing left to till.
    expect(tillSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t).count).toBe(0);
  });

  it('the swath follows the heading: a tractor turned to face +X tills ahead of it on +X', () => {
    const r = rig();
    const t = createTractor(1, 0.5, 10, 0.5, -Math.PI / 2, 'tiller', TANK_S);
    tillSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t);
    expect(r.world.getBlock(2, 9, 0).key).toBe('farmland');
    expect(r.world.getBlock(0, 9, -3).key).toBe('grass');
    expect(r.world.getBlock(-3, 9, 0).key).toBe('grass');
  });

  it('the harvester cuts ripe crops only, gives the harvest and puts one seed back', () => {
    const r = rig();
    const t = createTractor(1, 0.5, 10, 0.5, 0, 'harvester', TANK_S);
    for (let x = -1; x <= 1; x++) {
      r.world.put(x, 9, -1, 'farmland');
      r.world.put(x, 10, -1, x === 0 ? 'wheat_1' : 'wheat_3');
      r.world.put(x, 9, -2, 'farmland');
      r.world.put(x, 10, -2, 'carrot_3');
    }
    const broken: number[] = [];
    r.bus.on('block:broken', (e) => broken.push(e.x));
    const result = harvestSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t);
    expect(result.count).toBe(5);
    expect(broken).toHaveLength(5);
    expect(r.count('wheat')).toBeGreaterThan(0);
    expect(r.count('carrot')).toBeGreaterThan(0);
    // The young one stands; the cut ones were replanted as stage 0.
    expect(r.world.getBlock(0, 10, -1).key).toBe('wheat_1');
    expect(r.world.getBlock(1, 10, -1).key).toBe('wheat_0');
    expect(r.world.getBlock(0, 10, -2).key).toBe('carrot_0');
    expect(r.sfx).toContain('harvest');
    // Nothing ripe is left: a second pass cuts nothing.
    expect(harvestSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t).count).toBe(0);
  });

  it('a full pack drops the rest at the tractor instead of losing it', () => {
    const r = rig();
    for (let i = 0; i < r.player.inventory.slots.length; i++) r.player.inventory.set(i, { item: 'stone', count: 99 });
    const t = createTractor(1, 0.5, 10, 0.5, 0, 'harvester', TANK_S);
    r.world.put(0, 9, -1, 'farmland');
    r.world.put(0, 10, -1, 'potato_3');
    harvestSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.99 }, t);
    expect(r.player.ground.count('potato')).toBeGreaterThan(0);
  });

  it('no attachment, no work', () => {
    const r = rig();
    const t = createTractor(1, 0.5, 10, 0.5, 0, null, TANK_S);
    expect(workSwath({ world: r.world, bus: r.bus, player: r.player, rng: () => 0.5 }, t).count).toBe(0);
    expect(r.world.getBlock(0, 9, 0).key).toBe('grass');
  });
});

describe('VehicleManager: on foot', () => {
  it('a Tractor item used on the ground sets a tractor down facing the way the player does, and uses the item', () => {
    const r = rig();
    r.player.pitch = -0.9; // looking at the ground ahead
    r.hold('tractor');
    const i = r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.tractors.size).toBe(1);
    const t = [...r.vehicles.tractors.values()][0];
    expect(t.y).toBeCloseTo(10);
    expect(t.yaw).toBe(r.player.yaw);
    expect(r.count('tractor')).toBe(0);
    expect(i.use).toBe(false); // consumed: the controller does not also place a block
  });

  it('refuses to put one down inside a block', () => {
    const r = rig();
    r.player.pitch = -0.9;
    r.hold('tractor');
    r.world.fill(-3, 10, 4, 3, 11, 12, 'stone');
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.tractors.size).toBe(0);
    expect(r.count('tractor')).toBe(1);
  });

  it('Use on a tractor in reach climbs aboard (flag, sound, toast), but not through a wall', () => {
    const r = rig();
    const t = r.vehicles.place(0.5, 10, 6.5, 0, null, TANK_S)!;
    r.world.fill(-2, 10, 7, 2, 12, 7, 'stone'); // a wall between the player and the tractor
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.driving).toBeNull();
    r.world.fill(-2, 10, 7, 2, 12, 7, 'air');
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.driving).toBe(t);
    expect(r.flags).toContain(FLAG_DROVE_TRACTOR);
    expect(r.sfx).toContain('engine_start');
    expect(r.toasts.join(' ')).toMatch(/W\/S drive/);
  });

  it('a Fuel Canister in hand refuels the aimed tractor, an attachment fits, and Shift+Use picks it up', () => {
    const r = rig();
    const t = r.vehicles.place(0.5, 10, 6.5, 0)!;
    r.hold('fuel_canister', 3);
    r.vehicles.handle(r.intent({ use: true }), 0.7);
    expect(t.fuel).toBe(CANISTER_S);
    expect(r.count('fuel_canister')).toBe(2);
    expect(r.vehicles.driving).toBeNull();

    r.hold('tractor_tiller');
    r.vehicles.handle(r.intent({ use: true }), 0.7);
    expect(t.attachment).toBe('tiller');
    r.hold('tractor_harvester');
    r.vehicles.handle(r.intent({ use: true }), 0.7);
    expect(t.attachment).toBe('harvester');
    expect(r.count('tractor_tiller')).toBe(1); // the old one came back

    r.player.inventory.set(r.player.selectedSlot, null);
    r.vehicles.handle(r.intent({ use: true, place: true }), 0.7);
    expect(r.vehicles.tractors.size).toBe(0);
    expect(r.count('tractor')).toBe(1);
    expect(r.count('tractor_harvester')).toBe(1);
  });

  it('a full tank refuses another canister', () => {
    const r = rig();
    const t = r.vehicles.place(0.5, 10, 6.5, 0, null, TANK_S)!;
    r.hold('fuel_canister', 2);
    r.vehicles.handle(r.intent({ use: true }), 0.7);
    expect(r.count('fuel_canister')).toBe(2);
    expect(t.fuel).toBe(TANK_S);
  });

  it('a held Use does not bounce the player on and off', () => {
    const r = rig();
    r.vehicles.place(0.5, 10, 6.5, 0, null, TANK_S);
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.driving).not.toBeNull();
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.driving).not.toBeNull();
    r.vehicles.handle(r.intent({ use: true }), USE_COOLDOWN_S);
    expect(r.vehicles.driving).toBeNull();
  });
});

describe('VehicleManager: driving', () => {
  function aboard(attachment: 'tiller' | 'harvester' | null = null, fuel = TANK_S) {
    const r = rig();
    const t = r.vehicles.place(0.5, 10, 6.5, 0, attachment, fuel)!;
    r.vehicles.handle(r.intent({ use: true }), 0.016);
    expect(r.vehicles.driving).toBe(t);
    const frame = (patch: Partial<Intent>, dt = 1 / 60): Intent => r.vehicles.handle(r.intent(patch), dt);
    return { ...r, t, frame };
  }

  it('carries the player as the seat: position follows, movement and mining are taken from the intent', () => {
    const { t, player, frame } = aboard();
    let i: Intent = createIntent();
    for (let n = 0; n < 120; n++) i = frame({ moveZ: 1, mine: true, jump: false, sprint: true });
    expect(t.z).toBeLessThan(6.5 - 3);
    expect(player.position.z).toBeGreaterThan(t.z); // behind the middle
    expect(Math.abs(player.position.z - t.z)).toBeLessThan(1);
    expect(player.position.y).toBe(t.y);
    expect(player.velocity.z).toBe(0);
    expect(i.moveZ).toBe(0);
    expect(i.mine).toBe(false);
    expect(i.sprint).toBe(false);
    expect(i.use).toBe(false);
  });

  it('the camera heading is the machine heading plus the head turn; looking does not turn the machine', () => {
    const { t, player, frame } = aboard();
    frame({ lookYaw: 0.5 });
    expect(t.yaw).toBe(0);
    expect(player.yaw).toBeCloseTo(-0.5);
    for (let n = 0; n < 60; n++) frame({ moveZ: 1, moveX: -1 });
    expect(t.yaw).toBeGreaterThan(0.2);
    expect(player.yaw).toBeCloseTo(t.yaw - 0.5, 1);
  });

  it('Use gets off beside the machine, on free ground, facing where the machine faced', () => {
    const { t, player, frame, vehicles } = aboard();
    for (let n = 0; n < 60; n++) frame({ moveZ: 1 });
    frame({ use: true }, 0.7);
    expect(vehicles.driving).toBeNull();
    expect(Math.abs(player.position.x - t.x)).toBeGreaterThan(1.2);
    expect(player.position.y).toBeCloseTo(10);
    expect(player.yaw).toBeCloseTo(t.yaw);
    expect(t.speed).toBe(0);
  });

  it('exit squeezed between blocks finds the other side, or the top as a last resort', () => {
    const { t, world, frame, vehicles, player } = aboard();
    world.fill(-5, 10, 4, -1, 12, 9, 'stone');
    frame({ use: true }, 0.7);
    expect(vehicles.driving).toBeNull();
    expect(player.position.x).toBeGreaterThan(t.x);
  });

  it('F (work key) or Mine works the attachment: tills ahead, costs fuel, repeats while held', () => {
    const { t, world, frame, vehicles, sfx } = aboard('tiller');
    vehicles.setWorkKey(true);
    const before = t.fuel;
    for (let n = 0; n < 30; n++) frame({});
    expect(world.getBlock(0, 9, 6 - 1).key).toBe('farmland');
    expect(sfx).toContain('till');
    expect(t.fuel).toBeLessThan(before);
    vehicles.setWorkKey(false);
    const farmland = (): number => {
      let k = 0;
      for (let x = -3; x <= 3; x++) for (let z = -3; z <= 8; z++) if (world.getBlock(x, 9, z).key === 'farmland') k++;
      return k;
    };
    const n0 = farmland();
    for (let n = 0; n < 30; n++) frame({});
    expect(farmland()).toBe(n0); // not held: nothing more
    // Driving on, holding Mine, tills fresh ground.
    for (let n = 0; n < 90; n++) frame({ moveZ: 1, mine: true });
    expect(farmland()).toBeGreaterThan(n0);
  });

  it('work does nothing without fuel or without a tool, and says so when the tank runs dry', () => {
    const none = aboard(null, TANK_S);
    none.vehicles.setWorkKey(true);
    expect(none.vehicles.work()).toBe(0);
    const dry = aboard('tiller', 0);
    dry.vehicles.setWorkKey(true);
    for (let n = 0; n < 40; n++) dry.frame({ moveZ: 1 });
    expect(dry.world.getBlock(0, 9, 5).key).toBe('grass');
    expect(dry.t.speed).toBe(0);
    expect(dry.toasts.join(' ')).toMatch(/ran dry/);
  });

  it('R or Jump swaps to the attachment in the pack, returns the old one, and takes the last one off', () => {
    const { t, player, frame, vehicles, count } = aboard('tiller');
    player.give('tractor_harvester', 1);
    vehicles.pressSwapKey();
    frame({});
    expect(t.attachment).toBe('harvester');
    expect(count('tractor_tiller')).toBe(1);
    expect(count('tractor_harvester')).toBe(0);
    frame({ jump: true }); // a fresh Jump press swaps too
    expect(t.attachment).toBe('tiller');
    expect(count('tractor_harvester')).toBe(1);
    frame({ jump: true }); // held: no repeat
    expect(t.attachment).toBe('tiller');
    frame({});
    frame({ jump: true });
    expect(t.attachment).toBe('harvester');
    // Only one tool in play and none in the pack: swapping takes it off.
    player.inventory.slots.forEach((s, i) => s && player.inventory.set(i, null));
    vehicles.pressSwapKey();
    frame({});
    expect(t.attachment).toBeNull();
    expect(count('tractor_harvester')).toBe(1);
  });

  it('death gets the driver off', () => {
    const { player, frame, vehicles } = aboard();
    player.health = 0;
    (player as unknown as { dead: boolean }).dead = true;
    frame({});
    expect(vehicles.driving).toBeNull();
  });

  it('the wrapped intent source gives the controller the vehicle-edited intent and passes other calls through', () => {
    const r = rig();
    r.vehicles.place(0.5, 10, 6.5, 0, null, TANK_S);
    const raw = { calls: 0, frame(_dt?: number): Intent { this.calls++; return Object.assign(createIntent(), { use: true, moveZ: 1 }); }, other: () => 'ok' };
    const wrapped = wrapIntentSource(raw, r.vehicles);
    expect(wrapped.other()).toBe('ok');
    const a = wrapped.frame(0.016);
    expect(raw.calls).toBe(1);
    expect(r.vehicles.driving).not.toBeNull();
    expect(a.use).toBe(false);
    const b = wrapped.frame(0.016);
    expect(b.moveZ).toBe(0);
  });
});

describe('VehicleManager: saving', () => {
  it('round trips tractors with fuel and attachment, keeps ids unique, and nobody is driving after a load', () => {
    const r = rig();
    const a = r.vehicles.place(0.5, 10, 6.5, 0.3, 'tiller', 400)!;
    r.vehicles.place(8.5, 10, 6.5, 0, 'harvester', 10);
    r.vehicles.enter(a);
    const json = JSON.parse(JSON.stringify(r.vehicles.toJSON()));
    const again = new VehicleManager({ world: r.world, bus: r.bus, player: r.player });
    again.load(json);
    expect(again.tractors.size).toBe(2);
    expect(again.driving).toBeNull();
    expect(again.tractors.get(a.id)).toMatchObject({ x: 0.5, yaw: 0.3, fuel: 400, attachment: 'tiller' });
    const c = again.place(-8.5, 10, 6.5, 0)!;
    expect(c.id).toBeGreaterThan(Math.max(...[...again.tractors.keys()].filter((k) => k !== c.id)));
    // Damaged data is ignored, not thrown.
    again.load({ tractors: [{ id: 'x' }, null, 5] });
    expect(again.tractors.size).toBe(0);
    again.load(undefined);
    expect(again.tractors.size).toBe(0);
  });

  it('views report what the renderer needs', () => {
    const r = rig();
    const t = r.vehicles.place(0.5, 10, 6.5, 0, 'tiller', TANK_S / 2)!;
    expect(r.vehicles.views()).toEqual([
      { id: t.id, x: 0.5, y: 10, z: 6.5, yaw: 0, steer: 0, roll: 0, working: 0, attachment: 'tiller', occupied: false, fuel: 0.5 },
    ]);
    expect(voxelId(makeVoxel(block('wheat_3').id))).toBe(block('wheat_3').id);
  });
});

describe('vehicles persist with the world', () => {
  it('World.persist saves under extras and a reloaded world hands the data back', async () => {
    const { World } = await import('../world');
    const bus = createBus();
    const world = new World(99, bus);
    const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
    world.ensureLoadedAround(0, 0, 1);
    const vm = new VehicleManager({ world, bus, player });
    world.persist('vehicles', () => vm.toJSON());
    vm.place(3.5, 90, 3.5, 0.2, 'tiller', 300);
    const snap = JSON.parse(JSON.stringify(world.toJSON()));
    expect(snap.extras.vehicles.tractors).toHaveLength(1);
    const again = World.fromJSON(snap, createBus());
    const vm2 = new VehicleManager({ world: again, bus, player });
    vm2.load(again.extra('vehicles'));
    expect([...vm2.tractors.values()][0]).toMatchObject({ x: 3.5, fuel: 300, attachment: 'tiller' });
    // A world saved before vehicles has no extra.
    expect(new World(1, createBus()).extra('vehicles')).toBeUndefined();
  });
});
