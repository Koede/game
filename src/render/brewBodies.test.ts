import { describe, expect, it } from 'vitest';
import { BOIL_DRY_SECONDS, BOIL_SECONDS, BREW_SECONDS } from '../core/constants';
import type { BlockEntity } from '../core/types';
import { CUP_CONE_TOP, CUP_INNER_MAX, CUP_INNER_MIN, CUP_RIM_Y, CUP_SPOUT_Y } from '../world/meshCup';
import { BOIL, BREW_WATER, DEFAULT_DRINK, GLASS_WATER, RESIN, SAP, brewBodies, mixHex, vesselOf, type Body, type BrewLook } from './brewBodies';

const look = (over: Partial<BrewLook> = {}): BrewLook => ({ drinkColour: null, boilScale: 1, holds: 'water', active: false, ...over });
const blank = (): Body => ({ x: 0, y: 0, z: 0, sx: 0, sy: 0, sz: 0, colour: 0, flowY: 0, speed: 0, boil: 0, surface: false });
function bodies(e: Record<string, unknown>, l: BrewLook = look()): Body[] {
  const out: Body[] = [];
  const n = brewBodies({ x: 0, y: 0, z: 0, ...e } as BlockEntity, l, blank(), (b) => out.push({ ...b }));
  expect(n).toBe(out.length);
  return out;
}
const cup = (stage: string, brewS = 0) => ({ kind: 'brew_cup', stage, drink: 'x', brewS, steamS: 0, ingredient: null });
const pot = (container: string, heatS: number, boiling: boolean, dryS = 0) => ({ kind: 'boil_bucket', container, heatS, boiling, dryS });
const top = (b: Body): number => b.y + b.sy;

describe('brew bodies: the cup', () => {
  it('shows nothing until the water comes through', () => {
    for (const s of ['cup', 'cone', 'loaded']) expect(bodies(cup(s))).toHaveLength(0);
  });

  it('while brewing: a cup filling from its floor and a falling stream from the spout down to the surface', () => {
    const early = bodies(cup('brewing', 0.2), look({ drinkColour: 0x2c1a0e }));
    const late = bodies(cup('brewing', BREW_SECONDS * 0.9), look({ drinkColour: 0x2c1a0e }));
    expect(early).toHaveLength(2);
    const [fill, stream] = early;
    expect(fill.surface).toBe(true);
    expect(fill.x - fill.sx / 2).toBeGreaterThan(CUP_INNER_MIN);
    expect(fill.x + fill.sx / 2).toBeLessThan(CUP_INNER_MAX);
    expect(top(late[0])).toBeGreaterThan(top(fill) + 0.1);
    expect(top(late[0])).toBeLessThan(CUP_RIM_Y);
    // The stream falls (flow down), is thin, runs from inside the spout to the liquid's surface.
    expect(stream.speed).toBeGreaterThan(0);
    expect(stream.flowY).toBe(-1);
    expect(stream.surface).toBe(false);
    expect(stream.sx).toBeLessThan(1 / 16);
    expect(stream.y).toBeCloseTo(top(fill));
    expect(top(stream)).toBeGreaterThan(CUP_SPOUT_Y);
    expect(top(stream)).toBeLessThan(CUP_CONE_TOP);
    expect(late[1].sy).toBeLessThan(stream.sy);
    // Clear water turns into the drink.
    expect(early[0].colour >> 16).toBeGreaterThan(late[0].colour >> 16);
  });

  it('done: one still body at the brim, in the drink\'s colour (a default when the drink has none)', () => {
    const [b] = bodies(cup('done'), look({ drinkColour: 0x8aa040 }));
    expect(bodies(cup('done'))).toHaveLength(1);
    expect(b.colour).toBe(0x8aa040);
    expect(b.boil).toBe(0);
    expect(b.speed).toBe(0);
    expect(top(b)).toBeGreaterThan(CUP_RIM_Y - 1 / 16);
    expect(bodies(cup('done'))[0].colour).toBe(DEFAULT_DRINK);
    expect(bodies(cup('brewing', 0))[0].colour).not.toBe(BREW_WATER);
  });
});

