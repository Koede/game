/** Placing against blocks that have screens (spec 3.6), and Use looking past a thin block in front of a screen. */
import { describe, expect, it } from 'vitest';
import { REACH } from '../core/constants';
import { createBus } from '../core/context';
import { block } from '../core/registry';
import { Facing, makeVoxel, type Slot } from '../core/types';
import { Interaction } from './interaction';
import { PlayerController } from './controller';
import { PlayerPhysics } from './physics';
import { createRayHit, raycast, screenBehindThin, type RayHit } from './raycast';
import { Script, StubView, flatWorld, makePlayer, record } from './testKit';
import { DEFAULT_SETTINGS, createInputState } from '../core/context';

/** The player at (0.5, 10, 0.5) on stone. A clay furnace at (0, 10, -2) faces the player (front = +Z face). */
function setup() {
  const bus = createBus();
  const world = flatWorld(bus);
  world.setVoxel(0, 10, -2, makeVoxel(block('furnace_clay').id, Facing.South), 'load');
  const player = makePlayer(bus);
  const physics = new PlayerPhysics(world, player);
  const interaction = new Interaction(world, bus, player, physics, { triggerSwing: () => undefined }, () => 0);
  const out = createRayHit();
  const aim = (x: number, y: number, z: number): RayHit | null => {
    const ex = player.position.x;
    const ey = player.eyeY;
    const ez = player.position.z;
    return raycast(world, ex, ey, ez, x - ex, y - ey, z - ez, REACH, false, out);
  };
  const hold = (slot: Slot): void => player.inventory.set(player.selectedSlot, slot);
  const events = record(bus, 'ui:open', 'toast', 'block:placed');
  return { bus, world, player, interaction, aim, hold, events };
}

describe('building against blocks that have screens', () => {
  it('a steam engine aimed at the top of a furnace is placed on it; the hint says how to open the furnace', () => {
    const { world, player, interaction, aim, hold, events } = setup();
    hold({ item: 'steam_engine', count: 1 });
    expect(interaction.use(aim(0.5, 11, -1.6))).toBe('placed');
    expect(world.getBlock(0, 11, -2).key).toBe('steam_engine');
    expect(player.inventory.count('steam_engine')).toBe(0);
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
    expect((events.find((e) => e.type === 'toast')!.e as { text: string }).text).toMatch(/Clay Furnace.*front.*empty hand/);
  });

  it('the furnace front still opens it, whatever is held', () => {
    const { interaction, aim, hold, events } = setup();
    hold({ item: 'thermopile', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1))).toBe('screen');
    expect(events.find((e) => e.type === 'ui:open')!.e).toEqual({ screen: { type: 'furnace', x: 0, y: 10, z: -2 } });
  });

  it('hearth bricks and cables go on the side of a furnace', () => {
    for (const item of ['brick', 'copper_cable']) {
      const { world, player, interaction, aim, hold } = setup();
      player.position.x = 2.5;
      player.position.z = -1.5;
      hold({ item, count: 4 });
      expect(interaction.use(aim(1, 10.5, -1.5))).toBe('placed');
      expect(world.getBlock(1, 10, -2).key).toBe(item);
    }
  });

  it('a tank stacks on a tank (no front: any face places)', () => {
    const { world, interaction, aim, hold, events } = setup();
    world.put(0, 10, -2, 'tank');
    hold({ item: 'tank', count: 2 });
    expect(interaction.use(aim(0.5, 11, -1.6))).toBe('placed');
    expect(world.getBlock(0, 11, -2).key).toBe('tank');
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
  });

  it('ordinary blocks, items and an empty hand still open the screen from any face', () => {
    for (const held of [{ item: 'plank', count: 3 }, { item: 'coal', count: 1 }, null]) {
      const { interaction, aim, hold } = setup();
      hold(held);
      expect(interaction.use(aim(0.5, 11, -1.6))).toBe('screen');
    }
  });

  it('a forced place (Shift / the Place toggle) places any block, even on the front', () => {
    const { world, interaction, aim, hold, events } = setup();
    hold({ item: 'plank', count: 3 });
    expect(interaction.use(aim(0.5, 10.5, -1), true)).toBe('placed');
    expect(world.getBlock(0, 10, -1).key).toBe('plank');
    expect(events.some((e) => e.type === 'ui:open')).toBe(false);
  });

  it('a forced Use with nothing placeable held acts as a normal Use', () => {
    const { interaction, aim, hold } = setup();
    hold({ item: 'coal', count: 1 });
    expect(interaction.use(aim(0.5, 10.5, -1), true)).toBe('screen');
  });
});

