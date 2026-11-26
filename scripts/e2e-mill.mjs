// Phone/desktop check of the mill wheel: a wheel between two flowing-water sides turns a shaft and a millstone, a dam
// raises its stress capacity, and a frozen winter river cuts it.
//   node scripts/e2e-mill.mjs [--no-build] [--device=phonePortrait]
// `window.__hw` only sets up (blocks, the furnace held hot) and reads state.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-mill');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);

const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let P = null;
try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'mill-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a mill wheel between two streams, a shaft and a millstone stand in a cleared yard', async () => {
    P = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.3);
      hw.setWeather('clear');
      const p = hw.state().player;
      const gy = Math.floor(p.y) + 8, x0 = Math.floor(p.x), z0 = Math.floor(p.z) - 4;
      for (let x = x0 - 4; x <= x0 + 4; x++) for (let z = z0 - 6; z <= z0 + 7; z++) {
        hw.setVoxel(x, gy - 1, z, 'stone');
        for (let y = gy; y <= gy + 5; y++) hw.setVoxel(x, y, z, 'air');
      }
      // Stone basins hold the two pools so the flow engine cannot flood the yard.
      for (const [wx, wz, h] of [[x0 - 3, z0, 3], [x0 - 2, z0 - 1, 3], [x0 - 2, z0 + 1, 3], [x0 - 1, z0 + 2, 0], [x0, z0 + 1, 0]]) for (let y = gy; y <= gy + h; y++) hw.setVoxel(wx, y, wz, 'stone');
      hw.setVoxel(x0 - 2, gy, z0, 'water');
      hw.setVoxel(x0 - 1, gy, z0, 'mill_wheel');
      hw.setVoxel(x0 - 1, gy, z0 + 1, 'water');
      hw.setVoxel(x0, gy, z0, 'drive_shaft');
      hw.setVoxel(x0 + 1, gy, z0, 'mech_millstone', 0);
      return { gy, x0, z0 };
    });
    await d.settle(400);
    await d.hw(() => window.__hw.tick(60));
    const k = await d.hw((p) => window.__hw.getBlock(p.x0 - 1, p.gy, p.z0).block, P);
    assert(k === 'mill_wheel', `wheel block ${k}`);
  });

  await report.step('the river turns the wheel and the shaft', async () => {
    const line = await d.hw((p) => window.__hw.app.game.workshop.describe(p.x0 - 1, p.gy, p.z0), P);
    assert(/river turning it/.test(line ?? ''), `wheel says: ${line}`);
    const shaft = await d.hw((p) => window.__hw.app.game.workshop.describe(p.x0, p.gy, p.z0), P);
    assert(/rpm/.test(shaft ?? ''), `shaft says: ${shaft}`);
    await d.hw((p) => { window.__hw.teleport(p.x0 + 2.5, p.gy, p.z0 + 4.0); }, P);
    await d.settle(1500);
    await d.hw((p) => { window.__hw.lookAt(p.x0 - 1, p.gy + 1.0, p.z0); return window.__hw.state().player; }, P);
    await d.settle(500);
    await d.shot('1-river');
  });

  await report.step('a dam adds head and a frozen river cuts the capacity', async () => {
    const cap = (p) => window.__hw.app.game.state.sim.millWheelAt(p.x0 - 1, p.gy, p.z0)?.capacity ?? 0;
    const flat = await d.hw(cap, P);
    await d.hw((p) => { window.__hw.setVoxel(p.x0 - 2, p.gy + 1, p.z0, 'water'); window.__hw.setVoxel(p.x0 - 2, p.gy + 2, p.z0, 'water'); window.__hw.tick(20); }, P);
    const dammed = await d.hw(cap, P);
    assert(dammed > flat, `head ${flat} -> ${dammed}`);
    await d.hw(() => { window.__hw.app.game.state.clock.day = 22; window.__hw.tick(20); });
    const frozen = await d.hw(cap, P);
    assert(frozen > 0 && frozen < dammed / 5, `frozen ${frozen} vs ${dammed}`);
    await d.shot('2-winter');
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
