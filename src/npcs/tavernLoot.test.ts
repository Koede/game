import { describe, expect, it } from 'vitest';
import { hash32, mulberry32 } from '../core/math';
import { item, lootTableById, rarityOf, rollLoot } from '../core/registry';
import type { BlockEntity, IWorld, Slot, Voxel } from '../core/types';
import { TAVERN_CRATES, buildTavern, layoutBlocks } from './tavern';

/** A tiny world: a sparse voxel map and an entity map, everything loaded. */
function fakeWorld(seed: number): IWorld {
  const voxels = new Map<string, Voxel>();
  const ents = new Map<string, BlockEntity>();
  const k = (x: number, y: number, z: number): string => `${x},${y},${z}`;
  return {
    seed,
    isLoaded: () => true,
    getVoxel: (x: number, y: number, z: number) => voxels.get(k(x, y, z)) ?? 0,
    setVoxel: (x: number, y: number, z: number, v: Voxel) => (voxels.set(k(x, y, z), v), true),
    getEntity: (x: number, y: number, z: number) => ents.get(k(x, y, z)),
    setEntity: (e: BlockEntity) => void ents.set(k(e.x, e.y, e.z), e),
  } as unknown as IWorld;
}

describe('tavern loot crates', () => {
  const OX = 100;
  const OY = 40;
  const OZ = -20;
  const cell = (c: (typeof TAVERN_CRATES)[number]): [number, number, number] => [OX + c.at[0], OY + c.at[1], OZ + c.at[2]];

  it('sit in crate blocks of the layout (the sealed closet and the vault behind the false wall)', () => {
    const blocks = layoutBlocks();
    for (const c of TAVERN_CRATES) {
      const b = [...blocks].reverse().find((p) => p.x === c.at[0] && p.y === c.at[1] && p.z === c.at[2]);
      expect(b?.block, c.table).toBe('crate');
    }
    expect(TAVERN_CRATES.map((c) => c.table)).toEqual(['tavern_closet', 'tavern_vault']);
  });

  it('are placed when the tavern is built, hold items from their tables and roll the same per seed', () => {
    for (const seed of [1, 42, 777]) {
      const w = fakeWorld(seed);
      expect(buildTavern(w, OX, OY, OZ)).toBe(true);
      for (const c of TAVERN_CRATES) {
        const [x, y, z] = cell(c);
        const e = w.getEntity(x, y, z);
        expect(e?.kind, c.table).toBe('crate');
        const slots = ((e?.slots ?? []) as Slot[]).filter((s) => s !== null);
        const t = lootTableById(c.table);
        const allowed = new Set([...(t.guaranteed ?? []), ...t.entries].map((en) => en.item));
        for (const s of slots) expect(allowed.has(s!.item), `${c.table}: ${s!.item}`).toBe(true);
        for (const g of t.guaranteed ?? []) expect(slots.some((s) => s!.item === g.item), `${c.table} holds ${g.item}`).toBe(true);
        // The same world seed gives the same crate: it is the table rolled from the seed and the cell.
        expect(slots).toEqual(rollLoot(t, mulberry32(hash32(seed, x, y, z))));
      }
      const other = fakeWorld(seed + 1);
      buildTavern(other, OX, OY, OZ);
      const [vx, vy, vz] = cell(TAVERN_CRATES[1]);
      expect(other.getEntity(vx, vy, vz)?.slots).not.toEqual(w.getEntity(vx, vy, vz)?.slots);
    }
  });

  it('the closet holds a research scroll and a fine item; the vault Orrin\'s Spare Pick, a scroll, an essentia jar and a vial', () => {
    const closet = rollLoot(lootTableById('tavern_closet'), mulberry32(3)).map((s) => s.item);
    expect(closet).toContain('scroll_margin');
    expect(closet).toContain('bronze_axe');
    const vault = rollLoot(lootTableById('tavern_vault'), mulberry32(3));
    const keys = vault.map((s) => s.item);
    for (const key of ['orrins_spare_pick', 'scroll_ledger', 'essentia_jar', 'vial_cinder']) expect(keys).toContain(key);
    expect(vault.find((s) => s.item === 'orrins_spare_pick')!.durability).toBe(item('orrins_spare_pick').tool!.durability);
    expect(rarityOf('orrins_spare_pick')).toBe('legendary');
  });

  it('Orrin\'s Spare Pick is a bronze pickaxe with a little more life, from the Ember and Bronze ages only', () => {
    const p = item('orrins_spare_pick');
    const b = item('bronze_pickaxe');
    expect(p.tool).toMatchObject({ kind: 'pickaxe', tier: b.tool!.tier });
    expect(p.tool!.durability).toBeGreaterThan(b.tool!.durability);
    expect(p.tool!.durability).toBeLessThanOrEqual(b.tool!.durability * 1.5);
    expect(p.age).toBeLessThanOrEqual(1);
    expect(p.desc).toMatch(/Orrin/);
  });
});
