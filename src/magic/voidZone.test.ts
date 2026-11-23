import { describe, expect, it } from 'vitest';
import { setup } from './testKit';
import { MIN_CHUNKS, nearestZone, zoneAt, zoneOfCell } from './voidZone';
import { VOID_WAIT_S } from './magic';

const SEED = 12345;

/** The first chunk of any zone found scanning outward along x and z. */
function findZone(): { cx: number; cz: number; aspect: string } {
  for (let r = MIN_CHUNKS; r < 200; r++)
    for (let c = -r; c <= r; c++) for (const [cx, cz] of [[r, c], [c, r], [-r, c], [c, -r]]) {
      const z = zoneAt(SEED, cx, cz);
      if (z) return { cx: z.cx, cz: z.cz, aspect: z.aspect };
    }
  throw new Error('no void zone');
}

describe('void zones', () => {
  it('are deterministic, rare, never near the centre, and 3 x 3 chunks', () => {
    const z = findZone();
    expect(zoneAt(SEED, z.cx, z.cz)).toEqual(zoneAt(SEED, z.cx, z.cz));
    expect(Math.max(Math.abs(z.cx), Math.abs(z.cz))).toBeGreaterThanOrEqual(MIN_CHUNKS);
    expect(zoneAt(SEED, z.cx + 1, z.cz - 1)?.cx).toBe(z.cx);
    expect(zoneAt(SEED, 0, 0)).toBeNull();
    let n = 0;
    for (let gx = -10; gx < 10; gx++) for (let gz = -10; gz < 10; gz++) if (zoneOfCell(SEED, gx, gz)) n++;
    expect(n).toBeGreaterThan(40);
    expect(n).toBeLessThan(200);
    expect(nearestZone(SEED, z.cx, z.cz, 4)?.zone.cx).toBe(z.cx);
  });

  it('an empty vial bottles the late aspect once the Void Jar is learned, then waits', () => {
    const z = findZone();
    const t = setup();
    t.player.position.x = z.cx * 16 + 8;
    t.player.position.z = z.cz * 16 + 8;
    t.hold('glass_vial', 3);
    expect(t.magic.use(null)).toBeNull(); // not researched: nothing happens
    t.learn('void_jar');
    const warp = t.magic.warp;
    expect(t.magic.use(null)).toBe('worked');
    expect(t.player.inventory.count(`vial_${z.aspect}`)).toBe(1);
    expect(t.magic.warp).toBeGreaterThan(warp);
    expect(t.magic.use(null)).toBe('refused');
    t.magic.tick(VOID_WAIT_S + 1);
    expect(t.magic.use(null)).toBe('worked');
    expect(t.player.inventory.count(`vial_${z.aspect}`)).toBe(2);
  });

  it('does nothing outside a zone, and does not touch jars; the rod reading points to a rift', () => {
    const t = setup();
    t.learn('void_jar', 'aura_reading');
    t.hold('glass_vial', 2);
    expect(t.magic.use(null)).toBeNull();
    t.put(2, 1, 2, 'essentia_jar');
    expect(t.magic.use(t.at(2, 1, 2))).toBe('refused'); // the jar's own empty-vial use: an empty jar has nothing to give
    const z = findZone();
    const u = setup();
    u.learn('void_jar', 'aura_reading');
    u.hold('vis_rod');
    u.player.position.x = z.cx * 16 + 8;
    u.player.position.z = z.cz * 16 + 8;
    expect(u.magic.rodReading()).toMatch(/rift here/);
  });

  it('the wait is saved', () => {
    const z = findZone();
    const t = setup();
    t.player.position.x = z.cx * 16 + 8;
    t.player.position.z = z.cz * 16 + 8;
    t.learn('void_jar');
    t.hold('glass_vial', 3);
    t.magic.use(null);
    const u = setup();
    u.player.position.x = t.player.position.x;
    u.player.position.z = t.player.position.z;
    u.hold('glass_vial', 3);
    u.magic.load(JSON.parse(JSON.stringify(t.magic.toJSON())));
    expect(u.magic.use(null)).toBe('refused');
  });
});
