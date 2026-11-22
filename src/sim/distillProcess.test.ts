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
      const into = r.cells.some((c) => c.ch === 'F') ? r.first('F') : r.cells.some((c) => c.ch === 'V') ? r.first('V') : r.first('X');
      const k = feed(card, into);
      const before = r.kit.sim.distill.litres();
      if (r.cells.some((c) => c.ch === 'B')) r.first('B').setC = card.minTempC;
      const fluidOuts = [card.output, ...(card.byproducts ?? [])].filter((o) => CHEM_CONTAINERS[o.item]);
      runUntil(r, 900, () => into.state === 'done' || into.state === 'blocked', 1500);
      // A filter bed spends its medium and then blocks; every other card finishes.
      expect(into.state, `${card.id} ended ${into.state}`).toBe(card.station === 'filter_bed' ? 'blocked' : 'done');
      if (fluidOuts.length === [card.output, ...(card.byproducts ?? [])].length) {
        expect(r.kit.sim.distill.litres()).toBeCloseTo(before, 6);
      }
      const modules = [...r.kit.sim.distill.all()];
      for (const out of fluidOuts) {
        const c = CHEM_CONTAINERS[out.item];
        const need = out.count * c.litres * k;
        const have = Math.max(...modules.filter((m) => nameOf(m.mix) === c.fluid).map((m) => total(m.mix)), 0);
        expect(have, `${card.id}: ${c.fluid}`).toBeGreaterThanOrEqual(need - 1e-6);
      }
      if (fluidOuts.length === 0) {
        const made = into.out?.find((s) => s.item === card.output.item)?.count ?? 0;
        expect(made, card.id).toBeGreaterThanOrEqual(card.output.count);
      }
    });
  }
});
