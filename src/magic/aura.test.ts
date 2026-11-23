import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { auraKind, auraYield, baseAura, scaleByAura, CALM_RADIUS, RICH_VIS_S, TAINT_WARP_S } from './aura';

const SEED = 12345;
/** The first chunk along the x axis whose aura is of `kind`. */
function find(kind: 'rich' | 'tainted'): number {
  for (let cx = 4; cx < 400; cx++) if (auraKind(baseAura(SEED, cx, 0)) === kind) return cx;
  throw new Error(`no ${kind} chunk`);
}

describe('aura per chunk', () => {
  it('is deterministic, calm at the centre, and has rich and tainted lands', () => {
    expect(baseAura(SEED, 7, -3)).toBe(baseAura(SEED, 7, -3));
    for (let cx = -CALM_RADIUS; cx <= CALM_RADIUS; cx++) expect(auraKind(baseAura(SEED, cx, 0))).toBe('plain');
    expect(find('rich')).toBeGreaterThan(0);
    expect(find('tainted')).toBeGreaterThan(0);
    for (let cx = 0; cx < 50; cx++) expect(Math.abs(baseAura(SEED, cx, 2))).toBeLessThanOrEqual(1);
  });

  it('scales a fingerprint: rich rounds up, tainted down but never to nothing', () => {
    expect(scaleByAura({ vein: 3, cinder: 1 }, 'rich')).toEqual({ vein: 4, cinder: 2 });
    expect(scaleByAura({ vein: 3, cinder: 1 }, 'tainted')).toEqual({ vein: 2, cinder: 1 });
    expect(scaleByAura({ vein: 3 }, 'plain')).toEqual({ vein: 3 });
    expect(auraYield('rich')).toBeGreaterThan(auraYield('tainted'));
  });

  it('a crucible gives more in a rich chunk and less in a tainted one', () => {
    const yieldIn = (cx: number): number => {
      const t = setup();
      const x = cx * 16 + 4;
      t.put(x, 1, 4, 'crucible');
      t.learn('crucible');
      t.hold('water_vial');
      t.magic.use(t.at(x, 1, 4));
      t.hold('copper_ore', 1);
      t.magic.use(t.at(x, 1, 4));
      const ess = t.magic.crucibleAt(x, 1, 4)!.ess;
      return Object.values(ess).reduce((a, b) => a + (b ?? 0), 0);
    };
    const plain = yieldIn(0);
    expect(yieldIn(find('rich'))).toBeGreaterThan(plain);
    expect(yieldIn(find('tainted'))).toBeLessThanOrEqual(plain);
  });

  it('a rich chunk trickles vis into a carried rod; a tainted one raises warp; a shift saves', () => {
    const t = setup();
    t.hold('vis_rod');
    t.player.position.x = find('rich') * 16 + 4;
    t.player.position.z = 4;
    for (let i = 0; i < RICH_VIS_S + 2; i++) t.magic.tick(1);
    expect(t.magic.visTotal()).toBeGreaterThanOrEqual(1);
    const u = setup();
    u.player.position.x = find('tainted') * 16 + 4;
    u.player.position.z = 4;
    for (let i = 0; i < TAINT_WARP_S + 2; i++) u.magic.tick(1);
    expect(u.magic.warp).toBeGreaterThanOrEqual(1);
    // a cleansing shift lifts a tainted chunk, and is saved
    const x = u.player.position.x;
    u.magic.shiftAura(x, 4, 1);
    expect(u.magic.auraKindAt(x, 4)).not.toBe('tainted');
    const v = setup();
    v.magic.load(JSON.parse(JSON.stringify(u.magic.toJSON())));
    expect(v.magic.auraAt(x, 4)).toBeCloseTo(u.magic.auraAt(x, 4));
  });

  it('the rod reading names the aura', () => {
    const t = setup();
    t.learn('aura_reading');
    t.hold('vis_rod');
    expect(t.magic.rodReading()).toMatch(/calm aura/);
  });
});
