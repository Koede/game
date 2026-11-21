import { describe, expect, it } from 'vitest';
import { HEARTH_MAX_PROBLEMS } from '../core/constants';
import { shellCells } from '../core/hearth';
import { blockId } from '../core/registry';
import { Facing, makeVoxel } from '../core/types';
import { FakeWorld } from '../game/fakeWorld';
import { boxCells, buildHearth, shellBox, type ShellOptions } from './hearthKit';
import { CellRole, problemsFor, scanHearth, tierProblems, type HearthProblemCode } from './hearthScan';

/** A furnace at 0, 5, 0 with a shell around it; returns the world and a scanner. */
function setup(o: ShellOptions, furnace = 'furnace_blast') {
  const world = new FakeWorld();
  const facing = o.facing ?? Facing.North;
  world.setVoxel(0, 5, 0, makeVoxel(blockId(furnace), facing));
  const box = buildHearth(world, 0, 5, 0, o);
  return { world, box, scan: () => scanHearth(world, 0, 5, 0, facing) };
}

const codes = (list: Array<{ code: HearthProblemCode }>): HearthProblemCode[] => list.map((p) => p.code);

describe('hearth scan: forming', () => {
  it('forms the smallest hearth of every tier at that tier', () => {
    for (const tier of [2, 3, 4, 5]) {
      const scan = setup({ tier }).scan();
      expect(scan.problems, `tier ${tier}`).toEqual([]);
      expect(scan.structuralTier, `tier ${tier}`).toBe(tier);
    }
  });

  it('finds the box: inside size, open top or ceiling, and every cell of it', () => {
    const open = setup({ tier: 2, inner: [3, 2, 2] }).scan();
    expect(open).toMatchObject({ inner: [3, 2, 2], closed: false, structuralTier: 2 });
    expect(open.cells.length / 5).toBe(5 * 4 * 3); // floor layer + 2 interior layers of the 5x4 box
    expect(open.walls.total + open.floor.total + 1).toBe(shellCells([3, 2, 2], false));
    const closed = setup({ tier: 2, inner: [2, 3, 1], closed: true }).scan();
    expect(closed).toMatchObject({ inner: [2, 3, 1], closed: true, structuralTier: 2 });
    expect(closed.ceiling.total).toBe(4 * 5);
  });

  it('works whichever way the furnace faces', () => {
    for (const facing of [Facing.North, Facing.East, Facing.South, Facing.West]) {
      const { scan, box } = setup({ tier: 3, inner: [3, 2, 2], facing });
      const s = scan();
      expect(s.structuralTier, `facing ${facing}`).toBe(3);
      expect(s.inner).toEqual([3, 2, 2]);
      // The inside is behind the furnace's back.
      const behind = boxCells(box).find((c) => c.u === 0 && c.v === 1 && c.y === 5);
      expect(behind?.role).toBe(CellRole.Interior);
    }
  });

  it('accepts the smallest and largest inside of each tier, and nothing beyond', () => {
    expect(setup({ tier: 2, inner: [1, 1, 1] }).scan().structuralTier).toBe(2);
    expect(setup({ tier: 2, inner: [3, 3, 3] }).scan().structuralTier).toBe(2);
    expect(setup({ tier: 3, inner: [4, 4, 3] }).scan().structuralTier).toBe(3);
    expect(setup({ tier: 4, inner: [5, 5, 4] }).scan().structuralTier).toBe(4);
    expect(setup({ tier: 5, inner: [5, 5, 5] }).scan().structuralTier).toBe(5);
    const big = setup({ tier: 2, inner: [4, 3, 1] }).scan();
    expect(big.structuralTier).toBe(0);
    expect(codes(tierProblems(big, 2))).toEqual(['size']);
    expect(tierProblems(big, 2)[0].text).toBe('Too big for a Blast hearth - the inside can be at most 3x3x3');
    const small = setup({ tier: 4, inner: [1, 2, 2] }).scan();
    expect(tierProblems(small, 4)[0].text).toBe('Too small for a Plasma hearth - the inside must be at least 2x2x2');
  });

  it('lets higher walls stand for lower tiers, and the weakest wall caps the tier', () => {
    expect(setup({ tier: 2, wall: 'star_casing' }).scan().structuralTier).toBe(2);
    const { world, scan } = setup({ tier: 3, inner: [2, 2, 2] });
    expect(scan().structuralTier).toBe(3);
    world.put(1, 4, 1, 'brick'); // a floor cell
    const mixed = scan();
    expect(mixed.structuralTier).toBe(2);
    expect(mixed.wallTier).toBe(2);
    expect(tierProblems(mixed, 3)).toEqual([{ code: 'wall_tier', x: 1, y: 4, z: 1, text: 'Wall is not Refractory Brick' }]);
  });

  it('counts windows, hatches, ports and blowers in faces', () => {
    const { world, scan } = setup({ tier: 2, inner: [3, 3, 2] });
    world.put(1, 5, 4, 'glass');
    world.put(-1, 6, 4, 'glass');
    world.put(-2, 5, 2, 'item_hatch');
    world.put(2, 5, 2, 'fluid_hatch');
    world.put(-2, 6, 2, 'blower');
    world.put(0, 4, 2, 'power_port'); // floor face
    const s = scan();
    expect(s).toMatchObject({ structuralTier: 2, windows: 2 });
    expect(s.itemHatches).toEqual([[-2, 5, 2]]);
    expect(s.fluidHatches).toEqual([[2, 5, 2]]);
    expect(s.blowers).toEqual([[-2, 6, 2]]);
    expect(s.ports).toEqual([[0, 4, 2]]);
    expect(s.walls.parts + s.floor.parts).toBe(6);
  });
});

