import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { Face, type Slot } from '../core/types';
import { Interaction } from './interaction';
import { PlayerPhysics } from './physics';
import { WRENCH_COOLDOWN_S, type TransportHands } from './pipeTools';
import { createRayHit, raycast, type RayHit } from './raycast';
import { flatWorld, makePlayer, record } from './testKit';

type WrenchCall = { x: number; y: number; z: number; dir: Face };
type BucketCall = { x: number; y: number; z: number; face: Face; held: string };

/** A transport that records calls and answers what the test says. */
class FakeTransport implements TransportHands {
  wrenches: WrenchCall[] = [];
  buckets: BucketCall[] = [];
  wrenchAnswer: { ok: true } | { ok: false; reason: string } = { ok: true };
  bucketAnswer: { ok: true; held: string } | { ok: false; reason: string; endpoint: boolean } = { ok: true, held: 'water_pail' };
  wrench(x: number, y: number, z: number, dir: Face) {
    this.wrenches.push({ x, y, z, dir });
    return this.wrenchAnswer;
  }
  bucketUse(x: number, y: number, z: number, face: Face, held: string) {
    this.buckets.push({ x, y, z, face, held });
    return this.bucketAnswer;
  }
}

/** The player at (0.5, 10, 0.5) on stone; a bronze chute at (0, 10, -2) joined to a crate at (0, 10, -3). */
function setup(withTransport = true) {
  const bus = createBus();
  const world = flatWorld(bus);
  world.put(0, 10, -2, 'item_pipe');
  world.put(0, 10, -3, 'crate');
  world.put(2, 10, -2, 'tank');
  world.put(-2, 10, -2, 'furnace_clay');
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const transport = new FakeTransport();
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0, withTransport ? transport : null);
  const out = createRayHit();
  /** Points the player's view at a world point and casts like the controller. */
  const aim = (x: number, y: number, z: number, liquids = false): RayHit | null => {
    const dx = x - player.position.x;
    const dy = y - player.eyeY;
    const dz = z - player.position.z;
    player.yaw = Math.atan2(-dx, -dz);
    player.pitch = Math.atan2(dy, Math.hypot(dx, dz));
    return raycast(world, player.position.x, player.eyeY, player.position.z, dx, dy, dz, REACH, liquids, out);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  const events = record(bus, 'ui:open', 'toast', 'block:placed');
  return { bus, world, player, interaction, transport, aim, hold, events };
}

