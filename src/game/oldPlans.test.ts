import { describe, expect, it } from 'vitest';
import { createBus } from '../core/context';
import type { Slot } from '../core/types';
import { itemOrNull, blockOrNull } from '../core/registry';
import { OLD_PLANS, PLAN_CHANCE, planForCrate } from '../content/oldPlans';
import { structureCrateEntity, ruinCrateSlots } from '../world/ruinCrates';
import { MAX_BLUEPRINT_CELLS } from './blueprint';
import { OldPlans, planBlueprint } from './oldPlans';
import { PlayerState } from './playerState';

function rig() {
  const bus = createBus();
  const player = new PlayerState(bus, { x: 0.5, y: 10, z: 0.5 });
  const toasts: string[] = [];
  bus.on('toast', (e) => toasts.push(e.text));
  return { bus, player, toasts, plans: new OldPlans(bus, player) };
}

describe('old plan data', () => {
  it('has unique ids and items, real items, and real blocks with items in every layout', () => {
    expect(new Set(OLD_PLANS.map((p) => p.id)).size).toBe(OLD_PLANS.length);
    expect(new Set(OLD_PLANS.map((p) => p.item)).size).toBe(OLD_PLANS.length);
    for (const p of OLD_PLANS) {
      expect(itemOrNull(p.item), p.item).not.toBeNull();
      for (const key of Object.values(p.legend)) {
        expect(blockOrNull(key), key).not.toBeNull();
        expect(itemOrNull(key), key).not.toBeNull();
      }
    }
  });

  it('turns every layout into a rectangular blueprint with cells inside its size', () => {
    for (const p of OLD_PLANS) {
      const widths = new Set(p.layers.flatMap((rows) => rows.map((r) => r.length)));
      expect(widths.size, p.id).toBe(1);
      const bp = planBlueprint(p);
      expect(bp.cells.length, p.id).toBeGreaterThan(10);
      expect(bp.cells.length).toBeLessThanOrEqual(MAX_BLUEPRINT_CELLS);
      for (const c of bp.cells) {
        expect(c.dx).toBeLessThan(bp.size[0]);
        expect(c.dy).toBeLessThan(bp.size[1]);
        expect(c.dz).toBeLessThan(bp.size[2]);
      }
    }
  });

  it('holds a torch only on a floor or ledge (never floating): every torch has a block below', () => {
    for (const p of OLD_PLANS) {
      const bp = planBlueprint(p);
      for (const c of bp.cells.filter((x) => x.block === 'torch')) {
        expect(bp.cells.some((o) => o.dx === c.dx && o.dz === c.dz && o.dy === c.dy - 1), p.id).toBe(true);
      }
    }
  });
});

describe('crates', () => {
  it('put a plan of the right tier in about the stated share of crates, the same way every time', () => {
    for (const tier of ['near', 'deep'] as const) {
      let hits = 0;
      const n = 400;
      for (let i = 0; i < n; i++) {
        const key = planForCrate(Math.imul(i + 1, 2654435761), tier);
        expect(planForCrate(Math.imul(i + 1, 2654435761), tier)).toBe(key);
        if (key) {
          hits++;
          expect(OLD_PLANS.find((p) => p.item === key)?.tier).toBe(tier);
        }
      }
      expect(Math.abs(hits / n - PLAN_CHANCE[tier])).toBeLessThan(0.1);
    }
  });

  it('keep the ordinary roll: a ruin crate is the same with a plan removed', () => {
    let withPlan = 0;
    for (let i = 0; i < 200; i++) {
      const slots = ruinCrateSlots(77, i * 5, 40, i * 3, i % 2 ? 'deep' : 'near');
      const planAt = slots.findIndex((s) => s && OLD_PLANS.some((p) => p.item === s.item));
      if (planAt >= 0) withPlan++;
      expect(slots.filter((s) => s !== null).length).toBeGreaterThan(0);
    }
    expect(withPlan).toBeGreaterThan(20);
  });

  it('give the old-age structures a plan sometimes and the others never', () => {
    let found = 0;
    for (let i = 0; i < 200; i++) {
      const e = structureCrateEntity(3, i * 4, 30, i * 9, 'old_factory');
      if ((e.slots as Slot[]).some((s) => s && OLD_PLANS.some((p) => p.item === s.item))) found++;
      const other = structureCrateEntity(3, i * 4, 30, i * 9, 'oil_derrick');
      expect((other.slots as Slot[]).some((s) => s && OLD_PLANS.some((p) => p.item === s.item))).toBe(false);
    }
    expect(found).toBeGreaterThan(40);
  });
});

describe('reading', () => {
  it('learns a plan, spends the item and keeps a known one', () => {
    const { player, toasts, plans } = rig();
    const item = OLD_PLANS[0].item;
    player.inventory.add(item, 2);
    player.selectedSlot = player.inventory.slots.findIndex((s) => s?.item === item);
    expect(plans.use(player.heldStack())).toBe('worked');
    expect(plans.has(OLD_PLANS[0].id)).toBe(true);
    expect(player.inventory.count(item)).toBe(1);
    player.selectedSlot = player.inventory.slots.findIndex((x) => x?.item === item);
    expect(plans.use(player.heldStack())).toBe('refused');
    expect(player.inventory.count(item)).toBe(1);
    expect(toasts.length).toBe(2);
    expect(plans.blueprints().map((b) => b.name)).toEqual(['Kiln House']);
    expect(plans.blueprintOf('lookout')).toBeNull();
  });

  it('ignores other items', () => {
    const { plans } = rig();
    expect(plans.use({ item: 'coal', count: 1 })).toBeNull();
    expect(plans.use(null)).toBeNull();
  });

  it('saves and loads, dropping unknown ids', () => {
    const a = rig().plans;
    a.learn('cistern');
    a.learn('lookout');
    const b = rig().plans;
    b.load([...a.toJSON(), 'nonsense', 4]);
    expect(b.list().map((p) => p.id)).toEqual(['cistern', 'lookout']);
    b.load(undefined);
    expect(b.list()).toEqual([]);
  });
});
