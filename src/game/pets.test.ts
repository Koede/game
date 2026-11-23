import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import { AUTOMATONS, creature } from '../core/registry';
import { MobManager } from '../mobs/manager';
import { FlatWorld, TestClock, testPlayer } from '../mobs/testKit';
import { PACK_SLOTS, Pets, STRAY_EVERY_S, WARN_EVERY_S } from './pets';
import { PlayerState } from './playerState';

function rig(dusk = true, rng = () => 0) {
  const bus = createBus();
  const world = new FlatWorld(10, 7, bus);
  const mobs = new MobManager(world, bus, new TestClock(), 5, { naturalSpawning: false, biomeAt: () => 'woodland', spawn: null });
  const player = new PlayerState(bus, { x: 0.5, y: 11, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  const pets = new Pets({ bus, player, mobs, isDusk: () => dusk, standAt: () => 11, rng });
  mobs.petUse = (id, held) => pets.useOn(id, held);
  const mp = (): ReturnType<typeof testPlayer> => testPlayer(player.position.x, 11, player.position.z);
  const run = (s: number): void => { for (let i = Math.round(s / DT); i > 0; i--) { mobs.tick(DT, mp()); pets.tick(DT); } };
  return { bus, world, mobs, player, pets, toasts, run };
}
const add = (r: ReturnType<typeof rig>, key: string, x: number, z: number) => r.mobs.add(creature(key), { x, y: 11, z, yaw: 0 });

describe('pet content', () => {
  it('has a dog and a cat that never spawn from biome rolls and like real items', () => {
    for (const k of ['dog', 'cat']) {
      const c = creature(k);
      expect(c.pet).toBe(true);
      expect(c.biomes).toEqual([]);
      expect(c.likes.length).toBeGreaterThan(0);
    }
  });
});

describe('taming and following', () => {
  it('the first gift tames it without breeding, and a tame pet follows the player', () => {
    const r = rig();
    const dog = add(r, 'dog', 6.5, 0.5);
    expect(r.mobs.feed(dog.id, 'raw_chop')).toEqual({ ok: true });
    expect(dog.tame).toBe(true);
    expect(dog.eagerS).toBe(0);
    expect(r.toasts.at(-1)).toMatch(/trusts you/);
    r.player.position.x = 20.5;
    r.run(15);
    expect(Math.hypot(dog.x - 20.5, dog.z - 0.5)).toBeLessThan(5);
  });

  it('an untamed stray does not follow', () => {
    const r = rig();
    const dog = add(r, 'dog', 6.5, 0.5);
    r.player.position.x = 40.5;
    r.run(10);
    expect(Math.hypot(dog.x - 40.5, dog.z - 0.5)).toBeGreaterThan(15);
  });
});

describe('carrying and warning', () => {
  it('takes stacks into a small pack and gives them back to an empty hand', () => {
    const r = rig();
    const dog = add(r, 'dog', 1.5, 0.5);
    r.mobs.feed(dog.id, 'raw_chop');
    r.player.inventory.set(r.player.selectedSlot, { item: 'stick', count: 5 });
    expect(r.pets.useOn(dog.id, r.player.heldStack())).toBe('worked');
    expect(r.player.inventory.count('stick')).toBe(0);
    expect(r.pets.packOf(dog.id)[0]).toEqual({ item: 'stick', count: 5 });
    // its food is not a deposit
    expect(r.pets.useOn(dog.id, { item: 'raw_chop', count: 1 })).toBeNull();
    // a save keeps the pack
    const saved = JSON.parse(JSON.stringify(r.pets.toJSON()));
    r.pets.load(saved);
    expect(r.pets.packOf(dog.id)[0]?.count).toBe(5);
    expect(r.pets.useOn(dog.id, null)).toBe('worked');
    expect(r.player.inventory.count('stick')).toBe(5);
  });

  it('is full after PACK_SLOTS kinds of item', () => {
    const r = rig();
    const dog = add(r, 'dog', 1.5, 0.5);
    r.mobs.feed(dog.id, 'raw_chop');
    for (let i = 0; i < PACK_SLOTS; i++) {
      r.player.inventory.set(r.player.selectedSlot, { item: ['stick', 'flint', 'fiber', 'coal'][i], count: 1 });
      expect(r.pets.useOn(dog.id, r.player.heldStack())).toBe('worked');
    }
    r.player.inventory.set(r.player.selectedSlot, { item: 'clay', count: 1 });
    expect(r.pets.useOn(dog.id, r.player.heldStack())).toBe('refused');
  });

  it('growls once when a hostile comes near, then waits', () => {
    const r = rig();
    const dog = add(r, 'dog', 1.5, 0.5);
    r.mobs.feed(dog.id, 'raw_chop');
    r.mobs.add(AUTOMATONS.find((a) => a.key === 'cinder_mite')!, { x: 10.5, y: 11, z: 0.5, yaw: 0 });
    r.run(1);
    const growls = (): number => r.toasts.filter((t) => /growls/.test(t)).length;
    expect(growls()).toBe(1);
    r.run(WARN_EVERY_S / 2);
    expect(growls()).toBe(1);
  });
});

describe('strays', () => {
  it('wander in at dusk to a pet-less player, not by day, and never a third', () => {
    const day = rig(false);
    day.run(STRAY_EVERY_S + 1);
    expect(day.mobs.all.filter((m) => m.spec.pet)).toHaveLength(0);
    const dusk = rig(true);
    dusk.run(STRAY_EVERY_S + 1);
    expect(dusk.mobs.all.filter((m) => m.spec.pet)).toHaveLength(1);
    expect(dusk.toasts.at(-1)).toMatch(/stray/);
  });
});
