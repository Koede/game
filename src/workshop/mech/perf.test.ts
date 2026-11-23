import { describe, expect, it } from 'vitest';
import { setup } from '../parts.test';

describe('workshop performance (200 parts)', () => {
  it('a 200-part network with flywheels, a brake, a fuse, a press and a drum ticks within budget', () => {
    const t = setup();
    t.put(0, 0, 0, 'clockwork_motor');
    for (let x = 1; x <= 190; x++) t.put(x, 0, 0, x % 40 === 0 ? 'flywheel' : x % 33 === 0 ? 'pillow_block' : 'drive_shaft');
    t.put(191, 0, 0, 'brake');
    t.put(192, 0, 0, 'shear_pin');
    t.put(193, 0, 0, 'cam_drum');
    t.put(194, 0, 0, 'mech_millstone');
    for (let z = 1; z <= 5; z++) t.put(100, 0, z, 'drive_shaft');
    t.shop.use(0, 0, 0, null, () => undefined);
    t.run(1);
    const t0 = performance.now();
    const ticks = 100;
    for (let i = 0; i < ticks; i++) t.shop.tick(0.05);
    const per = (performance.now() - t0) / ticks;
    expect(t.shop.netAt(1, 0, 0)?.parts).toBeGreaterThan(190);
    // Budget: well under a quarter of a 20 Hz tick (12.5 ms) for the whole workshop at 200 parts; a loose ceiling that CI can hold.
    expect(per).toBeLessThan(12);
  });
});
