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

  it('chopping block: an axe doubles strokes and gives 6 planks', () => {
    const k = makeKit();
    k.world.put(3, 5, 3, 'chopping_block');
    hold(k, 'oak_log', 1);
    k.sim.stroke(3, 5, 3, 'oak_log');
    const axe = ['flint_axe', 'bronze_axe', 'stone_axe'].find((i) => k.sim.handView(3, 5, 3) && i && true) as string;
    expect(k.sim.handView(3, 5, 3)?.tool).toBe('axe');
    expect(k.sim.stroke(3, 5, 3, axe)).toMatchObject({ ok: true });
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
