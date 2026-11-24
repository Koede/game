import { describe, expect, it } from 'vitest';
import { arcRoute, crucibleColour, dominant, flowPath, FLOW_HOLD_S, FlowLog, MAX_FLOWS } from './essentiaFlow';
import { POTIONS } from './potions';
import { fillJar, setup } from './testKit';

const mapOf = (cells: Record<string, string>) => (x: number, y: number, z: number): string => cells[`${x},${y},${z}`] ?? 'air';

describe('essentia flows', () => {
  it('a stream holds while units keep coming and fades after FLOW_HOLD_S', () => {
    const log = new FlowLog();
    log.record([0, 1, 0], [3, 1, 0], 'vein');
    log.record([0, 1, 0], [3, 1, 0], 'vein');
    expect(log.flows.length).toBe(1);
    expect(log.draining(0, 1, 0)).toBe(true);
    expect(log.draining(3, 1, 0)).toBe(false);
    log.tick(FLOW_HOLD_S - 0.1);
    log.record([0, 1, 0], [3, 1, 0], 'vein');
    log.tick(FLOW_HOLD_S - 0.1);
    expect(log.flows.length).toBe(1);
    log.tick(0.2);
    expect(log.flows.length).toBe(0);
    for (let i = 0; i < MAX_FLOWS + 5; i++) log.record([i, 0, 0], [0, 0, 0], 'gale');
    expect(log.flows.length).toBe(MAX_FLOWS);
  });

  it('finds the tube cells from a jar to its consumer, in order', () => {
    const at = mapOf({ '1,0,0': 'essentia_tube', '2,0,0': 'essentia_tube', '2,0,1': 'essentia_tube', '2,1,1': 'essentia_tube', '9,0,0': 'essentia_tube' });
    expect(flowPath(at, [0, 0, 0], [3, 1, 1])).toEqual([[0, 0, 0], [1, 0, 0], [2, 0, 0], [2, 0, 1], [2, 1, 1], [3, 1, 1]]);
    expect(flowPath(at, [5, 0, 0], [6, 0, 0])).toEqual([[5, 0, 0], [6, 0, 0]]); // touching
    expect(flowPath(at, [0, 0, 0], [8, 5, 0])).toBeNull(); // not joined: through the air
  });

  it('a linked mirror carries the stream across its jump', () => {
    const at = mapOf({ '1,0,0': 'linked_mirror', '20,0,0': 'linked_mirror', '21,0,0': 'essentia_tube' });
    const link = (x: number): [number, number, number] | null => (x === 1 ? [20, 0, 0] : x === 20 ? [1, 0, 0] : null);
    expect(flowPath(at, [0, 0, 0], [22, 0, 0], link)).toEqual([[0, 0, 0], [1, 0, 0], [20, 0, 0], [21, 0, 0], [22, 0, 0]]);
    expect(flowPath(at, [0, 0, 0], [22, 0, 0])).toBeNull(); // without the link, mirrors do not join
  });

  it('an air stream rises, crosses in straight legs and comes down', () => {
    const r = arcRoute(0, 1, 0, 2, 1.5, -2, 0.5);
    expect(r).toEqual([[0, 1, 0], [0, 2, 0], [2, 2, 0], [2, 2, -2], [2, 1.5, -2]]);
    expect(arcRoute(0, 1, 0, 0, 1, 2, 0.5)).toHaveLength(4); // no x leg
  });

  it('crucible water takes the tint of its essentia, more as it fills', () => {
    expect(crucibleColour({}, 0x3f8fd8, 64)).toBe(0x3f8fd8);
    const little = crucibleColour({ cinder: 2 }, 0x0000ff, 64);
    const lots = crucibleColour({ cinder: 60 }, 0x0000ff, 64);
    expect((lots >> 16) & 255).toBeGreaterThan((little >> 16) & 255);
    expect(lots & 255).toBeLessThan(little & 255);
    expect(dominant({ vein: 3, gale: 7, mind: 1 })).toBe('gale');
    expect(dominant({})).toBeNull();
  });

  it('an infusion drawing from jars logs streams from each jar to the altar, and a jar shows it is draining', () => {
    const t = setup();
    t.learnAll();
    t.put(0, 1, 0, 'infusion_altar');
    t.put(2, 1, 0, 'arcane_pedestal');
    t.put(-2, 1, 0, 'arcane_pedestal');
    t.put(0, 1, 2, 'essentia_jar');
    fillJar(t, 0, 1, 2, 'vein', 2);
    t.hold('glass');
    t.magic.use(t.at(0, 1, 0));
    t.hold('copper_ingot', 2);
    t.magic.use(t.at(2, 1, 0));
    t.magic.use(t.at(-2, 1, 0));
    t.hold('vis_rod');
    t.magic.use(t.at(0, 1, 0));
    t.magic.rng = () => 1;
    t.magic.tick(0.5);
    expect(t.magic.flows.flows.map((f) => [f.from, f.to, f.aspect])).toEqual([[[0, 1, 2], [0, 1, 0], 'vein']]);
    expect(t.magic.flows.draining(0, 1, 2)).toBe(true);
  });

  it('a crucible holding a draught\'s essentia shows its colour, and boils over a fire', () => {
    const t = setup();
    t.learnAll();
    t.put(4, 1, 4, 'crucible');
    expect(t.magic.crucibleViews()).toEqual([]);
    t.hold('water_vial');
    t.magic.use(t.at(4, 1, 4));
    let v = t.magic.crucibleViews();
    expect(v).toHaveLength(1);
    expect(v[0]).toMatchObject({ x: 4, y: 1, z: 4, hot: true, potion: null });
    // Sugar's own aspects are not haste's; put the essentia in directly.
    t.magic.crucibleAt(4, 1, 4); // fresh state is stored on use
    const c = (t.magic as unknown as { crucibles: Map<string, { ess: Record<string, number> }> }).crucibles.get('4,1,4')!;
    c.ess = { gale: 3, drive: 2 };
    v = t.magic.crucibleViews();
    expect(v[0].potion).toBe(POTIONS.find((p) => p.key === 'potion_haste')!.color);
    t.hold('sugar');
    expect(t.magic.use(t.at(4, 1, 4))).toBe('worked');
    expect(t.player.inventory.count('potion_haste')).toBe(1);
    expect(t.magic.crucibleViews()[0].potion).toBe(POTIONS.find((p) => p.key === 'potion_haste')!.color); // just brewed
    t.magic.tick(10);
    expect(t.magic.crucibleViews()[0].potion).toBeNull();
    t.setFire(0);
    expect(t.magic.crucibleViews()[0].hot).toBe(false);
  });
});
