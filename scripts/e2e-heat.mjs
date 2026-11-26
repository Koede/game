// Phone check of the heat view: an insulated room with a fire beside an open pen, the temperature chip and the H overlay.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-heat');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let spot = null;

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'heat-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });
  await report.step('an insulated room with a fire stands beside an open floor, at night', async () => {
    spot = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.85);
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 8, pz = Math.floor(p.z);
      // Floor 9 x 5, a 5 x 5 room (west) walled and roofed in insulated wall with a doorway-less lava fire, open floor (east).
      for (let dx = -5; dx <= 5; dx++) for (let dz = -3; dz <= 3; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 5; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      for (let dx = -5; dx <= -1; dx++) for (let dz = -3; dz <= 1; dz++) {
        const edge = dx === -5 || dx === -1 || dz === -3 || dz === 1;
        for (let dy = 0; dy <= 3; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, edge && dy < 3 ? 'insulated_wall' : dy === 3 ? 'insulated_wall' : 'air');
      }
      hw.setVoxel(px - 4, py, pz - 2, 'lava');
      hw.teleport(px + 4.5, py, pz + 0.5);
      return { px, py, pz };
    });
    await d.settle(800);
    const inside = await d.hw((s) => window.__hw.temperatureAt(s.px - 2, s.py, s.pz - 1), spot);
    const outside = await d.hw((s) => window.__hw.temperatureAt(s.px + 3, s.py, s.pz), spot);
    console.log(`inside ${inside.toFixed(1)} C, outside ${outside.toFixed(1)} C`);
    assert(inside > outside + 10, `room not warmer: ${inside} vs ${outside}`);
  });
  await report.step('the temperature chip shows, and tapping it turns the heat view on', async () => {
    const chip = page.locator('[data-testid="heat-chip"]');
    await chip.waitFor({ state: 'visible', timeout: 10_000 });
    console.log('chip:', await chip.innerText());
    await d.press(chip);
    await d.settle(1200);
    const n = await d.hw(() => window.__hw.state().phase);
    assert(n === 'playing', 'still playing');
    await d.hw((s) => window.__hw.look(Math.PI / 2 + 0.15, -0.32), spot);
    await d.settle(1200);
    await d.shot('01-heat-view');
  });
  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