describe('Use past a thin block', () => {
  /** A copper cable in the furnace mouth at (0, 10, -1); the player stands at (0.3, 10, 1.5) looking at the mouth. */
  function mouth() {
    const kit = setup();
    kit.world.put(0, 10, -1, 'copper_cable');
    kit.player.position.z = 1.5;
    return kit;
  }

  it('the ray beside the cable core reaches the furnace behind it', () => {
    const { world, player } = mouth();
    const eye = { x: player.position.x, y: player.eyeY, z: player.position.z };
    const hit = createRayHit();
    const behind = createRayHit();
    // Aimed at the lower-left of the mouth: crosses the cable cell outside its 6/16 core.
    const d = { x: 0.15 - eye.x, y: 10.15 - eye.y, z: -1 - eye.z };
    const first = raycast(world, eye.x, eye.y, eye.z, d.x, d.y, d.z, REACH, false, hit)!;
    expect(first.block.key).toBe('copper_cable');
    const next = screenBehindThin(world, eye.x, eye.y, eye.z, d.x, d.y, d.z, REACH, false, first, behind);
    expect(next).toMatchObject({ x: 0, y: 10, z: -2 });
    expect(next!.block.key).toBe('furnace_clay');
    // Through the core with a block held: the cable stays the target (blocks can be placed against it).
    const c = { x: 0.5 - eye.x, y: 10.5 - eye.y, z: -0.5 - eye.z };
    const core = raycast(world, eye.x, eye.y, eye.z, c.x, c.y, c.z, REACH, false, hit)!;
    expect(core.block.key).toBe('copper_cable');
    expect(screenBehindThin(world, eye.x, eye.y, eye.z, c.x, c.y, c.z, REACH, false, core, behind)).toBeNull();
    // ...but with nothing placeable held, the cable means nothing to Use and the furnace is meant.
    expect(screenBehindThin(world, eye.x, eye.y, eye.z, c.x, c.y, c.z, REACH, false, core, behind, true)?.block.key).toBe('furnace_clay');
  });

  it('only a screen block behind is taken; a stone wall behind leaves the cable the target', () => {
    const { world, player } = mouth();
    world.put(0, 10, -2, 'stone');
    const eye = { x: player.position.x, y: player.eyeY, z: player.position.z };
    const hit = createRayHit();
    const d = { x: 0.15 - eye.x, y: 10.15 - eye.y, z: -1 - eye.z };
    const first = raycast(world, eye.x, eye.y, eye.z, d.x, d.y, d.z, REACH, false, hit)!;
    expect(screenBehindThin(world, eye.x, eye.y, eye.z, d.x, d.y, d.z, REACH, false, first, createRayHit(), true)).toBeNull();
  });

  it('the controller opens the furnace when Use is tapped at the cable with an empty hand', () => {
    const { bus, world, player } = mouth();
    const input = new Script();
    const controller = new PlayerController({ world, bus, player, view: new StubView(), input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0 });
    const opens = record(bus, 'ui:open');
    player.yaw = 0;
    player.pitch = Math.atan2(10.5 - player.eyeY, 2);
    controller.update(1 / 60);
    expect(controller.target?.block.key).toBe('copper_cable');
    input.next.use = true;
    controller.update(1 / 60);
    expect(opens.map((e) => e.e.screen)).toEqual([{ type: 'furnace', x: 0, y: 10, z: -2 }]);
  });
});