describe('the wrench on a pipe', () => {
  it('turns the end aimed at (the arm towards the crate)', () => {
    const { interaction, transport, aim, hold, events, player } = setup();
    hold({ item: 'wrench', count: 1 });
    // From the east, level with the arm (from the south the core hides it).
    player.position.x = 3.5;
    player.position.z = -1.9;
    expect(interaction.use(aim(0.5, 10.5, -1.9))).toBe('wrenched');
    expect(transport.wrenches).toEqual([{ x: 0, y: 10, z: -2, dir: Face.NZ }]);
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
  });

  it('on the core it works on the side turned to the player', () => {
    const { interaction, transport, aim, hold } = setup();
    hold({ item: 'wrench', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('wrenched');
    expect(transport.wrenches[0].dir).toBe(Face.PZ);
  });

  it('toasts the refusal and does not turn again before the cooldown', () => {
    const { interaction, transport, aim, hold, events } = setup();
    hold({ item: 'wrench', count: 1 });
    transport.wrenchAnswer = { ok: false, reason: 'No pipe to join on that side' };
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('refused');
    expect(events.filter((e) => e.type === 'toast').map((e) => (e.e as { text: string }).text)).toEqual(['No pipe to join on that side']);
    expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('refused');
    expect(transport.wrenches).toHaveLength(1);
    interaction.updateMining(WRENCH_COOLDOWN_S + 0.01, false, null);
    interaction.use(aim(0.5, 10.5, -1.5));
    expect(transport.wrenches).toHaveLength(2);
  });

  it('elsewhere it is an ordinary item: the furnace screen still opens', () => {
    const { interaction, transport, aim, hold, events } = setup();
    hold({ item: 'wrench', count: 1 });
    expect(interaction.use(aim(-1.5, 10.5, -1.5))).toBe('screen');
    expect(events.find((e) => e.type === 'ui:open')!.e).toEqual({ screen: { type: 'furnace', x: -2, y: 10, z: -2 } });
    expect(transport.wrenches).toHaveLength(0);
  });
});

describe('Use on a pipe opens the pipe screen', () => {
  it('with an empty hand, food or a hoe', () => {
    for (const held of [null, { item: 'bread', count: 2 }, { item: 'flint_hoe', count: 1, durability: 64 }]) {
      const { interaction, aim, hold, events, player } = setup();
      hold(held);
      expect(interaction.use(aim(0.5, 10.5, -1.5))).toBe('screen');
      expect(events.find((e) => e.type === 'ui:open')!.e).toEqual({ screen: { type: 'pipe', x: 0, y: 10, z: -2 } });
      if (held) expect(player.inventory.count(held.item)).toBe(held.count);
    }
  });

  it('but a placeable block is placed against it (pipes are laid by placing)', () => {
    const { interaction, world, aim, hold, events } = setup();
    hold({ item: 'item_pipe', count: 4 });
    expect(interaction.use(aim(0.5, 10.9, -1.5))).toBe('placed');
    expect(world.getBlock(0, 11, -2).key).toBe('item_pipe');
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
  });
});

describe('buckets on tanks and fluid endpoints', () => {
  it('go through the transport before the machine screen and swap the held bucket', () => {
    const { interaction, transport, aim, hold, events, player } = setup();
    hold({ item: 'pail', count: 1 });
    expect(interaction.use(aim(2.5, 10.5, -1.5))).toBe('pail');
    expect(transport.buckets).toEqual([{ x: 2, y: 10, z: -2, face: Face.PZ, held: 'pail' }]);
    expect(player.heldStack()).toEqual({ item: 'water_pail', count: 1 });
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
  });

  it('a refusal is toasted and the machine screen opens instead (it shows what the machine holds)', () => {
    const { interaction, transport, aim, hold, events, player } = setup();
    hold({ item: 'pail', count: 1 });
    transport.bucketAnswer = { ok: false, reason: 'The Tank holds nothing to scoop', endpoint: true };
    expect(interaction.use(aim(2.5, 10.5, -1.5))).toBe('screen');
    expect(player.heldStack()).toEqual({ item: 'pail', count: 1 });
    expect(events.map((e) => e.type)).toEqual(['toast', 'ui:open']);
    expect(events[1].e).toEqual({ screen: { type: 'machine', x: 2, y: 10, z: -2 } });
  });

  it('blocks that take no fluid are not asked, and without a transport a tank just opens its screen', () => {
    const { interaction, transport, aim, hold, events } = setup();
    hold({ item: 'lava_bucket', count: 1 });
    expect(interaction.use(aim(-1.5, 10.5, -1.5))).toBe('screen');
    expect(transport.buckets).toHaveLength(0);
    const bare = setup(false);
    bare.hold({ item: 'pail', count: 1 });
    expect(bare.interaction.use(bare.aim(2.5, 10.5, -1.5))).toBe('screen');
    expect(bare.events.find((e) => e.type === 'ui:open')!.e).toEqual({ screen: { type: 'machine', x: 2, y: 10, z: -2 } });
    expect(events.find((e) => e.type === 'ui:open')!.e).toEqual({ screen: { type: 'furnace', x: -2, y: 10, z: -2 } });
  });

  it('a bucket on a pipe acts as on any block (the water bucket pours beside it)', () => {
    const { interaction, transport, world, aim, hold } = setup();
    hold({ item: 'water_pail', count: 1 });
    expect(interaction.use(aim(0.5, 10.9, -1.5))).toBe('pail');
    expect(world.getBlock(0, 11, -2).key).toBe('water');
    expect(transport.buckets).toHaveLength(0);
  });
});
