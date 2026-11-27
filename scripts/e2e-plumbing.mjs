// Phone/desktop check of Bronze Age plumbing: a hand pump in a pond worked by Use fills a copper line that ends in a
// sprinkler over a wheat field; the sprinkler sprays and the crops read as watered; a boiler Water Port joins the line.
//   node scripts/e2e-plumbing.mjs [--no-build] [--device=phonePortrait]
// `window.__hw` only sets up (blocks, time) and reads state; the pump strokes are real taps on the Use button.
import { mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { e2eDist, ensureBuilt } from './lib/e2eArgs.mjs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';

const root = resolve(fileURLToPath(import.meta.url), '../..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-plumbing');
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
let b = null;

try {
  await report.step('a new world loads into play', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'plumbing-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
  });

  await report.step('a pond, a hand pump, a copper line and a sprinkler over a wheat field are set out', async () => {
    b = await d.hw(() => {
      const hw = window.__hw;
      hw.setTime(0.3);
      hw.setWeather('clear', true);
      hw.clearInventory();
      const p = hw.state().player;
      const px = Math.floor(p.x) + 24, py = Math.floor(p.y) + 4, pz = Math.floor(p.z) + 10;
      // A flat stone pad, cleared above.
      for (let dx = -6; dx <= 14; dx++) for (let dz = -10; dz <= 3; dz++) {
        hw.setVoxel(px + dx, py - 2, pz + dz, 'stone');
        hw.setVoxel(px + dx, py - 1, pz + dz, 'grass');
        for (let dy = 0; dy <= 5; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      // A 3x3 pond west of the field, sunk into the grass.
      for (let dx = -6; dx <= -4; dx++) for (let dz = -7; dz <= -5; dz++) hw.setVoxel(px + dx, py - 1, pz + dz, 'water');
      // The pump stands in the pond's east edge, on its water.
      const pump = { x: px - 4, y: py, z: pz - 6 };
      hw.setVoxel(pump.x, pump.y, pump.z, 'hand_pump');
      // Pipe out of the pump's east side, up, and along to a sprinkler on a post two blocks over the field.
      hw.setVoxel(px - 3, py, pz - 6, 'water_pipe');
      for (let x = px - 3; x <= px + 4; x++) hw.setVoxel(x, py + 1, pz - 6, 'water_pipe');
      const spr = { x: px + 5, y: py + 1, z: pz - 6 };
      hw.setVoxel(spr.x, spr.y, spr.z, 'sprinkler');
      hw.setVoxel(spr.x, py, spr.z, 'oak_log');
      hw.setVoxel(spr.x, py - 1, spr.z, 'oak_log');
      // Wheat round the post, 3 blocks out.
      const crops = [];
      for (let dx = -2; dx <= 4; dx++) for (let dz = -2; dz <= 2; dz++) {
        const x = spr.x + dx, z = spr.z + dz;
        if (dx === 0 && dz === 0) continue;
        hw.setVoxel(x, py - 1, z, 'farmland');
        hw.setVoxel(x, py, z, 'wheat_1');
        crops.push({ x, y: py, z });
      }
      // A crop 6 blocks out: beyond the sprinkler's reach.
      hw.setVoxel(spr.x + 6, py - 1, spr.z, 'farmland');
      hw.setVoxel(spr.x + 6, py, spr.z, 'wheat_1');
      hw.teleport(px - 3.5, py, pz - 2.5);
      return { px, py, pz, pump, spr, crops, far: { x: spr.x + 6, y: py, z: spr.z } };
    });
    await d.settle(1200);
    await d.hw((v) => window.__hw.lookAt(v.spr.x, v.spr.y - 2, v.spr.z), b);
    await d.settle(400);
    await d.shot('01-field-dry');
    const r = await d.hw((v) => window.__hw.plumbing(v.crops[0].x, v.crops[0].y, v.crops[0].z), b);
    assert(r.hydrated === false, `before pumping the wheat is dry: ${JSON.stringify(r)}`);
    const s = await d.hw((v) => window.__hw.plumbing(v.spr.x, v.spr.y, v.spr.z), b);
    assert(/^Dry/.test(s.status ?? ''), `sprinkler status: ${JSON.stringify(s)}`);
  });

  await report.step('Use on the hand pump strokes water into the line', async () => {
    await d.hw((v) => window.__hw.lookAt(v.pump.x, v.pump.y, v.pump.z), b);
    await d.settle(300);
    for (let i = 0; i < 6; i++) {
      await d.use();
      await sleep(450);
    }
    const t = await toasts();
    assert(/Hand Pump: /.test(t), `toast: ${t}`);
    await d.shot('02-pumped');
    const line = await d.hw((v) => window.__hw.plumbing(v.pump.x, v.pump.y, v.pump.z), b);
    assert(line.waterL > 0, `line holds water: ${JSON.stringify(line)}`);
  });

  await report.step('the sprinkler sprays and every crop in reach is watered, the far one is not', async () => {
    await sleep(800);
    const s = await d.hw((v) => window.__hw.plumbing(v.spr.x, v.spr.y, v.spr.z), b);
    assert(/^Watering crops/.test(s.status ?? ''), `sprinkler status: ${JSON.stringify(s)}`);
    const blk = await d.hw((v) => window.__hw.getBlock(v.spr.x, v.spr.y, v.spr.z), b);
    assert(blk.active === true, 'sprinkler shows its wet rose');
    const wet = await d.hw((v) => v.crops.map((c) => window.__hw.plumbing(c.x, c.y, c.z).hydrated), b);
    assert(wet.every((w) => w === true), `crops watered: ${JSON.stringify(wet)}`);
    const far = await d.hw((v) => window.__hw.plumbing(v.far.x, v.far.y, v.far.z), b);
    assert(far.hydrated === false, `far crop stays dry: ${JSON.stringify(far)}`);
    // Stand back south of the field and look at the sprinkler on its post.
    await d.hw((v) => {
      const hw = window.__hw;
      for (let y = v.py; y <= v.py + 1; y++) hw.setVoxel(v.spr.x - 4, y, v.spr.z + 5, 'stone');
      hw.teleport(v.spr.x - 3.5, v.py + 2, v.spr.z + 5.5);
    }, b);
    await d.settle(600);
    await d.hw((v) => window.__hw.lookAt(v.spr.x, v.spr.y - 1.2, v.spr.z), b);
    await sleep(350);
    await d.shot('03-spraying');
    await sleep(250);
    await d.shot('03b-spraying');
  });

  await report.step('Use on the sprinkler reads out the line', async () => {
    await d.hw((v) => window.__hw.teleport(v.spr.x + 0.5, v.py, v.spr.z + 3.5), b);
    await d.settle(300);
    await d.hw((v) => window.__hw.lookAt(v.spr.x, v.spr.y, v.spr.z), b);
    await d.settle(250);
    await d.use();
    await sleep(300);
    const t = await toasts();
    assert(/Sprinkler: Watering crops/.test(t), `toast: ${t}`);
    await d.shot('04-sprinkler-toast');
  });

  await report.step('a boiler Water Port joins the line and reads as filling', async () => {
    const port = await d.hw((v) => {
      const hw = window.__hw;
      const x = v.px - 3, y = v.py + 2, z = v.pz - 6; // on top of the riser
      hw.setVoxel(x, y, z, 'water_port');
      return { x, y, z };
    }, b);
    await d.settle(400);
    const r = await d.hw((p) => window.__hw.plumbing(p.x, p.y, p.z), port);
    assert(r.status !== null && /line/.test(r.status), `water port reading: ${JSON.stringify(r)}`);
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
