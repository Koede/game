import { describe, expect, it } from 'vitest';
import { DT as TICK } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { creature, recipe } from '../core/registry';
import { MobManager, mobPlayerOf } from '../mobs';
import { YIELD_COOLDOWN_S } from '../mobs/yields';
import { PlayerController } from './controller';
import { Script, StubView, flatWorld, makePlayer } from './testKit';

const DT = 1 / 60;

function setup(species = 'hen', baby = false) {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const mobs = new MobManager(world, bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
  const spec = creature(species);
  const mob = mobs.add(spec, { x: 0.5, y: 10, z: -2, yaw: 0 }, baby);
  const input = new Script();
  const controller = new PlayerController({
    world, bus, player, view: new StubView(), input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0, animals: mobs,
  });
  const tickMobs = (seconds: number): void => {
    const mp = mobPlayerOf(player);
    for (let t = 0; t < seconds - 1e-9; t += TICK) mobs.tick(TICK, mp);
  };
  tickMobs(TICK);
  mob.x = 0.5;
  mob.z = -2;
  player.yaw = 0;
  player.pitch = Math.atan2(10 + spec.size.h * 0.5 - player.eyeY, -(mob.z - player.position.z));
  const use = (): void => {
    input.next.use = true;
    controller.update(DT);
    input.next.use = false;
    controller.update(DT);
  };
  const eggs = (): number => player.inventory.count('egg');
  return { player, mob, use, toasts, tickMobs, eggs };
}

describe('hen eggs', () => {
  it('an empty hand takes an egg from a hen, then she needs five minutes', () => {
    const t = setup();
    t.player.inventory.clear();
    const before = t.eggs();
    t.use();
    expect(t.eggs()).toBe(before + 1);
    expect(t.mob.eggS).toBe(YIELD_COOLDOWN_S.egg);
    // The egg is now in hand: while she has none, Use does not gather (it would eat), and an empty hand is told why.
    t.use();
    expect(t.eggs()).toBe(before + 1);
    t.player.inventory.clear();
    t.use();
    expect(t.toasts.some((s) => /no egg yet/.test(s))).toBe(true);
    t.tickMobs(YIELD_COOLDOWN_S.egg + 1);
    t.mob.x = 0.5;
    t.mob.z = -2;
    t.use();
    expect(t.eggs()).toBe(1);
  });

  it('a goat gives no egg and a chick is too young', () => {
    const g = setup('goat');
    g.use();
    expect(g.eggs()).toBe(0);
    const c = setup('hen', true);
    c.use();
    expect(c.eggs()).toBe(0);
  });

  it('an egg fries at a furnace and enriches dough', () => {
    expect(recipe('fried_egg').inputs[0].item).toBe('egg');
    expect(recipe('dough_egg').output.count).toBe(3);
  });
});
