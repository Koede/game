import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { block } from '../core/registry';
import { Face, type Slot } from '../core/types';
import { World } from '../world';
import { PlayerController } from './controller';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, type RayHit } from './raycast';
import { TAP_COOLDOWN_S, sapToolsFor, type SapTools } from './sapTools';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';

function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const interaction = new Interaction(world, bus, player, new PlayerPhysics(world, player), { triggerSwing: () => {} }, () => 0);
  const hit = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, hit);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  const count = (item: string): number => player.inventory.count(item);
  return { bus, world, player, interaction, aim, hold, count };
}

describe('tapping pine sap', () => {
  it('a beaker on a pine log becomes a beaker of sap', () => {
    const { world, interaction, aim, hold, count, bus } = setup();
    const toasts = record(bus, 'toast');
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'glass_beaker', count: 3 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('worked');
    expect(count('glass_beaker')).toBe(2);
    expect(count('pine_sap')).toBe(1);
    expect(JSON.stringify(toasts)).toContain('sap');
  });

  it('the same log is spent for a while, then weeps again', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'glass_beaker', count: 3 });
    const target = aim(0.5, 10.5, -1.5);
    interaction.use(target);
    expect(interaction.use(target)).toBe('refused');
    expect(count('pine_sap')).toBe(1);
    interaction.updateMining(TAP_COOLDOWN_S + 1, false, null);
    expect(interaction.use(target)).toBe('worked');
    expect(count('pine_sap')).toBe(2);
  });

  it('an oak log gives nothing', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'oak_log');
    hold({ item: 'glass_beaker', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).not.toBe('worked');
    expect(count('pine_sap')).toBe(0);
  });

  it('other items on a pine log do nothing special', () => {
    const { world, interaction, aim, hold, count } = setup();
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'stick', count: 1 });
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(count('pine_sap')).toBe(0);
  });

  it('saves the seconds still left, and loading that payload refuses the next Use', () => {
    const { world, player, interaction, aim, hold } = setup();
    world.put(0, 10, -2, 'pine_log');
    hold({ item: 'glass_beaker', count: 2 });
    const target = aim(0.5, 10.5, -1.5);
    expect(interaction.use(target)).toBe('worked');
    const saved = sapToolsFor(player)!.toJSON();
    expect(saved).toEqual({ v: 1, cells: [{ x: target!.x, y: target!.y, z: target!.z, waitS: TAP_COOLDOWN_S }] });
    expect(saved.cells[0].waitS).toBeCloseTo(120, 5);

    const next = setup();
    next.world.put(0, 10, -2, 'pine_log');
    next.hold({ item: 'glass_beaker', count: 1 });
    const again = next.aim(0.5, 10.5, -1.5);
    sapToolsFor(next.player)!.load(saved);
    expect(next.interaction.use(again)).toBe('refused');
    expect(next.count('pine_sap')).toBe(0);
    next.interaction.updateMining(TAP_COOLDOWN_S, false, null);
    expect(next.interaction.use(again)).toBe('worked');
  });

  it('a missing extra, a bad version, or a bad cell leaves every log ready', () => {
    const { player } = setup();
    const sap = sapToolsFor(player)!;
    const ready = { v: 1 as const, cells: [{ x: 1, y: 2, z: 3, waitS: 40 }] };
    const expectReady = (raw: unknown): void => {
      sap.load(ready);
      expect(sap.waitS(1, 2, 3)).toBe(40);
      expect(() => sap.load(raw)).not.toThrow();
      expect(sap.waitS(1, 2, 3)).toBe(0);
      expect(sap.toJSON()).toEqual({ v: 1, cells: [] });
    };
    expectReady(undefined);
    expectReady(null);
    expectReady({ v: 2, cells: [{ x: 1, y: 2, z: 3, waitS: 40 }] });
    expectReady({ v: 1, cells: [{ x: 'no', y: 2, z: 3, waitS: 40 }] });
    expectReady({ v: 1, cells: [{ x: 1, y: 2, z: 3, waitS: 40 }, { x: 'no', y: 0, z: 0, waitS: 10 }] });

    sap.load({
      v: 1,
      cells: [
        { x: 1, y: 2, z: 3, waitS: 0 },
        { x: 4, y: 5, z: 6, waitS: 500 },
        { x: 7, y: 8, z: 9, waitS: 15 },
      ],
    });
    expect(sap.waitS(1, 2, 3)).toBe(0);
    expect(sap.waitS(4, 5, 6)).toBe(0);
    expect(sap.waitS(7, 8, 9)).toBe(15);
    expect(sap.toJSON().cells).toEqual([{ x: 7, y: 8, z: 9, waitS: 15 }]);
  });
});

describe('sap taps survive the world snapshot', () => {
  const pine = (x: number, y: number, z: number): RayHit => ({
    x, y, z, face: Face.NZ, px: x, py: y, pz: z + 1, voxel: 0, block: block('pine_log'), distance: 1,
  });

  function play(world: World) {
    const bus = world.bus;
    const player = makePlayer(bus);
    const controller = new PlayerController({
      world, bus, player, view: new StubView(), input: new Script(), settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0,
    });
    return { player, controller, sap: sapToolsFor(player) as SapTools };
  }

  it('a tapped log comes back through World.toJSON / fromJSON, and a snapshot without extras.sap is ready', () => {
    const bus = createBus();
    const world = new World(3, bus);
    const { player, controller, sap } = play(world);
    player.give('glass_beaker', 1);
    const hit = pine(4, 11, -3);
    expect(sap.use(hit)).toBe('tapped');
    const snap = JSON.parse(JSON.stringify(world.toJSON()));
    expect(snap.extras.sap.cells).toEqual([{ x: 4, y: 11, z: -3, waitS: TAP_COOLDOWN_S }]);
    expect(snap.extras.sap.cells[0].waitS).toBeCloseTo(120, 5);
    controller.dispose();
    expect(world.toJSON().extras?.sap).toBeUndefined();

    const again = World.fromJSON(snap, createBus());
    const restored = play(again);
    restored.player.give('glass_beaker', 2);
    expect(restored.sap.use(hit)).toBe('refused');
    expect(restored.player.inventory.count('pine_sap')).toBe(0);

    const bare = { ...snap, extras: { ...snap.extras } };
    delete bare.extras.sap;
    const fresh = World.fromJSON(bare, createBus());
    const open = play(fresh);
    open.player.give('glass_vial', 1);
    expect(open.sap.waitS(4, 11, -3)).toBe(0);
    expect(open.sap.use(hit)).toBe('tapped');
    expect(open.player.inventory.count('pine_sap')).toBe(1);

    controller.dispose();
    restored.controller.dispose();
    open.controller.dispose();
    world.dispose();
    again.dispose();
    fresh.dispose();
  });
});
