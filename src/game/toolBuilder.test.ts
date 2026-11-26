import { describe, expect, it } from 'vitest';
import { Inventory, makeStack } from './inventory';
import { buildNeeds, canBuildNow, missingForBuild, previewRows, reworkTool, reworkable } from './toolBuilder';
import type { ToolBuild } from '../content/toolParts';

const iron: ToolBuild = { kind: 'pickaxe', head: 'iron', handle: 'pine', binding: 'resin' };

describe('tool builder rules', () => {
  it('lists what a build costs and what is missing', () => {
    expect(buildNeeds(iron).map((n) => `${n.count} ${n.item}`).sort()).toEqual(['1 iron_pickaxe_head', '1 pine_handle', '1 pine_resin']);
    const inv = new Inventory(36);
    inv.add('iron_pickaxe_head', 1);
    expect(missingForBuild(iron, inv).map((n) => n.item).sort()).toEqual(['pine_handle', 'pine_resin']);
    expect(canBuildNow(iron, inv)).toBe(false);
    inv.add('pine_handle', 1);
    inv.add('pine_resin', 1);
    expect(canBuildNow(iron, inv)).toBe(true);
  });
  it('compares a build with a held one of its kind, with deltas', () => {
    const rows = previewRows(iron, { ...iron, handle: 'oak', binding: 'cord' });
    expect(rows.find((r) => r.label === 'Mining speed')).toMatchObject({ value: 4.95, delta: 0.45 });
    expect(rows.find((r) => r.label === 'Uses')!.delta).toBe(Math.round(384 * 0.85 * 1.2) - 384);
    expect(previewRows({ ...iron, kind: 'maul' }, null).some((r) => r.label === 'Damage')).toBe(true);
  });
  it('reworks a tool: new part out of the pack, old part back, enchants and wear share kept', () => {
    const inv = new Inventory(36);
    inv.slots[0] = makeStack('iron_pickaxe', 1, 192, undefined, { veinseeker: 1 });
    inv.add('pine_handle', 1);
    const r = reworkTool(inv, 0, 'handle', 'pine');
    expect(r).toEqual({ ok: true, item: 'iron_pine_cord_pickaxe', returned: 'stick' });
    expect(inv.slots[0]).toMatchObject({ item: 'iron_pine_cord_pickaxe', enchants: { veinseeker: 1 } });
    expect(inv.count('pine_handle')).toBe(0);
    expect(inv.count('stick')).toBe(1);
    expect(reworkable(inv).map((x) => x.slot)).toEqual([0]);
  });
  it('refuses a rework without the part, and changes nothing', () => {
    const inv = new Inventory(36);
    inv.slots[0] = makeStack('iron_pickaxe', 1, 192);
    const before = JSON.stringify(inv.slots);
    const r = reworkTool(inv, 0, 'binding', 'resin');
    expect(r.ok).toBe(false);
    expect(JSON.stringify(inv.slots)).toBe(before);
  });
});
