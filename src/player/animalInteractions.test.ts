/** Edge cases of Use on animals and NPC talk that used to fail silently or lose items (interaction audit). */
import { describe, expect, it } from 'vitest';
import { DT as TICK } from '../core/constants';
import { DEFAULT_SETTINGS, createBus, createInputState } from '../core/context';
import { creature } from '../core/registry';
import { Pets } from '../game/pets';
import { fullDurability, makeStack } from '../game';
import { MobManager, mobPlayerOf } from '../mobs';
import { feedRefusal } from '../mobs/mob';
import type { Mob } from '../mobs/types';
import { PlayerController } from './controller';
import { Script, StubView, flatWorld, makePlayer } from './testKit';

const DT = 1 / 60;

function setup(species = 'goat') {
  const bus = createBus();
  const world = flatWorld(bus);
  const player = makePlayer(bus);
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const mobs = new MobManager(world, bus, { timeOfDay: 0.2, sunlight: () => 1 }, 1, { naturalSpawning: false, spawn: null });
  const spec = creature(species);
  const mob = mobs.add(spec, { x: 0.5, y: 10, z: -2, yaw: 0 });
  const input = new Script();
  const talks: number[] = [];
  const controller = new PlayerController({
    world, bus, player, view: new StubView(), input, settings: { ...DEFAULT_SETTINGS }, state: createInputState(), rng: () => 0, animals: mobs,
    talk: (_x, _y, _z, _dx, _dy, _dz, maxDist) => (talks.push(maxDist ?? Infinity), false),
  });
  const mp = mobPlayerOf(player);
  for (let t = 0; t < TICK; t += TICK) mobs.tick(TICK, mp);
  mob.x = 0.5;
  mob.z = -2;
  player.yaw = 0;
  player.pitch = Math.atan2(10 + spec.size.h * 0.5 - player.eyeY, -(mob.z - player.position.z));
  const hold = (key: string, count = 1): void => player.inventory.set(player.selectedSlot, makeStack(key, count, fullDurability(key)));
  const use = (): void => {
    input.next.use = true;
    controller.update(DT);
  };
  return { bus, world, player, mobs, mob, hold, use, toasts, talks };
}

describe('animal yields with a full pack', () => {
  it('shearing with no room drops the wool at the feet instead of losing it', () => {
    const t = setup();
    t.hold('shears');
    for (let i = 0; i < t.player.inventory.size; i++) if (i !== t.player.selectedSlot) t.player.inventory.set(i, makeStack('cobblestone', 64));
    t.use();
    expect(t.mob.woolS).toBeGreaterThan(0);
    expect(t.player.inventory.count('wool') + t.player.ground.count('wool')).toBe(2);
    expect(t.player.ground.count('wool')).toBe(2);
  });

  it('milking one of several pails with a full pack drops the milk instead of losing it', () => {
    const t = setup();
    t.hold('pail', 3);
    for (let i = 0; i < t.player.inventory.size; i++) if (i !== t.player.selectedSlot) t.player.inventory.set(i, makeStack('cobblestone', 64));
    t.use();
    expect(t.mob.milkS).toBeGreaterThan(0);
    expect(t.player.inventory.count('pail')).toBe(2);
    expect(t.player.inventory.count('milk_pail') + t.player.ground.count('milk_pail')).toBe(1);
  });
});

describe('feeding something that eats nothing', () => {
  it('says so instead of "Xs eat "', () => {
    const m = { state: 'idle', baby: false, cooldownS: 0, eagerS: 0, spec: { name: 'Automaton', likes: [] } } as unknown as Mob;
    expect(feedRefusal(m, 'wheat')).toBe('The automaton wants no food');
  });
});

describe('a stray pet', () => {
  it('is wary of an empty hand or a non-food item and says so; its own food still wins it over', () => {
    const t = setup('dog');
    const pets = new Pets({
      bus: t.bus, player: t.player, mobs: t.mobs as never, isDusk: () => true, standAt: () => 10, rng: () => 0.5,
    });
    expect(t.mob.tame).toBeFalsy();
    expect(pets.useOn(t.mob.id, null)).toBe('refused');
    expect(pets.useOn(t.mob.id, { item: 'dirt', count: 1 })).toBe('refused');
    expect(t.toasts.some((x) => /wary/.test(x))).toBe(true);
    expect(pets.useOn(t.mob.id, { item: creature('dog').likes[0], count: 1 })).toBeNull();
  });
});

describe('talking past things', () => {
  it('limits the talk ray to the nearer of a wall and an animal', () => {
    const t = setup('goat');
    t.use();
    // The goat is 2.5 m away on the ray: that is how far a person could be talked to.
    expect(t.talks.length).toBe(1);
    expect(t.talks[0]).toBeLessThan(3.5);
    expect(t.talks[0]).toBeGreaterThan(1.5);
  });

  it('limits it to a wall in front when there is no animal', () => {
    const t = setup('goat');
    t.mob.x = 40;
    t.world.fill(-1, 10, -2, 1, 12, -2, 'stone');
    t.player.pitch = 0;
    t.use();
    expect(t.talks[0]).toBeLessThan(2.6);
  });
});
