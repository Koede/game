// One-off phone check of pneumatic tubes: a sender on one crate, a tube run, a receiver on another crate.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-tubes');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const toasts = () => page.locator('.hw-toasts').innerText().catch(() => '');
const total = (stacks, item) => (stacks ?? []).reduce((n, s) => n + (s.item === item ? s.count : 0), 0);
let b = null;

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'tube-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });
  await report.step('two crates joined by a sender, a tube run and a receiver', async () => {
    b = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.2);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 6, pz = Math.floor(p.z);
      for (let dx = -6; dx <= 6; dx++) for (let dz = -7; dz <= 2; dz++) {
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 4; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      hw.teleport(px + 0.5, py, pz + 1.5);
      const z = pz - 4;
      hw.setVoxel(px - 5, py, z, 'crate');
      hw.setVoxel(px - 4, py, z, 'tube_sender');
      for (let x = px - 3; x <= px + 3; x++) hw.setVoxel(x, py, z, 'air_tube');
      hw.setVoxel(px + 4, py, z, 'tube_receiver');
      hw.setVoxel(px + 5, py, z, 'crate');
      hw.setVoxel(px - 4, py + 1, z, 'air_compressor');
      hw.setVoxel(px - 3, py + 1, z, 'air_tank');
      return { px, py, pz, z };
    });
    await d.settle(800);
    const ok = await d.hw((b) => window.__hw.fillCrate(b.px - 5, b.py, b.z, 'stone', 40) && window.__hw.fillCrate(b.px - 5, b.py, b.z, 'coal', 10), b);
    assert(ok, 'crate filled');
    await d.hw((b) => { window.__hw.teleport(b.px + 0.5, b.py, b.z + 6.5); window.__hw.lookAt(b.px, b.py + 0.6, b.z); }, b);
    await d.settle(800);
    await d.shot('01-line');
  });
  await report.step('with no air, Use on the sender says it needs 1 bar and nothing moves', async () => {
    await d.hw((b) => { window.__hw.teleport(b.px - 3.5, b.py, b.z + 2.5); window.__hw.lookAt(b.px - 4, b.py, b.z); }, b);
    await d.settle(300);
    await d.use();
    await sleep(400);
    const t = await toasts();
    assert(/Pneumatic Sender: Needs 1 bar/.test(t), `toast: ${t}`);
    const to = await d.hw((b) => window.__hw.crate(b.px + 5, b.py, b.z), b);
    assert(total(to, 'stone') === 0, `receiver crate: ${JSON.stringify(to)}`);
    await d.shot('02-no-air');
  });
  await report.step('at 3 bar the capsules carry everything across', async () => {
    await d.hw((b) => window.__hw.setAirBar(b.px - 4, b.py, b.z, 3), b);
    await d.hw((b) => { window.__hw.teleport(b.px - 3.5, b.py, b.z + 2.5); window.__hw.lookAt(b.px - 4, b.py, b.z); }, b);
    await d.settle(300);
    await d.use();
    await sleep(300);
    const t = await toasts();
    assert(/Pneumatic Sender: (Sending|Crate is empty)/.test(t), `toast: ${t}`);
    await d.shot('03-sending');
    await waitFor(page, (b) => {
      const s = window.__hw.crate(b.px + 5, b.py, b.z) ?? [];
      return s.reduce((n, x) => n + x.count, 0) === 50;
    }, 'all 50 items in the receiver crate', { timeout: 20_000, arg: b }).catch(() => undefined);
    const to = await d.hw((b) => window.__hw.crate(b.px + 5, b.py, b.z), b);
    const from = await d.hw((b) => window.__hw.crate(b.px - 5, b.py, b.z), b);
    assert(total(to, 'stone') === 40 && total(to, 'coal') === 10, `receiver crate: ${JSON.stringify(to)}`);
    assert((from ?? []).length === 0, `sender crate: ${JSON.stringify(from)}`);
  });
  await report.step('the receiver crate screen shows the delivered items', async () => {
    await d.hw((b) => { window.__hw.teleport(b.px + 4.5, b.py, b.z + 2.5); window.__hw.lookAt(b.px + 5, b.py, b.z); }, b);
    await d.settle(300);
    await d.use();
    await sleep(800);
    await d.shot('04-receiver-crate');
    const open = await d.hw(() => window.__hw.state().screen ?? null).catch(() => null);
    console.log('screen', JSON.stringify(open));
    await d.hw(() => window.__hw.close());
  });
  await report.step('the page logged no errors', async () => {
    assert(errors.length === 0, `console errors: ${JSON.stringify(errors.slice(0, 5))}`);
  });
} catch (e) {
  report.fail?.(e);
  console.error(e);
}
await session.close();
process.exit(report.summary ? report.summary() : 0);
