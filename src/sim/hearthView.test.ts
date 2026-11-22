import { describe, expect, it } from 'vitest';
import { makeKit, type Kit } from './testKit';

/** A Blast Furnace at 0, 1, 0 facing north: any hearth lies towards +z. */
function kitWithFurnace(block = 'furnace_blast'): Kit {
  const kit = makeKit();
  kit.furnace(0, 1, 0, block);
  return kit;
}

const cell = (kit: Kit, x: number, y: number, z: number, tier?: number) =>
  kit.sim.structureView(0, 1, 0, tier ? { tier } : undefined)!.target.cells.find((c) => c.x === x && c.y === y && c.z === z);

describe('structure view', () => {
  it('plans the smallest hearth the furnace needs when nothing stands yet', () => {
    const kit = kitWithFurnace();
    const v = kit.sim.structureView(0, 1, 0)!;
    expect(v).toMatchObject({ controllerTier: 3, effectiveTier: 2, formed: false, tier: 0, name: null, inner: null, status: 'Not formed' });
    expect(v.problems).toEqual([]);
    expect(v.note).toBe('No hearth built around this furnace yet');
    expect(v.tiers.map((t) => [t.tier, t.name, t.wall])).toEqual([
      [3, 'Blast hearth', 'brick'], [4, 'Arc hearth', 'refractory_brick'], [5, 'Plasma hearth', 'plasma_casing'], [6, 'Starhearth', 'star_casing'],
    ]);
    expect(v.target).toMatchObject({ tier: 3, name: 'Blast hearth', inner: [1, 1, 1], closed: false, min: [-1, 0, 0], max: [1, 1, 2], ready: false });
    // 16 cells, all to be placed: 9 floor, 7 walls (the furnace is the eighth).
    expect(v.target.cells).toHaveLength(16);
    expect(v.target.cells.every((c) => c.state === 'missing' && c.want === 'brick' && c.has === 'air')).toBe(true);
    expect(v.target.materials).toEqual([{ item: 'brick', need: 16, placed: 0, missing: 16, have: 0, ok: false }]);
    expect(v.target.checklist).toEqual([
      { key: 'floor', label: 'Floor', have: 0, need: 9, ok: false },
      { key: 'walls', label: 'Walls', have: 0, need: 7, ok: false },
      { key: 'interior', label: 'Inside empty', have: 1, need: 1, ok: true },
    ]);
  });

  it('counts what stands, what is missing, what is wrong, and what the pack and crates hold', () => {
    const kit = kitWithFurnace();
    kit.formed(0, 1, 0);
    kit.world.put(1, 1, 1, 'dirt');
    kit.world.put(0, 0, 2, 'air');
    kit.world.put(0, 1, 1, 'torch');
    kit.player.give('brick', 3);
    kit.machine('crate', -3, 1, -1).slots[0] = { item: 'brick', count: 5 };
    const v = kit.sim.structureView(0, 1, 0)!;
    expect(v.formed).toBe(false);
    expect(v.problems.map((p) => p.code).sort()).toEqual(['interior', 'missing', 'wrong_block']);
    expect(cell(kit, 1, 1, 1)).toMatchObject({ role: 'wall', want: 'brick', has: 'dirt', state: 'wrong' });
    expect(cell(kit, 0, 0, 2)).toMatchObject({ role: 'edge', want: 'brick', state: 'missing' });
    expect(cell(kit, 0, 1, 1)).toMatchObject({ role: 'interior', want: 'air', has: 'torch', state: 'wrong' });
    expect(cell(kit, -1, 1, 1)).toMatchObject({ role: 'wall', state: 'ok' });
    expect(v.target.materials).toEqual([{ item: 'brick', need: 16, placed: 14, missing: 2, have: 8, ok: true }]);
    expect(v.target.checklist).toEqual([
      { key: 'floor', label: 'Floor', have: 8, need: 9, ok: false },
      { key: 'walls', label: 'Walls', have: 6, need: 7, ok: false },
      { key: 'interior', label: 'Inside empty', have: 0, need: 1, ok: false },
    ]);
  });

  it('shows a formed hearth and plans the next tier around it, electrodes in the middle of the ceiling', () => {
    const kit = kitWithFurnace();
    kit.formed(0, 1, 0, { inner: [3, 2, 1] });
    const v = kit.sim.structureView(0, 1, 0)!;
    expect(v).toMatchObject({ formed: true, tier: 3, name: 'Blast hearth', inner: [3, 2, 1], status: 'Formed - Blast hearth 3x2x1' });
    expect(v.target.tier).toBe(4);
    expect(v.target.inner).toEqual([3, 2, 1]);
    expect(v.target.closed).toBe(true);
    const electrodes = v.target.cells.filter((c) => c.want === 'electrode');
    expect(electrodes).toEqual([expect.objectContaining({ role: 'ceiling', state: 'missing', y: 2, x: 0 })]);
    // Bricks are no longer good enough: every one is wrong for an Arc hearth.
    // (Under the furnace any solid block will do: that cell is hard to reach once the furnace stands on it.)
    const under = (c: { x: number; y: number; z: number }) => c.x === 0 && c.y === 0 && c.z === 0;
    expect(v.target.cells.filter((c) => c.has === 'brick' && !under(c)).every((c) => c.state === 'wrong')).toBe(true);
    expect(v.target.cells.find(under)).toMatchObject({ has: 'brick', want: 'brick', state: 'ok' });
    expect(v.target.materials.map((m) => [m.item, m.need])).toEqual([['refractory_brick', 51], ['electrode', 1]]);
    expect(v.target.checklist.map((c) => c.key)).toEqual(['floor', 'walls', 'ceiling', 'interior', 'electrodes']);
    expect(v.problems).toEqual([
      { code: 'ceiling', x: 0, y: 2, z: 1, text: 'An Arc hearth needs a ceiling' },
      { code: 'electrodes', x: 0, y: 2, z: 1, text: 'Needs 1 more Arc Electrode' },
      expect.objectContaining({ code: 'wall_tier', text: 'Wall is not Refractory Brick' }),
      expect.objectContaining({ code: 'wall_tier' }), expect.objectContaining({ code: 'wall_tier' }), expect.objectContaining({ code: 'wall_tier' }),
      expect.objectContaining({ code: 'wall_tier' }), expect.objectContaining({ code: 'wall_tier' }),
    ]);
  });

  it('fits a chosen size into the tier bounds and puts power ports where they cost least', () => {
    const kit = kitWithFurnace('furnace_plasma');
    const v = kit.sim.structureView(0, 1, 0, { tier: 5, inner: [9, 1, 3] })!;
    expect(v.target.inner).toEqual([5, 2, 3]);
    const ports = v.target.cells.filter((c) => c.want === 'power_port');
    expect(ports).toHaveLength(2);
    expect(ports.every((c) => c.role === 'wall' && c.state === 'missing')).toBe(true);
    // Placing every block the preview asks for forms it at that tier.
    for (const c of v.target.cells) if (c.want !== 'air') kit.world.put(c.x, c.y, c.z, c.want);
    expect(kit.sim.structureView(0, 1, 0, { tier: 5, inner: [5, 2, 3] })).toMatchObject({ formed: true, tier: 5, inner: [5, 2, 3] });
    expect(kit.sim.structureView(0, 1, 0, { tier: 5 })!.target.ready).toBe(true);
  });

  it('offers shifts left and right as seen in front of the furnace, within the offset range (sim-7)', () => {
    // Facing north, the player stands north of it looking south: their left is +x, their right -x.
    const kit = kitWithFurnace();
    const plan = (offset: number) => kit.sim.structureView(0, 1, 0, { tier: 3, inner: [3, 1, 1], offset })!.target;
    const mid = plan(-1);
    expect(mid).toMatchObject({ offset: -1, offsets: [-2, 0], shiftLeft: 0, shiftRight: -2, min: [-2, 0, 0], max: [2, 1, 2] });
    const left = plan(mid.shiftLeft!);
    expect(left).toMatchObject({ offset: 0, shiftLeft: null, shiftRight: -1, min: [-1, 0, 0], max: [3, 1, 2] });
    const right = plan(mid.shiftRight!);
    expect(right).toMatchObject({ offset: -2, shiftLeft: -1, shiftRight: null, min: [-3, 0, 0], max: [1, 1, 2] });
    // One block wide inside: nowhere to shift.
    expect(kit.sim.structureView(0, 1, 0, { tier: 3, inner: [1, 1, 1] })!.target).toMatchObject({ offsets: [0, 0], shiftLeft: null, shiftRight: null });
  });

  it('lists each machine or pipe in the plan\'s way once, but not hatches set in its wall (sim-7)', () => {
    const kit = kitWithFurnace();
    kit.machine('crate', 0, 1, 1);
    kit.world.put(1, 1, 1, 'item_pipe');
    kit.world.put(0, 1, 2, 'item_hatch');
    const v = kit.sim.structureView(0, 1, 0, { tier: 3, inner: [1, 1, 1] })!;
    expect(v.target.machines).toEqual([{ x: 0, y: 1, z: 1, block: 'crate', name: 'Crate' }, { x: 1, y: 1, z: 1, block: 'item_pipe', name: v.target.machines[1].name }]);
    expect(v.target.cells.find((c) => c.x === 0 && c.y === 1 && c.z === 2)).toMatchObject({ want: 'item_hatch', state: 'ok' });
  });

  it('is null without a furnace', () => {
    expect(makeKit().sim.structureView(0, 1, 0)).toBeNull();
  });
});
