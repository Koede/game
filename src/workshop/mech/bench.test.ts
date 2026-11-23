import { describe, expect, it } from 'vitest';
import { mechBenchBlueprint, placeMechBench } from './bench';
import { setup } from '../parts.test';

describe('mechanics bench', () => {
  it('the blueprint has no two blocks in one cell and every key is a known block', () => {
    const bp = mechBenchBlueprint();
    expect(new Set(bp.map((b) => `${b.dx},${b.dy},${b.dz}`)).size).toBe(bp.length);
    expect(bp.length).toBeGreaterThan(30);
  });

  it('placed in a world: row 0 turns with a brake and a copper fuse, row 4 whips, row 8 lights its lamps, row 12 presses', () => {
    const t = setup();
    expect(placeMechBench(t.world, 0, 0, 0, t.shop)).toBeGreaterThan(30);
    t.run(3);
    expect(t.shop.netAt(1, 0, 0)?.w).toBeGreaterThan(0.2); // the flywheel line spins up
    expect(t.shop.describe(3, 0, 0)).toMatch(/Copper pin/);
    expect(t.shop.netAt(2, 0, 4)?.whip).toBe(true);
    let lit = false;
    for (let i = 0; i < 200; i++) {
      t.shop.tick(0.05);
      lit ||= t.shop.signals.lit('2,0,7') || t.shop.signals.lit('3,0,8') || t.shop.signals.lit('2,0,9');
    }
    expect(lit).toBe(true);
    t.run(30);
    expect(t.shop.logi.peek(3, 0, 12).some((e) => e.item === 'bronze_plate')).toBe(true);
  });
});
