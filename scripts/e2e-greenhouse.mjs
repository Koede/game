// Phone check of greenhouses (docs/api/greenhouse.md): on a hard-winter world in winter, an open bed freezes, a glass house
// keeps its crops alive but cold, and a fire inside warms it to a greenhouse where wheat grows at full pace.
import { join, resolve } from 'node:path';
import { mkdirSync } from 'node:fs';
import { createReporter, openGame, waitFor } from './lib/browser.mjs';
import { Driver } from './lib/e2eDriver.mjs';
import { ensureBuilt, e2eDist } from './lib/e2eArgs.mjs';

const root = resolve(import.meta.dirname, '..');
const argv = process.argv.slice(2);
const device = argv.find((a) => a.startsWith('--device='))?.slice(9) ?? 'phonePortrait';
const shots = process.env.SHOTS ?? join(root, 'test-results/e2e-greenhouse');
mkdirSync(shots, { recursive: true });
const dist = e2eDist(root, argv);
await ensureBuilt(argv, dist);
const report = createReporter();
const session = await openGame({ dir: dist, device });
const { page, errors } = session;
const d = new Driver(page, device, (name) => page.screenshot({ path: join(shots, `${device}-${name}.png`) }));
const { assert } = report;
let s = null;
const label = () => page.evaluate(() => document.querySelector('.hw-cross__label')?.textContent ?? '');
/** Aims at a crop cell and waits for the crosshair label to name it. */
async function aimAt(x, y, z, want) {
  await d.hw((c) => window.__hw.lookAt(c[0], c[1], c[2]), [x, y, z]);
  for (let i = 0; i < 30; i++) {
    const t = await label();
    if (want.test(t)) return t;
    await d.settle(200);
  }
  return label();
}

