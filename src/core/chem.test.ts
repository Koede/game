import { describe, expect, it } from 'vitest';
import {
  COMPONENTS, GRADES, SLOP, add, bubblePoint, colourOf, drawIndex, expand, gradeOf, meets, nameOf, pour, share, take, total, trayTemps,
  vapourShares, viscosityOf, type Mix,
} from './chem';

describe('chem mixtures', () => {
  it('moves litres without creating or losing any', () => {
    const a = expand('crude_oil', 4000);
    const b: Mix = {};
    expect(total(a)).toBeCloseTo(4000, 9);
    expect(pour(a, b, 1234.5)).toBeCloseTo(1234.5, 9);
    expect(total(a) + total(b)).toBeCloseTo(4000, 9);
    expect(pour(a, b, 1e9)).toBeCloseTo(4000 - 1234.5, 6);
    expect(total(a)).toBe(0);
    expect(take(b, 'diesel', 1e9)).toBeCloseTo(1200, 6);
    expect(b.diesel).toBeUndefined();
  });

  it('boils water at 100 C, ethanol at 78 C and a wash in between; solutes raise the boiling point', () => {
    expect(bubblePoint({ water: 1 })).toBeCloseTo(100, 9);
    expect(bubblePoint({ ethanol: 5 })).toBeCloseTo(78, 9);
    const wash = bubblePoint(expand('sugar_wash', 1))!;
    expect(wash).toBeGreaterThan(90);
    expect(wash).toBeLessThan(100);
    expect(bubblePoint({ water: 1, sugars: 1 })!).toBeGreaterThan(100);
    expect(bubblePoint({ sugars: 3 })).toBeNull();
    expect(bubblePoint({})).toBeNull();
  });

  it('enriches the vapour in the lighter component, more with every stage', () => {
    const y1: Mix = {};
    const y4: Mix = {};
    const wash = expand('sugar_wash', 1);
    vapourShares(wash, 1, y1);
    vapourShares(wash, 4, y4);
    expect(share(y1, 'ethanol')).toBeGreaterThan(share(wash, 'ethanol') * 2);
    expect(share(y4, 'ethanol')).toBeGreaterThan(share(y1, 'ethanol'));
    expect(total(y1)).toBeCloseTo(1, 9);
    expect(vapourShares({ rosin: 2 }, 1, y1)).toBe(false);
  });

  it('names every grade back to itself, and nothing better (purity is never gained at the boundary)', () => {
    for (const g of GRADES) {
      expect(total(expand(g.fluid, 1)), g.fluid).toBeCloseTo(1, 9);
      expect(meets(expand(g.fluid, 1), g), g.fluid).toBe(true);
      expect(nameOf(expand(g.fluid, 250)), g.fluid).toBe(g.fluid);
    }
    expect(nameOf({})).toBeNull();
    expect(nameOf({ fusel: 3, turpentine: 3 })).toBe(SLOP);
    expect(gradeOf(SLOP)).toBeNull();
    expect(total(expand(SLOP, 10))).toBeCloseTo(10, 9);
  });

  it('cuts a column by boiling point: lower draws take the heavier cuts', () => {
    const trays = trayTemps(350, 60, 3);
    expect(trays.map(Math.round)).toEqual([253, 157, 60]);
    const draws = [trays[0], trays[1]];
    expect(drawIndex(COMPONENTS.diesel.bp!, draws)).toBe(0);
    expect(drawIndex(COMPONENTS.kerosene.bp!, draws)).toBe(1);
    expect(drawIndex(COMPONENTS.gasoline.bp!, draws)).toBe(2);
  });

  it('colours and thickens a mixture by its contents', () => {
    expect(colourOf({ water: 1 })).toBe(COMPONENTS.water.colour);
    expect(colourOf({}, 0x123456)).toBe(0x123456);
    const m: Mix = { water: 1 };
    add(m, 'bitumen', 1);
    expect(viscosityOf(m)).toBeGreaterThan(10);
    expect(viscosityOf({ gasoline: 1 })).toBeLessThan(1);
  });
});
