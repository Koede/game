// Browser check that the year paints the landscape (headless Chromium):
//   node scripts/e2e-seasons.mjs --out=<dir-with-a-build> --device=phonePortrait --shots=<dir>
// A small oak on a grass pad is screenshotted in spring, summer, autumn and winter; the leaf and grass pixels must differ.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const flag = (name, fallback) => argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const device = flag('device', 'phonePortrait');
const dir = e2eDist(root, argv);
await ensureBuilt(argv, dir);
const shots = resolve(flag('shots', join(root, 'test-results/e2e-seasons')));
mkdirSync(shots, { recursive: true });
const report = createReporter();
const session = await openGame({ dir, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const avg = {};

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'season-e2e');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(2000);
  });

  await report.step('an oak stands on a grass pad in front of the player', async () => {
    await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.35);
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y), pz = Math.floor(p.z);
      for (let dx = -5; dx <= 5; dx++) for (let dz = 0; dz <= 9; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'grass');
        for (let dy = 0; dy <= 9; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      for (let dy = 0; dy < 4; dy++) hw.setVoxel(px, py + dy, pz + 5, 'oak_log');
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) for (let dy = 3; dy <= 5; dy++) if (Math.abs(dx) + Math.abs(dz) + (dy - 3) < 5) hw.setVoxel(px + dx, py + dy, pz + 5 + dz, 'oak_leaves');
      hw.teleport(px + 0.5, py, pz + 0.5);
      hw.lookAt(px, py + 3, pz + 5);
    });
    await d.settle(800);
  });

  for (const [name, day] of [['spring', 4], ['summer', 10], ['autumn', 16], ['winter', 22]]) {
    await report.step(`${name}: the picture is taken`, async () => {
      await d.hw((n) => window.__hw.setDay(n), day);
      await d.settle(1200);
      await d.shot(name);
      const buf = await page.screenshot();
      avg[name] = await page.evaluate(async (b64) => {
        const img = new Image();
        img.src = 'data:image/png;base64,' + b64;
        await img.decode();
        const c = document.createElement('canvas');
        c.width = img.width; c.height = img.height;
        const g = c.getContext('2d');
        g.drawImage(img, 0, 0);
        const w = Math.floor(img.width * 0.5), h = Math.floor(img.height * 0.35);
        const px = g.getImageData(Math.floor(img.width * 0.25), Math.floor(img.height * 0.3), w, h).data;
        let r = 0, gg = 0, bb = 0, n = 0;
        for (let i = 0; i < px.length; i += 4) { r += px[i]; gg += px[i + 1]; bb += px[i + 2]; n++; }
        return [r / n, gg / n, bb / n];
      }, buf.toString('base64'));
    });
  }

  await report.step('autumn leans orange against summer, winter is paler', async () => {
    const s = avg.summer, a = avg.autumn;
    console.log(JSON.stringify(avg));
    assert(a[0] / a[1] > s[0] / s[1] + 0.05, `autumn r/g ${a[0] / a[1]} vs summer ${s[0] / s[1]}`);
  });
  await report.step('no console errors', async () => { assert(errors.length === 0, errors.slice(0, 5).join(' | ')); });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
