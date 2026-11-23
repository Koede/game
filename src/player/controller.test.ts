import { describe, expect, it } from 'vitest';
import { PLAYER_EYE } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { PlayerController, SPRINT_FOV_KICK } from './controller';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';

const DT = 1 / 60;

function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const view = new StubView();
  const input = new Script();
  const state = createInputState();
  const settings = { ...DEFAULT_SETTINGS };
  const controller = new PlayerController({ world, bus, player, view, input, settings, state, rng: () => 0 });
  const run = (seconds: number): void => {
    for (let t = 0; t < seconds - 1e-9; t += DT) controller.update(DT);
  };
  return { bus, world, player, view, input, state, settings, controller, run };
}

describe('photo mode and emotes', () => {
  it('photo mode detaches the eye: the body stays, the camera flies, Use snaps, P leaves', () => {
    const { bus, player, view, input, controller } = setup();
    const events: string[] = [];
    bus.on('photo:mode', (e) => events.push(e.on ? 'on' : 'off'));
    bus.on('photo:snap', () => events.push('snap'));
    controller.update(DT);
    const z0 = player.position.z;
    input.next.photo = true;
    controller.update(DT);
    input.next.photo = false;
    input.next.moveZ = 1;
    for (let i = 0; i < 30; i++) controller.update(DT);
    expect(controller.photo.active).toBe(true);
    expect(player.position.z).toBe(z0);
    expect(view.view.z).not.toBeCloseTo(z0, 1);
    input.next.use = true;
    controller.update(DT);
    input.next.use = false;
    input.next.photo = true;
    controller.update(DT);
    expect(controller.photo.active).toBe(false);
    expect(events).toEqual(['on', 'snap', 'off']);
  });

  it('the emote key plays an emote and announces it', () => {
    const { bus, input, controller } = setup();
    const kinds: string[] = [];
    bus.on('emote', (e) => kinds.push(e.kind));
    input.next.emote = true;
    controller.update(DT);
    input.next.emote = false;
    expect(controller.emotes.kind).toBe('wave');
    expect(kinds).toEqual(['wave']);
  });
});

