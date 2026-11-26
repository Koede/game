// Phone/desktop check of the small steam loop: a Copper Steam Kettle on a Bronze Furnace, water poured by a real tap,
// a Steam Rotor, a shaft and a millstone; wheat on the belt turns to flour with no hand on a crank.
//   node scripts/e2e-steam.mjs [--no-build] [--device=phonePortrait]
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
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-steam');
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
    await page.fill('.hw-title input', 'steam-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a furnace, a steam kettle, a rotor, a shaft, a millstone and a belt stand in a cleared yard', async () => {
    P = await d.hw(() => {
      const hw = window.__hw;
      hw.clearInventory();
      hw.setTime(0.3);
      hw.setWeather('clear');
      const p = hw.state().player;
      const gy = Math.floor(p.y), x0 = Math.floor(p.x), z0 = Math.floor(p.z) - 4;
      for (let x = x0 - 3; x <= x0 + 4; x++) for (let z = z0 - 2; z <= z0 + 7; z++) {
        hw.setVoxel(x, gy - 1, z, 'stone');
        for (let y = gy; y <= gy + 5; y++) hw.setVoxel(x, y, z, 'air');
      }
      hw.setVoxel(x0 - 2, gy, z0, 'furnace_bronze');
      hw.setVoxel(x0 - 2, gy + 1, z0, 'steam_kettle');
      hw.setVoxel(x0 - 2, gy + 2, z0, 'steam_rotor');
      hw.setVoxel(x0 - 1, gy + 2, z0, 'drive_shaft');
      hw.setVoxel(x0, gy + 2, z0, 'mech_millstone', 0);
      // Set-up only: keep the furnace hot (fuel handling is covered elsewhere).
      const f = [...hw.app.game.state.world.entities()].find((e) => e.kind === 'furnace' && e.x === x0 - 2 && e.y === gy && e.z === z0);
      window.__steamHold = setInterval(() => { f.tempC = 400; }, 20);
      hw.give('water_pail', 1);
      return { gy, x0, z0 };
    });
    await d.settle(400);
    const k = await d.hw((p) => window.__hw.getBlock(p.x0 - 2, p.gy + 1, p.z0).block, P);
    assert(k === 'steam_kettle', `kettle block ${k}`);
  });

  await report.step('a tap with a water pail fills the kettle and it boils', async () => {
    await d.hw((p) => { window.__hw.teleport(p.x0 - 3.5, p.gy, p.z0 + 1.5); }, P);
    await d.selectItem('water_pail');
    const aimed = await d.aimAt({ x: P.x0 - 2, y: P.gy + 1, z: P.z0 });
    assert(aimed, 'aims at the kettle');
    await d.use();
    await d.settle(300);
    await d.hw(() => window.__hw.tick(60));
    const line = await d.hw((p) => window.__hw.app.game.workshop.describe(p.x0 - 2, p.gy + 2, p.z0), P);
    const dbg = await d.hw((p) => ({ e: window.__hw.app.game.state.world.getEntity(p.x0 - 2, p.gy + 1, p.z0), inv: window.__hw.state().inventory, t: window.__hw.state().target }), P);
    assert(/steam up/.test(line ?? ''), `rotor says: ${line} ${JSON.stringify(dbg)}`);
    await d.shot('1-kettle');
  });

  await report.step('the rotor turns the shaft, and wheat on the belt becomes flour', async () => {
    await d.hw((p) => {
      const hw = window.__hw;
      hw.app.game.state.player.ground.spawn('wheat', 2, p.x0 + 0.5, p.gy + 3.1, p.z0 + 0.5, { scatter: false });
      const f = [...hw.app.game.state.world.entities()].find((e) => e.kind === 'furnace' && e.x === p.x0 - 2 && e.y === p.gy && e.z === p.z0);
      for (let i = 0; i < 40; i++) { f.tempC = 400; hw.tick(20); } // synchronous ticks: the hold interval cannot run between them
    }, P);
    const n = await d.hw(() => window.__hw.app.game.state.player.ground.items.filter((e) => e.item === 'flour').reduce((a, e) => a + e.count, 0));
    assert(n >= 1, `flour ${n}`);
    const line = await d.hw((p) => window.__hw.app.game.workshop.describe(p.x0 - 1, p.gy + 2, p.z0), P);
    assert(/16 rpm/.test(line ?? ''), `shaft says: ${line}`);
    await d.hw((p) => { window.__hw.teleport(p.x0 - 1.5, p.gy, p.z0 + 4.5); window.__hw.lookAt(p.x0 - 2, p.gy + 1.8, p.z0 + 0.5); }, P);
    await d.settle(500);
    await d.shot('2-turning');
  });

  await report.step('no console errors', async () => {
    await d.hw(() => clearInterval(window.__steamHold));
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
