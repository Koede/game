import { describe, expect, it } from 'vitest';
import { HEARTH_MAX_TUYERES, HEARTH_SHELL_AREA_REF, HEARTH_SPEED_MAX } from './constants';
import { faceCells, hearthCrucibles, hearthScale, interiorFits, shellCells, smallestShell } from './hearth';
import { validateTech, type TechTables } from './techValidation';
import type { HearthStructureSpec } from './types';

const BLAST: HearthStructureSpec = { wall: ['brick'], minInner: [1, 1, 1], maxInner: [3, 3, 3], ceiling: 'optional', maxCrucibles: 5, crucibleBonus: 1 };
const PLASMA: HearthStructureSpec = { wall: ['casing'], minInner: [2, 2, 2], maxInner: [5, 5, 4], ceiling: 'required', powerPorts: 2, maxCrucibles: 8, crucibleBonus: 2 };
const ODD: HearthStructureSpec = { wall: ['x'], minInner: [1, 2, 1], maxInner: [2, 4, 3], ceiling: 'required', maxCrucibles: 9, crucibleBonus: 0 };

describe('hearth geometry', () => {
  it('counts shell cells, closed and open', () => {
    expect(shellCells([1, 1, 1], true)).toBe(HEARTH_SHELL_AREA_REF);
    expect(shellCells([1, 1, 1], false)).toBe(17); // 3x3 floor + a ring of 8
    expect(shellCells([3, 3, 3], true)).toBe(125 - 27);
    expect(shellCells([2, 3, 1], true)).toBe(4 * 5 * 3 - 6);
  });

  it('counts the face cells where parts may go', () => {
    expect(faceCells([1, 1, 1])).toEqual({ walls: 4, floor: 1, ceiling: 1 });
    expect(faceCells([2, 3, 2])).toEqual({ walls: 20, floor: 6, ceiling: 6 });
  });

  it('accepts interiors within bounds, either way round', () => {
    expect(interiorFits(BLAST, [1, 1, 1])).toBe(true);
    expect(interiorFits(BLAST, [3, 3, 3])).toBe(true);
    expect(interiorFits(BLAST, [4, 1, 1])).toBe(false);
    expect(interiorFits(BLAST, [1, 1, 4])).toBe(false);
    expect(interiorFits(PLASMA, [1, 2, 2])).toBe(false);
    expect(interiorFits(ODD, [2, 1, 1])).toBe(true); // x and z swapped against the table
    expect(interiorFits(ODD, [3, 1, 1])).toBe(true);
    expect(interiorFits(ODD, [3, 3, 1])).toBe(false);
  });

  it('grants crucibles by floor area, capped', () => {
    expect(hearthCrucibles(BLAST, [1, 1, 1])).toBe(2);
    expect(hearthCrucibles(BLAST, [2, 2, 3])).toBe(5);
    expect(hearthCrucibles(BLAST, [3, 3, 1])).toBe(5);
    expect(hearthCrucibles(PLASMA, [2, 2, 2])).toBe(6);
    expect(hearthCrucibles(PLASMA, [5, 5, 4])).toBe(8);
  });

  it('scales heat capacity, loss and speed with the interior', () => {
    const one = hearthScale([1, 1, 1], { closed: true, windows: 0, tuyeres: 0 });
    expect(one).toEqual({ heatCapacity: 1, loss: 1, speed: 1 });
    const big = hearthScale([3, 3, 3], { closed: true, windows: 0, tuyeres: 0 });
    expect(big.heatCapacity).toBeCloseTo(Math.sqrt(27));
    expect(big.loss).toBeCloseTo(98 / 26);
    expect(big.speed).toBe(HEARTH_SPEED_MAX); // 1 + 0.1 * 26 is capped
    expect(hearthScale([2, 1, 1], { closed: true, windows: 0, tuyeres: 0 }).speed).toBeCloseTo(1.1);
    // Windows and an open top count double.
    expect(hearthScale([1, 1, 1], { closed: true, windows: 2, tuyeres: 0 }).loss).toBeCloseTo(28 / 26);
    expect(hearthScale([1, 1, 1], { closed: false, windows: 0, tuyeres: 0 }).loss).toBeCloseTo(27 / 26);
    // Tuyeres: +25% each, at most four count.
    expect(hearthScale([1, 1, 1], { closed: true, windows: 0, tuyeres: 2 }).speed).toBeCloseTo(1.5);
    expect(hearthScale([1, 1, 1], { closed: true, windows: 0, tuyeres: 9 }).speed).toBeCloseTo(1 + 0.25 * HEARTH_MAX_TUYERES);
  });

  it('prices the smallest shell of a tier', () => {
    expect(smallestShell(BLAST)).toEqual({ inner: [1, 1, 1], closed: false, cells: 17, wall: 16, electrodes: 0, powerPorts: 0 });
    expect(smallestShell(PLASMA)).toEqual({ inner: [2, 2, 2], closed: true, cells: 56, wall: 53, electrodes: 0, powerPorts: 2 });
  });
});

describe('transport and hearth validation', () => {
  const tables = (over: Partial<TechTables>): TechTables => ({
    blocks: [], knownBlock: () => true, knownItem: () => true, fluids: [], tiers: [], machines: [], ...over,
  });
  const tier = (n: number, structure?: HearthStructureSpec) => ({
    tier: n, block: `f${n}`, name: `F${n}`, maxTempC: 1000, heatCapacityJ: 1, lossWPerC: 1, crucibles: 1, fuelSlots: 1, speed: 1,
    electricHeatW: 0, warmth: 1, upgradeCost: [], upgradeTempC: 0, age: 0, blurb: '', structure,
  });

  it('accepts consistent tiers and reports broken ones', () => {
    expect(validateTech(tables({ tiers: [tier(1), tier(2), tier(3, BLAST)] }))).toEqual([]);
    const problems = validateTech(tables({
      tiers: [tier(1, BLAST), tier(2), tier(3), tier(4, { ...ODD, minInner: [3, 1, 1], electrodes: 2, ceiling: 'optional' })],
    }));
    expect(problems.some((p) => p.includes('single-block tiers stand alone'))).toBe(true);
    expect(problems.some((p) => p.includes('tier 3: needs a hearth structure'))).toBe(true);
    expect(problems.some((p) => p.includes('minInner exceeds maxInner'))).toBe(true);
    expect(problems.some((p) => p.includes('electrodes need a required ceiling'))).toBe(true);
  });

  it('insists that higher walls also count for lower tiers', () => {
    const lower = { ...BLAST, wall: ['brick'] };
    const upper = { ...PLASMA, wall: ['casing'] };
    const problems = validateTech(tables({ tiers: [tier(1), tier(2), tier(3, lower), tier(4, upper)] }));
    expect(problems).toContain(`furnace tier 3: tier 4's wall "casing" must also count here`);
  });

  it('checks fluids and fluid ports', () => {
    const problems = validateTech(tables({
      fluids: [
        { key: 'water', name: 'Water', colour: 0x1000000, hot: false, glow: false, liquid: 'water' },
        { key: 'water', name: 'Again', colour: 0, hot: false, glow: false, liquid: 'water' },
      ],
      machines: [{ kind: 'm', name: 'M', role: 'tank', blocks: [], desc: '', fluids: { accepts: ['lava'], capacityL: 0 } }],
    }));
    expect(problems).toEqual(expect.arrayContaining([
      'fluid water: colour is not 0xRRGGBB', 'fluid water: duplicate key', 'fluid water: another fluid is already pumped from water',
      'machine m: unknown fluid "lava"', 'machine m: fluid capacityL must be > 0',
    ]));
  });
});