describe('PlayerController', () => {
  it('places the camera at the eye and turns with the look deltas (positive yaw delta = right)', () => {
    const { player, view, input, controller } = setup();
    controller.update(DT);
    expect(view.view.y).toBeCloseTo(10 + PLAYER_EYE, 6);
    input.next.lookYaw = 0.3;
    input.next.lookPitch = 0.2;
    controller.update(DT);
    expect(player.yaw).toBeCloseTo(-0.3, 9);
    expect(player.pitch).toBeCloseTo(0.2, 9);
    expect(view.view.yaw).toBeCloseTo(-0.3, 9);
    input.next.lookPitch = 5;
    controller.update(DT);
    expect(player.pitch).toBeLessThan(Math.PI / 2);
    expect(player.pitch).toBeGreaterThan(1.5);
  });

  it('walks with the intent, bobs the view while walking and settles when stopped', () => {
    const { player, view, input, run } = setup();
    input.next.moveZ = 1;
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 60; i++) {
      run(DT);
      minY = Math.min(minY, view.view.y);
      maxY = Math.max(maxY, view.view.y);
    }
    expect(player.position.z).toBeLessThan(-2);
    expect(maxY - minY).toBeGreaterThan(0.02);
    expect(maxY - minY).toBeLessThan(0.1);
    input.next.moveZ = 0;
    run(1.5);
    expect(view.view.y).toBeCloseTo(10 + PLAYER_EYE, 3);
  });

  it('kicks the FOV while sprinting and eases back', () => {
    const { view, input, settings, run } = setup();
    run(DT);
    expect(view.fov).toBe(settings.fov);
    input.next.moveZ = 1;
    input.next.sprint = true;
    run(1.5);
    expect(view.fov).toBeCloseTo(settings.fov + SPRINT_FOV_KICK, 1);
    input.next.sprint = false;
    input.next.moveZ = 0;
    run(1.5);
    expect(view.fov).toBeCloseTo(settings.fov, 1);
    const calls = view.fovCalls;
    run(0.5);
    expect(view.fovCalls).toBe(calls); // no calls once it has settled
  });

  it('selects hotbar slots by number and wheel, wrapping around', () => {
    const { player, input, run } = setup();
    input.next.hotbarSlot = 4;
    run(DT);
    expect(player.selectedSlot).toBe(4);
    input.next.hotbarSlot = 0;
    run(DT);
    input.next.hotbarStep = -1;
    run(DT);
    expect(player.selectedSlot).toBe(8);
    input.next.hotbarStep = 1;
    run(DT);
    expect(player.selectedSlot).toBe(0);
  });

  it('menu keys ask the UI for screens', () => {
    const { bus, input, run } = setup();
    const opens = record(bus, 'ui:open');
    input.next.inventory = true;
    run(DT);
    input.next.log = true;
    run(DT);
    input.next.pause = true;
    run(DT);
    expect(opens.map((o) => o.e.screen.type)).toEqual(['inventory', 'log', 'pause']);
  });

  it('targets the block under the crosshair and reports mining progress to the view', () => {
    const { world, player, view, input, run } = setup();
    world.put(0, 10, -1, 'dirt');
    player.pitch = -0.7;
    run(DT);
    expect(view.target).toEqual({ x: 0, y: 10, z: -1 });
    expect(view.mining).toBe(-1);
    input.next.mine = true;
    run(0.4);
    expect(view.mining).toBeGreaterThan(0.3);
    expect(view.mining).toBeLessThan(0.7);
    run(0.6);
    expect(world.getBlock(0, 10, -1).key).toBe('air');
    player.ground.drain(player);
    expect(player.inventory.count('dirt')).toBe(1);
    expect(view.swings).toBeGreaterThan(1);
    expect(view.target).toEqual({ x: 0, y: 9, z: -2 }); // the floor behind is targeted at once
  });

  it('use places the held block and the held item follows the hotbar', () => {
    const { world, player, view, input, run } = setup();
    player.inventory.set(0, { item: 'plank', count: 2 });
    player.inventory.set(1, { item: 'stick', count: 2 });
    player.pitch = -0.6;
    run(DT);
    expect(view.held).toEqual(['plank']);
    input.next.use = true;
    run(DT);
    expect(world.getBlock(0, 10, -2).key === 'plank' || world.getBlock(0, 10, -1).key === 'plank').toBe(true);
    input.next.hotbarSlot = 1;
    run(DT);
    input.next.hotbarSlot = 2;
    run(DT);
    expect(view.held).toEqual(['plank', 'stick', null]);
  });

  it('releases the pointer when a screen opens and captures it again when it closes', () => {
    const { bus, state, input, run } = setup();
    state.pointerLocked = true;
    run(DT);
    bus.emit('ui:opened', { screen: { type: 'inventory' } });
    expect(input.releases).toBe(1);
    state.pointerLocked = false;
    bus.emit('ui:closed', {});
    expect(input.captures).toBe(1);
  });

  it('does not grab the pointer on touch devices or before it was ever captured', () => {
    const { bus, state, input, run } = setup();
    run(DT);
    bus.emit('ui:closed', {});
    expect(input.captures).toBe(0);
    state.pointerLocked = true;
    state.touch = true;
    run(DT);
    bus.emit('ui:closed', {});
    expect(input.captures).toBe(0);
  });

  it('a dead player does not move or act', () => {
    const { player, input, run } = setup();
    player.damage(100, 'fall');
    input.next.moveZ = 1;
    input.next.mine = true;
    run(0.5);
    expect(player.position.z).toBeCloseTo(0.5, 9);
  });

  it('respawning forgets the fall in progress', () => {
    const { bus, player, controller, run } = setup();
    controller.teleport(0.5, 40, 0.5);
    player.onGround = false;
    run(0.3);
    player.respawn(true, { x: 0.5, y: 10, z: 0.5 });
    expect(bus).toBeDefined();
    run(0.5);
    expect(player.health).toBe(20);
  });

  it('Reduce motion: no sprint FOV kick, no view bob, no landing dip', () => {
    const { view, input, settings, run } = setup();
    settings.reduceMotion = true;
    input.next.moveZ = 1;
    input.next.sprint = true;
    run(1.5);
    expect(view.fov).toBeCloseTo(settings.fov, 1);
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 0; i < 40; i++) {
      run(DT);
      minY = Math.min(minY, view.view.y);
      maxY = Math.max(maxY, view.view.y);
    }
    expect(maxY - minY).toBeLessThan(1e-6);
  });

  it('dips the eye on a hard landing and recovers', () => {
    const { player, view, controller, run } = setup();
    controller.teleport(0.5, 16, 0.5);
    let lowest = Infinity;
    for (let i = 0; i < 90; i++) {
      controller.update(DT);
      if (player.onGround) lowest = Math.min(lowest, view.view.y);
    }
    expect(lowest).toBeLessThan(10 + PLAYER_EYE - 0.05);
    run(1);
    expect(view.view.y).toBeCloseTo(10 + PLAYER_EYE, 3);
  });
});
