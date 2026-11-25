import { describe, expect, it } from 'vitest';
import { expand, pour } from '../../core/chem';
import { buildRig, runUntil } from '../../sim/distillKit';
import { DistillFx } from './distillFx';

const fullLight = (_x: number, _y: number, _z: number, out: Float32Array): Float32Array => out.fill(1);

describe('distillery effects', () => {
  it('draws the charge, the receiver and, while boiling, bubbles and drips; nothing from afar', () => {
    const r = buildRig('CR/F./B.');
    const flask = r.first('F');
    pour(expand('sugar_wash', 3000), flask.mix, 3000);
    const fx = new DistillFx(r.kit.world, fullLight);
    fx.update(1, 0, 0);
    // The wash settles: the watery body, and a thin film of fusel oil floating on it.
    expect(fx.counts.liquids).toBeGreaterThanOrEqual(1);
    expect(fx.counts.motion).toBe(0);
    runUntil(r, 900, () => flask.state === 'working' && (r.first('R').flow ?? 0) > 0, 20);
    runUntil(r, 900, () => false, 2);
    fx.update(1, 0, 0);
    expect(fx.counts.liquids).toBeGreaterThanOrEqual(3); // flask, receiver, the drop in the coil
    expect(fx.counts.motion).toBeGreaterThan(3); // bubbles and drips
    fx.update(1, 500, 500);
    expect(fx.counts).toEqual({ liquids: 0, motion: 0 });
    fx.dispose();
  });

  it('settles oil on water into two layers in a flask', () => {
    const r = buildRig('CR/F./B.');
    const flask = r.first('F');
    flask.mix.water = 1000;
    flask.mix.kerosene = 500;
    const fx = new DistillFx(r.kit.world, fullLight);
    fx.update(1, 0, 0);
    // The belly's profile steps (liquid follows the glass), so each layer is one body per run of slices with the same
    // interior: the water layer is at least one, the oil above it at least one more.
    expect(fx.counts.liquids).toBeGreaterThanOrEqual(2);
    fx.dispose();
  });

  it('stacks the cut colours up a running column', () => {
    const r = buildRig('..CR/..|./RC|./..|CR/..F/..B');
    pour(expand('crude_oil', 4000), r.first('F').mix, 4000);
    r.first('B').setC = 350;
    runUntil(r, 900, () => false, 30);
    const bands = r.every('|').map((s) => s.band ?? 0);
    expect(bands.filter((b) => b !== 0).length).toBeGreaterThan(0);
  });
});
