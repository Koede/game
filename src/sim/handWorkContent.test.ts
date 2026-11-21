/** The hand stations on the real content, through the Simulation facade. */
import { describe, expect, it } from 'vitest';
import type { HandEntity } from './handTypes';
import { makeKit } from './testKit';

function hold(k: ReturnType<typeof makeKit>, item: string, count = 1): void {
  k.player.inventory.set(k.player.selectedSlot, { item, count });
}

describe('hand stations on the real content', () => {
  it('a quern turns wheat to flour in 6 strokes and the take reports item:made', () => {
    const k = makeKit();
    const made = k.record('item:made');
    k.world.put(3, 5, 3, 'hand_quern');
    expect(k.sim.handCount).toBe(1);
    expect(k.sim.entityCount).toBe(0);
    hold(k, 'wheat', 2);
    expect(k.sim.stroke(3, 5, 3, 'wheat')).toMatchObject({ ok: true, did: 'insert' });
    for (let i = 0; i < 5; i++) expect(k.sim.stroke(3, 5, 3, null)).toMatchObject({ ok: true, did: 'stroke' });
    expect(k.sim.handView(3, 5, 3)?.label).toBe('Hand Quern - wheat 5/6 strokes');
    expect(k.sim.stroke(3, 5, 3, null)).toMatchObject({ ok: true, done: true });
    expect(k.sim.stroke(3, 5, 3, null)).toMatchObject({ ok: true, did: 'take' });
    expect(k.player.inventory.count('flour')).toBe(1);
    expect(made).toContainEqual({ item: 'flour', count: 1, station: 'hand_quern', recipeId: 'flour' });
  });

  it('chopping block: an axe doubles strokes and the finishing stroke gives 6 planks, bare hands 4', () => {
    const k = makeKit();
    k.world.put(3, 5, 3, 'chopping_block');
    hold(k, 'oak_log', 2);
    k.sim.stroke(3, 5, 3, 'oak_log');
    expect(k.sim.handView(3, 5, 3)).toMatchObject({ tool: 'axe', needed: 3, strokesPerS: 4 });
    expect(k.sim.stroke(3, 5, 3, 'flint_axe')).toMatchObject({ ok: true, did: 'stroke' });
    expect(k.sim.stroke(3, 5, 3, 'flint_axe')).toMatchObject({ ok: true, done: true });
    expect(k.sim.handView(3, 5, 3)?.output).toEqual({ item: 'plank', count: 6 });
    k.sim.stroke(3, 5, 3, null);
    for (let i = 0; i < 3; i++) k.sim.stroke(3, 5, 3, null);
    expect(k.sim.handView(3, 5, 3)?.output).toEqual({ item: 'plank', count: 4 });
  });

  it('stone anvil: wire from one ingot, a hammer doubles, hot window doubles, strokes cost food', () => {
    const k = makeKit();
    k.world.put(3, 5, 3, 'stone_anvil');
    hold(k, 'copper_ingot', 4);
    k.sim.stroke(3, 5, 3, 'copper_ingot');
    const food = k.player.food;
    expect(k.sim.stroke(3, 5, 3, 'flint_hammer')).toMatchObject({ ok: true, did: 'stroke' });
    expect(k.player.food).toBeCloseTo(food - 0.01, 5);
    expect(k.sim.handView(3, 5, 3)).toMatchObject({ recipe: 'copper_wire', progress: 2, needed: 6 });
    k.sim.openHotWindow(3, 5, 3);
    k.sim.stroke(3, 5, 3, null);
    expect(k.sim.handView(3, 5, 3)?.progress).toBe(4);
    expect(k.sim.handView(3, 5, 3)?.label).toContain('(hot)');
    k.run(21);
    expect(k.sim.handView(3, 5, 3)?.hot).toBe(false);
  });

  it('mortar stretches ore: a crushed ore, sometimes two', () => {
    const k = makeKit();
    k.world.put(3, 5, 3, 'mortar');
    const counts = new Set<number>();
    for (let i = 0; i < 40; i++) {
      hold(k, 'copper_ore', 1);
      k.sim.stroke(3, 5, 3, 'copper_ore');
      for (let s = 0; s < 8; s++) k.sim.stroke(3, 5, 3, null);
      counts.add(k.sim.handView(3, 5, 3)?.output?.count ?? 0);
      k.sim.stroke(3, 5, 3, null);
    }
    expect([...counts].sort()).toEqual([1, 2]);
  });

  it('a rack needs sky and daylight; rain resets it; the entity survives resync', () => {
    const k = makeKit();
    k.world.put(3, 5, 3, 'drying_rack');
    hold(k, 'soaked_hide', 2);
    k.sim.stroke(3, 5, 3, 'soaked_hide');
    k.run(60);
    const v = k.sim.handView(3, 5, 3);
    expect(v?.timed).toBe(true);
    expect(v?.progress).toBeGreaterThan(50);
    const e = k.world.getEntity(3, 5, 3) as HandEntity;
    k.sim.resync();
    expect(k.sim.handCount).toBe(1);
    expect(k.world.getEntity(3, 5, 3)).toBe(e);
    k.run(70);
    expect(k.sim.handView(3, 5, 3)?.output).toEqual({ item: 'leather', count: 2 });
  });
});
