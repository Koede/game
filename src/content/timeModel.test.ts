/**
 * T1 (docs/advice/balance-economy.md 5): expert minutes to leave each age, from the live content. Bands, not points.
 * Where the model sits outside the dossier's band today, `PENDING` widens it and says why; the last test fails as
 * soon as an age is back inside its band, so the widening is removed with the fix.
 */
import { describe, expect, it } from 'vitest';
import { AGES } from './tech';
import { ageBundle, expertMinutes, itemCosts } from './timeModel';

/** The dossier's target bands, expert minutes, by age name. */
const BANDS: Record<string, readonly [number, number]> = {
  ember: [8, 18], bronze: [28, 42], forge: [20, 32], current: [24, 36], atomic: [28, 48],
};
/** Today's widened bands, with the reason. */
const PENDING: Record<string, { band: readonly [number, number]; why: string }> = {
  bronze: { band: [8, 42], why: 'the boiler and steam kit of BRONZE_PLAN is not built yet' },
  forge: { band: [20, 45], why: 'the kit (coats, crusher, boiler, engine, tanks, pump) prices ~25 min alone' },
  current: { band: [24, 62], why: 'the Plasma hearth (53 casings, ~23 min at 4 per forge) plus the Current kit (~25 min)' },
  atomic: { band: [28, 85], why: 'the Star hearth still needs 93 casings and the make_deuterium goal still asks for 8 cells' },
};
const TOTAL_MAX = 190;
const TOTAL_PENDING = 215;

const leaving = AGES.slice(0, 5).map((a, i) => ({ name: a.key, i, min: expertMinutes(i) }));

describe('T1 time to the next age', () => {
  it('prices every item an age asks for', () => {
    for (const { i, name } of leaving) {
      for (const a of ageBundle(i)) expect(Number.isFinite(itemCosts().get(a.item) ?? NaN), `${name}: ${a.item}`).toBe(true);
    }
  });

  it('each age sits inside its band', () => {
    for (const { name, min } of leaving) {
      const [lo, hi] = PENDING[name]?.band ?? BANDS[name];
      expect(min, `${name}: ${min.toFixed(1)} expert min`).toBeGreaterThanOrEqual(lo);
      expect(min, `${name}: ${min.toFixed(1)} expert min`).toBeLessThanOrEqual(hi);
    }
  });

  it('no age is more than 2.5x or less than 0.6x the one before (Forge over Bronze waits on the Bronze kit)', () => {
    for (let i = 1; i < leaving.length; i++) {
      const r = leaving[i].min / leaving[i - 1].min;
      const hi = leaving[i].name === 'forge' && PENDING.bronze ? 4 : 2.5;
      expect(r, `${leaving[i].name} / ${leaving[i - 1].name}`).toBeLessThanOrEqual(hi);
      expect(r, `${leaving[i].name} / ${leaving[i - 1].name}`).toBeGreaterThanOrEqual(0.6);
    }
  });

  it('the whole game stays within its total', () => {
    const total = leaving.reduce((s, a) => s + a.min, 0);
    expect(total).toBeLessThanOrEqual(Object.keys(PENDING).length > 0 ? TOTAL_PENDING : TOTAL_MAX);
  });

  it('a widened band is still needed (remove it from PENDING once the age is back in its band)', () => {
    for (const name of Object.keys(PENDING)) {
      const a = leaving.find((x) => x.name === name)!;
      const [lo, hi] = BANDS[name];
      expect(a.min >= lo && a.min <= hi, `${name} is back in its band: drop it from PENDING (${PENDING[name].why})`).toBe(false);
    }
  });
});