describe('brew bodies: water and sap on a furnace top', () => {
  it('picks the vessel from the container', () => {
    expect(vesselOf('water_pail')).toBe('bucket');
    expect(vesselOf('water_beaker')).toBe('beaker');
    expect(vesselOf('pine_sap')).toBe('beaker');
    expect(vesselOf('water_vial')).toBe('vial');
  });

  it('water is still when cold, simmers as it heats and rolls at the boil', () => {
    const cold = bodies(pot('water_beaker', 0, false))[0];
    const warm = bodies(pot('water_beaker', BOIL_SECONDS * 0.8, false))[0];
    const hot = bodies(pot('water_beaker', BOIL_SECONDS, true))[0];
    expect(cold.boil).toBe(0);
    expect(cold.surface).toBe(true);
    expect(warm.boil).toBeGreaterThan(0);
    expect(warm.boil).toBeLessThan(hot.boil);
    expect(hot.boil).toBe(BOIL);
    expect(hot.colour).toBe(GLASS_WATER);
    // A slower container takes longer to simmer.
    expect(bodies(pot('water_beaker', BOIL_SECONDS * 0.8, false), look({ boilScale: 2 }))[0].boil).toBeLessThan(warm.boil);
  });

  it('sits inside the glass: beaker 4..12 from its 1/16 base under the 10/16 walls, vial 7..9 under 14/16', () => {
    const beaker = bodies(pot('water_beaker', 0, false))[0];
    expect(beaker.x - beaker.sx / 2).toBeGreaterThan(4 / 16);
    expect(beaker.x + beaker.sx / 2).toBeLessThan(12 / 16);
    expect(beaker.y).toBeCloseTo(1 / 16);
    expect(top(beaker)).toBeLessThan(10 / 16);
    const vial = bodies(pot('water_vial', 0, false))[0];
    expect(vial.x - vial.sx / 2).toBeGreaterThan(7 / 16);
    expect(vial.x + vial.sx / 2).toBeLessThan(9 / 16);
    expect(top(vial)).toBeLessThan(14 / 16);
    expect(top(vial)).toBeGreaterThan(top(beaker));
  });

  it('boiling water sinks as it boils away', () => {
    const fresh = bodies(pot('water_vial', 0, true, 0))[0];
    const late = bodies(pot('water_vial', 0, true, BOIL_DRY_SECONDS * 0.9))[0];
    expect(top(late)).toBeLessThan(top(fresh) - 1 / 16);
  });

  it('sap darkens to resin and bubbles slow and thick', () => {
    const sap = bodies(pot('pine_sap', 0, false), look({ holds: 'sap' }))[0];
    const resin = bodies(pot('pine_sap', 0, true), look({ holds: 'sap' }))[0];
    expect(sap.colour).toBe(SAP);
    expect(sap.boil).toBe(0);
    expect(resin.colour).toBe(RESIN);
    expect(resin.boil).toBeGreaterThan(0);
    expect(resin.boil).toBeLessThan(BOIL);
    expect(top(resin)).toBeLessThan(top(sap));
  });

  it('the kettle shows its water only while it boils', () => {
    expect(bodies({ kind: 'kettle', waterL: 1, boiling: false })).toHaveLength(0);
    const [b] = bodies({ kind: 'kettle', waterL: 1, boiling: true }, look({ active: true }));
    expect(b.boil).toBe(BOIL);
    expect(bodies({ kind: 'kettle', waterL: 0 }, look({ active: true }))).toHaveLength(0);
    expect(bodies({ kind: 'furnace' })).toHaveLength(0);
  });

  it('mixes colours channel by channel', () => {
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
    expect(mixHex(0x102030, 0x405060, 0)).toBe(0x102030);
    expect(mixHex(0x102030, 0x405060, 2)).toBe(0x405060);
  });
});
