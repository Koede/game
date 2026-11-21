/**
 * Every process card (src/content/recipesDistill.ts) is built from its rig string, fed its inputs and run: it must make
 * at least what the card promises (scaled to one flask when the card is bigger), as the named fluids its outputs carry.
 * This is what keeps the Codex honest.
 */
import { describe, expect, it } from 'vitest';
import { nameOf, total } from '../core/chem';
import { CHEM_CONTAINERS } from '../core/distill';
import { PROCESS_CARDS } from '../content/recipesDistill';
import { buildRig, feed, runUntil } from './distillKit';

describe('process cards', () => {
  for (const card of PROCESS_CARDS) {
    it(`${card.id} makes what its card says`, () => {
      const r = buildRig(card.rig);
      const still = r.cells.some((c) => c.ch === 'F');
      const into = still ? r.first('F') : r.first('V');
      const k = feed(card, into);
      const before = r.kit.sim.distill.litres();
      if (still) r.first('B').setC = card.minTempC;
      runUntil(r, 900, () => into.state === 'done' || into.state === 'blocked', 1500);
      expect(into.state, `${card.id} ended ${into.state}`).toBe('done');
      // Volume is conserved through the whole run.
      expect(r.kit.sim.distill.litres()).toBeCloseTo(before, 6);
      const modules = [...r.kit.sim.distill.all()];
      for (const out of [card.output, ...(card.byproducts ?? [])]) {
        const c = CHEM_CONTAINERS[out.item];
        if (!c) continue; // an empty container handed back
        const need = out.count * c.litres * k;
        const have = Math.max(...modules.filter((m) => nameOf(m.mix) === c.fluid).map((m) => total(m.mix)), 0);
        expect(have, `${card.id}: ${c.fluid}`).toBeGreaterThanOrEqual(need - 1e-6);
      }
    });
  }
});