try {
  await report.step('a new world loads into play, set to a hard winter at noon', async () => {
    await page.waitForSelector('.hw-title', { timeout: 30_000 });
    await page.fill('.hw-title input', 'greenhouse-check');
    await d.press(page.locator('.hw-title button', { hasText: 'New World' }));
    await waitFor(page, () => window.__hw.state().phase === 'playing', 'play', { timeout: 120_000 });
    await d.settle(1500);
    await d.hw(() => {
      const hw = window.__hw;
      hw.setDay(20);
      hw.setTime(0.3);
      hw.setWeather('clear');
      hw.setHardWinter(true);
    });
  });

  await report.step('a glass house over a wheat bed stands beside an open wheat bed', async () => {
    s = await d.hw(() => {
      const hw = window.__hw;
      const p = hw.state().player;
      const px = Math.floor(p.x), py = Math.floor(p.y) + 10, pz = Math.floor(p.z);
      // A two-layer stone platform in the air (water and the fire pit need a floor under them, or the room leaks).
      for (let dx = -8; dx <= 6; dx++) for (let dz = -8; dz <= 4; dz++) {
        hw.setVoxel(px + dx, py - 2, pz + dz, 'stone');
        hw.setVoxel(px + dx, py - 1, pz + dz, 'stone');
        for (let dy = 0; dy <= 6; dy++) hw.setVoxel(px + dx, py + dy, pz + dz, 'air');
      }
      // Glass house: walls x -7..-1, z -7..-3, y 0..2, roof y 3. Inside: a 3x3 wheat bed (x -6..-4) with water in the middle
      // and a stone aisle (x -3..-2) to stand in.
      for (let dx = -7; dx <= -1; dx++) for (let dz = -7; dz <= -3; dz++) {
        const edge = dx === -7 || dx === -1 || dz === -7 || dz === -3;
        for (let dy = 0; dy <= 2; dy++) if (edge) hw.setVoxel(px + dx, py + dy, pz + dz, 'glass');
        hw.setVoxel(px + dx, py + 3, pz + dz, 'glass');
        if (!edge && dx <= -4) {
          const water = dx === -5 && dz === -5;
          hw.setVoxel(px + dx, py - 1, pz + dz, water ? 'water' : 'farmland');
          if (!water) hw.setVoxel(px + dx, py, pz + dz, 'wheat_1');
        }
      }
      // Open bed east: the same 3x3, no roof.
      for (let dx = 2; dx <= 4; dx++) for (let dz = -6; dz <= -4; dz++) {
        const water = dx === 3 && dz === -5;
        hw.setVoxel(px + dx, py - 1, pz + dz, water ? 'water' : 'farmland');
        if (!water) hw.setVoxel(px + dx, py, pz + dz, 'wheat_1');
      }
      hw.teleport(px + 0.5, py, pz + 1.5);
      return { px, py, pz, gh: [px - 4, py, pz - 5], open: [px + 2, py, pz - 5] };
    });
    await d.settle(1200);
    const gh = await d.hw((c) => window.__hw.cropView(c[0], c[1], c[2]), s.gh);
    const open = await d.hw((c) => window.__hw.cropView(c[0], c[1], c[2]), s.open);
    console.log('glass house:', JSON.stringify(gh), ' open bed:', JSON.stringify(open));
    assert(open && open.exposed && open.shelter === 'frozen' && open.rate === 0, `open bed not frozen: ${JSON.stringify(open)}`);
    assert(gh && !gh.exposed && gh.shelter === 'cold' && gh.rate > 0 && gh.rate < 0.5, `glass house not a cold frame: ${JSON.stringify(gh)}`);
  });

  await report.step('the crosshair says the open bed is frozen', async () => {
    const t = await aimAt(s.open[0], s.open[1], s.open[2], /frozen/);
    console.log('open bed label:', t);
    assert(/Wheat - frozen: roof it with glass and heat it/.test(t), `label: ${t}`);
    await d.shot('01-open-frozen');
  });

  await report.step('the crosshair says the unheated glass house is cold', async () => {
    await d.hw((c) => window.__hw.teleport(c.px - 2 + 0.5, c.py, c.pz - 4 + 0.5), s);
    await d.settle(800);
    const t = await aimAt(s.gh[0], s.gh[1], s.gh[2], /cold|frozen/);
    console.log('glass house label:', t);
    assert(/Wheat - cold -?\d+ °C, ripe in .*heat it to 10 °C/.test(t), `label: ${t}`);
    await d.shot('02-glass-cold');
  });

  await report.step('a fire pit in the glass house makes it a greenhouse growing at full pace', async () => {
    await d.hw((c) => {
      window.__hw.setVoxel(c.px - 3, c.py - 1, c.pz - 6, 'lava');
    }, s);
    await d.settle(1500);
    const gh = await d.hw((c) => window.__hw.cropView(c[0], c[1], c[2]), s.gh);
    console.log('heated glass house:', JSON.stringify(gh));
    assert(gh && gh.shelter === 'greenhouse' && gh.tempC >= 10 && gh.rate >= 1, `not a greenhouse: ${JSON.stringify(gh)}`);
    const t = await aimAt(s.gh[0], s.gh[1], s.gh[2], /greenhouse/);
    console.log('greenhouse label:', t);
    assert(/Wheat - greenhouse \d+ °C, ripe in/.test(t), `label: ${t}`);
    await d.shot('03-greenhouse-warm');
  });

  await report.step('the heat view shows the warm greenhouse beside the frozen bed', async () => {
    await d.hw((c) => window.__hw.teleport(c.px + 0.5, c.py + 4, c.pz + 3.5), s);
    await d.hw(() => window.__hw.setHeatView(true));
    await d.hw((c) => window.__hw.lookAt(c.px - 1, c.py - 1, c.pz - 5), s);
    await d.settle(1500);
    await d.shot('04-heat-view');
    await d.hw(() => window.__hw.setHeatView(false));
  });

  await report.step('no console errors', async () => {
    assert(errors.length === 0, errors.slice(0, 5).join(' | '));
  });
} finally {
  await session.close();
}
console.log(report.failures ? `\n${report.failures} step(s) failed` : '\nall steps passed');
process.exit(report.failures ? 1 : 0);
