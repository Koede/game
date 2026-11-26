import { describe, expect, it } from 'vitest';
import { DT } from '../core/constants';
import { createBus } from '../core/context';
import { lootTableById } from '../core/registry';
import { enchantLevel } from '../core/enchant';
import { CHUNK_SIZE, type BlockEntity } from '../core/types';
import { rollLoot } from '../core/registry';
import { mulberry32 } from '../core/math';
import { caveLairSite, chunkHasLair, lairKey } from '../world/caveLair';
import { MobManager } from './manager';
import { FlatWorld, TestClock, testPlayer } from './testKit';

class CrateWorld extends FlatWorld {
  readonly ents = new Map<string, BlockEntity>();
  override getEntity(x: number, y: number, z: number): BlockEntity | undefined {
    return this.ents.get(`${x},${y},${z}`);
  }
  override setEntity(e: BlockEntity): void {
    this.ents.set(`${e.x},${e.y},${e.z}`, e);
  }
}

const SEED = 1234;
/** A flat cave: the flat world's ground with a stone roof six blocks up over a wide area (a cave room has a roof). */
const roof = (w: FlatWorld, cx: number, cz: number): void => w.fill((cx - 4) * CHUNK_SIZE, 16, (cz - 4) * CHUNK_SIZE, (cx + 5) * CHUNK_SIZE, 17, (cz + 5) * CHUNK_SIZE, 'stone');
const lairChunk = (): [number, number] => {
  for (let cx = 0; cx < 200; cx++) if (chunkHasLair(SEED, cx, 0)) return [cx, 0];
  throw new Error('no lair chunk');
};

describe('the cave boss lair', () => {
  it('is the same place every time for the same seed, and only in lair chunks', () => {
    const [cx, cz] = lairChunk();
    const w = new CrateWorld(10, SEED);
    roof(w, cx, cz);
    const w2 = new CrateWorld(10, SEED);
    roof(w2, cx, cz);
    expect(caveLairSite(w, SEED, cx, cz)).toEqual(caveLairSite(w2, SEED, cx, cz));
    expect(caveLairSite(w, SEED, cx, cz)).not.toBeNull();
    let other = 0;
    while (chunkHasLair(SEED, other, 3)) other++;
    expect(caveLairSite(w, SEED, other, 3)).toBeNull();
  });

  it('needs a roof: an open clearing is no lair', () => {
    const [cx, cz] = lairChunk();
    expect(caveLairSite(new CrateWorld(10, SEED), SEED, cx, cz)).toBeNull();
  });

  it('needs open room: solid rock all through the chunk has no lair', () => {
    const [cx, cz] = lairChunk();
    const w = new CrateWorld(60, SEED);
    expect(caveLairSite(w, SEED, cx, cz)).toBeNull();
  });

  it('puts one Slag Colossus in it, keeps it across a save, and a player kill leaves the hoard chest once', () => {
    const [cx, cz] = lairChunk();
    const world = new CrateWorld(10, SEED, createBus());
    roof(world, cx, cz);
    const bus = (world as unknown as { bus: ReturnType<typeof createBus> }).bus;
    const mobs = new MobManager(world, bus, new TestClock(0.9, 0.6), SEED, { naturalSpawning: false, spawn: null });
    const mine = lairKey(cx, cz);
    const player = testPlayer(cx * CHUNK_SIZE + 8, 11, cz * CHUNK_SIZE + 40);
    for (let i = 0; i < 25; i++) mobs.tick(DT, player);
    const bosses = mobs.hostiles.all.filter((m) => m.hostile!.ruin === mine);
    expect(bosses).toHaveLength(1);
    expect(bosses[0].spec.key).toBe('slag_colossus');

    const again = new MobManager(world, bus, new TestClock(0.9, 0.6), SEED, { naturalSpawning: false, spawn: null });
    again.load(JSON.parse(JSON.stringify(mobs.toJSON())));
    for (let i = 0; i < 25; i++) again.tick(DT, player);
    expect(again.hostiles.all.filter((m) => m.hostile!.ruin === mine)).toHaveLength(1);

    const boss = again.hostiles.all.find((m) => m.hostile!.ruin === mine)!;
    for (let i = 0; i < 80 && again.get(boss.id)?.state !== 'dying'; i++) {
      boss.hitCooldownS = 0;
      again.hit(boss.id, 20, boss.x, boss.z + 1);
    }
    for (let i = 0; i < 80; i++) again.tick(DT, player);
    expect(world.ents.size).toBe(1);
    const crate = [...world.ents.values()][0];
    expect(crate.kind).toBe('crate');
    for (let i = 0; i < 80; i++) again.tick(DT, player);
    expect(world.ents.size).toBe(1);
  });
});

describe('the cave boss hoard', () => {
  it('always holds a masterwork pick with Veinseeker and Magnet, and a fine enchanted axe', () => {
    for (const seed of [1, 2, 3]) {
      const loot = rollLoot(lootTableById('cave_boss'), mulberry32(seed));
      const pick = loot.find((s) => s.item === 'iron_pickaxe')!;
      expect(pick.quality).toBe(2);
      expect(enchantLevel(pick, 'veinseeker')).toBe(2);
      expect(enchantLevel(pick, 'magnet')).toBe(1);
      expect(pick.durability).toBeGreaterThan(0);
      const axe = loot.find((s) => s.item === 'bronze_axe')!;
      expect(axe.quality).toBe(1);
      expect(enchantLevel(axe, 'bounty')).toBe(1);
    }
  });
});