describe('hearth scan: problems', () => {
  it('needs the hollow behind the furnace', () => {
    const { world, scan } = setup({ tier: 2 });
    world.put(0, 5, 1, 'stone');
    expect(scan().problems).toEqual([{ code: 'behind', x: 0, y: 5, z: 1, text: 'The block behind the furnace must be the hollow inside - its front faces out' }]);
    // A furnace turned the wrong way looks out of its hearth.
    const back = setup({ tier: 2 });
    back.world.setVoxel(0, 5, 0, makeVoxel(blockId('furnace_blast'), Facing.South));
    expect(codes(scanHearth(back.world, 0, 5, 0, Facing.South).problems)).toEqual(['open']);
  });

  it('reports open sides, a missing floor and endless walls', () => {
    const world = new FakeWorld();
    world.put(0, 5, 0, 'furnace_blast');
    expect(scanHearth(world, 0, 5, 0, Facing.North).problems[0]).toMatchObject({ code: 'open', text: 'No walls found - the inside can be at most 5 blocks across' });
    const { world: w2, scan } = setup({ tier: 2 });
    w2.put(0, 4, 1, 'air');
    expect(codes(scan().problems)).toEqual(['no_floor']);
    const tall = setup({ tier: 2 });
    for (let y = 6; y <= 12; y++) for (const [x, z] of [[-1, 0], [1, 0], [-1, 1], [1, 1], [-1, 2], [0, 2], [1, 2], [0, 0]]) tall.world.put(x, y, z, 'brick');
    expect(tall.scan().problems[0]).toMatchObject({ code: 'too_tall', text: 'Too tall - the inside can be at most 5 blocks high' });
  });

  it('names gaps, wrong blocks, parts on edges, misplaced electrodes, a second furnace and clutter inside', () => {
    const { world, scan } = setup({ tier: 2, inner: [3, 3, 2], closed: true });
    world.put(1, 5, 4, 'air'); // back wall face
    world.put(-2, 4, 2, 'air'); // floor edge
    world.put(2, 5, 2, 'dirt');
    world.put(2, 6, 4, 'glass'); // vertical edge
    world.put(1, 7, 2, 'electrode'); // ceiling face: fine
    world.put(-2, 6, 3, 'electrode'); // wall face: wrong place
    world.put(0, 6, 0, 'furnace_clay');
    world.put(0, 5, 2, 'torch');
    const s = scan();
    expect(s.structuralTier).toBe(0);
    expect(s.problems).toEqual(expect.arrayContaining([
      { code: 'missing', x: 1, y: 5, z: 4, text: 'Wall has a gap' },
      { code: 'missing', x: -2, y: 4, z: 2, text: 'Floor has a gap' },
      { code: 'wrong_block', x: 2, y: 5, z: 2, text: 'Dirt cannot be part of the wall' },
      { code: 'edge_part', x: 2, y: 6, z: 4, text: 'Glass cannot sit on an edge' },
      { code: 'electrode_place', x: -2, y: 6, z: 3, text: 'Arc Electrodes only work in the ceiling' },
      { code: 'controller', x: 0, y: 6, z: 0, text: 'Another furnace is part of this wall' },
      { code: 'interior', x: 0, y: 5, z: 2, text: 'Interior must be empty' },
    ]));
    expect(s.problemCount).toBe(7);
    expect(s.electrodes).toEqual([[1, 7, 2]]);
  });

  it('asks for what a tier needs: a ceiling, electrodes, power ports', () => {
    const open = setup({ tier: 2, wall: 'refractory_brick' }).scan();
    expect(open.structuralTier).toBe(2);
    expect(tierProblems(open, 3)).toEqual([
      { code: 'ceiling', x: 0, y: 6, z: 1, text: 'An Arc hearth needs a ceiling' },
      { code: 'electrodes', x: 0, y: 6, z: 1, text: 'Needs 1 more Arc Electrode' },
    ]);
    const plasma = setup({ tier: 4, ports: 0 }).scan();
    expect(plasma.structuralTier).toBe(2); // no electrode for an Arc hearth either; small enough for a Blast one
    expect(tierProblems(plasma, 4)).toEqual([{ code: 'ports', x: 0, y: 5, z: 0, text: 'Needs 2 more Power Ports' }]);
    expect(tierProblems(setup({ tier: 4, ports: 1 }).scan(), 4)[0].text).toBe('Needs 1 more Power Port');
  });

  it('reports at most eight problems, and counts them all', () => {
    const { world, scan } = setup({ tier: 2, inner: [3, 3, 3] });
    for (let x = -2; x <= 2; x++) for (let z = 0; z <= 4; z++) if (!(x === 0 && z === 1)) world.put(x, 4, z, 'air');
    const s = scan();
    expect(s.problems).toHaveLength(HEARTH_MAX_PROBLEMS);
    expect(s.problemCount).toBe(24);
    expect(problemsFor(s, 2)).toHaveLength(HEARTH_MAX_PROBLEMS);
  });
});

describe('the test fixture', () => {
  it('builds where it says', () => {
    const b = shellBox(0, 5, 0, { tier: 2 });
    expect(boxCells(b).filter((c) => c.role === CellRole.Interior).map(({ x, y, z }) => [x, y, z])).toEqual([[0, 5, 1]]);
  });
});
